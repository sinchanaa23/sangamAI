import { useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import './effects.css';

/**
 * Card hover spotlight: --mx/--my (px, relative to the card) are written on
 * mousemove and the ::before overlay in effects.css paints a radial gradient
 * there. Pure decoration — nothing is lost for keyboard or touch users.
 * Callers pass the app's existing `card` class alongside, e.g.
 * <SpotlightCard className="card stack">.
 */
export default function SpotlightCard({
  children,
  className,
  tint,
}: {
  children: ReactNode;
  className?: string;
  tint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    el.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      className={`fw-spotlight-card ${className ?? ''}`}
      onMouseMove={handleMouseMove}
      style={tint ? ({ '--fw-spot-tint': tint } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
