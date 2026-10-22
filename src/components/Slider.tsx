interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

export default function Slider({ label, value, min, max, step = 1, format, onChange }: Props) {
  return (
    <label className="slider">
      <span className="top">
        <span>{label}</span>
        <b>{format(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
