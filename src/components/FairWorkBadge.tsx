// The Fair Work grade badge shown on quotes, the supplier profile and chain steps.
// Self-contained styling so any page can drop it in without touching shared CSS.
// The tooltip carries the scoring reasons and the benchmark source.
import { GRADE_LABEL } from '../fairwork';
import type { FairWorkScore } from '../fairwork';

const COLOR: Record<FairWorkScore['grade'], string> = {
  A: '#15803d', B: '#0f766e', C: '#b45309', D: '#c2410c', E: '#b91c1c',
};

export default function FairWorkBadge({ score, showLabel = true, size = 'md' }: {
  score: FairWorkScore & { reasons?: string[] };
  showLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  const g = score.grade;
  const tip = [`${g} — ${GRADE_LABEL[g]}`, ...(score.reasons ?? []), `Benchmark: ${score.benchmarkSource}`].join('\n');
  const dim = size === 'sm' ? 22 : 30;
  return (
    <span className="fairwork-badge" title={tip} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, verticalAlign: 'middle', cursor: 'help' }}>
      <span style={{
        width: dim, height: dim, borderRadius: '50%', background: COLOR[g], color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size === 'sm' ? 12 : 14, flex: '0 0 auto',
      }}>{g}</span>
      {showLabel && <span style={{ fontWeight: 600, fontSize: size === 'sm' ? 12 : 14 }}>{GRADE_LABEL[g]}</span>}
    </span>
  );
}
