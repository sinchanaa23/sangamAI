// How far down the page you are, drawn as a river on the right edge: the stream fills in as you scroll and a dot rides it.
import { useRef, useState } from 'react';
import { gsap, NO_MOTION, ScrollTrigger, useGSAP } from '../gsapSetup';

const WIDTH = 18;
const river = (h: number) => {
  let d = `M ${WIDTH / 2} 0 Q ${WIDTH - 3} 22 ${WIDTH / 2} 44`;
  for (let y = 44; y < h; y += 44) d += ` T ${WIDTH / 2} ${Math.min(y + 44, h)}`;
  return d;
};

export default function ScrollProgress({ pageKey }: { pageKey: string }) {
  const root = useRef<SVGSVGElement>(null);
  const [h, setH] = useState(() => Math.max(200, window.innerHeight - 110));

  useGSAP(() => {
    const svg = root.current;
    if (!svg) return;
    const onResize = () => setH(Math.max(200, window.innerHeight - 110));
    window.addEventListener('resize', onResize);
    const path = svg.querySelector<SVGPathElement>('.sp-path')!;
    const still = window.matchMedia(NO_MOTION).matches;
    gsap.set(path, { drawSVG: '0%' });
    const tl = gsap.timeline({ defaults: { ease: 'none' } })
      .to(path, { drawSVG: '100%' }, 0)
      .to('.sp-dot', { motionPath: { path, align: path, alignOrigin: [0.5, 0.5] } }, 0);
    // only worth showing when the page is long enough to scroll
    const st = ScrollTrigger.create({
      start: 0, end: 'max', animation: tl, scrub: still ? true : 0.5,
      onRefresh: (self) => { svg.classList.toggle('sp-on', self.end > window.innerHeight * 0.5); },
    });
    return () => { window.removeEventListener('resize', onResize); st.kill(); };
  }, { scope: root, dependencies: [pageKey, h], revertOnUpdate: true });

  return (
    <svg ref={root} className="sp" width={WIDTH} height={h} viewBox={`0 0 ${WIDTH} ${h}`} aria-hidden="true" focusable="false">
      <path d={river(h)} fill="none" stroke="#111111" strokeWidth="1.2" opacity="0.12" />
      <path className="sp-path" d={river(h)} fill="none" stroke="#111111" strokeWidth="1.6" strokeLinecap="round" />
      <circle className="sp-dot" r="3.6" fill="#a4552c" />
    </svg>
  );
}
