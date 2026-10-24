import { useState } from 'react';
import { bom, sellers } from '../data';
import { district } from '../engine';
import type { Check } from '../model';
import { useStore } from '../store';
import { useUi } from '../ui';
import Stars from '../components/Stars';
import Src from '../components/Src';
import { CATEGORY_LABEL, decideFlag, resolveGrievance, useLedger } from './ledger';

const sellerName = (id: string) => sellers.find((s) => s.id === id)?.name ?? id;

export default function VerificationDesk() {
  const { state, update } = useStore();
  const { openSupplier } = useUi();
  const ledger = useLedger();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const flags = ledger.flags.filter((f) => f.status === 'open');
  const grievances = ledger.grievances.filter((g) => g.status === 'open');
  const onboarded = state.onboarded.filter((o) => o.sector === state.sector);
  const reviews = state.reviews.filter((r) => r.status === 'pending' && sellers.some((s) => s.id === r.sellerId));
  const milestones = state.projects.filter((p) => p.sector === state.sector).flatMap((p) => p.milestones.filter((m) => m.status === 'submitted').map((m) => ({ p, m })));

  const setCheck = (id: string, field: 'identity' | 'capacity', v: Check) => update((s) => ({ ...s, verifications: { ...s.verifications, [id]: { ...s.verifications[id], [field]: v } } }));
  const setCert = (id: string, cert: string, v: Check) => update((s) => ({ ...s, verifications: { ...s.verifications, [id]: { ...s.verifications[id], certs: { ...s.verifications[id].certs, [cert]: v } } } }));
  const decideReview = (id: string, v: 'verified' | 'rejected') => update((s) => ({ ...s, reviews: s.reviews.map((r) => (r.id === id ? { ...r, status: v, verifierNote: notes[id] || (v === 'verified' ? 'Matched to purchase order and goods receipt.' : 'Could not match to an order.') } : r)) }));
  const decideMilestone = (pid: string, mid: string, ok: boolean) => update((s) => ({ ...s, projects: s.projects.map((p) => (p.id !== pid ? p : { ...p, milestones: p.milestones.map((m) => (m.id === mid ? { ...m, status: ok ? 'verified' : 'doing' } : m)) })) }));

  const Buttons = ({ value, onSet }: { value: Check; onSet: (v: Check) => void }) => (
    <span className="toggle-row" style={{ gap: 4 }}>
      <button className={`pill ${value === 'verified' ? 'on' : ''}`} onClick={() => onSet('verified')}>Verify</button>
      <button className={`pill danger ${value === 'rejected' ? 'on' : ''}`} onClick={() => onSet('rejected')}>Reject</button>
    </span>
  );

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Verification desk</h1>
        <p className="muted" style={{ marginTop: 6 }}>The Sangam team checks claims before they count. Verified facts raise trust scores; nothing self-declared is shown to buyers as verified.</p>
      </div>

      <div className="card">
        <div className="section-title">Auditor flags ({flags.length})</div>
        <p className="tiny">The Auditor Agent passes clean deals on its own. Anything it is unsure about, and every report of child or forced labour, waits here for a person. Approving signs a fair-work audit credential.</p>
        {flags.length === 0 && <p className="small muted">Nothing waiting.</p>}
        {flags.map((f) => (
          <div key={f.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }} className="stack">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span><button className="linkish" style={{ fontWeight: 600 }} onClick={() => openSupplier(f.sellerId)}>{sellerName(f.sellerId)}</button> <span className="chip potential">{f.raisedBy}</span></span>
              <span className="tiny">{new Date(f.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <p className="small">{f.reason}</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input placeholder="What you checked" value={notes[f.id] ?? ''} onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })} style={{ flex: 1, minWidth: 200, font: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
              <button className="btn small primary" onClick={() => void decideFlag(f.id, 'approved', notes[f.id] || 'Checked on site; no breach found.')}>Approve and sign</button>
              <button className="btn small danger" onClick={() => void decideFlag(f.id, 'blocked', notes[f.id] || 'Breach confirmed.')}>Block the deal</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-title">Worker grievances ({grievances.length} open)</div>
        <p className="tiny">Anonymous reports from workers. While one is open, the supplier's Fair Work grade drops one step.</p>
        {grievances.length === 0 && <p className="small muted">No open reports.</p>}
        {grievances.map((g) => (
          <div key={g.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }} className="stack">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span><b>{CATEGORY_LABEL[g.category]}</b> at <button className="linkish" onClick={() => openSupplier(g.sellerId)}>{sellerName(g.sellerId)}</button></span>
              <span className="tiny">Ref {g.id.toUpperCase()} · {new Date(g.at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
            </div>
            {g.text && <p className="small">{g.text}</p>}
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <input placeholder="How it was resolved" value={notes[g.id] ?? ''} onChange={(e) => setNotes({ ...notes, [g.id]: e.target.value })} style={{ flex: 1, minWidth: 200, font: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
              <button className="btn small" disabled={!notes[g.id]} onClick={() => resolveGrievance(g.id, notes[g.id])}>Mark resolved</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="section-title">New companies ({onboarded.length})</div>
        {onboarded.length === 0 ? <p className="small muted">No companies registered in this sector yet. Register one under Supplier → Profile and documents.</p> : onboarded.map((o) => {
          const v = state.verifications[o.id];
          return (
            <div key={o.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div><button className="linkish" style={{ fontWeight: 600 }} onClick={() => openSupplier(o.id)}>{o.name}</button><div className="tiny">{o.type} · {district(o.districtId).name} · {o.process} · {o.monthlyCapacity.toLocaleString('en-IN')} a month · documents: {o.docs.map((d) => d.name).join(', ') || 'none'}</div></div>
              </div>
              {v && (
                <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                  <div className="row small" style={{ justifyContent: 'space-between' }}><span>Identity (Udyam, GST, PAN)</span><Buttons value={v.identity} onSet={(x) => setCheck(o.id, 'identity', x)} /></div>
                  <div className="row small" style={{ justifyContent: 'space-between' }}><span>Capacity (site visit or photos)</span><Buttons value={v.capacity} onSet={(x) => setCheck(o.id, 'capacity', x)} /></div>
                  {Object.keys(v.certs).map((c) => {
                    const doc = o.docs.find((d) => d.extracted && ((d.extracted.standard || d.extracted.documentType) === c));
                    return (
                      <div key={c} className="row small" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <span>{c}{doc && <span className="tiny"> · AI read: no. {doc.extracted!.certificateNumber || '?'}, issuer {doc.extracted!.issuer || '?'}, expires {doc.extracted!.expiryDate || '?'} ({doc.extracted!.confidence} confidence){doc.extracted!.notes ? `, note: ${doc.extracted!.notes}` : ''}</span>}</span>
                        <Buttons value={v.certs[c]} onSet={(x) => setCert(o.id, c, x)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="section-title">Reviews waiting for an order check ({reviews.length})</div>
        {reviews.length === 0 && <p className="small muted">Nothing waiting.</p>}
        {reviews.map((r) => {
          const s = sellers.find((x) => x.id === r.sellerId)!;
          return (
            <div key={r.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }} className="stack">
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <span><b>{r.author}</b> ({r.authorType}) on <button className="linkish" onClick={() => openSupplier(s.id)}>{s.name}</button> {r.sample && <Src kind="simulated" />}</span>
                <Stars value={(r.ratings.quality + r.ratings.delivery + r.ratings.communication + r.ratings.compliance) / 4} />
              </div>
              <p className="small">{r.text}</p>
              <div className="tiny">Order {r.orderRef}, ₹{r.orderValueLakh} lakh · evidence: {r.evidence || 'none attached'}</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <input placeholder="Note (optional)" value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} style={{ flex: 1, minWidth: 200, font: 'inherit', fontSize: 13, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
                <button className="btn small primary" onClick={() => decideReview(r.id, 'verified')}>Matches an order: publish</button>
                <button className="btn small danger" onClick={() => decideReview(r.id, 'rejected')}>Reject</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="section-title">Development milestones with evidence ({milestones.length})</div>
        {milestones.length === 0 && <p className="small muted">Nothing waiting. Suppliers submit evidence from Development projects.</p>}
        {milestones.map(({ p, m }) => {
          const s = sellers.find((x) => x.id === p.sellerId);
          return (
            <div key={m.id} className="row" style={{ borderTop: '1px solid var(--line)', padding: '10px 0', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span className="small"><b>{s?.name}</b>: {m.label} for {bom.find((l) => l.id === p.lineId)?.name.toLowerCase()} · evidence {m.evidence}</span>
              <span className="row" style={{ gap: 6 }}><button className="btn small primary" onClick={() => decideMilestone(p.id, m.id, true)}>Verify</button><button className="btn small" onClick={() => decideMilestone(p.id, m.id, false)}>Send back</button></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
