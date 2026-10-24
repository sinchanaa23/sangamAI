// Validation at the trust boundary: everything the browser sends is parsed here before it reaches the store.
import { z } from 'zod';

const money = z.object({ amount: z.number().nonnegative(), currency: z.enum(['INR', 'USD', 'EUR']) });

export const RfqInput = z.object({
  id: z.string().min(1).optional(),
  buyerId: z.string().min(1),
  buyerCountry: z.string().min(2),
  part: z.string().min(1),
  quantity: z.number().int().positive(),
  needBy: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  budget: money,
  verifiedOnly: z.boolean().default(false),
});

export const NegotiationInput = z.object({
  rfqId: z.string().min(1).optional(),
  rfq: RfqInput.optional(),
  supplierIds: z.array(z.string().min(1)).default([]),
  /** force the recorded demo ("replay") even when a model is configured */
  mode: z.enum(['live', 'replay']).optional(),
}).refine((b) => b.rfqId || b.rfq, { message: 'Send rfqId or rfq' });

// Workers are never stored individually: only skill groups with headcount and wage. Unknown keys (phone, Aadhaar, names) are dropped.
export const WorkforceInput = z.object({
  district: z.string().min(1),
  skills: z.array(z.object({ skill: z.string().min(1), headcount: z.number().int().nonnegative(), wagePerWorkerDay: z.number().nonnegative() })).min(1),
  hoursPerDay: z.number().min(0).max(24),
  overtimeHoursPerWeek: z.number().min(0).max(80),
  safetyRecord: z.enum(['complete', 'partial', 'none']),
  trainingHoursPerYear: z.number().min(0),
  womenEmployed: z.number().int().nonnegative(),
  childOrForcedLabourFlag: z.boolean().default(false),
  openGrievances: z.number().int().nonnegative().default(0),
});

// Sustainability checklist answers, keyed by checklist item id (src/sustainability.ts CHECKLIST). Only the tick
// and its evidence state are accepted; scoring ignores item ids it does not know.
export const SustainabilityInput = z.object({
  answers: z.record(z.string(), z.object({ value: z.enum(['yes', 'partly', 'no', 'na']), evidence: z.enum(['declared', 'document', 'verified']) })),
});

// Funding applications (src/funding.ts FundingApplication), saved as drafts by the seller funding page and
// updated by the desk and the marketplace. Strict shape like WorkforceInput; all money is simulated and the
// projections arrive pre-computed client-side, tagged estimated.
export const FundingInput = z.object({
  id: z.string().min(1).optional(),
  sector: z.enum(['ev', 'construction', 'agri']),
  sellerId: z.string().min(1),
  sellerName: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string(),
  items: z.array(z.object({
    id: z.string().min(1),
    kind: z.enum(['machine', 'green-tech', 'rnd', 'certification', 'working-capital']),
    label: z.string().min(1),
    labelHi: z.string(),
    costLakh: z.number().nonnegative(),
    months: z.number().int().nonnegative(),
    purpose: z.string(),
    schemes: z.array(z.string().min(1)).optional(),
    sustainabilityItemId: z.string().min(1).optional(),
    status: z.enum(['todo', 'doing', 'submitted', 'verified']),
    evidence: z.string().optional(),
    updatedAt: z.string().optional(),
  })),
  evidence: z.array(z.string().min(1)),
  status: z.enum(['draft', 'submitted', 'listed', 'funded', 'completed']),
  commitments: z.array(z.object({
    buyerId: z.string().min(1),
    buyerName: z.string().min(1),
    itemIds: z.array(z.string().min(1)),
    amountLakh: z.number().nonnegative(),
    committedAt: z.string().min(1),
    status: z.enum(['pledged', 'released']),
  })),
  projections: z.object({
    totalAskLakh: z.number().nonnegative(),
    paybackMonths: z.number().int().positive().nullable(),
    roi5yrPct: z.number().int().nullable(),
    capacityUpliftPct: z.number().nullable(),
    qualityUpliftPct: z.number().nullable(),
    sustainabilityUplift: z.object({ from: z.string(), to: z.string(), points: z.number() }).nullable(),
    sangamScoreUplift: z.number().nullable(),
    source: z.literal('estimated'),
  }),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
