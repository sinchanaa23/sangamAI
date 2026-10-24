import { useState } from 'react';
import { active, bom, buyer } from '../data';
import { inr, lakh } from '../engine';
import type { Option } from '../types';
import { useStore } from '../store';
import { useUi } from '../ui';
import { useBuyer } from './context';

interface Phase { id: string; label: string; weeks: number; owner: string; costLakh: number; gate: string; criteria: string }

function phasesFor(o: Option, toolingLakh: number): Phase[] {
  const strict = active.sector === 'ev';
  const gapWeeks = Math.round(o.readyInMonths * 4.3);
  const out: Phase[] = [];
  if (gapWeeks > 0) out.push({ id: 'gaps', label: 'Close capability gaps', weeks: gapWeeks, owner: 'Supplier, co-funded', costLakh: o.investmentLakh / 2, gate: 'Gaps verified', criteria: 'Every gap marked verified by the Sangam team in Supplier development' });
  out.push(
    { id: 'samples', label: 'Samples and first-article inspection', weeks: 4, owner: 'Your quality team', costLakh: 1 + toolingLakh, gate: 'First article passes', criteria: 'All dimensions and tests on the drawing pass; tooling signed off' },
    { id: 'qualify', label: strict ? 'PPAP and trial run' : 'Qualification trial run', weeks: 6, owner: 'Supplier and your quality team', costLakh: 5, gate: 'Process qualified', criteria: strict ? 'PPAP level 3 approved; Cpk at least 1.33 on critical features' : 'Trial batch meets specification; process documented' },
    { id: 'pilot', label: 'Pilot orders, 10% of volume', weeks: 6, owner: 'Procurement', costLakh: 0, gate: 'Pilot stable', criteria: 'Defects under 1,000 ppm and on time in full at least 95% for 6 weeks' },
    { id: 'ramp', label: 'Ramp to 50% of volume', weeks: 8, owner: 'Procurement', costLakh: 0, gate: 'Ready for full switch', criteria: 'Stable for 8 weeks; landed cost at or below the quote; import backup agreed' },
    { id: 'full', label: 'Full switch, 100%', weeks: 4, owner: 'Procurement', costLakh: 0, gate: 'Switch complete', criteria: 'Import contract moved to backup or ended' },
  );
  return out;
}

const COLORS: Record<string, string> = { gaps: '#956400', samples: '#1f6c9f', qualify: '#5b6f8f', pilot: '#3d5a45', ramp: '#346538', full: '#2f3437' };
const STATE_COLOR = { pending: '#cbd5e1', passed: '#346538', failed: '#9f2f2d' } as const;

export default function SwitchoverPage() {
  const { chain } = useBuyer();
  const { state, update } = useStore();
  const { go, openSupplier } = useUi();
  const [sel, setSel] = useState<string | null>(null);
  const start = new Date();
  start.setDate(1);

  const parts = bom.map((line) => {
    const o = chain.picks[line.id];
    if (!o) return null;
    const req = state.requirements.find((r) => r.sector === state.sector && r.lineId === line.id && r.status === 'awarded');
    const awarded = req ? state.quotes.find((q) => q.id === req.awardedQuoteId) : undefined;
    const phases = phasesFor(o, awarded?.toolingLakh ?? 2);
    let w = 0;
    const placed = phases.map((p) => { const s = w; w += p.weeks; return { ...p, start: s, end: w }; });
    return { line, o, phases: placed, weeks: w, awarded };
  }).filter(Boolean) as { line: typeof bom[number]; o: Option; phases: (Phase & { start: number; end: number })[]; weeks: number; awarded?: { unitPrice: number } }[];

  const key = (lineId: string, gate: string) => `${state.sector}:${lineId}:${gate}`;
  const gateState = (lineId: string, gate: string) => state.gates[key(lineId, gate)] ?? 'pending';
  const setGate = (lineId: string, gate: string, v: 'pending' | 'passed' | 'failed') => update((s) => ({ ...s, gates: { ...s.gates, [key(lineId, gate)]: v } }));
  const maxWeeks = Math.max(26, ...parts.map((p) => p.weeks));
  const budget = parts.reduce((t, p) => t + p.phases.reduce((s, x) => s + x.costLakh, 0), 0);
  const passed = parts.reduce((t, p) => t + p.phases.filter((x) => gateState(p.line.id, x.id) === 'passed').length, 0);
  const totalGates = parts.reduce((t, p) => t + p.phases.length, 0);

  const W = 780, L = 190, ROWH = 34, top = 30;
  const x = (wk: number) => L + (wk / maxWeeks) * (W - L - 16);
  const H = top + parts.length * ROWH + 10;
  const months = Array.from({ length: Math.ceil(maxWeeks / 4.33) + 1 }, (_, i) => i);
  const focus = parts.find((p) => p.line.id === sel) ?? parts[0];

  if (!parts.length) return <div className="empty">The chosen chain keeps every part imported. Pick a chain under Indian options first.</div>;

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Switch-over plan · {chain.name}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {parts.length} parts move to Indian suppliers over about {Math.ceil(maxWeeks / 4.33)} months, through {totalGates} go/no-go gates ({passed} passed). Budget about {lakh(budget)} for samples, tooling, qualification and your share of supplier development.
        </p>
      </div>

      <div className="card">
        <div className="table-wrap">
          <div style={{ minWidth: 680 }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Switch-over timeline" style={{ display: 'block' }}>
              {months.map((m) => {
                const d = new Date(start); d.setMonth(start.getMonth() + m);
                const xx = x(m * 4.33);
                return xx <= W - 10 ? (
                  <g key={m}>
                    <line x1={xx} x2={xx} y1={top - 6} y2={H} stroke="#efeeea" />
                    {m % 2 === 0 && <text x={xx + 2} y={16} fontSize={10.5} fill="#9a9892">{d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })}</text>}
                  </g>
                ) : null;
              })}
              {parts.map((p, i) => {
                const y = top + i * ROWH;
                return (
                  <g key={p.line.id} style={{ cursor: 'pointer' }} onClick={() => setSel(p.line.id)}>
                    {(sel ?? parts[0].line.id) === p.line.id && <rect x={0} y={y - 2} width={W} height={ROWH} fill="#edf3ec" rx={6} />}
                    <text x={6} y={y + 18} fontSize={12} fontWeight={600} fill="#111111">{p.line.name.length > 26 ? `${p.line.name.slice(0, 25)}…` : p.line.name}</text>
                    {p.phases.map((ph) => (
                      <g key={ph.id}>
                        <rect x={x(ph.start)} y={y + 7} width={Math.max(3, x(ph.end) - x(ph.start) - 2)} height={16} rx={4} fill={COLORS[ph.id]} fillOpacity={0.85}>
                          <title>{ph.label}: weeks {ph.start}-{ph.end}</title>
                        </rect>
                        <path d={`M${x(ph.end) - 1} ${y + 9}l6 6l-6 6l-6 -6z`} fill={STATE_COLOR[gateState(p.line.id, ph.id)]} stroke="#fff" strokeWidth={1}>
                          <title>Gate: {ph.gate} ({gateState(p.line.id, ph.id)})</title>
                        </path>
                      </g>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
        <div className="legend">
          {Object.entries({ gaps: 'Close gaps', samples: 'Samples', qualify: 'Qualification', pilot: 'Pilot 10%', ramp: 'Ramp 50%', full: 'Full switch' }).map(([k, v]) => <span key={k}><i style={{ background: COLORS[k] }} />{v}</span>)}
          <span><i className="dot" style={{ background: STATE_COLOR.passed }} />Gate passed</span>
          <span><i className="dot" style={{ background: STATE_COLOR.failed }} />Gate failed</span>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="eyebrow">Gates for</div>
            <h2 className="lead" style={{ fontSize: 20, marginTop: 4 }}>{focus.line.name}</h2>
            <div className="small muted">
              {focus.o.sellers.map((s, i) => <span key={s.id}>{i > 0 && ' + '}<button className="linkish" onClick={() => openSupplier(s.id)}>{s.name}</button></span>)}
              {focus.awarded ? ` · awarded at ${inr(focus.awarded.unitPrice)} per ${buyer.unitLabel}` : ' · no quote awarded yet'}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {focus.o.status === 'potential' && <button className="btn small" onClick={() => go('buyer', 'devel')}>Supplier development</button>}
            {!focus.awarded && <button className="btn small ghost" onClick={() => go('buyer', 'requirements')}>Get quotes</button>}
          </div>
        </div>
        <ol className="roadmap-v" style={{ marginTop: 16 }}>
          {focus.phases.map((ph) => {
            const g = gateState(focus.line.id, ph.id);
            return (
              <li key={ph.id}>
                <span className="rm-dot" style={{ background: COLORS[ph.id] }} aria-hidden="true">{g === 'passed' ? '✓' : g === 'failed' ? '✕' : '◆'}</span>
                <div className="rm-card">
                  <div className="rm-head">
                    <div>
                      <div className="rm-title">{ph.label}</div>
                      <div className="small">Owner: {ph.owner} · weeks {ph.start + 1} to {ph.end}{ph.costLakh > 0 ? ` · ${lakh(ph.costLakh)}` : ''}</div>
                      <div className="tiny" style={{ marginTop: 4 }}><b>Gate: {ph.gate}.</b> {ph.criteria}</div>
                    </div>
                    <div className="toggle-row" style={{ alignSelf: 'center' }}>
                      {(['pending', 'passed', 'failed'] as const).map((v) => <button key={v} className={`pill ${g === v ? 'on' : ''} ${v === 'failed' ? 'danger' : ''}`} onClick={() => setGate(focus.line.id, ph.id, v)}>{{ pending: 'Pending', passed: 'Passed', failed: 'Failed' }[v]}</button>)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="tiny">Keep the import supplier as a backup until the last gate passes. A failed gate pauses the part until the supplier fixes the cause.</p>
      </div>
    </div>
  );
}
