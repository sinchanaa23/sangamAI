import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

let lenis: Lenis | null = null;
let initialized = false;

/**
 * Idempotent Lenis smooth-scroll bootstrap with the GSAP ScrollTrigger
 * integration. Under `prefers-reduced-motion: reduce` this does nothing and
 * the page keeps native scrolling. Safe to call more than once.
 */
export function initSmoothScroll(): void {
  if (typeof window === 'undefined' || initialized || lenis) return;
  initialized = true;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);

  const instance = new Lenis({ autoRaf: true, lerp: 0.12 });
  lenis = instance;

  instance.on('scroll', () => {
    ScrollTrigger.update();
  });
  gsap.ticker.add((time) => {
    instance.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

/** The live Lenis instance, or null when smooth scroll is off (reduced motion / SSR). */
export function getLenis(): Lenis | null {
  return lenis;
}
