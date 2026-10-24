import { useEffect, useRef, useState } from 'react';
import './motion.css';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export default function CountUp({
  value,
  duration = 600,
  className,
  format,
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const currentRef = useRef(0);   // value currently on screen
  const fromRef = useRef(0);      // retarget baseline
  const targetRef = useRef(0);    // where the animation is headed
  const startRef = useRef(0);     // rAF timestamp of animation start
  const rafRef = useRef(0);
  const revealedRef = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // Snap straight to the value; nothing animates.
      currentRef.current = value;
      setDisplay(value);
      return () => cancelAnimationFrame(rafRef.current);
    }

    const step = (now: number) => {
      const t = duration > 0 ? Math.min(1, (now - startRef.current) / duration) : 1;
      currentRef.current =
        fromRef.current + (targetRef.current - fromRef.current) * easeOutCubic(t);
      setDisplay(currentRef.current);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };

    const animateTo = (target: number) => {
      cancelAnimationFrame(rafRef.current);
      // Ease toward the new target from what is on screen now — no restart from zero.
      fromRef.current = currentRef.current;
      targetRef.current = target;
      startRef.current = performance.now();
      rafRef.current = requestAnimationFrame(step);
    };

    if (!revealedRef.current) {
      // First viewport entry (once) is what starts the count from 0.
      targetRef.current = value;
      if (typeof IntersectionObserver === 'function' && spanRef.current) {
        const observer = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            revealedRef.current = true;
            observer.disconnect();
            animateTo(targetRef.current);
          },
          { rootMargin: '40px' },
        );
        observer.observe(spanRef.current);
        return () => {
          observer.disconnect();
          cancelAnimationFrame(rafRef.current);
        };
      }
      revealedRef.current = true;
      animateTo(targetRef.current);
      return () => cancelAnimationFrame(rafRef.current);
    }

    animateTo(value);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatNumber = format ?? ((n: number) => n.toLocaleString('en-IN'));
  return (
    <span
      ref={spanRef}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formatNumber(display)}
    </span>
  );
}
