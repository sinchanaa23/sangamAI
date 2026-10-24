import { useEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';

type MagneticProps = {
  children: ReactNode;
  className?: string;
  /** Max pull in px, reached at the edge of `radius`. */
  strength?: number;
  /** Distance in px from the child center within which the pull applies. */
  radius?: number;
};

/**
 * Pulls a single child toward the cursor while it is inside `radius`, using a
 * GSAP `quickTo` per axis for cheap per-frame easing, and springs it back with
 * an elastic ease on leave. Disabled for touch/coarse pointers and
 * reduced-motion (the child renders plain, no listeners attached). Original
 * code — `.reactbits-tmp/Magnet.jsx` was used as a behavioral reference only.
 */
export default function Magnetic({
  children,
  className,
  strength = 10,
  radius = 60,
}: MagneticProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const xToRef = useRef<ReturnType<typeof gsap.quickTo> | null>(null);
  const yToRef = useRef<ReturnType<typeof gsap.quickTo> | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return undefined;

    const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fineHover.matches || reduceMotion.matches) return undefined;

    // Created once (per strength/radius change) and kept in refs.
    xToRef.current = gsap.quickTo(inner, 'x', { duration: 0.4, ease: 'power3' });
    yToRef.current = gsap.quickTo(inner, 'y', { duration: 0.4, ease: 'power3' });

    const onMouseMove = (event: MouseEvent) => {
      const xTo = xToRef.current;
      const yTo = yToRef.current;
      if (!xTo || !yTo) return;
      const rect = inner.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      if (Math.hypot(dx, dy) < radius) {
        xTo((dx / radius) * strength);
        yTo((dy / radius) * strength);
      }
    };

    const onMouseLeave = () => {
      const inner2 = innerRef.current;
      if (!inner2) return;
      gsap.to(inner2, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: 'elastic.out(1, 0.4)',
        overwrite: 'auto',
      });
    };

    wrap.addEventListener('mousemove', onMouseMove);
    wrap.addEventListener('mouseleave', onMouseLeave);
    return () => {
      wrap.removeEventListener('mousemove', onMouseMove);
      wrap.removeEventListener('mouseleave', onMouseLeave);
      xToRef.current = null;
      yToRef.current = null;
      gsap.killTweensOf(inner);
    };
  }, [strength, radius]);

  return (
    <span
      ref={wrapRef}
      className={className}
      style={{ display: 'inline-flex' }}
    >
      <span
        ref={innerRef}
        style={{ display: 'inline-flex', willChange: 'transform' }}
      >
        {children}
      </span>
    </span>
  );
}
