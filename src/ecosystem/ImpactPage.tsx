import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buyer, sellers } from '../data';
import { withWorkforce } from './fairwork-link';
import { crore, district } from '../engine';
import { architectures } from '../network';
import { useStore } from '../store';
import { useUi } from '../ui';
import { useBuyer } from '../buyer/context';
import Src from '../components/Src';
import type { Provenance } from '../types';
import { computeImpact, weakest } from './impact';
import type { DealRecord } from './impact';
import { localDeals } from './deals';
import { useLedger } from './ledger';

const cr = (inr: number) => crore(inr / 1e7);
const share = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

export default function ImpactPage() {
  const { state } = useStore();
  const { go } = useUi();
  const { scenario, weights } = useBuyer();
  const ledger = useLedger();
  const [serverDeals, setServerDeals] = useState<DealRecord[]>([]);

  // Deals the agents confirmed on the shared server (P1), when it is running
  useEffect(() => {
    fetch('/api/impact').then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
      .then((d: { deals?: DealRecord[] } | null) => setServerDeals(d?.deals ?? [])).catch(() => setServerDeals([]));
  }, []);

  // Server deals win over the same deal recorded in this browser
  const seen = new Set(serverDeals.map((d) => d.reqId));
  const raw = [...serverDeals, ...ledger.deals.filter((d) => !seen.has(d.reqId)), ...localDeals(state)];
  // Awarded quotes take their wages and women's share from the supplier's workforce profile (P3)
  const [deals, setDeals] = useState<DealRecord[]>(raw);
  const rawKey = raw.map((d) => d.id).join('|');
  useEffect(() => {
    let live = true;
    setDeals(raw);
    void withWorkforce(raw, (id) => sellers.find((s) => s.id === id)?.name ?? id).then((d) => { if (live) setDeals(d); });
    return () => { live = false; };
  }, [rawKey]);
  const { totals, byDistrict } = computeImpact(deals);
  const arch = architectures(scenario, weights).find((a) => a.id === (state.chosen[state.sector]?.archId ?? 'corridor'));
  const open = ledger.grievances.filter((g) => g.status === 'open').length;
  // Workforce figures are only as real as the deals that carry them
  const wageSrc = weakest(deals.filter((d) => d.wagePerDay !== undefined).map((d) => d.workforceSource ?? d.source));
  const womenSrc = weakest(deals.filter((d) => d.womenShare !== undefined).map((d) => d.workforceSource ?? d.source));

  const tiles: { label: string; value: string; note: string; sdg?: string; src: Provenance }[] = [
    { label: 'Jobs on confirmed deals', value: totals.jobs.toLocaleString('en-IN'), note: `${totals.deals} deals`, sdg: '8.5', src: totals.jobsSource },
    { label: 'Wages against the living wage', value: share(totals.wageVsLiving.value), note: totals.wageVsLiving.covered ? `average across ${totals.wageVsLiving.covered} supplier shares with workforce data` : 'shows once suppliers add workforce profiles', sdg: '8.5', src: wageSrc },
    { label: 'Women among workers', value: share(totals.womenShare.value), note: totals.womenShare.covered ? `${totals.womenShare.covered} supplier shares reporting` : 'shows once suppliers add workforce profiles', sdg: '8.5', src: womenSrc },
    { label: 'Contract value with rural suppliers', value: deals.length ? share(totals.ruralShare) : '—', note: 'SHG federations, FPOs and cooperatives', sdg: '8.3', src: totals.source },
    { label: 'Imports replaced', value: cr(totals.importReplacedInr), note: `of ${cr(totals.valueInr)} confirmed contract value`, sdg: '8.2', src: totals.source },
    { label: 'Worker grievances', value: `${open} open`, note: `${ledger.grievances.length - open} resolved`, sdg: '8.8', src: 'declared' },
    { label: 'Signed credentials', value: String(ledger.credentials.length), note: `${ledger.credentials.filter((c) => c.type === 'SkillCredential').length} skill, ${ledger.credentials.filter((c) => c.type === 'AuditCredential').length} audit, ${ledger.credentials.filter((c) => c.type === 'ContractCredential').length} contract`, src: 'verified' },
  ];

  const chart = byDistrict.slice(0, 10).map((d) => ({ name: district(d.districtId).name, jobs: d.jobs }));

  return (
    <div className="stack">
      <div>
        <h1 className="lead">SDG 8 impact · {buyer.product}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Atmanirbhar Bharat and Viksit Bharat, measured: what every confirmed deal does for decent work, rural jobs and imports. Each number says where it comes from.
        </p>
      </div>

      <div className="grid-3">
        {tiles.map((t) => (
          <div key={t.label} className="stat">
            <div className="label">{t.label}</div>
            <div className="value">{t.value}</div>
            <div className="delta muted">{t.note}</div>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>{t.sdg && <span className="chip plain">SDG {t.sdg}</span>}<Src kind={t.src} /></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-title">Where the work goes</div>
        {byDistrict.length === 0 ? (
          <p className="small muted">
            No confirmed deals yet. Award a quote under <button className="linkish" onClick={() => go('buyer', 'requirements')}>Requirements and quotes</button>, or let the agents close one in <button className="linkish" onClick={() => go('buyer', 'negotiate')}>Agent negotiation</button>.
          </p>
        ) : (
          <>
            <div style={{ height: Math.max(160, chart.length * 34) }}>
              <ResponsiveContainer>
                <BarChart data={chart} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
                  <CartesianGrid stroke="#eef0f3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#5a6472' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: '#5a6472' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="jobs" name="Jobs" fill="#c2410c" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>District</th><th>State</th><th>Area</th><th>Deals</th><th>Jobs</th><th>Contract value</th><th>Imports replaced</th></tr></thead>
                <tbody>
                  {byDistrict.map((d) => {
                    const x = district(d.districtId);
                    return <tr key={d.districtId}><td>{x.name}</td><td>{x.state}</td><td>{d.rural ? 'Rural' : 'Urban'}</td><td>{d.deals}</td><td>{d.jobs.toLocaleString('en-IN')}</td><td>{cr(d.valueInr)}</td><td>{cr(d.importReplacedInr)}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
            <p className="tiny">Agent deals count the workers and value in their labour plan and order. Awarded quotes count one year of supply, with jobs estimated from the supplier's workforce and the share of its capacity the order uses.</p>
          </>
        )}
      </div>

      {arch && (
        <div className="card">
          <div className="section-title">If the chosen future network is built</div>
          <p className="small">{arch.name}: <b>{arch.jobs.toLocaleString('en-IN')}</b> rural and new jobs, with <b>{Math.round(arch.ruralShare)}%</b> of the value made by rural suppliers. <Src kind="estimated" /></p>
          <p className="tiny">Change the design under <button className="linkish" onClick={() => go('buyer', 'network')}>Future network</button>.</p>
        </div>
      )}
    </div>
  );
}
