import { bom, buyer } from '../data';
import { district } from '../engine';
import { trade } from '../realdata';
import type { TierInput } from '../types';

const SUPPLY = { strong: '#346538', partial: '#956400', weak: '#9f2f2d' } as const;
const W = 780, ROW = 54, BOX = 44;
const COL = { raw: 10, inter: 210, part: 410, plant: 640 };
const BW = 186;
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const usdM = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${Math.round(v / 1e6)}M`);
function tradeLine(t: TierInput) {
  const s = trade(t.hs);
  if (!s) return clip(t.indianRegions, 32);
  const top = s.partners[0];
  return `India imports ${usdM(s.totalUsd)} · ${top ? `${top.name.replace('Rep. of Korea', 'Korea')} ${Math.round(top.share * 100)}%` : ''}`;
}

/** Raw materials and intermediates feeding each part, coloured by how well India can supply them. */
export default function TierDiagram() {
  const groups = bom.map((l) => {
    const raw = l.tiers.filter((t) => t.stage === 'raw material');
    const inter = l.tiers.filter((t) => t.stage === 'intermediate');
    return { line: l, raw, inter, rows: Math.max(1, raw.length, inter.length) };
  });
  let y = 34;
  const placed = groups.map((g) => { const top = y; y += g.rows * ROW + 14; return { ...g, top }; });
  const H = y + 6;
  const plantY = (34 + H) / 2;
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;

  const box = (x: number, cy: number, t: TierInput, key: string) => (
    <g key={key}>
      <rect x={x} y={cy - BOX / 2} width={BW} height={BOX} rx={7} fill="#fff" stroke="#dcdad4" />
      <rect x={x} y={cy - BOX / 2} width={4} height={BOX} rx={2} fill={SUPPLY[t.indianSupply]} />
      <text x={x + 11} y={cy - 4} fontSize={11.5} fontWeight={600} fill="#111111">{clip(t.name, 27)}</text>
      <text x={x + 11} y={cy + 12} fontSize={10.5} fill="#6b6a66">{tradeLine(t)}</text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Multi-tier supply chain" style={{ display: 'block' }}>
      {(['RAW MATERIALS', 'INTERMEDIATES', 'PARTS (TIER 1)', 'YOUR PLANT'] as const).map((h, i) => (
        <text key={h} x={[COL.raw, COL.inter, COL.part, COL.plant][i]} y={18} fontSize={11} fontWeight={700} fill="#9a9892">{h}</text>
      ))}
      {placed.map((g) => {
        const partY = g.top + (g.rows * ROW) / 2;
        const rawY = (i: number) => g.top + ROW / 2 + i * ROW + ((g.rows - g.raw.length) * ROW) / 2;
        const interY = (i: number) => g.top + ROW / 2 + i * ROW + ((g.rows - g.inter.length) * ROW) / 2;
        const imported = g.line.importedFrom !== 'India';
        return (
          <g key={g.line.id}>
            {g.raw.map((t, i) => <path key={`er${i}`} d={g.inter.length ? curve(COL.raw + BW, rawY(i), COL.inter, interY(Math.min(i, g.inter.length - 1))) : curve(COL.raw + BW, rawY(i), COL.part, partY)} fill="none" stroke={SUPPLY[t.indianSupply]} strokeOpacity={0.4} strokeWidth={1.5} />)}
            {g.inter.map((t, i) => <path key={`ei${i}`} d={curve(COL.inter + BW, interY(i), COL.part, partY)} fill="none" stroke={SUPPLY[t.indianSupply]} strokeOpacity={0.4} strokeWidth={1.5} />)}
            <path d={curve(COL.part + 200, partY, COL.plant, plantY)} fill="none" stroke={imported ? '#b4b2ac' : '#346538'} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray={imported ? '5 4' : undefined} />
            {g.raw.map((t, i) => box(COL.raw, rawY(i), t, `r${i}`))}
            {g.inter.map((t, i) => box(COL.inter, interY(i), t, `i${i}`))}
            <rect x={COL.part} y={partY - BOX / 2} width={200} height={BOX} rx={7} fill={imported ? '#f1f0ec' : '#edf3ec'} stroke={imported ? '#b4b2ac' : '#346538'} />
            <text x={COL.part + 10} y={partY - 4} fontSize={11.5} fontWeight={700} fill="#111111">{clip(g.line.name, 28)}</text>
            <text x={COL.part + 10} y={partY + 12} fontSize={10.5} fill={imported ? '#787774' : '#346538'}>{imported ? `Imported from ${g.line.importedFrom}` : 'Made in India'} · {g.line.sharePct.toFixed(0)}%</text>
          </g>
        );
      })}
      <rect x={COL.plant} y={plantY - 36} width={130} height={72} rx={10} fill="#edf3ec" stroke="#3d5a45" strokeWidth={1.5} />
      <text x={COL.plant + 65} y={plantY - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#111111">{clip(buyer.name, 18)}</text>
      <text x={COL.plant + 65} y={plantY + 10} textAnchor="middle" fontSize={11} fill="#6b6a66">{district(buyer.plantDistrictId).name}</text>
    </svg>
  );
}
