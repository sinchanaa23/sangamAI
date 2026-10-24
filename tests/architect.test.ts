// AI Supply Chain Architect: the plan is built from Sangam's data, keeps fair wages, and labels what it does not know.
import { beforeAll, describe, expect, it } from 'vitest';
import { bom, districts, loadDataset } from '../src/data';
import { livingWageFor } from '../src/fairwork';
import { buildPlan, matchIdea, rankRegions } from '../src/architect/engine';
import type { ArchitectInput } from '../src/architect/engine';
import { createApp } from '../server/app';
import { openDb } from '../server/db';

const base: ArchitectInput = { lineId: 'assembly', districtId: 'krishnagiri', capacityPerMonth: 5000, budgetLakh: 50, buyerCountry: 'IN', emphasis: 'balanced' };

describe('architect engine', () => {
  beforeAll(() => loadDataset('ev'));

  it('builds every stage of the chain, from raw materials to buyers', () => {
    const p = buildPlan(base)!;
    const kinds = new Set(p.stages.map((s) => s.kind));
    for (const k of ['processing', 'manufacturing', 'logistics', 'buyer'] as const) expect(kinds.has(k)).toBe(true);
    // every edge points at a stage that exists
    const ids = new Set(p.stages.map((s) => s.id));
    p.stages.forEach((s) => s.next.forEach((n) => expect(ids.has(n)).toBe(true)));
  });

  it('pays at least the living wage by default and grades the plan with the Fair Work rules', () => {
    const p = buildPlan(base)!;
    expect(p.workforce.wage.value).toBe(livingWageFor('Krishnagiri')!.perDayInr);
    expect(['A', 'B']).toContain(p.workforce.score.grade);
  });

  it('flags a wage below the living wage as a high risk and lowers the grade', () => {
    const p = buildPlan({ ...base, wagePerDay: 300 })!;
    expect(p.risks.some((r) => r.level === 'high' && /living wage/.test(r.text))).toBe(true);
    expect(['C', 'D']).toContain(p.workforce.score.grade);
    expect(p.workforce.wage.tag).toBe('assumption');
  });

  it('does not invent a cost for India-first when an input has no proven Indian supply', () => {
    const p = buildPlan({ ...base, lineId: 'connectors' })!; // engineering plastics and plating chemicals are weak in India
    const india = p.scenarios.find((s) => s.id === 'india')!;
    expect(india.costPerUnit).toBeNull();
    expect(india.notes.join(' ')).toMatch(/not estimated/i);
  });

  it('ranks every district and recommends one when none is chosen', () => {
    const line = bom.find((l) => l.id === 'assembly')!;
    const r = rankRegions(line, { buyerCountry: 'IN', emphasis: 'rural' });
    expect(r).toHaveLength(districts.length);
    expect(r[0].score).toBeGreaterThanOrEqual(r[r.length - 1].score);
    expect(buildPlan({ ...base, districtId: '' })!.region.district.id).toBe(r.length ? rankRegions(line, { buyerCountry: 'IN', emphasis: 'balanced' })[0].district.id : '');
  });

  it('routes exports through a port and counts the duty the buyer sets', () => {
    const noDuty = buildPlan({ ...base, buyerCountry: 'DE' })!;
    const duty = buildPlan({ ...base, buyerCountry: 'DE', importDutyPct: 10 })!;
    expect(noDuty.stages.some((s) => s.kind === 'logistics' && /Rotterdam/.test(s.place))).toBe(true);
    expect(duty.economics.freight.value).toBeGreaterThan(noDuty.economics.freight.value);
  });

  it('matches a free-text idea to the catalogue without AI', () => {
    expect(matchIdea('a cooperative doing harness assembly').lineIds[0]).toBe('assembly');
  });
});

describe('architect AI route', () => {
  const post = (app: ReturnType<typeof createApp>, body: unknown) =>
    app.request('/api/architect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('says AI is off when no model is configured, so the page carries on without it', async () => {
    const saved = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;
    const res = await post(createApp(openDb(':memory:')), { task: 'review', facts: 'Business: make harnesses in Krishnagiri.' });
    expect(res.status).toBe(503);
    if (saved !== undefined) process.env.LLM_API_KEY = saved;
  });

  it('drops a catalogue id the model made up', async () => {
    const ask = async () => ({ matchLineId: 'not-a-part', why: 'x', stages: [], questions: [] }) as never;
    const res = await post(createApp(openDb(':memory:'), { ask }), { task: 'idea', idea: 'solar cables', sector: 'ev', catalogue: [{ id: 'assembly', name: 'Harness', process: 'Harness assembly', spec: '' }] });
    expect(res.status).toBe(200);
    expect((await res.json()).matchLineId).toBeNull();
  });

  it('rejects a malformed request', async () => {
    const res = await post(createApp(openDb(':memory:')), { task: 'review' });
    expect(res.status).toBe(400);
  });
});
