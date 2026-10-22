import type { BomLine, Buyer, CertInfo, DemandSignal, NewSite, ProcessInfo, SectorId } from '../types';
import type { SellerSeed } from './helpers';

export interface OpportunitySeed {
  id: string;
  process: string;
  name: string;
  nameHi: string;
  marketCr: number;
  growthPct: number;
  buyers: number;
  overlap: number;
  equipmentLakh: number;
  certs: string[];
  certLakh: number;
  trainingLakh: number;
  revenueLakh: number;
  marginPct: number;
  readyMonths: number;
  jobs: number;
  reuses: string[];
  needs: string[];
}

export interface SectorTemplate {
  id: SectorId;
  name: string;
  blurb: string;
  buyer: Omit<Buyer, 'unitCost'>;
  bom: Omit<BomLine, 'sharePct'>[];
  sellers: SellerSeed[];
  newSites: NewSite[];
  processes: ProcessInfo[];
  certs: Record<string, CertInfo>;
  demandSignals: DemandSignal[];
  opportunities: OpportunitySeed[];
}
