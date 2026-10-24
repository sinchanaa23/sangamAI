import { useState } from 'react';
import { sellers } from '../data';
import { district } from '../engine';
import { CATEGORY_LABEL, reportGrievance } from './ledger';
import type { Grievance, GrievanceCategory } from './ledger';

export default function GrievancePage() {
  const [sellerId, setSellerId] = useState('');
  const [category, setCategory] = useState<GrievanceCategory | ''>('');
  const [text, setText] = useState('');
  const [done, setDone] = useState<Grievance | null>(null);

  if (done) {
    return (
      <div className="stack">
        <h1 className="lead">Thank you. Your report is in.</h1>
        <div className="card stack" style={{ gap: 8 }}>
          <p>Your reference is <b>{done.id.toUpperCase()}</b>. Keep it to ask what happened.</p>
          <p className="small muted">Nobody at your workplace sees who sent this. While the report is open, the supplier's Fair Work grade drops one step, and the Sangam team follows up with them.{done.category === 'child-or-forced' ? ' Reports of child or forced labour go straight to the Verification desk.' : ''}</p>
          <div><button className="btn small" onClick={() => { setDone(null); setSellerId(''); setCategory(''); setText(''); }}>Report something else</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Report a problem at work</h1>
        <p className="muted" style={{ marginTop: 6 }}>For workers at any Sangam supplier. You don't give your name, phone number or ID. Sangam never shares who reported.</p>
      </div>
      <div className="card stack" style={{ gap: 14, maxWidth: 640 }}>
        <label className="field"><span>Where do you work?</span>
          <select value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
            <option value="">Choose your workplace</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}, {district(s.districtId).name}</option>)}
          </select>
        </label>
        <div className="field"><span>What happened?</span>
          <div className="stack" style={{ gap: 6 }}>
            {(Object.keys(CATEGORY_LABEL) as GrievanceCategory[]).map((c) => (
              <label key={c} className="row small" style={{ gap: 8, color: 'var(--ink)' }}>
                <input type="radio" name="category" checked={category === c} onChange={() => setCategory(c)} style={{ width: 'auto' }} />{CATEGORY_LABEL[c]}
              </label>
            ))}
          </div>
        </div>
        <label className="field"><span>Tell us more (optional)</span>
          <textarea value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="What, when, and how often. Don't write your name." />
        </label>
        <div><button className="btn primary" disabled={!sellerId || !category} onClick={() => setDone(reportGrievance({ sellerId, category: category as GrievanceCategory, text }))}>Send report</button></div>
      </div>
    </div>
  );
}
