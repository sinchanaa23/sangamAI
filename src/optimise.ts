// Constrained optimisation of the sourcing plan (mixed-integer program, javascript-lp-solver).
// One choice per part: an Indian option (single supplier or consortium) or keep importing.
import solver from 'javascript-lp-solver';
import { bom, buyer } from './data';
import { importLineCost, isImported, isRural, optionsFor, summarise } from './engine';
import type { Chain } from './engine';
import type { Scenario } from './scenario';
import type { Option } from './types';

export interface OptConstraints {
  /** money available for supplier development, rupee crore */
  budgetCr: number;
  maxLeadDays: number;
  maxReadyMonths: number;
  dualSource: boolean;
  maxImportPct: number;
  minRuralPct: number;
  /** how much to penalise climate and import risk, 0-3 */
  riskWeight: number;
}

export const DEFAULT_CONSTRAINTS: OptConstraints = { budgetCr: 1, maxLeadDays: 30, maxReadyMonths: 12, dualSource: false, maxImportPct: 100, minRuralPct: 0, riskWeight: 1 };

export interface OptResult {
  feasible: boolean;
  chain: Chain | null;
  annualCostCr: number;
  capexCr: number;
  binding: string[];
  considered: number;
}

const IMPORT_RISK = 0.65;

export function optimise(s: Scenario, c: OptConstraints): OptResult {
  const yearUnits = buyer.monthlyUnits * 12;
  const variables: Record<string, Record<string, number>> = {};
  const binaries: Record<string, 1> = {};
  const lookup: Record<string, { lineId: string; option: Option | null }> = {};
  const constraints: Record<string, { equal?: number; max?: number; min?: number }> = {
    capex: { max: c.budgetCr },
    imported: { max: c.maxImportPct },
    rural: { min: c.minRuralPct },
  };
  let considered = 0;

  bom.forEach((line) => {
    constraints[`line_${line.id}`] = { equal: 1 };
    const lineValue = line.cost * yearUnits / 1e7;
    const alts: (Option | null)[] = [null, ...optionsFor(line).filter((o) =>
      o.leadDays <= c.maxLeadDays && o.readyInMonths <= c.maxReadyMonths &&
      (!c.dualSource || new Set(o.sellers.map((x) => x.districtId)).size >= 2))];
    alts.forEach((o, i) => {
      const key = `${line.id}__${i}`;
      considered++;
      const annual = ((o ? o.unitCost : importLineCost(line, s)) * yearUnits) / 1e7;
      const capex = o ? o.investmentLakh / 100 : 0;
      const risk = o ? o.climateRisk : isImported(line) ? IMPORT_RISK : 0.3;
      const cap = o ? o.sellers.reduce((t, x) => t + x.monthlyCapacity, 0) : 1;
      const rural = o ? line.sharePct * o.sellers.filter(isRural).reduce((t, x) => t + (o.sellers.length === 1 ? 1 : x.monthlyCapacity / cap), 0) : 0;
      variables[key] = {
        cost: annual + capex / 5 + c.riskWeight * risk * lineValue * 0.05,
        [`line_${line.id}`]: 1,
        capex,
        imported: !o && isImported(line) ? line.sharePct : 0,
        rural,
      };
      binaries[key] = 1;
      lookup[key] = { lineId: line.id, option: o };
    });
  });

  const res = solver.Solve({ optimize: 'cost', opType: 'min', constraints, variables, binaries });
  if (!res.feasible) return { feasible: false, chain: null, annualCostCr: 0, capexCr: 0, binding: [], considered };

  const picks: Chain['picks'] = {};
  Object.entries(res).forEach(([k, v]) => {
    if (lookup[k] && (v as number) > 0.5) picks[lookup[k].lineId] = lookup[k].option;
  });
  bom.forEach((l) => { if (!(l.id in picks)) picks[l.id] = null; });
  const chain = summarise('optimised', 'Optimised', 'Best plan within your limits', picks, s);
  const capexCr = chain.investmentLakh / 100;
  const binding: string[] = [];
  if (capexCr >= c.budgetCr * 0.95 && c.budgetCr > 0) binding.push('budget');
  if (chain.importShare >= c.maxImportPct - 0.5 && c.maxImportPct < 100) binding.push('import cap');
  if (chain.ruralShare <= c.minRuralPct + 0.5 && c.minRuralPct > 0) binding.push('rural minimum');
  return { feasible: true, chain, annualCostCr: (chain.unitCost * yearUnits) / 1e7, capexCr, binding, considered };
}
