// Tests for the Sangam ranking: the Fair Work E exclusion, the fixed-scale metric maths,
// weight handling (zero-sum safety, sustainability monotonicity) and fixed-scale stability.
// The minimum-level / hide-D / verified-only filters live on the Find-suppliers page, not
// in rankSuppliers, so they are not tested here.
import { describe, expect, it } from 'vitest';
import { fairWorkFor, DEFAULT_WEIGHTS, METRICS, PRESETS, RANKING_RULES, rankSuppliers } from '../src/ranking';
import type { MetricId } from '../src/ranking';
import { EMPTY } from '../src/model';
import type { Review } from '../src/model';
import { roadKm } from '../src/engine';
import { district } from '../src/engine';
import { trustScore } from '../src/trust';
import { CHECKLIST } from '../src/sustainability';
import type { SustainabilityAnswers } from '../src/sustainability';
import { buyer } from '../src/data';
import type { BomLine, Seller } from '../src/types';

// ---------- fixtures ----------

const line: BomLine = {
  id: 'l1', name: 'Test line', cost: 100, sharePct: 10, spec: 'Spec', importedFrom: 'China',
  process: 'Assembly', requiredCerts: [], weightKg: 0.5, tiers: [],
};

let seq = 0;
const seller = (over: Partial<Seller> = {}): Seller => {
  seq += 1;
  return {
    id: `t${seq}`, name: 'Plain Works', type: 'MSME', districtId: 'hosur', process: 'Assembly',
    monthlyCapacity: 5000, certs: ['ISO 9001'], priceIndex: 1, quality: 0.9, verification: 'verified',
    workers: 50, origin: 'simulated',
    details: {
      yearsInBusiness: 10, turnoverCr: 5, creditBand: 'A', utilisationPct: 60, defectPpm: 0, otifPct: 100,
      completedOrders: 30, machines: ['press'], certDetails: [], languages: ['English'], about: 'A steady parts maker.',
    },
    ...over,
  };
};

const review = (sellerId: string, stars: number): Review => ({
  id: `rv-${sellerId}-${stars}-${Math.random().toString(36).slice(2, 6)}`, sellerId,
  author: 'Buyer Ltd', authorType: 'buyer', orderRef: 'PO-2026-1', orderValueLakh: 10,
  ratings: { quality: stars, delivery: stars, communication: stars, compliance: stars },
  text: 'As ordered.', evidence: 'Purchase order', status: 'verified', at: '2026-05-01', sample: true,
});

const state = (reviews: Review[] = []) => ({ ...EMPTY, reviews });

const w = (over: Partial<Record<MetricId, number>> = {}): Record<MetricId, number> => ({ ...DEFAULT_WEIGHTS, ...over });

/** Answers for every EV-applicable item set to one value. */
const answers = (value: 'yes' | 'no', evidence: 'declared' | 'verified' = 'declared'): SustainabilityAnswers =>
  Object.fromEntries(
    CHECKLIST.filter((it) => !it.sectors || it.sectors.includes('ev')).map((it) => [it.id, { value, evidence }]),
  );

const byId = (rows: ReturnType<typeof rankSuppliers>, id: string) => rows.find((r) => r.sellerId === id)!;

// ---------- Fair Work gate ----------

describe('fair work gate', () => {
  it('excludes E-grade suppliers from the ranking, flagged rather than ranked', () => {
    // 'Rajkot Brass Terminals' carries the seed workforce with a child-labour flag: grade E.
    const e = seller({ id: 'e1', name: 'Rajkot Brass Terminals', districtId: 'rajkot' });
    const ok = seller({ id: 'ok1' });
    const rows = rankSuppliers({ sellers: [e, ok], line, state: state(), weights: w(), answersFor: () => null });
    const eRow = byId(rows, 'e1');
    expect(eRow.excluded).toBe('fairwork-e');
    expect(eRow.grade).toBe('E');
    expect(eRow.sangamScore).toBe(0);
    // the E row is sorted after every ranked row and carries no rank position
    expect(rows.indexOf(eRow)).toBe(rows.length - 1);
    expect(byId(rows, 'ok1').excluded).toBeUndefined();
  });

  it('grades an A-rated supplier at 100 on the fixed Fair Work scale', () => {
    const a = seller({ id: 'a1', name: 'Krishnagiri Mahila Harness Collective', districtId: 'krishnagiri' });
    expect(fairWorkFor(a)!.grade).toBe('A');
    const rows = rankSuppliers({ sellers: [a], line, state: state(), weights: w(), answersFor: () => null });
    expect(rows[0].contributions.fairwork.scaled).toBe(RANKING_RULES.fairworkScaled.A);
    expect(rows[0].contributions.fairwork.source).toBe('simulated');
  });

  it('leaves suppliers without a workforce profile ungraded, at weight 0', () => {
    const s = seller({ id: 'n1' }); // name not in the seed workforces
    expect(fairWorkFor(s)).toBeNull();
    const rows = rankSuppliers({ sellers: [s], line, state: state(), weights: w(), answersFor: () => null });
    expect(rows[0].grade).toBeNull();
    expect(rows[0].contributions.fairwork.weight).toBe(0);
    expect(rows[0].contributions.fairwork.source).toBe('not graded');
  });
});

// ---------- fixed scales ----------

describe('fixed-scale metric maths', () => {
  it('cost: at or under 85% of the import cost scores 100, at or over 125% scores 0', () => {
    // import reference for the line is cost x 1.25 (default 25% duty): any supplier well under 0.85 x that is 100.
    const cheap = seller({ id: 'c1', priceIndex: 0.6 });
    const dear = seller({ id: 'c2', priceIndex: 3 });
    const rows = rankSuppliers({ sellers: [cheap, dear], line, state: state(), weights: w({ cost: 100, distance: 0, reviews: 0, quality: 0, verification: 0, fairwork: 0, sustainability: 0 }), answersFor: () => null });
    expect(byId(rows, 'c1').contributions.cost.scaled).toBe(100);
    expect(byId(rows, 'c2').contributions.cost.scaled).toBe(0);
    expect(byId(rows, 'c1').sangamScore).toBe(100);
    expect(byId(rows, 'c2').sangamScore).toBe(0);
  });

  it('distance: the buyer plant district scores 100, 1500 km or more scores 0', () => {
    const local = seller({ id: 'd1', districtId: 'hosur' }); // the EV buyer plant
    const far = seller({ id: 'd2', districtId: 'guwahati' });
    const rows = rankSuppliers({ sellers: [local, far], line, state: state(), weights: w({ cost: 0, distance: 100, reviews: 0, quality: 0, verification: 0, fairwork: 0, sustainability: 0 }), answersFor: () => null });
    expect(byId(rows, 'd1').contributions.distance.scaled).toBe(100);
    expect(roadKm(district('guwahati'), district(buyer.plantDistrictId))).toBeGreaterThanOrEqual(RANKING_RULES.distanceWorstKm);
    expect(byId(rows, 'd2').contributions.distance.scaled).toBe(0);
  });

  it('reviews: no verified reviews scores the neutral 50 prior; verified 5s beat verified 1s on the 1-5 map', () => {
    const none = seller({ id: 'r0' });
    const good = seller({ id: 'r5' });
    const bad = seller({ id: 'r1' });
    const reviews = [...Array(2).fill(5).map((s) => review(good.id, s)), ...Array(2).fill(1).map((s) => review(bad.id, s))];
    const rows = rankSuppliers({ sellers: [none, good, bad], line, state: state(reviews), weights: w({ reviews: 100, cost: 0, distance: 0, quality: 0, verification: 0, fairwork: 0, sustainability: 0 }), answersFor: () => null });
    expect(byId(rows, 'r0').contributions.reviews.scaled).toBe(RANKING_RULES.noReviewScaled);
    // the scaled value is the trust review part (max 35) rescaled to 100: bayes 5,5 -> (5+2*3.5)/3 = 4 stars
    const t5 = trustScore(good, state(reviews));
    const p5 = t5.parts.find((p) => p.label === 'Verified reviews')!.points;
    expect(byId(rows, 'r5').contributions.reviews.scaled).toBeCloseTo((100 * p5) / 35, 6);
    expect(byId(rows, 'r5').contributions.reviews.scaled).toBeGreaterThan(byId(rows, 'r1').contributions.reviews.scaled);
    expect(byId(rows, 'r5').stars).not.toBeNull();
    expect(byId(rows, 'r0').stars).toBeNull();
  });

  it('quality and delivery: perfect OTIF with zero defects is 100; the mid case averages the two scales', () => {
    const perfect = seller({ id: 'q1' });
    const mid = seller({ id: 'q2', details: { ...seller().details, otifPct: 50, defectPpm: RANKING_RULES.defectWorstPpm / 2 } });
    const rows = rankSuppliers({ sellers: [perfect, mid], line, state: state(), weights: w({ quality: 100, cost: 0, distance: 0, reviews: 0, verification: 0, fairwork: 0, sustainability: 0 }), answersFor: () => null });
    expect(byId(rows, 'q1').contributions.quality.scaled).toBe(100);
    expect(byId(rows, 'q2').contributions.quality.scaled).toBe(50); // (50 + 50) / 2
  });

  it('verification: trust points minus the review part, out of 65', () => {
    const s = seller({ id: 'v1' });
    const reviews = [review(s.id, 5)];
    const rows = rankSuppliers({ sellers: [s], line, state: state(reviews), weights: w(), answersFor: () => null });
    const t = trustScore(s, state(reviews));
    const reviewPoints = t.parts.find((p) => p.label === 'Verified reviews')!.points;
    expect(t.score).toBeGreaterThan(reviewPoints); // the parts really are separable
    expect(rows[0].contributions.verification.value).toBe(t.score - reviewPoints);
    expect(rows[0].contributions.verification.scaled).toBeCloseTo((100 * (t.score - reviewPoints)) / RANKING_RULES.verificationMaxPoints, 6);
    expect(rows[0].contributions.verification.source).toBe('verified');
  });
});

// ---------- weights ----------

describe('weights', () => {
  it('the default weights and every preset sum to 100', () => {
    expect(METRICS.reduce((n, m) => n + m.defaultWeight, 0)).toBe(100);
    for (const p of PRESETS) expect(Object.values(p.weights).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('weights that sum to zero return every Sangam score as 0, safely', () => {
    const a = seller({ id: 'z1' });
    const b = seller({ id: 'z2', priceIndex: 3, districtId: 'guwahati' });
    const zero = { cost: 0, distance: 0, reviews: 0, quality: 0, verification: 0, fairwork: 0, sustainability: 0 };
    const rows = rankSuppliers({ sellers: [a, b], line, state: state(), weights: zero, answersFor: () => null });
    expect(rows.map((r) => r.sangamScore)).toEqual([0, 0]);
    // the scaled maths still runs, so the page can explain each metric
    expect(rows[0].contributions.distance.scaled).toBe(100);
  });

  it('raising the sustainability weight never lowers the more sustainable supplier relative to the less sustainable one', () => {
    const green = seller({ id: 'g1', name: 'Twin Works' });
    const grimy = seller({ id: 'g2', name: 'Twin Works' }); // same name: identical (un)graded Fair Work
    const good = answers('yes', 'verified');
    const bad = answers('no');
    const answersFor = (id: string) => (id === green.id ? good : bad);
    const at = (susWeight: number) => {
      const rows = rankSuppliers({ sellers: [green, grimy], line, state: state(), weights: w({ sustainability: susWeight }), answersFor });
      return byId(rows, green.id).sangamScore - byId(rows, grimy.id).sangamScore;
    };
    expect(at(0)).toBe(0); // weight 0: sustainability cannot separate them
    const low = at(5);
    const high = at(40);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(at(100)).toBeGreaterThanOrEqual(high);
  });

  it('not-assessed checklists count as 0 (plan §9.1), not as a neutral value', () => {
    const s = seller({ id: 'na1' });
    const rows = rankSuppliers({ sellers: [s], line, state: state(), weights: w(), answersFor: () => null });
    expect(rows[0].level).toBe('Not assessed');
    expect(rows[0].contributions.sustainability.scaled).toBe(RANKING_RULES.notAssessedScaled);
    expect(rows[0].contributions.sustainability.source).toBe('not assessed');
    // the same supplier with a filled checklist scores strictly more on the metric
    const filled = rankSuppliers({ sellers: [s], line, state: state(), weights: w(), answersFor: () => answers('yes') });
    expect(filled[0].contributions.sustainability.scaled).toBeGreaterThan(0);
  });

  it('fixed scales are stable: the same supplier keeps the same scaled values whatever else is on the list', () => {
    const x = seller({ id: 'x1', name: 'Stable Works' });
    const alone = rankSuppliers({ sellers: [x], line, state: state(), weights: w(), answersFor: () => answers('partly') })[0];
    const y = seller({ id: 'y1', priceIndex: 0.5, districtId: 'guwahati' });
    const z = seller({ id: 'z9', priceIndex: 2.5, name: 'Rajkot Brass Terminals', districtId: 'rajkot' }); // an E supplier too
    const crowded = rankSuppliers({ sellers: [z, y, x], line, state: state(), weights: w(), answersFor: (id) => (id === x.id ? answers('partly') : null) });
    const xCrowded = byId(crowded, x.id);
    expect(xCrowded.contributions).toEqual(alone.contributions);
    expect(xCrowded.sangamScore).toBe(alone.sangamScore);
  });
});
