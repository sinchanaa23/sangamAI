// Rules the brief asks code (not the model) to enforce: price floor, fail-closed wages, quote-time gate, ranking, runner-up.
// Scripted `ask`, in-memory database, no network.
import { describe, expect, it } from 'vitest';
import { sellers } from '../../src/data';
import type { NegotiationEvent, Offer, Rfq, WorkforceProfile } from '../../src/contracts';
import { openDb } from '../db';
import type { Db } from '../db';
import type { Ask } from '../llm';
import { runNegotiation } from './orchestrator';
import { audit } from './auditor';
import { buildContext, ensureDataset, minViablePrice, pickLine, priceFloor, reviewReasons, termsOf, wageFloorFor } from './tools';

const rfq = (over: Partial<Rfq> = {}): Rfq => ({
  id: 'rfq-t', buyerId: 'veer', buyerCountry: 'IN', part: 'EV scooter wiring harness (assembly and test)', quantity: 8000,
  needBy: '2099-01-01', budget: { amount: 6_000_000, currency: 'INR' }, verifiedOnly: false, ...over,
});
const noModel: Ask = () => Promise.reject(new Error('model unavailable'));
const reply = (v: unknown) => v as never;

async function run(ask: Ask, suppliers: string[], r = rfq(), setup?: (db: Db) => void) {
  const db = openDb(':memory:');
  setup?.(db);
  const events: NegotiationEvent[] = [];
  await runNegotiation('neg-test', r, suppliers, { ask, db, emit: (e) => events.push(e) });
  return events;
}
const offers = (events: NegotiationEvent[]) => events.flatMap((e) => ('offer' in e && e.offer ? [{ e, o: e.offer }] : []));
const ctxFor = (id: string, r = rfq()) => { ensureDataset(); return buildContext(r, sellers.find((s) => s.id === id)!, pickLine(r.part), openDb(':memory:')); };
const profile = (id: string, over: Partial<WorkforceProfile>) => (db: Db) => db.put('workforce', {
  id, supplierId: id, district: 'x', skills: [{ skill: 'crimping', headcount: 50, wagePerWorkerDay: 700 }], hoursPerDay: 8, overtimeHoursPerWeek: 0,
  safetyRecord: 'complete', trainingHoursPerYear: 0, womenEmployed: 20, childOrForcedLabourFlag: false, openGrievances: 0, updatedAt: '', ...over,
} as never);

describe('price floor (1.2)', () => {
  it('is built from labour at the wage floor plus materials and overhead, each part tagged', () => {
    const c = ctxFor('s13');
    const t = { workers: 54, productionDays: 87, pricePerUnit: 700 };
    const f = priceFloor(c, t);
    expect(f.perUnit).toBe(minViablePrice(c, t));
    expect(f.parts.map((p) => p.label)).toEqual(['labour at the wage floor', 'materials and overhead']);
    expect(f.parts.every((p) => ['public', 'estimated', 'simulated'].includes(p.tag))).toBe(true);
    expect(f.parts.find((p) => p.label.startsWith('materials'))!.tag).toBe('estimated');
    expect(f.text).toContain(`₹${f.perUnit}`);
  });

  it('refuses a counter below the floor (shown with the floor), then clamps it to the floor', async () => {
    // The scripted supplier opens at ₹800 and accepts any counter; the scripted buyer demands ₹300 a unit.
    const ask: Ask = async (o) => {
      if (o.system.includes('Supplier Agent')) return o.user.includes('opening quote')
        ? reply({ action: 'offer', pricePerUnit: 800, workers: 54, productionDays: 87, message: 'Opening quote.' })
        : reply({ action: 'accept', pricePerUnit: 0, workers: 0, productionDays: 0, message: 'Accepted.' });
      if (o.system.includes('Buyer Agent')) return reply({ action: 'counter', pricePerUnit: 300, productionDays: 87, message: 'Far too expensive.' });
      return reply({ decision: 'pass', text: 'ok' });
    };
    const events = await run(ask, ['s13']);
    const buyerOffers = offers(events).filter(({ e }) => 'from' in e && e.from === 'buyer');
    const refused = buyerOffers.find(({ o }) => o.status === 'rejected');
    expect(refused?.o.reason).toMatch(/price floor/i);
    const c = ctxFor('s13');
    const clamped = buyerOffers.find(({ o }) => o.status === 'countered')!.o;
    const floor = minViablePrice(c, termsOf(c, clamped));
    expect(termsOf(c, clamped).pricePerUnit).toBeGreaterThanOrEqual(floor);
    expect(termsOf(c, clamped).pricePerUnit).toBeLessThanOrEqual(floor + 1);
    const accepted = offers(events).find(({ o }) => o.status === 'accepted')!.o;
    expect(termsOf(c, accepted).pricePerUnit).toBeGreaterThanOrEqual(floor);
    expect(accepted.labour.wagePerWorkerDay).toBeGreaterThanOrEqual(c.wageFloor);
  });
});

describe('missing minimum-wage data fails closed (1.3)', () => {
  it('a Tamil Nadu supplier (no minimum wage on file) gets the living wage as an estimated floor and goes to review', async () => {
    const f = wageFloorFor('krishnagiri');
    expect(f.legalMinimum.basis).toBe('estimated');
    expect(f.perDay).toBeGreaterThan(0);
    expect(f.perDay).toBe(f.livingWage.perDay);
    const c = ctxFor('s13');
    expect(reviewReasons(c).join(' ')).toContain('minimum wage');
    // A state with a notified minimum is not sent to review for that reason
    expect(reviewReasons(ctxFor('s14')).join(' ')).not.toContain('minimum wage');
    // The Auditor cannot pass it, whatever the model says
    const events = await run(async (o) => (o.system.includes('Auditor') ? reply({ decision: 'pass', text: 'ok' }) : Promise.reject(new Error('rules'))), ['s13']);
    expect(events.find((e) => e.type === 'audit')).toMatchObject({ decision: 'flag' });
    const last = events.filter((e) => e.type === 'confirm').at(-1) as { text: string };
    expect(last.text).toContain('minimum wage');
  });
});

describe('quote-time gate (1.1)', () => {
  it('blocks a supplier with a child or forced labour flag before the buyer sees its quote', async () => {
    const events = await run(noModel, ['s12', 's14', 's19'], rfq({ budget: { amount: 14_000_000, currency: 'INR' } }), profile('s14', { childOrForcedLabourFlag: true }));
    const s14 = offers(events).filter(({ o }) => o.supplierId === 's14');
    expect(s14.length).toBeGreaterThan(0);
    expect(s14.every(({ o }) => o.status === 'rejected')).toBe(true);
    expect(s14[0]!.o.reason).toMatch(/child|forced/i);
    const accepted = offers(events).find(({ o }) => o.status === 'accepted')!.o;
    expect(accepted.supplierId).not.toBe('s14');
    // The final audit stays the only audit event, so screens that read the first one still show the real result
    expect(events.filter((e) => e.type === 'audit')).toHaveLength(1);
    expect(events.indexOf(events.find((e) => e.type === 'audit')!)).toBeGreaterThan(events.findIndex((e) => e.type === 'select' && e.from === 'buyer'));
  });
});

describe('best, not cheapest (1.4)', () => {
  it('ranks a better-graded offer above a cheaper one with grade D and a certificate gap, and lists the whole shortlist', async () => {
    // s14 is the cheapest of the three; give it unlawful hours (grade D). It also lacks one required certificate.
    const events = await run(noModel, ['s12', 's14', 's19'], rfq({ budget: { amount: 14_000_000, currency: 'INR' } }), profile('s14', { hoursPerDay: 13 }));
    const quotes = offers(events).filter(({ e, o }) => e.type === 'select' && 'from' in e && e.from === 'supplier' && o.status === 'proposed');
    const cheapest = [...quotes].sort((a, b) => a.o.price.amount - b.o.price.amount)[0]!.o;
    expect(cheapest.supplierId).toBe('s14');
    const shortlist = events.find((e) => e.type === 'select' && e.from === 'buyer') as { text: string; offer?: Offer };
    expect(shortlist.offer!.supplierId).not.toBe('s14');
    expect(shortlist.text.split('\n').length).toBeGreaterThanOrEqual(3);
    expect(shortlist.text.indexOf('Satara')).toBeGreaterThan(shortlist.text.indexOf('1.'));
    const accepted = offers(events).find(({ o }) => o.status === 'accepted')!.o;
    expect(accepted.supplierId).not.toBe('s14');
  });
});

describe('runner-up (1.5)', () => {
  it('moves to the next option when the chosen supplier walks away', async () => {
    let walks = 0;
    const ask: Ask = async (o) => {
      if (o.system.includes('Supplier Agent')) {
        if (o.user.includes('opening quote')) return Promise.reject(new Error('rules for the opening quote'));
        if (walks++ === 0) return reply({ action: 'walk', pricePerUnit: 0, workers: 0, productionDays: 0, message: 'We cannot go lower and still pay our workers fairly.' });
        return reply({ action: 'accept', pricePerUnit: 0, workers: 0, productionDays: 0, message: 'Accepted.' });
      }
      if (o.system.includes('Buyer Agent')) return reply({ action: 'counter', pricePerUnit: 300, productionDays: 30, message: 'Too expensive.' });
      return reply({ decision: 'pass', text: 'ok' });
    };
    const events = await run(ask, ['s12', 's19'], rfq({ budget: { amount: 14_000_000, currency: 'INR' } }));
    const walkedAway = events.find((e) => e.type === 'init' && /walked away|cannot go lower/i.test(e.text));
    expect(walkedAway).toBeTruthy();
    const moved = events.find((e) => e.type === 'select' && e.from === 'buyer' && /next option/i.test(e.text));
    expect(moved).toBeTruthy();
    expect(events.at(-1)).toMatchObject({ type: 'end', outcome: 'deal' });
    const negotiatedWith = new Set(offers(events).filter(({ o }) => o.round >= 2).map(({ o }) => o.supplierId));
    expect(negotiatedWith.size).toBe(2);
  });

  it('does not let a supplier walk away from a price well above its floor', async () => {
    const ask: Ask = async (o) => {
      if (o.system.includes('Supplier Agent')) return o.user.includes('opening quote')
        ? Promise.reject(new Error('rules'))
        : reply({ action: 'walk', pricePerUnit: 0, workers: 0, productionDays: 0, message: 'We walk.' });
      if (o.system.includes('Buyer Agent')) return Promise.reject(new Error('rules'));
      return reply({ decision: 'pass', text: 'ok' });
    };
    // The rule-based buyer counters at 90% of a generous budget: far above the supplier's floor, so a walk is refused and a counter follows
    const events = await run(ask, ['s12'], rfq({ budget: { amount: 5_400_000, currency: 'INR' } }));
    expect(events.some((e) => e.type === 'select' && e.from === 'buyer' && /walked away/.test(e.text))).toBe(false);
  });

  it('ends with no deal when nobody on the shortlist can reach a deal', async () => {
    const events = await run(noModel, ['s12', 's19'], rfq({ budget: { amount: 500_000, currency: 'INR' } }));
    expect(events.at(-1)).toMatchObject({ type: 'end', outcome: 'no-deal' });
  });
});

describe('the Auditor words match the grade the code computed', () => {
  it('replaces a wrong grade the model wrote with the real one', async () => {
    const c = ctxFor('s13');
    const offer = { id: 'o', rfqId: 'r', supplierId: 's13', round: 3, price: { amount: 5_000_000, currency: 'INR' as const }, leadTimeDays: 40,
      labour: { workers: 54, workerDays: 4698, wagePerWorkerDay: 800, hoursPerDay: 8, womenShare: 0, district: 'Krishnagiri' }, status: 'accepted' as const };
    const score = { supplierId: 's13', grade: 'B' as const, wageVsMinimum: 0, wageVsLivingWage: 1.4, overtimeHours: 0, safety: 0, womenShare: 0, childLabourFlag: false, benchmarkSource: 'x' };
    const wrong: Ask = async () => reply({ decision: 'flag', text: 'The supplier is assigned a grade of C because the safety record is missing.' });
    const v = await audit(wrong, c, offer, score, ['IPC/WHMA-A-620 training: not held']);
    expect(v.text).toContain('grade of B');
    expect(v.text).not.toMatch(/grade of C/i);
  });
});
