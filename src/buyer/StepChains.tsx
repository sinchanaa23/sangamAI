import { useState } from 'react';
import { bom, buyer } from '../data';
import { district, explain, inr, isImported, isRural, lakh } from '../engine';
import type { Chain } from '../engine';
import { DEFAULT_CONSTRAINTS, optimise } from '../optimise';
import type { OptConstraints, OptResult } from '../optimise';
import { now, uid } from '../model';
import { useStore } from '../store';
import { trustScore } from '../trust';
import { useUi } from '../ui';
import type { Gap, Option, Weights } from '../types';
import Slider from '../components/Slider';
import ChainMap from '../components/ChainMap';
import { useBuyer } from './context';
import SupplierGrade from './negotiation/SupplierGrade';

const PRIORITIES: { key: keyof Weights; label: string }[] = [
  { key: 'cost', label: 'Lower cost' },
  { key: 'speed', label: 'Faster delivery' },
  { key: 'quality', label: 'Higher quality' },
  { key: 'resilience', label: 'Climate and power resilience' },
];
const level = (v: number) => ['Ignore', 'Low', 'Some', 'Medium', 'High', 'Top'][v];

export default function StepChains() {
  const { chains, chain, recommended, pickChain, weights, setWeights, scenario, extraChain, setExtraChain } = useBuyer();
  const { state, update } = useStore();
  const { openSupplier, go } = useUi();
  const [open, setOpen] = useState<string | null>(null);
  const [c, setC] = useState<OptConstraints>(DEFAULT_CONSTRAINTS);
  const [result, setResult] = useState<OptResult | null>(null);
  const shown: Chain[] = extraChain ? [...chains, extraChain] : chains;
  const u = buyer.unitLabel;

  const runOptimiser = () => {
    const r = optimise(scenario, c);
    setResult(r);
    setExtraChain(r.chain);
    if (r.chain) pickChain('optimised');
  };

  const startProject = (sellerId: string, lineId: string, gaps: Gap[]) => {
    if (state.projects.some((p) => p.sellerId === sellerId && p.lineId === lineId)) return go('buyer', 'devel');
    update((s) => ({
      ...s,
      projects: [...s.projects, {
        id: uid('dev'), sector: s.sector, sellerId, lineId, buyerSharePct: 50, createdAt: now(),
        milestones: gaps.map((g) => ({ id: uid('m'), label: g.label, costLakh: g.costLakh, months: g.months, status: 'todo' as const })),
      }],
    }));
    go('buyer', 'devel');
  };

  const sellerLine = (o: Option) => o.sellers.map((s, i) => (
    <span key={s.id}>
      {i > 0 && ' + '}
      <button className="linkish" onClick={() => openSupplier(s.id)}>{s.name}</button>, {district(s.districtId).name}
      <span className="tiny"> · trust {trustScore(s, state).score}</span> <SupplierGrade supplierId={s.id} />
      {isRural(s) && <> <span className="chip rural">{s.type}</span></>}
    </span>
  ));

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Sangam found {shown.length} ways to source this in India.</h1>
        <p className="muted" style={{ marginTop: 6 }}>Each is scored on cost, delivery time, quality and climate risk. Pick one to see who supplies what; your choice carries into the switch-over plan.</p>
      </div>

      <div className={shown.length > 3 ? 'grid-4' : 'grid-3'} style={{ marginTop: 6 }}>
        {shown.map((ch) => (
          <button key={ch.id} className={`chain ${ch.id === chain.id ? 'on' : ''}`} onClick={() => pickChain(ch.id)}>
            {ch.id === recommended.id && <span className="reco">Recommended</span>}
            {ch.id === 'optimised' && <span className="reco" style={{ background: 'var(--new)' }}>Optimised</span>}
            <div>
              <div className="name">{ch.name}</div>
              <div className="tiny">{ch.tagline}</div>
            </div>
            <div className="price">{inr(ch.unitCost)} <span className="tiny">per {u}</span></div>
            <div className="metrics">
              <span><b>{ch.importShare.toFixed(0)}%</b>imported</span>
              <span><b>{ch.readyInMonths === 0 ? 'Now' : `${ch.readyInMonths} mo`}</b>full switch</span>
              <span><b style={{ color: ch.ruralShare > 0 ? 'var(--rural)' : undefined }}>{ch.ruralShare.toFixed(0)}%</b>rural value</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <details>
          <summary>Adjust priorities</summary>
          <div className="card stack" style={{ gap: 16 }}>
            {PRIORITIES.map((p) => (
              <Slider key={p.key} label={p.label} value={weights[p.key]} min={0} max={5} format={level} onChange={(v) => setWeights({ ...weights, [p.key]: v })} />
            ))}
          </div>
        </details>
        <details open={!!result}>
          <summary>Optimise within your limits</summary>
          <div className="card stack" style={{ gap: 14 }}>
            <Slider label="Budget for supplier development" value={c.budgetCr} min={0} max={5} step={0.25} format={(v) => (v === 0 ? 'None' : `₹${v} Cr`)} onChange={(v) => setC({ ...c, budgetCr: v })} />
            <Slider label="Longest acceptable lead time" value={c.maxLeadDays} min={10} max={60} step={5} format={(v) => `${v} days`} onChange={(v) => setC({ ...c, maxLeadDays: v })} />
            <Slider label="Must be ready within" value={c.maxReadyMonths} min={0} max={24} format={(v) => (v === 0 ? 'Now' : `${v} months`)} onChange={(v) => setC({ ...c, maxReadyMonths: v })} />
            <Slider label="Imports may stay at most" value={c.maxImportPct} min={0} max={100} step={5} format={(v) => `${v}% of value`} onChange={(v) => setC({ ...c, maxImportPct: v })} />
            <Slider label="Rural collectives at least" value={c.minRuralPct} min={0} max={50} step={5} format={(v) => `${v}% of value`} onChange={(v) => setC({ ...c, minRuralPct: v })} />
            <Slider label="Weight on risk" value={c.riskWeight} min={0} max={3} step={0.5} format={(v) => (v === 0 ? 'Ignore' : `${v}×`)} onChange={(v) => setC({ ...c, riskWeight: v })} />
            <label className="row small"><input type="checkbox" checked={c.dualSource} onChange={(e) => setC({ ...c, dualSource: e.target.checked })} /> Every Indian part from two districts</label>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={runOptimiser}>Find the best plan</button>
              {result && (result.feasible
                ? <span className="small muted">Checked {result.considered} options; {'₹'}{result.annualCostCr.toFixed(1)} Cr a year, {'₹'}{result.capexCr.toFixed(2)} Cr to develop suppliers{result.binding.length ? `; limited by ${result.binding.join(', ')}` : ''}.</span>
                : <span className="small up">No plan meets all limits. Relax the budget, lead time or import cap.</span>)}
            </div>
            <p className="tiny">A mixed-integer program picks one option per part (Indian supplier, consortium or keep importing) to minimise yearly cost plus investment spread over 5 years plus a risk charge, within your limits.</p>
          </div>
        </details>
      </div>

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
                    <div className="small muted">{sellerLine(o)}{o.sellers.length > 1 && <span className="tiny"> · consortium</span>}</div>
                  ) : (
                    <div className="small muted">{isImported(line) ? 'No Indian option within limits; keep importing' : 'Current supplier'}</div>
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
                      <div key={g.sellerId} className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <span><b>{o.sellers.find((s) => s.id === g.sellerId)!.name}:</b> {g.gaps.map((x) => `${x.label} (${lakh(x.costLakh)}, ${x.months} mo)`).join('; ')}</span>
                        <button className="btn small" onClick={() => startProject(g.sellerId, line.id, g.gaps)}>
                          {state.projects.some((p) => p.sellerId === g.sellerId && p.lineId === line.id) ? 'View project' : 'Start development project'}
                        </button>
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
          {explain(chain, scenario).map((t) => <li key={t}>{t}</li>)}
        </ul>
        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={() => go('buyer', 'switch')}>Plan the switch-over</button>
          <button className="btn small ghost" onClick={() => go('buyer', 'routes')}>See the routes</button>
        </div>
        <p className="tiny" style={{ marginTop: 12 }}>
          Every figure comes from a transparent calculation; Ask Sangam (top right) can explain it in words but never changes the numbers.
        </p>
      </div>
    </div>
  );
}
