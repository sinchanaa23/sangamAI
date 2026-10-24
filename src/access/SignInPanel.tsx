// Sign in to Sangam as a buyer or a supplier (the Sangam team signs in at #/account). Built on P1's one-time-code sign-in.
// "Try as a buyer / supplier" is one click for the demo; it only works without typing because the server's mock sender
// hands the code back, and it says so ("simulated").
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { t } from '../auth/i18n';
import type { Lang } from '../auth/i18n';
import { useAccess } from './Access';
import './access.css';

type Kind = 'buyer' | 'supplier';

export default function SignInPanel({ note }: { note?: string }) {
  const { startCode, signIn } = useAuth();
  const { signInDemo } = useAccess();
  const [lang, setLang] = useState<Lang>('en');
  const s = t(lang);
  const [role, setRole] = useState<Kind>('buyer');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [offlineNote, setOfflineNote] = useState('');

  const run = async (fn: () => Promise<void>) => { setErr(''); setBusy(true); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const pick = (r: Kind) => { setRole(r); setSent(false); setDemoCode(null); setIdentifier(''); setCode(''); setErr(''); };
  const demo = (r: Kind) => run(async () => { const out = await signInDemo(r); if (out.offlineBecause) setOfflineNote(out.offlineBecause); });

  return (
    <div className="card signin" id="sign-in">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="eyebrow">{lang === 'en' ? 'Sign in' : 'साइन इन'}</div>
          <h2 className="section-title" style={{ margin: '4px 0 0', fontSize: 20 }}>{lang === 'en' ? 'Buyers and suppliers, one place to deal fairly' : 'खरीदार और आपूर्तिकर्ता, एक जगह'}</h2>
        </div>
        <button className="btn small ghost" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>{s.language}</button>
      </div>
      {note && <div className="note warn" role="status">{note}</div>}
      <p className="muted small">{s.lead}</p>

      <div className="signin-demo">
        <button className="btn primary" disabled={busy} style={{ visibility: 'visible' }} onClick={() => demo('buyer')}>{lang === 'en' ? 'Try as a buyer' : 'खरीदार के रूप में आज़माएँ'}</button>
        <button className="btn" disabled={busy} style={{ visibility: 'visible' }} onClick={() => demo('supplier')}>{lang === 'en' ? 'Try as a supplier' : 'आपूर्तिकर्ता के रूप में आज़माएँ'}</button>
        <span className="tiny">{lang === 'en' ? 'Demo accounts, simulated: no code to type.' : 'डेमो खाते (सिम्युलेटेड): कोई कोड नहीं।'}</span>
      </div>
      {offlineNote && <div className="note" role="status">{lang === 'en' ? 'Offline demo: ' : 'ऑफ़लाइन डेमो: '}{offlineNote}</div>}

      <div className="signin-or"><span>{lang === 'en' ? 'or sign in with your own account' : 'या अपने खाते से साइन इन करें'}</span></div>
      <div className="segmented" role="tablist" aria-label={s.iAm}>
        {(['buyer', 'supplier'] as Kind[]).map((r) => <button key={r} role="tab" aria-selected={role === r} className={role === r ? 'on' : ''} onClick={() => pick(r)}>{s[r]}</button>)}
      </div>
      <label className="field"><span>{role === 'buyer' ? s.email : s.phone}</span>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} inputMode={role === 'buyer' ? 'email' : 'tel'} placeholder={role === 'buyer' ? 'name@company.com' : '98765 43210'} />
      </label>
      <label className="field"><span>{s.name}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      {!sent ? (
        <button className="btn primary" disabled={busy || !identifier.trim()} style={{ visibility: 'visible' }} onClick={() => run(async () => { const r = await startCode(role, identifier, name || undefined); setSent(true); setDemoCode(r.devCode ?? null); })}>{s.sendCode}</button>
      ) : (
        <>
          {demoCode && <div className="note">{s.demoCode} <b style={{ fontFamily: 'var(--mono)' }}>{demoCode}</b> <button className="btn small ghost" onClick={() => setCode(demoCode)}>↵</button></div>}
          <label className="field"><span>{s.code}</span><input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="one-time-code" /></label>
          <button className="btn primary" disabled={busy || code.length < 6} style={{ visibility: 'visible' }} onClick={() => run(() => signIn(role, identifier, code, name || undefined))}>{s.signIn}</button>
        </>
      )}
      {err && <div className="note warn" role="alert">{err}</div>}
      <p className="tiny">{lang === 'en' ? 'Part of the Sangam team? ' : 'Sangam टीम के सदस्य? '}<a href="#/account">{lang === 'en' ? 'Team sign-in' : 'टीम साइन इन'}</a></p>
    </div>
  );
}
