// The active dataset. Arrays and objects here are filled in place by loadDataset() so every
// module that imports them always sees the current sector, the buyer's own edits and onboarded companies.
import { ALL_DISTRICTS } from './realdata';
import { CERTS_COMMON, makeSeller } from './sectors/helpers';
import { SECTORS } from './sectors';
import type { OpportunitySeed, SectorTemplate } from './sectors';
import type { BomLine, Buyer, CertInfo, DemandSignal, District, NewSite, ProcessInfo, SectorId, Seller } from './types';

export const buyer = {} as Buyer;
export const bom: BomLine[] = [];
export const sellers: Seller[] = [];
export const newSites: NewSite[] = [];
export const districts: District[] = ALL_DISTRICTS;
export const processes: ProcessInfo[] = [];
export const certGaps: Record<string, CertInfo> = {};
export const capacityCost: Record<string, { lakhPerThousand: number; months: number }> = {};
export const demandSignals: DemandSignal[] = [];
export const opportunities: OpportunitySeed[] = [];
export const active = { sector: 'ev' as SectorId, template: SECTORS.ev as SectorTemplate };

export interface DatasetOverrides {
  buyer?: Partial<Omit<Buyer, 'unitCost'>>;
  bom?: Omit<BomLine, 'sharePct'>[];
}

const replace = <T,>(arr: T[], items: T[]) => arr.splice(0, arr.length, ...items);
const clear = (o: Record<string, unknown>) => Object.keys(o).forEach((k) => delete o[k]);

export function loadDataset(sector: SectorId, overrides: DatasetOverrides = {}, onboarded: Seller[] = [], customSites: NewSite[] = []) {
  const t = SECTORS[sector];
  active.sector = sector;
  active.template = t;
  const lines = (overrides.bom ?? t.bom).map((l) => ({ ...l, tiers: l.tiers ?? [], requiredCerts: l.requiredCerts ?? [] }));
  const total = lines.reduce((s, l) => s + l.cost, 0) || 1;
  replace(bom, lines.map((l) => ({ ...l, sharePct: +((l.cost / total) * 100).toFixed(2) })));
  Object.keys(buyer).forEach((k) => delete (buyer as unknown as Record<string, unknown>)[k]);
  Object.assign(buyer, t.buyer, overrides.buyer ?? {}, { unitCost: total });

  const stateOf = (id: string) => districts.find((d) => d.id === id)?.state ?? '';
  replace(sellers, [...t.sellers.map((s) => makeSeller(s, stateOf(s.districtId))), ...onboarded]);
  replace(newSites, [...t.newSites, ...customSites]);
  replace(processes, t.processes);
  clear(certGaps); Object.assign(certGaps, CERTS_COMMON, t.certs);
  clear(capacityCost); t.processes.forEach((p) => { capacityCost[p.name] = { lakhPerThousand: p.lakhPerThousand, months: p.months }; });
  replace(demandSignals, t.demandSignals);
  replace(opportunities, t.opportunities);
}

/** Certification cost and time; falls back to a typical value for certificates the template doesn't know. */
export const certInfo = (name: string): CertInfo =>
  certGaps[name] ?? { costLakh: 3, months: 4, labelHi: name, schemes: ['MSME ZED certification support'] };

export const processInfo = (name: string): ProcessInfo =>
  processes.find((p) => p.name === name) ?? { name, nameHi: name, lakhPerThousand: 5, months: 6, refCapacity: Math.max(1, buyer.monthlyUnits) };

export const unitLabel = (n = 2) => {
  const u = buyer.unitLabel;
  if (n === 1) return u;
  return /(s|sh|ch|x)$/.test(u) ? `${u}es` : `${u}s`;
};

loadDataset('ev');
