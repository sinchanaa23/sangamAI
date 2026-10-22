import { buyer, unitLabel } from '../data';
import { inr } from '../engine';
import { suggestScenario } from '../live';
import type { FeedState } from '../live';
import { evaluateLane, todayLane } from '../routes';
import { CHOKEPOINTS } from '../scenario';
import type { Scenario } from '../scenario';
import { NEUTRAL, simulateShock } from '../sim';
import MapCanvas from '../components/MapCanvas';
import type { MapLine, MapPoint } from '../components/MapCanvas';
import Slider from '../components/Slider';
import Tabs from '../components/Tabs';
import type { Live } from './useLive';
import { useBuyer } from './context';

export type SimTab = 'live' | 'whatif';

const LEVEL_COLOR = { low: '#15803d', elevated: '#b45309', high: '#b91c1c' };

function FeedDot({ name, state }: { name: string; state: FeedState<unknown> }) {
  const cls = state.status === 'ok' ? 'ok' : state.status === 'error' ? 'err' : 'load';
  const text = state.status === 'ok' ? 'live' : state.status === 'error' ? 'unavailable' : 'loading';
  return <span className="feed"><span className={`d ${cls}`} />{name}: {text}</span>;
}

export default function SimulatorPage() {
  const { simTab: tab, setSimTab: setTab, scenario, setScenario, live } = useBuyer();
  return (
    <div>
      <Tabs
        tabs={[{ id: 'live', label: 'Live world' }, { id: 'whatif', label: 'What-if simulator' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'live'
        ? <LiveWorld live={live} onApply={(s) => { setScenario(s); setTab('whatif'); }} scenario={scenario} />
        : <WhatIf scenario={scenario} setScenario={setScenario} />}
    </div>
  );
}

function LiveWorld({ live, scenario, onApply }: { live: Live; scenario: Scenario; onApply: (s: Scenario) => void }) {
  const { fx, hazards, news, signals, refresh } = live;
  const lane = evaluateLane(todayLane(), NEUTRAL);
  const hz = hazards.status === 'ok' ? hazards.data : [];
  const fxData = fx.status === 'ok' ? fx.data : null;
  const proposal = suggestScenario(scenario, signals, fxData);
  const onLane = signals.filter((s) => ['taiwan', 'malacca', 'shanghai', 'chennai'].includes(s.id));

  const lines: MapLine[] = lane.paths.map((p, i) => ({ id: `l${i}`, coords: p, color: '#334155', width: 2 }));
  const points: MapPoint[] = [
    ...hz.map((h) => ({ id: h.id, at: h.at, color: h.level === 'Red' ? '#dc2626' : '#f59e0b', r: 3.5 })),
    ...signals.map((s) => ({
      id: s.id, at: s.at, color: LEVEL_COLOR[s.level], r: 5.5, ring: s.level !== 'low', label: s.name,
      side: (s.id === 'redSea' || s.id === 'hormuz' ? 'left' : s.id === 'chennai' ? 'bottom' : 'right') as MapPoint['side'],
    })),
  ];

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <h1 className="lead">What is happening on your supply lanes now</h1>
          <div className="row" style={{ gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
            <FeedDot name="Exchange rates" state={fx} />
            <FeedDot name="Disaster alerts" state={hazards} />
            <FeedDot name="News" state={news} />
          </div>
        </div>
        <button className="btn" onClick={refresh}>Refresh</button>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="card">
          <MapCanvas view="world" lines={lines} points={points} ariaLabel="Live risk on today's shipping lane" />
          <div className="legend">
            <span><i style={{ background: '#334155' }} />Today&apos;s lane, {todayLane().origin} to Chennai</span>
            <span><i className="dot" style={{ background: '#15803d' }} />Low</span>
            <span><i className="dot" style={{ background: '#b45309' }} />Elevated</span>
            <span><i className="dot" style={{ background: '#b91c1c' }} />High</span>
            <span><i className="dot" style={{ background: '#f59e0b' }} />Disaster alert{hz.length ? ` (${[...new Set(hz.map((h) => h.source))].join(', ')})` : ''}</span>
          </div>
        </div>
        <div className="card">
          <div className="section-title">Watch list</div>
          <div className="stack" style={{ gap: 12 }}>
            {signals.map((s) => (
              <div key={s.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b style={{ fontWeight: 500 }}>{s.name}</b>
                  <span className={`level ${s.level}`}>{s.level}</span>
                </div>
                <div className="tiny">{s.reasons.slice(0, 2).join(' · ')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1.6fr' }}>
        <div className="card">
          <div className="section-title">Currency</div>
          {fxData ? (
            <div className="stack" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">US dollar</span><b>{'₹'}{fxData.usdInr.toFixed(2)}</b></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Chinese yuan</span><b>{'₹'}{fxData.cnyInr.toFixed(2)}</b></div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Rupee vs dollar, 30 days</span>
                <b className={fxData.changePct > 0 ? 'up' : 'down'}>{fxData.changePct > 0 ? 'weaker' : 'stronger'} by {Math.abs(fxData.changePct).toFixed(1)}%</b>
              </div>
              <div className="tiny">ECB reference rates via Frankfurter, {fxData.date}</div>
            </div>
          ) : <p className="muted small">{fx.status === 'loading' ? 'Loading…' : 'Exchange rates are unavailable right now.'}</p>}
        </div>
        <div className="card">
          <div className="section-title">Headlines on your lanes, last 7 days</div>
          {news.status === 'ok' && news.data.some((h) => h.tags.length) ? (
            <ul className="headlines">
              {news.data.filter((h) => h.tags.length).slice(0, 6).map((h) => (
                <li key={h.url}>
                  <a href={h.url} target="_blank" rel="noreferrer">{h.title}</a>
                  <div className="tiny">{h.domain}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">
              {news.status === 'loading' ? 'Loading…' : 'The GDELT news feed did not respond (it is often rate-limited). Signals use disaster alerts and exchange rates only. Try Refresh in a minute.'}
            </p>
          )}
        </div>
      </div>

      <div className="card row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>Turn these signals into a what-if</div>
          <p className="small muted">
            Suggested: {proposal.delayWeeks} week{proposal.delayWeeks === 1 ? '' : 's'} extra delay
            {onLane.some((s) => s.level !== 'low') ? ' from alerts on your lane' : ''}
            {CHOKEPOINTS.filter((c) => proposal.closed[c.id]).map((c) => `, ${c.name} closed`).join('')}
            {proposal.fxPct > 0 ? `, rupee ${proposal.fxPct}% weaker` : ''}. You can adjust everything next.
          </p>
        </div>
        <button className="btn primary" onClick={() => onApply(proposal)}>Load into what-if</button>
      </div>
    </div>
  );
}

function WhatIf({ scenario: s, setScenario }: { scenario: Scenario; setScenario: (s: Scenario) => void }) {
  const set = (patch: Partial<Scenario>) => setScenario({ ...s, ...patch });
  const shock = simulateShock(s);
  const base = evaluateLane(todayLane(), NEUTRAL);
  const rise = ((shock.unitCost - buyer.unitCost) / buyer.unitCost) * 100;

  const lines: MapLine[] = [
    ...(shock.lane.status !== 'normal' ? base.paths.map((p, i) => ({ id: `b${i}`, coords: p, color: '#94a3b8', width: 1.4, dash: '4 4' })) : []),
    ...shock.lane.paths.map((p, i) => ({ id: `l${i}`, coords: p, color: shock.lane.status === 'normal' ? '#334155' : '#b45309', width: 2.2 })),
  ];
  const points: MapPoint[] = [
    { id: 'o', at: todayLane().originPoint, color: '#334155', label: todayLane().origin, side: 'right' },
    { id: 'd', at: [80.35, 13.1], color: '#0f766e', label: 'Chennai', side: 'bottom', bold: true },
    ...CHOKEPOINTS.map((c) => ({ id: c.id, at: [c.lon, c.lat] as [number, number], color: s.closed[c.id] ? '#b91c1c' : '#94a3b8', r: s.closed[c.id] ? 6 : 4, ring: s.closed[c.id], label: s.closed[c.id] ? `${c.name} closed` : undefined, side: (c.id === 'redSea' || c.id === 'hormuz' ? 'left' : 'right') as MapPoint['side'] })),
  ];

  return (
    <div className="stack">
      <div className="card">
        <h1 className="lead">What if trade gets harder?</h1>
        <p className="muted" style={{ marginTop: 6 }}>Set your own values. Every other page in the buyer workspace uses this scenario.</p>
        <div className="grid-2" style={{ marginTop: 20, gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Slider label="Extra import duty on today's source" value={s.duty} min={0} max={50} step={5} format={(v) => `+${v}%`} onChange={(v) => set({ duty: v })} />
          <Slider label="Shipping delay" value={s.delayWeeks} min={0} max={8} format={(v) => (v === 0 ? 'None' : `${v} week${v > 1 ? 's' : ''}`)} onChange={(v) => set({ delayWeeks: v })} />
          <Slider label="Ocean freight rates" value={s.freightX} min={1} max={4} step={0.5} format={(v) => (v === 1 ? 'Normal' : `${v}×`)} onChange={(v) => set({ freightX: v })} />
          <Slider label="Rupee weakens against the dollar" value={s.fxPct} min={0} max={20} step={0.5} format={(v) => (v === 0 ? 'No change' : `${v}%`)} onChange={(v) => set({ fxPct: v })} />
        </div>
        <div style={{ marginTop: 18 }}>
          <div className="small muted" style={{ marginBottom: 8 }}>Close a chokepoint</div>
          <div className="toggle-row">
            {CHOKEPOINTS.map((c) => (
              <button key={c.id} className={`pill danger ${s.closed[c.id] ? 'on' : ''}`} onClick={() => set({ closed: { ...s.closed, [c.id]: !s.closed[c.id] } })}>
                {s.closed[c.id] ? '✕ ' : ''}{c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-4">
        <div className="stat">
          <div className="label">Cost per {buyer.unitLabel}</div>
          <div className="value">{inr(shock.unitCost)}</div>
          <div className={`delta ${rise > 0.5 ? 'up' : 'muted'}`}>{rise > 0.5 ? `+${rise.toFixed(1)}% vs today` : 'About the same'}</div>
        </div>
        <div className="stat">
          <div className="label">Extra cost per month</div>
          <div className="value">{'₹'}{(shock.extraPerMonth / 1e7).toFixed(2)} Cr</div>
          <div className="delta muted">{buyer.monthlyUnits.toLocaleString('en-IN')} {unitLabel()}</div>
        </div>
        <div className="stat">
          <div className="label">Lead time</div>
          <div className="value">{shock.leadDays} days</div>
          <div className={`delta ${shock.leadDays > buyer.importLeadDays ? 'up' : 'muted'}`}>usually {buyer.importLeadDays}</div>
        </div>
        <div className="stat">
          <div className="label">Scooters not built</div>
          <div className="value">{shock.lostUnits.toLocaleString('en-IN')}</div>
          <div className={`delta ${shock.stockoutDays > 0 ? 'up' : 'muted'}`}>{shock.stockoutDays > 0 ? `${shock.stockoutDays} days of stock-out` : 'Safety stock covers it'}</div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap' }}>
          <div className="section-title" style={{ margin: 0 }}>Today&apos;s lane under this scenario</div>
          <span className={`chip ${shock.lane.status === 'normal' ? 'ready' : 'potential'}`}>
            {shock.lane.status === 'normal' ? 'Normal route' : `Rerouted ${shock.lane.note ?? ''}`}
          </span>
        </div>
        <MapCanvas view="world" lines={lines} points={points} ariaLabel="Today's shipping lane under the scenario" />
        <p className="small muted" style={{ marginTop: 10 }}>
          {Math.round(shock.lane.distanceKm).toLocaleString('en-IN')} km by sea. Your {buyer.safetyStockDays}-day safety stock absorbs delays of up to {buyer.safetyStockDays / 7} weeks; beyond that the line stops.
        </p>
      </div>
    </div>
  );
}
