// TEMPORARY stand-in for server/fixtures/demo-negotiation.json (owned by P1), so the room
// can be built before the server lands. Every figure here is simulated demo data, except the
// living-wage benchmark (GLWC Rural Nilgiris, ₹14,926 a month ÷ 26 days ≈ ₹574 a worker-day),
// used as the nearest rural benchmark for Krishnagiri and so tagged estimated.
import type { NegotiationEvent, Offer, Rfq } from './types';

export const DEMO_RFQ: Rfq = {
  id: 'rfq-demo', buyerId: 'veer', buyerCountry: 'IN',
  part: 'EV scooter wiring harness (assembly and test)', quantity: 8000, needBy: '2026-12-20',
  budget: { amount: 6_000_000, currency: 'INR' }, verifiedOnly: false,
};

const KRISHNAGIRI = { district: 'Krishnagiri', womenShare: 0.92, hoursPerDay: 8 };
const offer = (o: Partial<Offer> & Pick<Offer, 'id' | 'round' | 'price' | 'leadTimeDays' | 'labour' | 'status'>): Offer =>
  ({ rfqId: DEMO_RFQ.id, supplierId: 's13', ...o });

export const LIVING_WAGE_PER_DAY = 574;

export const DEMO_EVENTS: NegotiationEvent[] = [
  { type: 'search', from: 'buyer', at: '2026-10-24T10:00:00Z', text: 'Veer Electric Mobility needs 8,000 scooter wiring harnesses, assembled and 100% tested, by 20 December. Budget ₹60 lakh. Looking for rural clusters with harness skills.' },
  { type: 'search', from: 'supplier', at: '2026-10-24T10:00:04Z', text: 'Krishnagiri Mahila Harness Collective (14 women SHGs, 180 trained workers) has 6,500 harnesses a month free and can take this order.' },
  { type: 'select', from: 'supplier', at: '2026-10-24T10:00:09Z', text: 'Opening quote: ₹800 a harness. 160 workers for 40 days at ₹600 a worker-day, 8-hour shifts.',
    offer: offer({ id: 'o1', round: 1, price: { amount: 6_400_000, currency: 'INR' }, leadTimeDays: 45, status: 'proposed',
      labour: { ...KRISHNAGIRI, workers: 160, workerDays: 6400, wagePerWorkerDay: 600 } }) },
  { type: 'init', from: 'buyer', at: '2026-10-24T10:00:15Z', text: 'That is over budget. Counter: ₹650 a harness in 35 days, same team.',
    offer: offer({ id: 'o2', round: 2, price: { amount: 5_200_000, currency: 'INR' }, leadTimeDays: 35, status: 'rejected',
      labour: { ...KRISHNAGIRI, workers: 160, workerDays: 6400, wagePerWorkerDay: 470 },
      reason: 'At this price the labour plan pays ₹470 a worker-day, below the ₹574 living-wage floor for Krishnagiri. Blocked before the supplier saw it.' }) },
  { type: 'init', from: 'buyer', at: '2026-10-24T10:00:21Z', text: 'Understood. Revised counter: ₹720 a harness in 40 days.',
    offer: offer({ id: 'o3', round: 2, price: { amount: 5_760_000, currency: 'INR' }, leadTimeDays: 40, status: 'countered',
      labour: { ...KRISHNAGIRI, workers: 160, workerDays: 6400, wagePerWorkerDay: 580 } }) },
  { type: 'init', from: 'supplier', at: '2026-10-24T10:00:28Z', text: 'We can meet you at ₹750 if we run 170 workers for 38 days. The wage stays at ₹600.',
    offer: offer({ id: 'o4', round: 3, price: { amount: 6_000_000, currency: 'INR' }, leadTimeDays: 42, status: 'countered',
      labour: { ...KRISHNAGIRI, workers: 170, workerDays: 6460, wagePerWorkerDay: 600 } }) },
  { type: 'init', from: 'buyer', at: '2026-10-24T10:00:34Z', text: '₹740 a harness and we have a deal, if you deliver in 42 days.',
    offer: offer({ id: 'o5', round: 4, price: { amount: 5_920_000, currency: 'INR' }, leadTimeDays: 42, status: 'countered',
      labour: { ...KRISHNAGIRI, workers: 170, workerDays: 6460, wagePerWorkerDay: 595 } }) },
  { type: 'confirm', from: 'supplier', at: '2026-10-24T10:00:39Z', text: 'Accepted: ₹740 a harness, 42 days.',
    offer: offer({ id: 'o6', round: 4, price: { amount: 5_920_000, currency: 'INR' }, leadTimeDays: 42, status: 'accepted',
      labour: { ...KRISHNAGIRI, workers: 170, workerDays: 6460, wagePerWorkerDay: 595 } }) },
  { type: 'select', from: 'auditor', at: '2026-10-24T10:00:43Z', text: 'Checking the accepted offer against the Fair Work Scorecard: wage, hours, safety, child and forced labour.' },
  { type: 'audit', at: '2026-10-24T10:00:50Z', decision: 'pass',
    score: { supplierId: 's13', grade: 'B', wageVsMinimum: 1.31, wageVsLivingWage: 595 / LIVING_WAGE_PER_DAY, overtimeHours: 0, safety: 0.7, womenShare: 0.92, childLabourFlag: false,
      benchmarkSource: 'GLWC Rural Nilgiris, Tamil Nadu (nearest rural benchmark; estimated for Krishnagiri)' } },
  { type: 'confirm', from: 'auditor', at: '2026-10-24T10:00:53Z', text: 'Passed. Grade B: wage is above the living wage, but the safety record is self-declared and not yet audited, which lowers the grade one step. Contract credential signed.' },
  { type: 'end', at: '2026-10-24T10:00:55Z', outcome: 'deal', dealId: 'deal-demo-1' },
];
