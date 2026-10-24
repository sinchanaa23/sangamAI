import { beforeEach, describe, expect, it } from 'vitest';
import type { NegotiationEvent } from '../src/contracts';
import { createApp } from './app';
import { openDb } from './db';

process.env.SANGAM_REPLAY_MS = '0';

const json = (method: string, body: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const rfq = { buyerId: 'veer', buyerCountry: 'DE', part: 'Wiring harness', quantity: 500, needBy: '2026-12-20', budget: { amount: 100000, currency: 'EUR' } };
const workforce = {
  district: 'Krishnagiri', skills: [{ skill: 'Crimping', headcount: 40, wagePerWorkerDay: 600 }], hoursPerDay: 8, overtimeHoursPerWeek: 0,
  safetyRecord: 'complete', trainingHoursPerYear: 20, womenEmployed: 36,
};

/** Reads a server-sent event stream to its end and returns the events. */
async function readStream(res: Response): Promise<NegotiationEvent[]> {
  const text = await res.text();
  return text.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)) as NegotiationEvent);
}

describe('server', () => {
  let app: ReturnType<typeof createApp>;
  beforeEach(() => { app = createApp(openDb(':memory:')); });

  it('answers the health check', async () => {
    const r = await app.request('/api/health');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it('rejects an empty question before calling the model', async () => {
    const r = await app.request('/api/ask', json('POST', { question: ' ', context: '' }));
    expect(r.status).toBe(400);
  });

  it('stores an RFQ and lists it', async () => {
    const created = await (await app.request('/api/rfq', json('POST', rfq))).json() as { id: string; verifiedOnly: boolean };
    expect(created.id).toMatch(/^rfq-/);
    expect(created.verifiedOnly).toBe(false);
    expect(await (await app.request('/api/rfq')).json()).toHaveLength(1);
    expect((await app.request(`/api/rfq/${created.id}`)).status).toBe(200);
  });

  it('rejects an invalid RFQ', async () => {
    const r = await app.request('/api/rfq', json('POST', { ...rfq, quantity: -3 }));
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toContain('quantity');
  });

  it('streams the recorded demo in order and ends with a deal', async () => {
    const events = await readStream(await app.request('/api/negotiations/demo/stream'));
    expect(events.length).toBeGreaterThanOrEqual(10);
    expect(events[0]!.type).toBe('search');
    expect(events.some((e) => e.type === 'select' && e.offer?.status === 'proposed')).toBe(true);
    expect(events.some((e) => e.type === 'init' && e.offer?.status === 'rejected' && e.offer.reason)).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'end', outcome: 'deal' });
  });

  it('runs a started negotiation and keeps its log for late viewers', async () => {
    const n = await (await app.request('/api/negotiations', json('POST', { rfq, supplierIds: ['s13'] }))).json() as { id: string; status: string };
    expect(n.status).toBe('running');
    const live = await readStream(await app.request(`/api/negotiations/${n.id}/stream`));
    expect(live.at(-1)).toMatchObject({ type: 'end' });
    const late = await readStream(await app.request(`/api/negotiations/${n.id}/stream`));
    expect(late).toEqual(live);
    const done = await (await app.request(`/api/negotiations/${n.id}`)).json() as { status: string; outcome: string; events: unknown[] };
    expect(done).toMatchObject({ status: 'done', outcome: 'deal' });
    expect(done.events).toHaveLength(live.length);
  });

  it('runs live agents when a model is available and streams them', async () => {
    const ask = (async (o: { system: string }) => (o.system.includes('Auditor') ? { decision: 'pass', text: 'ok' } : (() => { throw new Error('no model'); })())) as never;
    const live = createApp(openDb(':memory:'), { ask });
    const n = await (await live.request('/api/negotiations', json('POST', { rfq: { ...rfq, buyerCountry: 'IN', budget: { amount: 6_000_000, currency: 'INR' }, part: 'EV scooter wiring harness (assembly and test)', quantity: 8000, needBy: '2099-01-01' }, supplierIds: ['s13'] }))).json() as { id: string; mode: string };
    expect(n.mode).toBe('live');
    const events = await readStream(await live.request(`/api/negotiations/${n.id}/stream`));
    expect(events.at(-1)).toMatchObject({ type: 'end', outcome: 'deal' });
    expect(events.some((e) => e.type === 'audit')).toBe(true);
  });

  it('404s an unknown negotiation', async () => {
    expect((await app.request('/api/negotiations/nope/stream')).status).toBe(404);
  });

  it('saves a workforce profile and drops fields it should not hold', async () => {
    const r = await app.request('/api/suppliers/s13/workforce', json('PUT', { ...workforce, phone: '9999999999', aadhaar: '1234' }));
    expect(r.status).toBe(200);
    const saved = await (await app.request('/api/suppliers/s13/workforce')).json() as Record<string, unknown>;
    expect(saved).toMatchObject({ supplierId: 's13', district: 'Krishnagiri' });
    expect(saved).not.toHaveProperty('phone');
    expect(saved).not.toHaveProperty('aadhaar');
  });

  it('serves the demo scorecard and 404s the rest', async () => {
    expect(((await (await app.request('/api/scorecard/s13')).json()) as { grade: string }).grade).toBe('B');
    expect((await app.request('/api/scorecard/s1')).status).toBe(404);
  });
});

describe('P4 routes on the shared store', () => {
  let app: ReturnType<typeof createApp>;
  beforeEach(() => { app = createApp(openDb(':memory:')); });

  it('signs a credential, keeps it, and tells a changed one from a genuine one', async () => {
    const cred = await (await app.request('/api/credentials/sign', json('POST', { type: 'SkillCredential', subject: { skill: 'Crimping', headcount: 40 } }))).json() as { id: string; subject: Record<string, unknown> };
    expect(cred.id).toBeTruthy();
    expect(await (await app.request('/api/credentials/verify', json('POST', cred))).json()).toMatchObject({ ok: true });
    expect((await app.request(`/api/credentials/${cred.id}`)).status).toBe(200);
    const forged = { ...cred, subject: { ...cred.subject, headcount: 400 } };
    expect(await (await app.request('/api/credentials/verify', json('POST', forged))).json()).toMatchObject({ ok: false });
  });

  it('takes an anonymous grievance and ignores anything that identifies the reporter', async () => {
    const r = await app.request('/api/grievances', json('POST', { id: 'g1', sellerId: 's13', category: 'wages', text: 'Paid late', at: '2026-10-24', name: 'Asha', phone: '9999999999' }));
    expect(r.status).toBe(201);
    const list = await (await app.request('/api/grievances')).json() as Record<string, unknown>[];
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('phone');
    expect(list[0]).not.toHaveProperty('name');
  });

  it('counts a confirmed agent deal in the SDG 8 impact figures', async () => {
    const ask = (async (o: { system: string }) => (o.system.includes('Auditor') ? { decision: 'pass', text: 'ok' } : (() => { throw new Error('no model'); })())) as never;
    const live = createApp(openDb(':memory:'), { ask });
    const n = await (await live.request('/api/negotiations', json('POST', { rfq: { ...rfq, buyerCountry: 'IN', budget: { amount: 14_000_000, currency: 'INR' }, part: 'EV scooter wiring harness (assembly and test)', quantity: 8000, needBy: '2099-01-01' }, supplierIds: ['s12'] }))).json() as { id: string };
    await readStream(await live.request(`/api/negotiations/${n.id}/stream`));
    const impact = await (await live.request('/api/impact')).json() as { deals: { sellerId: string; valueInr: number; workers: number }[] };
    expect(impact.deals).toHaveLength(1);
    expect(impact.deals[0]).toMatchObject({ sellerId: 's12' });
    expect(impact.deals[0]!.valueInr).toBeGreaterThan(0);
  });
});
