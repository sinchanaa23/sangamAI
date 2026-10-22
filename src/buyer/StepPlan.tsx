import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bom } from '../data';
import { fiveYear, isImported, lakh } from '../engine';
import type { Chain } from '../engine';

interface Props {
  chain: Chain;
  duty: number;
  delay: number;
}

export default function StepPlan({ chain, duty, delay }: Props) {
  const [view, setView] = useState<'cost' | 'import'>('cost');
  const pts = fiveYear(chain, duty, delay);
  const last = pts[pts.length - 1];
  const saving = last.continue - last.localise;

  const now = bom.filter((l) => chain.picks[l.id]?.status === 'ready');
  const develop = bom.filter((l) => chain.picks[l.id]?.status === 'potential');
  const stillImported = bom.filter((l) => !chain.picks[l.id] && isImported(l));

  const series = view === 'cost'
    ? [
        { key: 'continue', name: 'Keep importing', color: '#94a3b8' },
        { key: 'diversify', name: 'Diversify abroad', color: '#6366f1' },
        { key: 'localise', name: `Sangam: ${chain.name}`, color: '#0f766e' },
      ]
    : [
        { key: 'continueImport', name: 'Keep importing', color: '#94a3b8' },
        { key: 'localiseImport', name: `Sangam: ${chain.name}`, color: '#0f766e' },
      ];

  return (
    <div className="stack">
      <div className="card">
        <div className="eyebrow">Five-year comparison · {chain.name}</div>
        <h1 className="lead" style={{ marginTop: 6 }}>
          {saving > 0
            ? <>Building in India saves about {'₹'}{saving.toFixed(0)} Cr over five years.</>
            : <>Building in India costs {'₹'}{(-saving).toFixed(0)} Cr more over five years, in exchange for lower risk.</>}
        </h1>
        <p className="muted" style={{ marginTop: 6 }}>
          With +{duty}% duty and {delay}-week delays, against {'₹'}{last.continue.toFixed(0)} Cr if you keep importing. Demand grows 15% a year.
        </p>

        <div className="row" style={{ marginTop: 18, justifyContent: 'space-between' }}>
          <div className="segmented">
            <button className={view === 'cost' ? 'on' : ''} onClick={() => setView('cost')}>Cumulative cost</button>
            <button className={view === 'import' ? 'on' : ''} onClick={() => setView('import')}>Import dependence</button>
          </div>
        </div>

        <div style={{ height: 300, marginTop: 12 }}>
          <ResponsiveContainer>
            <LineChart data={pts} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#eef0f3" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#5a6472' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: '#5a6472' }} axisLine={false} tickLine={false} width={64}
                tickFormatter={(v) => (view === 'cost' ? `₹${v} Cr` : `${v}%`)}
                domain={view === 'import' ? [0, 100] : ['auto', 'auto']}
              />
              <Tooltip formatter={(v: number) => (view === 'cost' ? `₹${v.toFixed(1)} Cr` : `${v.toFixed(0)}%`)} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
              {series.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={s.key.startsWith('localise') ? 3 : 2} dot={{ r: 3 }} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Roadmap</div>
        <div className="roadmap">
          <div className="phase">
            <div className="dot" />
            <h4>Next 3 months</h4>
            <ul>
              {now.length > 0 && <li>Trial orders, then switch:</li>}
              {now.map((l) => <li key={l.id}><b>{l.name}</b>: {chain.picks[l.id]!.sellers.map((s) => s.name).join(' + ')}</li>)}
              {now.length === 0 && <li>Run trial orders with shortlisted suppliers</li>}
            </ul>
          </div>
          <div className="phase">
            <div className="dot" />
            <h4>3 to 12 months</h4>
            <ul>
              {develop.map((l) => {
                const o = chain.picks[l.id]!;
                const items = o.gaps.flatMap((g) => g.gaps.map((x) => (x.kind === 'capacity' ? 'a' + x.label.slice(1) : x.label)));
                return <li key={l.id}><b>{o.sellers.map((s) => s.name).join(' + ')}</b>: {items.join(', ')}</li>;
              })}
              {develop.length > 0 && <li>Co-fund {lakh(chain.investmentLakh / 2)} of {lakh(chain.investmentLakh)} supplier development</li>}
              {develop.length === 0 && <li>Qualify a second Indian source for each part</li>}
            </ul>
          </div>
          <div className="phase">
            <div className="dot" />
            <h4>Year 2 onward</h4>
            <ul>
              {stillImported.length
                ? <li>Still imported: {stillImported.map((l) => l.name.toLowerCase()).join(', ')}. Sangam keeps searching for suppliers.</li>
                : <li>All parts sourced in India</li>}
              <li>Keep the import supplier as a small backup</li>
              <li>Re-run the chain each year as new suppliers join</li>
            </ul>
          </div>
        </div>
      </div>

      <details>
        <summary>Assumptions behind these numbers</summary>
        <ul className="why small muted">
          <li>All companies, capacities, prices and quality scores are simulated. Place names are real.</li>
          <li>Freight: road distance is 1.3 times the straight-line distance, at {'₹'}0.005 per kg per km.</li>
          <li>A disruption like the one simulated has a 35% chance each year; each scooter not built loses {'₹'}1,500.</li>
          <li>Diversifying abroad: half the volume moves to a second country at 5% higher price and half the extra duty.</li>
          <li>A part switches to India in the year its supplier's gaps are closed; the buyer co-funds half the gap cost plus {'₹'}5 lakh to qualify each supplier.</li>
        </ul>
      </details>
    </div>
  );
}
