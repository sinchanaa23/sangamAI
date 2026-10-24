// The sangam: three rivers meeting in one stream. Buyers (demand), producers (capacity) and fair work, the third river that,
// like the Saraswati at Prayagraj, is never seen on its own but is what the other two are measured against.
// "intro" plays once on load; "scrub" ties the same drawing to scroll progress through a section.
import { useRef } from 'react';
import type { RefObject } from 'react';
import { gsap, MOTION_OK, NO_MOTION, ScrollTrigger, useGSAP } from '../gsapSetup';

const RIVERS = [
  { id: 'buyers', label: 'Buyers', sub: 'demand', d: 'M 70 76 C 70 170, 210 188, 300 276', color: '#111111', lx: 70 },
  { id: 'producers', label: 'Producers', sub: 'capacity', d: 'M 530 76 C 530 170, 390 188, 300 276', color: '#a4552c', lx: 530 },
  { id: 'trust', label: 'Fair work', sub: 'the unseen river', d: 'M 300 76 L 300 276', color: '#3d5a45', lx: 300 },
] as const;
const DEAL = 'M 300 276 C 300 346, 300 398, 300 456';
const PARTICLES = 3;

interface Props {
  mode: 'intro' | 'scrub';
  /** scrub mode: the section whose scroll progress drives the drawing */
  trigger?: RefObject<HTMLElement | null>;
  className?: string;
}

export default function Confluence({ mode, trigger, className }: Props) {
  const root = useRef<SVGSVGElement>(null);

  useGSAP((_ctx, contextSafe) => {
    const svg = root.current;
    if (!svg) return;
    const q = gsap.utils.selector(svg);
    const rivers = q('.cf-river');
    const deals = q('.cf-deal');
    const labels = q('.cf-label');
    const tail = q('.cf-tail');
    const ripples = q('.cf-ripple');
    const dealRef = svg.querySelector<SVGPathElement>('.cf-deal-ref')!;
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      // ---- the drawing, as one timeline of length D (4 s on load, 1 unit when scrubbed)
      const D = mode === 'intro' ? 4.2 : 1;
      const tl = gsap.timeline({ paused: mode === 'scrub', defaults: { ease: mode === 'intro' ? 'power2.inOut' : 'none' } });
      const at = (f: number) => f * D;
      const dur = (f: number) => f * D;
      tl.fromTo(labels[0], { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: dur(0.12) }, at(0))
        .fromTo(rivers[0], { drawSVG: '0%' }, { drawSVG: '100%', duration: dur(0.34) }, at(0))
        .fromTo(labels[1], { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: dur(0.12) }, at(0.26))
        .fromTo(rivers[1], { drawSVG: '0%' }, { drawSVG: '100%', duration: dur(0.34) }, at(0.26))
        .fromTo(labels[2], { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: dur(0.12) }, at(0.52))
        .fromTo(rivers[2], { drawSVG: '0%', opacity: 0.25 }, { drawSVG: '100%', opacity: 0.5, duration: dur(0.2) }, at(0.52))
        .fromTo(deals, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur(0.26), stagger: dur(0.03), ease: mode === 'intro' ? 'power2.out' : 'none' }, at(0.72))
        .fromTo(tail, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: dur(0.12) }, at(0.9));

      // ---- continuous life once the rivers have met: ripples at the confluence, particles carried downstream
      const ripple = gsap.fromTo(ripples, { scale: 0.3, autoAlpha: 0.55, svgOrigin: '300 276' }, { scale: 3.6, autoAlpha: 0, duration: 3.8, ease: 'power1.out', stagger: 1.25, repeat: -1, paused: true });
      const flows: gsap.core.Timeline[] = [];
      RIVERS.forEach((r, ri) => {
        const path = svg.querySelector<SVGPathElement>(`.cf-river-${r.id}`)!;
        q(`.cf-p-${r.id}`).forEach((p, k) => {
          const t = gsap.timeline({ repeat: -1, paused: true });
          t.set(p, { autoAlpha: 1 })
            .to(p, { duration: ri === 2 ? 2.6 : 3.4, ease: 'none', motionPath: { path, align: path, alignOrigin: [0.5, 0.5] } })
            .to(p, { duration: 1.7, ease: 'none', motionPath: { path: dealRef, align: dealRef, alignOrigin: [0.5, 0.5] } })
            .to(p, { autoAlpha: 0, duration: 0.3 }, '-=0.3');
          t.progress((k + ri * 0.33) / PARTICLES);
          flows.push(t);
        });
      });
      gsap.set(q('.cf-particle'), { autoAlpha: 0 });
      const live = (on: boolean) => {
        if (on) { ripple.play(); flows.forEach((t) => t.play()); } else { ripple.pause(0); gsap.set(ripples, { autoAlpha: 0 }); flows.forEach((t) => t.pause()); gsap.set(q('.cf-particle'), { autoAlpha: 0 }); }
      };

      if (mode === 'intro') {
        tl.add(() => live(true), at(0.8));
      } else if (trigger?.current) {
        ScrollTrigger.create({
          trigger: trigger.current, start: 'top 70%', end: 'bottom 60%', animation: tl, scrub: 0.6,
          onUpdate: (self) => live(self.progress > 0.96),
        });
      }

      // ---- the whole figure drifts a few pixels toward the pointer (quickTo reuses one tween)
      const fig = q('.cf-figure')[0];
      const wrap = svg.parentElement;
      if (mode === 'intro' && fig && wrap && window.matchMedia('(pointer: fine)').matches) {
        const xTo = gsap.quickTo(fig, 'x', { duration: 0.9, ease: 'power3' });
        const yTo = gsap.quickTo(fig, 'y', { duration: 0.9, ease: 'power3' });
        const move = contextSafe!((e: PointerEvent) => {
          const r = wrap.getBoundingClientRect();
          xTo(((e.clientX - r.left) / r.width - 0.5) * 14);
          yTo(((e.clientY - r.top) / r.height - 0.5) * 10);
        });
        wrap.addEventListener('pointermove', move);
        return () => { wrap.removeEventListener('pointermove', move); live(false); };
      }
      return () => live(false);
    });

    // Reduced motion: the finished picture, still
    mm.add(NO_MOTION, () => {
      gsap.set(rivers, { drawSVG: '100%' });
      gsap.set(deals, { drawSVG: '100%' });
      gsap.set(q('.cf-river-trust'), { opacity: 0.5 });
      gsap.set(ripples, { autoAlpha: 0 });
      gsap.set(q('.cf-particle'), { autoAlpha: 0 });
    });

    return () => mm.revert();
  }, { scope: root, dependencies: [mode] });

  return (
    <svg ref={root} className={`cf${className ? ` ${className}` : ''}`} viewBox="0 0 600 500" role="img"
      aria-label="Three rivers, buyers, producers and fair work, meeting in one braided stream that ends in a signed deal.">
      <g className="cf-figure">
        {RIVERS.map((r) => (
          <g key={r.id}>
            <path className={`cf-river cf-river-${r.id}`} d={r.d} fill="none" stroke={r.color} strokeWidth={r.id === 'trust' ? 2 : 4} strokeLinecap="round" />
            <text className="cf-label" x={r.lx} y={26} textAnchor="middle"><tspan className="cf-name">{r.label}</tspan><tspan x={r.lx} dy={22} className="cf-sub">{r.sub}</tspan></text>
          </g>
        ))}
        {/* the braided stream: all three rivers continue side by side */}
        <path className="cf-deal-ref" d={DEAL} fill="none" stroke="none" />
        {RIVERS.map((r, i) => (
          <path key={r.id} className="cf-deal" d={DEAL} transform={`translate(${(i - 1) * 5.5} 0)`} fill="none" stroke={r.color} strokeWidth={3} strokeLinecap="round" opacity={r.id === 'trust' ? 0.7 : 1} />
        ))}
        <g className="cf-ripples" fill="none" stroke="#111111" strokeWidth="1">
          {[0, 1, 2].map((i) => <circle key={i} className="cf-ripple" cx="300" cy="276" r="8" opacity="0" />)}
        </g>
        {RIVERS.map((r) => [...Array(PARTICLES)].map((_, k) => <circle key={`${r.id}${k}`} className={`cf-particle cf-p-${r.id}`} r={r.id === 'trust' ? 3 : 4.2} fill={r.color} opacity="0" />))}
        <circle cx="300" cy="276" r="6" fill="#fbfbfa" stroke="#111111" strokeWidth="2" />
        <text className="cf-tail" x="300" y="490" textAnchor="middle"><tspan className="cf-name">One signed deal</tspan></text>
      </g>
    </svg>
  );
}
