import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { currentBusiness, opportunitiesFor } from '../diversify';
import type { OppResult } from '../diversify';
import type { Seller } from '../types';
import CapabilityWheel, { roiColor } from '../components/CapabilityWheel';
import { processHi, strings } from './i18n';
import type { Lang } from './i18n';

const lakh = (n: number, unit: string) => `₹${Math.round(n).toLocaleString('en-IN')} ${unit}`;
const short = (s: string, n = 24) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export default function Diversification({ seller, lang }: { seller: Seller; lang: Lang }) {
  const t = strings[lang];
  const results = opportunitiesFor(seller);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const sel = results.find((r) => r.opp.id === pickedId) ?? results[0];
  const nameOf = (r: OppResult) => (lang === 'hi' ? r.opp.nameHi : r.opp.name);
  const proc = lang === 'hi' ? processHi[seller.process] : seller.process;
  const base = currentBusiness(seller);
  const L = t.lakh;

  const bubble = results.map((r) => ({ id: r.opp.id, name: short(nameOf(r), 18), invest: Math.round(r.investment.total), profit: Math.round(r.profitLakh), market: r.opp.marketCr }));
  const roiBars = results.map((r) => ({ id: r.opp.id, name: short(nameOf(r), 18), r5: Math.round(r.roi5 * 100), r10: Math.round(r.roi10 * 100) }));
  const costRows = [
    { k: t.equipment, v: sel.investment.equipment, c: '#3d5a45' },
    { k: t.certification, v: sel.investment.certification, c: '#5b6f8f' },
    { k: t.training, v: sel.investment.training, c: '#a4552c' },
    { k: t.workingCapital, v: sel.investment.workingCapital, c: '#787774' },
  ];

  return (
    <div className="stack">
      <div>
        <h1 className="lead">{t.growLead(seller.name)}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{t.growSub}</p>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <div className="section-title">{t.mapTitle}</div>
          <CapabilityWheel
            center={proc.split(' ').length > 1 ? [proc.split(' ')[0], proc.split(' ').slice(1).join(' ')] : [proc]}
            centerSub={`${seller.monthlyCapacity.toLocaleString('en-IN')} ${t.capacity}`}
            results={results}
            selected={sel.opp.id}
            onSelect={setPickedId}
            nameOf={nameOf}
            fitLabel={t.fit}
          />
          <p className="tiny">{t.mapNote}</p>
        </div>

        <div className="card">
          <div className="section-title">{t.bubbleTitle}</div>
          <div style={{ height: 330 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 16, right: 110, bottom: 22, left: 4 }}>
                <CartesianGrid stroke="#efeeea" />
                <XAxis type="number" dataKey="invest" name={t.invest} tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 12, fill: '#6b6a66' }} label={{ value: `${t.invest} (${L})`, position: 'insideBottom', offset: -12, fontSize: 12, fill: '#9a9892' }} domain={[0, 'auto']} />
                <YAxis type="number" dataKey="profit" name={t.profitYr} tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 12, fill: '#6b6a66' }} width={52} domain={[0, 'auto']} />
                <ZAxis type="number" dataKey="market" range={[120, 700]} />
                <Tooltip cursor={false} formatter={(v: number, n: string) => (n === 'market' ? `₹${v} Cr` : lakh(v, L))} />
                <Scatter data={bubble} isAnimationActive={false} onClick={(d: { id: string }) => setPickedId(d.id)} shape={(raw: unknown) => {
                  const p = raw as { cx: number; cy: number; size: number; payload: { id: string } };
                  const r = results.find((x) => x.opp.id === p.payload.id)!;
                  const rad = Math.sqrt(p.size / Math.PI);
                  return <circle cx={p.cx} cy={p.cy} r={rad} fill={roiColor(r.roi10)} fillOpacity={p.payload.id === sel.opp.id ? 0.55 : 0.25} stroke={roiColor(r.roi10)} strokeWidth={p.payload.id === sel.opp.id ? 2.5 : 1.2} style={{ cursor: 'pointer' }} />;
                }}>
                  <LabelList dataKey="name" content={(raw: unknown) => {
                    const p = raw as { x: number; y: number; width: number; height: number; value: string };
                    return <text x={p.x + p.width + 4} y={p.y + p.height / 2 + 4} fontSize={11} fill="#6b6a66">{p.value}</text>;
                  }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="tiny">{t.bubbleNote} ({L} {lang === 'hi' ? 'रुपये' : 'rupees'})</p>
        </div>
      </div>

      <div className="card">
        <div className="section-title">{t.compareTitle}</div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={roiBars} margin={{ top: 18, right: 16, bottom: 0, left: 0 }} barGap={4}>
              <CartesianGrid stroke="#efeeea" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b6a66' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: '#6b6a66' }} axisLine={false} tickLine={false} width={50} />
              <Tooltip formatter={(v: number) => `${v}%`} cursor={{ fill: '#fbfbfa' }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="r5" name={t.ret5} fill="#99d5cc" radius={[3, 3, 0, 0]} isAnimationActive={false} onClick={(d: { id: string }) => setPickedId(d.id)}>
                <LabelList dataKey="r5" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: '#6b6a66' }} />
              </Bar>
              <Bar dataKey="r10" name={t.ret10} radius={[3, 3, 0, 0]} isAnimationActive={false} onClick={(d: { id: string }) => setPickedId(d.id)}>
                {roiBars.map((b) => <Cell key={b.id} fill={b.id === sel.opp.id ? '#3d5a45' : '#3f9c90'} />)}
                <LabelList dataKey="r10" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: '#6b6a66' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card stack">
        <div>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <h2 className="lead" style={{ fontSize: 21 }}>{nameOf(sel)}</h2>
            <span className="chip ready">{t.fit} {sel.fit}%</span>
          </div>
          <p className="small muted" style={{ marginTop: 4 }}>{t.market(sel.opp.marketCr.toLocaleString('en-IN'), sel.opp.growthPct, sel.opp.buyers)}</p>
        </div>

        <div className="grid-4">
          <div className="stat"><div className="label">{t.invest}</div><div className="value">{lakh(sel.investment.total, L)}</div><div className="delta muted">{lakh(sel.profitLakh, L)} {t.profitYr}</div></div>
          <div className="stat"><div className="label">{t.payback}</div><div className="value">{sel.paybackYears !== null ? `${sel.paybackYears.toFixed(1)} ${t.years}` : t.notReached}</div><div className="delta muted">{t.readyIn} {sel.opp.readyMonths} {t.months}</div></div>
          <div className="stat"><div className="label">{t.ret5}</div><div className={`value ${sel.roi5 >= 0 ? 'down' : 'up'}`}>{Math.round(sel.roi5 * 100)}%</div><div className="delta muted">{'₹'}{(1 + sel.roi5).toFixed(2)} {t.per1}</div></div>
          <div className="stat"><div className="label">{t.ret10}</div><div className={`value ${sel.roi10 >= 0 ? 'down' : 'up'}`}>{Math.round(sel.roi10 * 100)}%</div><div className="delta muted">+{Math.round(sel.opp.jobs * sel.scale)} {t.newJobs.toLowerCase()}</div></div>
        </div>

        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div className="section-title" style={{ fontSize: 14 }}>{t.have}</div>
            <ul className="why small">
              {sel.opp.reuses.map((x) => <li key={x}>{x}</li>)}
              {seller.certs.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
          <div>
            <div className="section-title" style={{ fontSize: 14 }}>{t.need}</div>
            <ul className="why small">
              {sel.opp.needs.map((x) => <li key={x}>{x}</li>)}
              {sel.certsMissing.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        </div>

        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
          <div>
            <div className="section-title" style={{ fontSize: 14 }}>{t.costTitle}</div>
            <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 12 }}>
              {costRows.filter((c) => c.v > 0).map((c) => <div key={c.k} style={{ width: `${(c.v / sel.investment.total) * 100}%`, background: c.c }} title={c.k} />)}
            </div>
            <table>
              <tbody>
                {costRows.map((c) => (
                  <tr key={c.k}>
                    <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: c.c, marginRight: 8 }} />{c.k}</td>
                    <td className="num">{lakh(c.v, L)}</td>
                    <td className="num tiny">{Math.round((c.v / sel.investment.total) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="section-title" style={{ fontSize: 14 }}>{t.cashTitle}</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={sel.cash} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#efeeea" vertical={false} />
                  <XAxis dataKey="year" tickFormatter={(v) => `Y${v}`} tick={{ fontSize: 12, fill: '#6b6a66' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 12, fill: '#6b6a66' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip formatter={(v: number) => lakh(v, L)} labelFormatter={(v) => `Y${v}`} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
                  <Line dataKey="asIs" name={t.asIs} stroke="#b4b2ac" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line dataKey="expand" name={t.expand} stroke="#3d5a45" strokeWidth={3} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="tiny">{lakh(base.profit, L)} {lang === 'hi' ? 'आज का अनुमानित सालाना मुनाफ़ा' : "estimated profit a year today"}</p>
          </div>
        </div>
        <p className="tiny">{t.growDisclaimer}</p>
      </div>
    </div>
  );
}
