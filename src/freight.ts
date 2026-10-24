// Road freight: one set of figures for the whole app (supplier delivered cost in engine.ts, domestic lanes in routes.ts).
// An estimate, not a quoted rate; every cost built from it is tagged estimated.
import type { Provenance } from './types';

export const FREIGHT_SOURCE: Provenance = 'estimated';
/** Full-truck-load road freight, rupees per tonne-km */
export const ROAD_RS_PER_TONNE_KM = 3.0;
/** Road distance as a multiple of the straight line between two places */
export const ROAD_FACTOR = 1.3;
