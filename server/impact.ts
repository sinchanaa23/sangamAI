// SDG 8 totals for the impact dashboard. Owned by P4; mounted by P1 alongside credentialRoutes.
import { json } from './credentials';
import type { Route } from './credentials';
import { computeImpact } from '../src/ecosystem/impact';
import type { DealRecord } from '../src/ecosystem/impact';

/** P1 points this at the confirmed deals in SQLite, one record per supplier share of a deal. */
let source: () => DealRecord[] | Promise<DealRecord[]> = () => [];
export const setDealSource = (fn: typeof source) => { source = fn; };

export const impactRoutes: Route[] = [
  // The records travel too, so the page can merge them with deals awarded in the browser
  { method: 'GET', path: '/api/impact', handler: async () => { const deals = await source(); return json({ ...computeImpact(deals), deals }); } },
];
