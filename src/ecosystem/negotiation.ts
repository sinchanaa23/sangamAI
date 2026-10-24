// Turns a finished agent negotiation into ecosystem records: the Auditor's decision becomes a signed
// audit credential (pass) or a flag on the Verification desk (flag), the deal gets a signed contract
// credential, and its workers and wages reach the SDG 8 dashboard.
//
// For P2's negotiation room, once the 'end' event has arrived:
//   useEffect(() => { if (end) void recordNegotiation(shown); }, [end]);
// Safe to call again on a replay: each deal is recorded once.
import { bom, buyer, sellers } from '../data';
import { district, isImported, isRural } from '../engine';
import type { Provenance } from '../types';
import type { DealRecord } from './impact';
import { addDeal, issue, raiseFlag } from './ledger';

// The fields this needs from src/contracts.ts (P1), kept structural so it works with the draft types too
interface Offer { supplierId: string; rfqId: string; price: { amount: number; currency: string }; leadTimeDays: number; status: string; labour: { workers: number; workerDays: number; wagePerWorkerDay: number; hoursPerDay: number; womenShare: number } }
interface Score { supplierId: string; grade: string; wageVsLivingWage: number; benchmarkSource: string; childLabourFlag: boolean }
type Event =
  | { type: 'search' | 'select' | 'init' | 'confirm'; offer?: Offer; text: string }
  | { type: 'audit'; score: Score; decision: 'pass' | 'flag' | 'block' }
  | { type: 'end'; outcome: 'deal' | 'no-deal'; dealId?: string };

export type NegotiationOutcome = 'recorded' | 'already-recorded' | 'flagged' | 'blocked' | 'no-deal';

/**
 * @param source 'simulated' for a recorded replay, 'live' when the agents ran for real
 * @param part what was bought, to tell whether it replaces an import (matched against the parts list)
 */
export async function recordNegotiation(events: Event[], opts: { source?: Provenance; part?: string } = {}): Promise<NegotiationOutcome> {
  const end = events.find((e): e is Extract<Event, { type: 'end' }> => e.type === 'end');
  const audit = events.find((e): e is Extract<Event, { type: 'audit' }> => e.type === 'audit');
  const accepted = [...events].reverse().map((e) => ('offer' in e ? e.offer : undefined)).find((o) => o?.status === 'accepted');
  if (!end || end.outcome !== 'deal' || !accepted) return 'no-deal';

  const dealId = end.dealId ?? `deal-${accepted.rfqId}`;
  const s = sellers.find((x) => x.id === accepted.supplierId);
  const line = opts.part ? bom.find((l) => opts.part!.toLowerCase().includes(l.name.toLowerCase())) : undefined;
  const wage = accepted.labour.wagePerWorkerDay;
  const record: DealRecord = {
    id: `${dealId}:${accepted.supplierId}`, reqId: dealId, sellerId: accepted.supplierId,
    districtId: s?.districtId ?? '', rural: s ? isRural(s) : false,
    valueInr: accepted.price.amount, importReplacedInr: line && isImported(line) ? accepted.price.amount : 0,
    workers: accepted.labour.workers, workersSource: opts.source ?? 'simulated',
    womenShare: accepted.labour.womenShare, wagePerDay: wage,
    livingWagePerDay: audit?.score.wageVsLivingWage ? wage / audit.score.wageVsLivingWage : undefined,
    workforceSource: opts.source ?? 'simulated',
    source: opts.source ?? 'simulated',
  };
  if (!addDeal([record])) return 'already-recorded';

  const subject = {
    supplierId: accepted.supplierId, supplierName: s?.name ?? accepted.supplierId, dealId, buyer: buyer.name,
    district: s ? district(s.districtId).name : undefined,
  };
  if (audit?.decision === 'flag') {
    raiseFlag({ sellerId: accepted.supplierId, reqId: dealId, raisedBy: 'Auditor Agent', reason: `Grade ${audit.score.grade} needs a person to check before signing (${audit.score.benchmarkSource}).`, subject: { ...subject, grade: audit.score.grade } });
    return 'flagged';
  }
  if (audit?.decision === 'block') return 'blocked';

  if (audit) await issue('AuditCredential', { ...subject, grade: audit.score.grade, outcome: 'passed by the Auditor Agent', benchmark: audit.score.benchmarkSource });
  await issue('ContractCredential', {
    ...subject, part: opts.part, orderValueInr: accepted.price.amount, leadTimeDays: accepted.leadTimeDays,
    workers: accepted.labour.workers, wagePerWorkerDay: wage,
  });
  return 'recorded';
}
