import { useState } from 'react';
import { sellers } from '../data';
import { district } from '../engine';
import { useStore } from '../store';
import { trustScore } from '../trust';
import { useUi } from '../ui';
import ReviewForm from '../components/ReviewForm';
import Stars from '../components/Stars';
import Src from '../components/Src';

const STATUS = { pending: { label: 'Waiting for verification', cls: 'potential' }, verified: { label: 'Verified', cls: 'ready' }, rejected: { label: 'Rejected', cls: 'danger' } } as const;

export default function ReviewsPage() {
  const { state } = useStore();
  const { actingSeller, openSupplier } = useUi();
  const [partner, setPartner] = useState<string | null>(null);
  const seller = sellers.find((s) => s.id === actingSeller);
  if (!seller) return <div className="empty">Pick a company in the sidebar.</div>;
  const t = trustScore(seller, state);
  const about = state.reviews.filter((r) => r.sellerId === seller.id).sort((a, b) => b.at.localeCompare(a.at));
  const partners = [...new Set(state.consortia.filter((c) => c.members.some((m) => m.sellerId === seller.id)).flatMap((c) => c.members.map((m) => m.sellerId)))].filter((id) => id !== seller.id);
  const others = partners.length ? partners : sellers.filter((s) => s.id !== seller.id && s.process === seller.process).slice(0, 4).map((s) => s.id);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="lead">Reviews</h1>
          <p className="muted" style={{ marginTop: 6 }}>Buyers and partners review you after real orders. The Sangam team checks each review against the purchase order before it counts.</p>
        </div>
        <span className={`trust-badge trust-${t.band}`} style={{ fontSize: 14, padding: '6px 14px' }}>Trust {t.score} · {t.band}</span>
      </div>

      <div className="card">
        <div className="section-title">About {seller.name}</div>
        {about.length === 0 ? <p className="small muted">No reviews yet. Complete your first orders through Sangam to start building a record.</p> : (
          <div className="stack" style={{ gap: 12 }}>
            {about.map((r) => (
              <div key={r.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{r.author} <span className="tiny">({r.authorType})</span></span>
                  <span className="row" style={{ gap: 8 }}><Stars value={(r.ratings.quality + r.ratings.delivery + r.ratings.communication + r.ratings.compliance) / 4} /><span className={`chip ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></span>
                </div>
                <p className="small" style={{ marginTop: 4 }}>{r.text}</p>
                <div className="tiny">Quality {r.ratings.quality} · Delivery {r.ratings.delivery} · Communication {r.ratings.communication} · Compliance {r.ratings.compliance} · order {r.orderRef} {r.sample && <Src kind="simulated" />}</div>
                {r.verifierNote && <div className="tiny">Sangam team: {r.verifierNote}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Review a partner</div>
        <p className="small muted">Worked with another supplier in a consortium or as a subcontractor? Your review helps buyers trust good partners.</p>
        {partner ? (
          <ReviewForm sellerId={partner} defaultAuthor={seller.name} defaultType="partner" onDone={() => setPartner(null)} />
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {others.map((id) => {
              const s = sellers.find((x) => x.id === id);
              return s ? (
                <div key={id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <button className="linkish" onClick={() => openSupplier(id)}>{s.name}, {district(s.districtId).name}</button>
                  <button className="btn small" onClick={() => setPartner(id)}>Write a review</button>
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
