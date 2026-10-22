// A domestic part's full route: upstream inputs, the supplier's production, transport legs and receiving.
import { buyer } from './data';
import { district } from './engine';
import { METRICS } from './realdata';
import { domesticLanes } from './routes';
import type { DomesticLane, Leg } from './routes';
import type { BomLine, Seller } from './types';

export type Priority = 'cost' | 'time' | 'balanced';

export function rank<T>(items: T[], cost: (t: T) => number, time: (t: T) => number, extra: (t: T) => number, p: Priority): T[] {
  const n = (f: (t: T) => number) => {
    const v = items.map(f), lo = Math.min(...v), hi = Math.max(...v);
    return (t: T) => (hi === lo ? 0 : (f(t) - lo) / (hi - lo));
  };
  const c = n(cost), t = n(time);
  const w = p === 'cost' ? [1, 0.15] : p === 'time' ? [0.15, 1] : [1, 1];
  return [...items].sort((a, b) => w[0] * c(a) + w[1] * t(a) + extra(a) - (w[0] * c(b) + w[1] * t(b) + extra(b)));
}

export interface PartRoute {
  seller: Seller;
  share: number;
  lane: DomesticLane | null;
  options: DomesticLane[];
  legs: Leg[];
  days: number;
  p90: number;
  cost: number;
  reliability: number;
  co2: number;
}

export function partRoute(line: BomLine, seller: Seller, share: number, priority: Priority): PartRoute {
  const from = district(seller.districtId);
  const plant = district(buyer.plantDistrictId);
  const m = METRICS[seller.districtId];
  const tonnesPerUnit = line.weightKg / 1000;
  const options = from.id === plant.id ? [] : domesticLanes(from);
  const lane = options.length ? rank(options, (l) => l.costPerT, (l) => l.days, () => 0, priority)[0] : null;
  const price = line.cost * seller.priceIndex;
  const otif = seller.details.otifPct / 100;
  const risks: string[] = [];
  if (seller.details.utilisationPct > 85) risks.push(`Capacity ${seller.details.utilisationPct}% used`);
  if (m.climateScore > 0.6) risks.push('High heavy-rain or heat exposure');
  if (seller.verification !== 'verified') risks.push('Capacity not yet verified');

  const legs: Leg[] = [{
    id: 'make', title: 'Production', who: seller.name, place: `${from.name}, ${from.state}`, mode: 'make',
    days: 12, p90: 12 + Math.round((1 - otif) * 40), cost: price, reliability: otif, damagePct: seller.details.defectPpm / 10000, co2Kg: 0,
    documents: ['Purchase order', 'Tax invoice', 'Certificate of conformity', ...(line.requiredCerts.length ? ['Test reports'] : [])],
    risks, src: seller.origin === 'simulated' ? 'simulated' : 'declared',
    note: `${seller.details.defectPpm} ppm defects, ${seller.details.otifPct}% on time in full, ${Math.round(seller.monthlyCapacity * (1 - seller.details.utilisationPct / 100)).toLocaleString('en-IN')} units a month free`,
  }];
  (lane?.legs ?? [{ id: 'local', title: 'Local delivery', who: 'Supplier’s own vehicle', place: `Within ${plant.name}`, mode: 'road' as const, days: 1, p90: 1, cost: 300 * 20, reliability: 0.97, damagePct: 0.02, co2Kg: 20 * 0.062 * 20, documents: ['Delivery challan', 'E-way bill'], risks: [], src: 'estimated' as const }])
    .forEach((l) => legs.push({ ...l, cost: l.cost * tonnesPerUnit, co2Kg: l.co2Kg * tonnesPerUnit }));
  legs.push({ id: 'check', title: 'Receiving inspection', who: 'Your quality team', place: plant.name, mode: 'check', days: 1, p90: 2, cost: price * (seller.details.defectPpm / 1e6) * 3, reliability: 1, damagePct: 0, co2Kg: 0, documents: ['Goods receipt note'], risks: [], src: 'estimated', note: 'Cost of defects: rework or scrap at 3x part value' });

  const days = Math.round(legs.reduce((s, l) => s + l.days, 0));
  const p90 = Math.round(days + Math.sqrt(legs.reduce((s, l) => s + (l.p90 - l.days) ** 2, 0)));
  return {
    seller, share, lane, options, legs, days, p90,
    cost: legs.reduce((s, l) => s + l.cost, 0),
    reliability: legs.reduce((p, l) => p * (l.reliability > 0.99 ? 1 : 0.6 + 0.4 * l.reliability), 1),
    co2: legs.reduce((s, l) => s + l.co2Kg, 0),
  };
}
