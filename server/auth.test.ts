// Section 2 of the brief: signup and login (OTP, sessions), business verification (mock provider), tiers, vouching.
// In-memory database, a recording OTP sender, no network.
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import type { AppOptions } from './app';
import { openDb } from './db';
import type { Db } from './db';
import { gstinCheckChar } from './verify/formats';
import { FIXTURES } from './verify/mock';

interface Sent { identifier: string; code: string }
const make = (opts: AppOptions = {}) => {
  const sent: Sent[] = [];
  const db = openDb(':memory:');
  const app = createApp(db, { otpSender: { name: 'test', send: async (identifier, code) => { sent.push({ identifier, code }); } }, ecosystemAllowlist: ['+919000000001'], ...opts });
  return { app, db, sent };
};
const post = (body: unknown, cookie?: string) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
const get = (cookie?: string) => ({ headers: cookie ? { Cookie: cookie } : {} });

type Made = ReturnType<typeof make>;
async function signIn(m: Made, role: 'buyer' | 'supplier' | 'ecosystem', identifier: string, displayName: string) {
  const start = await m.app.request('/api/auth/otp/start', post({ role, identifier, displayName }));
  expect(start.status).toBe(200);
  const code = m.sent.at(-1)!.code;
  const res = await m.app.request('/api/auth/otp/verify', post({ role, identifier, code, displayName }));
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
  const { user } = await res.json() as { user: { id: string; role: string } };
  return { cookie, user };
}

describe('login with a one-time code', () => {
  it('a correct code starts a session cookie that is httpOnly; a wrong code does not', async () => {
    const m = make();
    expect((await m.app.request('/api/me')).status).toBe(401);
    await m.app.request('/api/auth/otp/start', post({ role: 'supplier', identifier: '9876543210', displayName: 'Satara Gramin Assembly Co-op' }));
    const wrong = await m.app.request('/api/auth/otp/verify', post({ role: 'supplier', identifier: '9876543210', code: '000000', displayName: 'X' }));
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get('set-cookie')).toBeNull();
    const ok = await m.app.request('/api/auth/otp/verify', post({ role: 'supplier', identifier: '9876543210', code: m.sent.at(-1)!.code, displayName: 'Satara Gramin Assembly Co-op' }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    const cookie = ok.headers.get('set-cookie')!.split(';')[0]!;
    const me = await (await m.app.request('/api/me', get(cookie))).json() as { user: { role: string; phone: string }; verification: { tier: number; provenance: string } };
    expect(me.user.role).toBe('supplier');
    expect(me.user.phone).toBe('+919876543210');
    expect(me.verification).toMatchObject({ tier: 0, provenance: 'declared' });
  });

  it('a code works once, and logout ends the session', async () => {
    const m = make();
    const { cookie } = await signIn(m, 'buyer', 'buyer@veer.example', 'Veer Electric Mobility');
    const reuse = await m.app.request('/api/auth/otp/verify', post({ role: 'buyer', identifier: 'buyer@veer.example', code: m.sent.at(-1)!.code }));
    expect(reuse.status).toBe(401);
    expect((await m.app.request('/api/auth/logout', post({}, cookie))).status).toBe(200);
    expect((await m.app.request('/api/me', get(cookie))).status).toBe(401);
  });

  it('limits how often a code can be requested and how often it can be guessed', async () => {
    const m = make();
    for (let i = 0; i < 3; i++) expect((await m.app.request('/api/auth/otp/start', post({ role: 'supplier', identifier: '9123456780' }))).status).toBe(200);
    expect((await m.app.request('/api/auth/otp/start', post({ role: 'supplier', identifier: '9123456780' }))).status).toBe(429);
    const g = make();
    await g.app.request('/api/auth/otp/start', post({ role: 'supplier', identifier: '9123456781' }));
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await g.app.request('/api/auth/otp/verify', post({ role: 'supplier', identifier: '9123456781', code: '111111' }))).status);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    // after too many wrong guesses even the right code no longer works
    const right = await g.app.request('/api/auth/otp/verify', post({ role: 'supplier', identifier: '9123456781', code: g.sent.at(-1)!.code }));
    expect(right.status).not.toBe(200);
  });

  it('asks suppliers for a phone number and buyers for an email, and keeps the ecosystem role for an allowlist', async () => {
    const m = make();
    expect((await m.app.request('/api/auth/otp/start', post({ role: 'supplier', identifier: 'someone@example.com' }))).status).toBe(400);
    expect((await m.app.request('/api/auth/otp/start', post({ role: 'buyer', identifier: '9876543210' }))).status).toBe(400);
    expect((await m.app.request('/api/auth/otp/start', post({ role: 'ecosystem', identifier: '9000000002' }))).status).toBe(403);
    expect((await m.app.request('/api/auth/otp/start', post({ role: 'ecosystem', identifier: '9000000001' }))).status).toBe(200);
  });

  it('the mock sender shows the code in the response, tagged simulated; a real sender never does', async () => {
    const mock = createApp(openDb(':memory:'));
    const r = await (await mock.request('/api/auth/otp/start', post({ role: 'supplier', identifier: '9876500000' }))).json() as { provider: string; devCode?: string; simulated?: boolean };
    expect(r.provider).toBe('mock');
    expect(r.devCode).toMatch(/^\d{6}$/);
    expect(r.simulated).toBe(true);
    const m = make();
    const real = await (await m.app.request('/api/auth/otp/start', post({ role: 'supplier', identifier: '9876500001' }))).json() as { devCode?: string };
    expect(real.devCode).toBeUndefined();
  });
});

const GSTIN = FIXTURES.gstin.active;      // active, legal name "Satara Gramin Assembly Co-operative Society"
describe('business verification with the mock provider', () => {
  it('computes the GSTIN check character', () => {
    expect(gstinCheckChar('27AABCS1234C1Z')).toMatch(/^[0-9A-Z]$/);
    expect(GSTIN.length).toBe(15);
    expect(GSTIN[14]).toBe(gstinCheckChar(GSTIN.slice(0, 14)));
  });

  it('an active GSTIN whose legal name matches gives tier 1, shown as simulated because the check is a mock', async () => {
    const m = make();
    const { cookie } = await signIn(m, 'buyer', 'buyer@satara.example', 'Satara Gramin Assembly Co-op');
    const res = await m.app.request('/api/verify/gstin', post({ number: GSTIN }, cookie));
    expect(res.status).toBe(200);
    const j = await res.json() as { verification: { result: string; provenance: string }; summary: { tier: number; status: string; provenance: string; basis: string } };
    expect(j.verification).toMatchObject({ result: 'verified', provenance: 'simulated' });
    expect(j.summary).toMatchObject({ tier: 1, status: 'verified', provenance: 'simulated', basis: 'gstin' });
  });

  it('a legal name that does not match is held for review, not verified', async () => {
    const m = make();
    const { cookie } = await signIn(m, 'buyer', 'buyer@other.example', 'Totally Different Traders');
    const j = await (await m.app.request('/api/verify/gstin', post({ number: GSTIN }, cookie))).json() as { verification: { result: string }; summary: { tier: number; status: string } };
    expect(j.verification.result).toBe('needs-review');
    expect(j.summary).toMatchObject({ tier: 0, status: 'needs-review' });
  });

  it('rejects malformed numbers, a wrong check character, a cancelled registration and Aadhaar-like numbers', async () => {
    const m = make();
    const { cookie } = await signIn(m, 'buyer', 'buyer@x.example', 'Satara Gramin Assembly Co-op');
    expect((await m.app.request('/api/verify/gstin', post({ number: 'NOTAGSTIN' }, cookie))).status).toBe(400);
    expect((await m.app.request('/api/verify/gstin', post({ number: GSTIN.slice(0, 14) + (GSTIN[14] === 'A' ? 'B' : 'A') }, cookie))).status).toBe(400);
    expect((await m.app.request('/api/verify/gstin', post({ number: '123456789012' }, cookie))).status).toBe(400);
    expect((await m.app.request('/api/verify/gstin', post({ number: '1234 5678 9012' }, cookie))).status).toBe(400);
    const cancelled = await (await m.app.request('/api/verify/gstin', post({ number: FIXTURES.gstin.cancelled }, cookie))).json() as { verification: { result: string }; summary: { tier: number } };
    expect(cancelled.verification.result).toBe('inactive');
    expect(cancelled.summary.tier).toBe(0);
    const unknown = FIXTURES.gstin.unknown;
    expect((await (await m.app.request('/api/verify/gstin', post({ number: unknown }, cookie))).json() as { verification: { result: string } }).verification.result).toBe('not-found');
  });

  it('needs a session, and each role may only use the checks that fit it', async () => {
    const m = make();
    expect((await m.app.request('/api/verify/gstin', post({ number: GSTIN }))).status).toBe(401);
    const { cookie } = await signIn(m, 'supplier', '9811111111', 'Krishnagiri Mahila Harness Collective');
    expect((await m.app.request('/api/verify/udyam', post({ number: FIXTURES.udyam.active }, cookie))).status).toBe(200);
  });

  it('never stores an Aadhaar-like field or any key it was not asked for', async () => {
    const m = make();
    const { cookie } = await signIn(m, 'buyer', 'buyer@y.example', 'Satara Gramin Assembly Co-op');
    await m.app.request('/api/verify/gstin', post({ number: GSTIN, aadhaar: '1234 5678 9012', phone: '9999999999' }, cookie));
    const stored = JSON.stringify([m.db.list('users'), m.db.list('verifications'), m.db.list('sessions')]);
    expect(stored).not.toMatch(/aadhaar|1234 5678 9012|9999999999/i);
  });
});

describe('vouching for suppliers without a registration number', () => {
  it('an ecosystem account vouches; the credential verifies and says "vouched", never "verified"', async () => {
    const m = make();
    const sup = await signIn(m, 'supplier', '9822222222', 'Krishnagiri Mahila Harness Collective');
    const eco = await signIn(m, 'ecosystem', '9000000001', 'Cluster facilitator');
    const denied = await m.app.request('/api/vouch', post({ userId: sup.user.id }, sup.cookie));
    expect(denied.status).toBe(403);
    const res = await m.app.request('/api/vouch', post({ userId: sup.user.id, supplierId: 's13', note: 'Known to our cluster for 6 years' }, eco.cookie));
    expect(res.status).toBe(200);
    const j = await res.json() as { verification: { basis: string; provenance: string }; credential: unknown };
    expect(j.verification).toMatchObject({ basis: 'vouched' });
    expect(j.verification.provenance).not.toBe('verified');
    const check = await (await m.app.request('/api/credentials/verify', post(j.credential))).json() as { ok: boolean };
    expect(check.ok).toBe(true);
    expect((j.credential as { subject: { basis: string } }).subject.basis).toBe('vouched');
    const me = await (await m.app.request('/api/me', get(sup.cookie))).json() as { verification: { tier: number; basis: string; provenance: string } };
    expect(me.verification).toMatchObject({ tier: 1, basis: 'vouched' });
    expect(me.verification.provenance).not.toBe('verified');
  });

  it('a supplier linked to a supplier record reaches tier 3 once it has a confirmed deal', async () => {
    const m = make();
    const sup = await signIn(m, 'supplier', '9833333333', 'Krishnagiri Mahila Harness Collective');
    const eco = await signIn(m, 'ecosystem', '9000000001', 'Cluster facilitator');
    await m.app.request('/api/vouch', post({ userId: sup.user.id, supplierId: 's13' }, eco.cookie));
    (m.db as Db).put('deals', { id: 'deal-1', supplierId: 's13', status: 'confirmed' } as never);
    const me = await (await m.app.request('/api/me', get(sup.cookie))).json() as { verification: { tier: number } };
    expect(me.verification.tier).toBe(3);
  });
});

describe('the signing endpoint', () => {
  it('stays open by default, and needs an ecosystem session when protection is switched on', async () => {
    const open = make();
    expect((await open.app.request('/api/credentials/sign', post({ type: 'SkillCredential', subject: { skill: 'x' } }))).status).toBe(200);
    const closed = make({ protectSigning: true });
    expect((await closed.app.request('/api/credentials/sign', post({ type: 'SkillCredential', subject: { skill: 'x' } }))).status).toBe(401);
    const sup = await signIn(closed, 'supplier', '9844444444', 'Someone');
    expect((await closed.app.request('/api/credentials/sign', post({ type: 'SkillCredential', subject: { skill: 'x' } }, sup.cookie))).status).toBe(403);
    const eco = await signIn(closed, 'ecosystem', '9000000001', 'Facilitator');
    expect((await closed.app.request('/api/credentials/sign', post({ type: 'SkillCredential', subject: { skill: 'x' } }, eco.cookie))).status).toBe(200);
  });
});

describe('what verification changes elsewhere', () => {
  it('a supplier whose account passed a business check scores higher on trust in the negotiation agents', async () => {
    const { buildContext, ensureDataset, pickLine } = await import('./agents/tools');
    const { sellers } = await import('../src/data');
    ensureDataset();
    const m = make();
    const seller = sellers.find((s) => s.id === 's13')!;
    const rfq = { id: 'r', buyerId: 'b', buyerCountry: 'IN', part: 'EV scooter wiring harness (assembly and test)', quantity: 8000, needBy: '2099-01-01', budget: { amount: 6_000_000, currency: 'INR' as const }, verifiedOnly: false };
    const before = buildContext(rfq, seller, pickLine(rfq.part), m.db).trust;
    const sup = await signIn(m, 'supplier', '9855555555', 'Krishnagiri Mahila Harness Collective');
    const eco = await signIn(m, 'ecosystem', '9000000001', 'Cluster facilitator');
    await m.app.request('/api/vouch', post({ userId: sup.user.id, supplierId: 's13' }, eco.cookie));
    const after = buildContext(rfq, seller, pickLine(rfq.part), m.db).trust;
    expect(after - before).toBe(15); // the identity part of the trust score
  });

  it('re-checks a registry result older than the window when the account signs in again', async () => {
    let t = Date.parse('2026-10-24T10:00:00Z');
    const m = make({ now: () => t });
    const first = await signIn(m, 'buyer', 'buyer@satara.example', 'Satara Gramin Assembly Co-op');
    await m.app.request('/api/verify/gstin', post({ number: FIXTURES.gstin.active }, first.cookie));
    expect(m.db.list('verifications')).toHaveLength(1);
    const { summarise } = await import('./verify/tiers');
    const user = m.db.list<never>('users')[0] as never;
    expect(summarise(m.db, user, t).recheckDue).toBe(false);
    t += 40 * 86_400_000;
    expect(summarise(m.db, user, t).recheckDue).toBe(true);
    // the old session has expired by now; signing in again re-runs the stale registry check
    await signIn(m, 'buyer', 'buyer@satara.example', 'Satara Gramin Assembly Co-op');
    expect(m.db.list('verifications')).toHaveLength(2);
  });
});
