// Future domestic networks: designs generated from the suppliers and possible new sites,
// and their long-run cost and returns against importing, diversifying abroad, or a hybrid.
import { bom, buyer, newSites, sellers } from './data';
import { baselineImportShare, deliveredCost, district, generateChains, importLineCost, importUnitCost, isImported, isRural, leadDaysFrom, roadKm, sellerGaps } from './engine';
import { evaluateLanes, todayLane } from './routes';
import { expectedDisruptionLoss } from './sim';
import type { Scenario } from './scenario';
import type { BomLine, Gap, Weights } from './types';

export type NodeStatus = 'available' | 'upgrade' | 'new';

export interface NetNode {
  key: string;
  kind: 'seller' | 'site';
  lineId: string;
  name: string;
  districtId: string;
  share: number;
  status: NodeStatus;
  /** investment to make this node ready, in rupee crore */
  capexCr: number;
  readyMonths: number;
  gaps: Gap[];
  rural: boolean;
  workers: number;
  /** delivered cost per unit of product for this node's share */
  cost: number;
  leadDays: number;
}

export interface NetLine {
  line: BomLine;
  nodes: NetNode[];
  cost: number;
  importCost: number;
  /** negative = cheaper than importing */
  deltaPct: number;
  readyMonths: number;
}

export interface Architecture {
  id: string;
  name: string;
  idea: string;
  lines: NetLine[];
  unitCost: number;
  importCost: number;
  capexCr: number;
  readyMonths: number;
  leadDays: number;
  resilience: number;
  ruralShare: number;
  jobs: number;
  counts: Record<NodeStatus, number>;
}

type Ref = { seller: string; share: number } | { site: string; share: number };

interface Cand { ref: (share: number) => Ref; districtId: string; cap: number; price: number; rural: boolean; state: string; quality: number }

function candidates(line: BomLine): Cand[] {
  const need = buyer.monthlyUnits;
  return [
    ...sellers.filter((s) => s.process === line.process).map((s) => ({ ref: (share: number) => ({ seller: s.id, share }), districtId: s.districtId, cap: s.monthlyCapacity, price: s.priceIndex, rural: isRural(s), state: district(s.districtId).state, quality: s.quality })),
    ...newSites.filter((n) => n.process === line.process).map((n) => ({ ref: (share: number) => ({ site: n.id, share }), districtId: n.districtId, cap: need, price: n.priceIndex, rural: n.rural, state: district(n.districtId).state, quality: n.quality })),
  ];
}

/** Give shares in order until the volume is covered; the last node grows to cover any shortfall. */
function fill(cands: Cand[], max = 3): Ref[] {
  const need = buyer.monthlyUnits;
  const refs: Ref[] = [];
  let left = 1;
  for (const c of cands.slice(0, max)) {
    if (left <= 0.001) break;
    const take = refs.length === max - 1 || c === cands[Math.min(cands.length, max) - 1] ? left : Math.min(left, c.cap / need);
    refs.push(c.ref(+take.toFixed(3)));
    left -= take;
  }
  return refs;
}

const plantId = () => buyer.plantDistrictId;
const distTo = (c: Cand) => roadKm(district(c.districtId), district(plantId()));

const PLANS: { id: string; name: string; idea: string; refs: (line: BomLine, best: Ref[]) => Ref[] }[] = [
  { id: 'corridor', name: 'Specialist corridor', idea: 'The best existing specialists wherever they are in India.', refs: (_l, best) => best },
  {
    id: 'cluster', name: 'Plant cluster', idea: 'Everything close to your plant for the shortest lead times.',
    refs: (l) => fill(candidates(l).filter((c) => distTo(c) < 250).sort((a, b) => distTo(a) - distTo(b))) ,
  },
  {
    id: 'rural', name: 'Rural growth network', idea: 'Cooperatives, FPOs and SHG hubs first, specialists for the rest.',
    refs: (l) => fill([...candidates(l).filter((c) => c.rural).sort((a, b) => a.price - b.price), ...candidates(l).filter((c) => !c.rural).sort((a, b) => a.price - b.price)]),
  },
  {
    id: 'twin', name: 'Twin-hub resilient', idea: 'Every part from two regions so no single event stops the line.',
    refs: (l) => {
      const cs = candidates(l).sort((a, b) => a.price / a.quality - b.price / b.quality);
      const first = cs[0];
      const second = cs.find((c) => first && c.state !== first.state) ?? cs[1];
      return [first, second].filter(Boolean).map((c, _i, arr) => c.ref(arr.length === 1 ? 1 : 0.5));
    },
  },
];

function buildNode(line: BomLine, ref: Ref): NetNode {
  if ('site' in ref) {
    const n = newSites.find((x) => x.id === ref.site)!;
    return {
      key: n.id, kind: 'site', lineId: line.id, name: n.name, districtId: n.districtId, share: ref.share, status: 'new',
      capexCr: n.capexCr, readyMonths: n.readyMonths, gaps: [], rural: n.rural, workers: n.workers,
      cost: ref.share * deliveredCost(line, n.priceIndex, n.districtId), leadDays: leadDaysFrom(n.districtId),
    };
  }
  const s = sellers.find((x) => x.id === ref.seller)!;
  const gaps = sellerGaps(s, line, Math.round(ref.share * buyer.monthlyUnits));
  return {
    key: s.id, kind: 'seller', lineId: line.id, name: s.name, districtId: s.districtId, share: ref.share,
    status: gaps.length ? 'upgrade' : 'available',
    capexCr: gaps.reduce((t, g) => t + g.costLakh, 0) / 100,
    readyMonths: gaps.reduce((m, g) => Math.max(m, g.months), 0),
    gaps, rural: isRural(s), workers: s.workers,
    cost: ref.share * deliveredCost(line, s.priceIndex, s.districtId), leadDays: leadDaysFrom(s.districtId),
  };
}

export function summariseArchitecture(id: string, name: string, idea: string, lines: NetLine[], s: Scenario): Architecture {
  const all = lines.flatMap((l) => l.nodes);
  const covered = lines.filter((l) => l.nodes.length);
  const singleShare = covered.filter((l) => new Set(l.nodes.map((n) => n.districtId)).size < 2).reduce((t, l) => t + l.line.sharePct, 0) / 100;
  const climate = covered.reduce((t, l) => t + (l.line.sharePct / 100) * l.nodes.reduce((u, n) => u + n.share * district(n.districtId).climateRisk, 0), 0);
  const counts = { available: 0, upgrade: 0, new: 0 } as Record<NodeStatus, number>;
  all.forEach((n) => counts[n.status]++);
  return {
    id, name, idea, lines,
    unitCost: lines.reduce((t, l) => t + (l.nodes.length ? l.cost : l.importCost), 0),
    importCost: importUnitCost(s),
    capexCr: all.reduce((t, n) => t + n.capexCr, 0),
    readyMonths: Math.max(0, ...lines.map((l) => l.readyMonths)),
    leadDays: Math.max(0, ...all.map((n) => n.leadDays)),
    resilience: Math.round((1 - (0.5 * singleShare + 0.5 * climate)) * 100),
    ruralShare: lines.reduce((t, l) => t + l.line.sharePct * l.nodes.filter((n) => n.rural).reduce((u, n) => u + n.share, 0), 0),
    jobs: all.filter((n) => n.status === 'new' || n.rural).reduce((t, n) => t + n.workers, 0),
    counts,
  };
}

export function netLine(line: BomLine, refs: Ref[], s: Scenario): NetLine {
  const nodes = refs.filter((r) => r.share > 0).map((r) => buildNode(line, r));
  const cost = nodes.reduce((t, n) => t + n.cost, 0);
  const importCost = importLineCost(line, s);
  return { line, nodes, cost, importCost, deltaPct: nodes.length ? ((cost - importCost) / importCost) * 100 : 0, readyMonths: Math.max(0, ...nodes.map((n) => n.readyMonths)) };
}

export function architectures(s: Scenario, w: Weights): Architecture[] {
  const best = generateChains(w, s).find((c) => c.id === 'best')!;
  return PLANS.map((plan) => {
    const lines: NetLine[] = bom.map((line) => {
      const o = best.picks[line.id];
      const cap = o ? o.sellers.reduce((t, x) => t + x.monthlyCapacity, 0) : 1;
      const bestRefs: Ref[] = o ? o.sellers.map((x) => ({ seller: x.id, share: o.sellers.length === 1 ? 1 : x.monthlyCapacity / cap })) : [];
      return netLine(line, plan.refs(line, bestRefs), s);
    });
    return summariseArchitecture(plan.id, plan.name, plan.idea, lines, s);
  });
}

// ---------- Long-horizon cost and returns ----------

export interface HorizonPoint {
  year: number;
  importCum: number;
  indiaCum: number;
  diversifyCum: number;
  hybridCum: number;
  net: number;
  importShare: number;
}

export interface HorizonResult {
  points: HorizonPoint[];
  breakEvenYear: number | null;
  netSavingCr: number;
  roi: number;
  npvCr: number;
  capexCr: number;
  hybrid: { netSavingCr: number; npvCr: number; capexCr: number; breakEvenYear: number | null };
  diversifyNetCr: number;
}

/** Yearly cost growth assumptions, in %. Shown and adjustable in the UI. */
export interface Growth {
  /** dollar inflation plus rupee depreciation */
  importPct: number;
  /** Indian inflation net of scale and learning effects */
  domesticPct: number;
}
export const DEFAULT_GROWTH: Growth = { importPct: 4, domesticPct: 3 };
const DISCOUNT = 0.1;
const HYBRID_BACKUP = 0.15; // share kept with the best foreign lane as a hedge

const unitsInYear = (y: number) => {
  let u = buyer.monthlyUnits * 12;
  for (let i = 2; i <= y; i++) u *= i <= 5 ? 1.12 : i <= 10 ? 1.06 : 1.03;
  return u;
};

/** Ratio of the best open alternative lane's landed cost to today's lane, under the scenario. */
export function diversifyRatio(s: Scenario) {
  const all = evaluateLanes(s);
  const today = all.find((r) => r.lane.id === todayLane().id)!;
  const alts = all.filter((r) => r.lane.id !== today.lane.id && r.status !== 'blocked' && r.lane.mode === 'sea');
  const best = alts.sort((a, b) => a.costPerUnit + a.days * 2 - (b.costPerUnit + b.days * 2))[0];
  return { ratio: best ? best.costPerUnit / today.costPerUnit : 1, lane: best?.lane ?? today.lane };
}

export function horizon(arch: Architecture, s: Scenario, years: number, g: Growth = DEFAULT_GROWTH): HorizonResult {
  const points: HorizonPoint[] = [];
  const { ratio } = diversifyRatio(s);
  const nodes = arch.lines.flatMap((l) => l.nodes);
  const upgradeCr = nodes.filter((n) => n.status === 'upgrade').reduce((t, n) => t + n.capexCr, 0);
  const newCr = arch.capexCr - upgradeCr;
  const qualifyCr = nodes.length * 0.05;
  // Hybrid: localise only parts ready within 12 months, diversify the rest abroad, keep a backup share abroad
  const hybridLines = new Set(arch.lines.filter((l) => l.nodes.length && l.readyMonths <= 12).map((l) => l.line.id));
  const hybridCapexCr = nodes.filter((n) => hybridLines.has(n.lineId)).reduce((t, n) => t + n.capexCr, 0) + hybridLines.size * 0.05;

  let importCum = 0, indiaCum = 0, divCum = 0, hybCum = 0, npv = 0, hybNpv = 0;
  let breakEvenYear: number | null = null, hybBreak: number | null = null;
  for (let y = 1; y <= years; y++) {
    const units = unitsInYear(y);
    const imp = Math.pow(1 + g.importPct / 100, y - 1);
    const dom = Math.pow(1 + g.domesticPct / 100, y - 1);
    const importAnnual = units * importUnitCost(s) * imp + expectedDisruptionLoss(s, baselineImportShare(), units);

    let unitIndia = 0, shareIndia = 0, unitHyb = 0, shareHyb = 0, unitDiv = 0;
    arch.lines.forEach((l) => {
      const importNow = importLineCost(l.line, s) * imp;
      const abroad = isImported(l.line) ? importNow * ratio : importNow;
      unitDiv += abroad;
      const live = l.nodes.length > 0 && (y - 1) * 12 >= l.readyMonths;
      if (live) unitIndia += l.cost * dom;
      else { unitIndia += importNow; if (isImported(l.line)) shareIndia += l.line.sharePct; }
      if (hybridLines.has(l.line.id) && live) {
        unitHyb += (1 - HYBRID_BACKUP) * l.cost * dom + HYBRID_BACKUP * abroad;
        if (isImported(l.line)) shareHyb += HYBRID_BACKUP * l.line.sharePct * 0.5;
      } else {
        unitHyb += abroad;
        if (isImported(l.line)) shareHyb += l.line.sharePct * 0.5; // diversified across two countries halves the exposure
      }
    });
    const capex = (y === 1 ? upgradeCr + 0.4 * newCr + qualifyCr : y === 2 ? 0.6 * newCr : 0) * 1e7;
    const hybCapex = y === 1 ? hybridCapexCr * 1e7 : 0;
    const indiaAnnual = units * unitIndia + expectedDisruptionLoss(s, shareIndia, units) + capex;
    const divAnnual = units * unitDiv + expectedDisruptionLoss(s, baselineImportShare() * 0.5, units);
    const hybAnnual = units * unitHyb + expectedDisruptionLoss(s, shareHyb, units) + hybCapex;
    importCum += importAnnual; indiaCum += indiaAnnual; divCum += divAnnual; hybCum += hybAnnual;
    npv += (importAnnual - indiaAnnual) / Math.pow(1 + DISCOUNT, y);
    hybNpv += (importAnnual - hybAnnual) / Math.pow(1 + DISCOUNT, y);
    if (breakEvenYear === null && importCum - indiaCum >= 0) breakEvenYear = y;
    if (hybBreak === null && importCum - hybCum >= 0) hybBreak = y;
    points.push({ year: y, importCum: importCum / 1e7, indiaCum: indiaCum / 1e7, diversifyCum: divCum / 1e7, hybridCum: hybCum / 1e7, net: (importCum - indiaCum) / 1e7, importShare: shareIndia });
  }
  const capexCr = arch.capexCr + qualifyCr;
  const netSavingCr = (importCum - indiaCum) / 1e7;
  return {
    points, breakEvenYear, netSavingCr, roi: netSavingCr / Math.max(capexCr, 0.01), npvCr: npv / 1e7, capexCr,
    hybrid: { netSavingCr: (importCum - hybCum) / 1e7, npvCr: hybNpv / 1e7, capexCr: hybridCapexCr, breakEvenYear: hybBreak },
    diversifyNetCr: (importCum - divCum) / 1e7,
  };
}
