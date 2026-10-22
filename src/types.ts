export type OrgType = 'MSME' | 'SHG federation' | 'FPO' | 'Cooperative';

export const RURAL_TYPES: OrgType[] = ['SHG federation', 'FPO', 'Cooperative'];

/**
 * Where a number comes from. Shown next to figures so users know how far to trust them.
 * live      - fetched in the browser just now
 * public    - real public dataset, fetched by scripts/fetch-real-data.mjs
 * verified  - checked by the Sangam team against documents or orders
 * declared  - entered by the company itself, not yet checked
 * estimated - Sangam's model or assumption
 * simulated - demo data invented for the prototype
 */
export type Provenance = 'live' | 'public' | 'verified' | 'declared' | 'estimated' | 'simulated';

export type SectorId = 'ev' | 'construction' | 'agri';

export interface District {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  /** 0 (low) to 1 (high): heavy rain and heat exposure, from 10 years of real weather */
  climateRisk: number;
  /** 0 to 1: share of hours with reliable grid power (estimated, state level) */
  power: number;
  /** 0 to 1: road, rail, airport and port access (from OpenStreetMap and port distance) */
  connectivity: number;
}

/** An upstream input of a part: what the tier-1 supplier must buy. */
export interface TierInput {
  name: string;
  hs?: string;
  stage: 'raw material' | 'intermediate';
  /** how well Indian producers can cover it today (estimated) */
  indianSupply: 'strong' | 'partial' | 'weak';
  indianRegions: string;
  note: string;
}

export interface BomLine {
  id: string;
  name: string;
  /** cost per unit of the buyer's product today, rupees */
  cost: number;
  /** derived on load: share of the unit cost, % */
  sharePct: number;
  hs?: string;
  spec: string;
  importedFrom: string;
  process: string;
  requiredCerts: string[];
  /** freight weight per unit of the buyer's product, kg */
  weightKg: number;
  tiers: TierInput[];
}

export interface CertDetail {
  name: string;
  issuer: string;
  expires: string;
}

export interface SellerDetails {
  yearsInBusiness: number;
  turnoverCr: number;
  creditBand: 'A' | 'BBB' | 'BB' | 'B' | 'Not rated';
  utilisationPct: number;
  defectPpm: number;
  otifPct: number;
  completedOrders: number;
  machines: string[];
  certDetails: CertDetail[];
  languages: string[];
  about: string;
}

export interface Seller {
  id: string;
  name: string;
  type: OrgType;
  districtId: string;
  process: string;
  monthlyCapacity: number;
  certs: string[];
  /** price relative to today's pre-duty import price for the same part (1.0 = parity) */
  priceIndex: number;
  /** 0 to 1 quality score from audits or past orders */
  quality: number;
  verification: 'verified' | 'declared';
  workers: number;
  details: SellerDetails;
  /** 'simulated' for demo companies, 'onboarded' for profiles created in the app */
  origin: 'simulated' | 'onboarded';
}

export interface NewSite {
  id: string;
  name: string;
  process: string;
  districtId: string;
  capexCr: number;
  priceIndex: number;
  readyMonths: number;
  quality: number;
  rural: boolean;
  workers: number;
}

export interface Buyer {
  name: string;
  product: string;
  /** what one unit is called: harness, home, tonne */
  unitLabel: string;
  plantDistrictId: string;
  monthlyUnits: number;
  /** derived on load: landed cost per unit today, before any disruption, in rupees */
  unitCost: number;
  importLeadDays: number;
  safetyStockDays: number;
  /** units of product whose imported parts fill one 40-ft container */
  unitsPerContainer: number;
  /** contribution lost per unit not produced, rupees */
  lostContribution: number;
}

export interface Gap {
  kind: 'certification' | 'capacity';
  label: string;
  labelHi: string;
  costLakh: number;
  months: number;
  schemes: string[];
}

export type Status = 'ready' | 'potential';

export interface Option {
  lineId: string;
  sellers: Seller[];
  status: Status;
  unitCost: number;
  leadDays: number;
  quality: number;
  climateRisk: number;
  rural: boolean;
  gaps: { sellerId: string; gaps: Gap[] }[];
  readyInMonths: number;
  investmentLakh: number;
}

export interface Weights {
  cost: number;
  speed: number;
  quality: number;
  resilience: number;
}

export interface ProcessInfo {
  name: string;
  nameHi: string;
  /** capex in lakh rupees per 1,000 extra units a month, and months to install */
  lakhPerThousand: number;
  months: number;
  /** reference monthly capacity for scaling diversification opportunities */
  refCapacity: number;
}

export interface DemandSignal {
  process: string;
  buyers: number;
  monthlyUnits: number;
  region: string;
  from: string;
}

export interface CertInfo {
  costLakh: number;
  months: number;
  labelHi: string;
  schemes: string[];
}
