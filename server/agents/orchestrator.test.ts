import { describe, expect, it } from 'vitest';
import type { NegotiationEvent, Offer, Rfq } from '../../src/contracts';
import { openDb } from '../db';
import type { Ask } from '../llm';
import { MAX_ROUNDS, runNegotiation } from './orchestrator';
import { wageFloorPerDay } from './tools';

const rfq = (over: Partial<Rfq> = {}): Rfq => ({
  id: 'rfq-t', buyerId: 'veer', buyerCountry: 'IN', part: 'EV scooter wiring harness (assembly and test)', quantity: 8000,
  needBy: '2099-01-01', budget: { amount: 6_000_000, currency: 'INR' }, verifiedOnly: false, ...over,
});

const run = async (ask: Ask, r = rfq(), suppliers = ['s13']) => {
  const events: NegotiationEvent[] = [];
  await runNegotiation('neg-test', r, suppliers, { ask, db: openDb(':memory:'), emit: (e) => events.push(e) });
  return events;
};
const offers = (events: NegotiationEvent[]) => events.flatMap((e) => ('offer' in e && e.offer ? [e.offer] : []));
const noModel: Ask = () => Promise.reject(new Error('model unavailable'));

/** A scripted model: a supplier that quotes ₹800 and accepts any counter, a buyer that demands a price far below the wage floor. */
const scripted: Ask = async (o) => {
  const reply = (v: unknown) => v as never;
  if (o.system.includes('Supplier Agent')) {
    return o.user.includes('opening quote')
      ? reply({ action: 'offer', pricePerUnit: 800, workers: 54, productionDays: 87, message: 'Opening quote.' })
      : reply({ action: 'accept', pricePerUnit: 0, workers: 0, productionDays: 0, message: 'Accepted.' });
  }
  if (o.system.includes('Buyer Agent')) return reply({ action: 'counter', pricePerUnit: 300, productionDays: 87, message: 'Far too expensive.' });
  return reply({ decision: 'pass', text: 'Wage is above the floor.' });
};

describe('orchestrator', () => {
  it('reaches a deal on rules alone when the model is unavailable', async () => {
    const events = await run(noModel);
    expect(events.at(-1)).toMatchObject({ type: 'end', outcome: 'deal' });
    expect(events.some((e) => e.type === 'audit')).toBe(true);
  });

  it('refuses an offer below the wage floor before the other side sees it, then still closes a fair deal', async () => {
    const events = await run(scripted, rfq({ budget: { amount: 5_000_000, currency: 'INR' } }));
    const rejected = offers(events).filter((o) => o.status === 'rejected');
    expect(rejected.length).toBeGreaterThan(0);
    expect(rejected[0]!.reason).toContain('living-wage floor');
    expect(rejected.every((o) => o.labour.wagePerWorkerDay < wageFloorPerDay('krishnagiri'))).toBe(true);
    const accepted = offers(events).find((o) => o.status === 'accepted') as Offer;
    expect(accepted.labour.wagePerWorkerDay).toBeGreaterThanOrEqual(wageFloorPerDay('krishnagiri'));
    expect(events.at(-1)).toMatchObject({ type: 'end', outcome: 'deal' });
  });

  it('never goes past the round limit or accepts an offer below the wage floor', async () => {
    const events = await run(scripted);
    expect(Math.max(...offers(events).map((o) => o.round))).toBeLessThanOrEqual(MAX_ROUNDS);
    offers(events).filter((o) => o.status !== 'rejected').forEach((o) => expect(o.labour.wagePerWorkerDay).toBeGreaterThanOrEqual(wageFloorPerDay('krishnagiri')));
  });

  it('ends with no deal when the budget cannot cover a living wage', async () => {
    const events = await run(noModel, rfq({ budget: { amount: 1_000_000, currency: 'INR' } }));
    expect(events.at(-1)).toMatchObject({ type: 'end', outcome: 'no-deal' });
    expect(offers(events).some((o) => o.status === 'accepted')).toBe(false);
  });

  it('keeps going if the model returns garbage', async () => {
    const events = await run((async () => ({ nonsense: true })) as unknown as Ask);
    expect(events.at(-1)?.type).toBe('end');
  });

  it('says so when no supplier matches', async () => {
    const events = await run(noModel, rfq(), ['does-not-exist']);
    expect(events.at(-1)).toMatchObject({ type: 'end', outcome: 'no-deal' });
  });
});
