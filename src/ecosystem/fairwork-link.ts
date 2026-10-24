// Connects the ecosystem pages to P3's Fair Work Scorecard and workforce profiles,
// and feeds worker grievances reported on Sangam into the grade.
import { useEffect, useState } from 'react';
import { labourFromProfile, livingWageFor, scoreProfile } from '../fairwork';
import type { ScoredWork, WorkforceProfile } from '../fairwork';
import { loadWorkforce } from '../seller/workforce';
import type { WorkforceSource } from '../seller/workforce';
import type { Provenance } from '../types';
import type { DealRecord } from './impact';
import { openGrievanceCount, useLedger } from './ledger';

export const workforceProvenance = (s: WorkforceSource): Provenance => (s === 'seed' ? 'simulated' : 'declared');

/** The profile with grievances reported on Sangam counted, so an open report lowers the grade. */
export const withGrievances = (p: WorkforceProfile): WorkforceProfile =>
  ({ ...p, openGrievances: Math.max(p.openGrievances, openGrievanceCount(p.supplierId)) });

export interface SupplierWork { profile: WorkforceProfile; score: ScoredWork; source: WorkforceSource }

/** A supplier's workforce and Fair Work grade; null while loading or when no profile exists. */
export function useSupplierWork(sellerId: string, sellerName: string): SupplierWork | null {
  useLedger(); // re-score when a grievance opens or closes
  const [loaded, setLoaded] = useState<{ id: string; profile: WorkforceProfile; source: WorkforceSource } | null>(null);
  useEffect(() => {
    let live = true;
    void loadWorkforce(sellerId, sellerName).then((r) => { if (live && r.profile) setLoaded({ id: sellerId, profile: r.profile, source: r.source }); else if (live) setLoaded(null); });
    return () => { live = false; };
  }, [sellerId, sellerName]);
  if (!loaded || loaded.id !== sellerId) return null;
  const profile = withGrievances(loaded.profile);
  return { profile, score: scoreProfile(profile), source: loaded.source };
}

/**
 * Fills wages and women's share on deals that lack them, from each supplier's workforce profile.
 * Agent deals already carry them from their labour plan and are left as they are.
 */
export async function withWorkforce(deals: DealRecord[], sellerName: (id: string) => string): Promise<DealRecord[]> {
  const cache = new Map<string, Awaited<ReturnType<typeof loadWorkforce>>>();
  const out: DealRecord[] = [];
  for (const d of deals) {
    if (d.wagePerDay !== undefined) { out.push(d); continue; }
    if (!cache.has(d.sellerId)) cache.set(d.sellerId, await loadWorkforce(d.sellerId, sellerName(d.sellerId)));
    const { profile, source } = cache.get(d.sellerId)!;
    if (!profile) { out.push(d); continue; }
    const plan = labourFromProfile(profile);
    const lw = livingWageFor(profile.district);
    out.push({
      ...d, wagePerDay: plan.wagePerWorkerDay, livingWagePerDay: lw?.perDayInr, womenShare: plan.womenShare,
      workforceSource: workforceProvenance(source),
    });
  }
  return out;
}
