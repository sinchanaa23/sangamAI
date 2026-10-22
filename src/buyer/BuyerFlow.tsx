import { useMemo, useState } from 'react';
import { generateChains, recommend } from '../engine';
import { riskFromSignals } from '../live';
import { DEFAULT_SCENARIO } from '../scenario';
import type { Scenario } from '../scenario';
import type { Weights } from '../types';
import StepToday from './StepToday';
import SimulatorPage from './SimulatorPage';
import type { SimTab } from './SimulatorPage';
import RoutesPage from './RoutesPage';
import type { RouteTab } from './RoutesPage';
import StepChains from './StepChains';
import NetworkPage from './NetworkPage';
import { useLive } from './useLive';

const PAGES = ['Current suppliers', 'Simulator', 'Alternate routes', 'Indian options', 'Future network'];

export default function BuyerFlow() {
  const [page, setPage] = useState(0);
  const [simTab, setSimTab] = useState<SimTab>('live');
  const [routeTab, setRouteTab] = useState<RouteTab>('intl');
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [weights, setWeights] = useState<Weights>({ cost: 3, speed: 2, quality: 2, resilience: 2 });
  const [picked, setPicked] = useState<string | null>(null);
  const live = useLive();

  const chains = useMemo(() => generateChains(weights, scenario), [weights, scenario]);
  const recommended = useMemo(() => recommend(chains, weights), [chains, weights]);
  const chain = chains.find((c) => c.id === picked) ?? recommended;
  const risk = useMemo(() => riskFromSignals(live.signals), [live.signals]);

  return (
    <div>
      <nav className="stepper" aria-label="Pages">
        {PAGES.map((s, i) => (
          <button key={s} className={`step ${i === page ? 'on' : i < page ? 'done' : ''}`} onClick={() => setPage(i)}>
            <span className="num">{i + 1}</span>
            <span className="label">{s}</span>
          </button>
        ))}
      </nav>

      {page === 0 && <StepToday />}
      {page === 1 && <SimulatorPage tab={simTab} setTab={setSimTab} scenario={scenario} setScenario={setScenario} live={live} />}
      {page === 2 && <RoutesPage tab={routeTab} setTab={setRouteTab} scenario={scenario} risk={risk} chain={chain} />}
      {page === 3 && (
        <StepChains chains={chains} chain={chain} recommendedId={recommended.id} onPick={setPicked} weights={weights} setWeights={setWeights} scenario={scenario} />
      )}
      {page === 4 && <NetworkPage scenario={scenario} weights={weights} />}

      <div className="nav">
        <button className="btn" disabled={page === 0} onClick={() => { setPage(page - 1); window.scrollTo(0, 0); }}>Back</button>
        <button className="btn primary" disabled={page === PAGES.length - 1} onClick={() => { setPage(page + 1); window.scrollTo(0, 0); }}>
          Next: {PAGES[page + 1] ?? ''}
        </button>
      </div>
    </div>
  );
}
