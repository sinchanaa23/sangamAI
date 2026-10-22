import { SOURCES } from '../realdata';
import Src from '../components/Src';

const LIVE = [
  { name: 'Frankfurter (European Central Bank reference rates)', url: 'https://frankfurter.dev', use: 'Rupee, dollar and yuan exchange rates and 30-day change on the Simulator' },
  { name: 'GDACS, falling back to NASA EONET and USGS', url: 'https://www.gdacs.org', use: 'Cyclone, flood, earthquake and volcano alerts near chokepoints and ports' },
  { name: 'GDELT DOC 2.0 API', url: 'https://www.gdeltproject.org', use: 'Shipping and trade news on your lanes (via the local proxy; often rate-limited)' },
];

const SIMULATED = [
  'Buyer companies, their parts lists and costs (editable under Company and parts)',
  'Supplier companies: names, capacities, prices, certificates, defect rates, on-time delivery, turnover, reviews',
  'New-site investment and readiness, capacity and certification costs',
  'Demand signals from other buyers, diversification market sizes and margins',
  'Supplier prices and defect rates by origin country; freight rates and port charges (indicative)',
];

export default function DataSourcesPage() {
  const files = [
    { s: SOURCES.comtrade, use: 'India’s real import value and origin countries for every HS code in the parts lists and upstream inputs; concentration index', licence: 'UN Comtrade terms of use' },
    { s: SOURCES.lpi, use: 'Port and schedule reliability of each international route', licence: 'CC BY 4.0' },
    { s: SOURCES.climate, use: 'District climate exposure (heavy-rain and 40 °C days, 2015-2024) in matching, routes, the location planner and the district dashboard', licence: 'CC BY 4.0' },
    { s: SOURCES.osm, use: 'District connectivity and industrial base (rail stations, airports, highways, industrial land)', licence: 'ODbL' },
  ];
  return (
    <div className="stack">
      <div>
        <h1 className="lead">Where the data comes from</h1>
        <p className="muted" style={{ marginTop: 6 }}>Every number in Sangam carries a tag. This page lists the sources behind each tag and what is still simulated.</p>
      </div>

      <div className="card">
        <div className="section-title">Real public datasets <Src kind="public" /></div>
        <p className="small muted" style={{ marginBottom: 10 }}>Fetched by <code>npm run data:refresh</code> into <code>src/real/</code>, so results are reproducible and work offline.</p>
        <table>
          <thead><tr><th>Source</th><th>What it powers</th><th>Fetched</th><th>Licence</th></tr></thead>
          <tbody>
            {files.map(({ s, use, licence }) => (
              <tr key={s.name}>
                <td><a href={s.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{s.name}</a><div className="tiny">{s.detail}</div></td>
                <td className="small">{use}</td>
                <td className="small">{s.fetched || 'not yet'}</td>
                <td className="small">{licence}</td>
              </tr>
            ))}
            <tr>
              <td><b>DataMeet India boundary</b> and <b>Natural Earth</b> countries</td>
              <td className="small">Map outlines (India shown with its official boundary)</td>
              <td className="small">bundled</td>
              <td className="small">CC BY 4.0 / public domain</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="section-title">Live feeds <Src kind="live" /></div>
        <table>
          <thead><tr><th>Source</th><th>What it powers</th></tr></thead>
          <tbody>{LIVE.map((l) => <tr key={l.name}><td><a href={l.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{l.name}</a></td><td className="small">{l.use}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="card">
        <div className="section-title">Estimates <Src kind="estimated" /></div>
        <ul className="why small">
          <li>Grid reliability by state (no open district-level dataset was reachable)</li>
          <li>Transport rates per tonne-km, terminal charges and speeds; duty rates; insurance; inventory carrying cost</li>
          <li>How well India supplies each upstream input (strong, partial, weak), cross-checked with the import data above</li>
          <li>Long-term cost growth (adjustable on the Future network page)</li>
        </ul>
      </div>

      <div className="card">
        <div className="section-title">Simulated for the prototype <Src kind="simulated" /></div>
        <ul className="why small">{SIMULATED.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="small" style={{ marginTop: 10 }}>To go live, these would come from companies themselves (onboarding, quotes, orders), checked by the Sangam team (<Src kind="declared" /> → <Src kind="verified" />), and from SAP Ariba, IBP and Business Network records.</p>
      </div>
    </div>
  );
}
