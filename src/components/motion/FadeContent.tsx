import { useEffect, useRef, type ReactNode } from 'react';
import './effects.css';

/**
 * Fade-rise entrance for below-fold content. A one-shot IntersectionObserver
 * adds .fw-in when the element scrolls into view; CSS (effects.css) does the
 * rest. Reduced-motion users get the final state immediately.
 */
export default function FadeContent({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('fw-in');
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('fw-in');
            observer.disconnect();
          }
        }
      },
      { rootMargin: '40px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`fw-fade ${className ?? ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
