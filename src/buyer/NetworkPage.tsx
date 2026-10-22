import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buyer } from '../data';
import { district, inr } from '../engine';
import { architectures, DEFAULT_GROWTH, horizon } from '../network';
import type { Growth } from '../network';
import type { Scenario } from '../scenario';
import type { Weights } from '../types';
import MapCanvas from '../components/MapCanvas';
import type { MapLine, MapPoint } from '../components/MapCanvas';
import NetworkDiagram, { STATUS_COLOR, STATUS_LABEL } from '../components/NetworkDiagram';
import Slider from '../components/Slider';

const HORIZONS = [5, 10, 12, 15, 20];
const cr = (n: number) =>
  Math.abs(n) < 1 && n !== 0 ? `₹${Math.round(n * 100)} lakh` : `₹${Math.abs(n) >= 100 ? Math.round(n).toLocaleString('en-IN') : n.toFixed(1)} Cr`;

export default function NetworkPage({ scenario, weights }: { scenario: Scenario; weights: Weights }) {
  const [archId, setArchId] = useState<string | null>(null);
  const [years, setYears] = useState(15);
  const [view, setView] = useState<'map' | 'diagram'>('map');
  const [chart, setChart] = useState<'cost' | 'net'>('cost');
  const [growth, setGrowth] = useState<Growth>(DEFAULT_GROWTH);

  const archs = useMemo(() => architectures(scenario, weights), [scenario, weights]);
  const results = useMemo(() => archs.map((a) => ({ a, h: horizon(a, scenario, years, growth) })), [archs, scenario, years, growth]);
  const bestId = [...results].sort((x, y) => y.h.npvCr - x.h.npvCr)[0].a.id;
  const { a: arch, h } = results.find((r) => r.a.id === (archId ?? bestId))!;
  const plant = district(buyer.plantDistrictId);

  const lines: MapLine[] = arch.lines.flatMap((l) => l.nodes.filter((n) => n.districtId !== plant.id).map((n) => ({
    id: `${l.line.id}-${n.key}`, coords: [[district(n.districtId).lon, district(n.districtId).lat], [plant.lon, plant.lat]], color: STATUS_COLOR[n.status], width: 1.6, dash: n.status === 'available' ? undefined : '5 4',
  })));
  const seen = new Map<string, string>();
  arch.lines.forEach((l) => l.nodes.forEach((n) => {
    const prev = seen.get(n.districtId);
    if (!prev || n.status === 'new' || (n.status === 'upgrade' && prev === 'available')) seen.set(n.districtId, n.status);
  }));
  const points: MapPoint[] = [
    ...[...seen.entries()].filter(([id]) => id !== plant.id).map(([id, st]) => ({
      id, at: [district(id).lon, district(id).lat] as [number, number], color: STATUS_COLOR[st as keyof typeof STATUS_COLOR], r: 5,
      label: district(id).name, side: (['vapi', 'rajkot', 'coimbatore', 'dharwad', 'satara', 'madurai'].includes(id) ? 'left' : 'right') as MapPoint['side'],
    })),
    { id: 'plant', at: [plant.lon, plant.lat], color: '#0f766e', r: 6, ring: true, label: `Plant, ${plant.name}${seen.has(plant.id) ? ' + local sites' : ''}`, side: 'bottom', bold: true },
  ];

  const pts = h.points.map((p) => ({ year: `Y${p.year}`, Import: Math.round(p.importCum), India: Math.round(p.indiaCum), net: Math.round(p.net) }));

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Four ways to build your harness network in India</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Each design shows what is available today, what needs an upgrade and what must be set up, with cost against importing under your scenario.
        </p>
      </div>

      <div className="grid-4">
        {results.map(({ a, h: ah }) => {
          const d = ((a.unitCost - a.importCost) / a.importCost) * 100;
          return (
            <button key={a.id} className={`chain ${a.id === arch.id ? 'on' : ''}`} onClick={() => setArchId(a.id)}>
              {a.id === bestId && <span className="reco">Best {years}-yr value</span>}
              <div>
                <div className="name">{a.name}</div>
                <div className="tiny">{a.idea}</div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="price" style={{ fontSize: 19 }}>{inr(a.unitCost)}</span>
                <span className={`chip ${d < 0 ? 'ready' : 'danger'}`}>{Math.abs(d).toFixed(0)}% {d < 0 ? 'less' : 'more'}</span>
              </div>
              <div className="metrics" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <span><b>{cr(a.capexCr)}</b>to set up</span>
                <span><b>{a.readyMonths} mo</b>to full switch</span>
                <span><b>{a.resilience}/100</b>resilience</span>
                <span><b>{ah.breakEvenYear ? `Year ${ah.breakEvenYear}` : 'Not yet'}</b>break-even</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>{arch.name}: where you get what</div>
          <div className="segmented">
            <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>Map</button>
            <button className={view === 'diagram' ? 'on' : ''} onClick={() => setView('diagram')}>Network diagram</button>
          </div>
        </div>
        {view === 'diagram' ? (
          <div className="table-wrap"><div style={{ minWidth: 640 }}><NetworkDiagram arch={arch} /></div></div>
        ) : (
          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1.25fr' }}>
            <div><MapCanvas view="india" lines={lines} points={points} ariaLabel={`${arch.name} on a map of India`} /></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Part</th><th>Made by</th><th className="num">vs import</th></tr></thead>
                <tbody>
                  {arch.lines.map((l) => (
                    <tr key={l.line.id}>
                      <td style={{ fontWeight: 500 }}>{l.line.name}</td>
                      <td>
                        {l.nodes.map((n) => (
                          <div key={n.key} className="small" style={{ marginBottom: 3 }}>
                            <span className="chip" style={{ background: 'transparent', color: STATUS_COLOR[n.status], border: `1px solid ${STATUS_COLOR[n.status]}`, padding: '0 7px' }}>{STATUS_LABEL[n.status]}</span>{' '}
                            {n.name}{l.nodes.length > 1 ? ` (${Math.round(n.share * 100)}%)` : ''}
                            {n.capexCr > 0 && <span className="tiny"> · {cr(n.capexCr)}, {n.readyMonths} mo</span>}
                          </div>
                        ))}
                      </td>
                      <td className={`num ${l.deltaPct < 0 ? 'down' : 'up'}`}>{l.deltaPct < 0 ? '' : '+'}{l.deltaPct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="legend">
          <span><i className="dot" style={{ background: STATUS_COLOR.available }} />Available now</span>
          <span><i className="dot" style={{ background: STATUS_COLOR.upgrade }} />Needs upgrade (certification or capacity)</span>
          <span><i className="dot" style={{ background: STATUS_COLOR.new }} />New setup</span>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="eyebrow">Build in India vs keep importing · {arch.name}</div>
            <h2 className="lead" style={{ fontSize: 21, marginTop: 4 }}>
              {h.netSavingCr >= 0 ? `Saves ${cr(h.netSavingCr)} over ${years} years` : `Costs ${cr(-h.netSavingCr)} more over ${years} years`}
              {h.breakEvenYear ? `, paying back in year ${h.breakEvenYear}` : ''}.
            </h2>
          </div>
          <div className="toggle-row">
            {HORIZONS.map((y) => <button key={y} className={`pill ${y === years ? 'on' : ''}`} onClick={() => setYears(y)}>{y === 20 ? '20 yrs' : `${y} yrs`}</button>)}
          </div>
        </div>

        <div className="grid-4" style={{ marginTop: 16 }}>
          <div className="stat"><div className="label">Investment</div><div className="value">{cr(h.capexCr)}</div><div className="delta muted">buyer, suppliers and schemes</div></div>
          <div className="stat"><div className="label">Break-even</div><div className="value">{h.breakEvenYear ? `Year ${h.breakEvenYear}` : 'Not reached'}</div><div className="delta muted">cumulative</div></div>
          <div className="stat"><div className="label">Net return</div><div className={`value ${h.netSavingCr >= 0 ? 'down' : 'up'}`}>{cr(h.netSavingCr)}</div><div className="delta muted">vs importing, {years} years</div></div>
          <div className="stat"><div className="label">Present value at 10%</div><div className="value">{cr(h.npvCr)}</div><div className="delta muted">{h.capexCr >= 1 ? `${h.roi.toFixed(1)}× the investment` : 'little investment needed'}</div></div>
        </div>

        <div className="row" style={{ marginTop: 18 }}>
          <div className="segmented">
            <button className={chart === 'cost' ? 'on' : ''} onClick={() => setChart('cost')}>Cumulative cost</button>
            <button className={chart === 'net' ? 'on' : ''} onClick={() => setChart('net')}>Net return</button>
          </div>
        </div>
        <div style={{ height: 300, marginTop: 10 }}>
          <ResponsiveContainer>
            {chart === 'cost' ? (
              <LineChart data={pts} margin={{ top: 10, right: 20, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#5a6472' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`} tick={{ fontSize: 12, fill: '#5a6472' }} axisLine={false} tickLine={false} width={70} unit=" Cr" />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')} Cr`} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
                {h.breakEvenYear && h.breakEvenYear > 1 && <ReferenceLine x={`Y${h.breakEvenYear}`} stroke="#0f766e" strokeDasharray="4 4" label={{ value: 'break-even', fontSize: 11, fill: '#0f766e', position: 'top' }} />}
                <Line type="monotone" dataKey="Import" name="Keep importing" stroke="#94a3b8" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="India" name={`Build in India: ${arch.name}`} stroke="#0f766e" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            ) : (
              <BarChart data={pts} margin={{ top: 10, right: 20, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#5a6472' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`} tick={{ fontSize: 12, fill: '#5a6472' }} axisLine={false} tickLine={false} width={70} unit=" Cr" />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')} Cr`, 'Cumulative net return']} />
                <ReferenceLine y={0} stroke="#8a93a0" />
                <Bar dataKey="net" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                  {pts.map((p) => <Cell key={p.year} fill={p.net >= 0 ? '#15803d' : '#dc2626'} />)}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Design</th><th className="num">Set-up cost</th><th className="num">Break-even</th><th className="num">Net return, {years} yrs</th><th className="num">Present value</th><th className="num">Resilience</th><th className="num">Rural value</th></tr></thead>
            <tbody>
              {results.map(({ a, h: ah }) => (
                <tr key={a.id} className={`rowsel ${a.id === arch.id ? 'on' : ''}`} onClick={() => setArchId(a.id)}>
                  <td style={{ fontWeight: 500 }}>{a.name}</td>
                  <td className="num">{cr(ah.capexCr)}</td>
                  <td className="num">{ah.breakEvenYear ? `Year ${ah.breakEvenYear}` : '—'}</td>
                  <td className={`num ${ah.netSavingCr >= 0 ? 'down' : 'up'}`}>{cr(ah.netSavingCr)}</td>
                  <td className="num">{cr(ah.npvCr)}</td>
                  <td className="num">{a.resilience}/100</td>
                  <td className="num">{a.ruralShare.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details>
        <summary>Assumptions behind the long-term numbers</summary>
        <div className="card stack">
          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <Slider label="Import cost growth per year" value={growth.importPct} min={0} max={8} step={0.5} format={(v) => `${v}%`} onChange={(v) => setGrowth({ ...growth, importPct: v })} />
            <Slider label="Domestic cost growth per year" value={growth.domesticPct} min={0} max={8} step={0.5} format={(v) => `${v}%`} onChange={(v) => setGrowth({ ...growth, domesticPct: v })} />
          </div>
          <ul className="why small muted">
            <li>Volume starts at {buyer.monthlyUnits.toLocaleString('en-IN')} harnesses a month and grows 12% a year to year 5, 6% to year 10, then 3%.</li>
            <li>Import cost growth covers dollar inflation and rupee depreciation; domestic growth is Indian inflation net of learning as suppliers scale.</li>
            <li>Upgrades are paid in year 1; new sites 40% in year 1 and 60% in year 2; {'₹'}5 lakh to qualify each site.</li>
            <li>A part switches to India once its slowest site is ready; until then it is imported.</li>
            <li>Expected disruption losses on the imported share are counted every year. Present value uses a 10% discount rate.</li>
            <li>All suppliers, new sites, capacities and prices are simulated.</li>
          </ul>
        </div>
      </details>
    </div>
  );
}
