// International sea/air lanes and domestic multimodal lanes.
// Waypoints follow real shipping lanes; prices, freight rates and risk priors are simulated.
import { buyer } from './data';
import { district } from './engine';
import type { Chokepoint, Scenario } from './scenario';
import type { District } from './types';

export type LonLat = [number, number];

const CHENNAI: LonLat = [80.35, 13.1];
const SEA_KM_PER_DAY = 700;
const HARNESS_PER_FEU = 3500;
const USD_INR = 94.5;
/** Pre-duty value of imported parts per harness, net of freight and inland haulage. */
const GOODS_VALUE = 3898;
const INLAND_RS = 12;

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
  country: string;
  originPoint: LonLat;
  mode: 'sea' | 'air';
  segments: Segment[];
  priceIndex: number;
  /** duty difference vs today's source, percentage points */
  dutyDelta: number;
  agreement?: string;
  freightUsdPerFeu: number;
  /** goods from today's source region: extra duty and delay in the scenario apply */
  todaySource: boolean;
}

export const LANES: IntlLane[] = [
  {
    id: 'cn-sea', origin: 'Shanghai', country: 'China', originPoint: [121.8, 31.0], mode: 'sea', priceIndex: 1, dutyDelta: 0, freightUsdPerFeu: 1400, todaySource: true,
    segments: [
      { via: 'taiwan', path: [[121.8, 31.0], [123, 28.5], [119.5, 24], [116.5, 21.5], [112.5, 16], [109.5, 10]], alt: [[121.8, 31.0], [124, 27], ...LUZON_TO_SCS], altNote: 'east of Taiwan' },
      { via: 'malacca', path: SCS_VIA_MALACCA, alt: SCS_VIA_SUNDA, altNote: 'via Sunda Strait' },
    ],
  },
  {
    id: 'cn-air', origin: 'Shanghai (air)', country: 'China', originPoint: [121.8, 31.15], mode: 'air', priceIndex: 1, dutyDelta: 0, freightUsdPerFeu: 0, todaySource: true,
    segments: [{ path: [[121.8, 31.15], [80.17, 12.99]] }],
  },
  {
    id: 'vn-sea', origin: 'Hai Phong', country: 'Vietnam', originPoint: [106.75, 20.8], mode: 'sea', priceIndex: 1.06, dutyDelta: -5, agreement: 'ASEAN–India FTA', freightUsdPerFeu: 1300, todaySource: false,
    segments: [
      { path: [[106.75, 20.8], [107.6, 19.2], [107.8, 17], [109.5, 12.5], [109.5, 10]] },
      { via: 'malacca', path: SCS_VIA_MALACCA, alt: SCS_VIA_SUNDA, altNote: 'via Sunda Strait' },
    ],
  },
  {
    id: 'th-sea', origin: 'Laem Chabang', country: 'Thailand', originPoint: [100.9, 13.1], mode: 'sea', priceIndex: 1.08, dutyDelta: -5, agreement: 'ASEAN–India FTA', freightUsdPerFeu: 1100, todaySource: false,
    segments: [
      { path: [[100.9, 13.1], [101.3, 11.5], [102.5, 8.5], [104, 4.5]] },
      { via: 'malacca', path: [[104, 4.5], [104.2, 1.25], [100.5, 3.2], [97.5, 5.6], [92, 8], [85, 11], CHENNAI], alt: [[104, 4.5], [106, 0.5], [105.9, -2.6], [106.8, -4.8], [105.8, -6.1], [100, -4], [90, 4], [85, 10], CHENNAI], altNote: 'via Sunda Strait' },
    ],
  },
  {
    id: 'kr-sea', origin: 'Busan', country: 'South Korea', originPoint: [129.05, 35.1], mode: 'sea', priceIndex: 1.15, dutyDelta: -4, agreement: 'India–Korea CEPA', freightUsdPerFeu: 1600, todaySource: false,
    segments: [
      { path: [[129.05, 35.1], [128.5, 33.8], [126, 30], [124.5, 26], ...LUZON_TO_SCS] },
      { via: 'malacca', path: SCS_VIA_MALACCA, alt: SCS_VIA_SUNDA, altNote: 'via Sunda Strait' },
    ],
  },
  {
    id: 'jp-sea', origin: 'Yokohama', country: 'Japan', originPoint: [139.65, 35.4], mode: 'sea', priceIndex: 1.22, dutyDelta: -4, agreement: 'India–Japan CEPA', freightUsdPerFeu: 1800, todaySource: false,
    segments: [
      { path: [[139.65, 35.4], [139.8, 34.6], [135.5, 33], [131.5, 31], [126, 26.5], ...LUZON_TO_SCS] },
      { via: 'malacca', path: SCS_VIA_MALACCA, alt: SCS_VIA_SUNDA, altNote: 'via Sunda Strait' },
    ],
  },
  {
    id: 'ae-sea', origin: 'Jebel Ali', country: 'UAE', originPoint: [55.0, 25.05], mode: 'sea', priceIndex: 1.18, dutyDelta: -5, agreement: 'India–UAE CEPA', freightUsdPerFeu: 900, todaySource: false,
    segments: [
      { via: 'hormuz', path: [[55.0, 25.05], [55.6, 25.8], [56.4, 26.4], [57.5, 25.2], [59, 24], [62, 21.5]], alt: [[56.4, 25.15], [58, 24.2], [62, 21.5]], altNote: 'trucked to Fujairah' },
      { path: [[62, 21.5], [72, 12], ...ARABIAN_TO_CHENNAI] },
    ],
  },
  {
    id: 'eu-sea', origin: 'Rotterdam', country: 'Netherlands (EU)', originPoint: [4.05, 51.95], mode: 'sea', priceIndex: 1.3, dutyDelta: 0, freightUsdPerFeu: 2200, todaySource: false,
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

export interface LaneResult {
  lane: IntlLane;
  status: 'normal' | 'rerouted' | 'blocked';
  note?: string;
  paths: LonLat[][];
  distanceKm: number;
  days: number;
  costPerHarness: number;
  risk: number;
  chokepoints: Chokepoint[];
}

export function evaluateLane(lane: IntlLane, s: Scenario, risk: Record<Chokepoint, number> = RISK_PRIOR): LaneResult {
  const paths: LonLat[][] = [];
  const used: Chokepoint[] = [];
  let status: LaneResult['status'] = 'normal';
  const notes: string[] = [];
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
  let days: number, freight: number;
  if (lane.mode === 'air') {
    days = 5;
    freight = 3 * 3.0 * fx * s.freightX ** 0.3; // ~3 kg per harness at about $3/kg
  } else {
    days = Math.round(distanceKm / SEA_KM_PER_DAY + 3 + 4 + 1);
    freight = ((lane.freightUsdPerFeu * s.freightX * fx) / HARNESS_PER_FEU) * (distanceKm / baseKm);
  }
  if (lane.todaySource && lane.mode === 'sea') days += s.delayWeeks * 7;
  const duty = 1 + lane.dutyDelta / 100 + (lane.todaySource ? s.duty / 100 : 0);
  const costPerHarness = GOODS_VALUE * lane.priceIndex * duty * (1 + s.fxPct / 100) + freight + INLAND_RS;
  return { lane, status, note: notes.join(' and ') || undefined, paths, distanceKm, days, costPerHarness, risk: Math.min(1, r), chokepoints: used };
}

export const evaluateLanes = (s: Scenario, risk?: Record<Chokepoint, number>) => LANES.map((l) => evaluateLane(l, s, risk));

// ---------- Domestic multimodal lanes ----------

export type Mode = 'road' | 'rail' | 'coastal';

const ICDS: { name: string; at: LonLat }[] = [
  { name: 'Sabarmati ICD, Ahmedabad', at: [72.6, 23.05] },
  { name: 'JNPT rail terminal', at: [73.0, 18.95] },
  { name: 'Talegaon ICD, Pune', at: [73.7, 18.72] },
  { name: 'Tughlakabad ICD, Delhi', at: [77.28, 28.5] },
];
const DEST_ICD: LonLat = [77.75, 12.98]; // Whitefield ICD, Bengaluru
const WEST_PORTS: { name: string; at: LonLat }[] = [
  { name: 'Mundra', at: [69.7, 22.75] },
  { name: 'Pipavav', at: [71.5, 20.9] },
  { name: 'JNPT', at: [72.95, 18.95] },
];
const COAST_TO_CHENNAI: LonLat[] = [[72.3, 17], [73.2, 14.5], [74.2, 11.5], [75.6, 8.9], [77.5, 7.4], [80.2, 5.7], [82, 7.6], [81.6, 11], CHENNAI];

const RATE = { road: 3.0, rail: 1.6, coastal: 0.9 }; // rupees per tonne-km
const TERMINAL_RS_PER_T = { rail: 600, coastal: 900 };
const CO2_KG_PER_TKM = { road: 0.062, rail: 0.022, coastal: 0.015 };
const ROAD_FACTOR = 1.3;

export interface DomesticLane {
  mode: Mode;
  via?: string;
  path: LonLat[];
  km: number;
  days: number;
  /** rupees per tonne */
  costPerT: number;
  co2PerT: number;
}

const ll = (d: District): LonLat => [d.lon, d.lat];

export function domesticLanes(from: District): DomesticLane[] {
  const plant = district(buyer.plantDistrictId);
  const o = ll(from), p = ll(plant);
  const roadKm = km(o, p) * ROAD_FACTOR;
  const out: DomesticLane[] = [{
    mode: 'road', path: [o, p], km: roadKm, days: Math.max(1, Math.ceil(roadKm / 500)),
    costPerT: roadKm * RATE.road, co2PerT: roadKm * CO2_KG_PER_TKM.road,
  }];

  const icd = ICDS.map((i) => ({ ...i, d: km(o, i.at) * ROAD_FACTOR })).sort((a, b) => a.d - b.d)[0];
  if (roadKm > 600 && icd.d < 200) {
    const railKm = km(icd.at, DEST_ICD) * 1.2;
    const lastKm = km(DEST_ICD, p) * ROAD_FACTOR;
    out.push({
      mode: 'rail', via: icd.name, path: [o, icd.at, DEST_ICD, p], km: icd.d + railKm + lastKm,
      days: Math.ceil(icd.d / 500 + 1 + railKm / 550 + 1 + lastKm / 500),
      costPerT: (icd.d + lastKm) * RATE.road + railKm * RATE.rail + 2 * TERMINAL_RS_PER_T.rail,
      co2PerT: (icd.d + lastKm) * CO2_KG_PER_TKM.road + railKm * CO2_KG_PER_TKM.rail,
    });
  }

  const port = WEST_PORTS.map((w) => ({ ...w, d: km(o, w.at) * ROAD_FACTOR })).sort((a, b) => a.d - b.d)[0];
  if (port.d < 220) {
    const sea = [port.at, ...COAST_TO_CHENNAI];
    const seaKm = pathKm(sea);
    const lastKm = km(CHENNAI, p) * ROAD_FACTOR;
    out.push({
      mode: 'coastal', via: `${port.name} to Chennai`, path: [o, ...sea, p], km: port.d + seaKm + lastKm,
      days: Math.ceil(port.d / 500 + 2 + seaKm / 450 + 2 + lastKm / 500),
      costPerT: (port.d + lastKm) * RATE.road + seaKm * RATE.coastal + 2 * TERMINAL_RS_PER_T.coastal,
      co2PerT: (port.d + lastKm) * CO2_KG_PER_TKM.road + seaKm * CO2_KG_PER_TKM.coastal,
    });
  }
  return out;
}

/** Imports today land at Chennai port and travel by road to the plant. */
export function importInlandLane(): DomesticLane {
  const p = ll(district(buyer.plantDistrictId));
  const k = km(CHENNAI, p) * ROAD_FACTOR;
  return { mode: 'road', via: 'Chennai port', path: [CHENNAI, p], km: k, days: 1, costPerT: k * RATE.road, co2PerT: k * CO2_KG_PER_TKM.road };
}

export const CHENNAI_PORT = CHENNAI;
