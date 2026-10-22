import { useState } from 'react';
import { useStore } from '../store';
import { now, uid } from '../model';
import type { Review } from '../model';

const DIMS: (keyof Review['ratings'])[] = ['quality', 'delivery', 'communication', 'compliance'];

/** Review a supplier after an order. It stays pending until the Sangam team checks the order evidence. */
export default function ReviewForm({ sellerId, defaultAuthor, defaultType = 'buyer', onDone }: { sellerId: string; defaultAuthor: string; defaultType?: Review['authorType']; onDone: () => void }) {
  const { update } = useStore();
  const [author, setAuthor] = useState(defaultAuthor);
  const [authorType, setAuthorType] = useState<Review['authorType']>(defaultType);
  const [orderRef, setOrderRef] = useState('');
  const [value, setValue] = useState(10);
  const [ratings, setRatings] = useState<Review['ratings']>({ quality: 4, delivery: 4, communication: 4, compliance: 4 });
  const [text, setText] = useState('');
  const [evidence, setEvidence] = useState('');
  const ok = orderRef.trim().length > 2 && text.trim().length > 10 && evidence;

  const submit = () => {
    update((s) => ({ ...s, reviews: [...s.reviews, { id: uid('rv'), sellerId, author, authorType, orderRef, orderValueLakh: value, ratings, text, evidence, status: 'pending', at: now() }] }));
    onDone();
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="form-grid">
        <label className="field">Your organisation<input value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
        <label className="field">You are a<select value={authorType} onChange={(e) => setAuthorType(e.target.value as Review['authorType'])}><option value="buyer">Buyer</option><option value="partner">Partner (consortium or subcontract)</option></select></label>
        <label className="field">Purchase order or contract number<input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="PO-2026-0412" /></label>
        <label className="field">Order value (₹ lakh)<input type="number" min={0} value={value} onChange={(e) => setValue(Number(e.target.value))} /></label>
      </div>
      <div className="form-grid">
        {DIMS.map((d) => (
          <label key={d} className="field" style={{ textTransform: 'capitalize' }}>{d}
            <select value={ratings[d]} onChange={(e) => setRatings({ ...ratings, [d]: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {'★'.repeat(n)}</option>)}
            </select>
          </label>
        ))}
      </div>
      <label className="field">What went well, what didn't<textarea value={text} onChange={(e) => setText(e.target.value)} /></label>
      <label className="field">Evidence of the order (PO, invoice or goods receipt; checked by the Sangam team)
        <input type="file" onChange={(e) => setEvidence(e.target.files?.[0]?.name ?? '')} />
      </label>
      <div className="note">Reviews are published only after the Sangam team matches them to a real order. Until then they don't count towards the trust score.</div>
      <div className="row"><button className="btn primary" disabled={!ok} onClick={submit}>Submit for verification</button><button className="btn" onClick={onDone}>Cancel</button></div>
    </div>
  );
}
