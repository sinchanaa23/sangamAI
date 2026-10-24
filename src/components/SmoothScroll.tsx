// Inertial page scrolling with Lenis, driven by GSAP's ticker so ScrollTrigger and the rivers stay in step with it
// (the setup the Lenis README gives for GSAP). Panels that scroll on their own keep native scrolling, and visitors who prefer
// reduced motion get the browser's normal scroll. On every page change it jumps to the top and re-measures the scroll triggers.
import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap, ScrollTrigger } from '../gsapSetup';
import { emitScroll, getLenis, setLenis } from '../scroll';

const NATIVE = '.drawer, .sidebar, select, textarea, .table-wrap';

export default function SmoothScroll({ pageKey }: { pageKey: string }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ autoRaf: false, lerp: 0.09, wheelMultiplier: 0.95, prevent: (node) => !!node.closest(NATIVE) });
    setLenis(lenis);
    lenis.on('scroll', (l: Lenis) => {
      ScrollTrigger.update();
      emitScroll({ velocity: l.velocity, progress: l.progress, direction: l.direction });
    });
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(tick); lenis.destroy(); setLenis(null); };
  }, []);

  useEffect(() => {
    getLenis()?.scrollTo(0, { immediate: true, force: true });
    // the new page has a different height: let it render, then recalculate every trigger
    const id = requestAnimationFrame(() => requestAnimationFrame(() => ScrollTrigger.refresh()));
    return () => cancelAnimationFrame(id);
  }, [pageKey]);

  return null;
}
