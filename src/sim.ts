// Disruption shock on today's import lane.
import { buyer } from './data';
import { domesticCost, evaluateLane, todayLane } from './routes';
import type { LaneResult } from './routes';
import { DEFAULT_SCENARIO } from './scenario';
import type { Scenario } from './scenario';

/** Chance per year that a disruption like the simulated one happens. */
export const DISRUPTION_CHANCE = 0.35;

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
  const today = todayLane();
  const lane = evaluateLane(today, s);
  const base = evaluateLane(today, NEUTRAL);
  const unitCost = domesticCost() + lane.costPerUnit - (base.costPerUnit - (buyer.unitCost - domesticCost()));
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

/** Expected yearly loss from disruptions while `importSharePct` of the product is imported. */
export function expectedDisruptionLoss(s: Scenario, importSharePct: number, unitsPerYear: number): number {
  const days = Math.max(simulateShock(s).stockoutDays, 5); // a 5-day stock-out risk is priced in even in calm years
  return DISRUPTION_CHANCE * days * (unitsPerYear / 365) * buyer.lostContribution * (importSharePct / 100);
}
