// Sangam trust score: an explainable 0-100 score built from checks the Sangam team has done,
// profile completeness, reviews verified against real orders, and order history.
import type { Check, Review, StoreState } from './model';
import type { Provenance, Seller } from './types';

export interface TrustPart { label: string; points: number; max: number; detail: string }
export interface Trust {
  score: number;
  band: 'Trusted' | 'Good' | 'Building' | 'New';
  parts: TrustPart[];
  reviews: { verified: Review[]; pending: number; avg: number | null; dims: Record<keyof Review['ratings'], number> | null };
}

export function checksFor(seller: Seller, state: StoreState): { identity: Check; certs: Record<string, Check>; capacity: Check } {
  const v = state.verifications[seller.id];
  if (v) return v;
  const ok: Check = seller.verification === 'verified' ? 'verified' : 'pending';
  return { identity: ok, certs: Object.fromEntries(seller.certs.map((c) => [c, ok])), capacity: ok };
}

export function fieldSource(seller: Seller, check: Check): Provenance {
  if (check === 'verified') return seller.origin === 'simulated' ? 'simulated' : 'verified';
  return seller.origin === 'simulated' ? 'simulated' : 'declared';
}

export function trustScore(seller: Seller, state: StoreState): Trust {
  const checks = checksFor(seller, state);
  const all = state.reviews.filter((r) => r.sellerId === seller.id);
  const verified = all.filter((r) => r.status === 'verified');
  const avgOf = (r: Review) => (r.ratings.quality + r.ratings.delivery + r.ratings.communication + r.ratings.compliance) / 4;
  const avg = verified.length ? verified.reduce((s, r) => s + avgOf(r), 0) / verified.length : null;
  // Bayesian average: two virtual reviews at 3.5 keep one glowing review from dominating
  const bayes = (verified.reduce((s, r) => s + avgOf(r), 0) + 2 * 3.5) / (verified.length + 2);
  const dims = verified.length
    ? (['quality', 'delivery', 'communication', 'compliance'] as const).reduce((o, k) => ({ ...o, [k]: verified.reduce((s, r) => s + r.ratings[k], 0) / verified.length }), {} as Record<keyof Review['ratings'], number>)
    : null;

  const certVals = Object.values(checks.certs);
  const certShare = certVals.length ? certVals.filter((c) => c === 'verified').length / certVals.length : 0;
  const fields = [seller.details.machines.length > 0, seller.details.about.length > 10, seller.details.certDetails.length > 0 || seller.certs.length === 0, seller.monthlyCapacity > 0, seller.details.languages.length > 0, checks.capacity === 'verified'];
  const completeness = fields.filter(Boolean).length / fields.length;
  const orders = seller.details.completedOrders;

  const parts: TrustPart[] = [
    { label: 'Identity checked (Udyam, GST)', points: checks.identity === 'verified' ? 15 : 0, max: 15, detail: checks.identity === 'verified' ? 'Checked by the Sangam team' : 'Waiting for verification' },
    { label: 'Certificates checked', points: Math.round(20 * (certVals.length ? certShare : 0.5)), max: 20, detail: certVals.length ? `${certVals.filter((c) => c === 'verified').length} of ${certVals.length} verified` : 'No certificates claimed' },
    { label: 'Profile completeness', points: Math.round(15 * completeness), max: 15, detail: `${Math.round(completeness * 100)}% of key fields, capacity ${checks.capacity === 'verified' ? 'verified' : 'self-declared'}` },
    { label: 'Verified reviews', points: verified.length ? Math.round((35 * (bayes - 1)) / 4) : 0, max: 35, detail: verified.length ? `${verified.length} verified, average ${avg!.toFixed(1)} of 5` : 'No verified reviews yet' },
    { label: 'Order history', points: Math.round(15 * Math.min(1, Math.log10(1 + orders) / 2.3)), max: 15, detail: `${orders} completed orders` },
  ];
  const score = parts.reduce((s, p) => s + p.points, 0);
  return {
    score, band: score >= 80 ? 'Trusted' : score >= 60 ? 'Good' : score >= 40 ? 'Building' : 'New', parts,
    reviews: { verified, pending: all.filter((r) => r.status === 'pending').length, avg, dims },
  };
}
