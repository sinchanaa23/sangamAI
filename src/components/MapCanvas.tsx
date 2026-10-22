import { useMemo } from 'react';
import { geoArea, geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import india from '../geo/india.json';
import type { LonLat } from '../routes';

// Countries from Natural Earth (world-atlas). India is drawn from the DataMeet
// composite boundary (CC BY 4.0) on top, so the full official outline is shown.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const countries = (feature(world as any, (world as any).objects.countries) as any).features.filter((f: any) => f.id !== '356');
// d3-geo expects clockwise outer rings; the source file uses the opposite (RFC 7946) winding,
// which d3 reads as "the whole globe except India". Reverse the rings if so.
const fixPolygon = (rings: number[][][]) =>
  geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings;
/* eslint-disable @typescript-eslint/no-explicit-any */
const rewind = (g: any): any => {
  if (!g) return g;
  switch (g.type) {
    case 'Polygon': return { ...g, coordinates: fixPolygon(g.coordinates) };
    case 'MultiPolygon': return { ...g, coordinates: g.coordinates.map(fixPolygon) };
    case 'GeometryCollection': return { ...g, geometries: g.geometries.map(rewind) };
    case 'Feature': return { ...g, geometry: rewind(g.geometry) };
    case 'FeatureCollection': return { ...g, features: g.features.map(rewind) };
    default: return g;
  }
};
/* eslint-enable @typescript-eslint/no-explicit-any */
const indiaShape = rewind(india) as GeoPermissibleObjects;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const land = countries.map(rewind).filter((c: any) => c.id !== '010'); // drop Antarctica

export interface MapLine {
  id: string;
  coords: LonLat[];
  color: string;
  width?: number;
  dash?: string;
  opacity?: number;
}

export interface MapPoint {
  id: string;
  at: LonLat;
  color: string;
  label?: string;
  r?: number;
  ring?: boolean;
  side?: 'left' | 'right' | 'top' | 'bottom';
  bold?: boolean;
  hollow?: boolean;
}

interface Props {
  view: 'world' | 'india';
  lines: MapLine[];
  points: MapPoint[];
  ariaLabel: string;
}

const SIZE = { world: [760, 400], india: [420, 470] } as const;

export default function MapCanvas({ view, lines, points, ariaLabel }: Props) {
  const [W, H] = SIZE[view];
  const { path, proj } = useMemo(() => {
    const proj = view === 'world'
      ? geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], { type: 'MultiPoint', coordinates: [[-22, -38], [142, -38], [142, 56], [-22, 56]] })
      : geoMercator().fitExtent([[12, 12], [W - 12, H - 12]], { type: 'MultiPoint', coordinates: [[68, 5], [97.5, 5], [97.5, 37], [68, 37]] });
    return { path: geoPath(proj), proj };
  }, [view, W, H]);
  const project = (p: LonLat) => proj([p[0], p[1]]) as [number, number];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
      <rect width={W} height={H} rx={10} fill="var(--sea)" />
      <g>
        {land.map((c: { id: string }, i: number) => (
          <path key={c.id ?? `c${i}`} d={path(c as GeoPermissibleObjects) ?? ''} fill="var(--land)" stroke="#d3dbe3" strokeWidth={0.5} />
        ))}
        <path d={path(indiaShape) ?? ''} fill="var(--india)" stroke="var(--india-edge)" strokeWidth={0.8} />
      </g>

      {lines.map((l) => (
        <path
          key={l.id}
          d={path({ type: 'LineString', coordinates: l.coords }) ?? ''}
          fill="none"
          stroke={l.color}
          strokeWidth={l.width ?? 1.6}
          strokeDasharray={l.dash}
          strokeOpacity={l.opacity ?? 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {points.map((p) => {
        const [x, y] = project(p.at);
        const r = p.r ?? 4;
        const side = p.side ?? 'right';
        const dx = side === 'left' ? -(r + 5) : side === 'right' ? r + 5 : 0;
        const dy = side === 'top' ? -(r + 6) : side === 'bottom' ? r + 13 : 4;
        return (
          <g key={p.id}>
            {p.ring && <circle cx={x} cy={y} r={r + 5} fill={p.color} fillOpacity={0.18} />}
            <circle cx={x} cy={y} r={r} fill={p.hollow ? '#fff' : p.color} stroke={p.color} strokeWidth={p.hollow ? 2 : 1} />
            {p.label && (
              <text
                x={x + dx}
                y={y + dy}
                textAnchor={side === 'left' ? 'end' : side === 'right' ? 'start' : 'middle'}
                fontSize={view === 'world' ? 10.5 : 11}
                fontWeight={p.bold ? 600 : 400}
                fill="var(--ink)"
                paintOrder="stroke"
                stroke="var(--sea)"
                strokeWidth={3}
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
