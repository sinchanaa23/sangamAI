import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bom, buyer, sellers, unitLabel } from '../data';
import { district } from '../engine';
import { download, parseCsv, toCsv } from '../csv';
import { architectures } from '../network';
import { useStore } from '../store';
import { bidderName } from '../tco';
import { useBuyer } from './context';

const IBP_HEAD = ['PRDID', 'LOCID', 'PERIODID', 'CONSENSUSDEMAND'];

export default function SapPage() {
  const { state, update } = useStore();
  const { scenario, weights } = useBuyer();
  const [series, setSeries] = useState<{ period: string; qty: number }[] | null>(null);
  const [msg, setMsg] = useState('');
  const reqs = state.requirements.filter((r) => r.sector === state.sector && r.status === 'open');
  const awards = state.requirements.filter((r) => r.sector === state.sector && r.status === 'awarded');

  const ibpTemplate = () => {
    const rows: (string | number)[][] = [IBP_HEAD];
    for (let m = 0; m < 24; m++) {
      const d = new Date(); d.setMonth(d.getMonth() + m, 1);
      rows.push([buyer.product.slice(0, 18).toUpperCase().replace(/\s+/g, '_'), district(buyer.plantDistrictId).name.toUpperCase(), d.toISOString().slice(0, 7), Math.round(buyer.monthlyUnits * Math.pow(1.01, m))]);
    }
    download('ibp-consensus-demand.csv', toCsv(rows));
  };
  const readIbp = async (f: File) => {
    const rows = parseCsv(await f.text());
    const head = rows[0].map((h) => h.trim().toUpperCase());
    const pi = head.indexOf('PERIODID'), qi = head.findIndex((h) => h.includes('DEMAND') || h === 'QUANTITY');
    if (pi < 0 || qi < 0) { setMsg('Expected PERIODID and a demand column (for example CONSENSUSDEMAND).'); return; }
    const byPeriod = new Map<string, number>();
    rows.slice(1).forEach((r) => byPeriod.set(r[pi], (byPeriod.get(r[pi]) ?? 0) + (Number(r[qi]) || 0)));
    const s = [...byPeriod.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, qty]) => ({ period, qty }));
    setSeries(s);
    setMsg(`Read ${s.length} periods from ${f.name}.`);
  };
  const applyIbp = () => {
    if (!series?.length) return;
    const next12 = series.slice(0, 12);
    const avg = Math.round(next12.reduce((t, x) => t + x.qty, 0) / next12.length);
    update((s) => ({ ...s, overrides: { ...s.overrides, [s.sector]: { ...s.overrides[s.sector], buyer: { ...(s.overrides[s.sector]?.buyer ?? {}), monthlyUnits: avg } } } }));
    setMsg(`Monthly volume set to ${avg.toLocaleString('en-IN')} ${unitLabel()} (average of the next 12 periods).`);
  };

  const exportAriba = () => {
    const rows: (string | number)[][] = [['Item', 'Description', 'Commodity code (HS)', 'Quantity per year', 'Unit', 'Need-by date', 'Target unit price (INR)', 'Invited suppliers', 'Sangam requirement ID']];
    reqs.forEach((r, i) => {
      const line = bom.find((l) => l.id === r.lineId);
      rows.push([i + 1, `${r.title}: ${r.spec}`, line?.hs ?? '', r.monthlyVolume * 12, buyer.unitLabel, r.startBy, r.targetPrice, r.invited.map((id) => sellers.find((s) => s.id === id)?.name ?? id).join('; '), r.id]);
    });
    download('ariba-sourcing-event-items.csv', toCsv(rows));
  };
  const exportAwards = () => {
    const rows: (string | number)[][] = [['Sangam requirement ID', 'Item', 'Awarded to', 'Unit price (INR)', 'Lead time (days)', 'Payment terms (days)', 'MOQ']];
    awards.forEach((r) => {
      const q = state.quotes.find((x) => x.id === r.awardedQuoteId);
      if (q) rows.push([r.id, r.title, bidderName(q.bidder, state), q.unitPrice, q.leadDays, q.paymentDays, q.moq]);
    });
    download('ariba-awards.csv', toCsv(rows));
  };
  const exportHana = () => {
    const arch = architectures(scenario, weights).find((a) => a.id === (state.chosen[state.sector]?.archId ?? 'corridor')) ?? architectures(scenario, weights)[0];
    const vertices = [{ ID: 'PLANT', TYPE: 'plant', NAME: buyer.name, DISTRICT: buyer.plantDistrictId, LAT: district(buyer.plantDistrictId).lat, LON: district(buyer.plantDistrictId).lon }];
    const edges: Record<string, string | number>[] = [];
    arch.lines.forEach((l) => l.nodes.forEach((n) => {
      if (!vertices.some((v) => v.ID === n.key)) vertices.push({ ID: n.key, TYPE: n.kind === 'site' ? 'new_site' : 'supplier', NAME: n.name, DISTRICT: n.districtId, LAT: district(n.districtId).lat, LON: district(n.districtId).lon });
      edges.push({ ID: `${n.key}-${l.line.id}`, SOURCE: n.key, TARGET: 'PLANT', PART: l.line.name, HS: l.line.hs ?? '', SHARE: +n.share.toFixed(3), STATUS: n.status, COST_PER_UNIT_INR: Math.round(n.cost), LEAD_DAYS: n.leadDays, CAPEX_CR: +n.capexCr.toFixed(2) });
    }));
    download(`hana-graph-${arch.id}.json`, JSON.stringify({ workspace: `SANGAM_${arch.id.toUpperCase()}`, design: arch.name, vertices, edges }, null, 2), 'application/json');
  };

  return (
    <div className="stack">
      <div>
        <h1 className="lead">SAP integration</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          File-based connectors that work today. In production the same data would flow through SAP Integration Suite into SAP IBP, SAP Ariba and SAP HANA Cloud instead of files.
        </p>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>1. Demand forecast from SAP IBP</div>
        <p className="small muted">Upload a key-figure export (columns PRDID, LOCID, PERIODID, CONSENSUSDEMAND). Sangam uses the next 12 months as your volume.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={ibpTemplate}>Download sample export</button>
          <label className="btn small">Upload IBP export<input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) readIbp(f); }} /></label>
          {series && <button className="btn small primary" onClick={applyIbp}>Use as my volume</button>}
        </div>
        {series && (
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#5a6472' }} />
                <YAxis tick={{ fontSize: 11, fill: '#5a6472' }} width={60} />
                <Tooltip />
                <Line dataKey="qty" name="Consensus demand" stroke="#0f766e" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {msg && <p className="small">{msg}</p>}
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>2. Sourcing events and awards for SAP Ariba</div>
        <p className="small muted">{reqs.length} open requirements become sourcing-event line items with HS commodity codes, yearly quantities, need-by dates and invited suppliers. Awards export the winning quote for contract creation.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={exportAriba} disabled={!reqs.length}>Export sourcing event items</button>
          <button className="btn small" onClick={exportAwards} disabled={!awards.length}>Export awards ({awards.length})</button>
        </div>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>3. Supply network graph for SAP HANA Cloud</div>
        <p className="small muted">Your chosen future network as vertex and edge tables, ready to load into a HANA graph workspace with spatial columns.</p>
        <div><button className="btn small" onClick={exportHana}>Export network graph (JSON)</button></div>
      </div>

      <div className="card">
        <div className="section-title">How Sangam maps to SAP</div>
        <table>
          <thead><tr><th>Sangam</th><th>SAP target</th><th>Status in this prototype</th></tr></thead>
          <tbody>
            <tr><td>Demand plan</td><td>SAP IBP key figures</td><td>CSV import works</td></tr>
            <tr><td>Requirements, quotes, awards</td><td>SAP Ariba sourcing events and contracts</td><td>CSV export works</td></tr>
            <tr><td>Supplier profiles and verification</td><td>SAP Business Network supplier records</td><td>Planned</td></tr>
            <tr><td>Supply network, districts, routes</td><td>SAP HANA Cloud graph and spatial engines</td><td>JSON export works</td></tr>
            <tr><td>Calculations (matching, optimisation, scenarios)</td><td>Python services on SAP AI Core</td><td>Runs in the browser today</td></tr>
            <tr><td>Explanations and Q&amp;A</td><td>Joule / Generative AI Hub</td><td>Ask Sangam (needs an API key)</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
