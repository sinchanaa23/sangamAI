// Real public data fetched by scripts/fetch-real-data.mjs, and the district scores derived from it.
import comtradeFile from './real/comtrade.json';
import lpiFile from './real/lpi.json';
import tariffsFile from './real/tariffs.json';
import fxFile from './real/fx.json';
import industryFile from './real/industry.json';
import plfsFile from './real/plfs.json';
import districtList from './geo/districts.json';
import type { District, Provenance } from './types';

// Optional files: present after `npm run data:refresh` has fetched them
const optional = import.meta.glob('./real/{climate,osm}.json', { eager: true, import: 'default' }) as Record<string, unknown>;
interface ClimateRow { heavyRainDays: number; veryHeavyRainDays: number; hotDays: number; annualRainMm: number; maxDayRainMm: number }
interface OsmRow { industrialAreas: number; railStations: number; airports: number; highwaySegments: number }
const climateFile = optional['./real/climate.json'] as { source: string; fetched: string; districts: Record<string, ClimateRow> } | undefined;
const osmFile = optional['./real/osm.json'] as { source: string; fetched: string; districts: Record<string, OsmRow> } | undefined;

export interface TradePartner { code: number; iso3: string; name: string; usd: number; share: number; netKg?: number | null; usdPerKg?: number | null; weightEstimated?: boolean | null }
export interface TradeStat {
  hs: string; label: string; year: number | null; totalUsd: number; hhi: number; partners: TradePartner[];
  /** net weight imported and the average import price, when Comtrade reports a weight */
  netKg?: number | null; usdPerKg?: number | null; weightEstimated?: boolean | null;
}

export const SOURCES = {
  comtrade: { name: 'UN Comtrade', detail: comtradeFile.source, fetched: comtradeFile.fetched, url: 'https://comtradeplus.un.org' },
  lpi: { name: 'World Bank LPI', detail: lpiFile.source, fetched: lpiFile.fetched, url: 'https://lpi.worldbank.org' },
  climate: { name: 'Open-Meteo', detail: climateFile?.source ?? 'Not fetched yet', fetched: climateFile?.fetched ?? '', url: 'https://open-meteo.com' },
  tariffs: { name: 'World Bank WITS (UNCTAD TRAINS)', detail: tariffsFile.source, fetched: tariffsFile.fetched, url: 'https://wits.worldbank.org' },
  industry: { name: 'MoSPI Annual Survey of Industries', detail: industryFile.source, fetched: industryFile.fetched, url: 'https://www.mospi.gov.in' },
  plfs: { name: 'MoSPI Periodic Labour Force Survey', detail: plfsFile.source, fetched: plfsFile.fetched, url: 'https://www.mospi.gov.in' },
  fx: { name: 'ECB reference rates (Frankfurter)', detail: fxFile.source, fetched: fxFile.fetched, url: 'https://www.frankfurter.app' },
  osm: { name: 'OpenStreetMap', detail: osmFile?.source ?? 'Not fetched yet', fetched: osmFile?.fetched ?? '', url: 'https://www.openstreetmap.org/copyright' },
};

export function trade(hs?: string): TradeStat | null {
  if (!hs) return null;
  const t = (comtradeFile.codes as Record<string, TradeStat>)[hs];
  return t && t.year ? t : null;
}

/** What India actually paid per kg for imports of this product (Comtrade value / net weight), from one partner or the world. */
export function unitValueUsdPerKg(hs?: string, iso3?: string): { usdPerKg: number; year: number; estimated: boolean; source: string } | null {
  const t = trade(hs);
  if (!t) return null;
  const row = iso3 ? t.partners.find((p) => p.iso3 === iso3) : t;
  if (!row?.usdPerKg || !t.year) return null;
  return { usdPerKg: row.usdPerKg, year: t.year, estimated: Boolean(row.weightEstimated), source: `UN Comtrade ${t.year}: India imports of HS ${t.hs}, value / net weight${row.weightEstimated ? ' (weight estimated by Comtrade)' : ''}` };
}

/** India's applied MFN customs duty for an HS code, as a fraction (0.15 = 15%). Basic duty only. */
export function importDuty(hs?: string): { rate: number; year: number; source: string } | null {
  const t = hs ? (tariffsFile.codes as Record<string, { mfnPct: number; year: number }>)[hs] : undefined;
  return t ? { rate: t.mfnPct / 100, year: t.year, source: `World Bank WITS (UNCTAD TRAINS) ${t.year}: India MFN applied duty for HS ${hs}, basic duty only` } : null;
}

interface AsiCell { factories?: number; factoriesOperating?: number; workers?: number; femaleWorkers?: number; mandaysThousand?: number; workerWagesLakh?: number; outputLakh?: number; gvaLakh?: number }
const asiKey = (x: string) => x.toLowerCase().replace(/[^a-z]/g, '').replace('chattisgarh', 'chhattisgarh');
const ASI_STATES = Object.fromEntries(Object.keys(industryFile.states).map((k) => [asiKey(k), k]));
ASI_STATES['dadraandnagarhaveli'] = 'Dadra & Nagar Havelli and Daman & Diu'; // ASI reports the two territories together

export interface IndustryStats {
  state: string; nic: string; industry: string; year: string;
  /** 'state' when the state's own figures are used, 'all-india' when that state has no figures for this industry */
  scope: 'state' | 'all-india';
  factories: number; workers: number; femaleWorkers: number;
  workersPerFactory: number;
  /** rupees per worker-day: wages of workers / mandays worked */
  wagePerWorkerDay: number;
  outputPerWorkerDay: number; gvaPerWorkerDay: number;
  /** share of gross value added paid as wages to workers, and share of total output */
  wageShareOfGva: number; wageShareOfOutput: number;
  femaleShare: number;
  source: string;
}

/** Actual factory-sector figures for a state and a two-digit industry (NIC 2008), from the Annual Survey of Industries. */
export function industryStats(state: string, nic: string): IndustryStats | null {
  const files = industryFile.states as Record<string, Record<string, AsiCell>>;
  const own = files[ASI_STATES[asiKey(state)] ?? '']?.[nic];
  const usable = (c?: AsiCell) => Boolean(c?.workers && c.mandaysThousand && c.workerWagesLakh && c.gvaLakh && c.outputLakh && c.factories);
  const scope = usable(own) ? 'state' : 'all-india';
  const c = scope === 'state' ? own : files['All India']?.[nic];
  if (!c || !usable(c)) return null;
  const mandays = c.mandaysThousand! * 1e3, lakh = 1e5;
  return {
    state: scope === 'state' ? (ASI_STATES[asiKey(state)] ?? state) : 'All India', nic,
    industry: (industryFile.industries as Record<string, string>)[nic] ?? nic, year: industryFile.year, scope,
    factories: c.factories!, workers: c.workers!, femaleWorkers: c.femaleWorkers ?? 0,
    workersPerFactory: c.workers! / c.factories!,
    wagePerWorkerDay: (c.workerWagesLakh! * lakh) / mandays,
    outputPerWorkerDay: (c.outputLakh! * lakh) / mandays, gvaPerWorkerDay: (c.gvaLakh! * lakh) / mandays,
    wageShareOfGva: c.workerWagesLakh! / c.gvaLakh!, wageShareOfOutput: c.workerWagesLakh! / c.outputLakh!,
    femaleShare: (c.femaleWorkers ?? 0) / c.workers!,
    source: `MoSPI Annual Survey of Industries ${industryFile.year}, factory sector, ${scope === 'state' ? state : 'All India'}, NIC ${nic}`,
  };
}

interface PlfsCell { person?: number; female?: number }
const PLFS_STATES = Object.fromEntries(Object.keys(plfsFile.states).map((k) => [asiKey(k), k]));
PLFS_STATES['dadraandnagarhaveli'] = 'Dadra & Nagar Haveli & Daman & Diu';

export interface LabourMarket {
  state: string; year: string;
  /** average earnings of casual labourers, rupees per day, for everyone and for women */
  casualPerDay: number | null; casualPerDayFemale: number | null;
  /** average monthly pay of regular salaried employees, rupees */
  salariedPerMonth: number | null; salariedPerMonthFemale: number | null;
  source: string;
}

/** What workers in a state actually earn, from the Periodic Labour Force Survey (all of the state, rural and urban). */
export function labourMarket(state: string): LabourMarket | null {
  const key = PLFS_STATES[asiKey(state)];
  const row = key ? (plfsFile.states as Record<string, { casualPerDay?: PlfsCell; salariedPerMonth?: PlfsCell }>)[key] : undefined;
  if (!row) return null;
  return {
    state: key!, year: plfsFile.year,
    casualPerDay: row.casualPerDay?.person ?? null, casualPerDayFemale: row.casualPerDay?.female ?? null,
    salariedPerMonth: row.salariedPerMonth?.person ?? null, salariedPerMonthFemale: row.salariedPerMonth?.female ?? null,
    source: `MoSPI Periodic Labour Force Survey ${plfsFile.year}, ${key}`,
  };
}

/** Rupees per unit of a currency, from the ECB reference rate on the date in fx.json. */
export function fxRate(ccy: 'INR' | 'USD' | 'EUR'): { inrPer: number; date: string; source: string } {
  const inrPer = ccy === 'INR' ? 1 : ccy === 'USD' ? fxFile.inrPerUsd : fxFile.inrPerEur;
  return { inrPer, date: fxFile.date, source: `${fxFile.source}, ${fxFile.date}` };
}

export function lpi(iso3: string): { score: number; year: number } | null {
  return (lpiFile.countries as Record<string, { score: number; year: number }>)[iso3] ?? null;
}

// ---------- District scores ----------

const MAJOR_PORTS: [string, number, number][] = [
  ['Mundra', 69.7, 22.75], ['Kandla', 70.22, 23.0], ['JNPT', 72.95, 18.95], ['Mormugao', 73.8, 15.41], ['New Mangalore', 74.81, 12.93],
  ['Kochi', 76.26, 9.97], ['Tuticorin', 78.2, 8.75], ['Chennai', 80.3, 13.1], ['Kamarajar', 80.33, 13.26], ['Krishnapatnam', 80.13, 14.25],
  ['Visakhapatnam', 83.3, 17.69], ['Paradip', 86.67, 20.26], ['Kolkata/Haldia', 88.07, 22.03],
];

/** State-level grid reliability, 0-1. An estimate: no open dataset was reachable at district level. */
const POWER_EST: Record<string, number> = {
  'Tamil Nadu': 0.9, Karnataka: 0.86, Maharashtra: 0.9, Gujarat: 0.93, 'Dadra and Nagar Haveli': 0.9, Haryana: 0.9, 'Uttar Pradesh': 0.78,
  Punjab: 0.88, 'Madhya Pradesh': 0.83, Jharkhand: 0.72, 'West Bengal': 0.82, Odisha: 0.8, 'Andhra Pradesh': 0.87, Kerala: 0.9, Assam: 0.74, Tripura: 0.75,
};

const kmBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = 6371, rad = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
};

type Base = { id: string; name: string; state: string; lat: number; lon: number };
const base = districtList as Base[];

const norm = (vals: number[]) => {
  const lo = Math.min(...vals), hi = Math.max(...vals);
  return (v: number) => (hi === lo ? 0.5 : (v - lo) / (hi - lo));
};

export interface DistrictMetrics {
  climate: ClimateRow | null;
  osm: OsmRow | null;
  nearestPort: { name: string; km: number };
  climateScore: number;
  connectivityScore: number;
  industrialScore: number;
  power: number;
  provenance: { climate: Provenance; connectivity: Provenance; industrial: Provenance; power: Provenance };
}

const climateRows = base.map((d) => climateFile?.districts[d.id] ?? null);
const osmRows = base.map((d) => osmFile?.districts[d.id] ?? null);
const nHeavy = norm(climateRows.filter(Boolean).map((c) => c!.heavyRainDays));
const nVery = norm(climateRows.filter(Boolean).map((c) => c!.veryHeavyRainDays));
const nHot = norm(climateRows.filter(Boolean).map((c) => c!.hotDays));
const nRail = norm(osmRows.filter(Boolean).map((o) => Math.log1p(o!.railStations)));
const nRoad = norm(osmRows.filter(Boolean).map((o) => Math.log1p(o!.highwaySegments)));
const nInd = norm(osmRows.filter(Boolean).map((o) => Math.log1p(o!.industrialAreas)));

export const METRICS: Record<string, DistrictMetrics> = Object.fromEntries(base.map((d, i) => {
  const c = climateRows[i], o = osmRows[i];
  const port = MAJOR_PORTS.map(([name, lon, lat]) => ({ name, km: Math.round(kmBetween(d.lat, d.lon, lat, lon) * 1.3) })).sort((a, b) => a.km - b.km)[0];
  const portScore = Math.max(0, 1 - port.km / 900);
  const climateScore = c ? 0.1 + 0.8 * (0.4 * nHeavy(c.heavyRainDays) + 0.3 * nVery(c.veryHeavyRainDays) + 0.3 * nHot(c.hotDays)) : 0.35;
  const connectivityScore = o ? 0.3 * nRail(Math.log1p(o.railStations)) + 0.2 * (o.airports > 0 ? 1 : 0) + 0.2 * nRoad(Math.log1p(o.highwaySegments)) + 0.3 * portScore : 0.4 + 0.3 * portScore;
  const industrialScore = o ? nInd(Math.log1p(o.industrialAreas)) : 0.4;
  return [d.id, {
    climate: c, osm: o, nearestPort: port,
    climateScore: +climateScore.toFixed(2), connectivityScore: +connectivityScore.toFixed(2), industrialScore: +industrialScore.toFixed(2),
    power: POWER_EST[d.state] ?? 0.8,
    provenance: { climate: c ? 'public' : 'estimated', connectivity: o ? 'public' : 'estimated', industrial: o ? 'public' : 'estimated', power: 'estimated' },
  } as DistrictMetrics];
}));

export const ALL_DISTRICTS: District[] = base.map((d) => ({
  ...d,
  climateRisk: METRICS[d.id].climateScore,
  power: METRICS[d.id].power,
  connectivity: +METRICS[d.id].connectivityScore.toFixed(2),
}));
