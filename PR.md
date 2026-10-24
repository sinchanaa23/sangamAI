## agents: contracts, Hono server, SQLite store, demo stream (hours 0–6)

Open: https://github.com/sohini-d/Sangam/compare/main...feat/agents?expand=1

### What changes
- `src/contracts.ts` — the proposal's draft types, plus `WorkforceProfile`, `NegotiationSummary` and a `ROUTES` table.
- `server/` — Hono server on :8787 (`npm run server`); `npm run dev` now starts it with Vite. Vite proxies `/api` to it.
- Ask Sangam and certificate reading moved from the Vite middleware to the server (`server/ai.ts` logic unchanged).
- `server/db.ts` — SQLite (`node:sqlite`) at `server/data/sangam.db` (git-ignored).
- Routes (fixture-backed where agents are not wired yet): `POST/GET /api/rfq`, `POST /api/negotiations`, `GET /api/negotiations/:id`, `GET /api/negotiations/:id/stream` (SSE; id `demo` replays the recorded run), `GET /api/scorecard/:supplierId`, `PUT/GET /api/suppliers/:id/workforce`.
- `src/api.ts` — typed helpers incl. `streamNegotiation(id, onEvent)`.
- `server/fixtures/demo-negotiation.json` — 12 events (built from P2's demo story; one offer rejected below the living-wage floor).
- CI: `npm ci`, `npm run build`, `npm test`. Vitest 3 (Vitest 5 needs Vite 6).
- Everything stays in P1's files; no other owner's file is touched.

### Notes for teammates
- **P4:** your `Route[]` routers (credentials, impact, grievances) mount with the loop in your file header. I will do it as soon as `feat/ecosystem` is on `main`. I will point `setCredentialStore` / `setGrievanceStore` / `setDealSource` at SQLite. Your `Credential` type lives in `src/ecosystem/vc.ts`, not `contracts.ts`; tell me if you want `contracts.ts` to re-export it.
- **P2:** `src/buyer/negotiation/types.ts` can now import from `src/contracts.ts`; use `streamNegotiation('demo', …)` instead of the local fixture.
- **P3:** `PUT /api/suppliers/:id/workforce` is live and strips unknown keys (no phone/Aadhaar). Send the `WorkforceProfile` fields in `contracts.ts`.
- After pulling: `npm install`, then `npm run dev`. Put `ANTHROPIC_API_KEY` in `.env.local` (see `.env.example`).

### Checked
`npm run build` and `npm test` (9 tests) pass; `npm run dev` serves the app, `/api/health` through the proxy, and `curl -N localhost:8787/api/negotiations/demo/stream` prints events.

### Not done yet
Real agents, orchestrator, auditor (hours 6–14). Scorecard is a fixture until `src/fairwork.ts` lands.
