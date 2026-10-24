// F7: global buyer mode. Where the buyer is, what currency they think in, and the fixed
// exchange-rate table used to convert. Kept per browser (it is the buyer's own preference).
import { useSyncExternalStore } from 'react';
import { LANES, USD_INR } from '../../routes';
import type { IntlLane } from '../../routes';

export type Currency = 'INR' | 'USD' | 'EUR';

export interface BuyerCountry {
  code: string;
  name: string;
  currency: Currency;
  /** sea lane the goods leave India on; none for buyers in India */
  laneId?: string;
  /** what the route does not cover */
  onward?: string;
}

export const COUNTRIES: BuyerCountry[] = [
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'DE', name: 'Germany', currency: 'EUR', laneId: 'eu-sea', onward: 'Rotterdam to your site in Germany by road or rail is not included' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', laneId: 'eu-sea' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'USD', laneId: 'ae-sea' },
  { code: 'JP', name: 'Japan', currency: 'USD', laneId: 'jp-sea' },
  { code: 'KR', name: 'South Korea', currency: 'USD', laneId: 'kr-sea' },
  { code: 'VN', name: 'Vietnam', currency: 'USD', laneId: 'vn-sea' },
  { code: 'TH', name: 'Thailand', currency: 'USD', laneId: 'th-sea' },
];

/** Rupees per unit of each currency. A fixed table, not a live feed; edit it on the requirements page. */
export const DEFAULT_RATES: Record<Currency, number> = { INR: 1, USD: USD_INR, EUR: 108 };
export const RATES_AS_OF = '2026-10-24';

export interface GlobalBuyer {
  country: string;
  currency: Currency;
  rates: Record<Currency, number>;
  /** the buyer's own import duty on the part, percent */
  dutyPct: number;
}

const KEY = 'sangam.globalBuyer';
const DEFAULT: GlobalBuyer = { country: 'IN', currency: 'INR', rates: DEFAULT_RATES, dutyPct: 0 };

function load(): GlobalBuyer {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch { return DEFAULT; }
}

let current = load();
const listeners = new Set<() => void>();

export function setGlobalBuyer(patch: Partial<GlobalBuyer>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* private window: keep in memory */ }
  listeners.forEach((l) => l());
}

export function useGlobalBuyer(): GlobalBuyer {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}

export const countryOf = (code: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
export const laneFor = (code: string): IntlLane | undefined => LANES.find((l) => l.id === countryOf(code).laneId);

const SYMBOL: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€' };

/** Format a rupee amount in the buyer's currency. */
export function fmt(inrAmount: number, g: GlobalBuyer, digits?: number) {
  const v = inrAmount / g.rates[g.currency];
  if (g.currency === 'INR') return '₹' + Math.round(v).toLocaleString('en-IN');
  const d = digits ?? (Math.abs(v) < 100 ? 2 : 0);
  return SYMBOL[g.currency] + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
