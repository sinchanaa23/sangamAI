// Future domestic networks: alternative architectures and their long-run cost and returns.
import { bom, buyer, newSites, sellers } from './data';
import { baselineImportShare, deliveredCost, district, generateChains, importLineCost, importUnitCost, isImported, isRural, leadDaysFrom, sellerGaps } from './engine';
import { expectedDisruptionLoss } from './sim';
import type { Scenario } from './scenario';
import type { BomLine, Gap, Weights } from './types';

export type NodeStatus = 'available' | 'upgrade' | 'new';

export interface NetNode {
  key: string;
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
  /** delivered cost per harness for this node's share */
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

const PLANS: { id: string; name: string; idea: string; assign: Record<string, Ref[]> | 'best' }[] = [
  { id: 'corridor', name: 'Specialist corridor', idea: 'Use the best existing specialists wherever they are in India.', assign: 'best' },
  {
    id: 'cluster', name: 'Plant cluster', idea: 'Build everything within 60 km of the Hosur plant for the shortest lead times.',
    assign: {
      copper: [{ site: 'n1', share: 1 }],
      connectors: [{ seller: 's6', share: 0.4 }, { site: 'n3', share: 0.6 }],
      assembly: [{ seller: 's13', share: 0.4 }, { site: 'n4', share: 0.6 }],
      sleeving: [{ site: 'n2', share: 1 }],
      clips: [{ seller: 's10', share: 1 }],
      packaging: [{ seller: 's16', share: 0.6 }, { seller: 's17', share: 0.4 }],
    },
  },
  {
    id: 'rural', name: 'Rural growth network', idea: 'Grow cooperatives, FPOs and SHG hubs across Tamil Nadu and Karnataka.',
    assign: {
      copper: [{ seller: 's1', share: 1 }],
      connectors: [{ seller: 's4', share: 0.6 }, { seller: 's6', share: 0.4 }],
      assembly: [{ seller: 's13', share: 0.35 }, { site: 'n5', share: 0.25 }, { seller: 's14', share: 0.4 }],
      sleeving: [{ site: 'n2', share: 1 }],
      clips: [{ seller: 's11', share: 0.5 }, { site: 'n6', share: 0.5 }],
      packaging: [{ seller: 's17', share: 0.6 }, { seller: 's16', share: 0.4 }],
    },
  },
  {
    id: 'twin', name: 'Twin-hub resilient', idea: 'Source every part from two regions so no single event stops the line.',
    assign: {
      copper: [{ seller: 's1', share: 0.5 }, { seller: 's2', share: 0.5 }],
      connectors: [{ seller: 's4', share: 0.5 }, { seller: 's5', share: 0.5 }],
      assembly: [{ seller: 's12', share: 0.5 }, { seller: 's14', share: 0.5 }],
      sleeving: [{ seller: 's7', share: 0.5 }, { seller: 's8', share: 0.5 }],
      clips: [{ seller: 's9', share: 0.5 }, { seller: 's10', share: 0.5 }],
      packaging: [{ seller: 's16', share: 0.5 }, { seller: 's17', share: 0.5 }],
    },
  },
];

function buildNode(line: BomLine, ref: Ref): NetNode {
  if ('site' in ref) {
    const n = newSites.find((x) => x.id === ref.site)!;
    return {
      key: n.id, lineId: line.id, name: n.name, districtId: n.districtId, share: ref.share, status: 'new',
      capexCr: n.capexCr, readyMonths: n.readyMonths, gaps: [], rural: n.rural, workers: n.workers,
      cost: ref.share * deliveredCost(line, n.priceIndex, n.districtId), leadDays: leadDaysFrom(n.districtId),
    };
  }
  const s = sellers.find((x) => x.id === ref.seller)!;
  const gaps = sellerGaps(s, line, Math.round(ref.share * buyer.monthlyUnits));
  return {
    key: s.id, lineId: line.id, name: s.name, districtId: s.districtId, share: ref.share,
    status: gaps.length ? 'upgrade' : 'available',
    capexCr: gaps.reduce((t, g) => t + g.costLakh, 0) / 100,
    readyMonths: gaps.reduce((m, g) => Math.max(m, g.months), 0),
    gaps, rural: isRural(s), workers: s.workers,
    cost: ref.share * deliveredCost(line, s.priceIndex, s.districtId), leadDays: leadDaysFrom(s.districtId),
  };
}

export function architectures(s: Scenario, w: Weights): Architecture[] {
  const best = generateChains(w, s).find((c) => c.id === 'best')!;
  return PLANS.map((plan) => {
    const lines: NetLine[] = bom.map((line) => {
      let refs: Ref[];
      if (plan.assign === 'best') {
        const o = best.picks[line.id];
        const cap = o ? o.sellers.reduce((t, x) => t + x.monthlyCapacity, 0) : 1;
        refs = o ? o.sellers.map((x) => ({ seller: x.id, share: o.sellers.length === 1 ? 1 : x.monthlyCapacity / cap })) : [];
      } else refs = plan.assign[line.id];
      const nodes = refs.map((r) => buildNode(line, r));
      const cost = nodes.reduce((t, n) => t + n.cost, 0);
      const importCost = importLineCost(line, s);
      return { line, nodes, cost, importCost, deltaPct: ((cost - importCost) / importCost) * 100, readyMonths: Math.max(0, ...nodes.map((n) => n.readyMonths)) };
    });
    const all = lines.flatMap((l) => l.nodes);
    const singleShare = lines.filter((l) => new Set(l.nodes.map((n) => n.districtId)).size < 2).reduce((t, l) => t + l.line.sharePct, 0) / 100;
    const climate = lines.reduce((t, l) => t + (l.line.sharePct / 100) * l.nodes.reduce((u, n) => u + n.share * district(n.districtId).climateRisk, 0), 0);
    const counts = { available: 0, upgrade: 0, new: 0 } as Record<NodeStatus, number>;
    all.forEach((n) => counts[n.status]++);
    return {
      id: plan.id, name: plan.name, idea: plan.idea, lines,
      unitCost: lines.reduce((t, l) => t + l.cost, 0),
      importCost: importUnitCost(s),
      capexCr: all.reduce((t, n) => t + n.capexCr, 0),
      readyMonths: Math.max(...lines.map((l) => l.readyMonths)),
      leadDays: Math.max(...all.map((n) => n.leadDays)),
      resilience: Math.round((1 - (0.5 * singleShare + 0.5 * climate)) * 100),
      ruralShare: lines.reduce((t, l) => t + l.line.sharePct * l.nodes.filter((n) => n.rural).reduce((u, n) => u + n.share, 0), 0),
      jobs: all.filter((n) => n.status === 'new' || n.rural).reduce((t, n) => t + n.workers, 0),
      counts,
    };
  });
}

// ---------- Long-horizon cost and returns ----------

export interface HorizonPoint {
  year: number;
  importCum: number;
  indiaCum: number;
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

const unitsInYear = (y: number) => {
  let u = buyer.monthlyUnits * 12;
  for (let i = 2; i <= y; i++) u *= i <= 5 ? 1.12 : i <= 10 ? 1.06 : 1.03;
  return u;
};

export function horizon(arch: Architecture, s: Scenario, years: number, g: Growth = DEFAULT_GROWTH): HorizonResult {
  const points: HorizonPoint[] = [];
  let importCum = 0, indiaCum = 0, npv = 0, breakEvenYear: number | null = null;
  const upgradeCr = arch.lines.flatMap((l) => l.nodes).filter((n) => n.status === 'upgrade').reduce((t, n) => t + n.capexCr, 0);
  const newCr = arch.capexCr - upgradeCr;
  const qualifyCr = arch.lines.flatMap((l) => l.nodes).length * 0.05;
  for (let y = 1; y <= years; y++) {
    const units = unitsInYear(y);
    const imp = Math.pow(1 + g.importPct / 100, y - 1);
    const dom = Math.pow(1 + g.domesticPct / 100, y - 1);
    const importAnnual = units * importUnitCost(s) * imp + expectedDisruptionLoss(s, baselineImportShare(), units);
    let unitIndia = 0, importShare = 0;
    arch.lines.forEach((l) => {
      if ((y - 1) * 12 >= l.readyMonths) unitIndia += l.cost * dom;
      else {
        unitIndia += importLineCost(l.line, s) * imp;
        if (isImported(l.line)) importShare += l.line.sharePct;
      }
    });
    const capex = (y === 1 ? upgradeCr + 0.4 * newCr + qualifyCr : y === 2 ? 0.6 * newCr : 0) * 1e7;
    const indiaAnnual = units * unitIndia + expectedDisruptionLoss(s, importShare, units) + capex;
    importCum += importAnnual;
    indiaCum += indiaAnnual;
    npv += (importAnnual - indiaAnnual) / Math.pow(1 + DISCOUNT, y);
    if (breakEvenYear === null && importCum - indiaCum >= 0) breakEvenYear = y;
    points.push({ year: y, importCum: importCum / 1e7, indiaCum: indiaCum / 1e7, net: (importCum - indiaCum) / 1e7, importShare });
  }
  const capexCr = arch.capexCr + qualifyCr;
  const netSavingCr = (importCum - indiaCum) / 1e7;
  return { points, breakEvenYear, netSavingCr, roi: netSavingCr / capexCr, npvCr: npv / 1e7, capexCr };
}
