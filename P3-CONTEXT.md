# P3 context — Supplier lead (Sangam, HACK4SDG)

> **Handoff file for the next session or model.** Read this first when continuing P3's work.
> **At the end of every session: update `Current state` and the `Session log`, then commit.**
> Paste into a new session: *"Read P3-CONTEXT.md first. [your P3 role prompt from the tasks doc]. We are starting hour block [X] and already done: see Current state."*

## Role and rules

- P3 = Supplier lead. Features: **F4** Fair Work Scorecard, **F5** workforce and skills profile with voice, **F10** Bhashini (optional, needs keys).
- Branch: **feat/supplier** (created from main @ 9ad6edc). Commit messages start with `supplier: `.
- I own ONLY: `src/seller/**`, `src/fairwork.ts`, `src/voice.ts`, `src/real/wages.json`, `src/components/FairWorkBadge.tsx`, `src/seeds.ts`, `server/bhashini.ts`. Never edit anyone else's file — write a two-line note to send to its owner instead.
- Reference docs (repo root, untracked .docx): the proposal ("…proposal and 24-hour build plan") is the final reference over any agent's own ideas.
- Teammate branches on origin: `feat/agents` (P1), `feat/buyer` (P2), `feat/ecosystem` (P4). Nothing had merged to main as of 2026-10-24 evening.

## Current state (after session 2, 2026-10-24)

- **All P3 hour blocks 2–21 are done**, except Bhashini (no keys — the fallback work, better voice prompts + translations, was done instead).
- 6 commits on feat/supplier, **not pushed yet**. Next action: `git push origin feat/supplier` and open the PR to main (merge-checkpoint workflow: rebase on origin/main first if it moved).
- Verification: `npm run build` ✓; `npx -y vitest@3 run` → **22/22 tests pass** (this becomes plain `npm test` once P1's package.json with vitest merges); browser-tested end to end (see Session log).
- On main (P1's server not merged), the WorkforcePage saves to the device (localStorage) and falls back cleanly; once P1's server + Vite /api proxy merge, saving goes to `PUT /api/suppliers/:id/workforce` with zero changes.

## File map — what each file does and why

- **`src/real/wages.json`** — all wage data, every figure with source URL and date. 7 GLWC living-wage benchmarks (all "2025 Estimate", Nov 2025 update reports; monthly ÷ 26 = per-day). State minimum wages for 14 of 17 states. **Tamil Nadu, Kerala, Andhra Pradesh, Uttar Pradesh are deliberately null** (sources conflicted; the plan says leave empty rather than guess). Multi-zone states store the **lowest zone** (the floor below which a wage is definitely illegal anywhere in the state) — noted per entry. National floor wage: ₹178/day, the 2017 advisory (no statutory floor notified under the Code on Wages rules as of Oct 2026).
- **`src/fairwork.ts`** — the scoring engine. Exports `scoreFairWork(labour, profile)`, `scoreProfile(profile)`, `labourFromProfile(profile)` (headcount-weighted wage), `livingWageFor(district)` (exact district → state-wide → nearest **same-kind** rural/urban benchmark, tagged estimated unless in the benchmark's own scope), `minimumWageFor(district)`, `FAIR_WORK_RULES` (the one tunable table), `GRADE_LABEL`. Grade ladder and precedence: child/forced-labour flag → **E** (deal blocked); below state minimum → **D** (the legal floor outranks the living-wage ladder); ≥ living wage → **A**; ≥ 90% of living → **B**; else **C**. Missing safety record or open grievance each lower one step, floored at D. `reasons: string[]` carries the human-readable explanation shown in the badge tooltip and page. The types (`LabourPlan`, `FairWorkScore`, `WorkforceProfile`, `WorkforceSkill`) **mirror P1's contracts.ts on feat/agents** — after it merges to main, switch the local declarations to `import type` re-exports from `./contracts` (one-line change, shapes are identical).
- **`tests/fairwork.test.ts`** — 22 tests: every grade, both downgrade rules, D floor, the min-vs-living precedence, benchmark matching (Tiruppur exact / Anantapur state / Krishnagiri nearest), weighted-wage math, wage-change-changes-grade. Lives in `tests/`, NOT `src/`, because the root tsconfig includes all of `src` and vitest is not a dependency on main — `tsc -b` would fail on `import from 'vitest'`. Vitest's default glob picks it up; the tests mutate the Tamil Nadu minimum wage in the imported JSON for boundary tests and restore it after.
- **`src/components/FairWorkBadge.tsx`** — the grade badge (letter, colour, label). Self-contained inline styles so any page can drop it in without touching shared CSS. Tooltip (`title`) = grade + all reasons + benchmark source. Props: `score` (accepts the plain FairWorkScore from negotiation events), `showLabel`, `size`.
- **`src/seller/workforce.ts`** — persistence: `loadWorkforce` (P1's GET → localStorage → demo seed) and `saveWorkforce` (P1's PUT → device fallback). After P1's `src/api.ts` merges, its `getWorkforce/saveWorkforce` helpers can replace these fetches (same shapes).
- **`src/seller/WorkforcePage.tsx`** — replaces P4's one-line placeholder at the same path and export (P4's sidebar entry `supplier:workforce` routes here). Form: district select, skills table (skill / workers / wage per day), hours, overtime, training, women, grievances, safety pills, child/forced-labour flag. The grade recomputes **live as you type**. UI language pills: EN / हिंदी / ಕನ್ನಡ / தமிழ் (all labels in four languages, `L` object at top). Voice card: guided one-question-at-a-time flow (`QUESTIONS` array, spoken with `speechSynthesis`, filled via speech recognition, skip/stop, typed input always available; hidden-not-broken when unsupported). Privacy: workers stored by skill and wage band only — never names, phones or Aadhaar. Source tag under the selector: simulated (seed) / declared (device) / verified (server).
- **`src/voice.ts`** — Web Speech API wrappers for the browser path (F10's fallback): `speechSupported()`, `listenOnce(lang, handlers)`, `speak(text, lang)`, `parseNumber` (handles ASCII + Devanagari/Kannada/Tamil digit characters), `matchChoice` (keyword matching for the safety question in the three languages). Bhashini later replaces the internals without touching the pages.
- **`src/seeds.ts`** — appended `seedWorkforceFor(sellerName, supplierId)`: demo workforces **keyed by seller NAME** (seller ids repeat across sector templates, names don't). Nine EV-story workforces, one per grade: Krishnagiri Mahila Harness Collective **A** (₹593/day vs ₹574 Nilgiris benchmark), Satara Co-op **B**, Hosur Tool and Die **B**, Madurai SHG **C**, Chakan Harness **C**, Silvassa Conductors **C**, Coimbatore Cable **D** (partial safety record downgrade), Dharwad Women's Co-op **D** (above the living wage but below Karnataka's ₹743/day minimum — the legal floor wins), Rajkot Brass **E** (flagged; the auditor-blocked example).
- **`src/seller/ProfilePage.tsx`** — added a `WorkforceGradeCard` (badge + "the grade buyers see on every quote" + button to the Workforce page) to both the demo-company view and the registered-seller form view. Loads whatever profile exists (server → device → seed).

## Verification evidence (session 2)

Browser-verified on localhost:5173 (temporary nav wiring in App.tsx, reverted before commit — App.tsx is P4's): hero collective grades **A** with correct reasons; editing a wage 590→400 dropped the grade **A → C live** (weighted ₹424 = 74% of living wage); ticking the child-labour flag flipped it to **E — Blocked live**; profile page shows the badge card. Screenshots confirmed layout; one fix applied (the flag checkbox was detached from its label under the `field` class — now an inline row).

## Notes waiting to be sent to teammates

> **To P1:** fairwork.ts mirrors your contracts.ts types — I'll switch to `import type` from './contracts' once it merges; same for my fetch helpers vs your api.ts. Your `npm test` will pick up `tests/fairwork.test.ts` automatically. TN/KL/AP/UP minimum wages are null in wages.json pending a verified G.O. figure.
> **To P4:** my WorkforcePage replaces your placeholder at the same path, expecting your `supplier:workforce` nav id — nothing needed from you. `FairWorkBadge` is reusable on the Skill Passport / quotes.

## Open items / next steps

1. Push feat/supplier + open PR (needs: `git push origin feat/supplier`, then `gh pr create --base main --head feat/supplier`).
2. After P1's contracts.ts + api.ts merge to main: rebase, switch fairwork.ts types to imports from contracts, switch workforce.ts to api.ts helpers.
3. **Verify Tamil Nadu's minimum wage from an official G.O. before the demo** (three conflicting figures found: ₹450 / ₹537–545 / ₹783 per day) — the demo's story districts are all in TN. Also worth checking Delhi's half-yearly revision (Oct 2026).
4. `server/bhashini.ts` only if Bhashini keys arrive (Hono router proxying speech-to-text, silent browser fallback); otherwise voice polish only.
5. Hour blocks 21–24: rehearsals; fixes only through pull requests.

## Session log

### Session 2 — 2026-10-24 (ZCode / GLM-5.3-Flash, afternoon)

Read both planning docs; fetched origin (P1/P2/P4 branches exist, nothing merged to main); aligned with P1's contracts.ts shapes and P4's placeholder path. Wage research via subagents: all 7 GLWC benchmarks verified on-page (2025 estimates, figures match proposal); minimum wages for 14 states from India Briefing (June 2026 guide) + cross-checks, 4 states left null. Built and committed all P3 deliverables (commits 98d4035..51bd323 + this file): wages.json, fairwork.ts + 22 tests, FairWorkBadge, workforce page + voice + persistence, seeds (9 workforces), profile badge. Fixed min-vs-living precedence (state minimum outranks the ladder) and the detached checkbox. Full browser verification as above. Created this context file and AGENTS.md so any model can pick up the work.

### Session 1 — 2026-10-24 (ZCode / GLM-5.3-Flash, morning)

Non-coding setup session: ran the project locally (npm install, dev server on :5173), advised on branching (then: stay on dev1 — superseded by the team plan), surveyed ZCode skills, connected the OpenDesign MCP (registered in ~/.zcode/cli/config.json, launcher at ~/.gemini/config/open-design-mcp/od-mcp-launcher.mjs), tested the EXPLABS DeepSeek API and the OpenCode free tier (quota exhausted), checked plan quota. No repo changes.
