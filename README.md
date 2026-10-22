# Sangam

**Where Indian demand meets Indian capability.**

Sangam is an AI supply-chain intelligence and domestic localization platform, built as a prototype for SAP Hackfest 2026. It designs the Indian supply chain a company will need in the future, shows MSMEs, cooperatives, FPOs and SHGs exactly what they need to build to be part of it, and gives states and industry clusters a map of where the gaps are.

Every number carries a tag saying where it comes from: **Live**, **Public data**, **Verified**, **Self-declared**, **Estimate** or **Simulated**.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Optional:

- **Ask Sangam (AI):** set `ANTHROPIC_API_KEY` in your environment (or run `ant auth login`) before `npm run dev`. The key stays on the dev server; the browser never sees it.
- **Refresh the real data:** `npm run data:refresh` (UN Comtrade, World Bank, Open-Meteo, OpenStreetMap; resumes where it stopped if a service rate-limits).

## Three workspaces, three sectors

Pick a sector in the top bar: **EV components** (wiring harness), **Construction materials** (affordable housing) or **Agri and food processing** (millet mixes). Or load your own parts list.

### Buyer: a company looking for supply chains

| Step | Page | What it does |
|---|---|---|
| Understand | **Supply chain today** | Parts with HS codes, India's real import value and origin countries for each (UN Comtrade 2024), concentration index, and a multi-tier diagram down to raw materials showing where India is weak below tier 1 |
| | **Simulator** | *Live world:* exchange rates, disaster alerts and shipping news turned into chokepoint risk. *What-if:* duty, delay, freight, rupee, strait closures |
| | **Routes** | *International:* 8 sea and air routes, each as a **roadmap of legs** (supplier factory, first mile, origin port, ocean or air, transshipment, Chennai port, customs, inland truck, inspection, inventory in transit) with days (average and worst case), cost, reliability, loss rate, CO₂, documents and risks; reliability tied to each origin's World Bank LPI. *Domestic:* for every part, the named Indian supplier's production leg (price, defect rate, on-time delivery, spare capacity, trust score), then road, rail or coastal legs with terminals and documents |
| Design | **Indian options** | Three generated chains plus a **constraint optimiser** (mixed-integer program: budget, lead time, readiness, dual sourcing, import cap, rural minimum) |
| | **Future network** | Four designs generated from suppliers and possible new sites (map and network diagram), and a 5-20 year comparison of **keep importing, diversify abroad, hybrid and build in India** |
| | **Location planner** | Ranks 32 districts for a new unit on real climate history, OpenStreetMap infrastructure, port distance, supplier ecosystem and distance to plant; propose a unit and the network designs consider it |
| Act | **Requirements and quotes** | Publish current and future needs with firmness and confidentiality (anonymous, named, invite-only; target price and exact volume optional); see who viewed, who is interested; compare quotes on **total cost of ownership** (price, freight, tooling, defects, trust-based risk) and award |
| | **Switch-over plan** | Timeline per part: close gaps, samples, qualification (PPAP), 10% pilot, 50% ramp, full switch, each with a go/no-go gate, criteria, owner and budget |
| | **Supplier development** | Co-funded upgrade projects; milestones verified by the Sangam team |
| Set up | **Company and parts** | Edit the company, parts list (or upload CSV); everything recalculates |
| | **SAP integration** | Import an IBP demand export; export Ariba sourcing-event items and awards; export the network as a HANA graph |

### Supplier: a company or cooperative looking for business

| Page | What it does |
|---|---|
| **Overview** | Trust score, matching requirements, readiness checklist with cost, time and support schemes, likely consortium partners |
| **Opportunities and quotes** | Requirements they may see (confidentiality applied); express interest; submit a quote alone or as a consortium |
| **Consortia** | Invite nearby suppliers to bid together; partners accept or decline |
| **Development projects** | Start milestones and upload evidence for the Sangam team |
| **Future diversification** | Adjacent products with fit, investment, payback and 5/10-year return |
| **Profile and documents** | Onboard a new company; upload a certificate and have AI read its number, issuer and expiry |
| **Reviews** | Reviews from buyers and partners, published only after the Sangam team matches them to a real order; write reviews of partners |

English and Hindi.

### Ecosystem: the Sangam team, clusters and states

| Page | What it does |
|---|---|
| **Verification desk** | Check identity, capacity and certificates of new companies; match reviews to orders; verify development milestones |
| **District dashboard** | Unmet demand vs local capability within 300 km, investment and jobs to close it, with real climate and connectivity; CSV export |
| **Platform metrics** | The proposal's success measures, computed from activity |
| **Data sources** | Every source, its licence, date and what it powers |

## Trust score

0-100, explainable: identity checked (15), certificates checked (20), profile completeness (15), **verified reviews** (35, with a Bayesian average so one review can't dominate) and order history (15). Reviews must cite a purchase order and attach evidence; they count only after verification.

## Where the data comes from

| | Source | Used for |
|---|---|---|
| Public data | [UN Comtrade](https://comtradeplus.un.org) (public API), India imports by HS code and partner, 2024 | Real import picture for every part and upstream input |
| | [World Bank LPI](https://lpi.worldbank.org) | Port and schedule reliability per origin country |
| | [Open-Meteo](https://open-meteo.com) historical weather 2015-2024 | District heavy-rain and heat exposure |
| | [OpenStreetMap](https://www.openstreetmap.org/copyright) via Overpass | District rail, airport, highway and industrial-land counts |
| | [DataMeet](https://github.com/datameet/maps) (CC BY 4.0), [Natural Earth](https://www.naturalearthdata.com) | Map outlines; India shown with its official boundary |
| Live | Frankfurter (ECB), GDACS / NASA EONET / USGS, GDELT | Exchange rates, disaster alerts, shipping news |
| Estimate | Sangam models | Grid reliability by state, transport rates, port charges, duty, long-term cost growth |
| Simulated | Demo data | Buyer companies, suppliers and their performance, new-site costs, market sizes |

`src/real/*.json` holds the fetched data with source and date, so the app works offline and the numbers are reproducible.

## How the numbers are made

Everything numeric comes from deterministic code; Ask Sangam only explains it.

| File | What it does |
|---|---|
| `src/engine.ts` | Matching, gaps, consortia, chain scoring |
| `src/routes.ts`, `src/chainRoute.ts` | Route legs and landed cost, international and domestic |
| `src/optimise.ts` | Mixed-integer sourcing optimiser (javascript-lp-solver) |
| `src/network.ts` | Generated network designs, hybrid strategy, long-horizon cost and returns |
| `src/tco.ts`, `src/trust.ts` | Quote total cost of ownership; trust score |
| `src/realdata.ts` | District scores from the real data |
| `src/sectors/*.ts` | Sector templates (EV, construction, agri) |
| `server/ai.ts` | Ask Sangam and certificate reading on Claude (`claude-opus-5-5`), served by the Vite dev server |
| `scripts/fetch-real-data.mjs` | Downloads the public datasets |

## Path to the SAP build

| Prototype | SAP target |
|---|---|
| TypeScript engine and optimiser | Python services on SAP AI Core |
| `src/real`, sector templates, browser storage | SAP HANA Cloud (graph, spatial, vector) and SAP Business Data Cloud |
| Requirements, quotes, awards | SAP Ariba sourcing events and contracts (CSV export works today) |
| Demand plan | SAP IBP (CSV import works today) |
| Supplier profiles and verification | SAP Business Network |
| Ask Sangam | Joule / Generative AI Hub |
