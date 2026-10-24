import { useEffect, useRef } from 'react';

/**
 * DotGrid background layer: a 2D-canvas dot field whose dots brighten toward
 * full alpha and grow (up to ~2.2x) within ~120px of the cursor. Original
 * code implementing the well-known "interactive dot grid" pattern — plain
 * canvas 2D, no external dependency, nothing copied.
 *
 * Absolute inset-0 layer, pointer-events none: dots never intercept events.
 * The rAF loop pauses when the tab is hidden and when the layer is offscreen
 * (IntersectionObserver). Reduced-motion users get the static grid drawn
 * once — no loop, no cursor reactivity.
 */

const PROXIMITY = 120;
const MAX_SCALE = 2.2;
const MAX_DPR = 2;
const OFFSCREEN = -1e5;

function parseRgb(color: string): [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return [0x2d, 0xd4, 0xbf];
  const hex =
    match[1].length === 3
      ? match[1]
          .split('')
          .map((d) => d + d)
          .join('')
      : match[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

export default function DotGrid({
  color = '#2dd4bf',
  spacing = 26,
  radius = 1.4,
  dim = 0.16,
  className,
}: {
  color?: string;
  spacing?: number;
  radius?: number;
  dim?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef({ color, spacing, radius, dim });
  settingsRef.current = { color, spacing, radius, dim };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let visible = true;
    let width = 0;
    let height = 0;
    let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: OFFSCREEN, y: OFFSCREEN, inside: false };
    let presence = 0; // eased 0..1, so dots fade back after the cursor leaves

    const draw = () => {
      const { color: c, spacing: gap, radius: rad, dim: base } = settingsRef.current;
      const [cr, cg, cb] = parseRgb(c);
      ctx.clearRect(0, 0, width, height);
      const cols = Math.ceil(width / gap) + 1;
      const rows = Math.ceil(height / gap) + 1;
      const offX = (width - (cols - 1) * gap) / 2;
      const offY = (height - (rows - 1) * gap) / 2;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = offX + col * gap;
          const y = offY + row * gap;
          let t = 0;
          if (pointer.inside) {
            const dist = Math.hypot(x - pointer.x, y - pointer.y);
            if (dist < PROXIMITY) {
              const u = 1 - dist / PROXIMITY;
              t = u * u * (3 - 2 * u); // smoothstep falloff
            }
          }
          const energy = t * presence;
          const alpha = base + (1 - base) * energy;
          const size = rad * (1 + (MAX_SCALE - 1) * energy);
          ctx.beginPath();
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha.toFixed(3)})`;
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) draw();
    };

    const frame = () => {
      raf = 0;
      if (document.hidden || !visible) return;
      const target = pointer.inside ? 1 : 0;
      presence += (target - presence) * 0.18;
      if (presence < 0.001 && target === 0) presence = 0;
      draw();
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf && visible && !document.hidden && !reduced) {
        raf = requestAnimationFrame(frame);
      }
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointer.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      pointer.x = pointer.inside ? x : OFFSCREEN;
      pointer.y = pointer.inside ? y : OFFSCREEN;
      wake();
    };

    const onLeave = () => {
      pointer.inside = false;
      pointer.x = OFFSCREEN;
      pointer.y = OFFSCREEN;
    };

    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) onLeave();
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      } else {
        wake();
      }
    };

    const onMotionPreferenceChange = () => {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        presence = 0;
        draw();
      } else {
        wake();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      wake();
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry ? entry.isIntersecting : true;
      if (visible) {
        if (reduced) draw();
        else wake();
      }
    });
    intersectionObserver.observe(canvas);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', onMotionPreferenceChange);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onOut);
    document.addEventListener('visibilitychange', onVisibility);

    resize();
    draw();
    wake();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      motionQuery.removeEventListener('change', onMotionPreferenceChange);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          display: 'block',
        }}
      />
    </div>
  );
}
