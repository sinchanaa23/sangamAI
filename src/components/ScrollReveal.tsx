// Content arrives as you scroll: cards, stats and panels rise into place in small groups as they enter the screen, on every page.
// Only elements present when the page opens are hidden first, so anything added later simply appears.
import type { RefObject } from 'react';
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from '../gsapSetup';

const TARGETS = '.card, .stat, .door, .chain, .rm-card, .home-sdg, .checklist li';

export default function useScrollReveal(scope: RefObject<HTMLElement | null>, pageKey: string) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const els = gsap.utils.toArray<HTMLElement>(TARGETS, scope.current).filter((el) => !el.closest('.home-hero'));
      if (!els.length) return;
      gsap.set(els, { autoAlpha: 0, y: 30 });
      ScrollTrigger.batch(els, {
        start: 'top 94%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.95, ease: 'expo.out', stagger: 0.07, overwrite: true, clearProps: 'transform' }),
      });
    });
    return () => mm.revert();
  }, { scope, dependencies: [pageKey], revertOnUpdate: true });
}
