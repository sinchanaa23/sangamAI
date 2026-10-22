import { bom, buyer } from '../data';
import { district, isImported } from '../engine';
import type { Chain } from '../engine';

const W = 380, H = 440, PAD = 28;
const LON0 = 68.5, LON1 = 82.5, LAT0 = 8, LAT1 = 30;
const x = (lon: number) => PAD + ((lon - LON0) / (LON1 - LON0)) * (W - 2 * PAD);
const y = (lat: number) => PAD + ((LAT1 - lat) / (LAT1 - LAT0)) * (H - 2 * PAD);

// Labels that would collide go on the left
const LEFT = new Set(['hosur', 'coimbatore', 'satara', 'vapi', 'rajkot', 'dharwad']);

const COLOR = { ready: '#15803d', potential: '#b45309', import: '#94a3b8' };

export default function ChainMap({ chain }: { chain: Chain }) {
  const plant = district(buyer.plantDistrictId);
  const px = x(plant.lon), py = y(plant.lat);
  const links: { id: string; d: string; status: 'ready' | 'potential' }[] = [];
  const nodes = new Map<string, 'ready' | 'potential'>();
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
      if (d.id !== plant.id) links.push({ id: `${line.id}-${s.id}`, d: `M${x(d.lon)} ${y(d.lat)}L${px} ${py}`, status: o.status });
    });
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Supplier network for ${chain.name}`}>
      {/* faint graticule */}
      {[10, 15, 20, 25].map((lat) => (
        <line key={lat} x1={PAD} x2={W - PAD} y1={y(lat)} y2={y(lat)} stroke="#eef0f3" />
      ))}
      {[70, 74, 78, 82].map((lon) => (
        <line key={lon} y1={PAD} y2={H - PAD} x1={x(lon)} x2={x(lon)} stroke="#eef0f3" />
      ))}

      {anyImport && (
        <g>
          <path d={`M${W - 40} 40Q${W - 40} ${py - 60} ${px + 8} ${py - 6}`} fill="none" stroke={COLOR.import} strokeWidth="1.5" strokeDasharray="5 4" />
          <rect x={W - 104} y={18} width={92} height={24} rx={6} fill="#eef1f5" />
          <text x={W - 58} y={34} textAnchor="middle" fontSize="11" fill="#64748b">Still imported</text>
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
            <text x={x(d.lon) + (left ? -9 : 9)} y={y(d.lat) + 4} textAnchor={left ? 'end' : 'start'} fontSize="11.5" fill="#5a6472">{d.name}</text>
          </g>
        );
      })}

      <circle cx={px} cy={py} r={9} fill="#0f766e" />
      <circle cx={px} cy={py} r={14} fill="none" stroke="#0f766e" strokeOpacity="0.3" strokeWidth="5" />
      <text x={px - 18} y={py + 4} textAnchor="end" fontSize="12" fontWeight="600" fill="#18202b">Your plant, {plant.name}</text>

      <g transform={`translate(${PAD}, ${H - 14})`} fontSize="11" fill="#5a6472">
        <line x1="0" x2="18" y1="-4" y2="-4" stroke={COLOR.ready} strokeWidth="2" />
        <text x="24" y="0">Ready now</text>
        <line x1="96" x2="114" y1="-4" y2="-4" stroke={COLOR.potential} strokeWidth="2" strokeDasharray="5 4" />
        <text x="120" y="0">After gaps close</text>
      </g>
    </svg>
  );
}
