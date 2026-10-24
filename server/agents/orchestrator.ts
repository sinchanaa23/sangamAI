// The orchestrator is a small state machine, not a model: search, quotes, a ranked shortlist, at most four rounds of counter-offers
// with the best supplier (then the runner-up if it walks away), audit, confirm.
// Agents propose; this code enforces the hard limits (wage floor and the price that pays it, free capacity, budget, deadline),
// so a negotiation always ends, never agrees below the wage floor, and can be replayed.
// Messages follow the shape of Beckn's search, select, init and confirm.
import type { NegotiationEvent, Offer, Rfq } from '../../src/contracts';
import type { Db } from '../db';
import type { Ask } from '../llm';
import { audit } from './auditor';
import { buyerMove, buyerRuleMove } from './buyer';
import { supplierMove, supplierRuleMove } from './supplier';
import { buildContext, buyerLimit, certificateGaps, ensureDataset, findCandidates, minViablePrice, pickLine, quoteGate, rankOffers, reviewReasons, scoreOffer, termsOf, toOffer, violation } from './tools';
import type { DealContext, Terms } from './tools';

export const MAX_ROUNDS = 4;
const ATTEMPTS = 2; // model tries per turn before the rule-based move takes over
const WALK_MARGIN = 1.05; // a supplier may walk only when the buyer's price is within 5% of its price floor
const DEADLINE_MS = 85_000; // keeps a whole negotiation under the 90 s target; after it every turn is rule-based

export interface RunDeps {
  ask: Ask;
  emit: (e: NegotiationEvent) => void;
  db: Db;
}

interface Move { action: 'offer' | 'counter' | 'accept' | 'walk'; terms: Terms; message: string }
type Side = 'buyer' | 'supplier';
/** What one turn produced: an offer to pass on, an acceptance, a walk-away (with the reason), or a quote blocked at the gate. */
interface TurnResult { offer?: Offer; accepted?: Offer; walked?: string; blocked?: string }

const at = () => new Date().toISOString();

export async function runNegotiation(negId: string, rfq: Rfq, supplierIds: string[], deps: RunDeps): Promise<void> {
  const { db, emit } = deps;
  const started = Date.now();
  const ask: Ask = (o) => (Date.now() - started > DEADLINE_MS ? Promise.reject(new Error('negotiation deadline')) : deps.ask(o));
  let nextOffer = 0;

  const end = (outcome: 'deal' | 'no-deal', dealId?: string) => emit({ type: 'end', at: at(), outcome, ...(dealId ? { dealId } : {}) });

  /**
   * One side's turn. Asks the agent (twice at most), checks every offer against the hard limits, shows refused ones with the reason,
   * and falls back to the rule-based move if the agent keeps breaking a limit or fails. A buyer counter below the price floor is shown
   * as refused and then raised to the floor in code. A supplier's opening quote is gated (grade E or under the legal minimum) before anyone sees it.
   */
  async function turn(side: Side, c: DealContext, round: number, standing: Offer | undefined, ownLast: Offer | undefined,
    kind: 'select' | 'init'): Promise<TurnResult> {
    let feedback: string | undefined;
    for (let attempt = 0; attempt <= ATTEMPTS; attempt++) {
      const useRule = attempt === ATTEMPTS;
      const move: Move = side === 'supplier'
        ? await (useRule ? Promise.resolve(supplierRuleMove(c, ownLast, standing)) : supplierMove(ask, c, ownLast, standing, feedback))
        : await (useRule ? Promise.resolve(buyerRuleMove(c, standing!, round)) : buyerMove(ask, c, standing!, round, feedback));

      if (move.action === 'walk') {
        // A supplier may refuse an offer that leaves it no room above its price floor; it may not walk away from a price well above it
        const offered = termsOf(c, standing!).pricePerUnit;
        const floor = minViablePrice(c, termsOf(c, standing!));
        if (offered > floor * WALK_MARGIN) { feedback = `You may only walk away if the buyer's price is within 5% of your price floor of ₹${floor} a unit; it is ₹${Math.round(offered)}. Counter instead.`; continue; }
        emit({ type: 'init', from: 'supplier', at: at(), text: move.message });
        return { walked: `${c.seller.name} walked away at ₹${Math.round(offered)} a unit (its price floor is ₹${floor})` };
      }

      if (move.action === 'accept') {
        const target = standing!;
        // Defence in depth: nobody can accept an offer that breaks the wage floor, and the buyer not one above its budget or deadline
        const bad = violation(c, termsOf(c, target)) ?? (side === 'buyer' ? buyerLimit(c, termsOf(c, target)) : undefined);
        if (bad) { feedback = `You cannot accept that: ${bad}`; continue; }
        const accepted: Offer = { ...target, id: `${negId}-o${nextOffer++}`, status: 'accepted' };
        emit({ type: 'confirm', from: side, at: at(), offer: accepted, text: move.message });
        return { accepted };
      }

      let terms = move.terms;
      let message = move.message;
      if (side === 'buyer' && terms.pricePerUnit < minViablePrice(c, terms)) {
        const floor = minViablePrice(c, terms);
        const why = violation(c, terms) ?? `Below the price floor of ₹${floor} a unit.`;
        emit({ type: kind, from: side, at: at(), offer: toOffer(c, negId, nextOffer++, round, terms, 'rejected', why), text: move.message });
        terms = { ...terms, pricePerUnit: floor };
        message = `We raise our counter to the price floor of ₹${floor} a unit: below it the workers could not be paid the ${c.floor.basis === 'legal-minimum' ? 'legal minimum wage' : 'living wage'}.`;
      }

      const reason = violation(c, terms) ?? (side === 'buyer' ? buyerLimit(c, terms) : undefined);
      if (reason) {
        emit({ type: kind, from: side, at: at(), offer: toOffer(c, negId, nextOffer++, round, terms, 'rejected', reason), text: message });
        feedback = reason;
        continue;
      }
      const offer = toOffer(c, negId, nextOffer++, round, terms, kind === 'select' ? 'proposed' : 'countered');
      if (side === 'supplier' && round === 1) {
        const gate = quoteGate(c, offer);
        if (gate.block) {
          // Nothing the supplier says can fix a block that comes from its own record, so there is no retry
          emit({ type: kind, from: side, at: at(), offer: { ...offer, status: 'rejected', reason: gate.block }, text: message });
          return { blocked: gate.block };
        }
      }
      emit({ type: kind, from: side, at: at(), offer, text: message });
      return { offer };
    }
    return {};
  }

  /** Audit, then sign or hold back. The grade decides what the Auditor may do; open certificate gaps or review items rule out a pass. */
  async function conclude(c: DealContext, accepted: Offer) {
    emit({ type: 'select', from: 'auditor', at: at(), text: `Checking the accepted offer against the Fair Work Scorecard: wage, hours, safety, child and forced labour.` });
    const score = scoreOffer(c, accepted);
    const verdict = await audit(ask, c, accepted, score, [...certificateGaps(c), ...reviewReasons(c)]);
    emit({ type: 'audit', at: at(), score, decision: verdict.decision });
    if (verdict.decision === 'block') {
      emit({ type: 'confirm', from: 'auditor', at: at(), text: `${verdict.text} The deal is blocked and nothing is signed.` });
      return end('no-deal');
    }
    const dealId = `deal-${negId.replace(/^neg-/, '')}`;
    const pending = verdict.decision === 'flag';
    db.put('deals', { id: dealId, negotiationId: negId, rfqId: rfq.id, supplierId: c.seller.id, offer: accepted, score, decision: verdict.decision, status: pending ? 'pending-review' : 'confirmed', at: at() });
    emit({ type: 'confirm', from: 'auditor', at: at(), text: pending ? `${verdict.text} Held for the Sangam team to review before a credential is signed.` : verdict.text });
    end('deal', dealId);
  }

  /** Rounds 2 to 4 with one supplier. Returns 'finished' when the negotiation has ended (deal or blocked), or why this supplier is out. */
  async function negotiate(c: DealContext, opening: Offer): Promise<string> {
    let standing = opening;
    for (let round = 2; round <= MAX_ROUNDS; round++) {
      const b = await turn('buyer', c, round, standing, undefined, 'init');
      if (b.accepted) { await conclude(c, b.accepted); return 'finished'; }
      if (!b.offer) return `${c.seller.name} could not be met with a counter inside the budget and the price floor`;
      const s = await turn('supplier', c, round, b.offer, standing, 'init');
      if (s.accepted) { await conclude(c, s.accepted); return 'finished'; }
      if (s.walked) return s.walked;
      if (!s.offer) return `${c.seller.name} could not make a valid offer`;
      standing = s.offer;
    }
    // Out of rounds: the buyer takes the supplier's last offer if the budget and deadline allow, or moves on
    const stuck = buyerLimit(c, termsOf(c, standing));
    if (!stuck) {
      const accepted: Offer = { ...standing, id: `${negId}-o${nextOffer++}`, status: 'accepted' };
      emit({ type: 'confirm', from: 'buyer', at: at(), offer: accepted, text: `After ${MAX_ROUNDS} rounds we accept the last offer: it is within our budget.` });
      await conclude(c, accepted);
      return 'finished';
    }
    return `after ${MAX_ROUNDS} rounds ${c.seller.name}'s last offer did not fit: ${stuck}`;
  }

  // ---- search -------------------------------------------------------------------------------------------------------------------
  ensureDataset();
  const line = pickLine(rfq.part);
  const candidates = findCandidates(rfq, line, supplierIds);
  emit({ type: 'search', from: 'buyer', at: at(), text: `Buyer needs ${rfq.quantity.toLocaleString('en-IN')} × ${rfq.part} by ${rfq.needBy}. Budget ${rfq.budget.currency} ${rfq.budget.amount.toLocaleString('en-IN')}${rfq.verifiedOnly ? ', verified suppliers only' : ''}. Looking for suppliers of ${line.name.toLowerCase()}.` });
  if (!candidates.length) {
    emit({ type: 'search', from: 'supplier', at: at(), text: 'No supplier matched this request.' });
    return end('no-deal');
  }
  const contexts = candidates.map((s) => buildContext(rfq, s, line, db));
  contexts.forEach((c) => emit({ type: 'search', from: 'supplier', at: at(), text: `${c.seller.name} (${c.seller.type}, ${c.districtName}) has about ${c.freeUnitsPerMonth.toLocaleString('en-IN')} units a month free and ${c.availableWorkers} workers available.` }));

  // ---- round 1: every candidate quotes; quotes that break a rule are refused before the buyer sees them -----------------------------
  const quotes = (await Promise.all(contexts.map(async (c) => ({ c, r: await turn('supplier', c, 1, undefined, undefined, 'select') })))).filter((q) => q.r.offer);
  if (!quotes.length) {
    emit({ type: 'confirm', from: 'auditor', at: at(), text: 'No supplier produced a quote that meets the fair-wage, record and capacity limits.' });
    return end('no-deal');
  }

  // ---- the buyer sees every remaining option, ranked by code: best, not cheapest -----------------------------------------------------
  const ranked = rankOffers(quotes.map((q) => ({ c: q.c, offer: q.r.offer! })));
  const list = ranked.map((r, i) => `${i + 1}. ${r.c.seller.name}: ${r.reason} (score ${r.score.toFixed(2)})`).join('\n');
  emit({ type: 'select', from: 'buyer', at: at(), offer: ranked[0]!.offer, text: `Shortlist, best first (fair work and trust count most, then total cost, lead time and certificates):\n${list}\nWe negotiate with ${ranked[0]!.c.seller.name} first.` });

  // ---- negotiate down the shortlist: if a supplier walks away or cannot be met, the next one is tried -----------------------------------
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i]!;
    const result = await negotiate(r.c, r.offer);
    if (result === 'finished') return;
    const next = ranked[i + 1];
    emit({ type: 'select', from: 'buyer', at: at(), text: `${result}. ${next ? `Moving to the next option: ${next.c.seller.name}.` : 'No options are left.'}` });
  }
  emit({ type: 'confirm', from: 'buyer', at: at(), text: 'No supplier on the shortlist could reach a deal that pays a fair wage within our budget. We end the negotiation.' });
  end('no-deal');
}
