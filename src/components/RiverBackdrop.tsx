// The site's ambient water: long thin waves drifting behind every page, with a slow scroll parallax. Each workspace gives the water
// its own tint (buyers ink, suppliers clay, ecosystem green). It also puts a ripple under every click on a button.
// Everything animates by transform or colour only, and holds still when the visitor prefers reduced motion.
import { useRef } from 'react';
import { gsap, MOTION_OK, NO_MOTION, useGSAP } from '../gsapSetup';

const W = 1600, H = 900;
const INK = '#111111', CLAY = '#a4552c', GREEN = '#3d5a45';

type Where = 'home' | 'buyer' | 'supplier' | 'ecosystem';
const TINT: Record<Where, [string, string, string]> = {
  home: [INK, CLAY, GREEN],
  buyer: [INK, INK, CLAY],
  supplier: [CLAY, CLAY, INK],
  ecosystem: [GREEN, INK, GREEN],
};

// y is a fraction of the height; amp and period are in viewBox units; speed is units a second; tone picks one of the three tints
const LINES = [
  { y: 0.08, amp: 18, period: 900, speed: 64, w: 1.3, op: 0.2, tone: 0, dash: '' },
  { y: 0.22, amp: 36, period: 1240, speed: 92, w: 1.5, op: 0.17, tone: 1, dash: '' },
  { y: 0.38, amp: 26, period: 760, speed: 52, w: 1.3, op: 0.22, tone: 2, dash: '2 9' },
  { y: 0.55, amp: 44, period: 1420, speed: 118, w: 1.8, op: 0.15, tone: 0, dash: '' },
  { y: 0.72, amp: 24, period: 980, speed: 76, w: 1.3, op: 0.2, tone: 1, dash: '' },
  { y: 0.89, amp: 16, period: 700, speed: 58, w: 1.3, op: 0.2, tone: 2, dash: '2 9' },
] as const;

// Soft bodies of water under the lines: a faint tint that fills from a wave down to the bottom of the page
const FILLS = [
  { y: 0.3, amp: 30, period: 1300, speed: 70, tone: 1, op: 0.055 },
  { y: 0.66, amp: 34, period: 1000, speed: 90, tone: 2, op: 0.05 },
] as const;

/** A wave that repeats exactly every `period`, so sliding it by one period is invisible and the flow never seems to restart. */
function wave(y: number, amp: number, period: number, close = false) {
  const q = period / 4, start = -period, end = W + period;
  let d = `M ${start} ${y} Q ${start + q} ${y - 2 * amp} ${start + 2 * q} ${y}`;
  let x = start + 2 * q;
  for (; x < end; x += 2 * q) d += ` T ${x + 2 * q} ${y}`;
  return close ? `${d} L ${x} ${H + 60} L ${start} ${H + 60} Z` : d;
}

export default function RiverBackdrop({ where }: { where: Where }) {
  const root = useRef<SVGSVGElement>(null);

  // One-time setup: drift, parallax, click ripples
  useGSAP(() => {
    const svg = root.current;
    if (!svg) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const lines = gsap.utils.toArray<SVGPathElement>('.rv-line', svg);
      lines.forEach((el, i) => {
        const L = LINES[i]!;
        gsap.fromTo(el, { x: 0 }, { x: L.period, duration: L.period / L.speed, ease: 'none', repeat: -1 });
        if (L.dash) gsap.to(el, { strokeDashoffset: -22, duration: 2.4, ease: 'none', repeat: -1 });
      });
      gsap.utils.toArray<SVGPathElement>('.rv-fill', svg).forEach((el, i) => {
        const F = FILLS[i]!;
        gsap.fromTo(el, { x: 0 }, { x: F.period, duration: F.period / F.speed, ease: 'none', repeat: -1 });
      });
      // the water sits still while you scroll past it, so content seems to travel over the current
      gsap.to(svg.querySelector('.rv-all'), { y: -90, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 1.2 } });

      // a ripple spreads from the exact point of any click on a button
      const onDown = (e: PointerEvent) => {
        const host = (e.target as HTMLElement | null)?.closest<HTMLElement>('.btn, .door-main, .door-link, .pill, .segmented button, button.item, .step');
        if (!host || host.hasAttribute('disabled')) return;
        const r = host.getBoundingClientRect();
        const size = Math.max(r.width, r.height) * 2.2;
        const dot = document.createElement('span');
        dot.className = 'ripple';
        dot.style.cssText = `left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;width:${size}px;height:${size}px`;
        host.classList.add('has-ripple');
        host.appendChild(dot);
        gsap.fromTo(dot, { scale: 0.1, autoAlpha: 0.22 }, { scale: 1, autoAlpha: 0, duration: 0.9, ease: 'power2.out', onComplete: () => dot.remove() });
      };
      document.addEventListener('pointerdown', onDown);
      return () => document.removeEventListener('pointerdown', onDown);
    });
    mm.add(NO_MOTION, () => undefined);
    return () => mm.revert();
  }, { scope: root });

  // The water changes colour when you change workspace
  useGSAP(() => {
    const lines = gsap.utils.toArray<SVGPathElement>('.rv-line', root.current);
    lines.forEach((el, i) => gsap.to(el, { stroke: TINT[where][LINES[i]!.tone], duration: 1.4, ease: 'power2.inOut', overwrite: 'auto' }));
    gsap.utils.toArray<SVGPathElement>('.rv-fill', root.current).forEach((el, i) => gsap.to(el, { fill: TINT[where][FILLS[i]!.tone], duration: 1.4, ease: 'power2.inOut', overwrite: 'auto' }));
  }, { scope: root, dependencies: [where] });

  return (
    <svg ref={root} className="rv" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g className="rv-all">
        {FILLS.map((F, i) => <path key={`f${i}`} className="rv-fill" d={wave(F.y * H, F.amp, F.period, true)} fill={TINT[where][F.tone]} opacity={F.op} />)}
        {LINES.map((L, i) => (
          <path key={i} className="rv-line" d={wave(L.y * H, L.amp, L.period)} fill="none" stroke={TINT[where][L.tone]} strokeWidth={L.w} strokeLinecap="round" opacity={L.op} strokeDasharray={L.dash || undefined} />
        ))}
      </g>
    </svg>
  );
}
