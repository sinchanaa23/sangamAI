// Funding bridge: a supplier applies for capital item-by-item (machines, green tech, R&D,
// certifications, working capital), the application becomes a marketplace listing, buyers
// co-fund specific items, and the funded work runs through the same todo → doing →
// submitted → verified lifecycle as dev-project milestones. Verified items release the
// buyer commitments behind them.
//
// Every rupee here is simulated or estimated and tagged: projections carry
// source: 'estimated', scheme names are display-only pointers into
// src/real/sustainability-refs.json, and no repayment is tracked (milestone co-funding,
// not loans - the buyer's return is the sustainability outcome).
//
// Structure mirrors src/fairwork.ts: one FUNDING_RULES table so the team tunes the model
// in one place, and the projection maths follows the same style as src/diversify.ts
// (investment, payback, 5-year ROI). This module imports only from sustainability.ts and
// types.ts - never from data/engine/ranking - so it stays cycle-free and cheap to test.

import { scoreSustainability } from './sustainability';
import type {
  SustainabilityAnswers,
  SustainabilityLevel,
} from './sustainability';
import type { SectorId } from './types';

export type FundingKind = 'machine' | 'green-tech' | 'rnd' | 'certification' | 'working-capital';

export type FundingItemStatus = 'todo' | 'doing' | 'submitted' | 'verified';

export interface FundingItem {
  id: string;
  kind: FundingKind;
  /** e.g. 'Rooftop solar 15 kW + net meter' */
  label: string;
  labelHi: string;
  costLakh: number;
  /** execution time once funded */
  months: number;
  /** why this item, one line */
  purpose: string;
  /** scheme names only; must resolve to src/real/sustainability-refs.json entries */
  schemes?: string[];
  /** CHECKLIST id this item serves - funding it lifts the sustainability score */
  sustainabilityItemId?: string;
  /** mirrors Milestone once funded */
  status: FundingItemStatus;
  evidence?: string;
  updatedAt?: string;
}

export interface FundingCommitment {
  buyerId: string;
  buyerName: string;
  /** which items this buyer backs */
  itemIds: string[];
  /** at most the remaining ask of the covered items (enforced by applyCommitment) */
  amountLakh: number;
  committedAt: string;
  /** released when every backed item verifies - the buyer's "impact delivered" */
  status: 'pledged' | 'released';
}

export type FundingStatus = 'draft' | 'submitted' | 'listed' | 'funded' | 'completed';

export interface FundingProjections {
  totalAskLakh: number;
  /** total cost over the estimated monthly profit uplift */
  paybackMonths: number | null;
  roi5yrPct: number | null;
  /** machines / green-tech items */
  capacityUpliftPct: number | null;
  /** R&D / testing and certification items */
  qualityUpliftPct: number | null;
  sustainabilityUplift: { from: SustainabilityLevel; to: SustainabilityLevel; points: number } | null;
  /** expected ranking gain, same fixed-scale maths as ranking.ts */
  sangamScoreUplift: number | null;
  /** the rules are Sangam's model choices - never a promise */
  source: 'estimated';
}

export interface FundingApplication {
  /** 'fund-<sector>-<n>' */
  id: string;
  sector: SectorId;
  sellerId: string;
  sellerName: string;
  title: string;
  /** 2-3 sentence narrative */
  purpose: string;
  items: FundingItem[];
  /** supporting documents (names only) */
  evidence: string[];
  status: FundingStatus;
  commitments: FundingCommitment[];
  /** computed, tagged estimated - never hand-typed */
  projections: FundingProjections;
  createdAt: string;
  updatedAt: string;
}

/** The one table of funding rules. Tune here, nowhere else. All figures are Sangam's model choices. */
export const FUNDING_RULES = {
  /** a thin or copy-paste application is returned to draft by the desk (plan §2.2) */
  minPurposeChars: 40,
  /** evidence documents the application needs before it can be submitted */
  minEvidence: 1,
  /** default execution months per kind once funded (the form pre-fills, the supplier can change) */
  defaultMonths: { machine: 4, 'green-tech': 5, rnd: 6, certification: 3, 'working-capital': 1 } as Record<FundingKind, number>,
  /** capacity uplift per item, % of the seller's current output (machine, green-tech) */
  capacityUpliftPctPerItem: { machine: 12, 'green-tech': 8 } as Partial<Record<FundingKind, number>>,
  /** quality uplift per item, % (rnd/testing, certification) */
  qualityUpliftPctPerItem: { rnd: 10, certification: 6 } as Partial<Record<FundingKind, number>>,
  /** uplift caps: no application promises more than this, however many items it stacks */
  capacityUpliftCapPct: 40,
  qualityUpliftCapPct: 30,
  /** baseline monthly contribution assumed per 1,000 units a month at priceIndex 1 (lakh rupees) */
  profitLakhPerThousandUnits: 0.5,
  /** the estimated monthly profit uplift never falls below this, so payback stays finite */
  minMonthlyProfitLakh: 0.05,
  /** payback is never quoted below this many months - too-good claims are capped */
  paybackFloorMonths: 3,
} as const;

/** The kinds with their display names and scheme hints (names only, per sustainability-refs.json). */
export const FUNDING_KINDS: { id: FundingKind; label: string; labelHi: string; defaultMonths: number; schemes: string[] }[] = [
  { id: 'machine', label: 'Machine', labelHi: 'मशीन', defaultMonths: FUNDING_RULES.defaultMonths.machine,
    schemes: ['CGTMSE credit guarantee', 'PMEGP'] },
  { id: 'green-tech', label: 'Green technology', labelHi: 'हरित तकनीक', defaultMonths: FUNDING_RULES.defaultMonths['green-tech'],
    schemes: ['SIDBI energy-efficiency finance for MSMEs'] },
  { id: 'rnd', label: 'R&D and testing', labelHi: 'अनुसंधान और जाँच', defaultMonths: FUNDING_RULES.defaultMonths.rnd,
    schemes: ['CGTMSE credit guarantee'] },
  { id: 'certification', label: 'Certification', labelHi: 'प्रमाणन', defaultMonths: FUNDING_RULES.defaultMonths.certification,
    schemes: ['MSME ZED Certification (Zero Defect Zero Effect)'] },
  { id: 'working-capital', label: 'Working capital', labelHi: 'कार्यशील पूँजी', defaultMonths: FUNDING_RULES.defaultMonths['working-capital'],
    schemes: ['CGTMSE credit guarantee'] },
];

/**
 * Sustainability's share of the Sangam score: src/ranking.ts METRICS defaultWeight (15 of
 * 100). Copied as a named constant instead of imported - ranking.ts pulls in the demo data
 * tables, and this module must stay free of them.
 */
const SUSTAINABILITY_WEIGHT_OF_SANGAM_SCORE = 15;

const round2 = (n: number) => Math.round(n * 100) / 100;
const nowIso = () => new Date().toISOString();

// ---------- projections ----------

/**
 * Re-score the sustainability checklist with the application's linked items forced to their
 * best plausible post-funding state (plan §2.2): the funded CHECKLIST item is held ('yes')
 * with desk-verified evidence - funding pays for the item, the item executes and the desk
 * verifies it, and that end state is what the expected uplift models. Other answers pass
 * through unchanged, and the actual level still changes only through real checklist taps;
 * this is an expectation, tagged estimated, never a promise.
 */
function upliftForItems(
  items: FundingItem[],
  answers: SustainabilityAnswers | null,
  sector: SectorId,
): { sustainability: { from: SustainabilityLevel; to: SustainabilityLevel; points: number } | null; sangamScorePoints: number | null } {
  const linked = items.filter((it) => it.sustainabilityItemId);
  if (linked.length === 0) return { sustainability: null, sangamScorePoints: null };

  const base: SustainabilityAnswers = answers ?? {};
  const from = scoreSustainability(base, sector);
  const forced: SustainabilityAnswers = { ...base };
  for (const it of linked) {
    const id = it.sustainabilityItemId as string;
    // the desk-verified end state the funding is meant to reach, whatever the answer today
    forced[id] = { value: 'yes', evidence: 'verified' };
  }
  const to = scoreSustainability(forced, sector);

  const points = to.score - from.score;
  if (points <= 0) return { sustainability: null, sangamScorePoints: null };
  return {
    sustainability: { from: from.level, to: to.level, points },
    sangamScorePoints: +((points * SUSTAINABILITY_WEIGHT_OF_SANGAM_SCORE) / 100).toFixed(1),
  };
}

/**
 * Estimate what funding the items would do, diversify-style: an investment, an estimated
 * monthly profit uplift, a payback and a 5-year ROI, all tagged estimated.
 *
 * The uplift derivation is a Sangam model choice, kept simple and deterministic:
 * - each machine / green-tech item adds a fixed % of capacity (12% / 8%), each R&D /
 *   certification item a fixed % of quality (10% / 6%), stacked then capped;
 * - the % gains act on the seller's baseline contribution, assumed at
 *   FUNDING_RULES.profitLakhPerThousandUnits per 1,000 units a month at priceIndex 1;
 * - payback = total cost over that monthly profit uplift (floored, see FUNDING_RULES).
 * Working capital alone carries no capacity or quality gain, so its payback is null.
 */
export function projectOutcomes(
  items: FundingItem[],
  seller: { monthlyCapacity: number; priceIndex: number },
  sector: SectorId,
  answers: SustainabilityAnswers | null,
): FundingProjections {
  const totalAskLakh = round2(items.reduce((n, it) => n + it.costLakh, 0));

  const stack = (perItem: Partial<Record<FundingKind, number>>, cap: number) =>
    Math.min(cap, items.reduce((n, it) => n + (perItem[it.kind] ?? 0), 0));
  const capacityPct = stack(FUNDING_RULES.capacityUpliftPctPerItem, FUNDING_RULES.capacityUpliftCapPct);
  const qualityPct = stack(FUNDING_RULES.qualityUpliftPctPerItem, FUNDING_RULES.qualityUpliftCapPct);
  const effPct = capacityPct + qualityPct;

  const uplift = upliftForItems(items, answers, sector);

  if (totalAskLakh <= 0 || effPct <= 0) {
    // nothing that lifts output or quality: no profit uplift to pay the money back from
    return {
      totalAskLakh,
      paybackMonths: null,
      roi5yrPct: null,
      capacityUpliftPct: capacityPct > 0 ? capacityPct : null,
      qualityUpliftPct: qualityPct > 0 ? qualityPct : null,
      sustainabilityUplift: uplift.sustainability,
      sangamScoreUplift: uplift.sangamScorePoints,
      source: 'estimated',
    };
  }

  const baselineProfitLakh = (seller.monthlyCapacity / 1000) * seller.priceIndex * FUNDING_RULES.profitLakhPerThousandUnits;
  const monthlyProfitLakh = Math.max((baselineProfitLakh * effPct) / 100, FUNDING_RULES.minMonthlyProfitLakh);

  const paybackMonths = Math.max(FUNDING_RULES.paybackFloorMonths, Math.ceil(totalAskLakh / monthlyProfitLakh));

  // 5-year ROI, diversify-style: the uplift only earns after the slowest item executes
  const readyMonths = items.reduce((n, it) => Math.max(n, it.months), 0);
  const profit5 = monthlyProfitLakh * Math.max(0, 60 - readyMonths);
  const roi5yrPct = Math.round((100 * (profit5 - totalAskLakh)) / totalAskLakh);

  return {
    totalAskLakh,
    paybackMonths,
    roi5yrPct,
    capacityUpliftPct: capacityPct > 0 ? capacityPct : null,
    qualityUpliftPct: qualityPct > 0 ? qualityPct : null,
    sustainabilityUplift: uplift.sustainability,
    sangamScoreUplift: uplift.sangamScorePoints,
    source: 'estimated',
  };
}

/** Refresh an application's projections (the form recomputes live as items change). */
export function computeProjections(
  app: FundingApplication,
  seller: { monthlyCapacity: number; priceIndex: number },
  sector: SectorId,
  answers: SustainabilityAnswers | null,
): FundingApplication {
  return { ...app, projections: projectOutcomes(app.items, seller, sector, answers) };
}

// ---------- the completeness gate ----------

/**
 * The desk's pre-check before an application can be submitted (plan §2.2): at least one
 * item, a purpose that says why (min chars), and at least one evidence document. A thin or
 * copy-paste application is returned to draft with the problems listed.
 */
export function validateApplication(app: FundingApplication): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (app.items.length < 1) problems.push('Add at least one item to fund.');
  if (app.purpose.trim().length < FUNDING_RULES.minPurposeChars) {
    problems.push(`The purpose needs at least ${FUNDING_RULES.minPurposeChars} characters - say in 2-3 sentences why this work matters.`);
  }
  if (app.evidence.length < FUNDING_RULES.minEvidence) problems.push('Attach at least one evidence document.');
  return { ok: problems.length === 0, problems };
}

// ---------- commitment arithmetic ----------

/** Total committed across all buyers, pledged and released alike (released money was still committed). */
export function commitTotal(app: FundingApplication): number {
  return round2(app.commitments.reduce((n, c) => n + c.amountLakh, 0));
}

/**
 * How much of a single item's cost the commitments cover. A commitment spanning several
 * items is pro-rated by cost share, so the shares over one commitment's items always sum
 * to the commitment's amount.
 */
export function itemCoveredLakh(app: FundingApplication, itemId: string): number {
  const item = app.items.find((it) => it.id === itemId);
  if (!item || item.costLakh <= 0) return 0;
  let covered = 0;
  for (const c of app.commitments) {
    if (!c.itemIds.includes(itemId)) continue;
    const pool = c.itemIds.reduce((n, id) => n + (app.items.find((it) => it.id === id)?.costLakh ?? 0), 0);
    if (pool <= 0) continue;
    covered += (c.amountLakh * item.costLakh) / pool;
  }
  return round2(covered);
}

/** Ask still open: total ask minus what buyers committed, never below 0 (plan §2.2). */
export function remainingAsk(app: FundingApplication): number {
  return Math.max(0, round2(app.projections.totalAskLakh - commitTotal(app)));
}

/**
 * The status the application should carry now:
 * - 'completed' when every item is verified (the work is done, outranks 'funded');
 * - 'funded' when the ask is fully committed and every item has its cost covered;
 * - otherwise the current status, unchanged.
 */
export function fundedFlip(app: FundingApplication): FundingStatus {
  if (app.items.length > 0 && app.items.every((it) => it.status === 'verified')) return 'completed';
  const EPS = 1e-9;
  const everyItemCovered = app.items.length > 0 && app.items.every((it) => itemCoveredLakh(app, it.id) >= it.costLakh - EPS);
  if (remainingAsk(app) === 0 && everyItemCovered) return 'funded';
  return app.status;
}

/**
 * Add a buyer's commitment. Validates the marketplace rules and returns the updated
 * application (immutable copy) or a problem string for the UI:
 * - the items it backs must exist and the application must be live ('submitted', 'listed'
 *   or 'funded' - not a draft, not completed work);
 * - the amount must be positive and at most the remaining ask of the covered items, so
 *   over-committing is rejected here as well as in the UI (plan §2.2).
 */
export function applyCommitment(
  app: FundingApplication,
  c: FundingCommitment,
): { ok: boolean; app: FundingApplication; problem?: string } {
  if (c.status !== 'pledged') return { ok: false, app, problem: 'Only a fresh pledged commitment can be applied.' };
  if (!['submitted', 'listed', 'funded'].includes(app.status)) {
    return { ok: false, app, problem: 'Commitments open once the application is submitted and listed.' };
  }
  if (c.itemIds.length === 0) return { ok: false, app, problem: 'Pick at least one item to back.' };
  const unknown = c.itemIds.filter((id) => !app.items.some((it) => it.id === id));
  if (unknown.length > 0) return { ok: false, app, problem: `Unknown item${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.` };
  if (!(c.amountLakh > 0)) return { ok: false, app, problem: 'The commitment amount must be positive.' };

  const EPS = 1e-9;
  const remainingOfCovered = c.itemIds.reduce((n, id) => {
    const it = app.items.find((x) => x.id === id) as FundingItem;
    return n + Math.max(0, it.costLakh - itemCoveredLakh(app, id) - EPS);
  }, 0);
  if (c.amountLakh > remainingOfCovered + EPS) {
    return { ok: false, app, problem: `Only ₹${round2(remainingOfCovered)} L of the covered items' ask is still open.` };
  }

  const next: FundingApplication = {
    ...app,
    commitments: [...app.commitments, c],
    updatedAt: nowIso(),
  };
  next.status = fundedFlip(next);
  return { ok: true, app: next };
}

/**
 * The desk verified evidence for the given items: flip their status to verified, then
 * release every pledged commitment whose items are ALL verified (a buyer with a mix of
 * verified and pending items keeps their money pledged until the last item lands).
 */
export function releaseForVerified(app: FundingApplication, verifiedItemIds: string[]): FundingApplication {
  const at = nowIso();
  const verified = new Set(verifiedItemIds);
  const items = app.items.map((it) => (verified.has(it.id) ? { ...it, status: 'verified' as FundingItemStatus, updatedAt: at } : it));
  const verifiedIds = new Set(items.filter((it) => it.status === 'verified').map((it) => it.id));
  const commitments = app.commitments.map((c) =>
    c.status === 'pledged' && c.itemIds.length > 0 && c.itemIds.every((id) => verifiedIds.has(id))
      ? { ...c, status: 'released' as const }
      : c,
  );
  const next: FundingApplication = { ...app, items, commitments, updatedAt: at };
  next.status = fundedFlip(next);
  return next;
}

// ---------- the uplift join ----------

/**
 * What funding this application would do to the supplier's sustainability level and Sangam
 * score, by re-scoring the checklist with the linked items forced to their best plausible
 * value (see upliftForItems). The Sangam gain applies sustainability's weight of the score
 * (SUSTAINABILITY_WEIGHT_OF_SANGAM_SCORE, ranking.ts's METRICS default of 15).
 */
export function fundingUplift(
  app: FundingApplication,
  answers: SustainabilityAnswers | null,
  sector: SectorId,
): { sustainability: { from: SustainabilityLevel; to: SustainabilityLevel; points: number } | null; sangamScorePoints: number | null } {
  return upliftForItems(app.items, answers, sector);
}
