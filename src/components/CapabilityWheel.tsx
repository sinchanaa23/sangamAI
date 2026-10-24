import type { OppResult } from '../diversify';

interface Props {
  center: string[];
  centerSub: string;
  results: OppResult[];
  selected: string;
  onSelect: (id: string) => void;
  nameOf: (r: OppResult) => string;
  fitLabel: string;
}

const W = 440, H = 360, CX = W / 2, CY = H / 2 - 6, RING = 128;

export const roiColor = (roi10: number) => (roi10 >= 5 ? '#346538' : roi10 >= 3.5 ? '#3d5a45' : '#956400');

function wrap(text: string, max = 20): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.length > 2 ? [lines[0], lines.slice(1).join(' ').slice(0, max - 1) + '…'] : lines;
}

/** Today's capability in the middle; adjacent opportunities around it. */
export default function CapabilityWheel({ center, centerSub, results, selected, onSelect, nameOf, fitLabel }: Props) {
  const n = results.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Capability map" style={{ display: 'block' }}>
      {results.map((r, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n + (n === 3 ? Math.PI / 6 : Math.PI / 4);
        const x = CX + RING * Math.cos(a), y = CY + RING * 0.88 * Math.sin(a);
        const rad = Math.max(16, Math.min(34, 10 + Math.sqrt(r.opp.marketCr) / 2.6));
        const on = r.opp.id === selected;
        const lines = wrap(nameOf(r));
        const below = y > CY - 10;
        const ty = below ? y + rad + 14 : y - rad - 8 - (lines.length - 1) * 13;
        return (
          <g key={r.opp.id} onClick={() => onSelect(r.opp.id)} style={{ cursor: 'pointer' }}>
            <line x1={CX} y1={CY} x2={x} y2={y} stroke={roiColor(r.roi10)} strokeOpacity={0.45} strokeWidth={Math.max(1.5, r.fit / 12)} />
            <circle cx={x} cy={y} r={rad + (on ? 6 : 0)} fill={roiColor(r.roi10)} fillOpacity={on ? 0.18 : 0} />
            <circle cx={x} cy={y} r={rad} fill="#fff" stroke={roiColor(r.roi10)} strokeWidth={on ? 3 : 2} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={roiColor(r.roi10)}>{r.fit}%</text>
            {lines.map((l, j) => (
              <text key={j} x={x} y={ty + j * 13} textAnchor="middle" fontSize={11.5} fontWeight={on ? 600 : 500} fill="#111111">{l}</text>
            ))}
          </g>
        );
      })}
      <circle cx={CX} cy={CY} r={54} fill="#edf3ec" stroke="#3d5a45" strokeWidth={2} />
      {center.map((c, i) => (
        <text key={i} x={CX} y={CY - 6 + i * 14 - (center.length - 1) * 7} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="#111111">{c}</text>
      ))}
      <text x={CX} y={CY + 16 + (center.length - 1) * 7} textAnchor="middle" fontSize={10.5} fill="#6b6a66">{centerSub}</text>
      <text x={W - 8} y={H - 6} textAnchor="end" fontSize={10.5} fill="#9a9892">% = {fitLabel}</text>
    </svg>
  );
}
