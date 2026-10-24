import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import './glow.css';

/**
 * TiltCard — subtle 3D perspective tilt following the cursor. The outer div
 * holds the perspective; the inner body rotates up to `maxTilt` degrees and
 * eases back to flat on leave (transition in glow.css). Touch devices and
 * reduced-motion users get a static card — tilt is gated in JS.
 */
export default function TiltCard({
  children,
  className,
  maxTilt = 6,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const enabledRef = useRef(false);
  const tiltRef = useRef(maxTilt);
  tiltRef.current = maxTilt;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');

    const update = () => {
      enabledRef.current = !reduce.matches && fine.matches;
      if (!enabledRef.current && innerRef.current) {
        innerRef.current.style.transform = '';
      }
    };
    update();

    reduce.addEventListener('change', update);
    fine.addEventListener('change', update);
    return () => {
      reduce.removeEventListener('change', update);
      fine.removeEventListener('change', update);
      enabledRef.current = false;
    };
  }, []);

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const inner = innerRef.current;
    if (!inner || !enabledRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1; // -1 .. 1
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1; // -1 .. 1
    const limit = tiltRef.current;
    inner.style.transform = `rotateX(${(-ny * limit).toFixed(2)}deg) rotateY(${(nx * limit).toFixed(2)}deg)`;
  };

  const handleLeave = () => {
    if (innerRef.current) innerRef.current.style.transform = '';
  };

  return (
    <div className={className ? `fw-tilt ${className}` : 'fw-tilt'} onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <div ref={innerRef} className="fw-tilt-inner">
        {children}
      </div>
    </div>
  );
}
