import { useState } from 'react';
import { CartesianGrid, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { bom, buyer } from '../data';
import { district, inr, isRural } from '../engine';
import { partRoute, rank } from '../chainRoute';
import type { Priority } from '../chainRoute';
import { CHENNAI_PORT, evaluateLanes, importInlandLane, todayLane } from '../routes';
import type { LaneResult, Mode } from '../routes';
import { CHOKEPOINTS } from '../scenario';
import { trustScore } from '../trust';
import { useStore } from '../store';
import { useUi } from '../ui';
import MapCanvas from '../components/MapCanvas';
import type { MapLine, MapPoint } from '../components/MapCanvas';
import Roadmap, { LandedCostBar } from '../components/Roadmap';
import Tabs from '../components/Tabs';
import Src from '../components/Src';
import { useBuyer } from './context';

export type RouteTab = 'intl' | 'domestic';

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 'cost', label: 'Cheapest' },
  { id: 'time', label: 'Fastest' },
  { id: 'balanced', label: 'Balanced' },
];

function PriorityPills({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="toggle-row">
      {PRIORITIES.map((p) => <button key={p.id} className={`pill ${value === p.id ? 'on' : ''}`} onClick={() => onChange(p.id)}>{p.label}</button>)}
    </div>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function RoutesPage() {
  const { routeTab: tab, setRouteTab: setTab } = useBuyer();
  return (
    <div>
      <Tabs tabs={[{ id: 'intl', label: 'International' }, { id: 'domestic', label: 'Domestic' }]} value={tab} onChange={setTab} />
      {tab === 'intl' ? <International /> : <Domestic />}
    </div>
  );
}

// ---------------- International ----------------

function International() {
  const { scenario, risk } = useBuyer();
  const [priority, setPriority] = useState<Priority>('balanced');
  const [picked, setPicked] = useState<string | null>(null);
  const all = evaluateLanes(scenario, risk);
  const today = all.find((r) => r.lane.id === todayLane().id)!;
  const open = all.filter((r) => r.status !== 'blocked' && r !== today);
  const ranked = rank(open, (r) => r.costPerUnit, (r) => r.p90, (r) => r.risk * 0.6 + (1 - r.reliability) * 0.5, priority);
  const best = ranked[0];
  const sel = all.find((r) => r.lane.id === picked) ?? best;
  const vs = (r: LaneResult) => ((r.costPerUnit - today.costPerUnit) / today.costPerUnit) * 100;
  const u = buyer.unitLabel;

  const lines: MapLine[] = [
    ...all.filter((r) => r !== sel && r !== today).flatMap((r) => r.paths.map((p, i) => ({ id: `${r.lane.id}${i}`, coords: p, color: '#b4b2ac', width: 1.2, opacity: 0.55, dash: r.lane.mode === 'air' ? '3 4' : undefined }))),
    ...today.paths.map((p, i) => ({ id: `today${i}`, coords: p, color: '#2f3437', width: 2, dash: today === sel ? undefined : '6 4' })),
    ...(sel !== today ? sel.paths.map((p, i) => ({ id: `sel${i}`, coords: p, color: '#3d5a45', width: 3, dash: sel.lane.mode === 'air' ? '3 4' : undefined })) : []),
  ];
  const points: MapPoint[] = [
    ...all.filter((r) => r.lane.mode === 'sea').map((r) => ({
      id: r.lane.id, at: r.lane.originPoint, color: r === sel ? '#3d5a45' : r === today ? '#2f3437' : '#787774', r: r === sel ? 5 : 3.5,
      label: r.lane.country.replace(' (EU)', ''), bold: r === sel, side: (r.lane.id === 'eu-sea' || r.lane.id === 'ae-sea' ? 'top' : ['th-sea', 'kr-sea', 'cn-sea'].includes(r.lane.id) ? 'left' : 'right') as MapPoint['side'],
    })),
    { id: 'chennai', at: CHENNAI_PORT, color: '#3d5a45', label: 'Chennai', side: 'bottom', bold: true },
    ...CHOKEPOINTS.filter((c) => scenario.closed[c.id]).map((c) => ({ id: c.id, at: [c.lon, c.lat] as [number, number], color: '#9f2f2d', r: 5, ring: true })),
  ];
  const scatter = all.filter((r) => r.status !== 'blocked').map((r) => ({ id: r.lane.id, name: r.lane.mode === 'air' ? `${r.lane.country} (air)` : r.lane.country.replace(' (EU)', ''), days: r.p90, cost: Math.round(r.costPerUnit) }));
  const compare = Object.fromEntries(today.legs.map((l) => [l.id, l]));

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="lead">Best alternative: {best.lane.origin}, {best.lane.country}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {best.days} days (up to {best.p90}) and {inr(best.costPerUnit)} per {u} landed, {Math.abs(vs(best)).toFixed(1)}% {vs(best) < 0 ? 'cheaper' : 'dearer'} than today&apos;s route under your scenario.
          </p>
        </div>
        <PriorityPills value={priority} onChange={(p) => { setPriority(p); setPicked(null); }} />
      </div>

      <div className="card">
        <MapCanvas view="world" lines={lines} points={points} ariaLabel="International supply routes to Chennai" />
        <div className="legend">
          <span><i style={{ background: '#2f3437' }} />Today: {today.lane.origin}</span>
          <span><i style={{ background: '#3d5a45' }} />Selected: {sel.lane.origin}</span>
          <span><i style={{ background: '#b4b2ac' }} />Other options</span>
          {CHOKEPOINTS.some((c) => scenario.closed[c.id]) && <span><i className="dot" style={{ background: '#9f2f2d' }} />Closed in your scenario</span>}
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1.3fr' }}>
        <div className="card">
          <div className="section-title">Time vs landed cost</div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 70, bottom: 18, left: 8 }}>
                <CartesianGrid stroke="#efeeea" />
                <XAxis type="number" dataKey="days" name="Days" unit=" d" tick={{ fontSize: 12, fill: '#6b6a66' }} label={{ value: 'Worst-case door-to-door days', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#9a9892' }} />
                <YAxis type="number" dataKey="cost" name="Cost" domain={['auto', 'auto']} tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 12, fill: '#6b6a66' }} width={70} />
                <ZAxis range={[90, 90]} />
                <Tooltip formatter={(v: number, n: string) => (n === 'Cost' ? inr(v) : `${v} days`)} cursor={false} />
                <Scatter data={scatter} isAnimationActive={false} onClick={(d: { id: string }) => setPicked(d.id)} shape={(raw: unknown) => {
                  const p = raw as { cx: number; cy: number; payload: { id: string } };
                  return <circle cx={p.cx} cy={p.cy} r={p.payload.id === sel.lane.id ? 8 : 6} fill={p.payload.id === sel.lane.id ? '#3d5a45' : p.payload.id === today.lane.id ? '#2f3437' : '#b4b2ac'} style={{ cursor: 'pointer' }} />;
                }}>
                  <LabelList dataKey="name" content={(raw: unknown) => {
                    const p = raw as { x: number; y: number; width: number; height: number; value: string };
                    return <text x={p.x + p.width + 4} y={p.y + p.height / 2 + 4} fontSize={11} fill="#6b6a66">{p.value}</text>;
                  }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="tiny">Lower and further left is better. Click a dot to see its roadmap.</p>
        </div>

        <div className="card">
          <div className="section-title">All options</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>From</th><th className="num">Days</th><th className="num">Landed / {u}</th><th className="num">On time</th><th>Status</th></tr></thead>
              <tbody>
                {[today, ...ranked, ...all.filter((r) => r.status === 'blocked')].map((r) => (
                  <tr key={r.lane.id} className={`rowsel ${r === sel ? 'on' : ''}`} onClick={() => setPicked(r.lane.id)}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{r.lane.origin}{r === today && <span className="tiny"> · today</span>}</div>
                      <div className="tiny">{r.lane.country}{r.lane.agreement ? ` · ${r.lane.agreement}` : ''}{r.lpi ? ` · LPI ${r.lpi}` : ''}</div>
                    </td>
                    <td className="num">{r.status === 'blocked' ? '—' : <>{r.days}<div className="tiny">up to {r.p90}</div></>}</td>
                    <td className="num">{r.status === 'blocked' ? '—' : <>{inr(r.costPerUnit)}{r !== today && <div className={`tiny ${vs(r) > 0.5 ? 'up' : vs(r) < -0.5 ? 'down' : ''}`}>{vs(r) > 0 ? '+' : ''}{vs(r).toFixed(1)}%</div>}</>}</td>
                    <td className="num">{r.status === 'blocked' ? '—' : pct(r.reliability)}</td>
                    <td>
                      {r.status === 'blocked' ? <span className="chip danger">Blocked</span>
                        : r.status === 'rerouted' ? <span className="chip potential" title={r.note}>Rerouted</span>
                          : r.chokepoints.length ? <span className="chip plain">via {r.chokepoints.length} strait{r.chokepoints.length > 1 ? 's' : ''}</span>
                            : <span className="chip ready">Direct</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny" style={{ marginTop: 8 }}>LPI = World Bank Logistics Performance Index of the origin country <Src kind="public" />. It sets each route&apos;s port and schedule reliability.</p>
        </div>
      </div>

      {sel.status !== 'blocked' && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="eyebrow">Route roadmap</div>
              <h2 className="lead" style={{ fontSize: 21, marginTop: 4 }}>{sel.lane.origin}, {sel.lane.country} → your plant</h2>
              <p className="small muted" style={{ marginTop: 4 }}>
                {sel.legs.length} legs · {sel.days} days on average, {sel.p90} in a bad month · {inr(sel.costPerUnit)} per {u} landed · {pct(sel.reliability)} chance of arriving on plan · {sel.co2Kg.toFixed(1)} kg CO₂ per {u}
                {sel !== today && <> · cost differences shown against today&apos;s {today.lane.origin} route</>}
              </p>
            </div>
          </div>
          <div style={{ margin: '14px 0 18px' }}><LandedCostBar legs={sel.legs} /></div>
          <Roadmap legs={sel.legs} unit={u} compare={sel !== today ? compare : undefined} />
          <p className="tiny">Port charges, freight rates, duty and supplier quality are indicative or simulated (tags on each leg). Documents and the sequence of steps follow real Indian import practice.</p>
        </div>
      )}
    </div>
  );
}

// ---------------- Domestic ----------------

const MODE_COLOR: Record<Mode, string> = { road: '#5f5e5a', rail: '#5b6f8f', coastal: '#2f7f86' };
const MODE_LABEL: Record<Mode, string> = { road: 'Road', rail: 'Rail', coastal: 'Coastal ship' };

function Domestic() {
  const { chain } = useBuyer();
  const { state } = useStore();
  const { openSupplier } = useUi();
  const [priority, setPriority] = useState<Priority>('balanced');
  const [openPart, setOpenPart] = useState<string | null>(null);
  const plant = district(buyer.plantDistrictId);
  const u = buyer.unitLabel;

  const parts = bom.map((line) => {
    const o = chain.picks[line.id];
    if (!o) return { line, routes: [] };
    const cap = o.sellers.reduce((t, x) => t + x.monthlyCapacity, 0);
    return { line, routes: o.sellers.map((s) => partRoute(line, s, o.sellers.length === 1 ? 1 : s.monthlyCapacity / cap, priority)) };
  });
  const allRoutes = parts.flatMap((p) => p.routes);
  const freightMonth = allRoutes.reduce((t, r) => t + r.legs.filter((l) => l.mode !== 'make' && l.mode !== 'check').reduce((s, l) => s + l.cost, 0) * r.share * buyer.monthlyUnits, 0);
  const co2Month = allRoutes.reduce((t, r) => t + r.co2 * r.share * buyer.monthlyUnits, 0);
  const inland = importInlandLane();

  const lines: MapLine[] = [
    { id: 'imp', coords: inland.path, color: '#b4b2ac', width: 2, dash: '5 4' },
    ...allRoutes.flatMap((r) => r.options.filter((o) => o !== r.lane).map((o) => ({ id: `${r.seller.id}-${o.mode}`, coords: o.path, color: MODE_COLOR[o.mode], width: 1, opacity: 0.25 }))),
    ...allRoutes.filter((r) => r.lane).map((r) => ({ id: `${r.seller.id}-best`, coords: r.lane!.path, color: MODE_COLOR[r.lane!.mode], width: 2.6, dash: r.lane!.mode === 'coastal' ? '2 4' : undefined })),
  ];
  const seen = new Set<string>();
  const points: MapPoint[] = [
    ...allRoutes.filter((r) => r.lane && !seen.has(r.seller.districtId) && seen.add(r.seller.districtId)).map((r) => ({ id: r.seller.districtId, at: [district(r.seller.districtId).lon, district(r.seller.districtId).lat] as [number, number], color: MODE_COLOR[r.lane!.mode], hollow: true, label: district(r.seller.districtId).name, side: (['vapi', 'rajkot', 'sanand', 'satara', 'dharwad'].includes(r.seller.districtId) ? 'left' : 'right') as MapPoint['side'] })),
    { id: 'chennai', at: CHENNAI_PORT, color: '#b4b2ac', r: 3.5, label: 'Chennai port', side: 'right' },
    { id: 'plant', at: [plant.lon, plant.lat], color: '#3d5a45', r: 6, ring: true, label: `Plant, ${plant.name}`, side: 'left', bold: true },
  ];

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="lead">Indian routes for the {chain.name.toLowerCase()} chain</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Inbound freight about {inr(freightMonth)} a month and {Math.round(co2Month).toLocaleString('en-IN')} kg CO₂. Open a part to see its full roadmap: inputs, supplier, every transport leg and inspection.
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
            <span><i style={{ background: '#b4b2ac' }} />Today: imports via Chennai port</span>
          </div>
          <p className="tiny" style={{ marginTop: 8 }}>India boundary: DataMeet (CC BY 4.0). Routes are drawn straight for clarity.</p>
        </div>

        <div className="card">
          <div className="section-title">Each part, start to finish</div>
          <table>
            <thead><tr><th>Part</th><th>Supplier</th><th className="num">Days</th><th className="num">Per {u}</th></tr></thead>
            <tbody>
              {parts.map((p) => p.routes.length === 0 ? (
                <tr key={p.line.id}><td>{p.line.name}</td><td colSpan={3} className="small muted">Still imported in this chain</td></tr>
              ) : p.routes.map((r, i) => (
                <tr key={`${p.line.id}-${r.seller.id}`} className={`rowsel ${openPart === `${p.line.id}-${r.seller.id}` ? 'on' : ''}`} onClick={() => setOpenPart(`${p.line.id}-${r.seller.id}`)}>
                  <td>{i === 0 ? p.line.name : ''}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.seller.name}{isRural(r.seller) && <> <span className="chip rural">{r.seller.type}</span></>}</div>
                    <div className="tiny">{district(r.seller.districtId).name} · {r.lane ? MODE_LABEL[r.lane.mode] : 'Local'} · trust {trustScore(r.seller, state).score}{p.routes.length > 1 ? ` · ${Math.round(r.share * 100)}% of volume` : ''}</div>
                  </td>
                  <td className="num">{r.days}<div className="tiny">up to {r.p90}</div></td>
                  <td className="num">{inr(r.cost)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {(() => {
        const entries = parts.flatMap((p) => p.routes.map((r) => ({ key: `${p.line.id}-${r.seller.id}`, line: p.line, r })));
        const found = entries.find((e) => e.key === openPart) ?? entries[0];
        if (!found) return null;
        const { line, r: sel } = found;
        return (
          <div className="card">
            <div className="eyebrow">Route roadmap</div>
            <h2 className="lead" style={{ fontSize: 21, marginTop: 4 }}>{line.name}: {sel.seller.name} → your plant</h2>
            <p className="small muted" style={{ marginTop: 4 }}>
              {sel.days} days on average, {sel.p90} in a bad month · {inr(sel.cost)} per {u} delivered · {pct(sel.reliability)} chance of arriving on plan · {sel.co2.toFixed(1)} kg CO₂ per {u}
            </p>
            {line.tiers.length > 0 && (
              <>
                <div className="small" style={{ fontWeight: 600, margin: '14px 0 6px' }}>Upstream inputs the supplier buys <Src kind="estimated" /></div>
                <div className="upstream" style={{ marginLeft: 0 }}>
                  {line.tiers.map((t) => <span key={t.name} className={`chip ${t.indianSupply === 'strong' ? 'ready' : t.indianSupply === 'partial' ? 'potential' : 'danger'}`}>{t.name}: {t.indianRegions}</span>)}
                </div>
              </>
            )}
            <div style={{ margin: '14px 0 18px' }}><LandedCostBar legs={sel.legs} /></div>
            <Roadmap legs={sel.legs.map((l) => (l.id === 'make' ? { ...l, onWho: () => openSupplier(sel.seller.id) } : l))} unit={u} />
            {sel.options.length > 1 && (
              <div className="toggle-row" style={{ marginTop: 6 }}>
                <span className="small muted">Other modes:</span>
                {sel.options.filter((o) => o !== sel.lane).map((o) => <span key={o.mode} className="chip plain">{MODE_LABEL[o.mode]}: {o.days} d, {inr(o.costPerT * line.weightKg / 1000)} per {u}, {Math.round(o.co2PerT * line.weightKg / 1000 * 10) / 10} kg CO₂</span>)}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
