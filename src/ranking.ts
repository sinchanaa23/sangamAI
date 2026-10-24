// The Sangam score: one 0-100 number per supplier for a BOM line, combining cost, distance,
// reviews, quality, verification, Fair Work and sustainability with buyer-chosen weights.
//
// Every metric is mapped onto a FIXED 0-100 scale (in RANKING_RULES below) rather than
// relative to the other suppliers on screen, so scores stay stable and explainable even
// when only two suppliers are listed. Weights, scales and thresholds are Sangam's model
// choices, tagged estimated like FAIR_WORK_RULES and SUSTAINABILITY_RULES.
//
// Provenance: each contribution carries a source string (same vocabulary as the Src tags)
// so the ranking page can show where every number came from. Transport CO2 is INFORMATION
// ONLY - it never enters the score, so distance isn't counted twice.
import { partRoute } from './chainRoute';
import { active, buyer } from './data';
import { deliveredCost, district, importLineCost, roadKm } from './engine';
import { scoreProfile } from './fairwork';
import type { Grade, ScoredWork } from './fairwork';
import { seedWorkforceFor } from './seeds';
import { DEFAULT_SCENARIO } from './scenario';
import type { Scenario } from './scenario';
import { scoreSustainability } from './sustainability';
import type { SustainabilityAnswers, SustainabilityLevel } from './sustainability';
import { trustScore } from './trust';
import type { StoreState } from './model';
import type { BomLine, Seller } from './types';

/** The one table of ranking rules. Tune here, nowhere else. All scales are fixed, tagged estimated. */
export const RANKING_RULES = {
  /** landed cost at or below this share of today's import cost scores 100 */
  costBestShareOfImport: 0.85,
  /** landed cost at or above this share of today's import cost scores 0 */
  costWorstShareOfImport: 1.25,
  /** 0 km to the buyer's plant scores 100 */
  distanceBestKm: 0,
  /** this far or further scores 0 */
  distanceWorstKm: 1500,
  /** a 5-star Bayesian review average scores 100, 1 star scores 0 */
  reviewBestStars: 5,
  reviewWorstStars: 1,
  /** no verified reviews: the 3.5-star Bayesian prior counts as a neutral 50 (plan §3.1) */
  noReviewPriorStars: 3.5,
  noReviewScaled: 50,
  /** on-time-in-full % maps straight onto 0-100 */
  otifBestPct: 100,
  otifWorstPct: 0,
  /** 0 defects per million scores 100; this many ppm (or worse) scores 0 */
  defectWorstPpm: 5000,
  /** trust points minus the review part, out of this maximum (identity 15 + certs 20 + profile 15 + orders 15) */
  verificationMaxPoints: 65,
  /** Fair Work grades on a fixed scale; E never reaches the list (excluded) */
  fairworkScaled: { A: 100, B: 80, C: 55, D: 20 },
  /** checklist not filled in yet counts as 0 (plan §9.1) */
  notAssessedScaled: 0,
} as const;

export type MetricId = 'cost' | 'distance' | 'reviews' | 'quality' | 'verification' | 'fairwork' | 'sustainability';

export const METRICS: { id: MetricId; label: string; defaultWeight: number }[] = [
  { id: 'cost', label: 'Landed cost', defaultWeight: 25 },
  { id: 'distance', label: 'Distance', defaultWeight: 10 },
  { id: 'reviews', label: 'Verified reviews', defaultWeight: 15 },
  { id: 'quality', label: 'Quality and delivery', defaultWeight: 15 },
  { id: 'verification', label: 'Verification', defaultWeight: 10 },
  { id: 'fairwork', label: 'Fair Work', defaultWeight: 10 },
  { id: 'sustainability', label: 'Sustainability', defaultWeight: 15 },
];

export const DEFAULT_WEIGHTS: Record<MetricId, number> =
  Object.fromEntries(METRICS.map((m) => [m.id, m.defaultWeight])) as Record<MetricId, number>;

export const PRESETS: { id: 'balanced' | 'cost' | 'green' | 'fair'; label: string; weights: Record<MetricId, number> }[] = [
  { id: 'balanced', label: 'Balanced', weights: { ...DEFAULT_WEIGHTS } },
  { id: 'cost', label: 'Lowest cost', weights: { cost: 50, distance: 10, reviews: 10, quality: 15, verification: 5, fairwork: 5, sustainability: 5 } },
  { id: 'green', label: 'Greenest', weights: { cost: 15, distance: 10, reviews: 10, quality: 10, verification: 5, fairwork: 10, sustainability: 40 } },
  { id: 'fair', label: 'Fair and local', weights: { cost: 10, distance: 20, reviews: 10, quality: 5, verification: 5, fairwork: 30, sustainability: 20 } },
];

export interface Contribution {
  /** the raw input (₹, km, stars, trust points, checklist score) */
  value: number;
  /** the raw input on the fixed 0-100 scale */
  scaled: number;
  /** the weight used for THIS supplier (0 when the metric is not graded for them) */
  weight: number;
  /** provenance tag for the Src chip: estimated / verified / declared / simulated, or not graded / not assessed */
  source: string;
}

export interface RankedSupplier {
  sellerId: string;
  sangamScore: number;
  contributions: Record<MetricId, Contribution>;
  level: SustainabilityLevel;
  grade: Grade | null;
  landedCost: number;
  km: number;
  /** average of verified reviews out of 5, or null with no verified reviews */
  stars: number | null;
  /** transport CO2 per unit on the estimated route factors - INFORMATION ONLY, never ranked on */
  co2KgPerUnit: number;
  excluded?: 'fairwork-e';
}

export interface RankInput {
  sellers: Seller[];
  line: BomLine;
  state: StoreState;
  weights: Record<MetricId, number>;
  /** the supplier's checklist answers, or null/undefined when not assessed */
  answersFor: (sellerId: string) => SustainabilityAnswers | null | undefined;
  /** import-cost scenario for the reference price; defaults to the standard scenario */
  scenario?: Scenario;
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
const REVIEWS_MAX_POINTS = 35; // the 'Verified reviews' TrustPart max in trust.ts

/**
 * The Fair Work grade for an arbitrary seller, from the cheapest path available: the seed
 * workforce profiles keyed by name (simulated demo data). null = no profile on file, so the
 * metric is not graded for this supplier and drops out of their weighted average.
 */
export function fairWorkFor(seller: Seller): ScoredWork | null {
  const wf = seedWorkforceFor(seller.name, seller.id);
  return wf ? scoreProfile(wf) : null;
}

/**
 * Rank suppliers for one BOM line. E-grade sellers are excluded (flagged, sorted last, never
 * ranked). Weights that sum to zero (or less) return every Sangam score as 0 safely. The
 * Sangam score renormalises over the metrics actually graded for each supplier, so a supplier
 * with no Fair Work profile is not punished for it.
 */
export function rankSuppliers(input: RankInput): RankedSupplier[] {
  const { sellers, line, state, weights, answersFor } = input;
  const scenario = input.scenario ?? DEFAULT_SCENARIO;
  const importRef = importLineCost(line, scenario);
  const rows = sellers.map((s) => rankOne(s, line, state, weights, answersFor(s.id), importRef));
  const ranked = rows.filter((r) => !r.excluded).sort((a, b) => b.sangamScore - a.sangamScore);
  return [...ranked, ...rows.filter((r) => r.excluded)];
}

function rankOne(
  s: Seller, line: BomLine, state: StoreState, weights: Record<MetricId, number>,
  answers: SustainabilityAnswers | null | undefined, importRef: number,
): RankedSupplier {
  const d = district(s.districtId);
  const plant = district(buyer.plantDistrictId);
  const km = roadKm(d, plant);

  // Cost: delivered cost (price + road freight) plus the defect cost chainRoute charges
  // (defect rate x 3x part value), against today's import cost for the line under the scenario.
  const price = line.cost * s.priceIndex;
  const landedCost = deliveredCost(line, s.priceIndex, s.districtId) + price * (s.details.defectPpm / 1e6) * 3;
  const ratio = importRef > 0 ? landedCost / importRef : 1;
  const costScaled = clamp100(
    (100 * (RANKING_RULES.costWorstShareOfImport - ratio))
      / (RANKING_RULES.costWorstShareOfImport - RANKING_RULES.costBestShareOfImport),
  );

  const distanceScaled = clamp100(
    (100 * (RANKING_RULES.distanceWorstKm - km)) / (RANKING_RULES.distanceWorstKm - RANKING_RULES.distanceBestKm),
  );

  // Reviews and verification come from the trust score; the review part is separated so its
  // points are never counted twice (plan §3.1).
  const t = trustScore(s, state);
  const reviewPart = t.parts.find((p) => p.label === 'Verified reviews')!;
  const hasReviews = t.reviews.verified.length > 0;
  const reviewsScaled = hasReviews
    ? clamp100((100 * reviewPart.points) / REVIEWS_MAX_POINTS)
    : RANKING_RULES.noReviewScaled;
  const reviewsValue = hasReviews
    ? RANKING_RULES.reviewWorstStars + (reviewPart.points / REVIEWS_MAX_POINTS) * (RANKING_RULES.reviewBestStars - RANKING_RULES.reviewWorstStars)
    : RANKING_RULES.noReviewPriorStars;

  const otifScaled = clamp100(
    (100 * (s.details.otifPct - RANKING_RULES.otifWorstPct)) / (RANKING_RULES.otifBestPct - RANKING_RULES.otifWorstPct),
  );
  const defectScaled = clamp100(100 * (1 - s.details.defectPpm / RANKING_RULES.defectWorstPpm));
  const qualityScaled = (otifScaled + defectScaled) / 2;

  const verificationPoints = t.score - reviewPart.points;
  const verificationScaled = clamp100((100 * verificationPoints) / RANKING_RULES.verificationMaxPoints);

  // Fair Work: A 100, B 80, C 55, D 20; E is blocked from the list entirely.
  const fw = fairWorkFor(s);
  const grade = fw?.grade ?? null;
  const isExcluded = grade === 'E';
  const fairworkScaled = grade && grade !== 'E' ? RANKING_RULES.fairworkScaled[grade] : 0;

  // Sustainability: the checklist score as-is; not assessed counts as 0 (plan §9.1).
  const sus = answers ? scoreSustainability(answers, active.sector) : null;

  const contributions: Record<MetricId, Contribution> = {
    cost: { value: Math.round(landedCost), scaled: costScaled, weight: weights.cost, source: 'estimated' },
    distance: { value: km, scaled: distanceScaled, weight: weights.distance, source: 'estimated' },
    reviews: {
      value: +reviewsValue.toFixed(2), scaled: reviewsScaled, weight: weights.reviews,
      source: hasReviews ? 'verified' : 'estimated',
    },
    quality: { value: s.details.otifPct, scaled: qualityScaled, weight: weights.quality, source: 'declared' },
    verification: { value: verificationPoints, scaled: verificationScaled, weight: weights.verification, source: 'verified' },
    fairwork: {
      value: fw?.wagePerWorkerDay ?? 0,
      scaled: fairworkScaled,
      weight: grade && grade !== 'E' ? weights.fairwork : 0,
      source: fw ? 'simulated' : 'not graded',
    },
    sustainability: {
      value: sus?.score ?? 0,
      scaled: sus ? sus.score : RANKING_RULES.notAssessedScaled,
      weight: weights.sustainability,
      source: sus ? 'declared' : 'not assessed',
    },
  };

  // Weighted average over the metrics actually graded for this supplier. A total weight of
  // zero (all sliders at 0) returns 0 for everyone instead of dividing by zero.
  const totalWeight = METRICS.reduce((n, m) => n + Math.max(0, contributions[m.id].weight), 0);
  const weighted = METRICS.reduce((n, m) => n + Math.max(0, contributions[m.id].weight) * contributions[m.id].scaled, 0);
  const sangamScore = totalWeight > 0 ? +((weighted / totalWeight).toFixed(1)) : 0;

  return {
    sellerId: s.id,
    sangamScore: isExcluded ? 0 : sangamScore,
    contributions,
    level: sus?.level ?? 'Not assessed',
    grade,
    landedCost,
    km,
    stars: t.reviews.avg,
    co2KgPerUnit: partRoute(line, s, 1, 'balanced').co2,
    excluded: isExcluded ? 'fairwork-e' : undefined,
  };
}
