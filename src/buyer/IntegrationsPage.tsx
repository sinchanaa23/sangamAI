// Renamed from the SAP page by P4 (agreed exception in P2's folder). Plain files in and out, no vendor lock-in.
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bom, buyer, sellers, unitLabel } from '../data';
import { district } from '../engine';
import { download, parseCsv, toCsv } from '../csv';
import { architectures } from '../network';
import { useStore } from '../store';
import { bidderName } from '../tco';
import { useBuyer } from './context';

const DEMAND_HEAD = ['PRODUCT', 'LOCATION', 'PERIOD', 'DEMAND'];

export default function IntegrationsPage() {
  const { state, update } = useStore();
  const { scenario, weights } = useBuyer();
  const [series, setSeries] = useState<{ period: string; qty: number }[] | null>(null);
  const [msg, setMsg] = useState('');
  const reqs = state.requirements.filter((r) => r.sector === state.sector && r.status === 'open');
  const awards = state.requirements.filter((r) => r.sector === state.sector && r.status === 'awarded');

  const demandTemplate = () => {
    const rows: (string | number)[][] = [DEMAND_HEAD];
    for (let m = 0; m < 24; m++) {
      const d = new Date(); d.setMonth(d.getMonth() + m, 1);
      rows.push([buyer.product.slice(0, 18).toUpperCase().replace(/\s+/g, '_'), district(buyer.plantDistrictId).name.toUpperCase(), d.toISOString().slice(0, 7), Math.round(buyer.monthlyUnits * Math.pow(1.01, m))]);
    }
    download('demand-forecast.csv', toCsv(rows));
  };
  const readDemand = async (f: File) => {
    const rows = parseCsv(await f.text());
    const head = rows[0].map((h) => h.trim().toUpperCase());
    // Accepts our own columns and the period/demand columns most planning tools export
    const pi = head.findIndex((h) => h === 'PERIOD' || h === 'PERIODID' || h === 'MONTH');
    const qi = head.findIndex((h) => h.includes('DEMAND') || h === 'QUANTITY');
    if (pi < 0 || qi < 0) { setMsg('Expected a PERIOD column and a DEMAND (or QUANTITY) column.'); return; }
    const byPeriod = new Map<string, number>();
    rows.slice(1).forEach((r) => byPeriod.set(r[pi], (byPeriod.get(r[pi]) ?? 0) + (Number(r[qi]) || 0)));
    const s = [...byPeriod.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, qty]) => ({ period, qty }));
    setSeries(s);
    setMsg(`Read ${s.length} periods from ${f.name}.`);
  };
  const applyDemand = () => {
    if (!series?.length) return;
    const next12 = series.slice(0, 12);
    const avg = Math.round(next12.reduce((t, x) => t + x.qty, 0) / next12.length);
    update((s) => ({ ...s, overrides: { ...s.overrides, [s.sector]: { ...s.overrides[s.sector], buyer: { ...(s.overrides[s.sector]?.buyer ?? {}), monthlyUnits: avg } } } }));
    setMsg(`Monthly volume set to ${avg.toLocaleString('en-IN')} ${unitLabel()} (average of the next 12 periods).`);
  };

  const exportItems = () => {
    const rows: (string | number)[][] = [['Item', 'Description', 'Commodity code (HS)', 'Quantity per year', 'Unit', 'Need-by date', 'Target unit price (INR)', 'Invited suppliers', 'Sangam requirement ID']];
    reqs.forEach((r, i) => {
      const line = bom.find((l) => l.id === r.lineId);
      rows.push([i + 1, `${r.title}: ${r.spec}`, line?.hs ?? '', r.monthlyVolume * 12, buyer.unitLabel, r.startBy, r.targetPrice, r.invited.map((id) => sellers.find((s) => s.id === id)?.name ?? id).join('; '), r.id]);
    });
    download('sourcing-items.csv', toCsv(rows));
  };
  const exportAwards = () => {
    const rows: (string | number)[][] = [['Sangam requirement ID', 'Item', 'Awarded to', 'Unit price (INR)', 'Lead time (days)', 'Payment terms (days)', 'MOQ']];
    awards.forEach((r) => {
      const q = state.quotes.find((x) => x.id === r.awardedQuoteId);
      if (q) rows.push([r.id, r.title, bidderName(q.bidder, state), q.unitPrice, q.leadDays, q.paymentDays, q.moq]);
    });
    download('awards.csv', toCsv(rows));
  };
  const exportGraph = () => {
    const arch = architectures(scenario, weights).find((a) => a.id === (state.chosen[state.sector]?.archId ?? 'corridor')) ?? architectures(scenario, weights)[0];
    const vertices = [{ ID: 'PLANT', TYPE: 'plant', NAME: buyer.name, DISTRICT: buyer.plantDistrictId, LAT: district(buyer.plantDistrictId).lat, LON: district(buyer.plantDistrictId).lon }];
    const edges: Record<string, string | number>[] = [];
    arch.lines.forEach((l) => l.nodes.forEach((n) => {
      if (!vertices.some((v) => v.ID === n.key)) vertices.push({ ID: n.key, TYPE: n.kind === 'site' ? 'new_site' : 'supplier', NAME: n.name, DISTRICT: n.districtId, LAT: district(n.districtId).lat, LON: district(n.districtId).lon });
      edges.push({ ID: `${n.key}-${l.line.id}`, SOURCE: n.key, TARGET: 'PLANT', PART: l.line.name, HS: l.line.hs ?? '', SHARE: +n.share.toFixed(3), STATUS: n.status, COST_PER_UNIT_INR: Math.round(n.cost), LEAD_DAYS: n.leadDays, CAPEX_CR: +n.capexCr.toFixed(2) });
    }));
    download(`network-graph-${arch.id}.json`, JSON.stringify({ design: arch.name, vertices, edges }, null, 2), 'application/json');
  };

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Integrations</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Plain CSV and JSON files that any planning, procurement or graph tool can read, so Sangam works with whatever a company already uses.
        </p>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>1. Demand forecast in</div>
        <p className="small muted">Upload a monthly forecast (columns PERIOD and DEMAND). Sangam uses the next 12 months as your volume.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={demandTemplate}>Download sample file</button>
          <label className="btn small">Upload forecast<input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) readDemand(f); }} /></label>
          {series && <button className="btn small primary" onClick={applyDemand}>Use as my volume</button>}
        </div>
        {series && (
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#efeeea" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6b6a66' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b6a66' }} width={60} />
                <Tooltip />
                <Line dataKey="qty" name="Forecast demand" stroke="#3d5a45" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {msg && <p className="small">{msg}</p>}
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>2. Sourcing items and awards out</div>
        <p className="small muted">{reqs.length} open requirements become line items with HS commodity codes, yearly quantities, need-by dates and invited suppliers. Awards export the winning quote for the contract.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={exportItems} disabled={!reqs.length}>Export sourcing items</button>
          <button className="btn small" onClick={exportAwards} disabled={!awards.length}>Export awards ({awards.length})</button>
        </div>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>3. Supply network graph out</div>
        <p className="small muted">Your chosen future network as vertex and edge tables with coordinates, ready for any graph database or GIS tool.</p>
        <div><button className="btn small" onClick={exportGraph}>Export network graph (JSON)</button></div>
      </div>

      <div className="card">
        <div className="section-title">Where this goes next</div>
        <table>
          <thead><tr><th>Sangam data</th><th>Next step</th><th>In this prototype</th></tr></thead>
          <tbody>
            <tr><td>Demand plan</td><td>Any planning tool's monthly export</td><td>CSV import works</td></tr>
            <tr><td>Requirements, quotes, awards</td><td>Open procurement on ONDC through the Beckn protocol</td><td>CSV export works; agent messages already use Beckn's steps</td></tr>
            <tr><td>Skill, audit and contract records</td><td>W3C Verifiable Credentials in a worker's or supplier's wallet</td><td>Signed and checkable in the app</td></tr>
            <tr><td>Supply network, districts, routes</td><td>A graph database such as Neo4j</td><td>JSON export works</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
