import type { CSSProperties, ReactNode } from 'react';
import './glow.css';

/**
 * ShinyText — a periodic bright band sweeps across the text (background-clip:
 * text). At rest the text colour is untouched, so it stays fully readable.
 * Reduced motion: renders as plain text (see glow.css).
 */
export default function ShinyText({
  children,
  className,
  speed = 2800,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  const style = { '--fw-shine-speed': `${Math.max(200, speed)}ms` } as CSSProperties;
  return (
    <span className={className ? `fw-shiny ${className}` : 'fw-shiny'} style={style}>
      {children}
    </span>
  );
}
