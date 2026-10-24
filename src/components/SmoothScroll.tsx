// Inertial page scrolling with Lenis, driven by GSAP's ticker so ScrollTrigger and the rivers stay in step with it
// (the setup the Lenis README gives for GSAP). Panels that scroll on their own keep native scrolling, and visitors who prefer
// reduced motion get the browser's normal scroll.
import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap, ScrollTrigger } from '../gsapSetup';

const NATIVE = '.drawer, .sidebar, select, textarea, .table-wrap';

export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ autoRaf: false, lerp: 0.09, wheelMultiplier: 0.95, prevent: (node) => !!node.closest(NATIVE) });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(tick); lenis.destroy(); };
  }, []);
  return null;
}
