# P4 context (Ecosystem lead and presenter)

Read `AGENTS.md` first, then this file. Owner of: `src/ecosystem/**`, `src/App.tsx`, `src/shared/**`, `server/credentials.ts`, `server/impact.ts`, `server/grievances.ts`, `README.md`, the deck. Agreed edits outside: the SAP page renamed to `src/buyer/IntegrationsPage.tsx`, and the `recordNegotiation` hook in P2's `src/buyer/NegotiationRoom.tsx` (marked "Added by P4").

## Current state (2026-10-24)
- Branch `feat/ecosystem`, not on `main` yet. It already contains `main` (P1's PRs #1 and #3, P3's PR #2) and P2's `feat/buyer`. Merge order: P2's PR, then this one.
- Home page and README lead with the original supply-chain problem; SDG 8 is the layer on top. No SAP name in the app.
- Pages: Skill Passports, Check a credential (tamper demo), SDG 8 impact (replaces Platform metrics), Report a problem (anonymous grievances), Auditor flags and grievances on the Verification desk, Integrations.

## How it works
- `src/ecosystem/vc.ts`: credentials in W3C VC shape, Ed25519 (ECDSA P-256 fallback) through Web Crypto, same code in browser and Node. Own `Jwk` type because Node's types lack `JsonWebKey`.
- `src/ecosystem/ledger.ts`: credentials, grievances, flags and agent deals. Uses the server routes when mounted, else this browser's storage and a demo key kept in the browser (credentials then check as genuine only in that browser).
- `src/ecosystem/negotiation.ts`: `recordNegotiation(events)` turns a finished negotiation into an audit credential (pass) or a desk flag (flag), a contract credential and a deal record. Once per deal.
- `src/ecosystem/fairwork-link.ts`: P3's workforce profiles and `scoreProfile` feed the impact page and the Passport badge; grievances reported on Sangam count as open grievances in the grade.
- Server routes are framework-free (`Route` in `server/credentials.ts`); P1 mounts them with the loop in that file's header.

## Verified
- `npm run build` and `npm test` (51 tests) pass after merging `main`.
- In the browser, the demo deal end to end: room → audit and contract credentials signed → Skill Passports opens on Krishnagiri, both valid → "Change one character" shows as changed → SDG 8 impact shows 170 jobs, 104% of living wage, 92% women, 100% rural. Replay does not double count.
- Routes tested inside P1's Hono app on a throwaway branch: sign, verify, forged rejected, grievances, impact.
- Not verified: routes mounted on `main` (P1's next step), credentials signed by the server key in the browser.

## Open issues for teammates
- P1: add `'@context'` and `proof.keyId`, `alg: 'Ed25519' | 'ES256'` to `Credential` in `src/contracts.ts`; mount the three routers; point `setDealSource` at the deals table.
- P2 and P3: demo grade mismatch. P3's seed grades Krishnagiri A; the Auditor in the recorded demo says B. The deck's demo script says B.
- P3: Silvassa (Dadra and Nagar Haveli) gets the Delhi NCR living wage in `livingWageFor`.
- Imports replaced shows ₹0 for the demo deal: its part (a finished harness) is not on the imported parts list.

## Deck
- Claude Slides deck "Sangam for HACK4SDG", 12 slides with timed speaker notes. Pitch follows the original SAP Hackfest problem and solution; SDG 8 is slide 4. Business model: buyers and sellers both pay (subscriptions and commissions).
- The architecture slide matches P1's setup: any OpenAI-compatible model (Gemini free tier now), engine facts in the prompt, code-run orchestrator with rule-based fallback and replay.

## Session log
- 2026-10-24: rebrand and Integrations; credentials, Skill Passports, checker, SDG 8 impact, grievances, Auditor flags; tagged `sap-hackfest-v1`; deck; merged main, P3 and P2; connected P2's room and P3's scorecard; this file.
