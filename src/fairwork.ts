// Fair Work Scorecard: the wage per worker-day is compared with the state minimum
// wage and the GLWC living-wage benchmark for the district; hours, safety record,
// open grievances and child/forced-labour flags move the grade. Every threshold
// lives in FAIR_WORK_RULES below so the team can tune the rules in one place.
//
// The shared types mirror src/contracts.ts (P1, feat/agents). When contracts.ts
// merges to main, switch these declarations to `import type` re-exports from it;
// the shapes are kept identical so nothing else changes.

import districtsFile from './geo/districts.json';
import wagesFile from './real/wages.json';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

/** One skill group. Workers are stored by skill and wage only: no names, phones or Aadhaar. */
export interface WorkforceSkill {
  skill: string;
  headcount: number;
  wagePerWorkerDay: number; // INR
}

export interface WorkforceProfile {
  supplierId: string;
  district: string;
  skills: WorkforceSkill[];
  hoursPerDay: number;
  overtimeHoursPerWeek: number;
  safetyRecord: 'complete' | 'partial' | 'none';
  trainingHoursPerYear: number;
  womenEmployed: number;
  childOrForcedLabourFlag: boolean;
  openGrievances: number;
  updatedAt: string;
}

export interface LabourPlan {
  workers: number;
  workerDays: number;
  wagePerWorkerDay: number; // INR
  hoursPerDay: number;
  womenShare: number; // 0 to 1
  district: string;
}

export interface FairWorkScore {
  supplierId: string;
  grade: Grade;
  wageVsMinimum: number;
  wageVsLivingWage: number;
  overtimeHours: number;
  safety: number;
  womenShare: number;
  childLabourFlag: boolean;
  benchmarkSource: string;
}

/** A score plus the human-readable reasons and benchmark detail the badge and pages show. */
export interface ScoredWork extends FairWorkScore {
  reasons: string[];
  benchmarkTag: 'public' | 'estimated';
  livingWagePerDayInr: number | null;
  minimumWagePerDayInr: number | null;
  wagePerWorkerDay: number;
}

/** The one table of grading rules. Tune here, nowhere else. */
export const FAIR_WORK_RULES = {
  /** share of the living wage that still earns a B */
  bShareOfLivingWage: 0.9,
  /** working days a month, used to convert monthly benchmarks to per-day */
  monthlyWorkingDays: 26,
  /** regular hours a day; anything longer counts towards overtime */
  regularHoursPerDay: 9,
  /** daily ceiling including overtime; above this the hours are over the legal limit (grade D) */
  maxHoursPerDay: 12,
  /** weekly overtime ceiling; above this the hours are over the legal limit (grade D) */
  maxOvertimeHoursPerWeek: 24,
} as const;

export const GRADE_LABEL: Record<Grade, string> = {
  A: 'Living wage met',
  B: 'Near living wage',
  C: 'Above minimum wage',
  D: 'Below fair-work floor',
  E: 'Blocked',
};

const ORDER: Grade[] = ['A', 'B', 'C', 'D', 'E'];
const stepDown = (g: Grade): Grade => ORDER[Math.min(ORDER.indexOf(g) + 1, ORDER.indexOf('D'))];

// ---------- benchmark data ----------

interface DistrictRow { id: string; name: string; state: string; lat: number; lon: number }
const DISTRICTS = districtsFile as DistrictRow[];

interface LivingWageRow {
  id: string; region: string; kind: 'rural' | 'urban';
  district: string | null; state: string; lat: number; lon: number;
  monthlyInr: number; year: number; estimateLabel: string; sourceUrl: string;
}
const LIVING = wagesFile.livingWages as LivingWageRow[];

interface MinimumWageRow {
  state: string; notifiedInr: number | null; unit: 'day' | 'month' | null;
  effectiveDate: string | null; sourceUrl: string | null; sourceType: string | null;
}
const MINIMUMS = wagesFile.minimumWages as MinimumWageRow[];

const norm = (s: string) => s.trim().toLowerCase();
const kmBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = 6371, rad = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
};

/** Resolve a district name or id to its row (name matching tolerates "Chakan, Pune" style names). */
export function findDistrict(district: string): DistrictRow | null {
  const n = norm(district);
  if (!n) return null;
  return DISTRICTS.find((d) => norm(d.id) === n || norm(d.name) === n || norm(d.name.split(',')[0]) === n) ?? null;
}

/**
 * Districts treated as urban for benchmark matching; the rest are rural. Matches the
 * rural flag the sector templates already use (Krishnagiri, Madurai, Dharwad, Satara,
 * Anantapur are the rural cluster story districts). Tune here if a district is miscast.
 */
const URBAN_DISTRICT_IDS = new Set([
  'hosur', 'chennai', 'coimbatore', 'tiruppur', 'tumakuru', 'mysuru', 'pune', 'nashik', 'aurangabad', 'nagpur',
  'silvassa', 'vapi', 'rajkot', 'sanand', 'manesar', 'noida', 'lucknow', 'ludhiana', 'pithampur', 'jamshedpur',
  'howrah', 'khordha', 'visakhapatnam', 'vijayawada', 'kochi', 'guwahati', 'agartala',
]);

const kindOf = (row: DistrictRow): 'rural' | 'urban' => (URBAN_DISTRICT_IDS.has(row.id) ? 'urban' : 'rural');

export interface LivingWageRef {
  perDayInr: number;
  region: string;
  year: number;
  estimateLabel: string;
  sourceUrl: string;
  /** how the district was matched: its own benchmark, a state-wide one, or the nearest same-kind one */
  match: 'district' | 'state' | 'nearest';
  source: string;
}

/** Living-wage benchmark for a district: its own if it has one, else state-wide, else the nearest of the same kind (rural/urban), tagged estimated. */
export function livingWageFor(district: string): LivingWageRef | null {
  const row = findDistrict(district);
  if (!row) return null;
  const kind = kindOf(row);
  const n = norm(district);
  const sameKind = LIVING.filter((b) => b.kind === kind);
  const exact = sameKind.find((b) => b.district && (norm(b.district) === n || norm(b.district) === norm(row.name) || norm(b.district) === norm(row.name.split(',')[0])));
  const byDist = (list: LivingWageRow[]) =>
    list.slice().sort((a, b) => kmBetween(row.lat, row.lon, a.lat, a.lon) - kmBetween(row.lat, row.lon, b.lat, b.lon))[0];
  const pick = exact
    ?? byDist(sameKind.filter((b) => b.state === row.state && b.district === null))   // state-wide benchmark of the same kind
    ?? byDist(sameKind.filter((b) => b.state === row.state))                          // nearest in the same state
    ?? byDist(sameKind);                                                              // nearest anywhere, same kind
  if (!pick) return null;
  const match: LivingWageRef['match'] = exact ? 'district' : pick.district === null ? 'state' : 'nearest';
  const how = match === 'district' ? '' : match === 'state' ? ` (state benchmark for ${pick.state})` : ` (nearest ${kind} benchmark)`;
  return {
    perDayInr: Math.round(pick.monthlyInr / FAIR_WORK_RULES.monthlyWorkingDays),
    region: pick.region,
    year: pick.year,
    estimateLabel: pick.estimateLabel,
    sourceUrl: pick.sourceUrl,
    match,
    source: `GLWC ${pick.region}, ${pick.estimateLabel} (₹${pick.monthlyInr.toLocaleString('en-IN')}/month)${how} — globallivingwage.org`,
  };
}

export interface MinimumWageRef {
  perDayInr: number;
  asNotified: string;
  effectiveDate: string | null;
  sourceUrl: string | null;
}

/** State minimum wage per worker-day, or null when the rate is not on file (never guessed). */
export function minimumWageFor(district: string): MinimumWageRef | null {
  const row = findDistrict(district);
  if (!row) return null;
  const m = MINIMUMS.find((x) => x.state === row.state);
  if (!m || m.notifiedInr == null || !m.unit) return null;
  const perDay = m.unit === 'month' ? m.notifiedInr / FAIR_WORK_RULES.monthlyWorkingDays : m.notifiedInr;
  return {
    perDayInr: Math.round(perDay),
    asNotified: `₹${m.notifiedInr.toLocaleString('en-IN')} per ${m.unit === 'month' ? 'month' : 'day'}${m.effectiveDate ? `, effective ${m.effectiveDate}` : ''}`,
    effectiveDate: m.effectiveDate,
    sourceUrl: m.sourceUrl,
  };
}

// ---------- scoring ----------

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Grade a labour plan against the fair-work rules. The profile supplies the
 * supplier's safety record, overtime, flags and grievances; the labour plan
 * carries the wage, hours, district and women's share being graded.
 */
export function scoreFairWork(labour: LabourPlan, profile: WorkforceProfile): ScoredWork {
  const district = labour.district || profile.district;
  const living = livingWageFor(district);
  const min = minimumWageFor(district);
  const wage = labour.wagePerWorkerDay;
  const reasons: string[] = [];

  const livingPerDay = living?.perDayInr ?? null;
  const minPerDay = min?.perDayInr ?? null;

  let grade: Grade;
  if (minPerDay != null && wage < minPerDay) {
    // the legal floor comes first: below the state minimum is D whatever the living-wage ladder says
    grade = 'D';
  } else if (livingPerDay != null && wage >= livingPerDay) {
    grade = 'A';
  } else if (livingPerDay != null && wage >= FAIR_WORK_RULES.bShareOfLivingWage * livingPerDay) {
    grade = 'B';
  } else if (livingPerDay == null) {
    // no living-wage benchmark for this district: grade against the minimum wage only, capped at C
    grade = 'C';
    reasons.push('No living-wage benchmark for this district; the grade is capped at C until one is added.');
  } else {
    grade = 'C';
  }

  const overHours = labour.hoursPerDay > FAIR_WORK_RULES.maxHoursPerDay
    || profile.overtimeHoursPerWeek > FAIR_WORK_RULES.maxOvertimeHoursPerWeek;
  if (overHours) grade = 'D';

  if (livingPerDay != null) {
    reasons.push(`Wage ${inr(wage)}/worker-day is ${pct(wage / livingPerDay)} of the living wage (${inr(livingPerDay)}/day).`);
  }
  if (minPerDay != null) {
    reasons.push(wage >= minPerDay
      ? `Above the ${findDistrict(district)?.state ?? ''} minimum wage (${inr(minPerDay)}/day, ${min?.asNotified ?? ''}).`.replace('  ', ' ')
      : `Below the ${findDistrict(district)?.state ?? ''} minimum wage (${inr(minPerDay)}/day).`.replace('  ', ' '));
  } else {
    reasons.push('No state minimum wage on file for this district yet; add the notified rate to wages.json.');
  }
  reasons.push(overHours
    ? `Hours are over the legal limit: ${labour.hoursPerDay} h/day (ceiling ${FAIR_WORK_RULES.maxHoursPerDay}) or ${profile.overtimeHoursPerWeek} h overtime/week (ceiling ${FAIR_WORK_RULES.maxOvertimeHoursPerWeek}).`
    : `Hours ${labour.hoursPerDay}/day with ${profile.overtimeHoursPerWeek} h overtime a week are within the legal limit.`);

  if (profile.safetyRecord !== 'complete') {
    grade = stepDown(grade);
    reasons.push(`Safety record ${profile.safetyRecord === 'none' ? 'missing' : 'partial'}: grade lowered one step.`);
  } else {
    reasons.push('Safety record complete.');
  }
  if (profile.openGrievances > 0) {
    grade = stepDown(grade);
    reasons.push(`${profile.openGrievances} open grievance${profile.openGrievances > 1 ? 's' : ''}: grade lowered one step until resolved.`);
  }
  if (profile.childOrForcedLabourFlag) {
    grade = 'E';
    reasons.push('Child- or forced-labour flag: the deal is blocked.');
  } else {
    reasons.push('No child- or forced-labour flags.');
  }
  reasons.push(`Women's share of workers: ${pct(labour.womenShare)} (reported, not graded).`);

  return {
    supplierId: profile.supplierId,
    grade,
    wageVsMinimum: minPerDay != null ? +(wage / minPerDay).toFixed(2) : -1,
    wageVsLivingWage: livingPerDay != null ? +(wage / livingPerDay).toFixed(2) : -1,
    overtimeHours: profile.overtimeHoursPerWeek,
    safety: profile.safetyRecord === 'complete' ? 1 : profile.safetyRecord === 'partial' ? 0.5 : 0,
    womenShare: labour.womenShare,
    childLabourFlag: profile.childOrForcedLabourFlag,
    benchmarkSource: living?.source ?? 'No living-wage benchmark on file for this district',
    reasons,
    benchmarkTag: living && living.match !== 'nearest' ? 'public' : 'estimated',
    livingWagePerDayInr: livingPerDay,
    minimumWagePerDayInr: minPerDay,
    wagePerWorkerDay: wage,
  };
}

/** Build the labour plan a supplier's workforce profile implies: headcount-weighted wage, women's share, nominal month. */
export function labourFromProfile(profile: WorkforceProfile): LabourPlan {
  const workers = profile.skills.reduce((n, s) => n + s.headcount, 0);
  const weighted = profile.skills.reduce((n, s) => n + s.headcount * s.wagePerWorkerDay, 0);
  const womenShare = workers > 0 ? Math.min(1, profile.womenEmployed / workers) : 0;
  return {
    workers,
    workerDays: workers * FAIR_WORK_RULES.monthlyWorkingDays,
    wagePerWorkerDay: workers > 0 ? Math.round(weighted / workers) : 0,
    hoursPerDay: profile.hoursPerDay,
    womenShare,
    district: profile.district,
  };
}

/** Convenience for pages: score a profile directly. */
export function scoreProfile(profile: WorkforceProfile): ScoredWork {
  return scoreFairWork(labourFromProfile(profile), profile);
}
