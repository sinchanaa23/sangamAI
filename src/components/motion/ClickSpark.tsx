import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import './effects.css';

/**
 * Click feedback: on click, spawns `count` short line particles at the click
 * point (relative to the wrapper) that fly outward at random angles and fade
 * (see .fw-spark-particle in effects.css). Particles are plain elements
 * appended to the wrapper — no portals, no globals. Purely decorative, so
 * reduced-motion users simply get no sparks.
 */
export default function ClickSpark({
  children,
  className,
  color,
  count = 6,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  count?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const timeouts = useRef<Set<number>>(new Set());

  useEffect(
    () => () => {
      for (const id of timeouts.current) window.clearTimeout(id);
      timeouts.current.clear();
    },
    [],
  );

  const spawn = (x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 26 + Math.random() * 18;
      const particle = document.createElement('span');
      particle.className = 'fw-spark-particle';
      particle.setAttribute('aria-hidden', 'true');
      particle.style.left = `${x - 3}px`;
      particle.style.top = `${y - 1}px`;
      particle.style.setProperty('--fw-spark-dx', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--fw-spark-dy', `${Math.sin(angle) * distance}px`);
      particle.style.setProperty('--fw-spark-angle', `${(angle * 180) / Math.PI}deg`);
      if (color) particle.style.setProperty('--fw-spark-color', color);
      el.appendChild(particle);

      const id = window.setTimeout(() => {
        particle.remove();
        timeouts.current.delete(id);
      }, 320);
      timeouts.current.add(id);
    }
  };

  const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    spawn(event.clientX - rect.left, event.clientY - rect.top);
  };

  return (
    <span
      ref={ref}
      className={className}
      onClick={handleClick}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      {children}
    </span>
  );
}
