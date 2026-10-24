// Supplier Agent: speaks for the MSME, cooperative or FPO. The model proposes; server/agents/tools.ts decides what is allowed.
import { z } from 'zod';
import type { Offer } from '../../src/contracts';
import type { Ask } from '../llm';
import { fastestPlan, minViablePrice, supplierTools, termsOf } from './tools';
import type { DealContext, Terms } from './tools';

const Turn = z.object({ action: z.enum(['offer', 'accept']), pricePerUnit: z.number(), workers: z.number(), productionDays: z.number(), message: z.string() });

export interface SupplierMove { action: 'offer' | 'accept'; terms: Terms; message: string; by: 'model' | 'rule' }

const SYSTEM = `You are the Supplier Agent for a small Indian producer (an MSME, cooperative, SHG federation or FPO) negotiating a sale to a buyer.
Your duties: get a fair price, and never pay your workers below the wage floor or commit more workers than you have free.
Call my_capacity first to read your real figures. Money is in rupees. Reply with ONE JSON object only:
{"action":"offer"|"accept","pricePerUnit":number,"workers":number,"productionDays":number,"message":"one or two plain sentences to the buyer"}
Use action "accept" only to take the buyer's last offer as it stands (repeat its numbers).`;

const brief = (c: DealContext) =>
  `Buyer wants ${c.rfq.quantity} units of "${c.rfq.part}" by ${c.rfq.needBy}. You are ${c.seller.name} in ${c.districtName}. ` +
  `Wage in the plan = pricePerUnit x ${c.rfq.quantity} x ${c.labourShare} / (workers x productionDays), and must be at least ${c.wageFloor}. ` +
  `Delivery takes productionDays + ${c.transitDays} days.`;

const shows = (o: Offer, c: DealContext) => `₹${Math.round(termsOf(c, o).pricePerUnit)} a unit, ${o.labour.workers} workers for ${termsOf(c, o).productionDays} days (wage ₹${o.labour.wagePerWorkerDay} a day)`;

/** Rule-based move used when the model times out or keeps answering badly: stays inside every limit. */
function ruleMove(c: DealContext, last?: Offer, buyer?: Offer): SupplierMove {
  const plan = last ? { workers: last.labour.workers, productionDays: termsOf(c, last).productionDays } : fastestPlan(c);
  const floor = minViablePrice(c, plan);
  if (buyer) {
    const bt = termsOf(c, buyer);
    if (bt.pricePerUnit >= Math.max(floor, termsOf(c, last!).pricePerUnit * 0.97)) return { action: 'accept', terms: bt, message: 'That works for us. We accept.', by: 'rule' };
    const mid = Math.max(Math.ceil(floor * 1.02), Math.round((termsOf(c, last!).pricePerUnit + bt.pricePerUnit) / 2));
    return { action: 'offer', terms: { ...plan, pricePerUnit: mid }, message: `We can come down to ₹${mid} a unit; below this we cannot pay our workers fairly.`, by: 'rule' };
  }
  const price = Math.max(Math.ceil(c.referenceUnitPrice * 1.1), Math.ceil(floor * 1.05));
  return { action: 'offer', terms: { ...plan, pricePerUnit: price }, message: `We can make this order: ₹${price} a unit, ${plan.workers} workers for ${plan.productionDays} days.`, by: 'rule' };
}

/** `last` is this supplier's own previous offer; `buyer` is the buyer's counter it must answer. Both absent for the opening quote. */
export async function supplierMove(ask: Ask, c: DealContext, last?: Offer, buyer?: Offer, feedback?: string): Promise<SupplierMove> {
  const user = [
    brief(c),
    last && buyer ? `Your last offer: ${shows(last, c)}. The buyer counters: ${shows(buyer, c)}.` : 'Make your opening quote.',
    feedback ? `Your previous answer was not allowed: ${feedback} Fix it.` : '',
  ].filter(Boolean).join('\n');
  try {
    const t = await ask({ role: 'turn', system: SYSTEM, user, tools: supplierTools(c), schema: Turn });
    return { action: buyer ? t.action : 'offer', terms: { pricePerUnit: t.pricePerUnit, workers: Math.round(t.workers), productionDays: Math.round(t.productionDays) }, message: t.message.slice(0, 300), by: 'model' };
  } catch {
    return ruleMove(c, last, buyer);
  }
}

export { ruleMove as supplierRuleMove };
