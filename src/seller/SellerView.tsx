import { useState } from 'react';
import { bom, buyer, demandSignals, sellers } from '../data';
import { district, isRural, optionsFor, roadKm } from '../engine';
import { processHi, regionHi, strings, typeHi } from './i18n';
import type { Lang } from './i18n';
import type { Seller } from '../types';
import Tabs from '../components/Tabs';
import Diversification from './Diversification';

export default function SellerView() {
  const [sellerId, setSellerId] = useState('s13');
  const [lang, setLang] = useState<Lang>('en');
  const [tab, setTab] = useState<'overview' | 'grow'>('overview');
  const t = strings[lang];
  const seller = sellers.find((s) => s.id === sellerId)!;
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <label className="row small muted" style={{ flexWrap: 'wrap', gap: 8, minWidth: 0, maxWidth: '100%' }}>
          <span style={{ whiteSpace: 'nowrap' }}>{t.viewingAs}</span>
          <select value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
          </select>
        </label>
        <div className="segmented" aria-label="Language">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिंदी</button>
        </div>
      </div>
      <div>
        <Tabs tabs={[{ id: 'overview', label: t.tabOverview }, { id: 'grow', label: t.tabGrow }]} value={tab} onChange={setTab} />
        {tab === 'overview' ? <Overview seller={seller} lang={lang} /> : <Diversification seller={seller} lang={lang} />}
      </div>
    </div>
  );
}

function Overview({ seller, lang }: { seller: Seller; lang: Lang }) {
  const t = strings[lang];
  const place = district(seller.districtId);
  const line = bom.find((l) => l.process === seller.process)!;
  const opts = optionsFor(line);
  const solo = opts.find((o) => o.sellers.length === 1 && o.sellers[0].id === seller.id)!;
  const gaps = solo.gaps[0].gaps;
  const teams = opts.filter((o) => o.sellers.length === 2 && o.sellers.some((s) => s.id === seller.id));
  const signal = demandSignals.find((d) => d.process === seller.process);
  const proc = lang === 'hi' ? processHi[seller.process] : seller.process;
  const totalCost = gaps.reduce((s, g) => s + g.costLakh, 0);
  const months = gaps.reduce((m, g) => Math.max(m, g.months), 0);
  const fmtLakh = (n: number) => `₹${n} ${t.lakh}`;

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className={`chip ${isRural(seller) ? 'rural' : 'plain'}`}>{lang === 'hi' ? typeHi[seller.type] : seller.type}</span>
          <span className={`chip ${seller.verification === 'verified' ? 'ready' : 'potential'}`}>
            {seller.verification === 'verified' ? t.verified : t.declared}
          </span>
        </div>
        <h1 className="lead" style={{ marginTop: 10 }}>{seller.name}</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {place.name}, {place.state} · {proc} · {seller.monthlyCapacity.toLocaleString('en-IN')} {t.capacity} · {seller.workers} {t.workers}
        </p>
        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 6 }}>
          {seller.certs.length ? seller.certs.map((c) => <span key={c} className="chip plain">{c}</span>) : <span className="tiny">{t.noCerts}</span>}
        </div>
      </div>

      <div className="grid-2">
        <div className="stack">
          {signal && (
            <div className="card">
              <div className="section-title">{t.demandTitle}</div>
              <p style={{ fontSize: 17 }}>
                {t.demandLine(signal.buyers, signal.monthlyUnits.toLocaleString('en-IN'), signal.from, lang === 'hi' ? regionHi[signal.region] : signal.region)}
              </p>
              <p className="tiny" style={{ marginTop: 8 }}>{t.demandNote}</p>
            </div>
          )}

          <div className="card">
            <div className="section-title">{t.teamTitle}</div>
            {teams.length === 0 ? (
              <p className="muted">{seller.monthlyCapacity >= buyer.monthlyUnits ? t.noTeam : '—'}</p>
            ) : (
              <ul className="why">
                {teams.map((o) => {
                  const p = o.sellers.find((s) => s.id !== seller.id)!;
                  const cap = o.sellers.reduce((s, x) => s + x.monthlyCapacity, 0);
                  return (
                    <li key={p.id}>
                      {t.teamLine(p.name, district(p.districtId).name, cap.toLocaleString('en-IN'))}{' '}
                      <span className="tiny">({roadKm(place, district(p.districtId))} km)</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {teams.length > 0 && gaps.some((g) => g.kind === 'capacity') && (
              <p className="tiny" style={{ marginTop: 10 }}>{t.teamSkips}</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="section-title">{t.readinessTitle}</div>
          <p className="small muted" style={{ marginBottom: 12 }}>
            {t.requirement}: {proc}, {buyer.monthlyUnits.toLocaleString('en-IN')} {t.capacity}
            {line.requiredCerts.length > 0 && `, ${line.requiredCerts.join(', ')}`}
          </p>
          {gaps.length === 0 ? (
            <p style={{ color: 'var(--ready)', fontWeight: 600 }}>{t.readyNow}</p>
          ) : (
            <>
              <p style={{ marginBottom: 12 }}>{t.almost(gaps.length)}</p>
              <ul className="checklist">
                {gaps.map((g) => (
                  <li key={g.label}>
                    <span className="box" />
                    <div>
                      <div style={{ fontWeight: 500 }}>{lang === 'hi' ? g.labelHi : g.label}</div>
                      <div className="tiny">{t.help}: {g.schemes.join(' · ')}</div>
                    </div>
                    <div className="small" style={{ textAlign: 'right' }}>
                      {fmtLakh(g.costLakh)}
                      <div className="tiny">{g.months} {t.months}</div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="small" style={{ marginTop: 12, fontWeight: 500 }}>{t.total(fmtLakh(totalCost), months)}</p>
              <p className="tiny" style={{ marginTop: 6 }}>{t.disclaimer}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
