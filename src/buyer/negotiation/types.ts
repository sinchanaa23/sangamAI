// TEMPORARY local copy of the proposal's draft of src/contracts.ts (owned by P1).
// Delete this file and import from '../../contracts' once P1 merges it.

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
  id: string; buyerId: string; buyerCountry: string;
  part: string; quantity: number; needBy: string; // ISO date
  budget: Money; verifiedOnly: boolean;
}

export interface Offer {
  id: string; rfqId: string; supplierId: string; round: number;
  price: Money; leadTimeDays: number; labour: LabourPlan;
  status: 'proposed' | 'countered' | 'rejected' | 'accepted';
  reason?: string; // why the orchestrator rejected it
}

export interface FairWorkScore {
  supplierId: string; grade: 'A' | 'B' | 'C' | 'D' | 'E';
  wageVsMinimum: number; wageVsLivingWage: number;
  overtimeHours: number; safety: number; womenShare: number;
  childLabourFlag: boolean; benchmarkSource: string;
}

export type Side = 'buyer' | 'supplier' | 'auditor';

export type NegotiationEvent =
  | { type: 'search' | 'select' | 'init' | 'confirm'; from: Side; at: string; offer?: Offer; text: string }
  | { type: 'audit'; at: string; score: FairWorkScore; decision: 'pass' | 'flag' | 'block' }
  | { type: 'end'; at: string; outcome: 'deal' | 'no-deal'; dealId?: string };
