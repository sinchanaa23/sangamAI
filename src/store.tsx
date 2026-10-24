import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { loadDataset } from './data';
import { EMPTY } from './model';
import type { StoreState } from './model';
import { seedSector } from './seeds';

const KEY = 'sangam-store-v2';

function read(): StoreState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.version === 2) return { ...EMPTY, ...s };
    }
  } catch { /* storage unavailable */ }
  return EMPTY;
}

interface Ctx {
  state: StoreState;
  update: (fn: (s: StoreState) => StoreState) => void;
  /** changes whenever the active dataset is reloaded; use as a React key or memo dependency */
  dataVersion: number;
  reset: () => void;
}

const StoreContext = createContext<Ctx | null>(null);
let loads = 0;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(read);
  const update = useCallback((fn: (s: StoreState) => StoreState) => setState(fn), []);

  // Load the active dataset synchronously so every child renders against it
  const dataVersion = useMemo(() => {
    loadDataset(state.sector, state.overrides[state.sector], state.onboarded.filter((o) => o.sector === state.sector), (state.customSites ?? []).filter((c) => c.sector === state.sector));
    return ++loads;
  }, [state.sector, state.overrides, state.onboarded, state.customSites]);

  // Seed sample activity the first time a sector is opened
  useEffect(() => {
    if (state.seeded[state.sector]) return;
    const seed = seedSector();
    setState((s) => (s.seeded[s.sector] ? s : {
      ...s,
      seeded: { ...s.seeded, [s.sector]: true },
      requirements: [...s.requirements, ...seed.requirements],
      quotes: [...s.quotes, ...seed.quotes],
      interests: [...s.interests, ...seed.interests],
      reviews: [...s.reviews, ...seed.reviews],
      projects: [...s.projects, ...seed.projects], // P3: seed demo development projects (additive line, flagged in the PR)
    }));
  }, [state.sector, state.seeded, dataVersion]);

  // P3: sessions seeded before development projects existed get a one-time top-up
  // for the active sector (idempotent by project id, runs at most once per sector).
  // Additive block, flagged in the PR.
  const toppedUp = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!state.seeded[state.sector] || toppedUp.current[state.sector]) return;
    if (state.projects.some((p) => p.sector === state.sector)) return;
    const seed = seedSector();
    const missing = seed.projects.filter((p) => p.sector === state.sector);
    if (!missing.length) { toppedUp.current[state.sector] = true; return; }
    toppedUp.current[state.sector] = true;
    setState((s) => (s.projects.some((p) => p.sector === s.sector) ? s : { ...s, projects: [...s.projects, ...missing] }));
  }, [state.sector, state.seeded, state.projects, dataVersion]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, [state]);

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    setState({ ...EMPTY });
  }, []);

  return <StoreContext.Provider value={{ state, update, dataVersion, reset }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const c = useContext(StoreContext);
  if (!c) throw new Error('useStore outside StoreProvider');
  return c;
}
