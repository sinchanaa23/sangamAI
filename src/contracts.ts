// Shared types and API routes for the four parts of the build. Agreed by all four people in hours 0-2;
// after that only the Agents lead (P1) changes this file, through a pull request the others approve.

// Type-only import (erased at runtime), so the server tsconfig boundary stays intact; src/sustainability.ts
// only depends on src/types.ts, so there is no cycle.
import type { SustainabilityAnswers } from './sustainability';

export type Money = { amount: number; currency: 'INR' | 'USD' | 'EUR' };

export interface LabourPlan {
  workers: number;
  workerDays: number;
  wagePerWorkerDay: number; // INR
  hoursPerDay: number;
  womenShare: number; // 0 to 1
  district: string;
}

export interface Rfq {
  id: string;
  buyerId: string;
  buyerCountry: string;
  part: string;
  quantity: number;
  needBy: string; // ISO date
  budget: Money;
  verifiedOnly: boolean;
}

export interface Offer {
  id: string;
  rfqId: string;
  supplierId: string;
  round: number;
  price: Money;
  leadTimeDays: number;
  labour: LabourPlan;
  status: 'proposed' | 'countered' | 'rejected' | 'accepted';
  reason?: string; // why the orchestrator rejected it
}

export interface FairWorkScore {
  supplierId: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  wageVsMinimum: number;
  wageVsLivingWage: number;
  overtimeHours: number;
  safety: number;
  womenShare: number;
  childLabourFlag: boolean;
  benchmarkSource: string;
}

export type NegotiationEvent =
  | { type: 'search' | 'select' | 'init' | 'confirm'; from: 'buyer' | 'supplier' | 'auditor'; at: string; offer?: Offer; text: string }
  | { type: 'audit'; at: string; score: FairWorkScore; decision: 'pass' | 'flag' | 'block' }
  | { type: 'end'; at: string; outcome: 'deal' | 'no-deal'; dealId?: string };

export interface Credential {
  id: string;
  type: 'SkillCredential' | 'AuditCredential' | 'ContractCredential';
  issuer: 'did:web:sangam.example';
  issuedAt: string;
  subject: Record<string, unknown>;
  proof: { alg: 'Ed25519'; signature: string };
}

/** One skill group in a supplier's workforce. Workers are stored by pseudonymous id, skill and wage band only: no phone numbers or Aadhaar. */
export interface WorkforceSkill {
  skill: string;
  headcount: number;
  wagePerWorkerDay: number; // INR
}

export interface WorkforceProfile {
  supplierId: string;
  district: string;
  skills: WorkforceSkill[];
  hoursPerDay: number;
  overtimeHoursPerWeek: number;
  safetyRecord: 'complete' | 'partial' | 'none';
  trainingHoursPerYear: number;
  womenEmployed: number;
  childOrForcedLabourFlag: boolean;
  openGrievances: number;
  updatedAt: string;
}

export interface NegotiationStart {
  rfq: Rfq;
  supplierIds: string[];
}

// ---- Sustainability (P3) ----
/** A supplier's checklist answers with their evidence state, saved from the seller Sustainability page. */
export interface SustainabilityProfile {
  supplierId: string;
  answers: SustainabilityAnswers;
  updatedAt: string;
}

// ---- Funding (P4) ----
/** One supplier's funding application: items, buyer commitments and estimated projections (src/funding.ts). */
export type { FundingApplication } from './funding';

export interface NegotiationSummary {
  id: string;
  rfqId: string;
  status: 'running' | 'done';
  mode: 'live' | 'replay';
  outcome?: 'deal' | 'no-deal';
  dealId?: string;
}

/** Every route the server exposes, as paths. `:name` segments are filled by the caller. */
export const ROUTES = {
  health: '/api/health',
  rfq: '/api/rfq',
  negotiations: '/api/negotiations',
  negotiation: '/api/negotiations/:id',
  negotiationStream: '/api/negotiations/:id/stream',
  scorecard: '/api/scorecard/:supplierId',
  workforce: '/api/suppliers/:id/workforce',
  sustainability: '/api/suppliers/:id/sustainability', // P3
  credentialsVerify: '/api/credentials/verify', // P4
  credential: '/api/credentials/:id', // P4
  impact: '/api/impact', // P4
  grievances: '/api/grievances', // P4
  funding: '/api/funding', // P4
  fundingOne: '/api/funding/:id', // P4
} as const;
