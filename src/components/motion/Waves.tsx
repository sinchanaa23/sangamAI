import { useEffect, useRef } from 'react';

const DPR_CAP = 2;
const SWELL_PEAK = 0.5; // +50% amplitude right under the cursor (~1.5x)

type WavesProps = {
  colors?: string[];
  layers?: number;
  speed?: number;
  amplitude?: number;
  className?: string;
  opacity?: number;
};

/** Parse a hex color to rgba(); returns null for anything else. */
function hexToRgba(hex: string, alpha: number): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Layered 2D-canvas sine waves anchored to the bottom of the container.
 * Each layer is a path filled with a vertical gradient (its color, low alpha,
 * fading to transparent) that phase-drifts at its own speed/frequency.
 * Waves inside a horizontal band near the cursor gently swell. DPR-aware,
 * paused while the tab is hidden or the element is offscreen; reduced-motion
 * renders a single static frame with no cursor effect. Original code —
 * `.reactbits-tmp/Waves.jsx` was used as a behavioral reference only.
 */
export default function Waves({
  colors = ['#14b8a6', '#f97316', '#a78bfa'],
  layers = 3,
  speed = 1,
  amplitude = 18,
  className,
  opacity = 0.3,
}: WavesProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef({ colors, layers, speed, amplitude, opacity });
  settingsRef.current = { colors, layers, speed, amplitude, opacity };

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduce =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;
    let last = 0;
    let time = 0;
    const cursor = { target: 0, x: null as number | null, active: false };

    const swellAt = (x: number): number => {
      if (cursor.x === null || !cursor.active) return 1;
      const band = Math.min(200, Math.max(80, width * 0.22));
      const d = (x - cursor.x) / band;
      return 1 + SWELL_PEAK * Math.exp(-d * d);
    };

    const draw = (t: number) => {
      const { colors: cols, layers: count, amplitude: amp, opacity: op } =
        settingsRef.current;
      const layerCount = Math.max(1, Math.round(count));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < layerCount; i++) {
        // t: 0 = back layer (higher, slower, taller swell) → 1 = front layer
        const f = layerCount === 1 ? 0 : i / (layerCount - 1);
        const baselineY = height * (0.7 + 0.16 * f);
        const layerAmp = amp * (1.15 - f * 0.45);
        const k1 = ((1.3 + f * 1.1) * Math.PI * 2) / Math.max(width, 1);
        const k2 = k1 * 2.3;
        const phase = t * (0.6 + f * 0.9) + i * 1.7;

        const color = cols[i % Math.max(1, cols.length)] ?? '#ffffff';
        const crestTop = Math.max(0, baselineY - layerAmp * 2.4);
        const gradient = ctx.createLinearGradient(0, height, 0, crestTop);
        const solid = hexToRgba(color, op);
        if (solid) {
          gradient.addColorStop(0, solid);
          gradient.addColorStop(1, hexToRgba(color, 0) ?? 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
        } else {
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, 'rgba(128,128,128,0)');
          ctx.globalAlpha = op;
          ctx.fillStyle = gradient;
        }

        const step = Math.max(4, width / 96);
        ctx.beginPath();
        ctx.moveTo(-step, height);
        for (let x = -step; x <= width + step; x += step) {
          const swell = swellAt(x);
          const y =
            baselineY +
            Math.sin(x * k1 + phase) * layerAmp * swell +
            Math.sin(x * k2 - phase * 0.63 + i) * layerAmp * 0.35 * swell;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width + step, height);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (document.hidden || !visible) {
        last = 0;
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      time += dt * settingsRef.current.speed;
      draw(time);
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (reduce) {
        draw(0);
        return;
      }
      if (!raf && visible && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    const resize = () => {
      width = Math.max(1, wrap.clientWidth);
      height = Math.max(1, wrap.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrap);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) wake();
    });
    intersection.observe(wrap);
    const onVisibility = () => {
      if (!document.hidden) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // The wrapper is pointer-events: none, so track the cursor on the window.
    const onPointerMove = (event: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        cursor.active = false;
        return;
      }
      cursor.target = x;
      if (cursor.x === null) cursor.x = x;
      cursor.active = true;
    };
    if (!reduce) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    }

    resize();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (!reduce) window.removeEventListener('pointermove', onPointerMove);
    };
    // Settings are read through settingsRef so prop updates need no re-mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
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
        aria-hidden="true"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
