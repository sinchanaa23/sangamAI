// Confirmed deals in this browser (awarded quotes), as records for the impact dashboard.
// Agent-negotiated deals come from the server's /api/impact once P1's store is running.
import { bom, sellers } from '../data';
import { isImported, isRural } from '../engine';
import type { StoreState } from '../model';
import type { DealRecord } from './impact';

export function localDeals(state: StoreState): DealRecord[] {
  const out: DealRecord[] = [];
  state.requirements.filter((r) => r.sector === state.sector && r.status === 'awarded').forEach((r) => {
    const q = state.quotes.find((x) => x.id === r.awardedQuoteId);
    const line = bom.find((l) => l.id === r.lineId);
    if (!q || !line) return;
    const shares = q.bidder.kind === 'seller'
      ? [{ sellerId: q.bidder.id, share: 1 }]
      : (state.consortia.find((c) => c.id === q.bidder.id)?.members ?? []).filter((m) => m.status === 'accepted').map((m) => ({ sellerId: m.sellerId, share: m.sharePct / 100 }));
    const yearValue = q.unitPrice * r.monthlyVolume * 12;
    shares.forEach(({ sellerId, share }) => {
      const s = sellers.find((x) => x.id === sellerId);
      if (!s) return;
      // Workers on this deal: the supplier's workforce scaled by how much of its capacity the order uses
      const used = Math.min(1, (r.monthlyVolume * share) / Math.max(1, s.monthlyCapacity));
      out.push({
        id: `${r.id}:${sellerId}`, reqId: r.id, sellerId, districtId: s.districtId, rural: isRural(s),
        valueInr: yearValue * share, importReplacedInr: isImported(line) ? yearValue * share : 0,
        workers: s.workers * used, workersSource: 'estimated',
        source: r.sample || s.origin === 'simulated' ? 'simulated' : 'declared',
      });
    });
  });
  return out;
}
