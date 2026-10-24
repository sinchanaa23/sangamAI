// The supply chain as a left-to-right network: raw materials → processing → your unit → logistics → buyers.
// Plain SVG like the app's maps. Nodes are buttons (click or keyboard) that select a stage for the inspector.
import type { KeyboardEvent } from 'react';
import type { ScenarioId, Stage, StageKind } from './engine';

const COLS: { kind: StageKind; label: string }[] = [
  { kind: 'raw', label: 'Raw materials' },
  { kind: 'processing', label: 'Processing' },
  { kind: 'manufacturing', label: 'Manufacturing' },
  { kind: 'logistics', label: 'Logistics' },
  { kind: 'buyer', label: 'Buyers' },
];
const NODE_W = 150, NODE_H = 46, COL_GAP = 46, ROW_GAP = 14, TOP = 34, PAD = 8;

export type Origin = 'india' | 'import' | 'mixed';

/** Where a stage's supply comes from under a scenario. */
export function originUnder(stage: Stage, scenario: ScenarioId, importedFrom: string): Origin {
  if (stage.kind === 'logistics' || stage.kind === 'buyer') return 'india';
  if (scenario === 'import' && importedFrom !== 'India') return 'import';
  if (stage.kind === 'manufacturing') return 'india';
  if (scenario === 'india') return stage.origin === 'india' ? 'india' : 'mixed';
  return stage.origin === 'india' ? 'india' : 'import';
}

const STYLE: Record<Origin, { fill: string; stroke: string; dash?: string; label: string }> = {
  india: { fill: 'var(--ready-soft)', stroke: 'var(--ready)', label: 'India' },
  mixed: { fill: 'var(--potential-soft)', stroke: 'var(--potential)', label: 'India, supply not proven' },
  import: { fill: 'var(--import-soft)', stroke: 'var(--import)', dash: '4 3', label: 'Imported' },
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function NetworkGraph({ stages, scenario, importedFrom, selected, onSelect }: {
  stages: Stage[]; scenario: ScenarioId; importedFrom: string; selected: string | null; onSelect: (id: string) => void;
}) {
  const cols = COLS.map((c) => ({ ...c, items: stages.filter((s) => s.kind === c.kind) })).filter((c) => c.items.length || c.kind !== 'processing');
  const rows = Math.max(...cols.map((c) => c.items.length), 1);
  const W = PAD * 2 + cols.length * NODE_W + (cols.length - 1) * COL_GAP;
  const H = TOP + rows * (NODE_H + ROW_GAP) + PAD;
  const pos = new Map<string, { x: number; y: number }>();
  cols.forEach((c, ci) => {
    const colH = c.items.length * (NODE_H + ROW_GAP) - ROW_GAP;
    const y0 = TOP + ((rows * (NODE_H + ROW_GAP) - ROW_GAP) - colH) / 2;
    c.items.forEach((s, i) => pos.set(s.id, { x: PAD + ci * (NODE_W + COL_GAP), y: y0 + i * (NODE_H + ROW_GAP) }));
  });
  const key = (id: string) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } };

  return (
    <div className="ar-graph-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label="Supply chain network" style={{ display: 'block', minWidth: 640 }}>
        {cols.map((c, ci) => (
          <text key={c.kind} x={PAD + ci * (NODE_W + COL_GAP) + NODE_W / 2} y={16} textAnchor="middle" fontSize={11} fill="var(--ink-3, #787774)" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</text>
        ))}
        {stages.flatMap((s) => s.next.map((n) => {
          const a = pos.get(s.id), b = pos.get(n);
          if (!a || !b) return null;
          const same = Math.abs(a.x - b.x) < 1;
          const d = same
            ? `M${a.x + NODE_W / 2},${a.y + NODE_H} L${b.x + NODE_W / 2},${b.y}`
            : `M${a.x + NODE_W},${a.y + NODE_H / 2} C${a.x + NODE_W + COL_GAP / 2},${a.y + NODE_H / 2} ${b.x - COL_GAP / 2},${b.y + NODE_H / 2} ${b.x},${b.y + NODE_H / 2}`;
          const origin = originUnder(s, scenario, importedFrom);
          return <path key={`${s.id}-${n}`} d={d} fill="none" stroke={STYLE[origin].stroke} strokeOpacity={0.55} strokeWidth={1.4} strokeDasharray={STYLE[origin].dash} markerEnd="url(#ar-arrow)" />;
        }))}
        <defs>
          <marker id="ar-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--ink-3, #787774)" />
          </marker>
        </defs>
        {stages.map((s) => {
          const p = pos.get(s.id);
          if (!p) return null;
          const o = originUnder(s, scenario, importedFrom);
          const st = STYLE[o];
          const on = selected === s.id;
          const name = s.kind === 'manufacturing' && o === 'import' ? `Made in ${importedFrom}` : s.name;
          return (
            <g key={s.id} role="button" tabIndex={0} aria-pressed={on} aria-label={`${name}, ${st.label}`} style={{ cursor: 'pointer' }} onClick={() => onSelect(s.id)} onKeyDown={key(s.id)}>
              <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx={8} fill={st.fill} stroke={st.stroke} strokeWidth={on ? 2.6 : 1.2} strokeDasharray={st.dash} />
              <text x={p.x + 10} y={p.y + 19} fontSize={12} fontWeight={600} fill="var(--ink, #2f3437)">{clip(name, 22)}</text>
              <text x={p.x + 10} y={p.y + 35} fontSize={10.5} fill="var(--ink-2, #5f5e5a)">{clip(s.place, 26)}</text>
              <title>{`${name} — ${s.place} (${st.label})`}</title>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        {(Object.keys(STYLE) as Origin[]).map((o) => <span key={o}><i className="dot" style={{ background: STYLE[o].fill, border: `1.5px ${STYLE[o].dash ? 'dashed' : 'solid'} ${STYLE[o].stroke}` }} />{STYLE[o].label}</span>)}
      </div>
    </div>
  );
}
