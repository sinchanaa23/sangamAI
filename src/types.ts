export type OrgType = 'MSME' | 'SHG federation' | 'FPO' | 'Cooperative';

export const RURAL_TYPES: OrgType[] = ['SHG federation', 'FPO', 'Cooperative'];

export interface District {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  /** 0 (low) to 1 (high): flood, cyclone, heat and drought exposure */
  climateRisk: number;
  /** 0 to 1: share of hours with reliable grid power */
  power: number;
  /** 0 to 1: road, rail and port access */
  connectivity: number;
}

export interface BomLine {
  id: string;
  name: string;
  /** share of the harness's landed cost today, in % */
  sharePct: number;
  importedFrom: string;
  process: string;
  requiredCerts: string[];
  weightKg: number;
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
  plantDistrictId: string;
  monthlyUnits: number;
  /** landed cost per unit today, before any disruption, in rupees */
  unitCost: number;
  importLeadDays: number;
  safetyStockDays: number;
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
