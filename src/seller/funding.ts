// Server sync for funding applications. The store (src/model.ts StoreState.funding,
// localStorage-persisted) is the working copy pages read; these helpers sync it to
// P1's /api/funding route so two laptops see the same listings. All best-effort:
// when the route is missing or the server is offline the store keeps working.
import type { FundingApplication } from '../funding';

/** All server-known applications, or null when the route/server is unavailable. */
export async function fetchServerFunding(): Promise<FundingApplication[] | null> {
  try {
    const r = await fetch('/api/funding');
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? (j as FundingApplication[]) : null;
  } catch {
    return null;
  }
}

/** Upsert one application on the server. True when the server accepted it. */
export async function putServerFunding(app: FundingApplication): Promise<boolean> {
  try {
    const r = await fetch(`/api/funding/${encodeURIComponent(app.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(app),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Remove one application from the server (supplier withdrew it). */
export async function deleteServerFunding(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/funding/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return r.ok;
  } catch {
    return false;
  }
}
