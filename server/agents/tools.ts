// The engine behind the agents. Every number an agent sees or a limit the orchestrator enforces comes from here,
// and from the existing Sangam engine (src/data, engine, chainRoute, trust), never from the model.
import type { BomLine, Provenance, Seller } from '../../src/types';
import { bom, loadDataset, sellers } from '../../src/data';
import { district, isRural } from '../../src/engine';
import { fxRate, industryStats, labourMarket } from '../../src/realdata';
import { partRoute } from '../../src/chainRoute';
import { EMPTY } from '../../src/model';
import type { Quote, Requirement } from '../../src/model';
import { quoteTco } from '../../src/tco';
import { checksFor, trustScore } from '../../src/trust';
import { supplierIdentityVerified } from '../verify/tiers';
import type { FairWorkScore, Offer, Rfq, WorkforceProfile } from '../../src/contracts';
import { livingWageFor, minimumWageFor, scoreFairWork } from '../../src/fairwork';
import type { Db, Doc } from '../db';
import { openGrievances } from '../grievances';

// Wage benchmarks and grading come from P3's src/fairwork.ts (GLWC living wages, state minimum wages, one table of grading rules).
// If a district has no benchmark at all the floor falls back to the nearest rural figure so a missing row can never switch protection off.
const FALLBACK_FLOOR_PER_DAY = Math.round(14926 / 26); // GLWC rural Nilgiris, estimated
/** Share of the price that is wages, by process. A modelling assumption (estimated), not a measured figure. */
const LABOUR_SHARE = { assembly: 0.6, other: 0.3 };
/** Rupees per unit of currency, from the ECB reference rates in src/real/fx.json (refresh with `npm run data:refresh fx`). */
export const FX_INR: Record<'INR' | 'USD' | 'EUR', number> = { INR: 1, USD: fxRate('USD').inrPer, EUR: fxRate('EUR').inrPer };

/**
 * The wage floor for a district: the higher of the legal minimum wage and the living wage. Both are hard limits for a quote or a counter.
 * (The living wage also drives the A to E grade, in src/fairwork.ts.) A missing legal minimum never means "no floor": the living wage
 * stands in for it, tagged estimated, and the deal is held for review (see reviewReasons).
 */
export interface WageFloor {
  perDay: number;
  basis: 'living-wage' | 'legal-minimum';
  livingWage: { perDay: number; tag: Provenance; source: string };
  legalMinimum: { perDay: number; basis: 'notified' | 'estimated'; source: string };
}

export function wageFloorFor(district: string): WageFloor {
  const lw = livingWageFor(district);
  const living = {
    perDay: lw?.perDayInr ?? FALLBACK_FLOOR_PER_DAY,
    tag: (lw && lw.match !== 'nearest' ? 'public' : 'estimated') as Provenance,
    source: lw?.source ?? 'GLWC rural Nilgiris (fallback when the district has no benchmark)',
  };
  const mw = minimumWageFor(district);
  const legal = mw
    ? { perDay: mw.perDayInr, basis: 'notified' as const, source: mw.asNotified }
    : { perDay: living.perDay, basis: 'estimated' as const, source: 'not on file; the living wage is used instead' };
  return { perDay: Math.max(living.perDay, legal.perDay), basis: legal.perDay > living.perDay ? 'legal-minimum' : 'living-wage', livingWage: living, legalMinimum: legal };
}

/** The wage floor per worker-day for a district (id or name). */
export const wageFloorPerDay = (district: string) => wageFloorFor(district).perDay;

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
  floor: WageFloor;
  labourShare: number;
  /** materials and overhead per unit: the part of the reference price that is not wages (estimated, from LABOUR_SHARE) */
  nonLabourPerUnit: number;
  budgetInr: number;
  trust: number;
  workforce?: WorkforceProfile;
  /** what factory workers in this state and industry were actually paid per worker-day (ASI 2023-24), for context only */
  marketWage?: { perDay: number; scope: 'state' | 'all-india'; industry: string; source: string };
  /** what casual labourers in the state earn a day, for everyone and for women (PLFS 2025), for context only */
  casualWage?: { perDay: number; perDayFemale: number | null; source: string };
}

/** Two-digit industry (NIC 2008) a process belongs to, for matching it to Annual Survey of Industries figures. */
export function nicFor(process: string): string {
  const p = process.toLowerCase();
  if (/wire|cable|connector|harness|electric/.test(p)) return '27';
  if (/plastic|polymer|mould|extrus|film|rubber/.test(p)) return '22';
  if (/cement|tile|block|brick|ceramic|glass/.test(p)) return '23';
  if (/steel|metal|alumin|rebar/.test(p)) return '24';
  if (/fabricat|window|fitting|valve/.test(p)) return '25';
  if (/carton|packag|paper/.test(p)) return '17';
  if (/panel|wood|bamboo/.test(p)) return '16';
  if (/food|millet|spice|vegetable|flake|dry|dehydrat|mix/.test(p)) return '10';
  return '27';
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
  const floor = wageFloorFor(seller.districtId);
  const labourShare = line.id === 'assembly' ? LABOUR_SHARE.assembly : LABOUR_SHARE.other;
  return {
    rfq, line, seller,
    districtName: district(seller.districtId).name,
    rural: isRural(seller),
    freeUnitsPerMonth: Math.round(seller.monthlyCapacity * (1 - seller.details.utilisationPct / 100)),
    unitsPerWorkerDay: seller.monthlyCapacity / (seller.workers * 26),
    availableWorkers,
    transitDays: Math.max(1, route.days - 12), // partRoute's production leg is a fixed 12 days
    referenceUnitPrice: Math.round(line.cost * seller.priceIndex),
    wageFloor: floor.perDay,
    floor,
    labourShare,
    nonLabourPerUnit: Math.round(Math.round(line.cost * seller.priceIndex) * (1 - labourShare)),
    budgetInr: rfq.budget.amount * FX_INR[rfq.budget.currency],
    // An account that speaks for this supplier and passed a business check earns the identity part of the trust score
    trust: trustScore(seller, supplierIdentityVerified(db, seller.id)
      ? { ...EMPTY, verifications: { [seller.id]: { ...checksFor(seller, EMPTY), identity: 'verified', requestedAt: '' } } }
      : EMPTY).score,
    workforce,
    casualWage: (() => {
      const m = labourMarket(district(seller.districtId).state);
      return m?.casualPerDay ? { perDay: Math.round(m.casualPerDay), perDayFemale: m.casualPerDayFemale ? Math.round(m.casualPerDayFemale) : null, source: m.source } : undefined;
    })(),
    marketWage: (() => {
      const st = industryStats(district(seller.districtId).state, nicFor(line.process));
      return st ? { perDay: Math.round(st.wagePerWorkerDay), scope: st.scope, industry: st.industry, source: st.source } : undefined;
    })(),
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
/** Wages the plan can pay: what is left of the price after materials and overhead, shared over the worker-days. */
export const impliedWage = (c: DealContext, t: Terms) => Math.round(Math.max(0, (t.pricePerUnit - c.nonLabourPerUnit) * c.rfq.quantity) / Math.max(1, workerDays(t)));
/** The lowest price per unit at which the labour plan still pays the wage floor: materials and overhead + worker-days at the floor. */
export const minViablePrice = (c: DealContext, t: Pick<Terms, 'workers' | 'productionDays'>) =>
  Math.ceil(c.nonLabourPerUnit + (c.wageFloor * t.workers * t.productionDays) / c.rfq.quantity);

/** The price floor with its parts, each tagged with where it comes from, and a sentence the negotiation events can show. */
export function priceFloor(c: DealContext, t: Pick<Terms, 'workers' | 'productionDays'>) {
  const perUnit = minViablePrice(c, t);
  const wageTag: Provenance = c.floor.basis === 'living-wage' ? c.floor.livingWage.tag : c.floor.legalMinimum.basis === 'notified' ? 'public' : 'estimated';
  const parts = [
    { label: 'labour at the wage floor', perUnit: perUnit - c.nonLabourPerUnit, tag: wageTag },
    { label: 'materials and overhead', perUnit: c.nonLabourPerUnit, tag: 'estimated' as Provenance },
  ];
  const basis = c.floor.basis === 'legal-minimum' ? 'legal minimum wage' : 'living wage';
  const text = `Price floor ₹${perUnit} a unit = labour ₹${parts[0]!.perUnit} at the ₹${c.wageFloor} a day ${basis} [${wageTag}] + materials and overhead ₹${c.nonLabourPerUnit} [estimated]`;
  return { perUnit, parts, text };
}

/** The fewest production days a team of this size needs for the whole order. */
export const workersNeededDays = (c: DealContext, workers: number) => Math.ceil(c.rfq.quantity / (workers * c.unitsPerWorkerDay));

/** Production time with all available workers: the fastest the supplier can deliver. */
export function fastestPlan(c: DealContext): Pick<Terms, 'workers' | 'productionDays'> {
  const workers = c.availableWorkers;
  return { workers, productionDays: Math.max(1, Math.ceil(c.rfq.quantity / (workers * c.unitsPerWorkerDay))) };
}

/** Hard limits. Returns why an offer is not allowed, or undefined when it is. Code decides this, never a model. */
export function violation(c: DealContext, t: Terms): string | undefined {
  if (![t.pricePerUnit, t.workers, t.productionDays].every((n) => Number.isFinite(n) && n > 0)) return 'The offer has a missing or non-positive number.';
  const wage = impliedWage(c, t);
  if (wage < c.wageFloor) return `At ₹${Math.round(t.pricePerUnit)} a unit the labour plan pays ₹${wage} a worker-day, below the ₹${c.wageFloor} ${c.floor.basis === 'legal-minimum' ? 'legal minimum wage' : 'living-wage floor'} for ${c.districtName}. ${priceFloor(c, t).text}. Blocked before the other side saw it.`;
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

/** Grade a confirmed offer with P3's scorecard. A supplier that has saved no workforce profile counts as having no safety record. */
export function scoreOffer(c: DealContext, o: Offer): FairWorkScore {
  const profile: WorkforceProfile = c.workforce ?? {
    supplierId: c.seller.id, district: c.districtName, skills: [], hoursPerDay: o.labour.hoursPerDay, overtimeHoursPerWeek: 0,
    safetyRecord: 'none', trainingHoursPerYear: 0, womenEmployed: 0, childOrForcedLabourFlag: false, openGrievances: 0, updatedAt: new Date().toISOString(),
  };
  // A worker's anonymous report (P4's grievance channel) lowers the grade a step while it is open
  return scoreFairWork(o.labour, { ...profile, openGrievances: Math.max(profile.openGrievances, openGrievances(c.seller.id)) });
}

/** Things a person should look at before a deal is signed, other than certificates. The Auditor cannot pass a deal while any is open. */
export function reviewReasons(c: DealContext): string[] {
  const out: string[] = [];
  if (c.floor.legalMinimum.basis === 'estimated') {
    out.push(`The legal minimum wage for ${district(c.seller.districtId).state} is not on file; the living wage (estimated) was used as the floor, so a person should check it`);
  }
  return out;
}

/**
 * Checked on a supplier's opening quote, before the buyer sees it. A grade E (child or forced labour) or a wage under the notified legal
 * minimum blocks the quote. It is shown as a rejected offer, not as an audit event: P2's room and P4's ledger read the first audit event as the final result.
 */
export function quoteGate(c: DealContext, o: Offer): { block?: string } {
  const score = scoreOffer(c, o);
  if (score.grade === 'E') return { block: 'This supplier has a child or forced labour flag on file (grade E), so it cannot be offered to buyers.' };
  if (c.floor.legalMinimum.basis === 'notified' && o.labour.wagePerWorkerDay < c.floor.legalMinimum.perDay) {
    return { block: `The wage in this quote, ₹${o.labour.wagePerWorkerDay} a worker-day, is below the legal minimum wage of ₹${c.floor.legalMinimum.perDay}.` };
  }
  return {};
}

/** Total cost per unit of buying from this supplier on this offer: the same total-cost-of-ownership model the Requirements page uses. */
export function tcoPerUnit(c: DealContext, o: Offer): number {
  const q = { bidder: { kind: 'seller', id: c.seller.id }, unitPrice: termsOf(c, o).pricePerUnit, toolingLakh: 0, leadDays: o.leadTimeDays, capacity: c.freeUnitsPerMonth } as unknown as Quote;
  const r = { lineId: c.line.id, monthlyVolume: c.rfq.quantity } as unknown as Requirement;
  return quoteTco(q, r, EMPTY).total;
}

/** How the buyer ranks the valid offers. Tune here, nowhere else. Fair work and trust count most; the cheapest offer can lose. */
export const RANK_WEIGHTS = { fairWork: 0.30, trust: 0.25, cost: 0.20, leadTime: 0.15, certificates: 0.10 } as const;
const GRADE_SCORE: Record<FairWorkScore['grade'], number> = { A: 1, B: 0.8, C: 0.5, D: 0.2, E: 0 };

export interface Ranked { c: DealContext; offer: Offer; score: number; grade: FairWorkScore['grade']; tco: number; gaps: number; reason: string }

/** Rank offers best first. Each sub-score runs from 0 to 1; the weighted sum decides, ties go to the lower total cost. */
export function rankOffers(entries: { c: DealContext; offer: Offer }[]): Ranked[] {
  if (!entries.length) return [];
  const rows = entries.map(({ c, offer }) => ({ c, offer, grade: scoreOffer(c, offer).grade, tco: tcoPerUnit(c, offer), gaps: certificateGaps(c).length }));
  const minTco = Math.min(...rows.map((r) => r.tco));
  const minDays = Math.min(...rows.map((r) => r.offer.leadTimeDays));
  return rows.map((r) => {
    const left = daysLeft(r.c.rfq.needBy);
    const onTime = left === undefined || r.offer.leadTimeDays <= left ? 1 : 0;
    const needed = Math.max(1, r.c.line.requiredCerts.length);
    const parts = {
      fairWork: GRADE_SCORE[r.grade],
      trust: r.c.trust / 100,
      cost: minTco / r.tco,
      leadTime: 0.5 * onTime + 0.5 * (minDays / r.offer.leadTimeDays),
      certificates: Math.max(0, 1 - r.gaps / needed),
    };
    const score = +(Object.entries(RANK_WEIGHTS).reduce((sum, [k, w]) => sum + w * parts[k as keyof typeof parts], 0)).toFixed(3);
    const reason = `grade ${r.grade}, trust ${r.c.trust}/100, ₹${Math.round(r.tco)} a unit all in, ${r.offer.leadTimeDays} days, ${r.gaps ? `${r.gaps} certificate gap${r.gaps > 1 ? 's' : ''}` : 'no certificate gaps'}`;
    return { ...r, score, reason };
  }).sort((a, b) => b.score - a.score || a.tco - b.tco);
}

/**
 * Engine figures handed to each agent with its prompt. They used to be fetched through a tool call, which costs a second request per turn;
 * on a free tier with a few requests a minute that made negotiations time out, so the orchestrator reads the engine once and passes the result in.
 */
export function supplierFacts(c: DealContext) {
  return {
    freeUnitsPerMonth: c.freeUnitsPerMonth, availableWorkers: c.availableWorkers, unitsPerWorkerDay: +c.unitsPerWorkerDay.toFixed(2),
    transitDays: c.transitDays, referenceUnitPriceInr: c.referenceUnitPrice, wageFloorPerWorkerDayInr: c.wageFloor, materialsAndOverheadPerUnitInr: c.nonLabourPerUnit,
    ...(c.marketWage ? { averageFactoryWagePerWorkerDayInr: c.marketWage.perDay, averageFactoryWageSource: c.marketWage.source } : {}),
    ...(c.casualWage ? { casualLabourWagePerDayInr: c.casualWage.perDay, casualLabourWageWomenPerDayInr: c.casualWage.perDayFemale } : {}),
  };
}

export function buyerFacts(c: DealContext) {
  return {
    supplier: c.seller.name, type: c.seller.type, district: c.districtName, verification: c.seller.verification, trustScore: c.trust,
    defectPpm: c.seller.details.defectPpm, onTimeInFullPct: c.seller.details.otifPct, referenceUnitPriceInr: c.referenceUnitPrice, transitDays: c.transitDays,
  };
}
