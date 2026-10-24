import { useState } from 'react';
import { bom, buyer, sellers } from '../data';
import { district, isRural } from '../engine';
import { useStore } from '../store';
import FairWorkBadge from '../components/FairWorkBadge';
import Src from '../components/Src';
import CredentialCard from './CredentialCard';
import { useSupplierWork, workforceProvenance } from './fairwork-link';
import { issue, useLedger } from './ledger';

const LEVELS = ['Trainee', 'Skilled', 'Highly skilled', 'Supervisor'];
const workerId = () => `W-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export default function PassportPage() {
  const { state } = useStore();
  const ledger = useLedger();
  // Opens on the supplier most recently signed for, so "See the signed credential" lands on it
  const [sellerId, setSellerId] = useState(() => {
    const last = ledger.credentials.find((c) => sellers.some((x) => x.id === c.subject.supplierId));
    return (last?.subject.supplierId as string | undefined) ?? sellers[0]?.id ?? '';
  });
  const s = sellers.find((x) => x.id === sellerId) ?? sellers[0];
  const [form, setForm] = useState({ workerId: workerId(), skill: s?.process ?? '', level: 'Skilled', trainingHours: 40 });
  const [busy, setBusy] = useState(false);
  const work = useSupplierWork(s?.id ?? '', s?.name ?? '');
  if (!s) return null;

  const mine = ledger.credentials.filter((c) => c.subject.supplierId === s.id);
  const awarded = state.requirements.filter((r) => r.sector === state.sector && r.status === 'awarded').flatMap((r) => {
    const q = state.quotes.find((x) => x.id === r.awardedQuoteId);
    const inDeal = q && (q.bidder.kind === 'seller' ? q.bidder.id === s.id : state.consortia.find((c) => c.id === q.bidder.id)?.members.some((m) => m.sellerId === s.id && m.status === 'accepted'));
    return q && inDeal ? [{ r, q }] : [];
  });
  const signed = new Set(mine.filter((c) => c.type === 'ContractCredential').map((c) => c.subject.reqId));

  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const issueSkill = () => run(async () => {
    await issue('SkillCredential', { supplierId: s.id, supplierName: s.name, district: district(s.districtId).name, ...form });
    setForm((f) => ({ ...f, workerId: workerId() }));
  });
  const issueContract = (reqId: string) => run(async () => {
    const a = awarded.find((x) => x.r.id === reqId)!;
    await issue('ContractCredential', {
      supplierId: s.id, supplierName: s.name, reqId, buyer: buyer.name, part: bom.find((l) => l.id === a.r.lineId)?.name ?? a.r.title,
      unitPrice: a.q.unitPrice, monthlyVolume: a.r.monthlyVolume, district: district(s.districtId).name,
    });
  });

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Skill Passports</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Signed records a worker or supplier can carry anywhere: skills, fair-work audits and contracts. Anyone can check them; nobody can quietly change them. Workers appear only by an ID, never by name, phone or Aadhaar.
        </p>
      </div>

      <div className="card row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="small">Supplier{' '}
          <select value={s.id} onChange={(e) => { const n = sellers.find((x) => x.id === e.target.value); setSellerId(e.target.value); setForm((f) => ({ ...f, skill: n?.process ?? f.skill })); }} style={{ fontSize: 13 }}>
            {sellers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <span className="tiny">{s.type} · {district(s.districtId).name}, {district(s.districtId).state} · {s.workers.toLocaleString('en-IN')} workers{isRural(s) ? ' · rural collective' : ''}</span>
        <span style={{ marginLeft: 'auto' }} className="row">
          {work ? <><FairWorkBadge score={work.score} /> <Src kind={workforceProvenance(work.source)} /></> : <span className="tiny muted">No workforce profile yet</span>}
        </span>
      </div>

      <div className="grid-2">
        <div className="card stack" style={{ gap: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>Record a worker's skill</div>
          <p className="tiny">The supplier vouches for the skill; Sangam signs it. A worker keeps the record when they change jobs.</p>
          <div className="form-grid">
            <label className="field"><span>Worker ID</span><input value={form.workerId} onChange={(e) => setForm({ ...form, workerId: e.target.value })} /></label>
            <label className="field"><span>Skill</span><input value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} /></label>
            <label className="field"><span>Level</span><select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
            <label className="field"><span>Training hours</span><input type="number" min={0} value={form.trainingHours} onChange={(e) => setForm({ ...form, trainingHours: Number(e.target.value) })} /></label>
          </div>
          <div><button className="btn small primary" disabled={busy || !form.skill || !form.workerId} onClick={issueSkill}>Sign skill credential</button></div>
        </div>

        <div className="card stack" style={{ gap: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>Contracts won ({awarded.length})</div>
          {awarded.length === 0 ? <p className="small muted">No awarded contracts for this supplier yet. When a buyer awards one, sign it here so the supplier can show it to the next buyer.</p> : awarded.map(({ r, q }) => (
            <div key={r.id} className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <span className="small">{r.title} · ₹{q.unitPrice.toLocaleString('en-IN')} a unit · {r.monthlyVolume.toLocaleString('en-IN')} a month</span>
              {signed.has(r.id) ? <span className="chip ready">Signed</span> : <button className="btn small" disabled={busy} onClick={() => issueContract(r.id)}>Sign contract credential</button>}
            </div>
          ))}
          <p className="tiny">Fair-work audit credentials are signed on the Verification desk when the Auditor Agent's check passes or a person approves it.</p>
        </div>
      </div>

      <div className="card">
        <div className="section-title">{s.name}'s credentials ({mine.length})</div>
        {mine.length === 0 ? <p className="small muted">Nothing signed yet.</p> : mine.map((c) => <CredentialCard key={c.id} c={c} />)}
      </div>
    </div>
  );
}
