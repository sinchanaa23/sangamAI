import { useEffect, useState } from 'react';
import { download } from '../csv';
import { useUi } from '../ui';
import { KIND_LABEL } from './vc';
import type { Credential } from './vc';
import { verify } from './ledger';

/** Hands a credential to the Check a credential page. */
export const CHECK_INPUT = 'sangam-check-input';

const show = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('en-IN') : String(v));
const LABELS: Record<string, string> = {
  supplierName: 'Supplier', workerId: 'Worker ID', skill: 'Skill', level: 'Level', trainingHours: 'Training hours',
  district: 'District', part: 'Part', buyer: 'Buyer', unitPrice: 'Unit price (₹)', monthlyVolume: 'Monthly volume', outcome: 'Outcome', reviewNote: 'Review note', grade: 'Fair Work grade',
};

export default function CredentialCard({ c }: { c: Credential }) {
  const { go } = useUi();
  const [state, setState] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [keyLabel, setKeyLabel] = useState('');
  useEffect(() => { void verify(c).then((r) => { setState(r.ok ? 'valid' : 'invalid'); setKeyLabel(r.ok ? r.key.label : ''); }); }, [c]);

  const fields = Object.entries(c.subject).filter(([k, v]) => LABELS[k] && v !== undefined && v !== '');
  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }} className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span><b>{KIND_LABEL[c.type]} credential</b> <span className="tiny">issued {new Date(c.issuedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
        <span className={`chip ${state === 'valid' ? 'ready' : state === 'invalid' ? 'danger' : 'plain'}`} title={keyLabel ? `Signed with: ${keyLabel}` : undefined}>
          {state === 'valid' ? 'Signature valid' : state === 'invalid' ? 'Signature invalid' : 'Checking…'}
        </span>
      </div>
      <div className="small">{fields.map(([k, v]) => <span key={k} style={{ marginRight: 14 }}><span className="muted">{LABELS[k]}:</span> {show(v)}</span>)}</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="btn small" onClick={() => download(`${KIND_LABEL[c.type].toLowerCase().replace(/\W+/g, '-')}-${c.id.slice(-8)}.json`, JSON.stringify(c, null, 2), 'application/json')}>Download</button>
        <button className="btn small" onClick={() => { void navigator.clipboard?.writeText(JSON.stringify(c, null, 2)); }}>Copy</button>
        <button className="btn small" onClick={() => { sessionStorage.setItem(CHECK_INPUT, JSON.stringify(c, null, 2)); go('ecosystem', 'check'); }}>Check it</button>
      </div>
    </div>
  );
}
