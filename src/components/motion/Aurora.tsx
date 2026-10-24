import './bg.css';

/**
 * Aurora background layer: 3-4 large blurred radial-gradient blobs drifting
 * on slow CSS keyframes (bg.css). Original code implementing the well-known
 * "aurora blobs" pattern — no external dependency, nothing copied.
 *
 * Absolute inset-0 layer, pointer-events none; place it inside a relatively
 * positioned parent, behind content. Reduced-motion users get static blobs
 * (animation killed in bg.css).
 */

const DEFAULT_COLORS = ['#14b8a6', '#f97316', '#a78bfa'];
const MAX_BLOBS = 4;

function withAlpha(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return color;
  const hex =
    match[1].length === 3
      ? match[1]
          .split('')
          .map((d) => d + d)
          .join('')
      : match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function Aurora({
  colors,
  className,
  opacity = 0.5,
}: {
  colors?: string[];
  className?: string;
  opacity?: number;
}) {
  const palette = colors && colors.length > 0 ? colors : DEFAULT_COLORS;
  return (
    <div
      aria-hidden="true"
      className={className ? `fw-aurora ${className}` : 'fw-aurora'}
      style={{ opacity }}
    >
      {palette.slice(0, MAX_BLOBS).map((color, i) => (
        <div
          key={`${color}-${i}`}
          className="fw-aurora-blob"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${withAlpha(color, 0.38)} 0%, ${withAlpha(
              color,
              0.16,
            )} 42%, transparent 72%)`,
          }}
        />
      ))}
    </div>
  );
}
