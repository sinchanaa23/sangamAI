// AI Supply Chain Architect: an upcoming supplier designs a business and its whole supply chain.
// The plan is computed from Sangam's data (engine.ts); the language model only adds labelled suggestions (ai.ts).
import { Fragment, useEffect, useMemo, useState } from 'react';
import { bom, buyer, districts } from '../data';
import { lakh, inr } from '../engine';
import { useStore } from '../store';
import { useUi } from '../ui';
import FairWorkBadge from '../components/FairWorkBadge';
import { COUNTRIES } from '../buyer/global/settings';
import { buildPlan, defaults, matchIdea, productOptions } from './engine';
import type { ArchitectInput, Emphasis, Fig, ScenarioId, Stage } from './engine';
import { reviewPlan, suggestFromIdea } from './ai';
import type { IdeaSuggestion, PlanReview } from './ai';
import NetworkGraph, { originUnder } from './NetworkGraph';
import Tag from './Tag';
import clustersFile from '../real/clusters.json';
import './architect.css';

const clusterName = (id: string) => clustersFile.clusters.find((c) => c.id === id)?.name ?? id;

const KEY = 'sangam.architect';
const EMPHASIS: { id: Emphasis; label: string }[] = [
  { id: 'balanced', label: 'Balanced' }, { id: 'cost', label: 'Lowest cost' }, { id: 'speed', label: 'Fastest to market' }, { id: 'rural', label: 'Most rural jobs' },
];
const SCENARIO_LABEL: Record<ScenarioId, string> = { import: 'Import-dependent', hybrid: 'Hybrid', india: 'India-first' };

const load = (): Partial<ArchitectInput> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const save = (i: ArchitectInput) => { try { localStorage.setItem(KEY, JSON.stringify(i)); } catch { /* private window: keep in memory */ } };

function Money({ f, unit = '' }: { f: Fig; unit?: string }) {
  return <span title={f.note}>{inr(f.value)}{unit} <Tag kind={f.tag} /></span>;
}

function NumField({ label, value, onChange, step = 1, min = 0, max, suffix, placeholder }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; step?: number; min?: number; max?: number; suffix?: string; placeholder?: number }) {
  return (
    <label className="field">{label}{suffix ? ` (${suffix})` : ''}
      <input type="number" step={step} min={min} max={max} value={value ?? ''} placeholder={placeholder != null ? String(placeholder) : undefined}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
    </label>
  );
}

export default function ArchitectPage() {
  const { state, dataVersion } = useStore();
  const { openSupplier, go } = useUi();
  const firstImported = bom.find((l) => l.importedFrom !== 'India') ?? bom[0];
  const stored = load();
  const [input, setInput] = useState<ArchitectInput>({
    lineId: bom.some((l) => l.id === stored.lineId) ? stored.lineId! : firstImported?.id ?? '',
    districtId: stored.districtId && districts.some((d) => d.id === stored.districtId) ? stored.districtId : '',
    capacityPerMonth: stored.capacityPerMonth ?? Math.round((buyer.monthlyUnits || 10000) / 4),
    budgetLakh: stored.budgetLakh ?? 50,
    buyerCountry: stored.buyerCountry ?? 'IN',
    emphasis: stored.emphasis ?? 'balanced',
  });
  const [mode, setMode] = useState<'design' | 'explore'>('design');
  const [idea, setIdea] = useState('');
  const [ideaMatch, setIdeaMatch] = useState<ReturnType<typeof matchIdea> | null>(null);
  const [ai, setAi] = useState<{ busy?: 'idea' | 'review'; error?: string; idea?: IdeaSuggestion; review?: PlanReview }>({});
  const [scenario, setScenario] = useState<ScenarioId>('hybrid');
  const [sel, setSel] = useState<string | null>('make');

  // The sector picker at the top reloads the catalogue; keep the chosen part valid
  useEffect(() => { if (!bom.some((l) => l.id === input.lineId)) setInput((i) => ({ ...i, lineId: firstImported?.id ?? '' })); }, [state.sector]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { save(input); }, [input]);

  const plan = useMemo(() => buildPlan(input), [input, dataVersion, state.sector]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<ArchitectInput>) => { setInput((i) => ({ ...i, ...patch })); setAi((a) => ({ ...a, review: undefined })); };
  const products = useMemo(() => productOptions().sort((a, b) => (b.importUsd ?? 0) - (a.importUsd ?? 0)), [dataVersion, state.sector]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) return <div className="empty">No parts in this sector's catalogue. Pick another sector at the top.</div>;
  const def = defaults(plan.line, plan.region.district.id);
  const stage = plan.stages.find((s) => s.id === sel) ?? null;
  const e = plan.economics, w = plan.workforce;

  const askIdea = async () => {
    setAi({ busy: 'idea' });
    try { const r = await suggestFromIdea(idea, state.sector); setAi({ idea: r }); if (r.matchLineId) set({ lineId: r.matchLineId }); }
    catch (err) { setAi({ error: (err as Error).message }); }
  };
  const askReview = async () => {
    setAi((a) => ({ ...a, busy: 'review', error: undefined }));
    try { const r = await reviewPlan(plan); setAi((a) => ({ ...a, busy: undefined, review: r })); }
    catch (err) { setAi((a) => ({ ...a, busy: undefined, error: (err as Error).message })); }
  };

  return (
    <div className="stack ar">
      <div className="card">
        <div className="eyebrow">Supplier · new business</div>
        <h1 className="lead" style={{ marginTop: 6 }}>AI Supply Chain Architect</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Design a business and its whole supply chain from scratch: what to make, where to make it, where the inputs come from, how goods reach buyers, what it costs to start, and how it pays fair wages. Every figure says where it comes from.
        </p>
        <div className="row tiny" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Tag kind="public" /> real public data <Tag kind="estimated" /> Sangam's model <Tag kind="simulated" /> demo data <Tag kind="assumption" /> a default you can edit <Tag kind="ai" /> from the language model
        </div>
      </div>

      <div className="card">
        <div className="subtabs" style={{ marginBottom: 14 }}>
          <button className={mode === 'design' ? 'on' : ''} onClick={() => setMode('design')}>Design my business</button>
          <button className={mode === 'explore' ? 'on' : ''} onClick={() => setMode('explore')}>Explore opportunities</button>
        </div>

        {mode === 'explore' ? (
          <>
            <p className="small muted" style={{ marginBottom: 10 }}>Parts India imports for the {state.sector === 'ev' ? 'EV' : state.sector} sector, largest import bill first. Change the sector at the top to explore others.</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Part</th><th className="num">India imports</th><th>Demand on Sangam</th><th className="num">Suppliers on Sangam</th><th /></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.line.id}>
                      <td><div style={{ fontWeight: 500 }}>{p.line.name}</div><div className="tiny">{p.line.process} · today from {p.line.importedFrom}</div></td>
                      <td className="num">{p.importUsd != null ? <>${(p.importUsd / 1e6).toFixed(1)}m <span className="tiny">({p.importYear})</span> <Tag kind="public" /></> : <span className="tiny">No data</span>}</td>
                      <td className="small">{p.demand ? <>{p.demand.buyers} buyers, {p.demand.monthlyUnits.toLocaleString('en-IN')} a month, {p.demand.region} <Tag kind="simulated" /></> : <span className="tiny">None yet</span>}</td>
                      <td className="num">{p.sangamSuppliers} <Tag kind="simulated" /></td>
                      <td><button className="btn small" onClick={() => { set({ lineId: p.line.id }); setMode('design'); }}>Design this business</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            <label className="field">Your idea, in your own words (optional)
              <textarea value={idea} placeholder="For example: a women's cooperative making wiring harnesses for electric scooters" onChange={(ev) => setIdea(ev.target.value)} />
            </label>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn small" disabled={idea.trim().length < 4} style={{ visibility: 'visible' }} onClick={() => setIdeaMatch(matchIdea(idea))}>Match with Sangam's catalogue</button>
              <button className="btn small ghost" disabled={idea.trim().length < 4 || ai.busy === 'idea'} style={{ visibility: 'visible' }} onClick={askIdea}>{ai.busy === 'idea' ? 'Asking the AI…' : 'Ask the AI to sketch it'}</button>
            </div>
            {ideaMatch && (
              <div className="note">
                {ideaMatch.lineIds.length ? <>Closest parts: {ideaMatch.lineIds.slice(0, 3).map((id) => { const l = bom.find((x) => x.id === id)!; return <button key={id} className="pill" style={{ marginRight: 6 }} onClick={() => set({ lineId: id })}>{l.name}</button>; })}</> : 'No part in this sector matches those words; try another sector at the top, or pick a part below.'}
                {ideaMatch.clusterIds.length > 0 && <div className="tiny" style={{ marginTop: 6 }}>Matching ODOP skill clusters: {ideaMatch.clusterIds.slice(0, 4).map(clusterName).join(', ')} <Tag kind="public" /> · <button className="link-btn" onClick={() => go('buyer', 'clusters')}>open Skill clusters</button></div>}
              </div>
            )}
            {ai.idea && (
              <div className="note ar-ai">
                <div className="row" style={{ gap: 6 }}><Tag kind="ai" /><b>{ai.idea.matchLineId ? `Closest part: ${bom.find((l) => l.id === ai.idea!.matchLineId)?.name}` : 'No close part in this sector'}</b></div>
                <p className="small" style={{ margin: '6px 0' }}>{ai.idea.why}</p>
                {ai.idea.stages.length > 0 && <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{ai.idea.stages.map((s, i) => <li key={i}><b>{s.stage}:</b> {s.name}. {s.note}</li>)}</ul>}
                {ai.idea.questions.length > 0 && <><div className="small" style={{ fontWeight: 600, marginTop: 8 }}>Answer these before investing</div><ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{ai.idea.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></>}
              </div>
            )}

            <div className="form-grid">
              <label className="field">What you will make
                <select value={input.lineId} onChange={(ev) => set({ lineId: ev.target.value, pricePerUnit: undefined, workersPerThousand: undefined, materialsPct: undefined })}>
                  {bom.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.process})</option>)}
                </select>
              </label>
              <label className="field">Where
                <select value={input.districtId} onChange={(ev) => set({ districtId: ev.target.value, wagePerDay: undefined })}>
                  <option value="">Let Sangam recommend</option>
                  {[...districts].sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name)).map((d) => <option key={d.id} value={d.id}>{d.name}, {d.state}</option>)}
                </select>
              </label>
              <NumField label={`Capacity, ${buyer.unitLabel} sets a month`} value={input.capacityPerMonth} min={100} step={100} onChange={(v) => set({ capacityPerMonth: v ?? 1000 })} />
              <NumField label="Budget" suffix="₹ lakh" value={input.budgetLakh} min={1} onChange={(v) => set({ budgetLakh: v ?? 0 })} />
              <label className="field">Who you will sell to
                <select value={input.buyerCountry} onChange={(ev) => set({ buyerCountry: ev.target.value, importDutyPct: undefined })}>
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.code === 'IN' ? 'Buyers in India' : `Buyers in ${c.name} (export)`}</option>)}
                </select>
              </label>
              <div className="field">What matters most
                <div className="toggle-row">{EMPHASIS.map((x) => <button key={x.id} className={`pill ${input.emphasis === x.id ? 'on' : ''}`} onClick={() => set({ emphasis: x.id })}>{x.label}</button>)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="ar-grid">
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>Your supply chain</div>
            <div className="segmented">{(Object.keys(SCENARIO_LABEL) as ScenarioId[]).map((s) => <button key={s} className={scenario === s ? 'on' : ''} onClick={() => setScenario(s)}>{SCENARIO_LABEL[s]}</button>)}</div>
          </div>
          <NetworkGraph stages={plan.stages} scenario={scenario} importedFrom={plan.line.importedFrom} selected={sel} onSelect={setSel} />
          <p className="tiny" style={{ marginTop: 6 }}>Click a stage to inspect it. Switch scenarios to see which parts of the chain stay abroad.</p>
        </div>

        <div className="card ar-inspector">
          {stage ? <Inspector stage={stage} scenario={scenario} importedFrom={plan.line.importedFrom} openSupplier={openSupplier} /> : <div className="tiny">Pick a stage in the chain.</div>}
        </div>
      </div>

      <div className="card">
        <div className="section-title">Where to set up</div>
        <p className="small muted" style={{ marginBottom: 10 }}>Districts ranked for {plan.line.process.toLowerCase()}, weighted for “{EMPHASIS.find((x) => x.id === input.emphasis)!.label.toLowerCase()}”. Sangam covers {districts.length} districts; regulations beyond the state minimum wage are not in its data, so check your state's single-window portal.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>District</th><th className="num">Score</th><th>Why</th><th /></tr></thead>
            <tbody>
              {plan.regions.slice(0, 5).map((r) => (
                <tr key={r.district.id} className={r.district.id === plan.region.district.id ? 'rowsel on' : ''}>
                  <td><b>{r.district.name}</b><div className="tiny">{r.district.state}{r.cluster ? ` · ${r.cluster.name}` : ''}</div></td>
                  <td className="num"><b>{r.score}</b></td>
                  <td className="small">
                    {[...r.factors].sort((a, b) => b.score - a.score).slice(0, 3).map((f) => <div key={f.key}>{f.label}: {f.detail} <Tag kind={f.tag} /></div>)}
                  </td>
                  <td>{r.district.id === plan.region.district.id ? <span className="chip ready">Chosen</span> : <button className="btn small" onClick={() => set({ districtId: r.district.id, wagePerDay: undefined })}>Choose</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Import-dependent, hybrid or India-first</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th />{plan.scenarios.map((s) => <th key={s.id}>{s.name}</th>)}</tr></thead>
            <tbody>
              <tr><td className="small muted">What it means</td>{plan.scenarios.map((s) => <td key={s.id} className="small">{s.idea}</td>)}</tr>
              <tr><td className="small muted">Cost to the buyer, per {buyer.unitLabel} set</td>{plan.scenarios.map((s) => <td key={s.id}>{s.costPerUnit ? <Money f={s.costPerUnit} /> : <span className="tiny">Not estimated</span>}</td>)}</tr>
              <tr><td className="small muted">Lead time</td>{plan.scenarios.map((s) => <td key={s.id}>{s.leadDays.value} days <Tag kind={s.leadDays.tag} /></td>)}</tr>
              <tr><td className="small muted">Inputs sourced in India</td>{plan.scenarios.map((s) => <td key={s.id}>{s.indiaInputs.value}% <Tag kind={s.indiaInputs.tag} /></td>)}</tr>
              <tr><td className="small muted">New jobs in India</td>{plan.scenarios.map((s) => <td key={s.id}>{s.jobs.value} <Tag kind={s.jobs.tag} /></td>)}</tr>
              <tr><td className="small muted">Supply risk</td>{plan.scenarios.map((s) => <td key={s.id} className="small">{s.supplyRisk}{s.notes.map((n, i) => <div key={i} className="tiny">{n}</div>)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">Business plan</div>
          <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>To start</div>
          <div className="kv">
            {plan.setup.map((s) => <Fragment key={s.label}><span title={s.lakh.note}>{s.label}{s.months ? <span className="tiny"> · {s.months} mo</span> : null}</span><span>{lakh(s.lakh.value)} <Tag kind={s.lakh.tag} /></span></Fragment>)}
            <span><b>Total</b></span><span><b>{lakh(plan.setupTotalLakh)}</b></span>
          </div>
          <div className={`note ${plan.budgetGapLakh > 0 ? 'warn' : ''}`} style={{ marginTop: 10 }}>
            {plan.budgetGapLakh > 0
              ? <>About {lakh(plan.budgetGapLakh)} more than your budget. Schemes listed with these costs in Sangam: {[...new Set(plan.setup.flatMap((s) => s.schemes))].join(', ')}.</>
              : <>Fits your budget with about {lakh(-plan.budgetGapLakh)} to spare.</>}
          </div>

          <div className="small" style={{ fontWeight: 600, margin: '16px 0 6px' }}>Per {buyer.unitLabel} set at {input.utilisationPct ?? def.utilisationPct}% utilisation</div>
          <div className="kv">
            <span>Selling price</span><Money f={e.price} />
            <span>Materials and overheads</span><Money f={e.materials} />
            <span>Wages at your planned wage</span><Money f={e.labour} />
            <span>{input.buyerCountry === 'IN' ? 'Delivery to the buyer' : 'Export route to the port'}</span><Money f={e.freight} />
            <span><b>Left over per unit</b></span><span style={{ color: e.contribution.value < 0 ? 'var(--danger)' : undefined }}><b>{inr(e.contribution.value)}</b></span>
            <span>A month at steady state</span><span>{lakh(e.monthlyContribution.value / 1e5)} <span className="tiny">on {lakh(e.monthlyRevenue.value / 1e5)} sales</span></span>
            <span>Pays back set-up in</span><span>{e.paybackMonths != null ? `${e.paybackMonths} months` : 'Not at these assumptions'}</span>
          </div>
          <p className="tiny" style={{ marginTop: 8 }}>Prices come from Sangam's demo suppliers, not quotes: confirm with real buyers. Revenue is a projection from your capacity and utilisation, not a forecast of orders.</p>
        </div>

        <div className="card">
          <div className="section-title">Decent work (SDG 8)</div>
          <div className="row" style={{ gap: 10, marginBottom: 10 }}><FairWorkBadge score={w.score} /><span className="tiny">Projected grade if you run the plan as set</span></div>
          <div className="kv">
            <span>Jobs created</span><span>{w.workers.value} <Tag kind={w.workers.tag} title={w.workers.note} /></span>
            <span>Planned wage a day</span><span>{inr(w.wage.value)} <Tag kind={w.wage.tag} /></span>
            <span>Living wage here</span><span>{w.living ? <>{inr(w.living.perDay)} <Tag kind={w.living.tag} title={w.living.source} /></> : 'Unknown'}</span>
            <span>State minimum wage</span><span>{w.minimum ? <>{inr(w.minimum.perDay)} <Tag kind="public" title={w.minimum.source} /></> : <span className="tiny">Not in Sangam's data</span>}</span>
            <span>Women in the workforce</span><span>{w.womenShare}% <Tag kind="assumption" /></span>
          </div>
          <ul className="small" style={{ margin: '10px 0 0', paddingLeft: 18 }}>{w.score.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <div className="small" style={{ fontWeight: 600, margin: '14px 0 6px' }}>Skills and safety</div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {plan.skills.map((s) => <li key={s.name}>{s.name}: about {lakh(s.costLakh)}, {s.months} months. Support: {s.schemes.join(', ')} <Tag kind="estimated" /></li>)}
            <li>{input.trainingHoursPerYear ?? def.trainingHoursPerYear} training hours a worker a year <Tag kind="assumption" /></li>
            <li>Safety record planned: {input.safetyPlan ?? def.safetyPlan} (a missing record lowers the grade one step)</li>
            <li>8-hour days, no forced overtime: the agents block offers that need more</li>
          </ul>
          <button className="btn small" style={{ marginTop: 12 }} onClick={() => go('supplier', 'workforce')}>Fill your Workforce and fair work profile</button>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Step by step</div>
        <ol className="ar-phases">
          {plan.phases.map((p) => (
            <li key={p.name}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><b>{p.name}</b><span className="tiny">months {p.months}{p.utilisationPct ? ` · ${p.utilisationPct}% utilisation · ${lakh(p.revenuePerMonth.value / 1e5)} sales a month` : ''}</span></div>
              <ul className="small">{p.tasks.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </li>
          ))}
        </ol>
        {plan.diversify.length > 0 && <p className="small" style={{ marginTop: 10 }}>Later, the same skills can make: {plan.diversify.map((d) => `${d.name} (market about ₹${d.marketCr.toLocaleString('en-IN')} crore, ${d.growthPct}% a year)`).join('; ')} <Tag kind="simulated" /> · <button className="link-btn" onClick={() => go('supplier', 'grow')}>Future diversification</button></p>}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">Risks Sangam found</div>
          {plan.risks.length === 0 ? <div className="tiny">None from the data.</div> : (
            <ul className="ar-risks">{plan.risks.map((r, i) => <li key={i}><span className={`level ${r.level === 'high' ? 'high' : r.level === 'medium' ? 'elevated' : 'low'}`}>{r.level}</span> {r.text} <Tag kind={r.tag} /></li>)}</ul>
          )}
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div className="section-title" style={{ margin: 0 }}>AI review</div>
            <button className="btn small" disabled={ai.busy === 'review'} style={{ visibility: 'visible' }} onClick={askReview}>{ai.busy === 'review' ? 'Reviewing…' : ai.review ? 'Review again' : 'Ask the AI to review this plan'}</button>
          </div>
          {ai.error && <div className="note warn" style={{ marginTop: 10 }}>{ai.error}</div>}
          {ai.review ? (
            <div className="stack" style={{ gap: 8, marginTop: 10 }}>
              <div className="row" style={{ gap: 6 }}><Tag kind="ai" /><span className="tiny">Reviewed only the figures above; verify before relying on it.</span></div>
              <p className="small">{ai.review.summary}</p>
              {ai.review.risks.length > 0 && <><b className="small">Risks the plan may miss</b><ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{ai.review.risks.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
              {ai.review.nextSteps.length > 0 && <><b className="small">Next steps</b><ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{ai.review.nextSteps.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
            </div>
          ) : !ai.error && <p className="tiny" style={{ marginTop: 10 }}>The model sees only the plan's figures and their sources, and is told not to invent any.</p>}
        </div>
      </div>

      <details className="card">
        <summary>Edit assumptions and regenerate</summary>
        <p className="tiny" style={{ marginBottom: 10 }}>Leave a box empty to use Sangam's default (shown faintly). The plan updates as you type.</p>
        <div className="form-grid">
          <NumField label={`Selling price per ${buyer.unitLabel} set`} suffix="₹" value={input.pricePerUnit} placeholder={def.pricePerUnit} onChange={(v) => set({ pricePerUnit: v })} />
          <NumField label="Wage a worker-day" suffix="₹" value={input.wagePerDay} placeholder={def.wagePerDay} onChange={(v) => set({ wagePerDay: v })} />
          <NumField label="Workers per 1,000 units a month" step={0.5} value={input.workersPerThousand} placeholder={def.workersPerThousand} onChange={(v) => set({ workersPerThousand: v })} />
          <NumField label="Materials and overheads" suffix="% of price" max={100} value={input.materialsPct} placeholder={def.materialsPct} onChange={(v) => set({ materialsPct: v })} />
          <NumField label="Utilisation at steady state" suffix="%" max={100} value={input.utilisationPct} placeholder={def.utilisationPct} onChange={(v) => set({ utilisationPct: v })} />
          <NumField label="Women in the workforce" suffix="%" max={100} value={input.womenSharePct} placeholder={def.womenSharePct} onChange={(v) => set({ womenSharePct: v })} />
          <NumField label="Training hours a worker a year" value={input.trainingHoursPerYear} placeholder={def.trainingHoursPerYear} onChange={(v) => set({ trainingHoursPerYear: v })} />
          <label className="field">Safety record planned
            <select value={input.safetyPlan ?? def.safetyPlan} onChange={(ev) => set({ safetyPlan: ev.target.value as ArchitectInput['safetyPlan'] })}>
              <option value="complete">Complete (audited)</option><option value="partial">Partial</option><option value="none">None yet</option>
            </select>
          </label>
          {input.buyerCountry !== 'IN' && <NumField label="Buyer's import duty" suffix="%" value={input.importDutyPct} placeholder={def.importDutyPct} onChange={(v) => set({ importDutyPct: v })} />}
        </div>
        <button className="btn small" style={{ marginTop: 12 }} onClick={() => set({ pricePerUnit: undefined, wagePerDay: undefined, workersPerThousand: undefined, materialsPct: undefined, utilisationPct: undefined, womenSharePct: undefined, trainingHoursPerYear: undefined, safetyPlan: undefined, importDutyPct: undefined })}>Reset to Sangam's defaults</button>
      </details>

      <div className="card">
        <div className="section-title">Carry on in Sangam</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={() => go('supplier', 'profile')}>Create your supplier profile</button>
          <button className="btn small" onClick={() => go('supplier', 'opps')}>See buyers' requirements</button>
          <button className="btn small" onClick={() => go('supplier', 'consortia')}>Team up in a consortium</button>
          <button className="btn small ghost" onClick={() => go('buyer', 'clusters')}>Skill clusters map</button>
          <button className="btn small ghost" onClick={() => go('buyer', 'location')}>Location planner</button>
        </div>
      </div>
    </div>
  );
}

function Inspector({ stage, scenario, importedFrom, openSupplier }: { stage: Stage; scenario: ScenarioId; importedFrom: string; openSupplier: (id: string) => void }) {
  const origin = originUnder(stage, scenario, importedFrom);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div>
        <div className="eyebrow">{{ raw: 'Raw material', processing: 'Processing', manufacturing: 'Manufacturing', logistics: 'Logistics', buyer: 'Buyer' }[stage.kind]} · {origin === 'import' ? 'imported' : origin === 'mixed' ? 'India, supply not proven' : 'India'}</div>
        <div className="section-title" style={{ margin: '4px 0 2px' }}>{stage.kind === 'manufacturing' && origin === 'import' ? `Made in ${importedFrom}` : stage.name}</div>
        <div className="tiny">{stage.place}</div>
      </div>
      <div className="kv">{stage.facts.map((f) => <Fragment key={f.label}><span>{f.label}</span><span style={{ textAlign: 'right' }}>{f.value} <Tag kind={f.tag} /></span></Fragment>)}</div>
      {stage.suppliers.length > 0 && (
        <div>
          <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>{stage.kind === 'manufacturing' ? 'Already on Sangam in this process' : 'Sangam suppliers who may supply this'}</div>
          {stage.suppliers.slice(0, 6).map((s) => <div key={s.id} className="small"><button className="linkish" onClick={() => openSupplier(s.id)}>{s.name}</button> <span className="tiny">{s.type} · {s.verification === 'verified' ? 'verified' : 'self-declared'}</span></div>)}
        </div>
      )}
    </div>
  );
}
