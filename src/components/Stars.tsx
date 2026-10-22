export default function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${value.toFixed(1)} out of 5`}>
      {'★'.repeat(full)}<span style={{ color: '#d6dbe1' }}>{'★'.repeat(5 - full)}</span>
    </span>
  );
}
