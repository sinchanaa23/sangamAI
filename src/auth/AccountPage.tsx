// Sign in with a one-time code, then (optionally, any time) verify the business. Reached at #/account until it is linked from the app header.
import { useState } from 'react';
import { useAuth } from './AuthContext';
import type { Role } from './AuthContext';
import VerificationBadge from './VerificationBadge';
import { t } from './i18n';
import type { Lang } from './i18n';

const KINDS: Record<Role, ('gstin' | 'udyam' | 'cin')[]> = { buyer: ['gstin', 'cin'], supplier: ['udyam', 'gstin', 'cin'], ecosystem: [] };
const KIND_LABEL = { gstin: 'GSTIN', udyam: 'Udyam', cin: 'CIN' };

export default function AccountPage() {
  const { me, loading } = useAuth();
  const [lang, setLang] = useState<Lang>('en');
  const s = t(lang);
  return (
    <div className="stack" style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 64px' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="lead">{s.title}</h1>
        <button className="btn small" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>{s.language}</button>
      </div>
      {loading ? <p className="muted">…</p> : me ? <Account lang={lang} /> : <SignIn lang={lang} />}
    </div>
  );
}

function SignIn({ lang }: { lang: Lang }) {
  const { startCode, signIn } = useAuth();
  const s = t(lang);
  const [role, setRole] = useState<Role>('supplier');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [demo, setDemo] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setErr(''); setBusy(true); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };

  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p className="muted">{s.lead}</p>
      <div className="segmented" role="tablist" aria-label={s.iAm}>
        {(['supplier', 'buyer', 'ecosystem'] as Role[]).map((r) => (
          <button key={r} className={role === r ? 'on' : ''} onClick={() => { setRole(r); setSent(false); setDemo(null); setIdentifier(''); }}>{r === 'ecosystem' ? s.team : s[r]}</button>
        ))}
      </div>
      <label className="field"><span>{role === 'buyer' ? s.email : s.phone}</span>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} inputMode={role === 'buyer' ? 'email' : 'tel'} placeholder={role === 'buyer' ? 'name@company.com' : '98765 43210'} />
      </label>
      {role !== 'ecosystem' && <label className="field"><span>{s.name}</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>}
      {!sent ? (
        <button className="btn primary" disabled={busy || !identifier.trim()} onClick={() => run(async () => { const r = await startCode(role, identifier, name || undefined); setSent(true); setDemo(r.devCode ?? null); })}>{s.sendCode}</button>
      ) : (
        <>
          {demo && <div className="note">{s.demoCode} <b style={{ fontFamily: 'var(--mono)' }}>{demo}</b> <button className="btn small ghost" onClick={() => setCode(demo)}>↵</button></div>}
          <label className="field"><span>{s.code}</span><input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="one-time-code" /></label>
          <button className="btn primary" disabled={busy || code.length < 6} onClick={() => run(() => signIn(role, identifier, code, name || undefined))}>{s.signIn}</button>
        </>
      )}
      {err && <div className="note warn" role="alert">{err}</div>}
    </div>
  );
}

function Account({ lang }: { lang: Lang }) {
  const { me, signOut, verify } = useAuth();
  const s = t(lang);
  const [kind, setKind] = useState<'gstin' | 'udyam' | 'cin'>(KINDS[me!.user.role][0] ?? 'gstin');
  const [number, setNumber] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { user, verification: v } = me!;
  const kinds = KINDS[user.role];

  return (
    <>
      <div className="card stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="tiny muted">{s.signedInAs}</div>
            <b>{user.displayName}</b> <span className="tiny muted">{user.phone ?? user.email}</span>
          </div>
          <button className="btn small" onClick={() => void signOut()}>{s.signOut}</button>
        </div>
        <VerificationBadge v={v} lang={lang} />
        {v.basis === 'vouched' && <p className="tiny muted">{s.vouchedHelp}</p>}
        {v.status === 'needs-review' && <div className="note warn">{s.needsReview}</div>}
        {v.recheckDue && <p className="tiny muted">{s.recheck}</p>}
      </div>

      {kinds.length > 0 && (
        <div className="card stack" style={{ gap: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>{s.verifyTitle}</div>
          <p className="tiny muted">{s.verifySkip}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label={s.number} style={{ font: 'inherit', padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)' }}>
              {kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder={s.number} aria-label={s.number} style={{ flex: 1, minWidth: 180, font: 'inherit', padding: '8px 12px', borderRadius: 10, border: '1px solid var(--line)' }} />
            <button className="btn primary" disabled={busy || !number.trim()} onClick={async () => { setErr(''); setBusy(true); try { await verify(kind, number); setNumber(''); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }}>{s.check}</button>
          </div>
          {err && <div className="note warn" role="alert">{err}</div>}
        </div>
      )}

      {v.checks.length > 0 && (
        <div className="card stack" style={{ gap: 6 }}>
          <div className="section-title" style={{ margin: 0 }}>{s.checks}</div>
          {v.checks.map((c) => (
            <div key={c.id} className="small"><b>{c.kind.toUpperCase()}</b> · {s.results[c.result] ?? c.result} · <span className="muted">{c.summary}</span></div>
          ))}
        </div>
      )}

      {user.role === 'ecosystem' && <Vouch lang={lang} />}
    </>
  );
}

function Vouch({ lang }: { lang: Lang }) {
  const { vouch } = useAuth();
  const s = t(lang);
  const [userId, setUserId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="section-title" style={{ margin: 0 }}>{s.vouchTitle}</div>
      <p className="tiny muted">{s.vouchHelp}</p>
      <label className="field"><span>{s.accountId}</span><input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="u-1a2b3c4d" /></label>
      <label className="field"><span>{s.supplierId}</span><input value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="s13" /></label>
      <label className="field"><span>{s.note}</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="btn primary" disabled={!userId.trim()} onClick={async () => { setErr(''); setMsg(''); try { await vouch(userId.trim(), supplierId.trim(), note.trim()); setMsg('✓'); } catch (e) { setErr((e as Error).message); } }}>{s.vouch}</button>
      {msg && <div className="note">{msg}</div>}
      {err && <div className="note warn" role="alert">{err}</div>}
    </div>
  );
}
