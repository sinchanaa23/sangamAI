import { useEffect, useState } from 'react';
import { KIND_LABEL } from './vc';
import type { Credential, VerifyResult } from './vc';
import { useLedger, verify } from './ledger';
import { CHECK_INPUT } from './CredentialCard';

/** Change one character inside the signed contents, the way a forger would. */
function tamper(text: string): string {
  try {
    const c = JSON.parse(text) as Credential;
    const [k, v] = Object.entries(c.subject).find(([, x]) => typeof x === 'number' || (typeof x === 'string' && x.length > 0)) ?? [];
    if (!k) return text;
    c.subject[k] = typeof v === 'number' ? v + 1 : `${(v as string).slice(0, -1)}${(v as string).endsWith('X') ? 'Y' : 'X'}`;
    return JSON.stringify(c, null, 2);
  } catch { return text.replace(/\d/, (d) => String((Number(d) + 1) % 10)); }
}

export default function VerifyPage() {
  const ledger = useLedger();
  const [text, setText] = useState(() => sessionStorage.getItem(CHECK_INPUT) ?? '');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [parsed, setParsed] = useState<Credential | null>(null);

  const check = async (t = text) => {
    let c: unknown = null;
    try { c = JSON.parse(t); } catch { /* reported as malformed below */ }
    setParsed(c && typeof c === 'object' ? (c as Credential) : null);
    setResult(await verify(c));
  };
  // A credential handed over from the Skill Passports page is checked on arrival
  useEffect(() => { if (text) void check(); sessionStorage.removeItem(CHECK_INPUT); }, []);

  const load = (t: string) => { setText(t); void check(t); };

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Check a credential</h1>
        <p className="muted" style={{ marginTop: 6 }}>Paste a Sangam credential to see whether it is genuine. A buyer abroad can do this without trusting the supplier or calling anyone.</p>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <label className="field"><span>Credential (JSON)</span>
          <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} style={{ minHeight: 220, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12 }} placeholder='{"type": "SkillCredential", ...}' />
        </label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small primary" disabled={!text.trim()} onClick={() => check()}>Check</button>
          <button className="btn small" disabled={!ledger.credentials.length} onClick={() => load(JSON.stringify(ledger.credentials[0], null, 2))}>Use the latest credential</button>
          <button className="btn small" disabled={!text.trim()} onClick={() => load(tamper(text))} title="Edits one value in the signed contents">Change one character</button>
          <label className="btn small">Open a file<input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await f.text()); }} /></label>
        </div>
      </div>

      {result && (
        <div className="card" style={{ borderLeft: `4px solid var(--${result.ok ? 'ready' : 'danger'})` }}>
          <div className="section-title" style={{ color: `var(--${result.ok ? 'ready' : 'danger'})` }}>
            {result.ok ? 'Genuine: signed by Sangam and unchanged' : result.reason === 'tampered' ? 'Changed after signing' : result.reason === 'unknown-issuer' ? 'Not signed by Sangam' : 'Not a credential'}
          </div>
          <p className="small">{result.ok ? `Signed with the key "${result.key.label}" (${result.key.alg}).` : result.detail}</p>
          {parsed?.subject && (
            <table style={{ marginTop: 8 }}>
              <tbody>
                <tr><td className="muted">Type</td><td>{KIND_LABEL[parsed.type] ?? String(parsed.type)}</td></tr>
                <tr><td className="muted">Issued</td><td>{parsed.issuedAt}</td></tr>
                {Object.entries(parsed.subject).map(([k, v]) => <tr key={k}><td className="muted">{k}</td><td>{String(v)}</td></tr>)}
              </tbody>
            </table>
          )}
        </div>
      )}
      <p className="tiny">Until the shared server is running, credentials are signed with a demo key kept in this browser, so they check as genuine only here. Signed by the server, they check anywhere.</p>
    </div>
  );
}
