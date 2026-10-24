// Buyer-side state around P1's API helpers: which negotiation the room shows, and cached scorecards.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getScorecard } from '../../api';
import type { FairWorkScore, NegotiationSummary, Rfq } from '../../contracts';

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
