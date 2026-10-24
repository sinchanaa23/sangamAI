# Sangam design language — "Confluence"

> Decision-complete spec for the motion/visual upgrade. Implemented on `feat/supplier-design`.
> Kit lives in **new** files under `src/components/motion/` — no shared file is edited, no new npm dependency is added.
> **Provenance note:** ReactBits (github.com/DavidHDev/react-bits) has **no standard license file** (GitHub: NOASSERTION). The kit is therefore **original code** implementing well-known interaction patterns; the sources fetched to `.reactbits-tmp/` were used as behavioral reference only and must not be copied verbatim. `.reactbits-tmp/` is scratch and never committed.

## 1. Principles

1. **Settling, not bouncing.** Motion reads as things finding their place — a confluence of two streams (the brand's logo). Entrances fade-rise 6px, ease-out, 300–420ms. No spring overshoot, no parallax, no 3D tilt on data.
2. **Motion carries meaning, not decoration.** Numbers count up because the demo's story is moving numbers (wage uplift, imports replaced). Grade changes pop because a grade change is an event. Everything else stays still.
3. **The token system is sacred.** All colors come from `src/styles.css` custom properties (extend via `motion.css`, never rename). Role colors keep their semantics: teal buyer, orange supplier/rural, purple auditor, green verified, red blocked.
4. **The brand gradient is rare.** The teal→vermilion flowing gradient (`--fw-grad`) appears only on brand moments: the grade achievement label and (adoption snippet) the Sangam wordmark. Never on body text, buttons, or chrome.
5. **Data is still.** Text inputs, tables, charts (recharts animation stays off, per P4's deliberate choice), the map canvas, and the live reasons list never animate. Live-typed numbers retarget smoothly rather than restarting.
6. **Every animation is optional.** A single `prefers-reduced-motion: reduce` block in `motion.css` kills all of it. This matches the precedent P2 set in `room.css`.
7. **Institutional warmth.** The audience is an enterprise buyer and a cooperative manager on a phone. Calm, trustworthy, warm — a public-institution annual report, not a startup landing page.

## 2. Motion tokens — `src/components/motion/motion.css` (Phase 1A owns this file)

```css
/* Confluence motion tokens. Extends src/styles.css — never renames its variables. */
:root {
  --fw-dur-fast: 180ms;      /* hovers, pops start */
  --fw-dur: 350ms;           /* entrances — matches P2's nr-in precedent */
  --fw-dur-slow: 600ms;      /* count-up easing */
  --fw-ease: cubic-bezier(0.2, 0.6, 0.2, 1); /* ease-out, no overshoot */
  --fw-rise: 6px;            /* entrance translate */
  --fw-stagger: 45ms;        /* per-item delay in staggered lists */
  --fw-grad: linear-gradient(100deg, var(--accent) 0%, #0e9488 38%, var(--rural) 100%);
  --fw-spot: rgba(15, 118, 110, 0.08); /* spotlight tint on hover */
}

@media (prefers-reduced-motion: reduce) {
  .fw-anim, .fw-anim * { animation: none !important; transition-duration: 1ms !important; }
}
```

Plus these keyframes/classes in `motion.css`: `fw-rise` (fade+rise entrance), `fw-pop` (scale 1→1.16→1, used by the badge), `fw-shimmer` (gradient position sweep), and utility classes `.fw-grad-text` (background-clip text with `--fw-grad`), `.fw-rise` (entrance with `animation-delay` set inline per item). All selectors are `fw-` prefixed — zero collision risk with existing classes.

## 3. The kit — `src/components/motion/` (all original code, dependency-free)

| File | Component | Pattern adapted from | Props (TypeScript) | Notes |
|---|---|---|---|---|
| `TextReveal.tsx` (1A) | `<TextReveal>` | ReactBits SplitText (behavior only) | `{ text: string; as?: 'h1' \| 'h2' \| 'div' \| 'span'; className?: string; delay?: ms; stagger?: ms }` | Splits into **graphemes** via `Intl.Segmenter` (with code-point fallback) — never code units, or Devanagari/Kannada/Tamil matras break. Each grapheme is a span with `animation-delay: i*stagger`. Default stagger = `--fw-stagger`. |
| `GradientText.tsx` (1A) | `<GradientText>` | ReactBits GradientText | `{ children: ReactNode; className?: string }` | `span.fw-grad-text` with a slow `fw-shimmer` background-position sweep (12s, linear, infinite — subtle). |
| `CountUp.tsx` (1A) | `<CountUp>` | ReactBits CountUp (behavior only) | `{ value: number; duration?: ms (default 600); className?: string; format?: (n: number) => string }` | rAF + ease-out, **retargeting**: a value change mid-animation eases toward the new target (typing produces smooth trailing numbers, no restart spam). First reveal starts from 0 via IntersectionObserver. Rendered with `font-variant-numeric: tabular-nums`. |
| `FadeContent.tsx` (1B) | `<FadeContent>` | ReactBits FadeContent | `{ children: ReactNode; delay?: ms; className?: string }` | IntersectionObserver (once, rootMargin 40px) adds `.fw-in`; CSS transitions opacity/transform. Renders a `div`. |
| `SpotlightCard.tsx` (1B) | `<SpotlightCard>` | ReactBits SpotlightCard | `{ children: ReactNode; className?: string; tint?: string }` | `div` with `onMouseMove` writing `--mx/--my` custom properties; CSS radial-gradient at that point appears over the card on hover (180ms fade-in). Used **with** the existing `card` class (`className="card"`), not instead of it. |
| `ClickSpark.tsx` (1B) | `<ClickSpark>` | ReactBits ClickSpark | `{ children: ReactNode; className?: string; color?: string; count?: number }` | Wraps a single child (a button). On click, spawns `count` (default 6) absolutely-positioned 6px line particles from the click point, animated outward 300ms, then removed. Particles are appended to the wrapper (no portals, no z-index games). |

**Dropped, with reasons:** TiltedCard (principle 1 — no 3D tilt on data), ShinyText (superseded by GradientText for our one brand moment), DotGrid (canvas cost; offered to P4 as an adoption snippet only), Aurora (same — hero texture is P4's call). SplitText/FadeContent/CountUp sources that import gsap/motion are behavior references only.

## 4. Integration map (Phase 2 — all P3-owned files)

Line numbers refer to the current branch.

**`src/seller/WorkforcePage.tsx`**
- L227 h1 → `<TextReveal as="h1" className="lead" text={\`${t.gradeTitle} · ${t.skills}\`} />` (renders the localized string; splitting happens on the resolved string, so all four locales are safe).
- L256 live-grade card → wrap the `div.card.stack` in `<SpotlightCard className="card stack">` (replace the div).
- Grade label beside the badge (L262 area, `GRADE_LABEL[score.grade]` inside the muted span) → `<GradientText>{GRADE_LABEL[score.grade]}</GradientText>` — the achievement words carry the confluence gradient.
- L269/272 benchmark & minimum per-day values → `<CountUp value={living.perDayInr} format={(n) => n.toLocaleString('en-IN')} />` (same for min).
- L274 womenShare %, L275 totalWorkers → `<CountUp>` (retargeting makes typing feel alive).
- L337 Save button, L357 Start-voice button → wrap each in `<ClickSpark>`.
- L282 form card, L348 voice card → `<FadeContent>` (below-fold entrance).
- NOT animated: skills table, form inputs, reasons list (recomputes per keystroke), voice live-note.

**`src/components/FairWorkBadge.tsx`**
- Grade circle (L21–25): when `score.grade` changes, re-key the circle span (`key={\`g-${score.grade}-${tick}\`}` where `tick` increments via a `useEffect` on grade... simplest correct form: `key={score.grade + String(tickRef)}` — see shape below) and give it class `fw-pop` (keyframes in motion.css: scale 1→1.16→1, 320ms, plus a one-shot ring via `box-shadow` inset pulse in the grade color). No layout shift (transform only). Works unchanged inside P2's `SupplierGrade` wrapper (no prop changes).
```tsx
const [tick, setTick] = useState(0);
const prev = useRef(score.grade);
useEffect(() => { if (prev.current !== score.grade) { prev.current = score.grade; setTick((t) => t + 1); } }, [score.grade]);
// circle: <span key={tick} className={...existing + ' fw-pop'} style={{...existing}}>
```
- Tooltip and layout unchanged.

**`src/seller/ProfilePage.tsx`**
- `WorkforceGradeCard`'s `div.card.row` (L29) → `<SpotlightCard className="card row">`; wrap the whole card in `<FadeContent>`.
- L138 verification note "N of M verified" → `<CountUp>` for N and M.
- L187 save button (and L181 AI-read label-button) → `<ClickSpark>`.
- NOT animated: form inputs, cert table.

**`src/seller/SellerView.tsx`** (static per load — entrance/stagger only)
- L39 h1 (seller name) → `<TextReveal as="h1" className="lead" text={seller.name} />`.
- L33 identity card → `<SpotlightCard className="card">`.
- L51 open-requirements count → `<CountUp>`.
- L81–92 readiness checklist `<li>`s → `<FadeContent delay={i * 45}>` per item (the staggered settle — this is the page's signature moment).
- NOT animated: chips, buttons (small utility actions), the why-list.

**`src/seller/Diversification.tsx`** (light touch)
- L35 h1 → TextReveal. L82 ROI card and L104 detail card → FadeContent. L114–117 `grid-4` stats → CountUp (retargets on opportunity selection). Charts untouched.

## 5. DO-NOT-ANIMATE list

Text inputs and the skills table; recharts charts (animation deliberately off); MapCanvas; the live reasons list; tooltips; nav/sidebar (P4's); the voice live-note; anything while a user is typing in it (CountUp retargeting is the one exception, by design).

## 6. Adoption snippets (optional, for the file owners — we touch nothing)

**P2 — negotiation room (`src/buyer/NegotiationRoom.tsx`):**
```tsx
import FadeContent from '../../components/motion/FadeContent';
import ClickSpark from '../../components/motion/ClickSpark';
import CountUp from '../../components/motion/CountUp';
// message entrance (replaces or sits alongside nr-in):
<FadeContent delay={i * 45}>{/* existing message article */}</FadeContent>
// "Negotiate with agents" button:
<ClickSpark><button className="btn primary">…</button></ClickSpark>
// scorecard wage-vs-living:
<CountUp value={Math.round(score.wageVsLivingWage * 100)} format={(n) => `${n}%`} />
```

**P4 — landing + SDG 8 dashboard:**
```tsx
import TextReveal from '../components/motion/TextReveal';
import GradientText from '../components/motion/GradientText';
import CountUp from '../components/motion/CountUp';
// hero: <TextReveal as="h1" className="lead" text="Sangam" /> or wrap the wordmark in <GradientText>
// ImpactPage .stat .value tiles: <CountUp value={n} format={crore /* or existing formatter */} />
```
Hero texture (Aurora/DotGrid patterns) is P4's call; the ReactBits sources in `.reactbits-tmp/` remain available as reference until this branch merges.

## 7. Implementation split

**Phase 1A (agent A) owns:** `src/components/motion/motion.css`, `TextReveal.tsx`, `GradientText.tsx`, `CountUp.tsx`.
**Phase 1B (agent B) owns:** `src/components/motion/effects.css`, `FadeContent.tsx`, `SpotlightCard.tsx`, `ClickSpark.tsx`.
The phases are file-disjoint; 1B's CSS does not depend on 1A's tokens except `--fw-ease`/`--fw-dur-fast` — 1B may reference them but must also work if absent (provide local fallback values in `var()` defaults). Each phase must typecheck standalone with `npx tsc -b` (their files import nothing from the other phase).

**Phase 2 (agent C) owns:** all wiring in Section 4 (`WorkforcePage.tsx`, `FairWorkBadge.tsx`, `ProfilePage.tsx`, `SellerView.tsx`, `Diversification.tsx`) + this file's integration map as the source of truth. Import kit components directly (`../components/motion/TextReveal` etc.). Ends with `npx tsc -b`.

**Original-code rule for all phases:** write the components from scratch per the behavior described above; consult `.reactbits-tmp/<Name>.tsx` for behavioral reference only — do not copy its code (unlicensed repo).

## 8. Verification checklist (main session)

1. `npm run build` clean; `npx -y vitest@3 run` 22/22 (tests must not import motion files — they don't).
2. Browser, Supplier workspace → Workforce page: h1 letters settle in stagger; grade card has hover spotlight; changing a wage makes totalWorkers/womenShare trail smoothly and the grade badge pops on flip; Save + Start-voice emit sparks; scrolling shows form/voice cards fading in.
3. Supplier → Overview: name reveals, checklist items stagger in, count counts up.
4. Profile page: grade card fades in with spotlight; "N of M" counts.
5. Toggle `prefers-reduced-motion` in devtools (Rendering tab) → everything snaps with no animation.
6. Hindi locale (हिंदी toggle on seller pages): TextReveal renders Devanagari correctly (no broken matras).
7. P2's SupplierGrade path still renders (badge unchanged API).

---

# Delta: "Confluence Dark" (session 4)

User direction: darker colours, more of the striking ReactBits patterns — the light theme read as "too sober". This delta supersedes the restraint parts of Sections 1–3 where stated; principles 3 (tokens), 5 (data still), 6 (reduced-motion) and the DO-NOT-ANIMATE list REMAIN in force.

## D1. Dark theme — `src/components/motion/theme.css` (new file)

Overrides the app's `:root` tokens for dark (same names, never new ones). Loaded app-wide via one line in `src/main.tsx` (flagged to the team in the PR):

- Surfaces: `--bg: #0a1118`, `--card: #111a24`, `--line: #223140`
- Text: `--ink: #e8eef2`, `--ink-2: #9fb0bd`, `--ink-3: #64757f` (wait: keep contrast — use `#748899`)
- Accents brightened for dark contrast, softs become translucent tints:
  `--accent: #14b8a6 / rgba(20,184,166,.14)` · `--rural: #f97316 / rgba(249,115,22,.14)` · `--ready: #4ade80 / rgba(74,222,128,.14)` · `--potential: #fbbf24 / rgba(251,191,36,.14)` · `--import: #94a3b8 / rgba(148,163,184,.14)` · `--danger: #f87171 / rgba(248,113,113,.14)` · `--new: #a78bfa / rgba(167,139,250,.14)`
- Map: `--sea: #0d1b2a`, `--land: #16222e`, `--india: #1d4a44`, `--india-edge: #2dd4bf`
- `--shadow: 0 1px 2px rgba(0,0,0,.4)`; add `--fw-glow: 0 0 24px` helper
- Font/radius unchanged. Reduced-motion rules unaffected (they kill animation, not colour).

## D2. New kit components (original code; `.reactbits-tmp/{Aurora,DotGrid,SoftAurora,ShinyText,TiltedCard}.jsx` are behavioral reference only — that repo has no license)

| File | Component | Props | Behavior |
|---|---|---|---|
| `Aurora.tsx` + `bg.css` (agent 1) | `<Aurora>` | `{ colors?: string[]; className?: string; opacity?: number }` | 3–4 blurred gradient blobs (CSS filter: blur) drifting slowly (30–40s loops, translate/scale keyframes). Absolute, inset-0, pointer-events none, behind content. Default colors: teal/orange/purple at low alpha. |
| `DotGrid.tsx` (agent 1) | `<DotGrid>` | `{ color?: string; spacing?: px; radius?: px; className?: string; dim?: number }` | Canvas dot field; dots within ~120px of the cursor brighten and grow (rAF loop, devicePixelRatio aware, pauses when tab hidden). Absolute layer, pointer-events none. Default dot `#2dd4bf` at low alpha. |
| `ShinyText.tsx` (agent 2) | `<ShinyText>` | `{ children: ReactNode; className?: string; speed?: ms }` | Text with a periodic shine sweep (background-clip: text over a moving highlight), ~2.8s loop. Use on primary button labels and the brand word only. |
| `TiltCard.tsx` (agent 2) | `<TiltCard>` | `{ children: ReactNode; className?: string; maxTilt?: deg (default 6) }` | Subtle perspective tilt following the cursor; 6° ceiling, 150ms ease-out return on leave. Applied ONLY to the SellerView identity card — never to data-dense cards. |

## D3. Glow & glass utilities — `src/components/motion/glow.css` (agent 2) + motion.css edits (agent 2)

- `.fw-glass` — dark glass card: `background: rgba(17,26,36,.72); backdrop-filter: blur(10px); border: 1px solid rgba(45,212,191,.18)`.
- `.fw-glow` — `box-shadow: 0 0 0 1px var(--fw-glow-color, rgba(45,212,191,.3)), 0 0 24px var(--fw-glow-color, rgba(45,212,191,.25))` set via `--fw-glow-color`.
- `motion.css`: TextReveal gains blur-in (filter: blur(6px)→0 alongside the rise — reads dramatically on dark); `--fw-grad` stops brightened for dark (`#2dd4bf → #fb923c`).
- Primary buttons (`.btn.primary`) get the ShinyText treatment at the wiring level (component wrap, not a global class grab).

## D4. Wiring delta (agent 3)

- WorkforcePage: `<DotGrid>` as the page's background layer (very low alpha); the live-grade card becomes `fw-glass fw-glow` (glow color keyed to the current grade colour) with `<Aurora>` softly behind the card top region; Save/Start-voice labels wrapped in ShinyText; big CountUp numbers (workers, women %) may use `.fw-grad-text`.
- FairWorkBadge: COLOR map brightened for dark — A `#22c55e`, B `#14b8a6`, C `#f59e0b`, D `#f97316`, E `#ef4444`; circle gains a matching `box-shadow: 0 0 14px <color>40`. API unchanged.
- SellerView: identity card → TiltCard + fw-glass; Aurora behind the identity area.
- ProfilePage: WorkforceGradeCard → fw-glass + fw-glow(teal).
- Diversification: chart ticks/grid/strokes in MY file switch to dark-appropriate hexes (#748899 ticks, #223140 grid, brightened series colors); cards FadeContent (existing).
- KNOWN GAP (adoption note): P4's ImpactPage chart hardcodes light colors (#eef0f3 grid) — snippet in §6 updated to ask for dark equivalents after this merges; P2's room.css bubble borders may need one darker pass. Neither file is touched by us.

## D5. Verification additions

8. Dark visual pass on every P3 page: text contrast ≥ WCAG AA on --bg/--card, inputs/tables/chips readable, no white flash boxes.
9. Buyer "Supply chain today" spot-check: token-flipped pages look intentional; note (not fix) teammates' hardcoded light colors.
10. Badge glow + pop both visible on dark; Hindi still perfect; reduced-motion still kills everything.

---

# Delta 2: "Confluence Flow" — GSAP + Lenis (session 5)

User direction: use GSAP and Lenis, waves background, better buttons, sliding tabs — "neat, fun and cool". **This delta adds real npm dependencies: `gsap@3.15` and `lenis@1.3`** (package.json + lockfile changes in this PR — P1's file, flagged for review; all GSAP plugins are free since 3.13). The no-new-deps rule is superseded BY THE USER for these two packages only.

## F1. Smooth scroll — `src/components/motion/smooth.ts`

`initSmoothScroll()` (idempotent, module-level singleton): creates `new Lenis({ autoRaf: true, lerp: 0.12 })`, integrates GSAP: `lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);`. Skipped entirely under `prefers-reduced-motion` (native scroll). Called from `main.tsx` (the shared file, already carrying the theme import — +2 lines, flagged).

## F2. New kit components (all original code; `.reactbits-tmp/Waves.jsx` and `Magnet.jsx` are behavioral reference only)

| File | Component | Props | Behavior |
|---|---|---|---|
| `Waves.tsx` | `<Waves>` | `{ colors?: string[] (default teal/orange/violet); layers?: number (3); speed?: number; amplitude?: number; className?: string; opacity?: number }` | 2D-canvas layered sine waves drifting across the bottom of its container, gradient fills fading to transparent, gentle amplitude swell near the cursor. Absolute, pointer-events none, DPR-aware, pauses when hidden/offscreen; reduced-motion renders one static frame. |
| `Magnetic.tsx` | `<Magnetic>` | `{ children: ReactNode; className?: string; strength?: number (px, default 10); radius?: number (px, default 60) }` | Wraps one child (a button); inside `radius`, the child is pulled toward the cursor via GSAP `quickTo` (x/y, power3 ease), springs back to 0 on leave (`elastic.out(1, 0.4)`, ~0.6s). Disabled for touch pointers and reduced-motion (plain static child). |
| `SlideTabs.tsx` | `<SlideTabs<T extends string>>` | `{ items: { id: T; label: string }[]; value: T; onChange: (id: T) => void; className?: string }` | Tab row with an absolutely-positioned indicator pill that GSAP-animates (`x` + `width`, `back.out(1.6)`, ~0.45s) to the active tab on change; on mount it positions without animation. Replaces the safety pills pattern; offered to P2/P4 for their tab rows. Reduced-motion: indicator snaps. |
| `Reveal.tsx` | `<Reveal>` | `{ children: ReactNode; delay?: number; stagger?: number; y?: number; className?: string; scroll?: boolean }` | GSAP `fromTo` (opacity 0 → 1, y 24 → 0, slight blur, `power3.out`, 0.7s) for its children (`stagger` distributes). With `scroll` (default true when below the fold — implemented as: ScrollTrigger `start: 'top 88%'`), reveals on scroll; otherwise on mount. Replaces `FadeContent` usage in P3 pages (FadeContent stays in the kit for adoption snippets). |

## F3. Button polish — `src/components/motion/buttons.css`

Global-but-gentle polish of the existing `.btn` classes (equal specificity, loaded after styles.css): `.btn.primary` gets a subtle gradient border + hover lift (translateY(-1px)) + teal glow shadow; `.btn` gets a 150ms transform/color transition; focus-visible ring in accent. No layout/sizing changes — the app's buttons keep their metrics.

## F4. Wiring (agent C)

- WorkforcePage: `<Waves opacity={0.28}>` behind the grade-card region (replacing the Aurora there — Aurora stays on SellerView); Save + Start-voice buttons wrapped `Magnetic > ClickSpark > button(ShinyText label)`; safety record pills → `<SlideTabs>` (complete/partial/none); the four cards' `FadeContent` wraps → `<Reveal stagger={0.08}>` (one Reveal around the card stack or per-card with delay).
- Diversification: chart/detail card `FadeContent` → `Reveal` (scroll-triggered); h1 unchanged.
- SellerView / ProfilePage: unchanged this round (already glass/glow/aurora).
- KNOWN: `ScrollTrigger` + Lenis integration lives in smooth.ts; components just use gsap.

## F5. Verification additions

11. Smooth scroll: wheel/trackpad scrolling glides (no native steps); sticky topbar still sticks; sidebar's own scroll unaffected.
12. Waves render and drift on the workforce page; static under reduced-motion.
13. Save button: magnetic pull near cursor, spark on click, shine sweep on label.
14. SlideTabs: indicator slides between the three safety options; switching safety updates the grade as before (E/D downgrade logic intact).
15. All 51 tests still pass; tsc + build clean.

---

# Delta 3: Light unification (session 7) — SUPERSEDES the dark theme

User direction: no dark theme; the supplier tab matches the buyer tab's light river language, with GSAP + Lenis + motion.dev + ReactBits patterns doing the work. What changed:

- **Dark scope deleted**: theme.ts/theme.css removed; no body.fw-dark anywhere. All workspaces render main's warm paper language.
- **River components adopted**: every seller page calls `useScrollReveal`; WaveDividers (native ink stroke) between sections; the animated Confluence mark on the Overview identity card; serif display headings inherited globally from styles.css (`.lead` already uses var(--serif)).
- **Kit retuned for light**: Waves/DotGrid/Aurora call sites use the river palette (#a4552c/#1f6c9f/#346538) at low opacity; SlideTabs indicator token-driven; the badge keeps main's warm colours via var() fallbacks (dark overrides gone with theme.css); charts back to main's warm hexes.
- **motion.dev added** (`motion@14`, flagged dep): spring layout on skills rows, AnimatePresence on the save message and voice note.
- **Superseded**: D1–D5 (dark) and the fw-glass/fw-glow utilities remain in glow.css but are unused on pages.
