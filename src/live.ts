// Live world signals from free public APIs, called from the browser.
// - Exchange rates: Frankfurter (European Central Bank reference rates)
// - Disasters: GDACS (Global Disaster Alert and Coordination System)
// - News: GDELT DOC 2.0 API (best effort; it is often rate-limited)
import { km, RISK_PRIOR } from './routes';
import type { LonLat } from './routes';
import { CHOKEPOINTS } from './scenario';
import type { Chokepoint, Scenario } from './scenario';

export type FeedState<T> = { status: 'loading' } | { status: 'ok'; data: T; at: Date } | { status: 'error'; message: string };

export interface Fx { usdInr: number; cnyInr: number; usdInr30d: number; changePct: number; date: string }
export interface Hazard { id: string; type: string; name: string; level: 'Orange' | 'Red'; at: LonLat; country: string; until: string; url?: string; source: string }
export interface Headline { title: string; url: string; domain: string; seen: string; tags: Watch[] }

export type Watch = Chokepoint | 'chennai' | 'shanghai';

export const WATCH_POINTS: { id: Watch; name: string; at: LonLat }[] = [
  ...CHOKEPOINTS.map((c) => ({ id: c.id as Watch, name: c.name, at: [c.lon, c.lat] as LonLat })),
  { id: 'shanghai', name: 'Shanghai port', at: [121.8, 31.0] },
  { id: 'chennai', name: 'Chennai port', at: [80.35, 13.1] },
];

const KEYWORDS: Record<Watch, RegExp> = {
  redSea: /red sea|suez|houthi|bab[- ]el[- ]mandeb|gulf of aden/i,
  hormuz: /hormuz|persian gulf|strait of hormuz/i,
  malacca: /malacca|singapore strait|singapore port/i,
  taiwan: /taiwan strait|taiwan blockade|taiwan/i,
  shanghai: /shanghai|china export|export ban|export control|rare earth|china tariff/i,
  chennai: /chennai|ennore|indian port|india port/i,
};

const timeout = (ms: number) => AbortSignal.timeout(ms);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function fetchFx(): Promise<Fx> {
  const past = new Date(Date.now() - 30 * 864e5);
  const [now, then] = await Promise.all([
    fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR,CNY', { signal: timeout(12000) }).then((r) => r.json()),
    fetch(`https://api.frankfurter.dev/v1/${isoDay(past)}?base=USD&symbols=INR`, { signal: timeout(12000) }).then((r) => r.json()),
  ]);
  const usdInr = now.rates.INR, cnyInr = now.rates.INR / now.rates.CNY, usdInr30d = then.rates.INR;
  return { usdInr, cnyInr, usdInr30d, changePct: ((usdInr - usdInr30d) / usdInr30d) * 100, date: now.date };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchGdacs(): Promise<Hazard[]> {
  const r = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;FL;EQ&alertlevel=Orange;Red', { signal: timeout(12000) });
  const j = await r.json();
  const since = Date.now() - 14 * 864e5;
  return (j.features as any[])
    .filter((f) => Date.parse(f.properties.todate) >= since)
    .map((f) => ({
      id: `${f.properties.eventtype}-${f.properties.eventid}`,
      type: ({ TC: 'Cyclone', FL: 'Flood', EQ: 'Earthquake' } as Record<string, string>)[f.properties.eventtype] ?? f.properties.eventtype,
      name: f.properties.name,
      level: f.properties.alertlevel,
      at: f.geometry.coordinates as LonLat,
      country: f.properties.country,
      until: f.properties.todate,
      url: f.properties.url?.report,
      source: 'GDACS',
    }));
}

/** Fallback when GDACS is slow: NASA EONET storms and volcanoes plus USGS significant earthquakes. */
async function fetchEonetUsgs(): Promise<Hazard[]> {
  const [eonet, usgs] = await Promise.all([
    fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=14&category=severeStorms,volcanoes,floods', { signal: timeout(12000) }).then((r) => r.json()),
    fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson', { signal: timeout(12000) }).then((r) => r.json()),
  ]);
  const storms: Hazard[] = (eonet.events as any[]).map((e) => {
    const g = e.geometry[e.geometry.length - 1];
    const kts = Number(g.magnitudeValue ?? 0);
    return {
      id: e.id, type: e.categories?.[0]?.title ?? 'Event', name: e.title, level: kts >= 64 ? 'Red' : 'Orange',
      at: g.coordinates as LonLat, country: '', until: g.date, url: e.sources?.[0]?.url, source: 'NASA EONET',
    } as Hazard;
  });
  const quakes: Hazard[] = (usgs.features as any[]).map((f) => ({
    id: f.id, type: 'Earthquake', name: f.properties.title, level: f.properties.mag >= 7 ? 'Red' : 'Orange',
    at: [f.geometry.coordinates[0], f.geometry.coordinates[1]] as LonLat, country: f.properties.place ?? '', until: new Date(f.properties.time).toISOString(), url: f.properties.url, source: 'USGS',
  }));
  return [...storms, ...quakes];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchHazards(): Promise<Hazard[]> {
  try {
    return await fetchGdacs();
  } catch {
    return fetchEonetUsgs();
  }
}

export async function fetchNews(): Promise<Headline[]> {
  const q = encodeURIComponent('(shipping OR port OR "supply chain" OR tariff OR freight) (Red Sea OR Suez OR Houthi OR Hormuz OR Malacca OR Taiwan OR China OR Chennai)');
  // GDELT sends no CORS header, so the Vite dev/preview server proxies it (see vite.config.ts)
  const url = `/gdelt/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=75&timespan=7d&sort=datedesc&sourcelang=english`;
  const j = await fetch(url, { signal: timeout(20000) }).then((r) => r.json());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((j.articles ?? []) as any[]).map((a) => ({
    title: a.title,
    url: a.url,
    domain: a.domain,
    seen: a.seendate,
    tags: (Object.keys(KEYWORDS) as Watch[]).filter((k) => KEYWORDS[k].test(a.title)),
  }));
}

export interface Signal {
  id: Watch;
  name: string;
  at: LonLat;
  score: number;
  level: 'low' | 'elevated' | 'high';
  reasons: string[];
}

export function computeSignals(news: Headline[] | null, hazards: Hazard[] | null): Signal[] {
  return WATCH_POINTS.map((w) => {
    const prior = (RISK_PRIOR as Record<string, number>)[w.id] ?? 0.1;
    const reasons: string[] = [];
    let score = prior;
    const n = news ? news.filter((h) => h.tags.includes(w.id)).length : 0;
    if (n > 0) {
      score += Math.min(0.35, n * 0.03);
      reasons.push(`${n} news report${n > 1 ? 's' : ''} in the last 7 days`);
    }
    (hazards ?? []).forEach((h) => {
      const d = km(w.at, h.at);
      if (d < 900) {
        score += h.level === 'Red' ? 0.35 : 0.2;
        reasons.push(`${h.level} alert: ${h.name}, ${Math.round(d)} km away`);
      }
    });
    if (reasons.length === 0) reasons.push('No unusual signals');
    score = Math.min(1, score);
    return { ...w, score, level: score >= 0.7 ? 'high' : score >= 0.4 ? 'elevated' : 'low', reasons };
  });
}

/** Turn live signals into what-if settings the buyer can load and adjust. */
export function suggestScenario(base: Scenario, signals: Signal[], fx: Fx | null): Scenario {
  const closed = { ...base.closed };
  let delayWeeks = 0;
  signals.forEach((s) => {
    if (s.id in closed) closed[s.id as Chokepoint] = s.level === 'high';
    if ((s.id === 'chennai' || s.id === 'shanghai' || s.id === 'taiwan' || s.id === 'malacca') && s.level !== 'low') delayWeeks += s.level === 'high' ? 2 : 1;
  });
  return {
    ...base,
    closed,
    delayWeeks: Math.min(8, delayWeeks),
    fxPct: fx ? Math.max(0, Math.round(fx.changePct * 10) / 10) : base.fxPct,
  };
}

export function riskFromSignals(signals: Signal[]): Record<Chokepoint, number> {
  const out = { ...RISK_PRIOR };
  signals.forEach((s) => { if (s.id in out) out[s.id as Chokepoint] = s.score; });
  return out;
}
