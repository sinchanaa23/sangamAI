// Total cost of ownership of a quote, so quotes can be compared like for like.
import { bom, sellers } from './data';
import { partRoute } from './chainRoute';
import type { Bidder, Quote, Requirement, StoreState } from './model';
import { trustScore } from './trust';
import type { Seller } from './types';

export function bidderSellers(b: Bidder, state: StoreState): { seller: Seller; share: number }[] {
  if (b.kind === 'seller') {
    const s = sellers.find((x) => x.id === b.id);
    return s ? [{ seller: s, share: 1 }] : [];
  }
  const c = state.consortia.find((x) => x.id === b.id);
  if (!c) return [];
  return c.members.filter((m) => m.status !== 'declined').map((m) => ({ seller: sellers.find((x) => x.id === m.sellerId)!, share: m.sharePct / 100 })).filter((x) => x.seller);
}

export function bidderName(b: Bidder, state: StoreState): string {
  if (b.kind === 'seller') return sellers.find((x) => x.id === b.id)?.name ?? 'Unknown supplier';
  const c = state.consortia.find((x) => x.id === b.id);
  return c ? `${c.name} (consortium)` : 'Consortium';
}

export interface Tco {
  price: number;
  freight: number;
  tooling: number;
  quality: number;
  risk: number;
  total: number;
  trust: number;
  days: number;
  capacityOk: boolean;
}

export function quoteTco(q: Quote, req: Requirement, state: StoreState): Tco {
  const line = bom.find((l) => l.id === req.lineId);
  const members = bidderSellers(q.bidder, state);
  let freight = 0, quality = 0, trust = 0, days = 0;
  members.forEach(({ seller, share }) => {
    if (line) {
      const r = partRoute(line, seller, share, 'balanced');
      freight += share * r.legs.filter((l) => l.mode !== 'make' && l.mode !== 'check').reduce((s, l) => s + l.cost, 0);
      days = Math.max(days, r.days);
    }
    quality += share * q.unitPrice * (seller.details.defectPpm / 1e6) * 3;
    trust += share * trustScore(seller, state).score;
  });
  const tooling = (q.toolingLakh * 1e5) / Math.max(1, req.monthlyVolume * 12);
  const risk = q.unitPrice * 0.03 * (1 - trust / 100);
  return { price: q.unitPrice, freight, tooling, quality, risk, total: q.unitPrice + freight + tooling + quality + risk, trust: Math.round(trust), days: Math.max(days, q.leadDays), capacityOk: q.capacity >= req.monthlyVolume };
}
