// Future diversification for suppliers: adjacent products they could move into, with costs and returns.
// Opportunities come from the active sector template; market sizes, capex and margins are simulated.
import { bom, opportunities, processInfo } from './data';
import { baseLineCost, district } from './engine';
import type { OpportunitySeed } from './sectors';
import type { Seller } from './types';

export type Opportunity = OpportunitySeed;
const REF_CAPACITY = (process: string) => processInfo(process).refCapacity;
const OPPORTUNITIES = opportunities;
export interface OppResult {
  opp: Opportunity;
  fit: number;
  scale: number;
  investment: { equipment: number; certification: number; training: number; workingCapital: number; total: number };
  revenueLakh: number;
  profitLakh: number;
  paybackYears: number | null;
  roi5: number;
  roi10: number;
  /** cumulative cash, rupee lakh, years 0-10 */
  cash: { year: number; asIs: number; expand: number }[];
  certsHeld: string[];
  certsMissing: string[];
}

/** Today's business, for the "stay as is" comparison: revenue and profit per year in rupee lakh. */
export function currentBusiness(s: Seller) {
  const line = bom.find((l) => l.process === s.process);
  const unitValue = line ? baseLineCost(line) : 1000;
  const revenue = (s.monthlyCapacity * 12 * unitValue * s.priceIndex * 0.7) / 1e5;
  return { revenue, profit: revenue * 0.08 };
}

export function evaluateOpportunity(s: Seller, opp: Opportunity): OppResult {
  const scale = Math.min(2, Math.max(0.4, s.monthlyCapacity / REF_CAPACITY(opp.process)));
  const certsHeld = opp.certs.filter((c) => s.certs.includes(c));
  const certsMissing = opp.certs.filter((c) => !s.certs.includes(c));
  const certShare = opp.certs.length ? certsHeld.length / opp.certs.length : 1;
  const fit = Math.round((0.55 * opp.overlap + 0.25 * certShare + 0.2 * district(s.districtId).power) * 100);

  const revenueLakh = opp.revenueLakh * scale;
  const profitLakh = (revenueLakh * opp.marginPct) / 100;
  const equipment = opp.equipmentLakh * Math.pow(scale, 0.7);
  const certification = certsMissing.length ? opp.certLakh : 0;
  const training = opp.trainingLakh * Math.pow(scale, 0.5);
  const workingCapital = revenueLakh * 0.15;
  const total = equipment + certification + training + workingCapital;

  const base = currentBusiness(s);
  const cash: OppResult['cash'] = [{ year: 0, asIs: 0, expand: -total }];
  let asIs = 0, expand = -total, paybackYears: number | null = null;
  let profit5 = 0, profit10 = 0;
  for (let y = 1; y <= 10; y++) {
    const operating = Math.min(1, Math.max(0, (12 * y - opp.readyMonths) / 12));
    const yearsRunning = Math.max(0, y - opp.readyMonths / 12);
    const ramp = Math.min(1, 0.5 + 0.25 * Math.floor(yearsRunning));
    const growth = Math.min(2, Math.pow(1 + opp.growthPct / 200, y - 1));
    const p = profitLakh * operating * ramp * growth;
    const b = base.profit * Math.pow(1.05, y - 1);
    asIs += b;
    const before = expand - asIs + b; // opportunity cash before this year
    expand += b + p;
    if (y <= 5) profit5 += p;
    profit10 += p;
    if (paybackYears === null && expand - asIs >= 0) paybackYears = y - 1 + Math.min(1, -before / Math.max(p, 1e-9));
    cash.push({ year: y, asIs: Math.round(asIs), expand: Math.round(expand) });
  }
  return {
    opp, fit, scale,
    investment: { equipment, certification, training, workingCapital, total },
    revenueLakh, profitLakh, paybackYears,
    roi5: (profit5 - total) / total, roi10: (profit10 - total) / total,
    cash, certsHeld, certsMissing,
  };
}

export const opportunitiesFor = (s: Seller) =>
  OPPORTUNITIES.filter((o) => o.process === s.process).map((o) => evaluateOpportunity(s, o)).sort((a, b) => b.fit * (1 + b.roi10) - a.fit * (1 + a.roi10));
