import { bom, buyer, demandSignals, processInfo, sellers } from '../data';
import { district, isRural, roadKm, sellerGaps } from '../engine';
import { useStore } from '../store';
import { trustScore } from '../trust';
import { useUi } from '../ui';
import { regionHi, strings, typeHi } from './i18n';
import type { Lang } from './i18n';
import { visibleTo } from './visibility';

export default function SellerView({ lang }: { lang: Lang }) {
  const { state } = useStore();
  const { actingSeller, openSupplier, go } = useUi();
  const t = strings[lang];
  const seller = sellers.find((s) => s.id === actingSeller);
  if (!seller) return <div className="empty">Pick a company in the sidebar.</div>;
  const place = district(seller.districtId);
  const trust = trustScore(seller, state);
  const reqs = state.requirements.filter((r) => r.sector === state.sector && r.status === 'open' && visibleTo(r, seller));
  const focus = reqs[0];
  const line = focus ? bom.find((l) => l.id === focus.lineId) : bom.find((l) => l.process === seller.process);
  const need = focus?.monthlyVolume ?? buyer.monthlyUnits;
  const gaps = line ? sellerGaps(seller, line, need) : [];
  const signal = demandSignals.find((d) => d.process === seller.process);
  const proc = lang === 'hi' ? processInfo(seller.process).nameHi : seller.process;
  const partners = sellers.filter((s) => s.id !== seller.id && s.process === seller.process && s.monthlyCapacity + seller.monthlyCapacity >= need && seller.monthlyCapacity < need)
    .sort((a, b) => roadKm(district(a.districtId), place) - roadKm(district(b.districtId), place)).slice(0, 3);
  const totalCost = gaps.reduce((s, g) => s + g.costLakh, 0);
  const months = gaps.reduce((m, g) => Math.max(m, g.months), 0);
  const fmtLakh = (n: number) => `₹${n} ${t.lakh}`;

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <span className={`chip ${isRural(seller) ? 'rural' : 'plain'}`}>{lang === 'hi' ? typeHi[seller.type] : seller.type}</span>
          <span className={`trust-badge trust-${trust.band}`}>Trust {trust.score} · {trust.band}</span>
          <span className={`chip ${seller.verification === 'verified' ? 'ready' : 'potential'}`}>{seller.verification === 'verified' ? t.verified : t.declared}</span>
        </div>
        <h1 className="lead" style={{ marginTop: 10 }}>{seller.name}</h1>
        <p className="muted" style={{ marginTop: 4 }}>{place.name}, {place.state} · {proc} · {seller.monthlyCapacity.toLocaleString('en-IN')} {t.capacity} · {seller.workers} {t.workers}</p>
        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={() => openSupplier(seller.id)}>See how buyers see you</button>
          <button className="btn small ghost" onClick={() => go('supplier', 'profile')}>Improve your profile</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="stack">
          <div className="card">
            <div className="section-title">{t.demandTitle}</div>
            <p style={{ fontSize: 17 }}><b>{reqs.length}</b> open requirement{reqs.length === 1 ? '' : 's'} for {proc.toLowerCase()} on Sangam right now.</p>
            {signal && <p className="small muted" style={{ marginTop: 6 }}>{t.demandLine(signal.buyers, signal.monthlyUnits.toLocaleString('en-IN'), signal.from, lang === 'hi' ? regionHi[signal.region] ?? signal.region : signal.region)}</p>}
            <p className="tiny" style={{ marginTop: 8 }}>{t.demandNote}</p>
            <button className="btn small primary" style={{ marginTop: 10 }} onClick={() => go('supplier', 'opps')}>See opportunities</button>
          </div>

          <div className="card">
            <div className="section-title">{t.teamTitle}</div>
            {seller.monthlyCapacity >= need ? <p className="muted">{t.noTeam}</p> : partners.length === 0 ? <p className="muted small">No single partner closes the gap; try a consortium of three.</p> : (
              <ul className="why">
                {partners.map((p) => (
                  <li key={p.id}>
                    {t.teamLine(p.name, district(p.districtId).name, (p.monthlyCapacity + seller.monthlyCapacity).toLocaleString('en-IN'))}{' '}
                    <span className="tiny">({roadKm(place, district(p.districtId))} km · trust {trustScore(p, state).score})</span>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn small" style={{ marginTop: 10 }} onClick={() => go('supplier', 'consortia')}>Form a consortium</button>
          </div>
        </div>

        <div className="card">
          <div className="section-title">{t.readinessTitle}</div>
          {line && <p className="small muted" style={{ marginBottom: 12 }}>{t.requirement}: {focus?.title ?? line.name}, {need.toLocaleString('en-IN')} {t.capacity}{line.requiredCerts.length > 0 && `, ${line.requiredCerts.join(', ')}`}</p>}
          {!line ? <p className="muted small">No buyer needs this process yet.</p> : gaps.length === 0 ? (
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
                    <div className="small" style={{ textAlign: 'right' }}>{fmtLakh(g.costLakh)}<div className="tiny">{g.months} {t.months}</div></div>
                  </li>
                ))}
              </ul>
              <p className="small" style={{ marginTop: 12, fontWeight: 500 }}>{t.total(fmtLakh(Math.round(totalCost * 10) / 10), months)}</p>
              {partners.length > 0 && gaps.some((g) => g.kind === 'capacity') && <p className="tiny" style={{ marginTop: 6 }}>{t.teamSkips}</p>}
              <p className="tiny" style={{ marginTop: 6 }}>{t.disclaimer}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
