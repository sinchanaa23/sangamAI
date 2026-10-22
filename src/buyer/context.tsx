import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { generateChains, recommend } from '../engine';
import type { Chain } from '../engine';
import { riskFromSignals } from '../live';
import { DEFAULT_SCENARIO } from '../scenario';
import type { Chokepoint, Scenario } from '../scenario';
import { useStore } from '../store';
import type { Weights } from '../types';
import { useLive } from './useLive';
import type { Live } from './useLive';
import type { SimTab } from './SimulatorPage';
import type { RouteTab } from './RoutesPage';

interface BuyerCtx {
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  weights: Weights;
  setWeights: (w: Weights) => void;
  chains: Chain[];
  recommended: Chain;
  chain: Chain;
  pickChain: (id: string) => void;
  extraChain: Chain | null;
  setExtraChain: (c: Chain | null) => void;
  live: Live;
  risk: Record<Chokepoint, number>;
  simTab: SimTab;
  setSimTab: (t: SimTab) => void;
  routeTab: RouteTab;
  setRouteTab: (t: RouteTab) => void;
}

const Ctx = createContext<BuyerCtx | null>(null);

export function BuyerProvider({ children }: { children: ReactNode }) {
  const { state, update, dataVersion } = useStore();
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [weights, setWeights] = useState<Weights>({ cost: 3, speed: 2, quality: 2, resilience: 2 });
  const [simTab, setSimTab] = useState<SimTab>('live');
  const [routeTab, setRouteTab] = useState<RouteTab>('intl');
  const [extraChain, setExtraChain] = useState<Chain | null>(null);
  const live = useLive();

  const chains = useMemo(() => generateChains(weights, scenario), [weights, scenario, dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const recommended = useMemo(() => recommend(chains, weights), [chains, weights]);
  const pickedId = state.chosen[state.sector]?.chainId;
  const chain = (pickedId === 'optimised' && extraChain) || chains.find((c) => c.id === pickedId) || recommended;
  const pickChain = (id: string) => update((s) => ({ ...s, chosen: { ...s.chosen, [s.sector]: { ...s.chosen[s.sector], chainId: id } } }));
  const risk = useMemo(() => riskFromSignals(live.signals), [live.signals]);

  return (
    <Ctx.Provider value={{ scenario, setScenario, weights, setWeights, chains, recommended, chain, pickChain, extraChain, setExtraChain, live, risk, simTab, setSimTab, routeTab, setRouteTab }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBuyer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useBuyer outside BuyerProvider');
  return c;
}
