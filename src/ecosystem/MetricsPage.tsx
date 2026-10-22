import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bom, buyer, sellers } from '../data';
import { baselineImportShare, isRural, optionsFor } from '../engine';
import { architectures } from '../network';
import { useStore } from '../store';
import { checksFor } from '../trust';
import { useBuyer } from '../buyer/context';

export default function MetricsPage() {
  const { state } = useStore();
  const { chain, scenario, weights } = useBuyer();
  const sector = state.sector;
  const reqs = state.requirements.filter((r) => r.sector === sector);
  const reqIds = new Set(reqs.map((r) => r.id));
  const interests = state.interests.filter((i) => reqIds.has(i.reqId));
  const quotes = state.quotes.filter((q) => reqIds.has(q.reqId));
  const awarded = reqs.filter((r) => r.status === 'awarded');
  const withReady = reqs.filter((r) => { const l = bom.find((x) => x.id === r.lineId); return l && optionsFor(l).some((o) => o.status === 'ready'); });
  const gapsFound = bom.reduce((t, l) => t + optionsFor(l).filter((o) => o.sellers.length === 1 && o.status === 'potential').length, 0);
  const milestones = state.projects.filter((p) => p.sector === sector).flatMap((p) => p.milestones);
  const verifiedSellers = sellers.filter((s) => checksFor(s, state).identity === 'verified');
  const reviews = state.reviews.filter((r) => sellers.some((s) => s.id === r.sellerId));
  const arch = architectures(scenario, weights).find((a) => a.id === (state.chosen[sector]?.archId ?? 'corridor'));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

  const funnel = [
    { stage: 'Requirements', n: reqs.length },
    { stage: 'Viewed', n: new Set(state.views.filter((v) => reqIds.has(v.reqId)).map((v) => `${v.reqId}-${v.sellerId}`)).size },
    { stage: 'Interested', n: interests.length },
    { stage: 'Quotes', n: quotes.length },
    { stage: 'Awards', n: awarded.length },
  ];

  const tiles = [
    { label: 'Requirements with a ready Indian supplier', value: pct(withReady.length, reqs.length), note: `${withReady.length} of ${reqs.length}` },
    { label: 'Supplier gaps identified', value: String(gapsFound), note: 'single suppliers that could qualify after upgrades' },
    { label: 'Development milestones verified', value: pct(milestones.filter((m) => m.status === 'verified').length, milestones.length), note: `${milestones.length} milestones in ${state.projects.filter((p) => p.sector === sector).length} projects` },
    { label: 'Quotes per request for quotes', value: reqs.filter((r) => r.firmness !== 'exploring').length ? (quotes.length / reqs.filter((r) => r.firmness !== 'exploring').length).toFixed(1) : '—', note: 'competition for each requirement' },
    { label: 'Suppliers with verified identity', value: pct(verifiedSellers.length, sellers.length), note: `${verifiedSellers.length} of ${sellers.length}` },
    { label: 'Reviews verified against orders', value: pct(reviews.filter((r) => r.status === 'verified').length, reviews.length), note: `${reviews.filter((r) => r.status === 'pending').length} waiting` },
    { label: 'Import share: today → chosen chain', value: `${baselineImportShare().toFixed(0)}% → ${chain.importShare.toFixed(0)}%`, note: chain.name },
    { label: 'Rural value in chosen design', value: arch ? `${arch.ruralShare.toFixed(0)}%` : '—', note: arch ? `${arch.name}, ${arch.jobs.toLocaleString('en-IN')} rural and new jobs` : '' },
    { label: 'Rural collectives on Sangam', value: String(sellers.filter(isRural).length), note: `of ${sellers.length} suppliers in this sector` },
  ];

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Platform metrics · {buyer.product}</h1>
        <p className="muted" style={{ marginTop: 6 }}>The success measures from the proposal, computed live from activity in this demo. Matching quality is judged against outcomes (awards, verified gaps closed), not the number of matches.</p>
      </div>
      <div className="grid-3">
        {tiles.map((t) => (
          <div key={t.label} className="stat"><div className="label">{t.label}</div><div className="value">{t.value}</div><div className="delta muted">{t.note}</div></div>
        ))}
      </div>
      <div className="card">
        <div className="section-title">From requirement to award</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={funnel} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#eef0f3" vertical={false} />
              <XAxis dataKey="stage" tick={{ fontSize: 12, fill: '#5a6472' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#5a6472' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip />
              <Bar dataKey="n" name="Count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {funnel.map((f, i) => <Cell key={f.stage} fill={['#94a3b8', '#64748b', '#0369a1', '#0f766e', '#15803d'][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="tiny">Includes sample activity created for the demo; anything you add in the Buyer and Supplier workspaces updates these numbers.</p>
      </div>
    </div>
  );
}
