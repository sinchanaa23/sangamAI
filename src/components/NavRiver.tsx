// A current that runs along the bottom of the top bar each time you go to another page: a wave grows left to right, then trails off.
import { useRef } from 'react';
import { gsap, MOTION_OK, useGSAP } from '../gsapSetup';

const W = 1200;
const PATH = (() => {
  let d = 'M 0 6 Q 37.5 -2 75 6';
  for (let x = 75; x < W; x += 75) d += ` T ${x + 75} 6`;
  return d;
})();

export default function NavRiver({ pageKey }: { pageKey: string }) {
  const root = useRef<SVGSVGElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.timeline()
        .fromTo('.nr-wave', { drawSVG: '0% 0%', autoAlpha: 1 }, { drawSVG: '0% 100%', duration: 0.75, ease: 'power2.inOut' })
        .to('.nr-wave', { drawSVG: '100% 100%', duration: 0.7, ease: 'power2.in' }, '>-0.05');
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [pageKey], revertOnUpdate: true });
  return (
    <svg ref={root} className="nav-river" viewBox={`0 0 ${W} 12`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="nr-wave" d={PATH} fill="none" stroke="#111111" strokeWidth="1.5" opacity="0" />
    </svg>
  );
}
