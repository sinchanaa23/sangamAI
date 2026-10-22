import { buyer } from '../data';
import { district, inr } from '../engine';
import type { Architecture, NodeStatus } from '../network';

export const STATUS_COLOR: Record<NodeStatus, string> = { available: '#15803d', upgrade: '#b45309', new: '#7c3aed' };
export const STATUS_LABEL: Record<NodeStatus, string> = { available: 'Available now', upgrade: 'Needs upgrade', new: 'New setup' };

const W = 760, ROW = 58, BOX_H = 46, TOP = 36;
const PX = 12, PW = 200, NX = 282, NW = 290, TX = 636, TW = 112;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Parts on the left, the sites that make them in the middle, the plant on the right. */
export default function NetworkDiagram({ arch }: { arch: Architecture }) {
  const nodes = arch.lines.flatMap((l) => l.nodes.map((n) => ({ ...n, line: l })));
  const H = TOP + nodes.length * ROW + 12;
  const ny = (i: number) => TOP + i * ROW + BOX_H / 2;
  let idx = 0;
  const partY = arch.lines.map((l) => {
    const ys = l.nodes.map(() => ny(idx++));
    return ys.reduce((a, b) => a + b, 0) / ys.length;
  });
  const plantY = (TOP + H - 12) / 2;
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${arch.name} network diagram`} style={{ display: 'block' }}>
      <text x={PX} y={20} fontSize={11.5} fontWeight={600} fill="#8a93a0">PART · COST VS IMPORT</text>
      <text x={NX} y={20} fontSize={11.5} fontWeight={600} fill="#8a93a0">WHERE IT IS MADE</text>
      <text x={TX} y={20} fontSize={11.5} fontWeight={600} fill="#8a93a0">PLANT</text>

      {/* edges */}
      {nodes.map((n, i) => {
        const li = arch.lines.indexOf(n.line);
        return (
          <g key={`e${i}`} fill="none" stroke={STATUS_COLOR[n.status]} strokeOpacity={0.55}>
            <path d={curve(PX + PW, partY[li], NX, ny(i))} strokeWidth={1 + n.share * 4} />
            <path d={curve(NX + NW, ny(i), TX, plantY)} strokeWidth={1 + n.share * 2} />
          </g>
        );
      })}

      {/* parts */}
      {arch.lines.map((l, i) => {
        const cheaper = l.deltaPct < 0;
        return (
          <g key={l.line.id}>
            <rect x={PX} y={partY[i] - BOX_H / 2} width={PW} height={BOX_H} rx={8} fill="#fff" stroke="#d7dce2" />
            <text x={PX + 12} y={partY[i] - 4} fontSize={12.5} fontWeight={600} fill="#18202b">{clip(l.line.name, 27)}</text>
            <text x={PX + 12} y={partY[i] + 13} fontSize={11.5} fill={cheaper ? '#15803d' : '#b91c1c'}>
              {inr(l.cost)} · {Math.abs(l.deltaPct).toFixed(0)}% {cheaper ? 'less' : 'more'}
            </text>
          </g>
        );
      })}

      {/* sites */}
      {nodes.map((n, i) => (
        <g key={`n${i}`}>
          <rect x={NX} y={ny(i) - BOX_H / 2} width={NW} height={BOX_H} rx={8} fill="#fff" stroke={STATUS_COLOR[n.status]} strokeWidth={1.3} />
          <rect x={NX} y={ny(i) - BOX_H / 2} width={5} height={BOX_H} rx={2} fill={STATUS_COLOR[n.status]} />
          <text x={NX + 14} y={ny(i) - 4} fontSize={12} fontWeight={600} fill="#18202b">{clip(n.name, 38)}</text>
          <text x={NX + 14} y={ny(i) + 13} fontSize={11} fill="#5a6472">
            {district(n.districtId).name} · {Math.round(n.share * 100)}% ·{' '}
            <tspan fill={STATUS_COLOR[n.status]} fontWeight={600}>{STATUS_LABEL[n.status]}{n.capexCr > 0 ? ` ₹${n.capexCr < 1 ? n.capexCr.toFixed(2) : n.capexCr.toFixed(1)} Cr` : ''}</tspan>
          </text>
        </g>
      ))}

      {/* plant */}
      <rect x={TX} y={plantY - 40} width={TW} height={80} rx={10} fill="#e6f4f2" stroke="#0f766e" strokeWidth={1.5} />
      <text x={TX + TW / 2} y={plantY - 14} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#18202b">Your plant</text>
      <text x={TX + TW / 2} y={plantY + 3} textAnchor="middle" fontSize={11.5} fill="#5a6472">{district(buyer.plantDistrictId).name}</text>
      <text x={TX + TW / 2} y={plantY + 22} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0f766e">{inr(arch.unitCost)}</text>
    </svg>
  );
}
