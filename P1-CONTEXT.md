# P1 context (Agents lead)

Read `AGENTS.md` first, then this file. Owner of: `server/**` (except `server/credentials.ts`, `impact.ts`, `grievances.ts`, `bhashini.ts`), `src/api.ts`, `src/contracts.ts`, `src/store.tsx`, `package.json` + lock, `.github/`, `.env.example`, `vite.config.ts`.

## Current state (2026-10-24)
- On `main`: contracts, Hono server (:8790, run with `vite-node` so the engine's `import.meta.glob` works), SQLite store, RFQ / negotiation / SSE / scorecard / workforce routes, Buyer / Supplier / Auditor agents, code-run orchestrator, certificate reading + checks, swappable LLM client, CI.
- Branch `agents/use-fairwork` (PR open or about to be): agents now grade with P3's `scoreFairWork()` and `livingWageFor()` instead of my temporary stubs; flag wording fix in the Auditor.
- Not on `main` yet: P2 `feat/buyer`, P4 `feat/ecosystem` (contains P2's work).

## How it works
- `server/llm.ts`: any OpenAI-compatible API. Env: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_RPM` (spaces calls to a free tier's limit), `LLM_AUDITOR_MODEL`, `LLM_VISION_MODEL` (+ optional `LLM_VISION_BASE_URL` / `LLM_VISION_API_KEY`). No key means negotiations replay `server/fixtures/demo-negotiation.json`.
- `server/agents/orchestrator.ts`: search, quotes from up to 3 suppliers, buyer picks, rounds 2 to 4, audit, confirm. Code enforces wage floor, free workers, capacity, budget, need-by date; an offer that breaks a limit is shown as `rejected` with a reason. 30 s per model turn, 85 s per negotiation, then rule-based moves.
- Engine figures go to the agents in the prompt (`supplierFacts`, `buyerFacts` in `tools.ts`), not through tool calls: a tool call is a second request, which timed out on free tiers.
- Auditor can only choose decisions the grade allows; an open certificate gap (`certificateGaps`) rules out `pass`.
- Check live: `npm run try:live` (`SANGAM_DEBUG=1` prints why a turn fell back to rules).

## Verified
- `npm run build` and `npm test` (51 tests) pass.
- Live on Gemini free tier with `gemini-3.1-flash-lite` (agents) and `gemini-3.5-flash` (Auditor, certificates): 44 to 66 s, every turn from the model. `gemini-2.5-flash` allowed only 5 requests a minute: too slow.
- Not verified: certificate reading on a real file or PDF; five negotiations at once; Groq.

## Assumptions (estimated, in `server/agents/tools.ts`)
- Labour share of price: 0.6 for assembly, 0.3 otherwise. FX: USD 94.5, EUR 108 (same as P2's table, 2026-10-24). Fallback wage floor if a district has no benchmark: ₹574 a day (GLWC rural Nilgiris, estimated).

## Decisions
- Free LLM instead of the proposal's Anthropic SDK (Anthropic API is paid and separate from Claude Pro). Switching back is env vars only. The team has not yet formally agreed.
- Keys live only in `.env.local` (git-ignored). Never paste keys in chat or screenshots.

## Next steps
1. Two recorded replay fixtures from good live runs; recorder.
2. Mount P4's `credentialRoutes` / `impactRoutes` / `grievanceRoutes` in `server/app.ts` once `feat/ecosystem` is on `main` (loop is in the header of `server/credentials.ts`); point `setDealSource` at the `deals` table; pass `sign` into the orchestrator.
3. `npm run db:reset`; five-negotiations-at-once load test (free tier is about 14 requests a minute, so expect queuing).
4. Test certificate reading on a real file.

## Session log
- 2026-10-24: built contracts, server, store, agents, orchestrator, certificate checks, LLM client; live-tested on Gemini; swapped in P3's scorecard.

## Negotiation rules (2026-10-24, `agents/fair-negotiation`)
- Wage floor = higher of the legal minimum and the living wage (`wageFloorFor`, `tools.ts`). A missing minimum wage (TN, AP, UP, Kerala) falls back to the living wage tagged estimated and holds the deal for review (`reviewReasons`).
- Price floor (`priceFloor`, `minViablePrice`) = materials and overhead (estimated, from `LABOUR_SHARE`) + worker-days at the wage floor. A buyer counter below it is shown as refused, then raised to the floor in code.
- Round-1 quotes are gated (`quoteGate`): grade E or under the notified legal minimum is shown as a rejected offer and never shortlisted. This uses `Offer.status`, not an `audit` event: P2's room and P4's ledger read the first `audit` event as the final result.
- The buyer ranks all valid quotes with `rankOffers` (weights `RANK_WEIGHTS`: fair work .30, trust .25, cost .20, lead time .15, certificates .10) and negotiates with the best; if it walks away (only allowed within 5% of its floor) or cannot be met, the next on the shortlist is tried.
- Fixtures recorded before this change (`demo-negotiation.json`, `recorded-*.json`) predate the shortlist event and the new floor; re-record with `npm run record -- india|germany` after merging.
