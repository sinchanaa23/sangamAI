import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

type SlideTabsProps<T extends string> = {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
};

/**
 * Tab row with one absolutely-positioned pill indicator that slides behind the
 * active tab via GSAP (x + width, back.out(1.6), ~0.45s). On first mount — and
 * under prefers-reduced-motion — it snaps into place without animation.
 * Styled inline to match the app's `.pill.on` aesthetic. Original code.
 */
export default function SlideTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: SlideTabsProps<T>) {
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mountedRef = useRef(false);
  const prevValueRef = useRef<T>(value);

  const measure = (): { x: number; width: number } | null => {
    const index = items.findIndex((item) => item.id === value);
    const button = buttonRefs.current[index];
    if (!button) return null;
    return { x: button.offsetLeft, width: button.offsetWidth };
  };

  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const box = measure();
    if (!indicator || !box) return;

    const changed = prevValueRef.current !== value;
    prevValueRef.current = value;
    const reduce =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    if (!mountedRef.current || reduce || !changed) {
      gsap.set(indicator, { x: box.x, width: box.width });
    } else {
      gsap.to(indicator, {
        x: box.x,
        width: box.width,
        duration: 0.45,
        ease: 'back.out(1.6)',
        overwrite: 'auto',
      });
    }
    mountedRef.current = true;
  }, [value, items]);

  // Keep the pill glued to the active tab when the row reflows.
  useEffect(() => {
    const onResize = () => {
      const indicator = indicatorRef.current;
      const box = measure();
      if (indicator && box) gsap.set(indicator, { x: box.x, width: box.width });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items]);

  return (
    <div
      role="tablist"
      className={`fw-slidetabs${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'stretch',
      }}
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 0,
          background: 'var(--accent-soft, rgba(20,184,166,.14))',
          border: '1px solid rgba(45,212,191,.35)',
          borderRadius: 999,
          pointerEvents: 'none',
        }}
      />
      {items.map((item, index) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            style={{
              position: 'relative',
              zIndex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              font: 'inherit',
              color: active
                ? 'var(--ink, #e8eef2)'
                : 'var(--ink-2, #9fb0bd)',
              padding: '6px 16px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
              transition: 'color 0.25s ease',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
