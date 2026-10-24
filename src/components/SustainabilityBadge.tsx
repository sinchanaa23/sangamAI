// The sustainability level badge shown on the checklist, the supplier drawer and the
// Find-suppliers ranking. Mirrors FairWorkBadge: self-contained styling so any page can
// drop it in without touching shared CSS. The tooltip carries the level, the score and
// the scoring reasons.
import type { CSSProperties } from 'react';
import { LEVEL_META } from '../sustainability';
import type { SustainabilityResult } from '../sustainability';

export default function SustainabilityBadge({ result, showLabel = true, size = 'md' }: {
  result: SustainabilityResult;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  const meta = LEVEL_META[result.level];
  // 'Not assessed' is an outlined grey chip rather than a metal colour.
  const outline = result.level === 'Not assessed';
  const dim = size === 'sm' ? 22 : 30;
  const tip = [`${meta.label} — ${result.score}/100`, ...result.reasons].join('\n');
  return (
    <span title={tip} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, verticalAlign: 'middle', cursor: 'help' }}>
      <span style={{
        width: dim, height: dim, borderRadius: '50%',
        background: outline ? 'transparent' : meta.color,
        border: outline ? `1.5px solid ${meta.color}` : 'none',
        color: outline ? meta.color : '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size === 'sm' ? 12 : 14, flex: '0 0 auto',
        boxShadow: outline ? 'none' : `0 0 14px ${meta.soft}`,
      } as CSSProperties}>{meta.icon}</span>
      {showLabel && <span style={{ fontWeight: 600, fontSize: size === 'sm' ? 12 : 14 }}>{meta.label}</span>}
    </span>
  );
}
