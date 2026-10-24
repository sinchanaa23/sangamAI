import { bom, buyer } from '../data';
import { district, isImported } from '../engine';
import type { Chain } from '../engine';

const W = 380, H = 400, PAD = 56;

// Labels that would collide go on the left
const LEFT = new Set(['hosur', 'coimbatore', 'satara', 'vapi', 'rajkot', 'dharwad']);

const COLOR = { ready: '#346538', potential: '#956400', import: '#b4b2ac' };

export default function ChainMap({ chain }: { chain: Chain }) {
  const plant = district(buyer.plantDistrictId);

  // Fit the view to the plant and the suppliers in this chain, keeping the aspect ratio
  const pts = [plant, ...bom.flatMap((l) => chain.picks[l.id]?.sellers.map((s) => district(s.districtId)) ?? [])];
  const lon0 = Math.min(...pts.map((p) => p.lon)), lon1 = Math.max(...pts.map((p) => p.lon));
  const lat0 = Math.min(...pts.map((p) => p.lat)), lat1 = Math.max(...pts.map((p) => p.lat));
  const scale = Math.min((W - 2 * PAD) / Math.max(lon1 - lon0, 1), (H - 2 * PAD) / Math.max(lat1 - lat0, 1));
  const ox = (W - (lon1 - lon0) * scale) / 2, oy = (H - (lat1 - lat0) * scale) / 2;
  const x = (lon: number) => ox + (lon - lon0) * scale;
  const y = (lat: number) => oy + (lat1 - lat) * scale;

  const px = x(plant.lon), py = y(plant.lat);
  const links: { id: string; d: string; status: 'ready' | 'potential' }[] = [];
  const nodes = new Map<string, 'ready' | 'potential'>();
  const local: { id: string; status: 'ready' | 'potential' }[] = [];
  let anyImport = false;

  bom.forEach((line) => {
    const o = chain.picks[line.id];
    if (!o) {
      if (isImported(line)) anyImport = true;
      return;
    }
    o.sellers.forEach((s) => {
      const d = district(s.districtId);
      if (nodes.get(d.id) !== 'potential') nodes.set(d.id, o.status);
      if (d.id === plant.id) local.push({ id: s.id, status: o.status });
      else links.push({ id: `${line.id}-${s.id}`, d: `M${x(d.lon)} ${y(d.lat)}L${px} ${py}`, status: o.status });
    });
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Supplier network for ${chain.name}`}>
      {anyImport && (
        <g>
          <path d={`M${W - 58} 42Q${W - 58} ${(py + 42) / 2} ${px + 12} ${py - 8}`} fill="none" stroke={COLOR.import} strokeWidth="1.5" strokeDasharray="5 4" />
          <rect x={W - 104} y={18} width={92} height={24} rx={6} fill="#efeeea" />
          <text x={W - 58} y={34} textAnchor="middle" fontSize="11" fill="#787774">Still imported</text>
        </g>
      )}

      {links.map((l) => (
        <path key={l.id} d={l.d} stroke={COLOR[l.status]} strokeWidth="1.6" strokeDasharray={l.status === 'potential' ? '5 4' : undefined} fill="none" opacity="0.85" />
      ))}

      {[...nodes.entries()].filter(([id]) => id !== plant.id).map(([id, status]) => {
        const d = district(id);
        const left = LEFT.has(id);
        return (
          <g key={id}>
            <circle cx={x(d.lon)} cy={y(d.lat)} r={5} fill="#fff" stroke={COLOR[status]} strokeWidth="2" />
            <text x={x(d.lon) + (left ? -9 : Math.hypot(x(d.lon) - px, y(d.lat) - py) < 22 ? 18 : 9)} y={y(d.lat) + 4} textAnchor={left ? 'end' : 'start'} fontSize="11.5" fill="#6b6a66">{d.name}</text>
          </g>
        );
      })}

      <circle cx={px} cy={py} r={9} fill="#3d5a45" />
      <circle cx={px} cy={py} r={14} fill="none" stroke="#3d5a45" strokeOpacity="0.3" strokeWidth="5" />
      <text x={px - 18} y={py + 4} textAnchor="end" fontSize="12" fontWeight="600" fill="#111111">Your plant, {plant.name}</text>
      {local.length > 0 && (
        <text x={px - 18} y={py + 20} textAnchor="end" fontSize="11" fill={local.some((l) => l.status === 'potential') ? COLOR.potential : COLOR.ready}>
          + {local.length} supplier{local.length > 1 ? 's' : ''} in {plant.name}
        </text>
      )}

      <g transform={`translate(${PAD}, ${H - 14})`} fontSize="11" fill="#6b6a66">
        <line x1="0" x2="18" y1="-4" y2="-4" stroke={COLOR.ready} strokeWidth="2" />
        <text x="24" y="0">Ready now</text>
        <line x1="96" x2="114" y1="-4" y2="-4" stroke={COLOR.potential} strokeWidth="2" strokeDasharray="5 4" />
        <text x="120" y="0">After gaps close</text>
      </g>
    </svg>
  );
}
