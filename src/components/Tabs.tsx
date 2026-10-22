interface Props<T extends string> {
  tabs: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (id: T) => void;
}

/** Underlined sub-tabs used inside a page. */
export default function Tabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  return (
    <div className="subtabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className={t.id === value ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
          {t.hint && <span className="tiny"> · {t.hint}</span>}
        </button>
      ))}
    </div>
  );
}
