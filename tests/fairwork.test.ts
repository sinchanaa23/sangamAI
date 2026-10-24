// Tests for the Fair Work Scorecard: every grade, every downgrade rule, and the
// benchmark matching. The state minimum wage is not on file yet, so these tests
// set a known Tamil Nadu rate (₹400/day, the same order as notified rates) and
// restore it afterwards; the living-wage benchmarks are the real GLWC 2025 data.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import wagesFile from '../src/real/wages.json';
import {
  FAIR_WORK_RULES, labourFromProfile, livingWageFor, minimumWageFor, scoreFairWork, scoreProfile,
} from '../src/fairwork';
import type { LabourPlan, WorkforceProfile } from '../src/fairwork';

const tn = wagesFile.minimumWages.find((m) => m.state === 'Tamil Nadu')!;
let saved: typeof tn;

beforeEach(() => {
  saved = { ...tn };
  tn.notifiedInr = 400; tn.unit = 'day'; tn.effectiveDate = '2026-04-01'; tn.sourceUrl = 'https://example.gov.in/tn-minimum-wage'; tn.sourceType = 'official';
});
afterEach(() => { Object.assign(tn, saved); });

const profile = (over: Partial<WorkforceProfile> = {}): WorkforceProfile => ({
  supplierId: 's13', district: 'Krishnagiri', skills: [{ skill: 'Harness assembly', headcount: 40, wagePerWorkerDay: 500 }],
  hoursPerDay: 8, overtimeHoursPerWeek: 0, safetyRecord: 'complete', trainingHoursPerYear: 24,
  womenEmployed: 32, childOrForcedLabourFlag: false, openGrievances: 0, updatedAt: '2026-10-24T00:00:00Z',
  ...over,
});
const plan = (over: Partial<LabourPlan> = {}): LabourPlan => ({
  workers: 40, workerDays: 40 * 26, wagePerWorkerDay: 500, hoursPerDay: 8, womenShare: 0.8, district: 'Krishnagiri', ...over,
});

// Krishnagiri is rural Tamil Nadu: nearest rural benchmark is Nilgiris, ₹14,926 / 26 = ₹574/day.
const LIVING = Math.round(14926 / FAIR_WORK_RULES.monthlyWorkingDays);

describe('benchmark lookup', () => {
  it('uses the district own benchmark when it has one (Tiruppur)', () => {
    const ref = livingWageFor('Tiruppur')!;
    expect(ref.match).toBe('district');
    expect(ref.perDayInr).toBe(Math.round(19773 / 26));
  });

  it('uses a state benchmark of the same kind for rural Andhra districts', () => {
    const ref = livingWageFor('Anantapur')!;
    expect(ref.match).toBe('state');
    expect(ref.region).toBe('Rural Andhra Pradesh');
  });

  it('uses the nearest same-kind benchmark for a rural Tamil Nadu district, tagged estimated', () => {
    const ref = livingWageFor('Krishnagiri')!;
    expect(ref.match).toBe('nearest');
    expect(ref.region).toBe('Rural Nilgiris, Tamil Nadu');
    expect(ref.perDayInr).toBe(LIVING);
  });

  it('never guesses a minimum wage that is not on file', () => {
    expect(minimumWageFor('Kochi')).toBeNull(); // Kerala not verified
    expect(minimumWageFor('Krishnagiri')!.perDayInr).toBe(400);
  });

  it('loads the real notified rates that are on file', () => {
    expect(minimumWageFor('Silvassa')!.perDayInr).toBe(Math.round(12649 / 26)); // Dadra and Nagar Haveli
    expect(minimumWageFor('Pithampur')!.perDayInr).toBe(Math.round(12425 / 26)); // Madhya Pradesh
  });
});

describe('grades', () => {
  it('A: wage at or above the living wage, legal hours, complete safety, no flags', () => {
    const s = scoreFairWork(plan({ wagePerWorkerDay: LIVING }), profile());
    expect(s.grade).toBe('A');
    expect(s.wageVsLivingWage).toBe(1);
    expect(s.benchmarkTag).toBe('estimated'); // nearest benchmark, not the district own
  });

  it('A also holds above the living wage', () => {
    expect(scoreFairWork(plan({ wagePerWorkerDay: LIVING + 100 }), profile()).grade).toBe('A');
  });

  it('B: wage at least 90% of the living wage', () => {
    const s = scoreFairWork(plan({ wagePerWorkerDay: Math.round(0.9 * LIVING) }), profile());
    expect(s.grade).toBe('B');
    expect(s.wageVsLivingWage).toBeLessThan(1);
  });

  it('just under 90% of the living wage is C, not B', () => {
    expect(scoreFairWork(plan({ wagePerWorkerDay: Math.round(0.89 * LIVING) }), profile()).grade).toBe('C');
  });

  it('C: wage at or above the minimum wage but under 90% of the living wage', () => {
    const s = scoreFairWork(plan({ wagePerWorkerDay: 450 }), profile());
    expect(s.grade).toBe('C');
    expect(s.wageVsMinimum).toBeCloseTo(450 / 400, 2);
  });

  it('D: wage below the state minimum wage', () => {
    expect(scoreFairWork(plan({ wagePerWorkerDay: 380 }), profile()).grade).toBe('D');
  });

  it('D: below the state minimum even when above the living wage - the legal floor wins', () => {
    // Dharwad: rural benchmark Nilgiris ₹574/day, Karnataka lowest-zone minimum ₹743/day
    const s = scoreFairWork(plan({ wagePerWorkerDay: 700, district: 'Dharwad' }), profile({ district: 'Dharwad' }));
    expect(s.grade).toBe('D');
    expect(s.wageVsLivingWage).toBeGreaterThan(1);
    expect(s.wageVsMinimum).toBeLessThan(1);
  });

  it('D: hours over the legal daily limit, even at a living wage', () => {
    expect(scoreFairWork(plan({ wagePerWorkerDay: LIVING, hoursPerDay: FAIR_WORK_RULES.maxHoursPerDay + 1 }), profile()).grade).toBe('D');
  });

  it('D: overtime over the weekly ceiling', () => {
    expect(scoreFairWork(plan({ wagePerWorkerDay: LIVING }), profile({ overtimeHoursPerWeek: FAIR_WORK_RULES.maxOvertimeHoursPerWeek + 1 })).grade).toBe('D');
  });

  it('E: child- or forced-labour flag blocks the deal whatever the wage', () => {
    const s = scoreFairWork(plan({ wagePerWorkerDay: LIVING }), profile({ childOrForcedLabourFlag: true }));
    expect(s.grade).toBe('E');
    expect(s.childLabourFlag).toBe(true);
    expect(s.reasons.some((r) => r.includes('blocked'))).toBe(true);
  });
});

describe('downgrades', () => {
  it('a missing or partial safety record lowers the grade one step', () => {
    expect(scoreFairWork(plan({ wagePerWorkerDay: LIVING }), profile({ safetyRecord: 'partial' })).grade).toBe('B');
    expect(scoreFairWork(plan({ wagePerWorkerDay: LIVING }), profile({ safetyRecord: 'none' })).grade).toBe('B');
  });

  it('an open grievance lowers the grade one step', () => {
    expect(scoreFairWork(plan({ wagePerWorkerDay: LIVING }), profile({ openGrievances: 2 })).grade).toBe('B');
  });

  it('safety and grievances together lower two steps', () => {
    expect(scoreFairWork(plan({ wagePerWorkerDay: LIVING }), profile({ safetyRecord: 'none', openGrievances: 1 })).grade).toBe('C');
  });

  it('downgrades stop at D; only a flag gives E', () => {
    expect(scoreFairWork(plan({ wagePerWorkerDay: 450 }), profile({ safetyRecord: 'none', openGrievances: 3 })).grade).toBe('D');
  });
});

describe('profiles', () => {
  it('builds a headcount-weighted labour plan from a workforce profile', () => {
    const p = profile({ skills: [
      { skill: 'Harness assembly', headcount: 10, wagePerWorkerDay: 500 },
      { skill: 'Testing', headcount: 30, wagePerWorkerDay: 400 },
    ], womenEmployed: 20 });
    const l = labourFromProfile(p);
    expect(l.workers).toBe(40);
    expect(l.wagePerWorkerDay).toBe(425); // (10*500 + 30*400) / 40
    expect(l.womenShare).toBe(0.5);
    expect(l.workerDays).toBe(40 * FAIR_WORK_RULES.monthlyWorkingDays);
  });

  it('scoring a profile directly: changing a wage changes the grade', () => {
    const at = (wage: number) => scoreProfile(profile({ skills: [{ skill: 'Harness assembly', headcount: 40, wagePerWorkerDay: wage }] })).grade;
    expect(at(LIVING)).toBe('A');
    expect(at(Math.round(0.92 * LIVING))).toBe('B');
    expect(at(430)).toBe('C');
    expect(at(390)).toBe('D');
  });

  it('reports the benchmark source and women share without grading women', () => {
    const s = scoreProfile(profile());
    expect(s.benchmarkSource).toContain('GLWC');
    expect(s.benchmarkSource).toContain('Nilgiris');
    expect(s.reasons.some((r) => r.includes("Women's share"))).toBe(true);
    expect(s.womenShare).toBe(0.8);
  });
});
