import { useMemo, useState } from 'react';
import { bom, buyer, demandSignals, districts, processes, processInfo, sellers } from '../data';
import { district, isRural, roadKm } from '../engine';
import { download, toCsv } from '../csv';
import { METRICS } from '../realdata';
import { useStore } from '../store';
import MapCanvas from '../components/MapCanvas';
import type { MapPoint } from '../components/MapCanvas';
import Src from '../components/Src';

const REGION_STATES: Record<string, string[]> = {
  'South India': ['Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Kerala'],
  'West India': ['Maharashtra', 'Gujarat', 'Dadra and Nagar Haveli'],
  'South and West India': ['Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Kerala', 'Maharashtra', 'Gujarat'],
  'West and South India': ['Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Kerala', 'Maharashtra', 'Gujarat'],
  'Tamil Nadu and Karnataka': ['Tamil Nadu', 'Karnataka'],
  Maharashtra: ['Maharashtra'],
};
const RADIUS = 300;

export default function DistrictDashboard() {
  const { state } = useStore();
  const [process, setProcess] = useState<string>('all');
  const [pick, setPick] = useState<string | null>(null);
  const procs = process === 'all' ? processes.map((p) => p.name) : [process];
  const unitValue = (p: string) => bom.find((l) => l.process === p)?.cost ?? 1000;

  const rows = useMemo(() => {
    // Demand points: opted-in requirements at the buyer plant, plus aggregated signals spread over their region
    const points: { districtId: string; process: string; units: number; src: 'requirement' | 'signal' }[] = [];
    if (state.sharing.aggregateDemand) {
      state.requirements.filter((r) => r.sector === state.sector && r.status !== 'closed').forEach((r) => points.push({ districtId: buyer.plantDistrictId, process: r.process, units: r.monthlyVolume, src: 'requirement' }));
    }
    demandSignals.forEach((sg) => {
      const states = REGION_STATES[sg.region];
      const ds = states ? districts.filter((d) => states.includes(d.state)) : districts;
      ds.forEach((d) => points.push({ districtId: d.id, process: sg.process, units: sg.monthlyUnits / ds.length, src: 'signal' }));
    });

    return districts.map((d) => {
      const near = (id: string) => roadKm(district(id), d) <= RADIUS;
      let demandCr = 0, capCr = 0, gapCr = 0, investCr = 0, jobs = 0;
      procs.forEach((p) => {
        const dem = points.filter((x) => x.process === p && near(x.districtId)).reduce((t, x) => t + x.units, 0);
        const cap = sellers.filter((s) => s.process === p && near(s.districtId)).reduce((t, s) => t + s.monthlyCapacity, 0);
        const gap = Math.max(0, dem - cap);
        const v = unitValue(p) * 12 / 1e7;
        demandCr += dem * v; capCr += cap * v; gapCr += gap * v;
        const info = processInfo(p);
        investCr += (gap / 1000) * info.lakhPerThousand / 100;
        jobs += Math.round((gap / Math.max(1, info.refCapacity)) * 80);
      });
      const local = sellers.filter((s) => s.districtId === d.id && procs.includes(s.process));
      const ruralCap = local.filter(isRural).reduce((t, s) => t + s.monthlyCapacity, 0);
      const allCap = local.reduce((t, s) => t + s.monthlyCapacity, 0);
      const m = METRICS[d.id];
      const suit = 0.5 * m.connectivityScore + 0.3 * (1 - m.climateScore) + 0.2 * m.industrialScore;
      return { d, m, demandCr, capCr, gapCr, investCr, jobs, local, ruralPct: allCap ? (ruralCap / allCap) * 100 : 0, suit, priority: gapCr * (0.5 + suit) };
    }).sort((a, b) => b.priority - a.priority);
  }, [state.requirements, state.sharing.aggregateDemand, state.sector, process]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = rows.find((r) => r.d.id === pick) ?? rows[0];
  const maxDem = Math.max(1, ...rows.map((r) => r.demandCr));
  const points: MapPoint[] = rows.map((r) => ({
    id: r.d.id, at: [r.d.lon, r.d.lat], r: 3 + 9 * Math.sqrt(r.demandCr / maxDem),
    color: r === sel ? '#a4552c' : r.gapCr > 0.5 ? '#9f2f2d' : r.capCr > r.demandCr ? '#346538' : '#956400',
    hollow: r.gapCr <= 0.5, label: rows.indexOf(r) < 5 || r === sel ? r.d.name : undefined, side: (r.d.lon < 75 ? 'left' : 'right') as MapPoint['side'], bold: r === sel,
  }));
  const totalGap = rows.reduce((t, r) => t + r.gapCr, 0);
  const exportCsv = () => download(`sangam-district-gaps-${state.sector}.csv`, toCsv([
    ['District', 'State', 'Demand within 300 km (Rs Cr/yr)', 'Capability within 300 km (Rs Cr/yr)', 'Unmet demand (Rs Cr/yr)', 'Investment to close (Rs Cr)', 'Jobs', 'Suppliers in district', 'Rural share of local capacity %', 'Heavy-rain days/yr', 'Rail stations within 25 km'],
    ...rows.map((r) => [r.d.name, r.d.state, r.demandCr.toFixed(1), r.capCr.toFixed(1), r.gapCr.toFixed(1), r.investCr.toFixed(1), r.jobs, r.local.length, r.ruralPct.toFixed(0), r.m.climate?.heavyRainDays ?? '', r.m.osm?.railStations ?? '']),
  ]));

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="lead">Where India&apos;s supply gaps are</h1>
          <p className="muted" style={{ marginTop: 6 }}>For industry clusters and state industry departments: demand from buyers on Sangam against local capability within {RADIUS} km, and what it would take to close the gap.</p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select value={process} onChange={(e) => { setProcess(e.target.value); setPick(null); }} aria-label="Process">
            <option value="all">All processes</option>
            {processes.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button className="btn small" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="grid-4">
        <div className="stat"><div className="label">Unmet demand, all districts</div><div className="value">₹{totalGap.toFixed(0)} Cr</div><div className="delta muted">a year, overlapping {RADIUS} km areas</div></div>
        <div className="stat"><div className="label">Top district</div><div className="value" style={{ fontSize: 20 }}>{rows[0].d.name}</div><div className="delta muted">₹{rows[0].gapCr.toFixed(1)} Cr unmet</div></div>
        <div className="stat"><div className="label">Investment to close it</div><div className="value">₹{rows[0].investCr.toFixed(1)} Cr</div><div className="delta muted">{rows[0].jobs.toLocaleString('en-IN')} jobs</div></div>
        <div className="stat"><div className="label">Suppliers on Sangam</div><div className="value">{sellers.filter((s) => procs.includes(s.process)).length}</div><div className="delta muted">{sellers.filter((s) => procs.includes(s.process) && isRural(s)).length} rural collectives</div></div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1.25fr' }}>
        <div className="card">
          <MapCanvas view="india" lines={[]} points={points} ariaLabel="District supply gap map" />
          <div className="legend">
            <span><i className="dot" style={{ background: '#9f2f2d' }} />Demand exceeds capability</span>
            <span><i className="dot" style={{ background: '#956400' }} />Roughly balanced</span>
            <span><i className="dot" style={{ background: '#346538' }} />Surplus capability</span>
            <span>Size = demand nearby</span>
          </div>
        </div>
        <div className="card">
          <div className="section-title">Priority districts</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>District</th><th className="num">Unmet ₹ Cr/yr</th><th className="num">Invest ₹ Cr</th><th className="num">Jobs</th></tr></thead>
              <tbody>
                {rows.slice(0, 10).map((r) => (
                  <tr key={r.d.id} className={`rowsel ${r === sel ? 'on' : ''}`} onClick={() => setPick(r.d.id)}>
                    <td><div style={{ fontWeight: 500 }}>{r.d.name}</div><div className="tiny">{r.d.state} · {r.local.length} suppliers{r.ruralPct > 0 ? `, ${r.ruralPct.toFixed(0)}% rural` : ''}</div></td>
                    <td className="num">{r.gapCr.toFixed(1)}</td>
                    <td className="num">{r.investCr.toFixed(1)}</td>
                    <td className="num">{r.jobs.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny" style={{ marginTop: 8 }}>Ranked by unmet demand, weighted by how suitable the district is (connectivity, climate, industrial base).</p>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">District detail</div>
        <h2 className="lead" style={{ fontSize: 20, marginTop: 4 }}>{sel.d.name}, {sel.d.state}</h2>
        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
          <div className="kv">
            <span>Demand within {RADIUS} km</span><span>₹{sel.demandCr.toFixed(1)} Cr a year <Src kind="simulated" title="Aggregated demand from buyers on Sangam (demo data)" /></span>
            <span>Capability within {RADIUS} km</span><span>₹{sel.capCr.toFixed(1)} Cr a year <Src kind="simulated" /></span>
            <span>Unmet</span><span>₹{sel.gapCr.toFixed(1)} Cr a year</span>
            <span>Investment to close</span><span>₹{sel.investCr.toFixed(1)} Cr <Src kind="estimated" /></span>
            <span>Jobs</span><span>{sel.jobs.toLocaleString('en-IN')} <Src kind="estimated" /></span>
          </div>
          <div className="kv">
            {sel.m.climate && <><span>Heavy-rain days a year</span><span>{sel.m.climate.heavyRainDays} <Src kind="public" /></span><span>Days at 40 °C or more</span><span>{sel.m.climate.hotDays} <Src kind="public" /></span></>}
            {sel.m.osm && <><span>Industrial areas within 20 km</span><span>{sel.m.osm.industrialAreas} <Src kind="public" /></span><span>Rail stations within 25 km</span><span>{sel.m.osm.railStations} <Src kind="public" /></span></>}
            <span>Nearest major port</span><span>{sel.m.nearestPort.name}, {sel.m.nearestPort.km} km</span>
            <span>Local suppliers</span><span>{sel.local.map((s) => s.name).join(', ') || 'none yet'}</span>
          </div>
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>
          Demand includes only buyers who allow anonymised aggregation{state.sharing.aggregateDemand ? '' : ' (your buyer workspace has opted out, so only market signals are shown)'}. No buyer is named.
        </p>
      </div>
    </div>
  );
}
