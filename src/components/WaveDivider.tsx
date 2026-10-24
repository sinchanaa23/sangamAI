// A hairline wave between sections that draws itself as it scrolls into view.
import { useRef } from 'react';
import { gsap, MOTION_OK, NO_MOTION, useGSAP } from '../gsapSetup';

const W = 1200;
const PATH = (() => {
  let d = 'M 0 14 Q 50 2 100 14';
  for (let x = 100; x < W; x += 100) d += ` T ${x + 100} 14`;
  return d;
})();

export default function WaveDivider() {
  const root = useRef<SVGSVGElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo('.wd-path', { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', ease: 'none', scrollTrigger: { trigger: root.current, start: 'top 92%', end: 'top 55%', scrub: 0.6 } });
    });
    mm.add(NO_MOTION, () => undefined);
    return () => mm.revert();
  }, { scope: root });
  return (
    <svg ref={root} className="wave-divider" viewBox={`0 0 ${W} 28`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="wd-path" d={PATH} fill="none" stroke="#111111" strokeWidth="1.2" opacity="0.28" />
    </svg>
  );
}
