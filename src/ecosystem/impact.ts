// SDG 8 impact totals from confirmed deals. Pure, so server/impact.ts and the page share it.
import type { Provenance } from '../types';

/** One supplier's share of a confirmed deal. */
export interface DealRecord {
  id: string;
  reqId: string;
  sellerId: string;
  districtId: string;
  rural: boolean;
  /** contract value per year, rupees */
  valueInr: number;
  /** the part used to be imported: this value now stays in India */
  importReplacedInr: number;
  /** workers the deal employs */
  workers: number;
  workersSource: Provenance;
  /** from the supplier's workforce profile (P3) or the agents' labour plan (P1), when known */
  womenShare?: number;
  wagePerDay?: number;
  livingWagePerDay?: number;
  source: Provenance;
}

export interface ImpactTotals {
  deals: number;
  valueInr: number;
  importReplacedInr: number;
  jobs: number;
  jobsSource: Provenance;
  ruralShare: number;
  /** null until some deals carry workforce data; `covered` says how many do */
  womenShare: { value: number | null; covered: number };
  wageVsLiving: { value: number | null; covered: number };
  source: Provenance;
}

export interface DistrictImpact { districtId: string; deals: number; valueInr: number; jobs: number; rural: boolean; importReplacedInr: number }

/** The weakest provenance among the inputs: a total is only as real as its least real part. */
const ORDER: Provenance[] = ['simulated', 'estimated', 'declared', 'public', 'live', 'verified'];
export const weakest = (xs: Provenance[]): Provenance => (xs.length ? xs.reduce((a, b) => (ORDER.indexOf(b) < ORDER.indexOf(a) ? b : a)) : 'estimated');

export function computeImpact(deals: DealRecord[]): { totals: ImpactTotals; byDistrict: DistrictImpact[] } {
  const sum = (f: (d: DealRecord) => number, xs = deals) => xs.reduce((t, d) => t + f(d), 0);
  const value = sum((d) => d.valueInr);
  const withWomen = deals.filter((d) => d.womenShare !== undefined);
  const withWage = deals.filter((d) => d.wagePerDay !== undefined && d.livingWagePerDay);
  const wWorkers = sum((d) => d.workers, withWomen);
  const wageWorkers = sum((d) => d.workers, withWage);

  const totals: ImpactTotals = {
    deals: new Set(deals.map((d) => d.reqId)).size,
    valueInr: value,
    importReplacedInr: sum((d) => d.importReplacedInr),
    jobs: Math.round(sum((d) => d.workers)),
    jobsSource: weakest(deals.map((d) => d.workersSource)),
    ruralShare: value ? sum((d) => (d.rural ? d.valueInr : 0)) / value : 0,
    womenShare: { value: wWorkers ? sum((d) => d.workers * d.womenShare!, withWomen) / wWorkers : null, covered: withWomen.length },
    wageVsLiving: { value: wageWorkers ? sum((d) => d.workers * (d.wagePerDay! / d.livingWagePerDay!), withWage) / wageWorkers : null, covered: withWage.length },
    source: weakest(deals.map((d) => d.source)),
  };

  const by = new Map<string, DistrictImpact>();
  deals.forEach((d) => {
    const x = by.get(d.districtId) ?? { districtId: d.districtId, deals: 0, valueInr: 0, jobs: 0, rural: d.rural, importReplacedInr: 0 };
    x.deals += 1; x.valueInr += d.valueInr; x.jobs += d.workers; x.importReplacedInr += d.importReplacedInr; x.rural = x.rural || d.rural;
    by.set(d.districtId, x);
  });
  return { totals, byDistrict: [...by.values()].map((x) => ({ ...x, jobs: Math.round(x.jobs) })).sort((a, b) => b.valueInr - a.valueInr) };
}
