// Tests for the funding bridge: the desk's completeness gate, the commitment arithmetic
// (sums, remainder bounding, per-item coverage with pro-rating), the funded/completed
// status flip, the release-on-verify rule, projection sanity and the sustainability
// uplift join. All money on screen is simulated; the projections are tagged estimated.
import { describe, expect, it } from 'vitest';
import {
  applyCommitment,
  commitTotal,
  computeProjections,
  fundedFlip,
  fundingUplift,
  itemCoveredLakh,
  projectOutcomes,
  releaseForVerified,
  remainingAsk,
  validateApplication,
} from '../src/funding';
import type { FundingApplication, FundingCommitment, FundingItem } from '../src/funding';
import { CHECKLIST } from '../src/sustainability';
import type { SustainabilityAnswers } from '../src/sustainability';

// ---------- fixtures ----------

const SELLER = { monthlyCapacity: 3000, priceIndex: 1 };

let seq = 0;
const item = (over: Partial<FundingItem> = {}): FundingItem => {
  seq += 1;
  return {
    id: `it${seq}`, kind: 'machine', label: 'CNC press', labelHi: 'सीएनसी प्रेस',
    costLakh: 3, months: 4, purpose: 'Double the press capacity for harness orders.',
    status: 'todo',
    ...over,
  };
};

const commitment = (over: Partial<FundingCommitment> = {}): FundingCommitment => ({
  buyerId: 'b1', buyerName: 'EV Buyer Ltd', itemIds: [], amountLakh: 1,
  committedAt: '2026-10-01', status: 'pledged',
  ...over,
});

const app = (over: Partial<FundingApplication> = {}): FundingApplication => {
  const items = over.items ?? [item({ costLakh: 6 }), item({ kind: 'green-tech', costLakh: 3, months: 5, label: 'Rooftop solar 15 kW', labelHi: 'छत का सौर पैनल' })];
  const base: FundingApplication = {
    id: 'fund-ev-1', sector: 'ev', sellerId: 't1', sellerName: 'Krishnagiri Mahila Harness Collective',
    title: 'Press + solar for harness grade-up',
    purpose: 'Two machines and a solar upgrade are needed to hold harness quality through the monsoon power cuts.',
    items,
    evidence: ['Quotation from the press vendor'],
    status: 'listed',
    commitments: [],
    projections: projectOutcomes(items, SELLER, 'ev', null),
    createdAt: '2026-10-01', updatedAt: '2026-10-01',
  };
  return { ...base, ...over, projections: over.projections ?? projectOutcomes(items, SELLER, 'ev', null) };
};

// ---------- the completeness gate ----------

describe('validateApplication', () => {
  it('passes a complete application and rejects a thin one, listing every problem', () => {
    const good = app();
    expect(validateApplication(good)).toEqual({ ok: true, problems: [] });

    const thin = app({
      items: [],
      purpose: 'Need money.',
      evidence: [],
    });
    const gate = validateApplication(thin);
    expect(gate.ok).toBe(false);
    expect(gate.problems.length).toBe(3);
    expect(gate.problems.some((p) => p.includes('at least one item'))).toBe(true);
    expect(gate.problems.some((p) => p.includes('40'))).toBe(true); // FUNDING_RULES.minPurposeChars
    expect(gate.problems.some((p) => p.includes('evidence'))).toBe(true);
  });
});

// ---------- commitment arithmetic ----------

describe('commitment arithmetic', () => {
  it('sums commitments, bounds the remaining ask, and rejects an over-commit', () => {
    const a = app({ items: [item({ costLakh: 6 })] });
    const first = applyCommitment(a, commitment({ itemIds: [a.items[0].id], amountLakh: 4 }));
    expect(first.ok).toBe(true);
    expect(commitTotal(first.app)).toBe(4);
    expect(remainingAsk(first.app)).toBe(2);

    // a commit larger than the remainder is rejected in the model as in the UI
    const over = applyCommitment(first.app, commitment({ buyerId: 'b2', buyerName: 'Second Buyer', itemIds: [a.items[0].id], amountLakh: 3 }));
    expect(over.ok).toBe(false);
    expect(over.problem).toBeTruthy();
    expect(over.app.commitments.length).toBe(1); // unchanged

    // the model floors the remainder at 0 even if hand-made data over-commits
    const inflated: FundingApplication = { ...first.app, commitments: [...first.app.commitments, commitment({ amountLakh: 99 })] };
    expect(remainingAsk(inflated)).toBe(0);

    // exactly filling the ask flips the status to funded
    const filled = applyCommitment(first.app, commitment({ buyerId: 'b2', buyerName: 'Second Buyer', itemIds: [a.items[0].id], amountLakh: 2 }));
    expect(filled.ok).toBe(true);
    expect(remainingAsk(filled.app)).toBe(0);
    expect(filled.app.status).toBe('funded');
  });

  it('pro-rates a multi-item commitment across the items it spans', () => {
    const a = app({ items: [item({ id: 'press', costLakh: 6 }), item({ id: 'solar', kind: 'green-tech', costLakh: 3, months: 5 })] });
    // ₹3 L across a ₹6 L and a ₹3 L item: cost-share split 2:1
    const backed = applyCommitment(a, commitment({ itemIds: ['press', 'solar'], amountLakh: 3 }));
    expect(backed.ok).toBe(true);
    expect(itemCoveredLakh(backed.app, 'press')).toBe(2);
    expect(itemCoveredLakh(backed.app, 'solar')).toBe(1);

    // a second buyer backs only the press; coverage adds up
    const again = applyCommitment(backed.app, commitment({ buyerId: 'b2', buyerName: 'Second Buyer', itemIds: ['press'], amountLakh: 3 }));
    expect(itemCoveredLakh(again.app, 'press')).toBe(5);
    expect(itemCoveredLakh(again.app, 'solar')).toBe(1);
    expect(itemCoveredLakh(a, 'missing')).toBe(0);
  });
});

// ---------- funded flip and release ----------

describe('fundedFlip and releaseForVerified', () => {
  it('flips funded when fully covered, and completed only when every item is verified', () => {
    const a = app({ items: [item({ id: 'press', costLakh: 6 }), item({ id: 'solar', kind: 'green-tech', costLakh: 3, months: 5 })] });
    const part = applyCommitment(a, commitment({ itemIds: ['press'], amountLakh: 6 })).app;
    expect(fundedFlip(part)).toBe('listed'); // one item still open

    const full = applyCommitment(part, commitment({ buyerId: 'b2', buyerName: 'Second Buyer', itemIds: ['solar'], amountLakh: 3 })).app;
    expect(full.status).toBe('funded');

    // verification, not coverage, completes the work
    const oneVerified = releaseForVerified(full, ['press']);
    expect(oneVerified.status).toBe('funded');
    const allVerified = releaseForVerified(oneVerified, ['solar']);
    expect(allVerified.status).toBe('completed');
  });

  it('releases only the commitments whose items are all verified; a mixed buyer stays pledged', () => {
    const a = app({ items: [item({ id: 'press', costLakh: 6 }), item({ id: 'solar', kind: 'green-tech', costLakh: 3, months: 5 })] });
    // ₹4.5 L across a ₹6 L and a ₹3 L item (cost-share 2:1) covers neither fully,
    // so a second buyer can still back the press
    const mixed = commitment({ buyerId: 'b1', buyerName: 'EV Buyer Ltd', itemIds: ['press', 'solar'], amountLakh: 4.5 });
    const single = commitment({ buyerId: 'b2', buyerName: 'Second Buyer', itemIds: ['press'], amountLakh: 3, committedAt: '2026-10-02' });
    const backed = applyCommitment(applyCommitment(a, mixed).app, single).app;

    // the desk verifies the press only: the single-item buyer is released, the mixed one is not
    const step1 = releaseForVerified(backed, ['press']);
    expect(step1.items.find((it) => it.id === 'press')!.status).toBe('verified');
    expect(step1.commitments.find((c) => c.buyerId === 'b2')!.status).toBe('released');
    expect(step1.commitments.find((c) => c.buyerId === 'b1')!.status).toBe('pledged');

    // the solar item verifies too: the mixed commitment releases and the work is complete
    const step2 = releaseForVerified(step1, ['solar']);
    expect(step2.commitments.every((c) => c.status === 'released')).toBe(true);
    expect(step2.status).toBe('completed');
  });
});

// ---------- projections ----------

describe('projectOutcomes', () => {
  it('pays the ask back through the estimated monthly profit uplift, capped and tagged estimated', () => {
    // machine 12% + green-tech 8% = 20% capacity on the 1.5 L/month baseline (3,000 units, priceIndex 1)
    const p = projectOutcomes(app().items, SELLER, 'ev', null);
    expect(p.source).toBe('estimated');
    expect(p.totalAskLakh).toBe(9);
    expect(p.capacityUpliftPct).toBe(20);
    expect(p.qualityUpliftPct).toBeNull();
    expect(p.paybackMonths).not.toBeNull();
    expect(p.paybackMonths!).toBeGreaterThanOrEqual(0);
    expect(p.paybackMonths!).toBeGreaterThanOrEqual(3); // FUNDING_RULES.paybackFloorMonths
    expect(p.roi5yrPct).not.toBeNull();
  });

  it('returns null payback and ROI when no item lifts capacity or quality', () => {
    const wcOnly = [item({ id: 'wc', kind: 'working-capital', costLakh: 4, months: 1, label: 'Two months of materials and wages', labelHi: 'दो महीने का कच्चे माल और मजदूरी खर्च' })];
    const p = projectOutcomes(wcOnly, SELLER, 'ev', null);
    expect(p.source).toBe('estimated');
    expect(p.paybackMonths).toBeNull();
    expect(p.roi5yrPct).toBeNull();
    expect(p.capacityUpliftPct).toBeNull();
    expect(p.qualityUpliftPct).toBeNull();
    // computeProjections refreshes the same maths onto the application
    const refreshed = computeProjections(app({ items: wcOnly }), SELLER, 'ev', null);
    expect(refreshed.projections).toEqual(p);
  });
});

// ---------- the sustainability uplift join ----------

describe('fundingUplift', () => {
  it('lifts the level when a linked item funds a real checklist case', () => {
    // Every EV-applicable item held ('yes') except energy-renewable; one item desk-verified,
    // so the 90-point checklist sits at Silver (the Gold gate needs 2 verified items).
    const answers: SustainabilityAnswers = Object.fromEntries(
      CHECKLIST.filter((it) => !it.sectors || it.sectors.includes('ev')).map((it) => [
        it.id,
        it.id === 'energy-renewable' ? { value: 'no', evidence: 'declared' } : { value: 'yes', evidence: it.id === 'energy-audit' ? 'verified' : 'declared' },
      ]),
    );
    const a = app({ items: [item({ id: 'solar', kind: 'green-tech', costLakh: 3, months: 5, sustainabilityItemId: 'energy-renewable', label: 'Rooftop solar 15 kW', labelHi: 'छत का सौर पैनल' })] });

    const uplift = fundingUplift(a, answers, 'ev');
    expect(uplift.sustainability).toEqual({ from: 'Silver', to: 'Gold', points: 10 });
    // the same fixed-scale maths as ranking.ts: 10 checklist points at sustainability's weight of 15/100
    expect(uplift.sangamScorePoints).toBe(1.5);
  });

  it('returns null when no item is linked to the checklist', () => {
    const a = app({ items: [item({ costLakh: 6 })] }); // no sustainabilityItemId anywhere
    const uplift = fundingUplift(a, null, 'ev');
    expect(uplift.sustainability).toBeNull();
    expect(uplift.sangamScorePoints).toBeNull();
  });
});
