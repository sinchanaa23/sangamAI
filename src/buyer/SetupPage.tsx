import { useState } from 'react';
import { active, bom, buyer, districts, processes } from '../data';
import { inr } from '../engine';
import { download, parseCsv, toCsv } from '../csv';
import { SECTOR_LIST } from '../sectors';
import { useStore } from '../store';
import type { BomLine, Buyer, SectorId } from '../types';

type Line = Omit<BomLine, 'sharePct'>;
const COUNTRIES = ['India', 'China', 'Vietnam', 'Thailand', 'South Korea', 'Japan', 'UAE', 'Netherlands'];
const HEAD = ['name', 'hs', 'cost', 'importedFrom', 'process', 'requiredCerts', 'weightKg', 'spec'];

export default function SetupPage() {
  const { state, update, reset } = useStore();
  const [company, setCompany] = useState<Omit<Buyer, 'unitCost'>>(() => { const { unitCost: _u, ...rest } = buyer; void _u; return { ...rest }; });
  const [lines, setLines] = useState<Line[]>(() => bom.map(({ sharePct: _s, ...l }) => { void _s; return { ...l }; }));
  const [msg, setMsg] = useState('');
  const edited = !!state.overrides[state.sector];
  const total = lines.reduce((s, l) => s + (Number(l.cost) || 0), 0);

  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const save = () => {
    update((s) => ({ ...s, overrides: { ...s.overrides, [s.sector]: { buyer: company, bom: lines.map((l) => ({ ...l, cost: Number(l.cost) || 0, weightKg: Number(l.weightKg) || 0 })) } } }));
    setMsg('Saved. Every page now uses your company and parts.');
  };
  const revert = () => {
    update((s) => { const o = { ...s.overrides }; delete o[s.sector]; return { ...s, overrides: o }; });
    setMsg('Back to the sector template.');
  };
  const importCsv = async (f: File) => {
    const rows = parseCsv(await f.text());
    const head = rows[0].map((h) => h.trim());
    const idx = (k: string) => head.indexOf(k);
    if (idx('name') < 0 || idx('cost') < 0) { setMsg('The CSV needs at least "name" and "cost" columns. Download the template for the full format.'); return; }
    const parsed: Line[] = rows.slice(1).map((r, i) => {
      const get = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? '').trim() : '');
      return {
        id: `csv${i}-${get('name').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}`, name: get('name'), hs: get('hs') || undefined, cost: Number(get('cost')) || 0,
        importedFrom: get('importedFrom') || 'India', process: get('process') || processes[0]?.name || '', requiredCerts: get('requiredCerts') ? get('requiredCerts').split(/[;|]/).map((x) => x.trim()).filter(Boolean) : [],
        weightKg: Number(get('weightKg')) || 0, spec: get('spec'), tiers: [],
      };
    }).filter((l) => l.name);
    setLines(parsed);
    setMsg(`Read ${parsed.length} parts from ${f.name}. Check them, then Save.`);
  };
  const template = () => download(`sangam-parts-${active.sector}.csv`, toCsv([HEAD, ...lines.map((l) => [l.name, l.hs ?? '', l.cost, l.importedFrom, l.process, l.requiredCerts.join(';'), l.weightKg, l.spec])]));
  const switchSector = (id: SectorId) => update((s) => ({ ...s, sector: id }));

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Company and parts</h1>
        <p className="muted" style={{ marginTop: 6 }}>Start from a sector template, then make it yours. Everything else in Sangam recalculates from what you enter here.</p>
      </div>

      <div className="grid-3">
        {SECTOR_LIST.map((t) => (
          <button key={t.id} className={`chain ${t.id === state.sector ? 'on' : ''}`} onClick={() => switchSector(t.id)}>
            <div className="name">{t.name}</div>
            <div className="tiny">{t.blurb}</div>
            <div className="small muted">{t.bom.length} parts · {t.sellers.length} demo suppliers · {t.processes.length} processes</div>
          </button>
        ))}
      </div>

      <div className="card stack" style={{ gap: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="section-title" style={{ margin: 0 }}>Your company</div>
          {edited && <span className="chip ready">Using your edits</span>}
        </div>
        <div className="form-grid">
          <label className="field">Company name<input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></label>
          <label className="field">Product<input value={company.product} onChange={(e) => setCompany({ ...company, product: e.target.value })} /></label>
          <label className="field">One unit is a<input value={company.unitLabel} onChange={(e) => setCompany({ ...company, unitLabel: e.target.value })} /></label>
          <label className="field">Plant location<select value={company.plantDistrictId} onChange={(e) => setCompany({ ...company, plantDistrictId: e.target.value })}>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}, {d.state}</option>)}</select></label>
          <label className="field">Units a month<input type="number" min={1} value={company.monthlyUnits} onChange={(e) => setCompany({ ...company, monthlyUnits: Number(e.target.value) })} /></label>
          <label className="field">Import lead time (days)<input type="number" min={1} value={company.importLeadDays} onChange={(e) => setCompany({ ...company, importLeadDays: Number(e.target.value) })} /></label>
          <label className="field">Safety stock (days)<input type="number" min={0} value={company.safetyStockDays} onChange={(e) => setCompany({ ...company, safetyStockDays: Number(e.target.value) })} /></label>
          <label className="field">Units whose imports fill a 40-ft container<input type="number" min={1} value={company.unitsPerContainer} onChange={(e) => setCompany({ ...company, unitsPerContainer: Number(e.target.value) })} /></label>
          <label className="field">Margin lost per unit not made (₹)<input type="number" min={0} value={company.lostContribution} onChange={(e) => setCompany({ ...company, lostContribution: Number(e.target.value) })} /></label>
        </div>
      </div>

      <div className="card stack" style={{ gap: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="section-title" style={{ margin: 0 }}>Parts list</div>
            <div className="small muted">{lines.length} parts · {inr(total)} per {company.unitLabel}</div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn small" onClick={template}>Download CSV</button>
            <label className="btn small">Upload CSV<input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); }} /></label>
            <button className="btn small" onClick={() => setLines([...lines, { id: `new${Date.now()}`, name: 'New part', cost: 0, importedFrom: 'China', process: processes[0]?.name ?? '', requiredCerts: [], weightKg: 0, spec: '', tiers: [] }])}>Add part</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Part</th><th>HS code</th><th className="num">Cost (₹)</th><th>Source</th><th>Process</th><th>Certificates needed</th><th className="num">kg / unit</th><th /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id}>
                  <td><input className="cell" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} /><input className="cell tiny" placeholder="Specification" value={l.spec} onChange={(e) => setLine(i, { spec: e.target.value })} /></td>
                  <td><input className="cell" style={{ width: 80 }} value={l.hs ?? ''} onChange={(e) => setLine(i, { hs: e.target.value || undefined })} /></td>
                  <td><input className="cell num" style={{ width: 90 }} type="number" value={l.cost} onChange={(e) => setLine(i, { cost: Number(e.target.value) })} /></td>
                  <td><select className="cell" value={l.importedFrom} onChange={(e) => setLine(i, { importedFrom: e.target.value })}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></td>
                  <td><select className="cell" value={l.process} onChange={(e) => setLine(i, { process: e.target.value })}>{[...new Set([...processes.map((p) => p.name), l.process])].map((p) => <option key={p}>{p}</option>)}</select></td>
                  <td><input className="cell" value={l.requiredCerts.join('; ')} onChange={(e) => setLine(i, { requiredCerts: e.target.value.split(';').map((x) => x.trim()).filter(Boolean) })} /></td>
                  <td><input className="cell num" style={{ width: 70 }} type="number" value={l.weightKg} onChange={(e) => setLine(i, { weightKg: Number(e.target.value) })} /></td>
                  <td><button className="btn small ghost" style={{ color: 'var(--danger)' }} onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label={`Remove ${l.name}`}>{'✕'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny">Processes link parts to suppliers on Sangam; HS codes link them to India&apos;s real import data. Separate several certificates with semicolons.</p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={save} disabled={!lines.length}>Save</button>
          {edited && <button className="btn" onClick={revert}>Back to template</button>}
          {msg && <span className="small muted">{msg}</span>}
        </div>
      </div>

      <details>
        <summary>Demo data</summary>
        <div className="card stack" style={{ gap: 10 }}>
          <p className="small">Requirements, quotes, reviews, projects and onboarded companies are saved in this browser only.</p>
          <div><button className="btn danger" onClick={() => { if (window.confirm('Clear everything you created and go back to the demo data?')) reset(); }}>Reset all demo data</button></div>
        </div>
      </details>
    </div>
  );
}
