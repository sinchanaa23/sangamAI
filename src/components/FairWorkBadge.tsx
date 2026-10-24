// The Fair Work grade badge shown on quotes, the supplier profile and chain steps.
// Self-contained styling so any page can drop it in without touching shared CSS.
// The tooltip carries the scoring reasons and the benchmark source.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { GRADE_LABEL } from '../fairwork';
import type { FairWorkScore } from '../fairwork';
import './motion/motion.css';

const COLOR: Record<FairWorkScore['grade'], string> = {
  A: '#346538', B: '#3d5a45', C: '#956400', D: '#a4552c', E: '#9f2f2d',
};

// Halo colour for the live-grade card glow (WorkforcePage / ProfilePage), keyed to the same grade colours.
export const GRADE_GLOW: Record<FairWorkScore['grade'], string> = {
  A: 'rgba(34,197,94,.32)', B: 'rgba(20,184,166,.32)', C: 'rgba(245,158,11,.32)',
  D: 'rgba(249,115,22,.32)', E: 'rgba(239,68,68,.36)',
};

// Colours resolve through --fw-grade-* custom properties: main's warm palette is the
// fallback (light workspaces); the supplier workspace's dark scope overrides them in theme.css.
const gradeVar = (g: FairWorkScore['grade']) => `var(--fw-grade-${g}, ${COLOR[g]})`;
;

export default function FairWorkBadge({ score, showLabel = true, size = 'md' }: {
  score: FairWorkScore & { reasons?: string[] };
  showLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  const g = score.grade;
  // Re-key the circle on a grade change so the fw-pop pop replays (transform only, no layout shift).
  const [tick, setTick] = useState(0);
  const prevGrade = useRef(score.grade);
  useEffect(() => {
    if (prevGrade.current !== score.grade) {
      prevGrade.current = score.grade;
      setTick((t) => t + 1);
    }
  }, [score.grade]);
  const tip = [`${g} — ${GRADE_LABEL[g]}`, ...(score.reasons ?? []), `Benchmark: ${score.benchmarkSource}`].join('\n');
  const dim = size === 'sm' ? 22 : 30;
  return (
    <span className="fairwork-badge" title={tip} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, verticalAlign: 'middle', cursor: 'help' }}>
      <span key={tick} className="fw-pop" style={{
        width: dim, height: dim, borderRadius: '50%', background: gradeVar(g), color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size === 'sm' ? 12 : 14, flex: '0 0 auto',
        boxShadow: `0 0 14px color-mix(in srgb, ${gradeVar(g)} 40%, transparent)`,
        '--fw-ring': gradeVar(g),
      } as CSSProperties}>{g}</span>
      {showLabel && <span style={{ fontWeight: 600, fontSize: size === 'sm' ? 12 : 14 }}>{GRADE_LABEL[g]}</span>}
    </span>
  );
}
