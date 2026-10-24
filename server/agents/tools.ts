// The engine behind the agents. Every number an agent sees or a limit the orchestrator enforces comes from here,
// and from the existing Sangam engine (src/data, engine, chainRoute, trust), never from the model.
import type { BomLine, Seller } from '../../src/types';
import { bom, loadDataset, sellers } from '../../src/data';
import { district, isRural } from '../../src/engine';
import { partRoute } from '../../src/chainRoute';
import { EMPTY } from '../../src/model';
import { trustScore } from '../../src/trust';
import type { FairWorkScore, Offer, Rfq, WorkforceProfile } from '../../src/contracts';
import type { Db, Doc } from '../db';
import type { Tool } from '../llm';

// TEMPORARY until P3's src/fairwork.ts and src/real/wages.json land; then wageFloorPerDay() and scoreOffer() delegate to them.
// ₹14,926 a month (GLWC, rural Nilgiris, the nearest rural benchmark) over 26 working days. Tagged estimated for any other district.
const LIVING_WAGE_PER_DAY = Math.round(14926 / 26);
const BENCHMARK_SOURCE = 'GLWC rural Nilgiris, Tamil Nadu (nearest rural benchmark; estimated). State minimum wage not loaded yet.';
/** Share of the price that is wages, by process. A modelling assumption (estimated), not a measured figure. */
const LABOUR_SHARE = { assembly: 0.6, other: 0.3 };
/** Rupees per unit of currency: a fixed table, same values as the buyer's global mode (estimated, 2026-10-24). */
export const FX_INR: Record<'INR' | 'USD' | 'EUR', number> = { INR: 1, USD: 94.5, EUR: 108 };
const LEGAL_HOURS_PER_DAY = 9; // Factories Act 1948

export const wageFloorPerDay = (_districtId: string) => LIVING_WAGE_PER_DAY;

export interface DealContext {
  rfq: Rfq;
  line: BomLine;
  seller: Seller;
  districtName: string;
  rural: boolean;
  /** units the supplier can still make in a month */
  freeUnitsPerMonth: number;
  unitsPerWorkerDay: number;
  availableWorkers: number;
  /** days from the end of production to the buyer's gate: transport and inspection, from the route model */
  transitDays: number;
  /** today's pre-duty import price of the part in rupees, scaled by the supplier's price index */
  referenceUnitPrice: number;
  wageFloor: number;
  labourShare: number;
  budgetInr: number;
  trust: number;
  workforce?: WorkforceProfile;
}

export function ensureDataset() {
  if (!bom.length) loadDataset('ev');
}

/** The BOM line an RFQ's free-text part refers to: most words in common, assembly if nothing matches. */
export function pickLine(part: string): BomLine {
  ensureDataset();
  const words = new Set(part.toLowerCase().match(/[a-z]{3,}/g) ?? []);
  const score = (l: BomLine) => (`${l.name} ${l.process}`.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => words.has(w)).length;
  const best = [...bom].sort((a, b) => score(b) - score(a))[0]!;
  return score(best) > 0 ? best : (bom.find((l) => l.id === 'assembly') ?? bom[0]!);
}

export function buildContext(rfq: Rfq, seller: Seller, line: BomLine, db: Db): DealContext {
  const route = partRoute(line, seller, 1, 'balanced');
  const workforce = db.get<WorkforceProfile & Doc>('workforce', seller.id);
  const availableWorkers = Math.max(1, Math.floor(seller.workers * (1 - seller.details.utilisationPct / 100)));
  return {
    rfq, line, seller,
    districtName: district(seller.districtId).name,
    rural: isRural(seller),
    freeUnitsPerMonth: Math.round(seller.monthlyCapacity * (1 - seller.details.utilisationPct / 100)),
    unitsPerWorkerDay: seller.monthlyCapacity / (seller.workers * 26),
    availableWorkers,
    transitDays: Math.max(1, route.days - 12), // partRoute's production leg is a fixed 12 days
    referenceUnitPrice: Math.round(line.cost * seller.priceIndex),
    wageFloor: wageFloorPerDay(seller.districtId),
    labourShare: line.id === 'assembly' ? LABOUR_SHARE.assembly : LABOUR_SHARE.other,
    budgetInr: rfq.budget.amount * FX_INR[rfq.budget.currency],
    trust: trustScore(seller, EMPTY).score,
    workforce,
  };
}

/** Suppliers that make the part, best first: verified before declared, then by price. */
export function findCandidates(rfq: Rfq, line: BomLine, supplierIds: string[], max = 3): Seller[] {
  const pool = supplierIds.length
    ? sellers.filter((s) => supplierIds.includes(s.id))
    : sellers.filter((s) => s.process === line.process && (!rfq.verifiedOnly || s.verification === 'verified'));
  return [...pool].sort((a, b) => Number(b.verification === 'verified') - Number(a.verification === 'verified') || a.priceIndex - b.priceIndex).slice(0, max);
}

/**
 * Certificates the part needs that the supplier cannot prove: not held, expired, or not yet verified by the Sangam team.
 * Certificate checking is compulsory: while any gap is open the Auditor cannot pass the deal, only flag it for the Verification desk.
 */
export function certificateGaps(c: DealContext): string[] {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return c.line.requiredCerts.flatMap((req) => {
    if (!c.seller.certs.some((h) => same(h, req))) return [`${req}: not held`];
    const detail = c.seller.details.certDetails.find((d) => same(d.name, req));
    if (detail && Date.parse(detail.expires) < Date.now()) return [`${req}: expired on ${detail.expires}`];
    if (c.seller.verification !== 'verified') return [`${req}: held but not yet verified by the Sangam team`];
    return [];
  });
}

/** What a supplier proposes. The orchestrator turns it into an Offer and checks it against the hard limits. */
export interface Terms { pricePerUnit: number; workers: number; productionDays: number }

export const workerDays = (t: Terms) => t.workers * t.productionDays;
export const impliedWage = (c: DealContext, t: Terms) => Math.round((t.pricePerUnit * c.rfq.quantity * c.labourShare) / Math.max(1, workerDays(t)));
/** The lowest price per unit at which the labour plan still pays the wage floor. */
export const minViablePrice = (c: DealContext, t: Pick<Terms, 'workers' | 'productionDays'>) =>
  Math.ceil((c.wageFloor * t.workers * t.productionDays) / (c.rfq.quantity * c.labourShare));

/** Production time with all available workers: the fastest the supplier can deliver. */
export function fastestPlan(c: DealContext): Pick<Terms, 'workers' | 'productionDays'> {
  const workers = c.availableWorkers;
  return { workers, productionDays: Math.max(1, Math.ceil(c.rfq.quantity / (workers * c.unitsPerWorkerDay))) };
}

/** Hard limits. Returns why an offer is not allowed, or undefined when it is. Code decides this, never a model. */
export function violation(c: DealContext, t: Terms): string | undefined {
  if (![t.pricePerUnit, t.workers, t.productionDays].every((n) => Number.isFinite(n) && n > 0)) return 'The offer has a missing or non-positive number.';
  const wage = impliedWage(c, t);
  if (wage < c.wageFloor) return `At this price the labour plan pays ₹${wage} a worker-day, below the ₹${c.wageFloor} living-wage floor for ${c.districtName}. Blocked before the other side saw it.`;
  if (t.workers > c.availableWorkers) return `${c.seller.name} has only ${c.availableWorkers} workers free (${c.freeUnitsPerMonth} units a month); the plan uses ${t.workers}.`;
  const makeable = t.workers * t.productionDays * c.unitsPerWorkerDay;
  if (makeable < c.rfq.quantity) return `The plan can make about ${Math.floor(makeable)} units, not the ${c.rfq.quantity} ordered.`;
  return undefined;
}

/** Days left before the buyer's need-by date; undefined when the date is missing or already past (then the date is not enforced). */
const daysLeft = (needBy: string) => {
  const d = Math.floor((Date.parse(needBy) - Date.now()) / 86_400_000);
  return Number.isFinite(d) && d > 0 ? d : undefined;
};

/** The buyer's own limits: budget ceiling and need-by date. Returns why a set of terms breaks them, if it does. */
export function buyerLimit(c: DealContext, t: Terms): string | undefined {
  if (t.pricePerUnit * c.rfq.quantity > c.budgetInr) return `Above the budget ceiling of ₹${Math.round(c.budgetInr).toLocaleString('en-IN')}.`;
  const left = daysLeft(c.rfq.needBy);
  const days = t.productionDays + c.transitDays;
  if (left !== undefined && days > left) return `Delivery takes ${days} days but only ${left} remain until ${c.rfq.needBy}.`;
  return undefined;
}

export function toOffer(c: DealContext, negId: string, n: number, round: number, t: Terms, status: Offer['status'], reason?: string): Offer {
  const total = t.pricePerUnit * c.rfq.quantity;
  const ccy = c.rfq.budget.currency;
  const wf = c.workforce;
  const headcount = wf ? wf.skills.reduce((s, k) => s + k.headcount, 0) : 0;
  return {
    id: `${negId}-o${n}`, rfqId: c.rfq.id, supplierId: c.seller.id, round,
    price: { amount: Math.round((total / FX_INR[ccy]) * 100) / 100, currency: ccy },
    leadTimeDays: t.productionDays + c.transitDays,
    labour: {
      workers: t.workers, workerDays: workerDays(t), wagePerWorkerDay: impliedWage(c, t), hoursPerDay: wf?.hoursPerDay ?? 8,
      womenShare: wf && headcount ? Math.min(1, wf.womenEmployed / headcount) : 0, // 0 until the supplier saves a workforce profile
      district: c.districtName,
    },
    status, ...(reason ? { reason } : {}),
  };
}

export const termsOf = (c: DealContext, o: Offer): Terms => ({
  pricePerUnit: (o.price.amount * FX_INR[o.price.currency]) / c.rfq.quantity,
  workers: o.labour.workers,
  productionDays: Math.max(1, o.leadTimeDays - c.transitDays),
});

/** Grade a confirmed offer. TEMPORARY stand-in for P3's scoreFairWork(), following the draft grading table. */
export function scoreOffer(c: DealContext, o: Offer): FairWorkScore {
  const ratio = o.labour.wagePerWorkerDay / c.wageFloor;
  const wf = c.workforce;
  const grades = ['A', 'B', 'C', 'D', 'E'] as const;
  let g = ratio >= 1 ? 0 : ratio >= 0.9 ? 1 : 2;
  if (wf?.childOrForcedLabourFlag) g = 4;
  else if (o.labour.hoursPerDay > LEGAL_HOURS_PER_DAY) g = 3;
  else {
    if (wf?.safetyRecord !== 'complete') g += 1; // a missing or self-declared safety record lowers the grade a step
    if ((wf?.openGrievances ?? 0) > 0) g += 1;
  }
  return {
    supplierId: c.seller.id, grade: grades[Math.min(g, 4)]!,
    wageVsMinimum: 0, // state minimum wage not loaded yet
    wageVsLivingWage: Math.round(ratio * 100) / 100,
    overtimeHours: wf?.overtimeHoursPerWeek ?? 0,
    safety: wf?.safetyRecord === 'complete' ? 1 : wf?.safetyRecord === 'partial' ? 0.5 : 0,
    womenShare: o.labour.womenShare,
    childLabourFlag: wf?.childOrForcedLabourFlag ?? false,
    benchmarkSource: BENCHMARK_SOURCE,
  };
}

/** The tools an agent may call. Read-only: they report engine figures, they never change a deal. */
export function supplierTools(c: DealContext): Tool[] {
  return [{
    name: 'my_capacity', description: 'Your free capacity, workers, usual price, delivery transit time and the wage floor you may not pay below.',
    parameters: { type: 'object', properties: {} },
    run: () => ({
      freeUnitsPerMonth: c.freeUnitsPerMonth, availableWorkers: c.availableWorkers, unitsPerWorkerDay: +c.unitsPerWorkerDay.toFixed(2),
      transitDays: c.transitDays, referenceUnitPriceInr: c.referenceUnitPrice, wageFloorPerWorkerDayInr: c.wageFloor, labourShareOfPrice: c.labourShare,
    }),
  }];
}

export function buyerTools(c: DealContext): Tool[] {
  return [{
    name: 'supplier_check', description: 'Trust score, verification status, quality and delivery record of the supplier you are negotiating with.',
    parameters: { type: 'object', properties: {} },
    run: () => ({
      supplier: c.seller.name, type: c.seller.type, district: c.districtName, verification: c.seller.verification, trustScore: c.trust,
      defectPpm: c.seller.details.defectPpm, onTimeInFullPct: c.seller.details.otifPct, referenceUnitPriceInr: c.referenceUnitPrice, transitDays: c.transitDays,
    }),
  }];
}
