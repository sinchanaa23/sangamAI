import { useState } from 'react';
import { bom } from '../data';
import { district, explain, inr, isImported, isRural, lakh } from '../engine';
import type { Chain } from '../engine';
import type { Weights } from '../types';
import Slider from '../components/Slider';
import ChainMap from '../components/ChainMap';

interface Props {
  chains: Chain[];
  chain: Chain;
  recommendedId: string;
  onPick: (id: string) => void;
  weights: Weights;
  setWeights: (w: Weights) => void;
  duty: number;
}

const PRIORITIES: { key: keyof Weights; label: string }[] = [
  { key: 'cost', label: 'Lower cost' },
  { key: 'speed', label: 'Faster delivery' },
  { key: 'quality', label: 'Higher quality' },
  { key: 'resilience', label: 'Climate and power resilience' },
];

const level = (v: number) => ['Ignore', 'Low', 'Some', 'Medium', 'High', 'Top'][v];

export default function StepChains({ chains, chain, recommendedId, onPick, weights, setWeights, duty }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="stack">
      <div>
        <h1 className="lead">Sangam found 3 ways to build this harness in India.</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Each one is scored on cost, delivery time, quality and climate risk. Pick one to see who supplies what.
        </p>
      </div>

      <div className="grid-3" style={{ marginTop: 6 }}>
        {chains.map((c) => (
          <button key={c.id} className={`chain ${c.id === chain.id ? 'on' : ''}`} onClick={() => onPick(c.id)}>
            {c.id === recommendedId && <span className="reco">Recommended</span>}
            <div>
              <div className="name">{c.name}</div>
              <div className="tiny">{c.tagline}</div>
            </div>
            <div className="price">{inr(c.unitCost)} <span className="tiny">per harness</span></div>
            <div className="metrics">
              <span><b>{c.importShare.toFixed(0)}%</b>imported</span>
              <span><b>{c.readyInMonths === 0 ? 'Now' : `${c.readyInMonths} mo`}</b>full switch</span>
              <span><b style={{ color: c.ruralShare > 0 ? 'var(--rural)' : undefined }}>{c.ruralShare.toFixed(0)}%</b>rural value</span>
            </div>
          </button>
        ))}
      </div>

      <details>
        <summary>Adjust priorities</summary>
        <div className="card grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {PRIORITIES.map((p) => (
            <Slider key={p.key} label={p.label} value={weights[p.key]} min={0} max={5} format={level} onChange={(v) => setWeights({ ...weights, [p.key]: v })} />
          ))}
        </div>
      </details>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">Who supplies what · {chain.name}</div>
          {bom.map((line) => {
            const o = chain.picks[line.id];
            const gaps = o ? o.gaps.filter((g) => g.gaps.length > 0) : [];
            return (
              <div key={line.id} className="supplier-row">
                <div>
                  <div style={{ fontWeight: 500 }}>{line.name}</div>
                  {o ? (
                    <div className="small muted">
                      {o.sellers.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && ' + '}
                          {s.name}, {district(s.districtId).name}
                          {isRural(s) && <> <span className="chip rural">{s.type}</span></>}
                        </span>
                      ))}
                      {o.sellers.length > 1 && <span className="tiny"> · consortium</span>}
                    </div>
                  ) : (
                    <div className="small muted">{isImported(line) ? 'No Indian supplier qualifies yet; keep importing' : 'Current supplier'}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {o ? (
                    o.status === 'ready' ? <span className="chip ready">Ready now</span> : (
                      <button className="chip potential" style={{ border: 0 }} onClick={() => setOpen(open === line.id ? null : line.id)}>
                        Needs work {open === line.id ? '▴' : '▾'}
                      </button>
                    )
                  ) : <span className="chip import">Imported</span>}
                  <div className="tiny" style={{ marginTop: 4 }}>{o ? inr(o.unitCost) : ''}</div>
                </div>
                {open === line.id && o && (
                  <div className="gap-list">
                    {gaps.map((g) => (
                      <div key={g.sellerId}>
                        <b>{o.sellers.find((s) => s.id === g.sellerId)!.name}:</b>{' '}
                        {g.gaps.map((x) => `${x.label} (${lakh(x.costLakh)}, ${x.months} mo)`).join('; ')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="section-title">Supplier network</div>
          <ChainMap chain={chain} />
        </div>
      </div>

      <div className="card">
        <div className="section-title">Why {chain.name.toLowerCase()}?</div>
        <ul className="why">
          {explain(chain, duty).map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="tiny" style={{ marginTop: 12 }}>
          Every figure comes from a transparent calculation on simulated data; an AI assistant (Joule in the SAP build) only puts it into words.
        </p>
      </div>
    </div>
  );
}
