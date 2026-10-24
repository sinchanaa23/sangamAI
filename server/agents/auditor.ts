// Auditor Agent: reads the Fair Work Scorecard of the accepted offer and decides pass, flag or block.
// The model writes the reasoning; the grade limits which decisions are open to it, so a deal with child labour can never pass.
import { z } from 'zod';
import type { FairWorkScore, Offer } from '../../src/contracts';
import { logFallback } from '../llm';
import type { Ask } from '../llm';
import type { DealContext } from './tools';

const Turn = z.object({ decision: z.enum(['pass', 'flag', 'block']), text: z.string() });
export type Decision = z.infer<typeof Turn>['decision'];

/** Decisions the grade allows: E blocks; D is flagged or blocked; C is flagged or passes; A and B pass or are flagged; an open certificate gap rules out pass. */
const ALLOWED: Record<FairWorkScore['grade'], Decision[]> = { A: ['pass', 'flag'], B: ['pass', 'flag'], C: ['flag', 'pass'], D: ['flag', 'block'], E: ['block'] };
const DEFAULT: Record<FairWorkScore['grade'], Decision> = { A: 'pass', B: 'pass', C: 'flag', D: 'flag', E: 'block' };

const SYSTEM = `You are the Auditor Agent for Sangam, a platform for fair-wage supply from Indian producers. You review a Fair Work Scorecard before a contract is signed.
Grades: A wage at or above the living wage with a complete safety record; B wage at least 90% of the living wage; C below that; D below the legal minimum or over the legal hours; E child or forced labour.
A missing safety record or an open grievance lowers the grade a step. Certificates the part needs must be held, in date and verified; if any gap is listed you may not pass. Reply with ONE JSON object only:
{"decision":"pass"|"flag"|"block","text":"two plain sentences: the grade, and the main reason for it"}
Your text must agree with your decision. "pass" means the contract can be signed; "flag" means it is held for a person on the Sangam team to review (it is not rejected); "block" means it is refused.`;

/** Models sometimes write "blocked" for a flag. A flagged deal is held for review, not refused, so the words must say so. */
const consistent = (d: Decision, text: string) => (d === 'block' ? text : text.replace(/\b(is |was |are |has been )?(blocked|rejected|refused)\b/gi, (_m, aux) => `${aux ?? ''}held for review`));

export async function audit(ask: Ask, c: DealContext, offer: Offer, score: FairWorkScore, certGaps: string[] = []): Promise<{ decision: Decision; text: string }> {
  // An open certificate gap takes "pass" off the table
  const allowed = certGaps.length ? ALLOWED[score.grade].filter((d) => d !== 'pass') : ALLOWED[score.grade];
  const dflt: Decision = allowed.includes(DEFAULT[score.grade]) ? DEFAULT[score.grade] : allowed[0]!;
  const gapText = certGaps.length ? ` Certificate gaps: ${certGaps.join('; ')}.` : '';
  const user = `Supplier ${c.seller.name}, ${c.districtName}. Offer: wage ₹${offer.labour.wagePerWorkerDay} per worker-day (living-wage floor ₹${c.wageFloor}), ${offer.labour.hoursPerDay} hours a day, ${offer.labour.workers} workers.\nScorecard: ${JSON.stringify(score)}${c.marketWage ? `\nFor comparison, factory workers in this state and industry were paid about ₹${c.marketWage.perDay} per worker-day on average (${c.marketWage.source}).` : ''}\nRequired certificates: ${c.line.requiredCerts.join(', ') || 'none'}.${gapText || ' All required certificates are held and verified.'}`;
  const fallback = (why: string) => ({ decision: dflt, text: `Grade ${score.grade}: wage is ${Math.round(score.wageVsLivingWage * 100)}% of the living-wage floor${score.safety < 1 ? '; the safety record is not complete, which lowers the grade a step' : ''}.${gapText} ${why}` });
  try {
    // The Auditor model may be a stronger, busier one: if it fails, the everyday model reviews before the rule-based check does
    const t = await ask({ role: 'audit', system: SYSTEM, user, schema: Turn, timeoutMs: 30_000 })
      .catch((e) => { logFallback('auditor (strong model)', e); return ask({ role: 'turn', system: SYSTEM, user, schema: Turn, timeoutMs: 30_000 }); });
    return allowed.includes(t.decision) ? { decision: t.decision, text: consistent(t.decision, t.text).slice(0, 400) } : { decision: dflt, text: `${t.text.slice(0, 300)} (Decision set to ${dflt} by the grade and certificate rules.)` };
  } catch (e) {
    logFallback('auditor', e);
    return fallback('Reviewed by the rule-based check.');
  }
}
