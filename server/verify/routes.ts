// Business verification routes: GSTIN, Udyam and CIN checks through the provider, vouching by ecosystem accounts, and the tier summary.
import { randomUUID } from 'node:crypto';
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { sellers } from '../../src/data';
import { ensureDataset } from '../agents/tools';
import { guard, publicUser } from '../auth';
import type { Role } from '../auth';
import { sign } from '../credentials';
import type { Db } from '../db';
import { clean, emailDomainHint, isCin, isGstin, isUdyam, looksLikeAadhaar, namesMatch } from './formats';
import type { VerifyProvider } from './provider';
import { RECHECK_DAYS, recordsOf, summarise } from './tiers';
import type { Basis, UserDoc, VerificationKind, VerificationRecord } from './tiers';

const KINDS: Record<'gstin' | 'udyam' | 'cin', { valid: (n: string) => boolean; label: string; roles: Role[] }> = {
  gstin: { valid: isGstin, label: 'GSTIN', roles: ['buyer', 'supplier'] },
  udyam: { valid: isUdyam, label: 'Udyam number', roles: ['supplier'] },
  cin: { valid: isCin, label: 'CIN', roles: ['buyer', 'supplier'] },
};

// Unknown keys (an Aadhaar number, a phone number) are dropped by zod; nothing but these two fields is read.
const CheckBody = z.object({ number: z.string().trim().min(5).max(40), name: z.string().trim().max(120).optional() });
const VouchBody = z.object({ userId: z.string().min(1).max(60), supplierId: z.string().min(1).max(40).optional(), note: z.string().trim().max(300).optional() });

type Check = { kind: 'gstin' | 'udyam' | 'cin'; number: string; name: string };

/** Ask the provider, decide the result in code, and store it. Returns the stored record. */
async function runCheck(db: Db, provider: VerifyProvider, user: UserDoc, { kind, number, name }: Check, now: number): Promise<VerificationRecord> {
  const ask = kind === 'gstin' ? provider.checkGstin : kind === 'udyam' ? provider.checkUdyam : provider.checkCin;
  const found = await ask.call(provider, number);
  let result: VerificationRecord['result'];
  let summary: string;
  if (!found) { result = 'not-found'; summary = `${KINDS[kind].label} ${number} was not found in the registry.`; }
  else if (found.status !== 'active') { result = 'inactive'; summary = `${KINDS[kind].label} ${number} is ${found.status} (${found.legalName}).`; }
  else if (!namesMatch(name, found.legalName)) { result = 'needs-review'; summary = `Registered to "${found.legalName}", which does not match the name on the account ("${name}"). A person will review it.`; }
  else { result = 'verified'; summary = `Registered to ${found.legalName}, active.`; }
  if (found && user.email && kind === 'gstin') {
    const hint = emailDomainHint(user.email, found.legalName);
    if (hint !== 'free-mail') summary += hint === 'matches' ? ' The email domain matches the legal name.' : ' The email domain does not match the legal name.';
  }
  const record: VerificationRecord = {
    id: `ver-${randomUUID().slice(0, 8)}`, userId: user.id, kind, input: number, provider: provider.name, at: new Date(now).toISOString(),
    result, summary, provenance: provider.provenance, ...(result === 'verified' ? { basis: kind as Basis } : {}),
  };
  db.put('verifications', record);
  return record;
}

/** Re-run a registry check that is older than the re-check window; called when someone signs in. */
export async function recheckStale(db: Db, provider: VerifyProvider, user: UserDoc, now = Date.now()) {
  const gstin = recordsOf(db, user.id).filter((r) => r.kind === 'gstin').at(-1);
  if (gstin?.result === 'verified' && now - Date.parse(gstin.at) > RECHECK_DAYS * 86_400_000) {
    try { await runCheck(db, provider, user, { kind: 'gstin', number: gstin.input, name: user.displayName }, now); } catch { /* the old result stands */ }
  }
}

/** A supplier's certificate that passed the code-run checks counts toward tier 2. It stays `declared` until a person verifies it on the desk. */
export function recordCertificate(db: Db, user: UserDoc, summary: string, now = Date.now()) {
  db.put('verifications', {
    id: `ver-${randomUUID().slice(0, 8)}`, userId: user.id, kind: 'certificate', input: '(uploaded certificate)', provider: 'checkCertificate', at: new Date(now).toISOString(),
    result: 'verified', summary, provenance: 'declared',
  } satisfies VerificationRecord);
}

export function mountVerification(app: Hono, db: Db, provider: VerifyProvider, clock: () => number = Date.now) {
  for (const kind of Object.keys(KINDS) as (keyof typeof KINDS)[]) {
    app.post(`/api/verify/${kind}`, async (c: Context) => {
      const g = guard(c, db, KINDS[kind].roles, clock());
      if (g instanceof Response) return g;
      const raw = await c.req.json().catch(() => ({}));
      // Aadhaar-shaped numbers are refused before anything else: Sangam never collects or stores one
      if (typeof (raw as { number?: unknown }).number === 'string' && looksLikeAadhaar((raw as { number: string }).number)) {
        return c.json({ error: 'Aadhaar numbers are never accepted. Enter your business registration number instead.' }, 400);
      }
      const p = CheckBody.safeParse(raw);
      if (!p.success) return c.json({ error: p.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') }, 400);
      const number = kind === 'udyam' ? clean(p.data.number) : clean(p.data.number);
      if (!KINDS[kind].valid(number)) return c.json({ error: `That is not a valid ${KINDS[kind].label}. Check the number and try again.` }, 400);
      try {
        const verification = await runCheck(db, provider, g.user, { kind, number, name: p.data.name || g.user.displayName }, clock());
        return c.json({ verification, summary: summarise(db, g.user, clock()) });
      } catch (e) {
        return c.json({ error: `The verification service could not be reached: ${String((e as Error).message).slice(0, 120)}` }, 502);
      }
    });
  }

  // An ecosystem account (cluster facilitator, FPO, NGO, CSC operator) vouches for a business that has no registration number.
  app.post('/api/vouch', async (c) => {
    const g = guard(c, db, ['ecosystem'], clock());
    if (g instanceof Response) return g;
    const p = VouchBody.safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return c.json({ error: p.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') }, 400);
    const target = db.get<UserDoc>('users', p.data.userId);
    if (!target || target.role === 'ecosystem') return c.json({ error: 'No such supplier or buyer account.' }, 404);
    ensureDataset();
    if (p.data.supplierId && !sellers.some((s) => s.id === p.data.supplierId)) return c.json({ error: 'No such supplier record.' }, 400);
    const linked: UserDoc = p.data.supplierId ? { ...target, supplierId: p.data.supplierId } : target;
    if (p.data.supplierId) db.put('users', linked);
    // Shown everywhere as vouched, never as government-verified. Uses the audit credential type until P4 adds a VerifiedBusinessCredential kind.
    const credential = await sign('AuditCredential', {
      kind: 'VerifiedBusiness', basis: 'vouched', businessName: target.displayName, ...(p.data.supplierId ? { supplierId: p.data.supplierId } : {}),
      vouchedBy: g.user.displayName, ...(p.data.note ? { note: p.data.note } : {}),
    });
    const verification: VerificationRecord = {
      id: `ver-${randomUUID().slice(0, 8)}`, userId: target.id, kind: 'vouch', input: g.user.id, provider: 'vouch', at: new Date(clock()).toISOString(),
      result: 'verified', basis: 'vouched', provenance: 'declared', credentialId: credential.id,
      summary: `Vouched for by ${g.user.displayName}${p.data.note ? `: ${p.data.note}` : ''}.`,
    };
    db.put('verifications', verification);
    return c.json({ verification, credential, user: publicUser(linked), summary: summarise(db, linked, clock()) });
  });
}
export type { VerificationKind };
