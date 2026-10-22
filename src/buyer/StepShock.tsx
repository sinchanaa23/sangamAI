import { buyer } from '../data';
import { inr, simulateShock } from '../engine';
import Slider from '../components/Slider';

interface Props {
  duty: number;
  delay: number;
  setDuty: (v: number) => void;
  setDelay: (v: number) => void;
}

export default function StepShock({ duty, delay, setDuty, setDelay }: Props) {
  const s = simulateShock(duty, delay);
  const rise = ((s.unitCost - buyer.unitCost) / buyer.unitCost) * 100;
  return (
    <div className="stack">
      <div className="card">
        <h1 className="lead">What if trade with that region gets harder?</h1>
        <p className="muted" style={{ marginTop: 8 }}>Move the sliders to simulate a disruption. Everything below updates.</p>
        <div className="grid-2" style={{ marginTop: 20, gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          <Slider label="Extra import duty" value={duty} min={0} max={50} step={5} format={(v) => `+${v}%`} onChange={setDuty} />
          <Slider label="Shipping delay" value={delay} min={0} max={8} format={(v) => (v === 0 ? 'None' : `${v} week${v > 1 ? 's' : ''}`)} onChange={setDelay} />
        </div>
      </div>

      <div className="grid-3">
        <div className="stat">
          <div className="label">Cost per harness</div>
          <div className="value">{inr(s.unitCost)}</div>
          <div className={`delta ${rise > 0 ? 'up' : ''}`}>{rise > 0 ? `+${rise.toFixed(1)}% vs today` : 'No change'}</div>
        </div>
        <div className="stat">
          <div className="label">Extra cost per month</div>
          <div className="value">{'₹'}{(s.extraPerMonth / 1e7).toFixed(2)} Cr</div>
          <div className="delta muted">for {buyer.monthlyUnits.toLocaleString('en-IN')} harnesses</div>
        </div>
        <div className="stat">
          <div className="label">Scooters not built</div>
          <div className="value">{s.lostUnits.toLocaleString('en-IN')}</div>
          <div className={`delta ${s.stockoutDays > 0 ? 'up' : 'muted'}`}>
            {s.stockoutDays > 0 ? `${s.stockoutDays} days of stock-out` : 'Safety stock covers it'}
          </div>
        </div>
      </div>

      <p className="small muted">
        Lead time becomes {s.leadDays} days. Your {buyer.safetyStockDays}-day safety stock absorbs delays of up to {buyer.safetyStockDays / 7} weeks; beyond that the line stops.
      </p>
    </div>
  );
}
