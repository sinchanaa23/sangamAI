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
