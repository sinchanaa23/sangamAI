// TEMPORARY mirror of the three calls the buyer screens need from src/api.ts (owned by P1, on feat/agents).
// Same paths and behaviour; switch the imports to '../../api' and delete this file once P1's branch is on main.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { FairWorkScore, NegotiationEvent, Rfq } from './types';

export interface NegotiationSummary { id: string; rfqId: string; status: 'running' | 'done'; mode: 'live' | 'replay'; outcome?: 'deal' | 'no-deal'; dealId?: string }
export type RfqInput = Omit<Rfq, 'id'> & { id?: string };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
  const j = await r.json().catch(() => ({ error: `Server returned ${r.status}` }));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}

export const startNegotiation = (rfq: RfqInput, supplierIds: string[]) =>
  call<NegotiationSummary>('/api/negotiations', { method: 'POST', body: JSON.stringify({ rfq, supplierIds }) });

export const getScorecard = (supplierId: string) => call<FairWorkScore>(`/api/scorecard/${encodeURIComponent(supplierId)}`);

/** Follow a negotiation's server-sent events. Returns a function that stops listening. */
export function streamNegotiation(id: string, onEvent: (e: NegotiationEvent) => void, onError: () => void): () => void {
  const es = new EventSource(`/api/negotiations/${encodeURIComponent(id)}/stream`);
  es.onmessage = (m) => {
    const e = JSON.parse(m.data) as NegotiationEvent;
    onEvent(e);
    if (e.type === 'end') es.close(); // otherwise EventSource reconnects and replays
  };
  es.onerror = () => { es.close(); onError(); };
  return () => es.close();
}

// ---------- Which negotiation the room shows ----------

export interface RoomSession { id: string; rfq: Rfq; mode: NegotiationSummary['mode'] }
let session: RoomSession | null = null;
const listeners = new Set<() => void>();
export function openRoom(s: RoomSession | null) { session = s; listeners.forEach((l) => l()); }
export const useRoomSession = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => session);

// ---------- Scorecards, fetched once per supplier ----------

const cache = new Map<string, Promise<FairWorkScore | null>>();
export function useScorecard(supplierId: string): FairWorkScore | null | undefined {
  const [score, setScore] = useState<FairWorkScore | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!cache.has(supplierId)) cache.set(supplierId, getScorecard(supplierId).catch(() => null));
    cache.get(supplierId)!.then((s) => { if (alive) setScore(s); });
    return () => { alive = false; };
  }, [supplierId]);
  return score;
}
