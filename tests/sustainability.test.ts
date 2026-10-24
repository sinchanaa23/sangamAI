// Tests for the Sustainability Scorecard: every level boundary, both evidence gates, the
// legal cap, N/A rescaling, sector scoping and next-steps ordering. Scores are built by
// turning named items to 'no', so the arithmetic stays readable (EV's applicable weights
// sum to exactly 100, so a 'no' on weight w costs exactly w points).
import { describe, expect, it } from 'vitest';
import { CHECKLIST, LEVEL_META, nextSteps, PILLARS, scoreSustainability } from '../src/sustainability';
import type { AnswerValue, ChecklistAnswer, EvidenceState, SectorId, SustainabilityAnswers } from '../src/sustainability';

const A = (value: AnswerValue, evidence: EvidenceState = 'declared'): ChecklistAnswer => ({ value, evidence });

const applicable = (sector: SectorId) => CHECKLIST.filter((it) => !it.sectors || it.sectors.includes(sector));

/** Every applicable item answered, by default yes with verified evidence (satisfies all gates). */
const answers = (sector: SectorId, overrides: Record<string, ChecklistAnswer> = {}, base: ChecklistAnswer = A('yes', 'verified')): SustainabilityAnswers => {
  const out: SustainabilityAnswers = {};
  for (const it of applicable(sector)) out[it.id] = overrides[it.id] ?? base;
  return out;
};

const no = (...ids: string[]): Record<string, ChecklistAnswer> => Object.fromEntries(ids.map((id) => [id, A('no')]));
const na = (id: string): Record<string, ChecklistAnswer> => ({ [id]: A('na') });

describe('level boundaries', () => {
  it('59 is Silver, 60 is Gold', () => {
    // loss 41 = 10+8+6+6+6+5
    const at59 = answers('ev', no('energy-renewable', 'energy-audit', 'energy-tracked', 'energy-generator-backup', 'waste-segregation', 'materials-recycled-input'));
    expect(scoreSustainability(at59, 'ev').score).toBe(59);
    expect(scoreSustainability(at59, 'ev').level).toBe('Silver');
    // loss 40 = 10+8+6+6+6+4
    const at60 = answers('ev', no('energy-renewable', 'energy-audit', 'energy-tracked', 'energy-generator-backup', 'waste-segregation', 'water-reuse'));
    expect(scoreSustainability(at60, 'ev').score).toBe(60);
    expect(scoreSustainability(at60, 'ev').level).toBe('Gold');
  });

  it('79 is Gold, 80 is Platinum', () => {
    // loss 21 = 10+8+3
    const at79 = answers('ev', no('energy-renewable', 'energy-audit', 'disclosure-annual'));
    expect(scoreSustainability(at79, 'ev').score).toBe(79);
    expect(scoreSustainability(at79, 'ev').level).toBe('Gold');
    // loss 20 = 10+6+4
    const at80 = answers('ev', no('energy-renewable', 'energy-tracked', 'water-reuse'));
    expect(scoreSustainability(at80, 'ev').score).toBe(80);
    expect(scoreSustainability(at80, 'ev').level).toBe('Platinum');
  });

  it('39 is Bronze, 40 is Silver', () => {
    // loss 61 = 30 (all energy) + 6+5+5+5 (materials but the legal gate) + 6+4 (water but the legal gate)
    const at39 = answers('ev', no('energy-renewable', 'energy-audit', 'energy-tracked', 'energy-generator-backup',
      'waste-segregation', 'materials-recycled-input', 'packaging-epr', 'sector-rohs', 'water-effluent', 'water-reuse'));
    expect(scoreSustainability(at39, 'ev').score).toBe(39);
    expect(scoreSustainability(at39, 'ev').level).toBe('Bronze');
    // loss 60 = 30 (all energy) + 6+5+5+5 + 6 (transport) + 3 (disclosure)
    const at40 = answers('ev', no('energy-renewable', 'energy-audit', 'energy-tracked', 'energy-generator-backup',
      'waste-segregation', 'materials-recycled-input', 'packaging-epr', 'sector-rohs', 'local-transport', 'disclosure-annual'));
    expect(scoreSustainability(at40, 'ev').score).toBe(40);
    expect(scoreSustainability(at40, 'ev').level).toBe('Silver');
  });

  it('a perfect checklist is Platinum 100 with every pillar at 100', () => {
    const r = scoreSustainability(answers('ev'), 'ev');
    expect(r.score).toBe(100);
    expect(r.level).toBe('Platinum');
    expect(r.pillarScores).toEqual({ energy: 100, materials: 100, water: 100, local: 100, certificates: 100 });
  });
});

describe('evidence gates', () => {
  // Score 79 (Gold band): renewable, audit and disclosure are 'no'; everything else 'yes'.
  const goldBand = (extra: Record<string, ChecklistAnswer> = {}, base = A('yes')) =>
    answers('ev', { ...no('energy-renewable', 'energy-audit', 'disclosure-annual'), ...extra }, base);

  it('Gold needs 2 verified items: 1 verified stays Silver, 2 unlock Gold', () => {
    expect(scoreSustainability(goldBand(), 'ev').level).toBe('Silver'); // 0 verified
    const held = scoreSustainability(goldBand({ 'cert-zed': A('yes', 'verified') }), 'ev'); // 1 verified
    expect(held.level).toBe('Silver');
    expect(held.reasons.some((r) => r.includes('held at Silver'))).toBe(true);
    const gold = scoreSustainability(goldBand({ 'cert-zed': A('yes', 'verified'), 'cert-iso14001': A('yes', 'verified') }), 'ev');
    expect(gold.level).toBe('Gold');
    expect(gold.verifiedCount).toBe(2);
  });

  it('Platinum needs 4 verified including a certificate', () => {
    const platinumBand = no('energy-renewable', 'energy-tracked', 'water-reuse'); // score 80
    expect(scoreSustainability(answers('ev', platinumBand, A('yes')), 'ev').level).toBe('Silver'); // nothing verified: no gate met

    // 4 verified on non-certificate items: Gold gate met, Platinum gate is not (no certificate)
    const four = { 'energy-audit': A('yes', 'verified'), 'water-effluent': A('yes', 'verified'),
      'local-inputs': A('yes', 'verified'), 'waste-segregation': A('yes', 'verified') };
    expect(scoreSustainability(answers('ev', { ...platinumBand, ...four }, A('yes')), 'ev').level).toBe('Gold');

    // the same four plus a verified certificate reach Platinum
    expect(scoreSustainability(answers('ev', { ...platinumBand, ...four, 'cert-iso14001': A('yes', 'verified') }, A('yes')), 'ev').level).toBe('Platinum');
  });
});

describe('legal cap', () => {
  it("a 'no' on Consent to Operate caps the level at Bronze even at a Platinum score", () => {
    const r = scoreSustainability(answers('ev', { 'water-consent': A('no') }), 'ev');
    expect(r.score).toBe(90);
    expect(r.level).toBe('Bronze');
    expect(r.legalCap).toBe(true);
    expect(r.reasons.some((x) => x.includes('capped at Bronze'))).toBe(true);
  });

  it('an unanswered legal gate counts as no and caps too', () => {
    const a = answers('ev');
    delete a['water-consent'];
    expect(scoreSustainability(a, 'ev').level).toBe('Bronze');
  });

  it("'partly' on a legal permit is not a permit: score 95 still caps at Bronze", () => {
    const r = scoreSustainability(answers('ev', { 'water-consent': A('partly', 'verified') }), 'ev');
    expect(r.score).toBe(95);
    expect(r.level).toBe('Bronze');
    expect(r.legalCap).toBe(true);
  });

  it('the hazardous-waste authorisation is the other legal gate', () => {
    const r = scoreSustainability(answers('ev', { 'waste-hazardous-auth': A('no') }), 'ev');
    expect(r.score).toBe(96);
    expect(r.level).toBe('Bronze');
  });

  it("marking the legal gate 'na' removes the cap (and rescales to 100)", () => {
    const r = scoreSustainability(answers('ev', na('water-consent')), 'ev');
    expect(r.score).toBe(100);
    expect(r.level).toBe('Platinum');
    expect(r.legalCap).toBe(false);
  });
});

describe('N/A rescaling', () => {
  it("an item marked 'na' is removed and the score still reaches 100", () => {
    const r = scoreSustainability(answers('ev', na('sector-rohs')), 'ev');
    expect(r.score).toBe(100);
    expect(r.level).toBe('Platinum');
    expect(r.reasons.some((x) => x.includes('not applicable'))).toBe(true);
  });

  it('next-step gains rescale with the remaining weights', () => {
    const a = answers('ev', { ...na('water-consent'), 'sector-rohs': A('no') });
    const steps = nextSteps(a, 'ev');
    const rohs = steps.find((s) => s.item.id === 'sector-rohs');
    expect(rohs!.pointsGained).toBeCloseTo(5 * (100 / 90), 1); // 5.6
    expect(steps.find((s) => s.item.id === 'water-consent')).toBeUndefined(); // na items are not steps
  });
});

describe('sector items', () => {
  it('EV sees RoHS; the same answer is ignored for agri', () => {
    const rohsNo = { 'sector-rohs': A('no') };
    expect(scoreSustainability(answers('ev', rohsNo), 'ev').score).toBe(95);
    expect(scoreSustainability(answers('agri', rohsNo), 'agri').score).toBe(100);
  });

  it('construction sees fly ash; agri sees the organic certificate', () => {
    expect(scoreSustainability(answers('construction', { 'sector-flyash': A('no') }), 'construction').score).toBe(95);
    expect(scoreSustainability(answers('agri', { 'sector-organic': A('no') }), 'agri').score).toBe(95);
  });

  it("each sector's applicable weights sum to exactly 100", () => {
    for (const sector of ['ev', 'construction', 'agri'] as SectorId[]) {
      expect(applicable(sector).reduce((n, it) => n + it.weight, 0)).toBe(100);
    }
  });

  it('pillar weights match the plan (30/25/20/15/10)', () => {
    expect(PILLARS.map((p) => p.weight)).toEqual([30, 25, 20, 15, 10]);
  });
});

describe('nextSteps', () => {
  it('orders unticked items by points gained, largest first, and skips yes/na items', () => {
    const a = answers('ev', {
      'energy-renewable': A('partly'),   // 5 left
      'local-inputs': A('no'),           // 9
      'energy-audit': A('no'),           // 8
      'disclosure-annual': A('partly'),  // 1.5 left
    });
    const steps = nextSteps(a, 'ev'); // nothing is na, so gains read in raw checklist points
    expect(steps.slice(0, 3).map((s) => s.item.id)).toEqual(['local-inputs', 'energy-audit', 'energy-renewable']);
    expect(steps[0]!.pointsGained).toBe(9);
    expect(steps[1]!.pointsGained).toBe(8);
    expect(steps[2]!.pointsGained).toBe(5);
    expect(steps.find((s) => s.item.id === 'packaging-epr')).toBeUndefined();           // already yes
    expect(steps.find((s) => s.item.id === 'disclosure-annual')!.pointsGained).toBe(1.5);
  });
});

describe('unfilled checklist', () => {
  it('an empty answers object is Not assessed, not Bronze', () => {
    // The plan keeps 'Not assessed' (never filled in) distinct from a Bronze 0.
    const r = scoreSustainability({}, 'ev');
    expect(r.level).toBe('Not assessed');
    expect(r.score).toBe(0);
    expect(r.legalCap).toBe(false);
    expect(r.verifiedCount).toBe(0);
    expect(r.tag).toBe('estimated');
  });

  it('a partly filled checklist counts missing answers as no', () => {
    const r = scoreSustainability({ 'energy-renewable': A('yes') }, 'ev');
    expect(r.score).toBe(10); // only the ticked item earns
    expect(r.level).toBe('Bronze');
    expect(r.legalCap).toBe(true); // the consent item was never answered
  });

  it('every level has badge metadata with a colour', () => {
    for (const level of ['Bronze', 'Silver', 'Gold', 'Platinum', 'Not assessed'] as const) {
      expect(LEVEL_META[level].color).toMatch(/^#/);
    }
  });
});
