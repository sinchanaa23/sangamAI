import { Fragment, useMemo, useState } from 'react';
import { bom, buyer, districts, processes, processInfo, sellers, unitLabel } from '../data';
import { district, roadKm } from '../engine';
import { METRICS, SOURCES } from '../realdata';
import { uid } from '../model';
import { useStore } from '../store';
import { useUi } from '../ui';
import type { Provenance } from '../types';
import MapCanvas from '../components/MapCanvas';
import type { MapPoint } from '../components/MapCanvas';
import Slider from '../components/Slider';
import Src from '../components/Src';

type Factor = 'climate' | 'connectivity' | 'industrial' | 'power' | 'proximity' | 'ecosystem' | 'rural';
const FACTORS: { id: Factor; label: string; src: Provenance; help: string }[] = [
  { id: 'climate', label: 'Low climate exposure', src: 'public', help: 'Fewer heavy-rain and 40 °C days, 2015-2024 (Open-Meteo)' },
  { id: 'connectivity', label: 'Connectivity', src: 'public', help: 'Rail stations, airport, highways (OpenStreetMap) and distance to a major port' },
  { id: 'industrial', label: 'Industrial base', src: 'public', help: 'Industrial land-use areas within 20 km (OpenStreetMap)' },
  { id: 'power', label: 'Grid reliability', src: 'estimated', help: 'State-level estimate' },
  { id: 'proximity', label: 'Close to your plant', src: 'estimated', help: 'Road distance' },
  { id: 'ecosystem', label: 'Supplier ecosystem', src: 'simulated', help: 'Suppliers on Sangam with the same process within 250 km' },
  { id: 'rural', label: 'Rural development priority', src: 'estimated', help: 'Proxy: less existing industry means more uplift from a new unit' },
];
const COLORS = ['#3d5a45', '#1f6c9f', '#5b6f8f', '#956400', '#2f3437', '#a4552c', '#346538'];

export default function LocationPlanner() {
  const { update } = useStore();
  const { openSupplier, go } = useUi();
  // Start with the imported part that has the fewest Indian suppliers
  const importedProcs = bom.filter((l) => l.importedFrom !== 'India').map((l) => l.process);
  const pool = processes.filter((p) => importedProcs.includes(p.name));
  const gapProcess = [...(pool.length ? pool : processes)].sort((a, b) => sellers.filter((s) => s.process === a.name).length - sellers.filter((s) => s.process === b.name).length)[0]?.name ?? '';
  const [process, setProcess] = useState(gapProcess);
  const [w, setW] = useState<Record<Factor, number>>({ climate: 3, connectivity: 3, industrial: 2, power: 2, proximity: 2, ecosystem: 2, rural: 1 });
  const [pick, setPick] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const plant = district(buyer.plantDistrictId);

  const ranked = useMemo(() => {
    const raw = districts.map((d) => {
      const m = METRICS[d.id];
      const km = roadKm(d, plant);
      const eco = sellers.filter((s) => s.process === process && roadKm(district(s.districtId), d) < 250).length;
      return { d, m, km, eco, f: { climate: 1 - m.climateScore, connectivity: m.connectivityScore, industrial: m.industrialScore, power: m.power, proximity: Math.max(0, 1 - km / 1500), ecosystem: eco, rural: 1 - m.industrialScore } as Record<Factor, number> };
    });
    const maxEco = Math.max(1, ...raw.map((r) => r.f.ecosystem));
    const powLo = Math.min(...raw.map((r) => r.f.power)), powHi = Math.max(...raw.map((r) => r.f.power));
    const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    return raw.map((r) => {
      const f = { ...r.f, ecosystem: r.f.ecosystem / maxEco, power: powHi === powLo ? 0.5 : (r.f.power - powLo) / (powHi - powLo) };
      const score = Math.round((100 * (Object.keys(w) as Factor[]).reduce((s, k) => s + w[k] * f[k], 0)) / tot);
      return { ...r, f, score };
    }).sort((a, b) => b.score - a.score);
  }, [process, w, plant]);

  const sel = ranked.find((r) => r.d.id === pick) ?? ranked[0];
  const p = processInfo(process);
  const need = buyer.monthlyUnits;
  const capexCr = (need / 1000) * p.lakhPerThousand / 100;
  const nearby = sellers.filter((s) => roadKm(district(s.districtId), sel.d) < 250 && s.process === process);

  const points: MapPoint[] = [
    ...ranked.slice(10).map((r) => ({ id: r.d.id, at: [r.d.lon, r.d.lat] as [number, number], color: '#b4b2ac', r: 3 })),
    ...ranked.slice(0, 10).map((r, i) => ({ id: r.d.id, at: [r.d.lon, r.d.lat] as [number, number], color: r === sel ? '#a4552c' : '#3d5a45', r: 4 + (10 - i) * 0.5, ring: r === sel, label: i < 6 || r === sel ? `${i + 1}. ${r.d.name}` : undefined, side: (r.d.lon < 75 ? 'left' : 'right') as MapPoint['side'], bold: r === sel })),
    { id: 'plant', at: [plant.lon, plant.lat], color: '#2f3437', r: 4, hollow: true, label: 'Your plant', side: 'bottom' },
  ];

  const addSite = () => {
    const id = uid('site');
    update((s) => ({
      ...s,
      customSites: [...(s.customSites ?? []), {
        id, sector: s.sector, name: `${sel.d.name} ${process} unit (proposed)`, process, districtId: sel.d.id,
        capexCr: +capexCr.toFixed(1), priceIndex: 0.96, readyMonths: p.months + 6, quality: 0.82, rural: sel.f.rural > 0.6, workers: Math.round(40 + need / Math.max(1, p.refCapacity) * 60),
      }],
    }));
    setAdded(sel.d.name);
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="lead">Where in India should a new {process.toLowerCase()} unit go?</h1>
          <p className="muted" style={{ marginTop: 6 }}>{districts.length} districts ranked on real climate and infrastructure data, your plant&apos;s location and the existing supplier ecosystem. Change the weights to match what matters to you.</p>
        </div>
        <label className="field" style={{ minWidth: 220 }}>Process
          <select value={process} onChange={(e) => { setProcess(e.target.value); setPick(null); }}>
            {processes.map((x) => <option key={x.name} value={x.name}>{x.name} ({sellers.filter((s) => s.process === x.name).length} suppliers)</option>)}
          </select>
        </label>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1.2fr' }}>
        <div className="card">
          <MapCanvas view="india" lines={[]} points={points} ariaLabel="District ranking map" />
          <p className="tiny" style={{ marginTop: 6 }}>Top 10 in green, larger is better ranked; orange is the selected district.</p>
        </div>
        <div className="card stack" style={{ gap: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>What matters to you</div>
          {FACTORS.map((f) => (
            <div key={f.id}>
              <Slider label={f.label} value={w[f.id]} min={0} max={5} format={(v) => ['Ignore', 'Low', 'Some', 'Medium', 'High', 'Top'][v]} onChange={(v) => setW({ ...w, [f.id]: v })} />
              <div className="tiny">{f.help} <Src kind={f.src} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-title">Ranking</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>District</th><th className="num">Score</th><th>Why (factor strength)</th><th className="num">To plant</th></tr></thead>
            <tbody>
              {ranked.slice(0, 12).map((r, i) => (
                <tr key={r.d.id} className={`rowsel ${r === sel ? 'on' : ''}`} onClick={() => { setPick(r.d.id); setAdded(null); }}>
                  <td>{i + 1}</td>
                  <td><div style={{ fontWeight: 500 }}>{r.d.name}</div><div className="tiny">{r.d.state}</div></td>
                  <td className="num"><b>{r.score}</b></td>
                  <td>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 26 }} title={FACTORS.map((f) => `${f.label}: ${Math.round(r.f[f.id] * 100)}`).join(', ')}>
                      {FACTORS.map((f, k) => <span key={f.id} style={{ width: 12, height: `${Math.max(2, r.f[f.id] * 26)}px`, background: COLORS[k], opacity: w[f.id] ? 1 : 0.25, borderRadius: 2 }} />)}
                    </div>
                  </td>
                  <td className="num small">{r.km.toLocaleString('en-IN')} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend">{FACTORS.map((f, k) => <span key={f.id}><i className="dot" style={{ background: COLORS[k] }} />{f.label}</span>)}</div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="eyebrow">Selected district</div>
            <h2 className="lead" style={{ fontSize: 21, marginTop: 4 }}>{sel.d.name}, {sel.d.state} · score {sel.score}</h2>
          </div>
          <button className="btn primary" onClick={addSite} disabled={added === sel.d.name}>{added === sel.d.name ? 'Added to your network options' : 'Propose a new unit here'}</button>
        </div>
        {added === sel.d.name && <div className="note" style={{ marginTop: 10 }}>Added. The Future network designs now consider a proposed unit in {sel.d.name}. <button className="linkish" onClick={() => go('buyer', 'network')}>Open Future network</button></div>}
        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
          <div className="kv">
            {sel.m.climate && <><span>Rainfall, 10-year average</span><span>{sel.m.climate.annualRainMm.toLocaleString('en-IN')} mm <Src kind="public" /></span></>}
            {sel.m.climate && <><span>Heavy-rain days a year</span><span>{sel.m.climate.heavyRainDays} <Src kind="public" /></span></>}
            {sel.m.climate && <><span>Days at 40 °C or more</span><span>{sel.m.climate.hotDays} <Src kind="public" /></span></>}
            {sel.m.climate && <><span>Wettest day on record (10 yrs)</span><span>{sel.m.climate.maxDayRainMm} mm <Src kind="public" /></span></>}
            {sel.m.osm ? <>
              <span>Industrial areas within 20 km</span><span>{sel.m.osm.industrialAreas} <Src kind="public" /></span>
              <span>Rail stations within 25 km</span><span>{sel.m.osm.railStations} <Src kind="public" /></span>
              <span>Airport within 80 km</span><span>{sel.m.osm.airports > 0 ? 'Yes' : 'No'} <Src kind="public" /></span>
            </> : <><span>Infrastructure counts</span><span>Not fetched yet <Src kind="estimated" /></span></>}
            <span>Nearest major port</span><span>{sel.m.nearestPort.name}, {sel.m.nearestPort.km} km</span>
            <span>Grid reliability</span><span>{Math.round(sel.m.power * 100)}% <Src kind="estimated" /></span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="kv">
              <span>Unit size for your volume</span><span>{need.toLocaleString('en-IN')} {unitLabel()} a month</span>
              <span>Indicative investment</span><span>₹{capexCr.toFixed(1)} Cr <Src kind="estimated" /></span>
              <span>Time to start production</span><span>about {p.months + 6} months <Src kind="estimated" /></span>
              <span>Road distance to your plant</span><span>{sel.km.toLocaleString('en-IN')} km</span>
            </div>
            <div className="small" style={{ fontWeight: 600 }}>{process} suppliers within 250 km</div>
            {nearby.length ? nearby.map((s) => <button key={s.id} className="linkish small" onClick={() => openSupplier(s.id)}>{s.name} ({district(s.districtId).name})</button>) : <span className="small muted">None yet: a new unit would start an ecosystem here.</span>}
          </div>
        </div>
      </div>

      <p className="tiny">
        Sources: {[SOURCES.climate, SOURCES.osm].map((s, i) => <Fragment key={s.name}>{i > 0 && '; '}{s.name} ({s.fetched || 'not fetched'})</Fragment>)}. Investment uses the sector&apos;s indicative cost per unit of capacity.
      </p>
    </div>
  );
}
