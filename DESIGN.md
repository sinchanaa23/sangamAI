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
