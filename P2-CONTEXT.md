# P2 context (Buyer lead)

Read `AGENTS.md` first, then this file. Owner of: `src/buyer/**`, `src/components/MapCanvas.tsx`, `src/routes.ts`, `src/chainRoute.ts`, `src/real/clusters.json`. New module: `src/architect/**` and `server/architect.ts` (AI Supply Chain Architect).

## Current state (2026-10-24)
- On `main` (through PR #5): negotiation room (F3) with live SSE, server replay and offline fallback; global buyer mode (F7: currency, rate table, export route, landed cost, due-diligence pack); Negotiate with agents buttons; Fair Work badge on quotes and chain steps; Skill clusters page (F11) with 19 ODOP-sourced clusters.
- Branch `feat/architect` (not merged): AI Supply Chain Architect under Supplier → Grow.
- Waiting on P4: sidebar entry for `buyer:clusters` → `src/buyer/ClustersPage.tsx`.

## AI Supply Chain Architect
- `src/architect/engine.ts`: pure functions over Sangam's data. `buildPlan(input)` returns stages (raw → processing → your unit → logistics → buyer), ranked districts, import / hybrid / India-first scenarios, set-up costs, unit economics, phases, risks and a projected Fair Work grade. Reuses `bom`, `sellers`, `processInfo`, `certInfo`, `demandSignals`, `opportunities` (data.ts), `deliveredCost`, `importLineCost`, `leadDaysFrom` (engine.ts), `METRICS`, `trade` (realdata.ts), `domesticLanes`, `exportRoute` (routes.ts), `livingWageFor`, `minimumWageFor`, `scoreFairWork` (P3's fairwork.ts), `clusters.json`, and the global-buyer country table.
- Every figure is a `Fig` with a tag: public, estimated, simulated, `assumption` (user-editable default) or `ai`.
- Default wage = the district's living wage (P3's benchmark); default price = median price index of Sangam suppliers in the process × the part's cost (simulated); workers per 1,000 units = median of those suppliers (simulated-derived); materials share mirrors P1's labour-share assumption (0.6 assembly, 0.3 otherwise).
- India-first cost is left empty when an input has weak Indian supply: there is no Indian price for it.
- `server/architect.ts`: `POST /api/architect`, `task: 'idea'` (map a free-text idea onto the catalogue, sketch stages, questions) or `task: 'review'` (review the computed plan's facts). Uses P1's `ask()` with zod schemas; 503 without `LLM_API_KEY`; a made-up catalogue id is dropped.
- Touches outside P2's folders, one line each, flagged for owners: `server/app.ts` (P1) adds `...architectRoutes(opts.ask)` to the route loop; `src/App.tsx` (P4) adds the Supplier → Grow item and route.

## Sign-in roles and the Ecosystem hub (branch `feat/ecosystem-hub`)
- Two logins, buyer and supplier, on P1's one-time-code sign-in (`src/auth/`, `server/auth.ts`). A buyer sees Buyer + Ecosystem, a supplier Supplier + Ecosystem; the allowlisted Sangam team account (signs in at `#/account`) sees all three plus a team-only group (Verification desk, District dashboard). Signed-out visitors see only the landing page and the sign-in panel.
- `src/access/`: `Access.tsx` (`useAccess()`, wraps `useAuth`), `roles.ts` (`workspacesFor`, `resolvePage`: old links like `go('buyer','negotiate')` still land on the moved Ecosystem pages), `SignInPanel.tsx`.
- One-click "Try as a buyer / supplier" signs in a demo account using the mock code sender's `devCode` (simulated). If the server is down or busy it falls back to an **offline demo** kept in this tab (sessionStorage), labelled "Offline demo", never really signed in.
- Ecosystem pages: Agent negotiation, Reviews, AI Supply Chain Architect, Skill clusters (P3 replaces `'ecosystem:clusters'` in `src/App.tsx` with the curated invest / boost view), SDG 8 impact, Skill Passports, Check a credential, Report a problem, Data sources.
- Two-way reviews: buyers rate suppliers through the store (`src/components/ReviewForm.tsx`, checked on the Verification desk, feeds the trust score); suppliers rate buyers through `server/reviews.ts` (`/api/reviews/buyers`, author from the session, pending until the team verifies, table `buyerReviews`) and `src/reviews/`. Two demo reviews are tagged simulated.
- Edits in others' files, one place each: `src/App.tsx`, `src/shared/HomePage.tsx` (P4), `src/main.tsx` (P1), `server/app.ts` and `server/db.ts` (P1: the mount and a table name).
- Not tried: team-only tools (need `ECOSYSTEM_ALLOWLIST`), a real SMS or email sender, a real Udyam / GSTIN registry.

## Verified
- `npm run build` and `npm test` (65 tests, 10 new in `tests/architect.test.ts`) pass.
- In the browser: plan, graph, inspector, scenario switch, region choice, explore tab, idea matching and the AI-off message all work. AI with a real key not yet tried.

## Limitations
- Only the parts in the current sector's catalogue get a full plan; other ideas get keyword matching and, with a key, an AI sketch.
- No regulation dataset beyond state minimum wages; the page says so.
- Prices, demand and supplier counts come from simulated demo data and are tagged that way.

## Session log
- 2026-10-24: buyer features F3, F7, F11; AI Supply Chain Architect on `feat/architect`; this file.
- 2026-10-25: buyer / supplier sign-in with role-based workspaces, Ecosystem hub, two-way reviews (`feat/ecosystem-hub`).
