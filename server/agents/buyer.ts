// Buyer Agent: speaks for the company buying, within the budget ceiling and deadline of its requirement.
import { z } from 'zod';
import type { Offer } from '../../src/contracts';
import { logFallback } from '../llm';
import type { Ask } from '../llm';
import { buyerFacts, buyerLimit, minViablePrice, termsOf, workersNeededDays } from './tools';
import type { DealContext, Terms } from './tools';

const Turn = z.object({ action: z.enum(['counter', 'accept']), pricePerUnit: z.number(), productionDays: z.number(), message: z.string() });

export interface BuyerMove { action: 'counter' | 'accept'; terms: Terms; message: string; by: 'model' | 'rule' }

const SYSTEM = `You are the Buyer Agent for a company sourcing from a small Indian producer. Get a good price and delivery date without breaking your limits.
Your limits: never go above the budget; deliver by the need-by date. You do not set wages, but offers that would underpay the workers are blocked by the platform, so do not push the price into that range.
The supplier's record is given below. Money is in rupees. Reply with ONE JSON object only:
{"action":"counter"|"accept","pricePerUnit":number,"productionDays":number,"message":"one or two plain sentences to the supplier"}
Use action "accept" only to take the supplier's last offer as it stands (repeat its numbers).`;

const budgetPerUnit = (c: DealContext) => c.budgetInr / c.rfq.quantity;
const money = (n: number) => `₹${Math.round(n)}`;

/** How much of its ceiling the buyer will pay by round: it concedes as rounds run out, and only the last round pays the full ceiling. */
const concession = (round: number) => [0.9, 0.95, 1][Math.min(Math.max(round - 2, 0), 2)]!;

/** Rule-based move for timeouts and bad replies: counters at the round's share of the ceiling, never below the wage floor price. */
function ruleMove(c: DealContext, standing: Offer, round: number): BuyerMove {
  const st = termsOf(c, standing);
  const target = budgetPerUnit(c) * concession(round);
  if (st.pricePerUnit <= target && !buyerLimit(c, st)) return { action: 'accept', terms: st, message: 'This is within our budget. We accept.', by: 'rule' };
  const price = Math.min(Math.round(st.pricePerUnit) - 1, Math.max(Math.ceil(minViablePrice(c, st) * 1.01), Math.floor(target)));
  return { action: 'counter', terms: { ...st, pricePerUnit: price }, message: `Our budget is tighter: we can offer ${money(price)} a unit for the same team and schedule.`, by: 'rule' };
}

export async function buyerMove(ask: Ask, c: DealContext, standing: Offer, round: number, feedback?: string): Promise<BuyerMove> {
  const st = termsOf(c, standing);
  const user = [
    `Supplier record: ${JSON.stringify(buyerFacts(c))}`,
    `You want ${c.rfq.quantity} units of "${c.rfq.part}" by ${c.rfq.needBy}. Budget ceiling ${money(c.budgetInr)} in total (${money(budgetPerUnit(c))} a unit). Round ${round} of 4.`,
    `The supplier (${c.seller.name}) offers ${money(st.pricePerUnit)} a unit with ${standing.labour.workers} workers for ${st.productionDays} days; delivery in ${standing.leadTimeDays} days.`,
    `If you counter, keep their team size. With ${standing.labour.workers} workers they need at least ${workersNeededDays(c, standing.labour.workers)} production days for ${c.rfq.quantity} units, so do not ask for fewer days. You may change the price, or ask for more days.`,
    feedback ? `Your previous answer was not allowed: ${feedback} Fix it.` : '',
  ].filter(Boolean).join('\n');
  try {
    const t = await ask({ role: 'turn', system: SYSTEM, user, schema: Turn });
    const terms = { pricePerUnit: t.pricePerUnit, workers: standing.labour.workers, productionDays: Math.round(t.productionDays) };
    return t.action === 'accept' ? { action: 'accept', terms: st, message: t.message.slice(0, 300), by: 'model' } : { action: 'counter', terms, message: t.message.slice(0, 300), by: 'model' };
  } catch (e) {
    logFallback('buyer', e);
    return ruleMove(c, standing, round);
  }
}

export { ruleMove as buyerRuleMove };
