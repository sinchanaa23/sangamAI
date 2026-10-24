// Suppliers review buyers: only suppliers write, the author comes from the session, only the team verifies, and a review
// counts (is visible to everyone) only once it is verified.
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { openDb } from './db';

const TEAM = '+919000000001';
const make = () => {
  const sent: { identifier: string; code: string }[] = [];
  const app = createApp(openDb(':memory:'), { otpSender: { name: 'test', send: async (identifier, code) => { sent.push({ identifier, code }); } }, ecosystemAllowlist: [TEAM] });
  return { app, sent };
};
const post = (body: unknown, cookie?: string) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
const get = (cookie?: string) => ({ headers: cookie ? { Cookie: cookie } : {} });

async function signIn(m: ReturnType<typeof make>, role: 'buyer' | 'supplier' | 'ecosystem', identifier: string, displayName: string) {
  await m.app.request('/api/auth/otp/start', post({ role, identifier, displayName }));
  const code = m.sent.at(-1)!.code;
  const res = await m.app.request('/api/auth/otp/verify', post({ role, identifier, code, displayName }));
  return res.headers.get('set-cookie')!.split(';')[0]!;
}

const draft = {
  buyerName: 'Veer Electric Mobility', orderRef: 'PO-2026-0412', orderValueLakh: 12,
  ratings: { payment: 4, specs: 5, terms: 4, communication: 5 },
  text: 'Paid in 38 days against 45 agreed; drawings were clear.', evidence: 'Goods receipt GR-8841',
};

describe('buyer reviews', () => {
  it('only a signed-in supplier can write one, and the author is the session, not the request', async () => {
    const m = make();
    expect((await m.app.request('/api/reviews/buyers', post(draft))).status).toBe(401);
    const buyer = await signIn(m, 'buyer', 'buyer@example.com', 'A Buyer');
    expect((await m.app.request('/api/reviews/buyers', post(draft, buyer))).status).toBe(403);
    const supplier = await signIn(m, 'supplier', '9876543210', 'Satara Gramin Assembly Co-op');
    const res = await m.app.request('/api/reviews/buyers', post({ ...draft, author: 'Someone Else', status: 'verified' }, supplier));
    expect(res.status).toBe(201);
    const made = (await res.json()) as { author: string; status: string; authorUserId?: string };
    expect(made.author).toBe('Satara Gramin Assembly Co-op');
    expect(made.status).toBe('pending');
    expect(made.authorUserId).toBeUndefined();
  });

  it('rejects a malformed review', async () => {
    const m = make();
    const supplier = await signIn(m, 'supplier', '9876543210', 'S');
    expect((await m.app.request('/api/reviews/buyers', post({ ...draft, ratings: { ...draft.ratings, payment: 9 } }, supplier))).status).toBe(400);
    expect((await m.app.request('/api/reviews/buyers', post({ ...draft, text: 'bad' }, supplier))).status).toBe(400);
  });

  it('a pending review is private to its author and the team until the team verifies it', async () => {
    const m = make();
    const supplier = await signIn(m, 'supplier', '9876543210', 'Supplier One');
    const other = await signIn(m, 'supplier', '9876543211', 'Supplier Two');
    const team = await signIn(m, 'ecosystem', TEAM, 'Team');
    const { id } = (await (await m.app.request('/api/reviews/buyers', post(draft, supplier))).json()) as { id: string };

    const list = async (cookie?: string) => (await (await m.app.request('/api/reviews/buyers', get(cookie))).json()) as { id: string; status: string; mine: boolean }[];
    expect(await list()).toHaveLength(0);
    expect(await list(other)).toHaveLength(0);
    expect((await list(supplier))[0]).toMatchObject({ id, status: 'pending', mine: true });
    expect(await list(team)).toHaveLength(1);

    // suppliers cannot verify their own review; the team can
    expect((await m.app.request(`/api/reviews/buyers/${id}/decide`, post({ status: 'verified' }, supplier))).status).toBe(403);
    const done = await m.app.request(`/api/reviews/buyers/${id}/decide`, post({ status: 'verified', note: 'Matched to the PO.' }, team));
    expect(done.status).toBe(200);
    expect((await list())[0]).toMatchObject({ id, status: 'verified', mine: false });
    expect((await m.app.request('/api/reviews/buyers/nope/decide', post({ status: 'verified' }, team))).status).toBe(404);
  });

  it('a rejected review stays hidden from the public', async () => {
    const m = make();
    const supplier = await signIn(m, 'supplier', '9876543210', 'Supplier One');
    const team = await signIn(m, 'ecosystem', TEAM, 'Team');
    const { id } = (await (await m.app.request('/api/reviews/buyers', post(draft, supplier))).json()) as { id: string };
    await m.app.request(`/api/reviews/buyers/${id}/decide`, post({ status: 'rejected' }, team));
    expect(await (await m.app.request('/api/reviews/buyers')).json()).toHaveLength(0);
  });
});
