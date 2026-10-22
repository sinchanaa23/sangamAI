// Deterministic, explainable calculations. Every number shown in the UI comes from here.
import { bom, buyer, capacityCost, certGaps, districts, sellers } from './data';
import { RURAL_TYPES } from './types';
import type { BomLine, District, Gap, Option, Seller, Weights } from './types';
import type { Scenario } from './scenario';

const ROAD_FACTOR = 1.3;
const FREIGHT_RS_PER_KG_KM = 0.005;
const PRODUCTION_DAYS = 12;
/** Exposure score for parts still imported (geopolitical and shipping risk). */
const IMPORT_EXPOSURE = 0.65;
const CURRENT_IMPORT_QUALITY = 0.88;

export function district(id: string): District {
  return districts.find((d) => d.id === id)!;
}

const plant = () => district(buyer.plantDistrictId);

export function roadKm(a: District, b: District): number {
  const r = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)) * ROAD_FACTOR);
}

export const isRural = (s: Seller) => RURAL_TYPES.includes(s.type);

/** Today's pre-duty cost of one BOM line per harness. */
export const baseLineCost = (line: BomLine) => (buyer.unitCost * line.sharePct) / 100;

export const isImported = (line: BomLine) => line.importedFrom !== 'India';

/** Cost of one BOM line per harness if it keeps coming from today's source under the scenario. */
export function importLineCost(line: BomLine, s: Scenario): number {
  return isImported(line) ? baseLineCost(line) * (1 + s.duty / 100) * (1 + s.fxPct / 100) : baseLineCost(line);
}

export const importUnitCost = (s: Scenario) => bom.reduce((sum, l) => sum + importLineCost(l, s), 0);

export const baselineImportShare = () => bom.filter(isImported).reduce((s, l) => s + l.sharePct, 0);

// ---------- Matching and chain generation ----------

function certGapsFor(seller: Seller, line: BomLine): Gap[] {
  return line.requiredCerts
    .filter((c) => !seller.certs.includes(c))
    .map((c) => ({ kind: 'certification' as const, label: c, labelHi: certGaps[c].labelHi, costLakh: certGaps[c].costLakh, months: certGaps[c].months, schemes: certGaps[c].schemes }));
}

function capacityGap(seller: Seller, needed: number): Gap[] {
  const short = needed - seller.monthlyCapacity;
  if (short <= 0) return [];
  const c = capacityCost[seller.process];
  const thousands = Math.ceil(short / 1000);
  return [{
    kind: 'capacity',
    label: `Add ${(thousands * 1000).toLocaleString('en-IN')} units/month capacity`,
    labelHi: `${(thousands * 1000).toLocaleString('en-IN')} यूनिट/माह क्षमता जोड़ें`,
    costLakh: thousands * c.lakhPerThousand,
    months: c.months,
    schemes: ['CGTMSE credit guarantee', 'PMEGP'],
  }];
}

/** Gaps a seller must close to supply `neededUnits` a month of this line. */
export const sellerGaps = (s: Seller, line: BomLine, neededUnits: number): Gap[] => [...certGapsFor(s, line), ...capacityGap(s, neededUnits)];

/** Delivered cost per harness for this line from a district at a given price index. */
export function deliveredCost(line: BomLine, priceIndex: number, districtId: string): number {
  return baseLineCost(line) * priceIndex + line.weightKg * roadKm(district(districtId), plant()) * FREIGHT_RS_PER_KG_KM;
}

export function leadDaysFrom(districtId: string): number {
  const d = district(districtId);
  return PRODUCTION_DAYS + Math.ceil(roadKm(d, plant()) / (400 * d.connectivity)) + 1;
}

/**
 * One way to supply a BOM line from one or more sellers.
 * `neededUnits` is the monthly volume each seller must reach; null means the group shares the volume by capacity.
 * `split` overrides how the volume is shared (defaults to capacity-weighted).
 */
export function buildOption(line: BomLine, group: Seller[], neededUnits: number | null, splitOverride?: number[]): Option {
  const totalCap = group.reduce((s, x) => s + x.monthlyCapacity, 0);
  const split = splitOverride ?? group.map((s) => (group.length === 1 ? 1 : s.monthlyCapacity / totalCap));
  const gaps = group.map((s) => ({
    sellerId: s.id,
    gaps: [...certGapsFor(s, line), ...(neededUnits ? capacityGap(s, neededUnits) : [])],
  }));
  const all = gaps.flatMap((g) => g.gaps);
  const base = baseLineCost(line);
  let unitCost = 0, leadDays = 0, quality = 0, climateRisk = 0;
  group.forEach((s, i) => {
    const d = district(s.districtId);
    const km = roadKm(d, plant());
    unitCost += split[i] * (base * s.priceIndex + line.weightKg * km * FREIGHT_RS_PER_KG_KM);
    leadDays = Math.max(leadDays, PRODUCTION_DAYS + Math.ceil(km / (400 * d.connectivity)) + 1);
    quality += split[i] * s.quality * (s.verification === 'verified' ? 1 : 0.9);
    climateRisk += split[i] * (d.climateRisk * 0.7 + (1 - d.power) * 0.3);
  });
  if (group.length > 1) climateRisk *= 0.8; // two sites spread the risk
  return {
    lineId: line.id,
    sellers: group,
    status: all.length === 0 ? 'ready' : 'potential',
    unitCost,
    leadDays,
    quality,
    climateRisk,
    rural: group.some(isRural),
    gaps,
    readyInMonths: all.reduce((m, g) => Math.max(m, g.months), 0),
    investmentLakh: all.reduce((s, g) => s + g.costLakh, 0),
  };
}

/** Every single supplier, plus consortia of two when neither can supply the volume alone. */
export function optionsFor(line: BomLine): Option[] {
  const cands = sellers.filter((s) => s.process === line.process);
  const out: Option[] = cands.map((s) => buildOption(line, [s], buyer.monthlyUnits));
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      const a = cands[i], b = cands[j];
      const small = a.monthlyCapacity < buyer.monthlyUnits && b.monthlyCapacity < buyer.monthlyUnits;
      if (small && a.monthlyCapacity + b.monthlyCapacity >= buyer.monthlyUnits) out.push(buildOption(line, [a, b], null));
    }
  }
  return out;
}

function scoreOptions(opts: Option[], w: Weights): Map<Option, number> {
  const metric = {
    cost: (o: Option) => o.unitCost,
    speed: (o: Option) => o.leadDays + o.readyInMonths * 15,
    quality: (o: Option) => -o.quality,
    resilience: (o: Option) => o.climateRisk,
  };
  const scores = new Map<Option, number>();
  opts.forEach((o) => scores.set(o, 0));
  (Object.keys(metric) as (keyof Weights)[]).forEach((k) => {
    const vals = opts.map(metric[k]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    opts.forEach((o) => {
      const n = hi === lo ? 0 : (metric[k](o) - lo) / (hi - lo);
      scores.set(o, scores.get(o)! + w[k] * n);
    });
  });
  return scores;
}

function pick(opts: Option[], w: Weights): Option | null {
  if (opts.length === 0) return null;
  const s = scoreOptions(opts, w);
  return [...opts].sort((a, b) => s.get(a)! - s.get(b)!)[0];
}

export interface Chain {
  id: 'ready' | 'best' | 'rural';
  name: string;
  tagline: string;
  /** null = this line stays imported */
  picks: Record<string, Option | null>;
  unitCost: number;
  leadDays: number;
  quality: number;
  exposure: number;
  importShare: number;
  ruralShare: number;
  ruralJobs: number;
  readyInMonths: number;
  investmentLakh: number;
  gapCount: number;
}

function summarise(id: Chain['id'], name: string, tagline: string, picks: Chain['picks'], s: Scenario): Chain {
  let unitCost = 0, leadDays = 0, quality = 0, exposure = 0, importShare = 0, ruralShare = 0, ruralJobs = 0, readyInMonths = 0, investmentLakh = 0, gapCount = 0;
  bom.forEach((line) => {
    const o = picks[line.id];
    const w = line.sharePct / 100;
    if (!o) {
      unitCost += importLineCost(line, s);
      leadDays = Math.max(leadDays, buyer.importLeadDays);
      quality += w * CURRENT_IMPORT_QUALITY;
      exposure += w * (isImported(line) ? IMPORT_EXPOSURE : 0.3);
      if (isImported(line)) importShare += line.sharePct;
      return;
    }
    unitCost += o.unitCost;
    leadDays = Math.max(leadDays, o.leadDays);
    quality += w * o.quality;
    exposure += w * o.climateRisk;
    const cap = o.sellers.reduce((sum, x) => sum + x.monthlyCapacity, 0);
    o.sellers.forEach((x) => {
      if (isRural(x)) {
        ruralShare += line.sharePct * (o.sellers.length === 1 ? 1 : x.monthlyCapacity / cap);
        ruralJobs += x.workers;
      }
    });
    readyInMonths = Math.max(readyInMonths, o.readyInMonths);
    investmentLakh += o.investmentLakh;
    gapCount += o.gaps.reduce((sum, g) => sum + g.gaps.length, 0);
  });
  return { id, name, tagline, picks, unitCost, leadDays, quality, exposure, importShare, ruralShare, ruralJobs, readyInMonths, investmentLakh, gapCount };
}

export function generateChains(w: Weights, s: Scenario): Chain[] {
  const ready: Chain['picks'] = {}, best: Chain['picks'] = {}, rural: Chain['picks'] = {};
  bom.forEach((line) => {
    const opts = optionsFor(line);
    ready[line.id] = pick(opts.filter((o) => o.status === 'ready'), w);
    best[line.id] = pick(opts, w);
    rural[line.id] = pick(opts.filter((o) => o.rural), w) ?? best[line.id];
  });
  return [
    summarise('ready', 'Switch now', 'Only suppliers who qualify today', ready, s),
    summarise('best', 'Best balance', 'Ranked on your priorities, gaps closed within a year', best, s),
    summarise('rural', 'Rural-first', 'Cooperatives and SHGs wherever they can qualify', rural, s),
  ];
}

export function recommend(chains: Chain[], w: Weights): Chain {
  const asOption = (c: Chain) => ({ unitCost: c.unitCost, leadDays: c.leadDays, readyInMonths: c.readyInMonths, quality: c.quality, climateRisk: c.exposure }) as Option;
  const opts = chains.map(asOption);
  const s = scoreOptions(opts, w);
  const i = opts.indexOf([...opts].sort((a, b) => s.get(a)! - s.get(b)!)[0]);
  return chains[i];
}

// ---------- Explanation ----------

export function explain(chain: Chain, s: Scenario): string[] {
  const today = importUnitCost(s);
  const saving = ((today - chain.unitCost) / today) * 100;
  const lines = [
    `Landed cost ${saving >= 0 ? 'falls' : 'rises'} ${Math.abs(saving).toFixed(1)}% against importing under this scenario (${inr(chain.unitCost)} vs ${inr(today)} per harness).`,
    `Import dependence drops from ${baselineImportShare()}% to ${chain.importShare.toFixed(0)}% of the harness value${chain.readyInMonths > 0 ? ' once the switch is complete' : ''}.`,
    `Longest delivery time falls from ${buyer.importLeadDays} days to ${chain.leadDays} days.`,
  ];
  if (chain.ruralShare > 0) lines.push(`${chain.ruralShare.toFixed(0)}% of the value goes to rural collectives, supporting about ${chain.ruralJobs} workers.`);
  if (chain.gapCount > 0) lines.push(`Trade-off: ${chain.gapCount} gaps must be closed first, so the full switch takes about ${chain.readyInMonths} months and ${lakh(chain.investmentLakh)} in supplier development.`);
  return lines;
}

// ---------- Formatting ----------

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const crore = (n: number) => '₹' + n.toFixed(1) + ' Cr';
export const lakh = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN') + ' lakh';
export const pct = (n: number) => Math.round(n * 100) + '%';
