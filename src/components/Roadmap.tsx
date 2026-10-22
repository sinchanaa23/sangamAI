import type { Leg } from '../routes';
import { inr } from '../engine';
import Src from './Src';

const MODE: Record<Leg['mode'], { color: string; glyph: string }> = {
  make: { color: '#0f766e', glyph: '⚙' },
  road: { color: '#475569', glyph: '▣' },
  rail: { color: '#7c3aed', glyph: '═' },
  sea: { color: '#0369a1', glyph: '≈' },
  air: { color: '#0891b2', glyph: '✈' },
  port: { color: '#334155', glyph: '⚓' },
  customs: { color: '#b45309', glyph: '⚖' },
  check: { color: '#15803d', glyph: '✓' },
};

export interface RoadmapLeg extends Leg { onWho?: () => void }

/** A route as a vertical sequence of legs with time, cost, reliability, documents and risks. */
export default function Roadmap({ legs, unit, compare }: { legs: RoadmapLeg[]; unit: string; compare?: Record<string, Leg> }) {
  return (
    <ol className="roadmap-v">
      {legs.map((l, i) => {
        const m = MODE[l.mode];
        const base = compare?.[l.id];
        const dCost = base ? l.cost - base.cost : 0;
        return (
          <li key={`${l.id}-${i}`}>
            <span className="rm-dot" style={{ background: m.color }} aria-hidden="true">{m.glyph}</span>
            <div className="rm-card">
              <div className="rm-head">
                <div>
                  <div className="rm-title">{l.title} <Src kind={l.src} /></div>
                  <div className="small">{l.onWho ? <button className="linkish" onClick={l.onWho}>{l.who}</button> : l.who}</div>
                  <div className="tiny">{l.place}</div>
                </div>
                <div className="rm-metrics">
                  <span><b>{l.days > 0 ? `${+l.days.toFixed(1)} d` : '—'}</b>{l.p90 > l.days ? `up to ${+l.p90.toFixed(1)} d` : 'time'}</span>
                  <span><b>{inr(l.cost)}</b>per {unit}{base && Math.abs(dCost) >= 1 ? <em className={dCost > 0 ? 'up' : 'down'}> {dCost > 0 ? '+' : ''}{inr(dCost)}</em> : null}</span>
                  <span><b>{Math.round(l.reliability * 100)}%</b>reliable</span>
                </div>
              </div>
              {l.note && <div className="tiny" style={{ marginTop: 4 }}>{l.note}</div>}
              {(l.documents.length > 0 || l.risks.length > 0 || l.damagePct > 0) && (
                <div className="toggle-row" style={{ marginTop: 8, gap: 6 }}>
                  {l.documents.map((d) => <span key={d} className="chip plain" style={{ fontSize: 11 }}>{d}</span>)}
                  {l.damagePct > 0 && <span className="chip plain" style={{ fontSize: 11 }}>Loss or defect {l.damagePct < 0.1 ? `${l.damagePct.toFixed(2)}%` : `${l.damagePct.toFixed(1)}%`}</span>}
                  {l.co2Kg > 0.05 && <span className="chip plain" style={{ fontSize: 11 }}>{l.co2Kg < 10 ? l.co2Kg.toFixed(1) : Math.round(l.co2Kg)} kg CO₂</span>}
                  {l.risks.map((r) => <span key={r} className="chip potential" style={{ fontSize: 11 }}>{r}</span>)}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const CAT_COLOR = ['#0f766e', '#b45309', '#0369a1', '#334155', '#475569', '#7c3aed', '#15803d', '#94a3b8', '#0891b2'];

/** Landed cost split by leg, as one stacked bar with a legend. */
export function LandedCostBar({ legs }: { legs: Leg[] }) {
  const total = legs.reduce((s, l) => s + l.cost, 0);
  const parts = legs.filter((l) => l.cost > 0.5);
  return (
    <div>
      <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden' }}>
        {parts.map((l, i) => <div key={`${l.id}${i}`} title={`${l.title}: ${inr(l.cost)}`} style={{ width: `${(l.cost / total) * 100}%`, background: CAT_COLOR[i % CAT_COLOR.length] }} />)}
      </div>
      <div className="legend">
        {parts.map((l, i) => <span key={`${l.id}${i}`}><i className="dot" style={{ background: CAT_COLOR[i % CAT_COLOR.length] }} />{l.title} {inr(l.cost)} ({((l.cost / total) * 100).toFixed(l.cost / total < 0.01 ? 1 : 0)}%)</span>)}
      </div>
    </div>
  );
}
