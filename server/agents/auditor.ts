// Auditor Agent: reads the Fair Work Scorecard of the accepted offer and decides pass, flag or block.
// The model writes the reasoning; the grade limits which decisions are open to it, so a deal with child labour can never pass.
import { z } from 'zod';
import type { FairWorkScore, Offer } from '../../src/contracts';
import type { Ask } from '../llm';
import type { DealContext } from './tools';

const Turn = z.object({ decision: z.enum(['pass', 'flag', 'block']), text: z.string() });
export type Decision = z.infer<typeof Turn>['decision'];

/** Decisions the grade allows: E blocks; D is flagged or blocked; C is flagged or passes; A and B pass or are flagged. */
const ALLOWED: Record<FairWorkScore['grade'], Decision[]> = { A: ['pass', 'flag'], B: ['pass', 'flag'], C: ['flag', 'pass'], D: ['flag', 'block'], E: ['block'] };
const DEFAULT: Record<FairWorkScore['grade'], Decision> = { A: 'pass', B: 'pass', C: 'flag', D: 'flag', E: 'block' };

const SYSTEM = `You are the Auditor Agent for Sangam, a platform for fair-wage supply from Indian producers. You review a Fair Work Scorecard before a contract is signed.
Grades: A wage at or above the living wage with a complete safety record; B wage at least 90% of the living wage; C below that; D below the legal minimum or over the legal hours; E child or forced labour.
A missing safety record or an open grievance lowers the grade a step. Reply with ONE JSON object only:
{"decision":"pass"|"flag"|"block","text":"two plain sentences: the grade, and the main reason for it"}`;

export async function audit(ask: Ask, c: DealContext, offer: Offer, score: FairWorkScore): Promise<{ decision: Decision; text: string }> {
  const user = `Supplier ${c.seller.name}, ${c.districtName}. Offer: wage ₹${offer.labour.wagePerWorkerDay} per worker-day (living-wage floor ₹${c.wageFloor}), ${offer.labour.hoursPerDay} hours a day, ${offer.labour.workers} workers.\nScorecard: ${JSON.stringify(score)}`;
  const fallback = (why: string) => ({ decision: DEFAULT[score.grade], text: `Grade ${score.grade}: wage is ${Math.round(score.wageVsLivingWage * 100)}% of the living-wage floor${score.safety < 1 ? '; the safety record is not complete, which lowers the grade a step' : ''}. ${why}` });
  try {
    const t = await ask({ role: 'audit', system: SYSTEM, user, schema: Turn, timeoutMs: 30_000 });
    return ALLOWED[score.grade].includes(t.decision) ? { decision: t.decision, text: t.text.slice(0, 400) } : { decision: DEFAULT[score.grade], text: `${t.text.slice(0, 300)} (Decision set to ${DEFAULT[score.grade]} by the grade rules.)` };
  } catch {
    return fallback('Reviewed by the rule-based check.');
  }
}
