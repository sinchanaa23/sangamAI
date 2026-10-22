import { useState } from 'react';
import { CartesianGrid, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { bom, buyer } from '../data';
import { district, inr } from '../engine';
import type { Chain } from '../engine';
import { CHENNAI_PORT, domesticLanes, evaluateLanes, importInlandLane } from '../routes';
import type { DomesticLane, LaneResult, Mode } from '../routes';
import type { Chokepoint, Scenario } from '../scenario';
import { CHOKEPOINTS } from '../scenario';
import MapCanvas from '../components/MapCanvas';
import type { MapLine, MapPoint } from '../components/MapCanvas';
import Tabs from '../components/Tabs';

export type RouteTab = 'intl' | 'domestic';
type Priority = 'cost' | 'time' | 'balanced';

interface Props {
  tab: RouteTab;
  setTab: (t: RouteTab) => void;
  scenario: Scenario;
  risk: Record<Chokepoint, number>;
  chain: Chain;
}

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 'cost', label: 'Cheapest' },
  { id: 'time', label: 'Fastest' },
  { id: 'balanced', label: 'Balanced' },
];

function rank<T>(items: T[], cost: (t: T) => number, time: (t: T) => number, extra: (t: T) => number, p: Priority): T[] {
  const n = (f: (t: T) => number) => {
    const v = items.map(f), lo = Math.min(...v), hi = Math.max(...v);
    return (t: T) => (hi === lo ? 0 : (f(t) - lo) / (hi - lo));
  };
  const c = n(cost), t = n(time);
  const w = p === 'cost' ? [1, 0.15] : p === 'time' ? [0.15, 1] : [1, 1];
  return [...items].sort((a, b) => w[0] * c(a) + w[1] * t(a) + extra(a) - (w[0] * c(b) + w[1] * t(b) + extra(b)));
}

function PriorityPills({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="toggle-row">
      {PRIORITIES.map((p) => <button key={p.id} className={`pill ${value === p.id ? 'on' : ''}`} onClick={() => onChange(p.id)}>{p.label}</button>)}
    </div>
  );
}

export default function RoutesPage({ tab, setTab, scenario, risk, chain }: Props) {
  return (
    <div>
      <Tabs tabs={[{ id: 'intl', label: 'International' }, { id: 'domestic', label: 'Domestic' }]} value={tab} onChange={setTab} />
      {tab === 'intl' ? <International scenario={scenario} risk={risk} /> : <Domestic chain={chain} />}
    </div>
  );
}

// ---------------- International ----------------

function International({ scenario, risk }: { scenario: Scenario; risk: Record<Chokepoint, number> }) {
  const [priority, setPriority] = useState<Priority>('balanced');
  const [picked, setPicked] = useState<string | null>(null);
  const all = evaluateLanes(scenario, risk);
  const today = all.find((r) => r.lane.id === 'cn-sea')!;
  const open = all.filter((r) => r.status !== 'blocked' && r.lane.id !== 'cn-sea');
  const ranked = rank(open, (r) => r.costPerHarness, (r) => r.days, (r) => r.risk * 0.6, priority);
  const best = ranked[0];
  const sel = all.find((r) => r.lane.id === picked) ?? best;
  const vs = (r: LaneResult) => ((r.costPerHarness - today.costPerHarness) / today.costPerHarness) * 100;

  const lines: MapLine[] = [
    ...all.filter((r) => r !== sel && r !== today).flatMap((r) => r.paths.map((p, i) => ({ id: `${r.lane.id}${i}`, coords: p, color: '#94a3b8', width: 1.2, opacity: 0.55, dash: r.lane.mode === 'air' ? '3 4' : undefined }))),
    ...today.paths.map((p, i) => ({ id: `today${i}`, coords: p, color: '#334155', width: 2, dash: today === sel ? undefined : '6 4' })),
    ...(sel !== today ? sel.paths.map((p, i) => ({ id: `sel${i}`, coords: p, color: '#0f766e', width: 3, dash: sel.lane.mode === 'air' ? '3 4' : undefined })) : []),
  ];
  const points: MapPoint[] = [
    ...all.filter((r) => r.lane.mode === 'sea').map((r) => ({
      id: r.lane.id, at: r.lane.originPoint, color: r === sel ? '#0f766e' : r === today ? '#334155' : '#64748b', r: r === sel ? 5 : 3.5,
      label: r.lane.country.replace(' (EU)', ''), bold: r === sel, side: (r.lane.id === 'eu-sea' ? 'top' : r.lane.id === 'ae-sea' ? 'top' : r.lane.id === 'th-sea' ? 'left' : 'right') as MapPoint['side'],
    })),
    { id: 'chennai', at: CHENNAI_PORT, color: '#0f766e', label: 'Chennai', side: 'bottom', bold: true },
    ...CHOKEPOINTS.filter((c) => scenario.closed[c.id]).map((c) => ({ id: c.id, at: [c.lon, c.lat] as [number, number], color: '#b91c1c', r: 5, ring: true })),
  ];

  const scatter = all.filter((r) => r.status !== 'blocked').map((r) => ({ id: r.lane.id, name: r.lane.mode === 'air' ? 'China (air)' : r.lane.country.replace(' (EU)', ''), days: r.days, cost: Math.round(r.costPerHarness) }));

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="lead">
            Best alternative: {best.lane.origin}, {best.lane.country}
          </h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {best.days} days and {inr(best.costPerHarness)} per harness, {Math.abs(vs(best)).toFixed(1)}% {vs(best) < 0 ? 'cheaper' : 'dearer'} than today&apos;s lane under your scenario.
          </p>
        </div>
        <PriorityPills value={priority} onChange={(p) => { setPriority(p); setPicked(null); }} />
      </div>

      <div className="card">
        <MapCanvas view="world" lines={lines} points={points} ariaLabel="International supply routes to Chennai" />
        <div className="legend">
          <span><i style={{ background: '#334155' }} />Today: Shanghai</span>
          <span><i style={{ background: '#0f766e' }} />Selected: {sel.lane.origin}</span>
          <span><i style={{ background: '#94a3b8' }} />Other options</span>
          {CHOKEPOINTS.some((c) => scenario.closed[c.id]) && <span><i className="dot" style={{ background: '#b91c1c' }} />Closed in your scenario</span>}
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1.25fr' }}>
        <div className="card">
          <div className="section-title">Time vs cost</div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 24, bottom: 18, left: 8 }}>
                <CartesianGrid stroke="#eef0f3" />
                <XAxis type="number" dataKey="days" name="Days" unit=" d" tick={{ fontSize: 12, fill: '#5a6472' }} label={{ value: 'Door-to-door days', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#8a93a0' }} />
                <YAxis type="number" dataKey="cost" name="Cost" domain={['auto', 'auto']} tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 12, fill: '#5a6472' }} width={60} />
                <ZAxis range={[90, 90]} />
                <Tooltip formatter={(v: number, n: string) => (n === 'Cost' ? inr(v) : `${v} days`)} cursor={false} />
                <Scatter data={scatter} isAnimationActive={false} onClick={(d: { id: string }) => setPicked(d.id)} shape={(raw: unknown) => {
                  const props = raw as { cx: number; cy: number; payload: { id: string } };
                  return <circle cx={props.cx} cy={props.cy} r={props.payload.id === sel.lane.id ? 8 : 6} fill={props.payload.id === sel.lane.id ? '#0f766e' : props.payload.id === 'cn-sea' ? '#334155' : '#94a3b8'} style={{ cursor: 'pointer' }} />;
                }}>
                  <LabelList dataKey="name" position="right" style={{ fontSize: 11, fill: '#5a6472' }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="tiny">Lower and further left is better. Click a dot to show its route.</p>
        </div>

        <div className="card">
          <div className="section-title">All options</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>From</th><th className="num">Days</th><th className="num">Per harness</th><th className="num">vs today</th><th>Status</th></tr>
              </thead>
              <tbody>
                {[today, ...ranked, ...all.filter((r) => r.status === 'blocked')].map((r) => (
                  <tr key={r.lane.id} className={`rowsel ${r === sel ? 'on' : ''}`} onClick={() => setPicked(r.lane.id)}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.lane.origin}{r.lane.id === 'cn-sea' && <span className="tiny"> · today</span>}</div>
                      <div className="tiny">{r.lane.country}{r.lane.agreement ? ` · ${r.lane.agreement}` : ''}</div>
                    </td>
                    <td className="num">{r.status === 'blocked' ? '—' : r.days}</td>
                    <td className="num">{r.status === 'blocked' ? '—' : inr(r.costPerHarness)}</td>
                    <td className={`num ${vs(r) > 0.5 ? 'up' : vs(r) < -0.5 ? 'down' : ''}`}>{r.lane.id === 'cn-sea' || r.status === 'blocked' ? '' : `${vs(r) > 0 ? '+' : ''}${vs(r).toFixed(1)}%`}</td>
                    <td>
                      {r.status === 'blocked' ? <span className="chip danger">Blocked</span>
                        : r.status === 'rerouted' ? <span className="chip potential" title={r.note}>Rerouted</span>
                          : r.chokepoints.length ? <span className="chip plain" title={r.chokepoints.join(', ')}>via {r.chokepoints.length} strait{r.chokepoints.length > 1 ? 's' : ''}</span>
                            : <span className="chip ready">Direct</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="tiny">Sea speed 700 km a day plus port, customs and road time. Supplier prices, freight rates and trade-agreement duty cuts are simulated.</p>
    </div>
  );
}

// ---------------- Domestic ----------------

const MODE_COLOR: Record<Mode, string> = { road: '#475569', rail: '#7c3aed', coastal: '#0891b2' };
const MODE_LABEL: Record<Mode, string> = { road: 'Road', rail: 'Rail', coastal: 'Coastal ship' };

function Domestic({ chain }: { chain: Chain }) {
  const [priority, setPriority] = useState<Priority>('balanced');
  const plantId = buyer.plantDistrictId;
  const plant = district(plantId);

  // Group the chain's suppliers by district: tonnes per month and which parts
  const byDistrict = new Map<string, { tonnes: number; parts: string[] }>();
  bom.forEach((line) => {
    const o = chain.picks[line.id];
    if (!o) return;
    const cap = o.sellers.reduce((t, x) => t + x.monthlyCapacity, 0);
    o.sellers.forEach((s) => {
      if (s.districtId === plantId) return;
      const share = o.sellers.length === 1 ? 1 : s.monthlyCapacity / cap;
      const e = byDistrict.get(s.districtId) ?? { tonnes: 0, parts: [] };
      e.tonnes += (line.weightKg * share * buyer.monthlyUnits) / 1000;
      if (!e.parts.includes(line.name)) e.parts.push(line.name);
      byDistrict.set(s.districtId, e);
    });
  });

  const lanes = [...byDistrict.entries()].map(([id, e]) => {
    const opts = domesticLanes(district(id));
    const best = rank(opts, (l) => l.costPerT, (l) => l.days, () => 0, priority)[0];
    return { id, ...e, opts, best };
  });
  const monthly = (l: DomesticLane, t: number) => l.costPerT * t;
  const chosenCost = lanes.reduce((t, l) => t + monthly(l.best, l.tonnes), 0);
  const roadCost = lanes.reduce((t, l) => t + monthly(l.opts[0], l.tonnes), 0);
  const chosenCo2 = lanes.reduce((t, l) => t + l.best.co2PerT * l.tonnes, 0);
  const roadCo2 = lanes.reduce((t, l) => t + l.opts[0].co2PerT * l.tonnes, 0);
  const inland = importInlandLane();

  const lines: MapLine[] = [
    { id: 'imp', coords: inland.path, color: '#94a3b8', width: 2, dash: '5 4' },
    ...lanes.flatMap((l) => l.opts.filter((o) => o !== l.best).map((o) => ({ id: `${l.id}-${o.mode}`, coords: o.path, color: MODE_COLOR[o.mode], width: 1, opacity: 0.25 }))),
    ...lanes.map((l) => ({ id: `${l.id}-best`, coords: l.best.path, color: MODE_COLOR[l.best.mode], width: 2.6, dash: l.best.mode === 'coastal' ? '2 4' : undefined })),
  ];
  const points: MapPoint[] = [
    ...lanes.map((l) => ({ id: l.id, at: [district(l.id).lon, district(l.id).lat] as [number, number], color: MODE_COLOR[l.best.mode], hollow: true, label: district(l.id).name, side: (['vapi', 'rajkot'].includes(l.id) ? 'left' : 'right') as MapPoint['side'] })),
    { id: 'chennai', at: CHENNAI_PORT, color: '#94a3b8', r: 3.5, label: 'Chennai port', side: 'right' },
    { id: 'plant', at: [plant.lon, plant.lat], color: '#0f766e', r: 6, ring: true, label: `Plant, ${plant.name}`, side: 'left', bold: true },
  ];

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="lead">Moving parts inside India for the {chain.name.toLowerCase()} chain</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {lanes.length} supplier districts ship to your plant. The best mix costs {inr(chosenCost)} a month
            {roadCost - chosenCost > 1 ? `, ${inr(roadCost - chosenCost)} less than all-road` : ''} and emits {Math.round(chosenCo2).toLocaleString('en-IN')} kg CO₂
            {roadCo2 - chosenCo2 > 1 ? ` (${Math.round(((roadCo2 - chosenCo2) / roadCo2) * 100)}% less than road)` : ''}.
          </p>
        </div>
        <PriorityPills value={priority} onChange={setPriority} />
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
        <div className="card">
          <MapCanvas view="india" lines={lines} points={points} ariaLabel="Domestic supply routes to the plant" />
          <div className="legend">
            <span><i style={{ background: MODE_COLOR.road }} />Road</span>
            <span><i style={{ background: MODE_COLOR.rail }} />Rail</span>
            <span><i style={{ background: MODE_COLOR.coastal }} />Coastal ship</span>
            <span><i style={{ background: '#94a3b8' }} />Today: imports from Chennai port</span>
          </div>
          <p className="tiny" style={{ marginTop: 8 }}>India boundary: DataMeet (CC BY 4.0). Routes are illustrative.</p>
        </div>

        <div className="card">
          <div className="section-title">Mode options per lane</div>
          <div className="stack" style={{ gap: 14 }}>
            {lanes.map((l) => (
              <div key={l.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <b style={{ fontWeight: 600 }}>{district(l.id).name} → {plant.name}</b>
                  <span className="tiny">{l.tonnes.toFixed(1)} t/month · {l.parts.join(', ')}</span>
                </div>
                <div className="toggle-row" style={{ marginTop: 8 }}>
                  {l.opts.map((o) => (
                    <div key={o.mode} className={`pill ${o === l.best ? 'on' : ''}`} style={{ borderRadius: 10, padding: '6px 10px' }}>
                      <b style={{ color: MODE_COLOR[o.mode] }}>{MODE_LABEL[o.mode]}</b>{' '}
                      {o.days} d · {inr(monthly(o, l.tonnes))}/mo · {Math.round(o.co2PerT * l.tonnes)} kg CO₂
                      {o.via && <div className="tiny">via {o.via}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {lanes.length === 0 && <p className="muted">All suppliers in this chain are in {plant.name}; no long-haul lanes needed.</p>}
          </div>
        </div>
      </div>
      <p className="tiny">Road {'₹'}3.0, rail {'₹'}1.6 and coastal {'₹'}0.9 per tonne-km plus terminal charges. Rail is offered above 600 km when an inland container depot is close; coastal when a western port is close.</p>
    </div>
  );
}
