import { useState } from 'react';
import { bom, buyer, certGaps, districts, processes, sellers, unitLabel } from '../data';
import { now, uid } from '../model';
import type { DocItem, OnboardedSeller } from '../model';
import { useStore } from '../store';
import { checksFor } from '../trust';
import { useUi } from '../ui';
import type { CertDetail, OrgType } from '../types';

const TYPES: OrgType[] = ['MSME', 'SHG federation', 'FPO', 'Cooperative'];

const toBase64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1] ?? '');
  r.onerror = rej;
  r.readAsDataURL(f);
});

export default function ProfilePage() {
  const { state, update } = useStore();
  const { actingSeller, setActingSeller, openSupplier } = useUi();
  const current = state.onboarded.find((o) => o.id === actingSeller);
  const demo = sellers.find((s) => s.id === actingSeller && s.origin === 'simulated');
  const [creating, setCreating] = useState(!current && !demo);

  if (demo && !creating) {
    return (
      <div className="stack">
        <h1 className="lead">Profile and documents</h1>
        <div className="card stack" style={{ gap: 10 }}>
          <p><b>{demo.name}</b> is a demo company with a simulated profile.</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => openSupplier(demo.id)}>View its profile</button>
            <button className="btn primary" onClick={() => setCreating(true)}>Register your own company</button>
          </div>
        </div>
      </div>
    );
  }
  return <ProfileForm existing={creating ? undefined : current} onSaved={(id) => { setActingSeller(id); setCreating(false); }} key={current?.id ?? 'new'} stateSector={state.sector} update={update} />;
}

function ProfileForm({ existing, onSaved, stateSector, update }: { existing?: OnboardedSeller; onSaved: (id: string) => void; stateSector: OnboardedSeller['sector']; update: ReturnType<typeof useStore>['update'] }) {
  const { state } = useStore();
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<OrgType>(existing?.type ?? 'MSME');
  const [districtId, setDistrictId] = useState(existing?.districtId ?? districts[0].id);
  const [process, setProcess] = useState(existing?.process ?? processes[0]?.name ?? '');
  const line = bom.find((l) => l.process === process);
  const [capacity, setCapacity] = useState(existing?.monthlyCapacity ?? Math.round(buyer.monthlyUnits / 2));
  const [workers, setWorkers] = useState(existing?.workers ?? 50);
  const [price, setPrice] = useState(existing && line ? Math.round(existing.priceIndex * line.cost) : Math.round(line?.cost ?? 0));
  const [machines, setMachines] = useState(existing?.details.machines.join(', ') ?? '');
  const [about, setAbout] = useState(existing?.details.about ?? '');
  const [languages, setLanguages] = useState(existing?.details.languages.join(', ') ?? 'Hindi, English');
  const [years, setYears] = useState(existing?.details.yearsInBusiness ?? 3);
  const [certs, setCerts] = useState<CertDetail[]>(existing?.details.certDetails ?? []);
  const [docs, setDocs] = useState<DocItem[]>(existing?.docs ?? []);
  const [reading, setReading] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const known = [...new Set([...Object.keys(certGaps), ...bom.flatMap((l) => l.requiredCerts)])];

  const addDoc = async (f: File, readWithAi: boolean) => {
    const doc: DocItem = { name: f.name, kind: f.type || 'file', size: f.size };
    if (readWithAi) {
      setReading(f.name); setMsg('');
      try {
        const r = await fetch('/api/extract-certificate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaType: f.type, data: await toBase64(f), filename: f.name }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
        doc.extracted = j.fields;
        const label = j.fields.standard || j.fields.documentType;
        if (label) setCerts((c) => [...c.filter((x) => x.name !== label), { name: label, issuer: j.fields.issuer || 'Unknown issuer', expires: j.fields.expiryDate || '' }]);
        setMsg(`Read ${f.name}: ${j.fields.documentType}${j.fields.expiryDate ? `, expires ${j.fields.expiryDate}` : ''} (confidence ${j.fields.confidence}). Check the details below.`);
      } catch (e) {
        setMsg(`Could not read ${f.name} with AI: ${(e as Error).message}. The file is attached; add the certificate details by hand.`);
      } finally {
        setReading(null);
      }
    }
    setDocs((d) => [...d.filter((x) => x.name !== f.name), doc]);
  };

  const save = () => {
    const id = existing?.id ?? uid('sup');
    const seller: OnboardedSeller = {
      id, name, type, districtId, process, monthlyCapacity: capacity, workers, sector: stateSector, docs,
      certs: certs.map((c) => c.name), priceIndex: line ? +(price / line.cost).toFixed(3) : 1, quality: existing?.quality ?? 0.8, verification: 'declared', origin: 'onboarded',
      details: {
        yearsInBusiness: years, turnoverCr: existing?.details.turnoverCr ?? 0, creditBand: 'Not rated', utilisationPct: existing?.details.utilisationPct ?? 60,
        defectPpm: existing?.details.defectPpm ?? 2000, otifPct: existing?.details.otifPct ?? 85, completedOrders: existing?.details.completedOrders ?? 0,
        machines: machines.split(',').map((x) => x.trim()).filter(Boolean), certDetails: certs, languages: languages.split(',').map((x) => x.trim()).filter(Boolean), about,
      },
    };
    update((s) => ({
      ...s,
      onboarded: [...s.onboarded.filter((o) => o.id !== id), seller],
      verifications: { ...s.verifications, [id]: { identity: s.verifications[id]?.identity ?? 'pending', capacity: 'pending', certs: Object.fromEntries(certs.map((c) => [c.name, s.verifications[id]?.certs[c.name] ?? 'pending'])), requestedAt: now() } },
    }));
    onSaved(id);
  };

  const checks = existing ? checksFor(existing, state) : null;

  return (
    <div className="stack">
      <div>
        <h1 className="lead">{existing ? `Profile: ${existing.name}` : 'Register your company'}</h1>
        <p className="muted" style={{ marginTop: 6 }}>Buyers see what you enter, marked "self-declared" until the Sangam team checks it. Verified details raise your trust score and your place in matches.</p>
      </div>
      {checks && (
        <div className="note">Verification: identity {checks.identity}, capacity {checks.capacity}, certificates {Object.values(checks.certs).filter((c) => c === 'verified').length} of {Object.keys(checks.certs).length} verified.</div>
      )}
      <div className="card stack" style={{ gap: 14 }}>
        <div className="form-grid">
          <label className="field">Organisation name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field">Type<select value={type} onChange={(e) => setType(e.target.value as OrgType)}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="field">District<select value={districtId} onChange={(e) => setDistrictId(e.target.value)}>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}, {d.state}</option>)}</select></label>
          <label className="field">Main process<select value={process} onChange={(e) => setProcess(e.target.value)}>{processes.map((p) => <option key={p.name}>{p.name}</option>)}</select></label>
          <label className="field">Capacity a month (in {unitLabel()}&apos; worth)<input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></label>
          <label className="field">Workers / members<input type="number" min={1} value={workers} onChange={(e) => setWorkers(Number(e.target.value))} /></label>
          <label className="field">Your typical price for this part (₹){line && <span className="tiny">Today buyers pay about ₹{line.cost.toLocaleString('en-IN')}</span>}<input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
          <label className="field">Years in business<input type="number" min={0} value={years} onChange={(e) => setYears(Number(e.target.value))} /></label>
        </div>
        <label className="field">Machines and equipment (comma separated)<input value={machines} onChange={(e) => setMachines(e.target.value)} placeholder="Crimping machines, test bench, ..." /></label>
        <label className="field">About you<textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder="What you make, for whom, and what makes you good at it" /></label>
        <label className="field">Languages (comma separated)<input value={languages} onChange={(e) => setLanguages(e.target.value)} /></label>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Certificates and documents</div>
        <div className="toggle-row">
          {known.map((c) => {
            const has = certs.some((x) => x.name === c);
            return <button key={c} className={`pill ${has ? 'on' : ''}`} onClick={() => setCerts(has ? certs.filter((x) => x.name !== c) : [...certs, { name: c, issuer: '', expires: '' }])}>{c}</button>;
          })}
        </div>
        {certs.length > 0 && (
          <table>
            <thead><tr><th>Certificate</th><th>Issuer</th><th>Expires</th></tr></thead>
            <tbody>
              {certs.map((c, i) => (
                <tr key={c.name}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td><input className="cell" value={c.issuer} onChange={(e) => setCerts(certs.map((x, j) => (j === i ? { ...x, issuer: e.target.value } : x)))} /></td>
                  <td><input className="cell" type="date" value={c.expires} onChange={(e) => setCerts(certs.map((x, j) => (j === i ? { ...x, expires: e.target.value } : x)))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label className="btn small">Attach a document<input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void addDoc(f, false); }} /></label>
          <label className="btn small primary">{reading ? `Reading ${reading}…` : 'Upload a certificate and read it with AI'}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" style={{ display: 'none' }} disabled={!!reading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void addDoc(f, true); }} /></label>
        </div>
        {msg && <p className="small">{msg}</p>}
        {docs.length > 0 && <p className="tiny">On file: {docs.map((d) => `${d.name}${d.extracted ? ' (read by AI)' : ''}`).join(', ')}. The Sangam team checks documents against the issuing body before marking them verified.</p>}
      </div>

      <div><button className="btn primary" disabled={!name.trim() || capacity <= 0} onClick={save}>{existing ? 'Save changes' : 'Register and request verification'}</button></div>
    </div>
  );
}
