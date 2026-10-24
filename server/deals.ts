// Turns confirmed deals in the store into the records P4's SDG 8 dashboard counts (jobs, wage uplift, women's share, imports replaced).
import { sellers } from '../src/data';
import { isImported, isRural } from '../src/engine';
import type { FairWorkScore, Offer, Rfq } from '../src/contracts';
import type { DealRecord } from '../src/ecosystem/impact';
import { ensureDataset, FX_INR, pickLine, wageFloorPerDay } from './agents/tools';
import type { Db, Doc } from './db';

/** What the orchestrator stores when the Auditor passes or flags a deal. */
export interface StoredDeal extends Doc {
  negotiationId: string;
  rfqId: string;
  supplierId: string;
  offer: Offer;
  score: FairWorkScore & { livingWagePerDayInr?: number | null };
  decision: 'pass' | 'flag';
  /** a flagged deal waits for the Sangam team and is not counted until it is confirmed */
  status: 'confirmed' | 'pending-review';
}

export function dealRecords(db: Db): DealRecord[] {
  ensureDataset();
  return db.list<StoredDeal>('deals').flatMap((d) => {
    if (d.status !== 'confirmed') return [];
    const seller = sellers.find((s) => s.id === d.supplierId);
    const rfq = db.get<Rfq & Doc>('rfqs', d.rfqId);
    if (!seller || !rfq) return [];
    const line = pickLine(rfq.part);
    const valueInr = d.offer.price.amount * FX_INR[d.offer.price.currency];
    const simulated = seller.origin === 'simulated';
    return [{
      id: d.id, reqId: d.rfqId, sellerId: seller.id, districtId: seller.districtId, rural: isRural(seller),
      // Agent deals count the order value, not a year of business
      valueInr, importReplacedInr: isImported(line) ? valueInr : 0,
      workers: d.offer.labour.workers, workersSource: simulated ? 'simulated' : 'declared',
      womenShare: d.offer.labour.womenShare, wagePerDay: d.offer.labour.wagePerWorkerDay,
      livingWagePerDay: d.score.livingWagePerDayInr ?? wageFloorPerDay(seller.districtId),
      source: simulated ? 'simulated' : 'declared',
    }];
  });
}
