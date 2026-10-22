import { useMemo, useState } from 'react';
import { generateChains, recommend } from '../engine';
import type { Weights } from '../types';
import StepToday from './StepToday';
import StepShock from './StepShock';
import StepChains from './StepChains';
import StepPlan from './StepPlan';

const STEPS = ['Today', 'What if', 'Indian options', '5-year plan'];

export default function BuyerFlow() {
  const [step, setStep] = useState(0);
  const [duty, setDuty] = useState(25);
  const [delay, setDelay] = useState(4);
  const [weights, setWeights] = useState<Weights>({ cost: 3, speed: 2, quality: 2, resilience: 2 });
  const [picked, setPicked] = useState<string | null>(null);

  const chains = useMemo(() => generateChains(weights, duty), [weights, duty]);
  const recommended = useMemo(() => recommend(chains, weights), [chains, weights]);
  const chain = chains.find((c) => c.id === picked) ?? recommended;

  return (
    <div>
      <nav className="stepper" aria-label="Steps">
        {STEPS.map((s, i) => (
          <button key={s} className={`step ${i === step ? 'on' : i < step ? 'done' : ''}`} onClick={() => setStep(i)}>
            <span className="num">{i < step ? '✓' : i + 1}</span>
            <span className="label">{s}</span>
          </button>
        ))}
      </nav>

      {step === 0 && <StepToday />}
      {step === 1 && <StepShock duty={duty} delay={delay} setDuty={setDuty} setDelay={setDelay} />}
      {step === 2 && (
        <StepChains
          chains={chains}
          chain={chain}
          recommendedId={recommended.id}
          onPick={setPicked}
          weights={weights}
          setWeights={setWeights}
          duty={duty}
        />
      )}
      {step === 3 && <StepPlan chain={chain} duty={duty} delay={delay} />}

      <div className="nav">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        <button className="btn primary" disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>
          Next: {STEPS[step + 1] ?? ''}
        </button>
      </div>
    </div>
  );
}
