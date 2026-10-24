// Ecosystem → Reviews. Both sides rate each other after a real order: buyers rate suppliers, suppliers rate buyers.
// A review counts only after the Sangam team matches it to a real order, so nobody can buy or bury a reputation.
import { useRef, useState } from 'react';
import { buyer as demoBuyer, sellers } from '../data';
import { district } from '../engine';
import { useStore } from '../store';
import { trustScore } from '../trust';
import { useUi } from '../ui';
import { useAccess } from '../access/Access';
import ReviewForm from '../components/ReviewForm';
import Src from '../components/Src';
import Stars from '../components/Stars';
import useScrollReveal from '../components/ScrollReveal';
import ReviewsPage from '../seller/ReviewsPage';
import { DIMS, overall, summarise, useBuyerReviews } from './buyerReviews';
import type { BuyerReview, Dim, Draft } from './buyerReviews';
import './reviews.css';

const STATUS = { pending: { label: 'Waiting for the order check', cls: 'potential' }, verified: { label: 'Verified', cls: 'ready' }, rejected: { label: 'Not accepted', cls: 'danger' } } as const;

type Tab = 'suppliers' | 'buyers';

export default function ReviewsHub() {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef, 'reviews-hub');
  const access = useAccess();
  const [tab, setTab] = useState<Tab>(access.role === 'supplier' ? 'buyers' : 'suppliers');

  return (
    <div className="stack" ref={rootRef}>
      <div>
        <h1 className="lead">Reviews, both ways</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Buyers rate the suppliers they ordered from, and suppliers rate the buyers they sold to: on payment, clear specifications, fair terms and communication. The Sangam team checks every review against the real order before it counts.
        </p>
      </div>
      <div className="subtabs" role="tablist">
        <button role="tab" aria-selected={tab === 'suppliers'} className={tab === 'suppliers' ? 'on' : ''} onClick={() => setTab('suppliers')}>Suppliers, rated by buyers</button>
        <button role="tab" aria-selected={tab === 'buyers'} className={tab === 'buyers' ? 'on' : ''} onClick={() => setTab('buyers')}>Buyers, rated by suppliers</button>
      </div>
      {tab === 'suppliers' ? <SupplierReviews /> : <BuyerReviews />}
    </div>
  );
}

// ---------- Buyers rate suppliers (the store's existing reviews, which the trust score reads) ----------

function SupplierReviews() {
  const { state } = useStore();
  const { openSupplier } = useUi();
  const access = useAccess();
  const [writing, setWriting] = useState<string | null>(null);
  const [pick, setPick] = useState(sellers[0]?.id ?? '');
  const canWrite = access.role === 'buyer' || access.isTeam;
  const rated = sellers.map((s) => ({ s, t: trustScore(s, state) })).filter((x) => x.t.reviews.verified.length > 0).sort((a, b) => (b.t.reviews.avg ?? 0) - (a.t.reviews.avg ?? 0));
  const recent = state.reviews.filter((r) => r.status === 'verified').sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

  return (
    <>
      <div className="card">
        <div className="section-title">Best-reviewed suppliers</div>
        {rated.length === 0 ? <p className="small muted">No verified reviews yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Supplier</th><th className="num">Rating</th><th className="num">Reviews</th></tr></thead>
              <tbody>
                {rated.slice(0, 8).map(({ s, t }) => (
                  <tr key={s.id}>
                    <td><button className="linkish" style={{ fontWeight: 500 }} onClick={() => openSupplier(s.id)}>{s.name}</button><div className="tiny">{district(s.districtId).name} · trust {t.score}</div></td>
                    <td className="num" data-label="Rating"><Stars value={t.reviews.avg ?? 0} /> <span className="tiny">{(t.reviews.avg ?? 0).toFixed(1)}</span></td>
                    <td className="num" data-label="Verified reviews">{t.reviews.verified.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canWrite ? (
        <div className="card stack" style={{ gap: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Review a supplier you ordered from</div>
          {writing ? (
            <ReviewForm sellerId={writing} defaultAuthor={access.mode === 'server' && access.role === 'buyer' ? access.name : demoBuyer.name} onDone={() => setWriting(null)} />
          ) : (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Supplier" style={{ maxWidth: 360 }}>{sellers.map((s) => <option key={s.id} value={s.id}>{s.name}, {district(s.districtId).name}</option>)}</select>
              <button className="btn primary" style={{ visibility: 'visible' }} onClick={() => setWriting(pick)}>Write a review</button>
            </div>
          )}
          <p className="tiny">It stays pending until the Sangam team matches it to your purchase order, then counts towards the supplier&apos;s trust score. <Src kind="simulated" title="Reviews written in the demo are saved in this browser" /></p>
        </div>
      ) : (
        <div className="note">{access.role === 'supplier' ? 'Suppliers review buyers on the next tab. Reviews about your own company are listed below.' : 'Sign in as a buyer to review a supplier.'}</div>
      )}

      <div className="card">
        <div className="section-title">Latest verified reviews</div>
        {recent.length === 0 ? <p className="small muted">None yet.</p> : (
          <div className="stack" style={{ gap: 12 }}>
            {recent.map((r) => {
              const s = sellers.find((x) => x.id === r.sellerId);
              const avg = (r.ratings.quality + r.ratings.delivery + r.ratings.communication + r.ratings.compliance) / 4;
              return (
                <div key={r.id} className="rv-item">
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span><b>{s?.name ?? r.sellerId}</b> <span className="tiny">by {r.author} ({r.authorType})</span></span>
                    <Stars value={avg} />
                  </div>
                  <p className="small" style={{ marginTop: 4 }}>{r.text}</p>
                  <div className="tiny">Quality {r.ratings.quality} · Delivery {r.ratings.delivery} · Communication {r.ratings.communication} · Compliance {r.ratings.compliance} {r.sample && <Src kind="simulated" />}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {access.role === 'supplier' && (
        <details className="card">
          <summary>About my company</summary>
          <ReviewsPage />
        </details>
      )}
    </>
  );
}

// ---------- Suppliers rate buyers ----------

function BuyerReviews() {
  const access = useAccess();
  const { reviews, loading, submit, decide } = useBuyerReviews(access.mode, access.name || 'Demo supplier (offline demo)');
  const [writing, setWriting] = useState(false);
  const [done, setDone] = useState('');
  const canWrite = access.role === 'supplier';
  const summary = summarise(reviews);
  const verified = reviews.filter((r) => r.status === 'verified').sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  const mine = reviews.filter((r) => r.mine && r.status !== 'verified');
  const toCheck = reviews.filter((r) => r.status === 'pending');
  const known = [...new Set([demoBuyer.name, ...reviews.map((r) => r.buyerName)])];

  return (
    <>
      <div className="card">
        <div className="section-title">How suppliers rate buyers</div>
        {loading ? <p className="small muted">…</p> : summary.length === 0 ? <p className="small muted">No verified reviews yet.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Buyer</th><th className="num">Rating</th><th className="num">Reviews</th></tr></thead>
              <tbody>
                {summary.map((b) => (
                  <tr key={b.buyerName}>
                    <td><div style={{ fontWeight: 500 }}>{b.buyerName}</div><div className="tiny">{DIMS.map((d) => `${d.label} ${b.dims[d.key as Dim].toFixed(1)}`).join(' · ')}</div></td>
                    <td className="num" data-label="Rating"><Stars value={b.avg} /> <span className="tiny">{b.avg.toFixed(1)}</span></td>
                    <td className="num" data-label="Verified reviews">{b.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reviews.some((r) => r.sample) && <p className="tiny" style={{ marginTop: 8 }}>The first two reviews are demo data <Src kind="simulated" />.</p>}
      </div>

      {canWrite ? (
        <div className="card stack" style={{ gap: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Review a buyer you sold to</div>
          {writing ? <BuyerReviewForm known={known} offline={access.mode === 'offline'} onCancel={() => setWriting(false)} onSubmit={async (d) => { await submit(d); setWriting(false); setDone('Thank you. Your review is waiting for the Sangam team to match it to the order.'); }} /> : (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn primary" style={{ visibility: 'visible' }} onClick={() => { setWriting(true); setDone(''); }}>Write a review</button>
              {done && <span className="small" role="status">{done}</span>}
            </div>
          )}
        </div>
      ) : (
        <div className="note">{access.role === 'buyer' ? 'Buyers review suppliers on the first tab. Here you can see how suppliers rate buyers, including you.' : 'Sign in as a supplier to review a buyer.'}</div>
      )}

      {mine.length > 0 && (
        <div className="card">
          <div className="section-title">Your reviews waiting for a check</div>
          <div className="stack" style={{ gap: 10 }}>{mine.map((r) => <ReviewRow key={r.id} r={r} />)}</div>
        </div>
      )}

      {access.isTeam && access.mode === 'server' && (
        <div className="card">
          <div className="section-title">Sangam team: reviews of buyers to check ({toCheck.length})</div>
          {toCheck.length === 0 ? <p className="small muted">Nothing waiting.</p> : (
            <div className="stack" style={{ gap: 12 }}>
              {toCheck.map((r) => <TeamRow key={r.id} r={r} onDecide={(s, note) => decide(r.id, s, note)} />)}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="section-title">Latest verified reviews</div>
        <div className="stack" style={{ gap: 12 }}>{verified.map((r) => <ReviewRow key={r.id} r={r} />)}</div>
      </div>
    </>
  );
}

function ReviewRow({ r }: { r: BuyerReview }) {
  return (
    <div className="rv-item">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span><b>{r.buyerName}</b> <span className="tiny">by {r.author}</span></span>
        <span className="row" style={{ gap: 8 }}><Stars value={overall(r)} />{r.status !== 'verified' && <span className={`chip ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>}</span>
      </div>
      <p className="small" style={{ marginTop: 4 }}>{r.text}</p>
      <div className="tiny">{DIMS.map((d) => `${d.label} ${r.ratings[d.key]}`).join(' · ')} · order {r.orderRef} {r.sample && <Src kind="simulated" />}</div>
      {r.verifierNote && <div className="tiny">Sangam team: {r.verifierNote}</div>}
    </div>
  );
}

function TeamRow({ r, onDecide }: { r: BuyerReview; onDecide: (s: 'verified' | 'rejected', note?: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (s: 'verified' | 'rejected') => { setBusy(true); try { await onDecide(s, note); } finally { setBusy(false); } };
  return (
    <div className="rv-item">
      <ReviewRow r={r} />
      <div className="tiny" style={{ marginTop: 4 }}>Order value ₹{r.orderValueLakh} lakh · evidence: {r.evidence}</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" style={{ flex: '1 1 200px' }} />
        <button className="btn small" disabled={busy} style={{ visibility: 'visible' }} onClick={() => go('verified')}>Matches the order</button>
        <button className="btn small ghost" disabled={busy} style={{ visibility: 'visible', color: 'var(--danger)' }} onClick={() => go('rejected')}>Reject</button>
      </div>
    </div>
  );
}

function BuyerReviewForm({ known, offline, onSubmit, onCancel }: { known: string[]; offline: boolean; onSubmit: (d: Draft) => Promise<void>; onCancel: () => void }) {
  const [buyerName, setBuyerName] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [value, setValue] = useState(10);
  const [ratings, setRatings] = useState<Draft['ratings']>({ payment: 4, specs: 4, terms: 4, communication: 4 });
  const [text, setText] = useState('');
  const [evidence, setEvidence] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = buyerName.trim().length > 1 && orderRef.trim().length > 2 && text.trim().length > 9 && evidence.trim().length > 2;
  const send = async () => { setErr(''); setBusy(true); try { await onSubmit({ buyerName: buyerName.trim(), orderRef: orderRef.trim(), orderValueLakh: value, ratings, text: text.trim(), evidence: evidence.trim() }); } catch (e) { setErr((e as Error).message); setBusy(false); } };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="form-grid">
        <label className="field">Buyer you sold to<input list="rv-buyers" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Company name" /></label>
        <datalist id="rv-buyers">{known.map((k) => <option key={k} value={k} />)}</datalist>
        <label className="field">Purchase order or contract number<input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="PO-2026-0412" /></label>
        <label className="field">Order value (₹ lakh)<input type="number" min={0} value={value} onChange={(e) => setValue(Number(e.target.value))} /></label>
        <label className="field">Evidence of the order<input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Invoice or goods receipt number" /></label>
      </div>
      <div className="form-grid">
        {DIMS.map((d) => (
          <label key={d.key} className="field">{d.label}
            <select value={ratings[d.key]} onChange={(e) => setRatings({ ...ratings, [d.key]: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {'★'.repeat(n)}</option>)}</select>
          </label>
        ))}
      </div>
      <label className="field">What went well, what didn&apos;t<textarea value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div className="note">Reviews are published only after the Sangam team matches them to a real order. {offline ? 'You are in the offline demo, so this review stays in this browser tab.' : ''}</div>
      {err && <div className="note warn" role="alert">{err}</div>}
      <div className="row"><button className="btn primary" disabled={!ok || busy} style={{ visibility: 'visible' }} onClick={send}>Submit for verification</button><button className="btn" style={{ visibility: 'visible' }} onClick={onCancel}>Cancel</button></div>
    </div>
  );
}
