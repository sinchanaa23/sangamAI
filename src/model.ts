// Records people create in the app: requirements, quotes, consortia, reviews, projects and verification.
import type { DatasetOverrides } from './data';
import type { NewSite, SectorId, Seller } from './types';

export type Firmness = 'exploring' | 'rfq' | 'committed';
export type Visibility = 'anonymous' | 'named' | 'invite';
export type Bidder = { kind: 'seller'; id: string } | { kind: 'consortium'; id: string };
export type Check = 'pending' | 'verified' | 'rejected';

export interface Requirement {
  id: string;
  sector: SectorId;
  lineId: string;
  title: string;
  process: string;
  spec: string;
  monthlyVolume: number;
  startBy: string;
  firmness: Firmness;
  targetPrice: number;
  visibility: Visibility;
  invited: string[];
  showTarget: boolean;
  exactVolume: boolean;
  status: 'open' | 'awarded' | 'closed';
  awardedQuoteId?: string;
  createdAt: string;
  sample?: boolean;
}

export interface Interest { id: string; reqId: string; bidder: Bidder; note: string; at: string; sample?: boolean }

export interface Quote {
  id: string;
  reqId: string;
  bidder: Bidder;
  unitPrice: number;
  moq: number;
  leadDays: number;
  paymentDays: number;
  validityDays: number;
  toolingLakh: number;
  capacity: number;
  notes: string;
  at: string;
  status: 'submitted' | 'shortlisted' | 'awarded' | 'declined';
  sample?: boolean;
}

export interface Consortium {
  id: string;
  sector: SectorId;
  name: string;
  reqId: string;
  lead: string;
  members: { sellerId: string; sharePct: number; status: 'invited' | 'accepted' | 'declined' }[];
  createdAt: string;
}

export interface Review {
  id: string;
  sellerId: string;
  author: string;
  authorType: 'buyer' | 'partner';
  orderRef: string;
  orderValueLakh: number;
  ratings: { quality: number; delivery: number; communication: number; compliance: number };
  text: string;
  evidence?: string;
  status: Check;
  verifierNote?: string;
  at: string;
  sample?: boolean;
}

export interface Milestone {
  id: string;
  label: string;
  costLakh: number;
  months: number;
  status: 'todo' | 'doing' | 'submitted' | 'verified';
  evidence?: string;
  updatedAt?: string;
}

export interface DevProject {
  id: string;
  sector: SectorId;
  sellerId: string;
  lineId: string;
  buyerSharePct: number;
  milestones: Milestone[];
  createdAt: string;
}

export interface Verification {
  identity: Check;
  certs: Record<string, Check>;
  capacity: Check;
  requestedAt: string;
  note?: string;
}

export interface DocItem { name: string; kind: string; size: number; extracted?: Record<string, string> }

export type OnboardedSeller = Seller & { sector: SectorId; docs: DocItem[] };

export interface ViewLog { reqId: string; sellerId: string; at: string }

export interface StoreState {
  version: 2;
  sector: SectorId;
  overrides: Partial<Record<SectorId, DatasetOverrides>>;
  onboarded: OnboardedSeller[];
  customSites: (NewSite & { sector: SectorId })[];
  seeded: Partial<Record<SectorId, boolean>>;
  requirements: Requirement[];
  interests: Interest[];
  quotes: Quote[];
  consortia: Consortium[];
  reviews: Review[];
  projects: DevProject[];
  /** switch-over gate decisions, key `${sector}:${lineId}:${gateId}` */
  gates: Record<string, 'pending' | 'passed' | 'failed'>;
  views: ViewLog[];
  verifications: Record<string, Verification>;
  sharing: { aggregateDemand: boolean; nameToVerifiedOnly: boolean; showTargetPriceDefault: boolean };
  chosen: Partial<Record<SectorId, { chainId?: string; archId?: string }>>;
}

export const EMPTY: StoreState = {
  version: 2, sector: 'ev', overrides: {}, onboarded: [], customSites: [], seeded: {},
  requirements: [], interests: [], quotes: [], consortia: [], reviews: [], projects: [], gates: {}, views: [], verifications: {},
  sharing: { aggregateDemand: true, nameToVerifiedOnly: true, showTargetPriceDefault: false },
  chosen: {},
};

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
export const now = () => new Date().toISOString();
export const bidderKey = (b: Bidder) => `${b.kind}:${b.id}`;
