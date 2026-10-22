# Sangam

**Where Indian demand meets Indian capability.**

Sangam is an AI supply-chain intelligence and domestic localization platform, built as a prototype for SAP Hackfest 2026. It designs the Indian supply chain a company will need in the future and shows MSMEs, cooperatives, FPOs and SHGs exactly what they need to build to be part of it.

> All companies, capacities, prices and scores in this prototype are **simulated**. Place names are real.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## What the prototype shows

**Buyer workspace** — four guided steps for an EV scooter maker in Hosur that imports its wiring harness:

1. **Today** — where each part comes from and how concentrated the imports are.
2. **What if** — sliders for extra import duty and shipping delay; cost, monthly loss and stock-out update live.
3. **Indian options** — three generated domestic chains (*Switch now*, *Best balance*, *Rural-first*), each scored on cost, delivery time, quality and climate/power risk. Shows who supplies what, which suppliers need work and what gaps they must close, a supplier network map and a plain-language explanation.
4. **5-year plan** — keep importing vs diversify abroad vs build in India, plus a phased roadmap.

**Supplier workspace** — viewed as any of 17 simulated suppliers (e.g. an SHG federation in Krishnagiri):

- Anonymised demand for what they make.
- A readiness checklist: missing certifications or capacity, with indicative cost, time and support schemes.
- Consortium partners to meet larger orders together.
- English / हिंदी toggle.

## How the engine works

All numbers come from deterministic, explainable calculations in [`src/engine.ts`](src/engine.ts); no number is produced by a language model.

- **Matching** — suppliers whose process matches a part are *ready* (meet every certification and the full volume) or *potential* (gaps listed with cost and time). Two small suppliers can form a *consortium* when neither can supply the volume alone.
- **Chain generation** — each option is scored on landed cost (price + freight by road distance), lead time (production + transit, adjusted for connectivity and time to close gaps), quality (audit score, discounted when self-declared) and resilience (district climate risk and power reliability). Weights are adjustable in the UI.
- **Scenarios** — five-year cumulative cost with 15% annual demand growth, expected disruption losses, and supplier-development co-investment.

## Project structure

```
src/
  data.ts            simulated buyer, districts, suppliers, gap costs, demand signals
  engine.ts          matching, chain generation, shock and five-year simulations
  buyer/             the four buyer steps
  seller/            supplier view and Hindi strings
  components/        slider and supplier network map
```

## Path to the SAP build

| Prototype | SAP Hackfest target |
| --- | --- |
| TypeScript engine | Python service on SAP AI Core |
| `data.ts` | SAP HANA Cloud (graph, spatial and vector) |
| Template explanations | Joule / Generative AI Hub explaining computed results |
| React UI | SAP Build Apps or Fiori on BTP |
| Simulated geography | PM GatiShakti Public datasets |
