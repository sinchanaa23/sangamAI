import { useLayoutEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './buttons.css';

const SKIP_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

gsap.registerPlugin(ScrollTrigger);

/**
 * GSAP reveal wrapper: fades its direct children in (opacity 0 -> 1, y -> 0,
 * blur 6px -> 0) with power3.out over 0.7s. With `scroll` (default true) the
 * reveal is triggered once at `top 88%`; if the element is already on screen
 * at mount it plays immediately. Reduced-motion users get the final state
 * instantly.
 */
export default function Reveal({
  children,
  delay = 0,
  stagger = 0,
  y = 24,
  className,
  scroll = true,
}: {
  children: ReactNode;
  delay?: number;
  stagger?: number;
  y?: number;
  className?: string;
  scroll?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const targets = Array.from(el.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && !SKIP_TAGS.has(child.tagName),
    );
    if (targets.length === 0) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      gsap.set(targets, { opacity: 1, y: 0, filter: 'blur(0px)' });
      return undefined;
    }

    const ctx = gsap.context(() => {
      const rect = el.getBoundingClientRect();
      const inView =
        rect.top < window.innerHeight * 0.88 && rect.bottom > 0;

      const from = { opacity: 0, y, filter: 'blur(6px)' };
      const to = {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.7,
        ease: 'power3.out',
        delay,
        stagger,
      };

      if (!scroll || inView) {
        gsap.fromTo(targets, from, to);
      } else {
        gsap.fromTo(targets, from, {
          ...to,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      }
    }, el);

    return () => ctx.revert();
  }, [delay, stagger, y, scroll]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
