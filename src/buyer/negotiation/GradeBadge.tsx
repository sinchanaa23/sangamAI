// TEMPORARY fallback for src/components/FairWorkBadge.tsx (owned by P3).
// Swap the import in NegotiationRoom.tsx once P3 merges the real badge.
import type { FairWorkScore } from '../../contracts';

const COLOUR: Record<FairWorkScore['grade'], { bg: string; fg: string; label: string }> = {
  A: { bg: 'var(--ready-soft)', fg: 'var(--ready)', label: 'At or above living wage' },
  B: { bg: 'var(--accent-soft)', fg: 'var(--accent)', label: 'Near living wage' },
  C: { bg: 'var(--potential-soft)', fg: 'var(--potential)', label: 'Above minimum, below living wage' },
  D: { bg: 'var(--danger-soft)', fg: 'var(--danger)', label: 'Below minimum or over legal hours' },
  E: { bg: 'var(--danger)', fg: '#fff', label: 'Child or forced labour risk: blocked' },
};

export default function GradeBadge({ score, size = 'md' }: { score: FairWorkScore; size?: 'md' | 'lg' }) {
  const c = COLOUR[score.grade];
  const dim = size === 'lg' ? 52 : 26;
  return (
    <span className="row" style={{ gap: 8 }} title={`Fair Work grade ${score.grade}: ${c.label}. Benchmark: ${score.benchmarkSource}`}>
      <span style={{ width: dim, height: dim, borderRadius: 10, background: c.bg, color: c.fg, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: dim * 0.5, flex: 'none' }}>
        {score.grade}
      </span>
      {size === 'lg' && <span className="small muted">{c.label}</span>}
    </span>
  );
}
