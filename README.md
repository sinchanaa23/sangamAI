# Sangam

**Where Indian demand meets Indian capability.**

Sangam is an AI supply-chain intelligence and domestic localization platform, built as a prototype for SAP Hackfest 2026. It designs the Indian supply chain a company will need in the future and shows MSMEs, cooperatives, FPOs and SHGs what they need to build to be part of it.

> Companies, capacities, prices, market sizes and scores in this prototype are **simulated**. Place names, shipping lanes and the live world feeds are real.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Live news needs the dev (or `npm run preview`) server, which proxies the GDELT API.

## Buyer workspace

An EV scooter maker in Hosur that imports its wiring harness.

1. **Current suppliers** — where each part comes from and how concentrated the imports are.
2. **Simulator**
   - *Live world* — live exchange rates, disaster alerts and shipping news turned into a risk level for each chokepoint on today's lane, shown on a world map. One click loads the signals into the what-if.
   - *What-if simulator* — your own values for extra duty, delay, ocean freight, rupee depreciation and chokepoint closures. Every other buyer page uses this scenario.
3. **Alternate routes**
   - *International* — eight sea and air lanes (China, Vietnam, Thailand, South Korea, Japan, UAE, EU) drawn on a world map, rerouted when a strait is closed, with a time-vs-cost chart and trade-agreement duty effects.
   - *Domestic* — road, rail and coastal-shipping options from each Indian supplier to the plant on an India map, with cost, days and CO₂.
4. **Indian options** — three generated domestic chains (*Switch now*, *Best balance*, *Rural-first*) with who supplies what, gaps to close and a plain-language explanation.
5. **Future network** — four network designs (*Specialist corridor*, *Plant cluster*, *Rural growth network*, *Twin-hub resilient*). Each shows on a map and as a network diagram what is available today, what needs an upgrade and what must be set up, with cost per part against importing. A 5/10/12/15/20-year chart compares building in India with continuing to import: cumulative cost, net return, break-even year and present value.

## Supplier workspace

Viewed as any of 17 simulated suppliers, in English or Hindi.

- **Overview** — anonymised demand, a readiness checklist with costs, time and support schemes, and consortium partners.
- **Future diversification** — adjacent products the supplier could move into, based on its skills, machines, certifications and location: a capability map, an investment-vs-profit bubble chart, 5- and 10-year return comparison, and for the chosen option the cost breakdown, payback and a cumulative-profit chart against staying as is.

## How the numbers are made

Everything numeric comes from deterministic, explainable code — no number is produced by a language model.

| File | What it does |
| --- | --- |
| [`src/engine.ts`](src/engine.ts) | Matching: ready / potential suppliers, two-supplier consortia, chain scoring on cost, speed, quality and resilience |
| [`src/routes.ts`](src/routes.ts) | International lanes with chokepoint reroutes; domestic road/rail/coastal lanes |
| [`src/sim.ts`](src/sim.ts) | Disruption shock on today's lane and expected stock-out losses |
| [`src/network.ts`](src/network.ts) | Future network designs and long-horizon cost, break-even and present value |
| [`src/diversify.ts`](src/diversify.ts) | Supplier diversification: fit score, investment, payback, 5/10-year return |
| [`src/live.ts`](src/live.ts) | Live feeds and how they become chokepoint risk signals |
| [`src/data.ts`](src/data.ts) | Simulated buyer, districts, suppliers, new sites, gap costs and demand signals |

Long-term growth rates for import and domestic costs are adjustable in the app, because they drive most of the long-horizon result.

## Live data sources

| Feed | Source | Notes |
| --- | --- | --- |
| Exchange rates | [Frankfurter](https://frankfurter.dev) (ECB reference rates) | Called directly from the browser |
| Disaster alerts | [GDACS](https://www.gdacs.org), falling back to [NASA EONET](https://eonet.gsfc.nasa.gov) and [USGS](https://earthquake.usgs.gov) | GDACS is sometimes slow |
| News | [GDELT DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) | No CORS header, so it goes through the Vite proxy; it is often rate-limited and the page says so when it is unavailable |

## Map data

- World countries: [Natural Earth](https://www.naturalearthdata.com) via [`world-atlas`](https://github.com/topojson/world-atlas) (public domain).
- India boundary: [DataMeet](https://github.com/datameet/maps) `india-composite`, CC BY 4.0, simplified with mapshaper into [`src/geo/india.json`](src/geo/india.json).

## Project structure

```
src/
  data.ts, engine.ts, routes.ts, sim.ts, network.ts, diversify.ts, live.ts, scenario.ts
  buyer/        Current suppliers, Simulator, Alternate routes, Indian options, Future network
  seller/       Overview, Future diversification, Hindi strings
  components/   Map outline, network diagram, capability map, tabs, slider
  geo/          Simplified India boundary
```

## Path to the SAP build

| Prototype | SAP Hackfest target |
| --- | --- |
| TypeScript engine | Python service on SAP AI Core |
| `data.ts` | SAP HANA Cloud (graph, spatial and vector) |
| Template explanations | Joule / Generative AI Hub explaining computed results |
| React UI | SAP Build Apps or Fiori on BTP |
| Simulated geography | PM GatiShakti Public datasets |
| Live feeds in the browser | Scheduled ingestion into SAP Business Data Cloud |
