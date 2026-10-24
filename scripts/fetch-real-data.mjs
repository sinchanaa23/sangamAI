// Pulls real public data into src/real/*.json so the app can show sourced numbers.
// Run with: npm run data:refresh
//   - UN Comtrade (public preview API): India's imports by partner for each tracked HS code
//   - World Bank: Logistics Performance Index for the lane countries
//   - World Bank WITS (TRAINS): India's MFN import duty for each tracked HS code
//   - Frankfurter (ECB reference rates): INR per USD and per EUR
//   - Open-Meteo archive: 10 years of daily rain and heat per district -> climate exposure
//   - OpenStreetMap Overpass: industrial areas, rail stations and airports around each district
import { mkdir, writeFile } from 'node:fs/promises';
import { DISTRICTS, HS_CODES, LPI_COUNTRIES } from './districts.mjs';

const OUT = new URL('../src/real/', import.meta.url);
const UA = { 'User-Agent': 'Sangam-prototype/0.2 (SAP Hackfest; contact via GitHub sohini-d/Sangam)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);
const only = process.argv[2]; // optional: comtrade | lpi | tariffs | fx | climate | osm

async function get(url, init = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...init, headers: { ...UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(90000) });
      if (r.ok) return r;
      console.warn(`  ${r.status} for ${url.slice(0, 90)}…`);
    } catch (e) {
      console.warn(`  ${String(e.cause ?? e)} for ${url.slice(0, 90)}…`);
    }
    await sleep(3000 * (i + 1));
  }
  throw new Error(`Failed: ${url}`);
}

async function save(name, data) {
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL(name, OUT), JSON.stringify(data, null, 1));
  console.log(`wrote src/real/${name}`);
}

async function comtrade() {
  const partners = (await (await get('https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json')).json()).results;
  const nameOf = Object.fromEntries(partners.map((p) => [p.PartnerCode, p.PartnerDesc]));
  const iso3Of = Object.fromEntries(partners.map((p) => [p.PartnerCode, p.PartnerCodeIsoAlpha3]));
  // Keep codes already fetched; only refetch missing ones (or all with --all)
  let out = {};
  try {
    const { readFile } = await import('node:fs/promises');
    if (!process.argv.includes('--all')) out = JSON.parse(await readFile(new URL('comtrade.json', OUT), 'utf8')).codes;
  } catch { /* first run */ }
  for (const [hs, label] of HS_CODES) {
    if (out[hs]?.year && out[hs].schema === 2) continue; // schema 2 keeps weights and unit values
    let rows = [], year = null;
    for (const y of [2024, 2023, 2022]) {
      const url = `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=699&period=${y}&cmdCode=${hs}&flowCode=M&partner2Code=0&customsCode=C00&motCode=0`;
      try {
        const j = await (await get(url, {}, 2)).json();
        await sleep(1500);
        if (j.data?.length) { rows = j.data; year = y; break; }
      } catch {
        console.warn(`  no ${y} data for ${hs}, trying an earlier year`);
      }
    }
    const world = rows.find((d) => d.partnerCode === 0);
    const byPartner = rows.filter((d) => d.partnerCode !== 0 && d.primaryValue > 0).sort((a, b) => b.primaryValue - a.primaryValue);
    const total = world?.primaryValue ?? byPartner.reduce((s, d) => s + d.primaryValue, 0);
    const shares = byPartner.map((d) => d.primaryValue / total);
    out[hs] = {
      hs, label, year,
      totalUsd: Math.round(total),
      schema: 2,
      netKg: world?.netWgt ?? null,
      // USD per kg of what India imported (value / net weight). Comtrade flags weights it estimated itself.
      usdPerKg: world?.netWgt > 0 ? +(total / world.netWgt).toFixed(3) : null,
      weightEstimated: world?.isNetWgtEstimated ?? null,
      hhi: Math.round(shares.reduce((s, x) => s + (x * 100) ** 2, 0)),
      partners: byPartner.slice(0, 10).map((d) => ({ code: d.partnerCode, iso3: iso3Of[d.partnerCode], name: nameOf[d.partnerCode] ?? String(d.partnerCode), usd: Math.round(d.primaryValue), share: +(d.primaryValue / total).toFixed(4), netKg: d.netWgt ?? null, usdPerKg: d.netWgt > 0 ? +(d.primaryValue / d.netWgt).toFixed(3) : null, weightEstimated: d.isNetWgtEstimated ?? null })),
    };
    console.log(`  ${hs} ${label}: ${year}, $${(total / 1e6).toFixed(1)}M, top ${out[hs].partners[0]?.name}`);
  }
  await save('comtrade.json', { source: 'UN Comtrade public API (preview), reporter India (699), imports', fetched: today, codes: out });
}

async function lpi() {
  const j = await (await get(`https://api.worldbank.org/v2/country/${LPI_COUNTRIES.join(';')}/indicator/LP.LPI.OVRL.XQ?format=json&date=2010:2025&per_page=200`)).json();
  const latest = {};
  for (const d of j[1]) {
    if (d.value == null) continue;
    if (!latest[d.countryiso3code] || +d.date > +latest[d.countryiso3code].year) latest[d.countryiso3code] = { year: +d.date, score: +(+d.value).toFixed(2) };
  }
  await save('lpi.json', { source: 'World Bank, Logistics Performance Index (LP.LPI.OVRL.XQ), 1 to 5', fetched: today, countries: latest });
}

async function previous(name, key) {
  if (process.argv.includes('--all')) return {};
  try {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(new URL(name, OUT), 'utf8'))[key] ?? {};
  } catch { return {}; }
}

const CLIMATE_SOURCE = 'Open-Meteo historical weather (ERA5), daily 2015-2024; thresholds follow IMD heavy (64.5 mm) and very heavy (115.6 mm) rain';
async function climate() {
  const out = await previous('climate.json', 'districts');
  for (const d of DISTRICTS) {
    if (out[d.id]) continue;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${d.lat}&longitude=${d.lon}&start_date=2015-01-01&end_date=2024-12-31&daily=precipitation_sum,temperature_2m_max&timezone=Asia%2FKolkata`;
    let j;
    try { j = await (await get(url, {}, 2)).json(); } catch { console.warn(`  skipped ${d.name}; run again later`); await sleep(20000); continue; }
    const p = j.daily.precipitation_sum, t = j.daily.temperature_2m_max;
    const yrs = 10;
    const heavy = p.filter((x) => x >= 64.5).length / yrs; // IMD "heavy rain"
    const veryHeavy = p.filter((x) => x >= 115.6).length / yrs; // IMD "very heavy"
    const hot = t.filter((x) => x >= 40).length / yrs;
    const rain = p.reduce((s, x) => s + (x ?? 0), 0) / yrs;
    out[d.id] = { heavyRainDays: +heavy.toFixed(1), veryHeavyRainDays: +veryHeavy.toFixed(1), hotDays: +hot.toFixed(1), annualRainMm: Math.round(rain), maxDayRainMm: Math.round(Math.max(...p.filter((x) => x != null))) };
    console.log(`  ${d.name}: ${out[d.id].annualRainMm} mm, ${heavy.toFixed(1)} heavy-rain days, ${hot.toFixed(1)} days >= 40C`);
    await save('climate.json', { source: CLIMATE_SOURCE, fetched: today, districts: out });
    await sleep(6000);
  }
}

// The main instance is the most reliable; mirrors are tried only after it fails
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const OSM_SOURCE = 'OpenStreetMap via Overpass API (ODbL): industrial land-use areas within 20 km, rail stations within 25 km, airports with IATA codes within 80 km, motorway/trunk road segments within 20 km';
async function osm() {
  const out = await previous('osm.json', 'districts');
  let n = 0;
  for (const d of DISTRICTS) {
    if (out[d.id]) continue;
    const q = `[out:json][timeout:90];
(way["landuse"="industrial"](around:20000,${d.lat},${d.lon});relation["landuse"="industrial"](around:20000,${d.lat},${d.lon}););out count;
node["railway"="station"](around:25000,${d.lat},${d.lon});out count;
nwr["aeroway"="aerodrome"]["iata"](around:80000,${d.lat},${d.lon});out count;
way["highway"~"^(motorway|trunk)$"](around:20000,${d.lat},${d.lon});out count;`;
    let j;
    try {
      const r = await get(OVERPASS[n++ % OVERPASS.length], { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) }, 2);
      j = await r.json();
    } catch { console.warn(`  skipped ${d.name}; run again later`); await sleep(15000); continue; }
    const c = j.elements.map((e) => +e.tags.total);
    out[d.id] = { industrialAreas: c[0], railStations: c[1], airports: c[2], highwaySegments: c[3] };
    console.log(`  ${d.name}: ${c.join(' / ')}`);
    await save('osm.json', { source: OSM_SOURCE, fetched: today, districts: out });
    await sleep(15000);
  }
}

// India's applied MFN duty (simple average of the tariff lines under the HS6 code), from the World Bank WITS / UNCTAD TRAINS API.
// WITS has no partner-specific (FTA) rates for India, so preferential duties stay estimates in the app. Excludes surcharge and IGST.
async function tariffs() {
  const out = {};
  for (const [hs, label] of HS_CODES) {
    for (const y of [2024, 2023, 2022, 2021]) {
      try {
        const r = await fetch(`https://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN/reporter/356/partner/000/product/${hs}/year/${y}/datatype/reported`, { headers: UA, signal: AbortSignal.timeout(60000) });
        if (!r.ok) continue;
        const obs = /<Obs [^>]*>/.exec(await r.text())?.[0];
        const rate = obs && /OBS_VALUE="([\d.]+)"/.exec(obs)?.[1];
        if (!rate) continue;
        out[hs] = { hs, label, mfnPct: +rate, year: y, lines: +(/TOTALNOOFLINES="(\d+)"/.exec(obs)?.[1] ?? 0), maxPct: +(/MAX_RATE="([\d.]+)"/.exec(obs)?.[1] ?? rate) };
        console.log(`  ${hs}: MFN ${rate}% (${y})`);
        break;
      } catch { /* try the previous year */ }
      await sleep(300);
    }
    if (!out[hs]) console.warn(`  no WITS rate for ${hs}`);
    await sleep(300);
  }
  await save('tariffs.json', { source: "World Bank WITS (UNCTAD TRAINS), India applied MFN duty, simple average of tariff lines at HS6; basic duty only (no surcharge or IGST)", fetched: today, codes: out });
}

// ECB euro foreign exchange reference rates through Frankfurter. One dated snapshot so the app and the agents agree on a rate.
async function fx() {
  const j = await (await get('https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR,EUR')).json();
  await save('fx.json', { source: 'ECB euro foreign exchange reference rates via Frankfurter', fetched: today, date: j.date, inrPerUsd: j.rates.INR, inrPerEur: +(j.rates.INR / j.rates.EUR).toFixed(4) });
}

const jobs = { comtrade, lpi, tariffs, fx, climate, osm };
for (const [k, f] of Object.entries(jobs)) {
  if (only && only !== k) continue;
  console.log(k);
  await f();
}
