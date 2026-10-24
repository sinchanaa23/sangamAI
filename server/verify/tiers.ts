// Verification tiers. Login proves "same person as last time"; verification proves "a real business"; track record is earned.
//   0 signed up (declared)   1 business is real   2 documents checked   3 track record (confirmed deals)
import type { Provenance } from '../../src/types';
import type { Db } from '../db';

export type VerificationKind = 'gstin' | 'udyam' | 'cin' | 'certificate' | 'vouch';
export type VerificationResult = 'verified' | 'needs-review' | 'not-found' | 'inactive';
export type Basis = 'gstin' | 'udyam' | 'cin' | 'vouched';

export interface VerificationRecord {
  id: string;
  userId: string;
  kind: VerificationKind;
  input: string;
  provider: string;
  at: string;
  result: VerificationResult;
  summary: string;
  /** what the result is worth: 'verified' real registry, 'simulated' mock registry, 'declared' for a vouch or a self-supplied certificate */
  provenance: Provenance;
  basis?: Basis;
  credentialId?: string;
}

export interface UserDoc {
  id: string;
  role: 'buyer' | 'supplier' | 'ecosystem';
  phone?: string;
  email?: string;
  displayName: string;
  /** the supplier record this account speaks for, set when an ecosystem account vouches */
  supplierId?: string;
  createdAt: string;
}

export interface Summary {
  tier: 0 | 1 | 2 | 3;
  status: 'signed-up' | 'verified' | 'needs-review';
  provenance: Provenance;
  basis?: Basis;
  label: string;
  /** the latest record of each kind */
  checks: VerificationRecord[];
  /** a registry result is older than the re-check window */
  recheckDue: boolean;
}

export const LABEL = ['Signed up', 'Business is real', 'Documents checked', 'Track record'] as const;
export const RECHECK_DAYS = Number(process.env.AUTH_RECHECK_DAYS ?? 30);

export const recordsOf = (db: Db, userId: string) =>
  db.list<VerificationRecord>('verifications').filter((v) => v.userId === userId).sort((a, b) => a.at.localeCompare(b.at));

const latestByKind = (records: VerificationRecord[]) => {
  const m = new Map<VerificationKind, VerificationRecord>();
  for (const r of records) m.set(r.kind, r);
  return m;
};

/** Confirmed deals that belong to this account: the supplier it speaks for, or the requests it posted as a buyer. */
function confirmedDeals(db: Db, user: UserDoc): number {
  const deals = db.list<{ id: string; supplierId?: string; rfqId?: string; status?: string }>('deals').filter((d) => d.status === 'confirmed');
  if (user.supplierId) return deals.filter((d) => d.supplierId === user.supplierId).length;
  if (user.role === 'buyer') {
    const mine = new Set(db.list<{ id: string; buyerId?: string }>('rfqs').filter((r) => r.buyerId === user.id).map((r) => r.id));
    return deals.filter((d) => d.rfqId && mine.has(d.rfqId)).length;
  }
  return 0;
}

export function summarise(db: Db, user: UserDoc, now = Date.now()): Summary {
  const latest = latestByKind(recordsOf(db, user.id));
  const business = (['gstin', 'udyam', 'cin', 'vouch'] as const).map((k) => latest.get(k)).filter((r): r is VerificationRecord => r?.result === 'verified');
  const first = business[0];
  const certificate = latest.get('certificate')?.result === 'verified';
  const reviewing = [...latest.values()].some((r) => r.result === 'needs-review' && r.kind !== 'certificate');
  let tier: Summary['tier'] = 0;
  if (first) tier = confirmedDeals(db, user) > 0 ? 3 : certificate ? 2 : 1;
  const gstin = latest.get('gstin');
  const recheckDue = Boolean(gstin?.result === 'verified' && now - Date.parse(gstin.at) > RECHECK_DAYS * 86_400_000);
  return {
    tier,
    status: first ? 'verified' : reviewing ? 'needs-review' : 'signed-up',
    provenance: first ? first.provenance : 'declared',
    ...(first?.basis ? { basis: first.basis } : {}),
    label: LABEL[tier],
    checks: [...latest.values()],
    recheckDue,
  };
}

/** True when an account that speaks for this supplier record has passed a business check: feeds the identity part of the trust score. */
export function supplierIdentityVerified(db: Db, supplierId: string): boolean {
  return db.list<UserDoc>('users').some((u) => u.supplierId === supplierId && summarise(db, u).tier >= 1);
}
