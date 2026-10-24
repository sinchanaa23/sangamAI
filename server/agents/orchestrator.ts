// The orchestrator is a small state machine, not a model: search, quotes, at most four rounds of counter-offers, audit, confirm.
// Agents propose; this code enforces the hard limits (wage floor, free capacity, budget ceiling), so a negotiation always ends,
// never agrees below the wage floor, and can be replayed. Messages follow the shape of Beckn's search, select, init and confirm.
import type { Credential, NegotiationEvent, Offer, Rfq } from '../../src/contracts';
import type { Db } from '../db';
import type { Ask } from '../llm';
import { audit } from './auditor';
import { buyerMove, buyerRuleMove } from './buyer';
import { supplierMove, supplierRuleMove } from './supplier';
import { buildContext, buyerLimit, ensureDataset, findCandidates, pickLine, scoreOffer, termsOf, toOffer, violation } from './tools';
import type { DealContext, Terms } from './tools';

export const MAX_ROUNDS = 4;
const ATTEMPTS = 2; // model tries per turn before the rule-based move takes over
const DEADLINE_MS = 85_000; // keeps a whole negotiation under the 90 s target; after it every turn is rule-based

export interface RunDeps {
  ask: Ask;
  emit: (e: NegotiationEvent) => void;
  db: Db;
  /** Signs the contract credential when the Auditor passes a deal (P4's sign()). Optional. */
  sign?: (subject: Record<string, unknown>) => Promise<Credential | undefined>;
}

interface Move { action: 'offer' | 'counter' | 'accept'; terms: Terms; message: string }
type Side = 'buyer' | 'supplier';

const at = () => new Date().toISOString();

export async function runNegotiation(negId: string, rfq: Rfq, supplierIds: string[], deps: RunDeps): Promise<void> {
  const { db, emit } = deps;
  const started = Date.now();
  const ask: Ask = (o) => (Date.now() - started > DEADLINE_MS ? Promise.reject(new Error('negotiation deadline')) : deps.ask(o));
  let nextOffer = 0;

  const end = (outcome: 'deal' | 'no-deal', dealId?: string) => emit({ type: 'end', at: at(), outcome, ...(dealId ? { dealId } : {}) });

  /**
   * One side's turn. Asks the agent (twice at most), checks every offer against the hard limits, shows rejected ones with the reason,
   * and falls back to the rule-based move if the agent keeps breaking a limit or fails. Returns the offer to pass on, or an acceptance.
   */
  async function turn(side: Side, c: DealContext, round: number, standing: Offer | undefined, ownLast: Offer | undefined,
    kind: 'select' | 'init'): Promise<{ offer?: Offer; accepted?: Offer }> {
    let feedback: string | undefined;
    for (let attempt = 0; attempt <= ATTEMPTS; attempt++) {
      const useRule = attempt === ATTEMPTS;
      const move: Move = side === 'supplier'
        ? await (useRule ? Promise.resolve(supplierRuleMove(c, ownLast, standing)) : supplierMove(ask, c, ownLast, standing, feedback))
        : await (useRule ? Promise.resolve(buyerRuleMove(c, standing!, round)) : buyerMove(ask, c, standing!, round, feedback));

      if (move.action === 'accept') {
        const target = standing!;
        // The buyer may not accept above its budget ceiling
        const over = side === 'buyer' ? buyerLimit(c, termsOf(c, target)) : undefined;
        if (over) { feedback = `You cannot accept that: ${over}`; continue; }
        const accepted: Offer = { ...target, id: `${negId}-o${nextOffer++}`, status: 'accepted' };
        emit({ type: 'confirm', from: side, at: at(), offer: accepted, text: move.message });
        return { accepted };
      }

      const reason = violation(c, move.terms) ?? (side === 'buyer' ? buyerLimit(c, move.terms) : undefined);
      if (reason) {
        emit({ type: kind, from: side, at: at(), offer: toOffer(c, negId, nextOffer++, round, move.terms, 'rejected', reason), text: move.message });
        feedback = reason;
        continue;
      }
      const offer = toOffer(c, negId, nextOffer++, round, move.terms, kind === 'select' ? 'proposed' : 'countered');
      emit({ type: kind, from: side, at: at(), offer, text: move.message });
      return { offer };
    }
    return {};
  }

  /** Audit, then sign or hold back. The grade decides what the Auditor may do. */
  async function conclude(c: DealContext, accepted: Offer) {
    emit({ type: 'select', from: 'auditor', at: at(), text: `Checking the accepted offer against the Fair Work Scorecard: wage, hours, safety, child and forced labour.` });
    const score = scoreOffer(c, accepted);
    const verdict = await audit(ask, c, accepted, score);
    emit({ type: 'audit', at: at(), score, decision: verdict.decision });
    if (verdict.decision === 'block') {
      emit({ type: 'confirm', from: 'auditor', at: at(), text: `${verdict.text} The deal is blocked and nothing is signed.` });
      return end('no-deal');
    }
    const dealId = `deal-${negId.replace(/^neg-/, '')}`;
    let credential: Credential | undefined;
    if (verdict.decision === 'pass') {
      credential = await deps.sign?.({ dealId, rfqId: rfq.id, supplierId: c.seller.id, grade: score.grade, wagePerWorkerDay: accepted.labour.wagePerWorkerDay, price: accepted.price }).catch(() => undefined);
    }
    const pending = verdict.decision === 'flag';
    db.put('deals', { id: dealId, negotiationId: negId, rfqId: rfq.id, supplierId: c.seller.id, offer: accepted, score, decision: verdict.decision, status: pending ? 'pending-review' : 'confirmed', credentialId: credential?.id, at: at() });
    emit({ type: 'confirm', from: 'auditor', at: at(), text: pending ? `${verdict.text} Held for the Sangam team to review before a credential is signed.` : `${verdict.text}${credential ? ' Contract credential signed.' : ''}` });
    end('deal', dealId);
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

  // ---- round 1: every candidate quotes ------------------------------------------------------------------------------------------
  const quotes = (await Promise.all(contexts.map(async (c) => ({ c, r: await turn('supplier', c, 1, undefined, undefined, 'select') })))).filter((q) => q.r.offer);
  if (!quotes.length) {
    emit({ type: 'confirm', from: 'auditor', at: at(), text: 'No supplier produced a quote that meets the fair-wage and capacity limits.' });
    return end('no-deal');
  }
  const best = quotes.sort((a, b) => termsOf(a.c, a.r.offer!).pricePerUnit - termsOf(b.c, b.r.offer!).pricePerUnit || b.c.trust - a.c.trust)[0]!;
  const c = best.c;
  let standing = best.r.offer!;
  emit({ type: 'select', from: 'buyer', at: at(), text: quotes.length > 1 ? `Comparing ${quotes.length} quotes, we will negotiate with ${c.seller.name} (trust ${c.trust}/100).` : `We will negotiate with ${c.seller.name} (trust ${c.trust}/100).` });

  // ---- rounds 2 to 4: the buyer counters, the supplier answers ------------------------------------------------------------------
  for (let round = 2; round <= MAX_ROUNDS; round++) {
    const b = await turn('buyer', c, round, standing, undefined, 'init');
    if (b.accepted) return conclude(c, b.accepted);
    if (!b.offer) break;
    const s = await turn('supplier', c, round, b.offer, standing, 'init');
    if (s.accepted) return conclude(c, s.accepted);
    if (!s.offer) break;
    standing = s.offer;
  }

  // ---- out of rounds: the buyer takes the supplier's last offer if the budget allows, or walks away -----------------------------
  const stuck = buyerLimit(c, termsOf(c, standing));
  if (!stuck) {
    const accepted: Offer = { ...standing, id: `${negId}-o${nextOffer++}`, status: 'accepted' };
    emit({ type: 'confirm', from: 'buyer', at: at(), offer: accepted, text: `After ${MAX_ROUNDS} rounds we accept the last offer: it is within our budget.` });
    return conclude(c, accepted);
  }
  emit({ type: 'confirm', from: 'buyer', at: at(), text: `After ${MAX_ROUNDS} rounds the last offer does not fit: ${stuck} We end the negotiation.` });
  end('no-deal');
}
