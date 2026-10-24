// Suppliers' reviews of buyers (the other half of the review system; buyers' reviews of suppliers live in the store, see
// src/components/ReviewForm.tsx). Uses the shared server (server/reviews.ts) for a signed-in account, and this browser tab's
// storage for the offline demo, so the page works either way.
import { useCallback, useEffect, useState } from 'react';

export const DIMS = [
  { key: 'payment', label: 'Paid on time' },
  { key: 'specs', label: 'Clear specifications' },
  { key: 'terms', label: 'Fair terms' },
  { key: 'communication', label: 'Communication' },
] as const;
export type Dim = (typeof DIMS)[number]['key'];

export interface BuyerReview {
  id: string;
  buyerName: string;
  author: string;
  orderRef: string;
  orderValueLakh: number;
  ratings: Record<Dim, number>;
  text: string;
  evidence: string;
  status: 'pending' | 'verified' | 'rejected';
  verifierNote?: string;
  at: string;
  /** written by the signed-in account (set by the server) */
  mine?: boolean;
  /** demo data, tagged simulated on screen */
  sample?: boolean;
}
export type Draft = Pick<BuyerReview, 'buyerName' | 'orderRef' | 'orderValueLakh' | 'ratings' | 'text' | 'evidence'>;

/** Demo reviews so the page is not empty on day one. They are invented and shown as Simulated. */
export const SAMPLE_REVIEWS: BuyerReview[] = [
  { id: 'sample-1', buyerName: 'Veer Electric Mobility', author: 'Satara Gramin Assembly Co-op', orderRef: 'PO-DEMO-0101', orderValueLakh: 9, ratings: { payment: 4, specs: 5, terms: 4, communication: 5 }, text: 'Drawings were complete and changes came with a revised PO. Payment arrived a week after the agreed date.', evidence: 'Demo order', status: 'verified', at: '2026-09-12T10:00:00Z', sample: true },
  { id: 'sample-2', buyerName: 'Veer Electric Mobility', author: 'Krishnagiri Mahila Harness Collective', orderRef: 'PO-DEMO-0102', orderValueLakh: 6, ratings: { payment: 5, specs: 4, terms: 5, communication: 4 }, text: 'Agreed a wage-safe price up front and did not push it down later. Clear about quality checks.', evidence: 'Demo order', status: 'verified', at: '2026-09-28T10:00:00Z', sample: true },
];

const LOCAL_KEY = 'sangam.buyerReviews';
const readLocal = (): BuyerReview[] => { try { return JSON.parse(sessionStorage.getItem(LOCAL_KEY) ?? '[]') as BuyerReview[]; } catch { return []; } };
const writeLocal = (rows: BuyerReview[]) => { try { sessionStorage.setItem(LOCAL_KEY, JSON.stringify(rows)); } catch { /* private window: keep it in memory only */ } };

export const overall = (r: Pick<BuyerReview, 'ratings'>) => DIMS.reduce((s, d) => s + r.ratings[d.key], 0) / DIMS.length;

export interface BuyerSummary { buyerName: string; count: number; avg: number; dims: Record<Dim, number> }
/** Average rating per buyer from verified reviews only. */
export function summarise(rows: BuyerReview[]): BuyerSummary[] {
  const by = new Map<string, BuyerReview[]>();
  rows.filter((r) => r.status === 'verified').forEach((r) => by.set(r.buyerName, [...(by.get(r.buyerName) ?? []), r]));
  return [...by.entries()].map(([buyerName, rs]) => ({
    buyerName, count: rs.length, avg: rs.reduce((s, r) => s + overall(r), 0) / rs.length,
    dims: Object.fromEntries(DIMS.map((d) => [d.key, rs.reduce((s, r) => s + r.ratings[d.key], 0) / rs.length])) as Record<Dim, number>,
  })).sort((a, b) => b.avg - a.avg);
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: `Server returned ${r.status}` }));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}

/** All reviews of buyers, samples included. `mode` says where real ones live: the server, or this tab (offline demo). */
export function useBuyerReviews(mode: 'server' | 'offline' | null, offlineAuthor: string) {
  const [rows, setRows] = useState<BuyerReview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (mode === 'server') {
      try { setRows(await call<BuyerReview[]>('/api/reviews/buyers')); setLoading(false); return; } catch { /* fall through to this tab's copy */ }
    }
    setRows(mode === 'offline' ? readLocal() : []);
    setLoading(false);
  }, [mode]);
  useEffect(() => { void load(); }, [load]);

  const submit = useCallback(async (d: Draft) => {
    if (mode === 'server') await call('/api/reviews/buyers', d);
    else writeLocal([{ ...d, id: `local-${Date.now().toString(36)}`, author: offlineAuthor, status: 'pending', at: new Date().toISOString(), mine: true }, ...readLocal()]);
    await load();
  }, [mode, offlineAuthor, load]);

  const decide = useCallback(async (id: string, status: 'verified' | 'rejected', note?: string) => {
    await call(`/api/reviews/buyers/${encodeURIComponent(id)}/decide`, { status, note: note || undefined });
    await load();
  }, [load]);

  return { reviews: [...SAMPLE_REVIEWS, ...rows], loading, submit, decide, reload: load };
}
