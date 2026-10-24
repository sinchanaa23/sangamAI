// International sea/air lanes and domestic multimodal lanes, each broken into legs (a route roadmap).
// Waypoints, ports and documents are real. Logistics performance comes from the World Bank LPI (real).
// Supplier prices, freight rates, port charges and quality figures are indicative or simulated and labelled so.
import { bom, buyer } from './data';
import { district, isImported } from './engine';
import { ROAD_FACTOR, ROAD_RS_PER_TONNE_KM } from './freight';
import { fxRate, lpi } from './realdata';
import type { Chokepoint, Scenario } from './scenario';
import type { District, Provenance } from './types';

export type LonLat = [number, number];

const CHENNAI: LonLat = [80.35, 13.1];
const SEA_KM_PER_DAY = 700;
/** Rupees per US dollar: the ECB reference rate in src/real/fx.json, the same one every screen and the agents use */
const USD_INR = fxRate('USD').inrPer;
const BASE_DUTY = 0.1; // indicative basic customs duty on today's imports
// Indicative charges per 40-ft container, rupees
const THC_ORIGIN = 18000, THC_DEST = 16000, CHA_FEE = 9000, DOCS = 3500, FIRST_MILE = 12000, TRUCK_PER_KM = 65;
const INSURANCE = 0.003, CARRYING_RATE = 0.12;

/** Baseline risk of each chokepoint (0-1). The live page can raise these from news and hazard signals. */
export const RISK_PRIOR: Record<Chokepoint, number> = { taiwan: 0.35, malacca: 0.15, redSea: 0.6, hormuz: 0.4 };

export function km(a: LonLat, b: LonLat): number {
  const r = 6371, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
export const pathKm = (p: LonLat[]) => p.slice(1).reduce((s, pt, i) => s + km(p[i], pt), 0);

// ---------- Sea lane building blocks ----------
const SCS_VIA_MALACCA: LonLat[] = [[109.5, 10], [107.5, 7], [104.2, 1.25], [100.5, 3.2], [97.5, 5.6], [92, 8], [85, 11], CHENNAI];
const SCS_VIA_SUNDA: LonLat[] = [[109.5, 10], [109, 5], [108.8, -1.5], [106.8, -4.8], [105.8, -6.1], [100, -4], [90, 4], [85, 10], CHENNAI];
const LUZON_TO_SCS: LonLat[] = [[122.8, 22.5], [121, 20.6], [116.5, 19], [112.5, 16], [109.5, 10]];
const ARABIAN_TO_CHENNAI: LonLat[] = [[76.5, 6.5], [80.6, 5.5], [82.2, 7.6], [81.6, 11], CHENNAI];

interface Segment {
  path: LonLat[];
  via?: Chokepoint;
  /** path used when `via` is closed; none means the lane is blocked */
  alt?: LonLat[];
  altNote?: string;
}

export interface IntlLane {
  id: string;
  origin: string;
  port: string;
  country: string;
  iso3: string;
  region: string;
  originPoint: LonLat;
  mode: 'sea' | 'air';
  segments: Segment[];
  hub?: string;
  priceIndex: number;
  /** duty difference vs today's source, percentage points */
  dutyDelta: number;
  agreement?: string;
  freightUsdPerFeu: number;
  /** simulated typical defect rate of suppliers in this origin, parts per million */
  defectPpm: number;
}

export const LANES: IntlLane[] = [
  {
    id: 'cn-sea', origin: 'Shanghai', port: 'Port of Shanghai (Yangshan)', country: 'China', iso3: 'CHN', region: 'Yangtze River Delta', originPoint: [121.8, 31.0], mode: 'sea', priceIndex: 1, dutyDelta: 0, freightUsdPerFeu: 1400, defectPpm: 800,
    segments: [
      { via: 'taiwan', path: [[121.8, 31.0], [123, 28.5], [119.5, 24], [116.5, 21.5], [112.5, 16], [109.5, 10]], alt: [[121.8, 31.0], [124, 27], ...LUZON_TO_SCS], altNote: 'east of Taiwan' },
      { via: 'malacca', path: SCS_VIA_MALACCA, alt: SCS_VIA_SUNDA, altNote: 'via Sunda Strait' },
    ],
  },
  {
    id: 'cn-air', origin: 'Shanghai (air)', port: 'Shanghai Pudong airport (PVG)', country: 'China', iso3: 'CHN', region: 'Yangtze River Delta', originPoint: [121.8, 31.15], mode: 'air', priceIndex: 1, dutyDelta: 0, freightUsdPerFeu: 0, defectPpm: 800,
    segments: [{ path: [[121.8, 31.15], [80.17, 12.99]] }],
  },
  {
    id: 'vn-sea', origin: 'Hai Phong', port: 'Port of Hai Phong', country: 'Vietnam', iso3: 'VNM', region: 'Red River Delta', originPoint: [106.75, 20.8], mode: 'sea', priceIndex: 1.06, dutyDelta: -5, agreement: 'ASEAN–India FTA', freightUsdPerFeu: 1300, defectPpm: 1200,
    segments: [
      { path: [[106.75, 20.8], [107.6, 19.2], [107.8, 17], [109.5, 12.5], [109.5, 10]] },
      { via: 'malacca', path: SCS_VIA_MALACCA, alt: SCS_VIA_SUNDA, altNote: 'via Sunda Strait' },
    ],
  },
  {
    id: 'th-sea', origin: 'Laem Chabang', port: 'Laem Chabang Port', country: 'Thailand', iso3: 'THA', region: 'Eastern Economic Corridor', originPoint: [100.9, 13.1], mode: 'sea', priceIndex: 1.08, dutyDelta: -5, agreement: 'ASEAN–India FTA', freightUsdPerFeu: 1100, defectPpm: 900,
    segments: [
      { path: [[100.9, 13.1], [101.3, 11.5], [102.5, 8.5], [104, 4.5]] },
      { via: 'malacca', path: [[104, 4.5], [104.2, 1.25], [100.5, 3.2], [97.5, 5.6], [92, 8], [85, 11], CHENNAI], alt: [[104, 4.5], [106, 0.5], [105.9, -2.6], [106.8, -4.8], [105.8, -6.1], [100, -4], [90, 4], [85, 10], CHENNAI], altNote: 'via Sunda Strait' },
    ],
  },
  {
    id: 'kr-sea', origin: 'Busan', port: 'Port of Busan', country: 'South Korea', iso3: 'KOR', region: 'Gyeongsang', originPoint: [129.05, 35.1], mode: 'sea', priceIndex: 1.15, dutyDelta: -4, agreement: 'India–Korea CEPA', freightUsdPerFeu: 1600, defectPpm: 400, hub: 'Singapore',
    segments: [
      { path: [[129.05, 35.1], [128.5, 33.8], [126, 30], [124.5, 26], ...LUZON_TO_SCS] },
      { via: 'malacca', path: SCS_VIA_MALACCA, alt: SCS_VIA_SUNDA, altNote: 'via Sunda Strait' },
    ],
  },
  {
    id: 'jp-sea', origin: 'Yokohama', port: 'Port of Yokohama', country: 'Japan', iso3: 'JPN', region: 'Kanto', originPoint: [139.65, 35.4], mode: 'sea', priceIndex: 1.22, dutyDelta: -4, agreement: 'India–Japan CEPA', freightUsdPerFeu: 1800, defectPpm: 250, hub: 'Singapore',
    segments: [
      { path: [[139.65, 35.4], [139.8, 34.6], [135.5, 33], [131.5, 31], [126, 26.5], ...LUZON_TO_SCS] },
      { via: 'malacca', path: SCS_VIA_MALACCA, alt: SCS_VIA_SUNDA, altNote: 'via Sunda Strait' },
    ],
  },
  {
    id: 'ae-sea', origin: 'Jebel Ali', port: 'Jebel Ali Port', country: 'UAE', iso3: 'ARE', region: 'Dubai free zones', originPoint: [55.0, 25.05], mode: 'sea', priceIndex: 1.18, dutyDelta: -5, agreement: 'India–UAE CEPA', freightUsdPerFeu: 900, defectPpm: 1000,
    segments: [
      { via: 'hormuz', path: [[55.0, 25.05], [55.6, 25.8], [56.4, 26.4], [57.5, 25.2], [59, 24], [62, 21.5]], alt: [[56.4, 25.15], [58, 24.2], [62, 21.5]], altNote: 'trucked to Fujairah' },
      { path: [[62, 21.5], [72, 12], ...ARABIAN_TO_CHENNAI] },
    ],
  },
  {
    id: 'eu-sea', origin: 'Rotterdam', port: 'Port of Rotterdam', country: 'Netherlands (EU)', iso3: 'NLD', region: 'Northwest Europe', originPoint: [4.05, 51.95], mode: 'sea', priceIndex: 1.3, dutyDelta: 0, freightUsdPerFeu: 2200, defectPpm: 300, hub: 'Colombo',
    segments: [
      { path: [[4.05, 51.95], [2, 51.2], [-1.5, 50.2], [-5.8, 48.6], [-9.8, 43.2], [-9.8, 38.5]] },
      {
        via: 'redSea',
        path: [[-9.8, 38.5], [-5.6, 35.95], [0, 37.2], [9.5, 37.5], [12.3, 36.6], [20, 35], [28, 33.6], [32.3, 31.4], [32.55, 29.9], [34.5, 27], [38.5, 20.5], [43.4, 12.6], [48, 13], [52, 12.5], [65, 10], ...ARABIAN_TO_CHENNAI],
        alt: [[-9.8, 38.5], [-16, 30], [-19.5, 16], [-12, 2], [3, -15], [12, -28], [18.5, -35.3], [28, -36], [42, -30], [55, -20], [68, -5], [77, 3], [80.6, 5.5], [82.2, 7.6], [81.6, 11], CHENNAI],
        altNote: 'around the Cape of Good Hope',
      },
    ],
  },
];

// ---------- What is imported today ----------

export const importedCost = () => bom.filter(isImported).reduce((s, l) => s + l.cost, 0);
export const importedKg = () => bom.filter(isImported).reduce((s, l) => s + l.weightKg, 0);
export const domesticCost = () => bom.filter((l) => !isImported(l)).reduce((s, l) => s + l.cost, 0);

/** The lane today's imports use: the lane whose country supplies the most imported value. */
export function todayLane(): IntlLane {
  const byCountry = new Map<string, number>();
  bom.filter(isImported).forEach((l) => byCountry.set(l.importedFrom, (byCountry.get(l.importedFrom) ?? 0) + l.cost));
  const top = [...byCountry.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return LANES.find((l) => l.mode === 'sea' && top && l.country.startsWith(top)) ?? LANES[0];
}

// ---------- Legs ----------

export interface Leg {
  id: string;
  title: string;
  who: string;
  place: string;
  mode: 'make' | 'road' | 'rail' | 'sea' | 'air' | 'port' | 'customs' | 'check';
  days: number;
  p90: number;
  cost: number;
  reliability: number;
  damagePct: number;
  co2Kg: number;
  documents: string[];
  risks: string[];
  src: Provenance;
  note?: string;
}

export interface LaneResult {
  lane: IntlLane;
  status: 'normal' | 'rerouted' | 'blocked';
  note?: string;
  paths: LonLat[][];
  distanceKm: number;
  days: number;
  p90: number;
  costPerUnit: number;
  reliability: number;
  risk: number;
  chokepoints: Chokepoint[];
  legs: Leg[];
  co2Kg: number;
  lpi: number | null;
}

const lpiOf = (iso3: string) => lpi(iso3)?.score ?? 3.2;
const p90Total = (legs: Leg[]) => Math.round(legs.reduce((s, l) => s + l.days, 0) + Math.sqrt(legs.reduce((s, l) => s + (l.p90 - l.days) ** 2, 0)));

function goodsValue() {
  // Calibrate so today's lane in a calm scenario reproduces today's imported cost
  const per = buyer.unitsPerContainer;
  const today = todayLane();
  const nonGoods = (today.freightUsdPerFeu * USD_INR + THC_ORIGIN + THC_DEST + CHA_FEE + DOCS + FIRST_MILE + TRUCK_PER_KM * 260) / per;
  const carrying = CARRYING_RATE * (buyer.importLeadDays / 365);
  return Math.max(1, (importedCost() - nonGoods) / (1 + BASE_DUTY + INSURANCE + carrying + (today.defectPpm / 1e6) * 3));
}

export function evaluateLane(lane: IntlLane, s: Scenario, risk: Record<Chokepoint, number> = RISK_PRIOR): LaneResult {
  const paths: LonLat[][] = [];
  const used: Chokepoint[] = [];
  const notes: string[] = [];
  let status: LaneResult['status'] = 'normal';
  let r = 0;
  for (const seg of lane.segments) {
    if (seg.via && s.closed[seg.via]) {
      if (!seg.alt) { status = 'blocked'; paths.push(seg.path); continue; }
      status = status === 'blocked' ? 'blocked' : 'rerouted';
      if (seg.altNote) notes.push(seg.altNote);
      paths.push(seg.alt);
      r += 0.05;
    } else {
      paths.push(seg.path);
      if (seg.via) { used.push(seg.via); r += risk[seg.via]; }
    }
  }
  const baseKm = lane.segments.reduce((sum, seg) => sum + pathKm(seg.path), 0);
  const distanceKm = paths.reduce((sum, p) => sum + pathKm(p), 0);
  const fx = USD_INR * (1 + s.fxPct / 100);
  const per = buyer.unitsPerContainer;
  const L = lpiOf(lane.iso3);
  const isToday = lane.country === todayLane().country;
  const goods = goodsValue() * lane.priceIndex * (1 + s.fxPct / 100);
  const plant = district(buyer.plantDistrictId);
  const inlandKm = Math.round(km(CHENNAI, [plant.lon, plant.lat]) * 1.3);
  const kg = importedKg();
  const delay = isToday && lane.mode === 'sea' ? s.delayWeeks * 7 : 0;
  const portDwell = (q: number) => +(1.5 + (4.2 - q) * 1.6).toFixed(1);
  const legs: Leg[] = [];

  legs.push({
    id: 'make', title: 'Supplier factory', who: `Contract manufacturers, ${lane.region}`, place: lane.country, mode: 'make',
    days: 10, p90: 14, cost: goods, reliability: 0.9, damagePct: lane.defectPpm / 10000, co2Kg: 0,
    documents: ['Purchase order', 'Commercial invoice', 'Packing list'], risks: isToday && s.duty > 0 ? ['Trade friction with this country raises duty'] : [],
    src: 'simulated', note: `Typical defect rate ${lane.defectPpm} ppm (simulated)`,
  });
  if (lane.mode === 'air') {
    const air = kg * 3.0 * fx * s.freightX ** 0.3;
    legs.push(
      { id: 'first', title: 'Truck to airport', who: 'Freight forwarder', place: lane.port, mode: 'road', days: 1, p90: 2, cost: 4 * kg, reliability: 0.95, damagePct: 0.05, co2Kg: (kg / 1000) * 50 * 0.062, documents: ['Air waybill'], risks: [], src: 'estimated' },
      { id: 'air', title: 'Air freight', who: 'Scheduled freighter or belly cargo', place: `${lane.port} to Chennai air cargo complex`, mode: 'air', days: 1, p90: 3, cost: air, reliability: 0.9, damagePct: 0.05, co2Kg: kg * distanceKm * 0.0006, documents: ['Air waybill', 'Dangerous goods declaration if batteries'], risks: ['Capacity tight in peak season'], src: 'estimated', note: 'About $3 per kg (indicative)' },
      { id: 'customs', title: 'Customs clearance', who: 'Customs broker (CHA), ICEGATE filing', place: 'Chennai air cargo complex', mode: 'customs', days: 1, p90: 3, cost: goods * (BASE_DUTY + lane.dutyDelta / 100 + (isToday ? s.duty / 100 : 0) + INSURANCE) + CHA_FEE / per, reliability: 0.9, damagePct: 0, co2Kg: 0, documents: ['Bill of Entry', 'Commercial invoice', 'Packing list'], risks: ['Physical examination by customs'], src: 'estimated' },
    );
  } else {
    const fr = (lane.freightUsdPerFeu * s.freightX * fx / per) * (distanceKm / baseKm);
    const seaDays = Math.round(distanceKm / SEA_KM_PER_DAY);
    const sched = Math.max(0.35, Math.min(0.85, 0.4 + (L - 2.5) * 0.2));
    legs.push(
      { id: 'first', title: 'Truck to port', who: 'Freight forwarder (pick-up and export packing)', place: lane.port, mode: 'road', days: 1, p90: 2, cost: FIRST_MILE / per, reliability: 0.95, damagePct: 0.05, co2Kg: (kg / 1000) * 60 * 0.062, documents: ['Shipping instruction'], risks: [], src: 'estimated' },
      { id: 'oport', title: 'Origin port and export customs', who: 'Port terminal and origin customs', place: lane.port, mode: 'port', days: portDwell(L), p90: portDwell(L) * 2, cost: (THC_ORIGIN + DOCS / 2) / per, reliability: Math.min(0.95, L / 4.5), damagePct: 0.02, co2Kg: 0, documents: ['Export declaration', 'Bill of lading'], risks: [], src: 'estimated', note: `${lane.country} logistics performance ${L.toFixed(1)}/5 (World Bank)` },
      {
        id: 'ocean', title: 'Ocean freight', who: lane.hub ? `Mainline service with transshipment at ${lane.hub}` : 'Direct mainline service', place: `${lane.port} to Chennai, ${Math.round(distanceKm).toLocaleString('en-IN')} km`, mode: 'sea',
        days: seaDays + (lane.hub ? 3 : 0) + delay, p90: Math.round((seaDays + (lane.hub ? 3 : 0) + delay) * 1.35 + 4), cost: fr, reliability: sched, damagePct: 0.05,
        co2Kg: (kg / 1000) * distanceKm * 0.012, documents: ['Bill of lading', 'Insurance certificate'],
        risks: [...used.map((c) => `Passes ${({ taiwan: 'Taiwan Strait', malacca: 'Strait of Malacca', redSea: 'Red Sea and Suez', hormuz: 'Strait of Hormuz' } as const)[c]}`), ...(notes.length ? [`Rerouted ${notes.join(' and ')}`] : []), ...(delay ? [`${s.delayWeeks}-week delay in your scenario`] : [])],
        src: 'estimated', note: `Freight about $${Math.round(lane.freightUsdPerFeu * s.freightX).toLocaleString('en-IN')} per 40-ft container (indicative)`,
      },
      { id: 'dport', title: 'Chennai port', who: 'Container terminal, Chennai Port', place: 'Chennai', mode: 'port', days: 2.5, p90: 5, cost: THC_DEST / per, reliability: 0.85, damagePct: 0.02, co2Kg: 0, documents: ['Delivery order'], risks: ['Congestion in north-east monsoon (Oct-Dec)'], src: 'estimated' },
      {
        id: 'customs', title: 'Customs clearance', who: 'Customs broker (CHA), ICEGATE filing', place: 'Chennai Custom House', mode: 'customs', days: 1.5, p90: 4,
        cost: goods * (BASE_DUTY + lane.dutyDelta / 100 + (isToday ? s.duty / 100 : 0)) + goods * INSURANCE + (CHA_FEE + DOCS / 2) / per,
        reliability: 0.88, damagePct: 0, co2Kg: 0,
        documents: ['Bill of Entry', 'Commercial invoice', 'Packing list', 'Bill of lading', ...(lane.agreement ? [`Certificate of origin (${lane.agreement})`] : [])],
        risks: ['Physical examination by customs', ...(lane.agreement ? ['Duty benefit lost if origin rules are not met'] : [])],
        src: 'estimated', note: `Duty ${Math.round((BASE_DUTY + lane.dutyDelta / 100 + (isToday ? s.duty / 100 : 0)) * 100)}% (indicative), plus insurance ${INSURANCE * 100}%`,
      },
    );
  }
  legs.push(
    { id: 'inland', title: 'Truck to plant', who: 'Contract trucker, 40-ft trailer', place: `Chennai to ${plant.name}, ${inlandKm} km`, mode: 'road', days: 1, p90: 2, cost: (TRUCK_PER_KM * inlandKm) / per, reliability: 0.93, damagePct: 0.05, co2Kg: (kg / 1000) * inlandKm * 0.062, documents: ['E-way bill', 'Lorry receipt'], risks: [], src: 'estimated' },
    { id: 'check', title: 'Receiving inspection', who: 'Your quality team', place: plant.name, mode: 'check', days: 1, p90: 2, cost: goods * (lane.defectPpm / 1e6) * 3, reliability: 1, damagePct: 0, co2Kg: 0, documents: ['Goods receipt note'], risks: [], src: 'estimated', note: 'Cost of defects: rework or scrap at 3x part value' },
  );
  const days = Math.round(legs.reduce((s2, l) => s2 + l.days, 0));
  const carrying = goods * CARRYING_RATE * (days / 365);
  legs.push({ id: 'stock', title: 'Inventory in transit', who: 'Your working capital', place: `${days} days on the way`, mode: 'check', days: 0, p90: 0, cost: carrying, reliability: 1, damagePct: 0, co2Kg: 0, documents: [], risks: [], src: 'estimated', note: '12% a year cost of capital' });

  const reliability = legs.reduce((p, l) => p * (l.reliability > 0.99 ? 1 : 0.6 + 0.4 * l.reliability), 1);
  return {
    lane, status, note: notes.join(' and ') || undefined, paths, distanceKm,
    days, p90: p90Total(legs), costPerUnit: legs.reduce((s2, l) => s2 + l.cost, 0),
    reliability, risk: Math.min(1, r), chokepoints: used, legs, co2Kg: legs.reduce((s2, l) => s2 + l.co2Kg, 0), lpi: lpi(lane.iso3)?.score ?? null,
  };
}

export const evaluateLanes = (s: Scenario, risk?: Record<Chokepoint, number>) => LANES.map((l) => evaluateLane(l, s, risk));

// ---------- Domestic multimodal lanes ----------

export type Mode = 'road' | 'rail' | 'coastal';

const ICDS: { name: string; at: LonLat }[] = [
  { name: 'Sabarmati ICD, Ahmedabad', at: [72.6, 23.05] },
  { name: 'JNPT rail terminal', at: [73.0, 18.95] },
  { name: 'Talegaon ICD, Pune', at: [73.7, 18.72] },
  { name: 'Tughlakabad ICD, Delhi', at: [77.28, 28.5] },
  { name: 'Nagpur MIHAN ICD', at: [79.05, 21.1] },
  { name: 'Dadri ICD', at: [77.55, 28.55] },
  { name: 'Kolkata (Shalimar) terminal', at: [88.3, 22.57] },
  { name: 'Whitefield ICD, Bengaluru', at: [77.75, 12.98] },
  { name: 'Irugur ICD, Coimbatore', at: [77.08, 11.02] },
];
const WEST_PORTS: { name: string; at: LonLat }[] = [
  { name: 'Mundra', at: [69.7, 22.75] },
  { name: 'Pipavav', at: [71.5, 20.9] },
  { name: 'JNPT', at: [72.95, 18.95] },
];
const COAST_TO_CHENNAI: LonLat[] = [[72.3, 17], [73.2, 14.5], [74.2, 11.5], [75.6, 8.9], [77.5, 7.4], [80.2, 5.7], [82, 7.6], [81.6, 11], CHENNAI];

const RATE = { road: ROAD_RS_PER_TONNE_KM, rail: 1.6, coastal: 0.9 }; // rupees per tonne-km (road: the one rate in freight.ts)
const TERMINAL_RS_PER_T = { rail: 600, coastal: 900 };
const CO2_KG_PER_TKM = { road: 0.062, rail: 0.022, coastal: 0.015 };

export interface DomesticLane {
  mode: Mode;
  via?: string;
  path: LonLat[];
  km: number;
  days: number;
  /** rupees per tonne */
  costPerT: number;
  co2PerT: number;
  /** the movement broken into legs (per tonne figures) */
  legs: Leg[];
}

const ll = (d: District): LonLat => [d.lon, d.lat];
const roadDays = (k: number) => Math.max(1, Math.ceil(k / 450));

export function domesticLanes(from: District, to?: District): DomesticLane[] {
  const plant = to ?? district(buyer.plantDistrictId);
  const o = ll(from), p = ll(plant);
  const roadKm = km(o, p) * ROAD_FACTOR;
  const roadLeg = (title: string, place: string, k: number): Leg => ({ id: `road-${title}`, title, who: 'Contract trucker (full truck load)', place: `${place}, ${Math.round(k)} km`, mode: 'road', days: roadDays(k), p90: roadDays(k) + 1, cost: k * RATE.road, reliability: 0.9, damagePct: 0.08, co2Kg: k * CO2_KG_PER_TKM.road, documents: ['E-way bill', 'Lorry receipt'], risks: k > 800 ? ['Long haul: driver hours and checkpoints'] : [], src: 'estimated' });
  const out: DomesticLane[] = [{
    mode: 'road', path: [o, p], km: roadKm, days: roadDays(roadKm),
    costPerT: roadKm * RATE.road, co2PerT: roadKm * CO2_KG_PER_TKM.road,
    legs: [roadLeg('Truck to plant', `${from.name} to ${plant.name}`, roadKm)],
  }];

  const near = (list: { name: string; at: LonLat }[], pt: LonLat) => list.map((i) => ({ ...i, d: km(pt, i.at) * ROAD_FACTOR })).sort((a, b) => a.d - b.d)[0];
  const icd = near(ICDS, o);
  const destIcd = near(ICDS, p);
  if (roadKm > 600 && icd.d < 200 && destIcd.d < 120 && icd.name !== destIcd.name) {
    const railKm = km(icd.at, destIcd.at) * 1.2;
    const legs: Leg[] = [
      roadLeg('Truck to rail terminal', `${from.name} to ${icd.name}`, icd.d),
      { id: 'rail', title: 'Container train', who: 'Container rail operator', place: `${icd.name} to ${destIcd.name}, ${Math.round(railKm)} km`, mode: 'rail', days: Math.ceil(railKm / 550) + 2, p90: Math.ceil(railKm / 550) + 4, cost: railKm * RATE.rail + 2 * TERMINAL_RS_PER_T.rail, reliability: 0.82, damagePct: 0.03, co2Kg: railKm * CO2_KG_PER_TKM.rail, documents: ['Railway receipt', 'E-way bill'], risks: ['Rake availability'], src: 'estimated' },
      roadLeg('Truck to plant', `${destIcd.name} to ${plant.name}`, destIcd.d),
    ];
    out.push({
      mode: 'rail', via: `${icd.name} to ${destIcd.name}`, path: [o, icd.at, destIcd.at, p], km: icd.d + railKm + destIcd.d,
      days: legs.reduce((s, l) => s + l.days, 0), costPerT: legs.reduce((s, l) => s + l.cost, 0), co2PerT: legs.reduce((s, l) => s + l.co2Kg, 0), legs,
    });
  }

  const port = near(WEST_PORTS, o);
  if (port.d < 220 && plant.lon > 76 && plant.lat < 16) {
    const sea = [port.at, ...COAST_TO_CHENNAI];
    const seaKm = pathKm(sea);
    const lastKm = km(CHENNAI, p) * ROAD_FACTOR;
    const legs: Leg[] = [
      roadLeg('Truck to port', `${from.name} to ${port.name}`, port.d),
      { id: 'coastal', title: 'Coastal ship', who: 'Coastal container service', place: `${port.name} to Chennai, ${Math.round(seaKm)} km around Kanyakumari`, mode: 'sea', days: Math.ceil(seaKm / 450) + 4, p90: Math.ceil(seaKm / 450) + 8, cost: seaKm * RATE.coastal + 2 * TERMINAL_RS_PER_T.coastal, reliability: 0.75, damagePct: 0.04, co2Kg: seaKm * CO2_KG_PER_TKM.coastal, documents: ['Coastal bill of lading', 'E-way bill'], risks: ['Monsoon weather windows'], src: 'estimated' },
      roadLeg('Truck to plant', `Chennai to ${plant.name}`, lastKm),
    ];
    out.push({
      mode: 'coastal', via: `${port.name} to Chennai`, path: [o, ...sea, p], km: port.d + seaKm + lastKm,
      days: legs.reduce((s, l) => s + l.days, 0), costPerT: legs.reduce((s, l) => s + l.cost, 0), co2PerT: legs.reduce((s, l) => s + l.co2Kg, 0), legs,
    });
  }
  return out;
}

/** Imports today land at Chennai port and travel by road to the plant. */
export function importInlandLane(): { path: LonLat[] } {
  const p = ll(district(buyer.plantDistrictId));
  return { path: [CHENNAI, p] };
}

export const CHENNAI_PORT = CHENNAI;

// ---------- Export lanes (global buyers) ----------
// The same sea lanes run in reverse: an Indian supplier's goods leave from Chennai for the buyer's port.
// Freight is assumed to cost the same in both directions; every figure here is indicative and tagged estimated.

export { USD_INR };

export interface ExportRoute {
  lane: IntlLane;
  paths: LonLat[][];
  distanceKm: number;
  days: number;
  legs: Leg[];
  /** rupees per unit, before the buyer's own import duty */
  costPerUnit: number;
}

export function exportRoute(lane: IntlLane, from: District, unitPriceInr: number, weightKg: number, dutyPct: number): ExportRoute {
  const per = buyer.unitsPerContainer;
  const paths = [...lane.segments].reverse().map((seg) => [...seg.path].reverse());
  const seaKm = paths.reduce((s, p) => s + pathKm(p), 0);
  const roadKm = Math.round(km([from.lon, from.lat], CHENNAI) * 1.3);
  const seaDays = Math.round(seaKm / SEA_KM_PER_DAY) + (lane.hub ? 3 : 0);
  const L = lpiOf(lane.iso3);
  const legs: Leg[] = [
    { id: 'first', title: 'Truck to port', who: 'Freight forwarder (export packing and pick-up)', place: `${from.name} to Chennai, ${roadKm} km`, mode: 'road', days: Math.max(1, Math.ceil(roadKm / 450)), p90: Math.ceil(roadKm / 450) + 1, cost: (TRUCK_PER_KM * roadKm) / per, reliability: 0.93, damagePct: 0.05, co2Kg: (weightKg / 1000) * roadKm * 0.062, documents: ['E-way bill', 'Lorry receipt'], risks: [], src: 'estimated' },
    { id: 'oport', title: 'Chennai port and Indian export customs', who: 'Customs broker (CHA), ICEGATE shipping bill', place: 'Chennai', mode: 'customs', days: 2.5, p90: 5, cost: (THC_DEST + CHA_FEE + DOCS) / per, reliability: 0.85, damagePct: 0.02, co2Kg: 0, documents: ['Shipping bill', 'Commercial invoice', 'Packing list', 'Certificate of origin'], risks: ['Congestion in north-east monsoon (Oct-Dec)'], src: 'estimated' },
    { id: 'ocean', title: 'Ocean freight', who: lane.hub ? `Mainline service with transshipment at ${lane.hub}` : 'Direct mainline service', place: `Chennai to ${lane.port}, ${Math.round(seaKm).toLocaleString('en-IN')} km`, mode: 'sea', days: seaDays, p90: Math.round(seaDays * 1.35 + 4), cost: (lane.freightUsdPerFeu * USD_INR) / per, reliability: Math.max(0.35, Math.min(0.85, 0.4 + (L - 2.5) * 0.2)), damagePct: 0.05, co2Kg: (weightKg / 1000) * seaKm * 0.012, documents: ['Bill of lading', 'Insurance certificate'], risks: lane.segments.flatMap((s) => (s.via ? [`Passes ${({ taiwan: 'Taiwan Strait', malacca: 'Strait of Malacca', redSea: 'Red Sea and Suez', hormuz: 'Strait of Hormuz' } as const)[s.via]}`] : [])), src: 'estimated', note: `About $${lane.freightUsdPerFeu.toLocaleString('en-IN')} per 40-ft container, assumed the same as the inbound rate` },
    { id: 'dport', title: `${lane.port} and import customs`, who: 'Destination terminal and customs broker', place: lane.country, mode: 'customs', days: portDwell(L), p90: portDwell(L) * 2, cost: THC_ORIGIN / per + unitPriceInr * (dutyPct / 100 + INSURANCE), reliability: Math.min(0.95, L / 4.5), damagePct: 0.02, co2Kg: 0, documents: ['Import declaration', 'Commercial invoice', 'Certificate of origin'], risks: [], src: 'estimated', note: `Your import duty ${dutyPct}% (you set this) plus insurance ${INSURANCE * 100}%; ${lane.country} logistics performance ${L.toFixed(1)}/5 (World Bank)` },
  ];
  const days = Math.round(legs.reduce((s, l) => s + l.days, 0));
  legs.push({ id: 'stock', title: 'Inventory in transit', who: 'Your working capital', place: `${days} days on the way`, mode: 'check', days: 0, p90: 0, cost: unitPriceInr * CARRYING_RATE * (days / 365), reliability: 1, damagePct: 0, co2Kg: 0, documents: [], risks: [], src: 'estimated', note: '12% a year cost of capital' });
  return { lane, paths, distanceKm: roadKm + seaKm, days, legs, costPerUnit: legs.reduce((s, l) => s + l.cost, 0) };
}

function portDwell(lpiScore: number) { return +(1.5 + (4.2 - lpiScore) * 1.6).toFixed(1); }
