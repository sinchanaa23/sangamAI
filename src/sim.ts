// Disruption shock on today's import lane.
import { buyer } from './data';
import { LANES, evaluateLane } from './routes';
import type { LaneResult } from './routes';
import { DEFAULT_SCENARIO } from './scenario';
import type { Scenario } from './scenario';

/** Chance per year that a disruption like the simulated one happens. */
export const DISRUPTION_CHANCE = 0.35;
/** Contribution lost per scooter not built, in rupees. */
export const LOST_CONTRIBUTION = 1500;
/** Value of the one part already sourced in India (packaging), per harness. */
const DOMESTIC_TODAY = 252;

export const NEUTRAL: Scenario = { ...DEFAULT_SCENARIO, duty: 0, delayWeeks: 0, freightX: 1, fxPct: 0, closed: { taiwan: false, malacca: false, redSea: false, hormuz: false } };

export interface Shock {
  unitCost: number;
  extraPerMonth: number;
  leadDays: number;
  stockoutDays: number;
  lostUnits: number;
  lane: LaneResult;
}

export function simulateShock(s: Scenario): Shock {
  const today = LANES.find((l) => l.id === 'cn-sea')!;
  const lane = evaluateLane(today, s);
  const base = evaluateLane(today, NEUTRAL);
  const unitCost = DOMESTIC_TODAY + lane.costPerHarness;
  const leadDays = buyer.importLeadDays + (lane.days - base.days);
  const stockoutDays = Math.max(0, leadDays - buyer.importLeadDays - buyer.safetyStockDays);
  return {
    unitCost,
    extraPerMonth: (unitCost - buyer.unitCost) * buyer.monthlyUnits,
    leadDays,
    stockoutDays,
    lostUnits: Math.round((stockoutDays * buyer.monthlyUnits) / 30),
    lane,
  };
}

/** Expected yearly loss from disruptions while `importSharePct` of the harness is imported. */
export function expectedDisruptionLoss(s: Scenario, importSharePct: number, unitsPerYear: number): number {
  const days = Math.max(simulateShock(s).stockoutDays, 5); // a 5-day stock-out risk is priced in even in calm years
  return DISRUPTION_CHANCE * days * (unitsPerYear / 365) * LOST_CONTRIBUTION * (importSharePct / 100);
}
