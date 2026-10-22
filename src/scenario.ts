export type Chokepoint = 'taiwan' | 'malacca' | 'redSea' | 'hormuz';

export const CHOKEPOINTS: { id: Chokepoint; name: string; lon: number; lat: number }[] = [
  { id: 'taiwan', name: 'Taiwan Strait', lon: 119.5, lat: 24.0 },
  { id: 'malacca', name: 'Strait of Malacca', lon: 100.5, lat: 3.2 },
  { id: 'redSea', name: 'Red Sea and Suez', lon: 43.4, lat: 12.6 },
  { id: 'hormuz', name: 'Strait of Hormuz', lon: 56.3, lat: 26.5 },
];

/** Everything the buyer can change in the what-if simulator. Shared by all buyer pages. */
export interface Scenario {
  /** extra import duty on goods from today's source region, % */
  duty: number;
  /** extra shipping delay on today's lane, weeks */
  delayWeeks: number;
  /** ocean freight rate multiplier (1 = normal) */
  freightX: number;
  /** rupee depreciation against the dollar, % */
  fxPct: number;
  /** chokepoints closed to shipping */
  closed: Record<Chokepoint, boolean>;
}

export const DEFAULT_SCENARIO: Scenario = {
  duty: 25,
  delayWeeks: 4,
  freightX: 1,
  fxPct: 0,
  closed: { taiwan: false, malacca: false, redSea: false, hormuz: false },
};
