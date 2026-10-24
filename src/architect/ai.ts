// Calls to the architect's AI route (server/architect.ts). The plan works without these; they only add labelled suggestions.
import { bom } from '../data';
import type { Plan } from './engine';

export interface IdeaSuggestion { matchLineId: string | null; why: string; stages: { stage: string; name: string; note: string }[]; questions: string[] }
export interface PlanReview { summary: string; risks: string[]; nextSteps: string[] }

async function post<T>(body: unknown): Promise<T> {
  const r = await fetch('/api/architect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: r.status === 404 ? 'The Sangam server is not running (npm run dev starts it).' : `Server returned ${r.status}` }));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}

export const suggestFromIdea = (idea: string, sector: string) =>
  post<IdeaSuggestion>({ task: 'idea', idea, sector, catalogue: bom.map((l) => ({ id: l.id, name: l.name, process: l.process, spec: l.spec.slice(0, 300) })) });

/** The plan as plain facts, each with its source tag, so the model reviews what Sangam computed and nothing else. */
export function planFacts(p: Plan): string {
  const e = p.economics, w = p.workforce;
  const lines = [
    `Business: make "${p.line.name}" (${p.line.process}) in ${p.region.district.name}, ${p.region.district.state}; capacity ${p.input.capacityPerMonth} sets a month; budget ₹${p.input.budgetLakh} lakh; buyers in ${p.input.buyerCountry}.`,
    `Region score ${p.region.score}/100: ${p.region.factors.map((f) => `${f.label} ${Math.round(f.score * 100)}% [${f.tag}]`).join('; ')}.`,
    `Inputs: ${p.line.tiers.map((t) => `${t.name} (Indian supply ${t.indianSupply}) [estimated]`).join('; ')}.`,
    `Set-up: ${p.setup.map((s) => `${s.label} ₹${s.lakh.value} lakh [${s.lakh.tag}]`).join('; ')}; total ₹${p.setupTotalLakh} lakh.`,
    `Per unit: price ₹${e.price.value} [${e.price.tag}], materials ₹${e.materials.value} [${e.materials.tag}], labour ₹${e.labour.value} [estimated], freight ₹${e.freight.value} [estimated], contribution ₹${e.contribution.value}. Payback ${e.paybackMonths ?? 'not reached'} months.`,
    `Workforce: ${w.workers.value} workers at ₹${w.wage.value} a day; living wage ${w.living ? `₹${w.living.perDay} [${w.living.tag}]` : 'unknown'}; state minimum ${w.minimum ? `₹${w.minimum.perDay}` : 'not in data'}; projected Fair Work grade ${w.score.grade}; women ${w.womenShare}% [assumption].`,
    `Scenarios: ${p.scenarios.map((s) => `${s.name}: cost ${s.costPerUnit ? `₹${s.costPerUnit.value} [${s.costPerUnit.tag}]` : 'not estimated'}, India inputs ${s.indiaInputs.value}%, ${s.supplyRisk}`).join(' | ')}.`,
    `Risks found: ${p.risks.map((r) => r.text).join('; ') || 'none'}.`,
  ];
  return lines.join('\n');
}

export const reviewPlan = (p: Plan) => post<PlanReview>({ task: 'review', facts: planFacts(p) });
