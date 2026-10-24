// Find suppliers: every company that can make the selected BOM line, ranked by one Sangam
// score (plan §3.2). Weights are the buyer's to change; every metric is on a fixed 0-100
// scale from src/ranking.ts, and every contribution carries its provenance tag. Transport
// CO2 is shown as information only - it never enters the score.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { active, bom, sellers } from '../data';
import { district, inr, isRural } from '../engine';
import { DEFAULT_WEIGHTS, fairWorkFor, METRICS, PRESETS, rankSuppliers } from '../ranking';
import type { MetricId, RankedSupplier } from '../ranking';
import { scoreSustainability } from '../sustainability';
import type { SustainabilityAnswers, SustainabilityLevel } from '../sustainability';
import { loadSustainability } from '../seller/sustainability';
import { useStore } from '../store';
import type { Provenance } from '../types';
import { useUi } from '../ui';
import CountUp from '../components/motion/CountUp';
import Slider from '../components/Slider';
import Src from '../components/Src';
import FairWorkBadge from '../components/FairWorkBadge';
import SustainabilityBadge from '../components/SustainabilityBadge';

const LADDER: SustainabilityLevel[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const MIN_LEVELS = ['Any', 'Silver+', 'Gold+', 'Platinum'] as const;
type MinLevel = (typeof MIN_LEVELS)[number];

/** Provenance chip for a contribution's source; 'not graded'/'not assessed' get plain text. */
const SRC_KINDS: Provenance[] = ['live', 'public', 'verified', 'declared', 'estimated', 'simulated'];
function SourceTag({ source }: { source: string }) {
  return SRC_KINDS.includes(source as Provenance)
    ? <Src kind={source as Provenance} />
    : <span className="tiny muted">{source}</span>;
}

const rawValue = (m: MetricId, row: RankedSupplier): string => {
  const v = row.contributions[m].value;
  switch (m) {
    case 'cost': return inr(v);
    case 'distance': return `${v.toLocaleString('en-IN')} km`;
    case 'reviews': return v >= 0 ? `${v.toFixed(1)} of 5` : 'none';
    case 'quality': return `${v}% on time`;
    case 'verification': return `${v} of 65 trust pts`;
    case 'fairwork': return v > 0 ? `₹${v.toLocaleString('en-IN')}/worker-day` : 'no profile';
    case 'sustainability': return `${v}/100 checklist`;
  }
};

const co2Label = (kg: number) => (kg >= 1 ? `${kg.toFixed(1)} kg` : `${Math.round(kg * 1000)} g`);

export default function RankingPage() {
  const { state, dataVersion } = useStore();
  const { openSupplier, go } = useUi();
  const [lineId, setLineId] = useState(bom[0]?.id ?? '');
  const line = bom.find((l) => l.id === lineId) ?? bom[0];
  const [weights, setWeights] = useState<Record<MetricId, number>>({ ...DEFAULT_WEIGHTS });
  const [minLevel, setMinLevel] = useState<MinLevel>('Any');
  const [hideD, setHideD] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, SustainabilityAnswers | null>>({});

  // One load per supplier (server → device → seed), reloaded when the sector dataset changes.
  useEffect(() => {
    let alive = true;
    Promise.all(sellers.map(async (s) => [s.id, (await loadSustainability(s.id, s.name)).answers] as const))
      .then((entries) => { if (alive) setAnswers(Object.fromEntries(entries)); });
    return () => { alive = false; };
  }, [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const pool = useMemo(() => {
    const need = MIN_LEVELS.indexOf(minLevel); // 0 = Any; 1..3 = minimum rung on the ladder
    return sellers.filter((s) => {
      if (!line || s.process !== line.process) return false;
      if (verifiedOnly && s.verification !== 'verified') return false;
      if (hideD && fairWorkFor(s)?.grade === 'D') return false;
      if (need > 0) {
        const a = answers[s.id];
        const lvl = a ? scoreSustainability(a, active.sector).level : 'Not assessed';
        if (LADDER.indexOf(lvl) < need) return false;
      }
      return true;
    });
  }, [line, verifiedOnly, hideD, minLevel, answers, dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const ranked = useMemo(
    () => (line ? rankSuppliers({ sellers: pool, line, state, weights, answersFor: (id) => answers[id] }) : []),
    [line, pool, state, weights, answers, dataVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const listed = ranked.filter((r) => !r.excluded);
  const blocked = ranked.filter((r) => r.excluded);

  const activePreset = PRESETS.find((p) => JSON.stringify(p.weights) === JSON.stringify(weights));
  const setWeight = (id: MetricId, v: number) => setWeights((ws) => ({ ...ws, [id]: v }));

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Find suppliers</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Every company that can make this part, ranked by one Sangam score: cost, distance, reviews,
          quality, verification, Fair Work and sustainability, weighted your way. Each metric sits on a
          fixed 0-100 scale, so scores stay stable as you tune.
        </p>
      </div>

      <div className="card stack" style={{ gap: 14 }}>
        <div className="form-grid">
          <label className="field">Part
            <select value={line?.id ?? ''} onChange={(e) => { setLineId(e.target.value); setOpenRow(null); }}>
              {bom.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        </div>

        <div>
          <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Weight preset</div>
          <div className="toggle-row">
            {PRESETS.map((p) => (
              <button key={p.id} className={`pill ${activePreset?.id === p.id ? 'on' : ''}`} onClick={() => setWeights({ ...p.weights })}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
          {METRICS.map((m) => (
            <Slider key={m.id} label={m.label} value={weights[m.id]} min={0} max={50} step={1}
              format={(v) => `${v} pts`} onChange={(v) => setWeight(m.id, v)} />
          ))}
        </div>

        <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
          <label className="field">Minimum sustainability level
            <select value={minLevel} onChange={(e) => setMinLevel(e.target.value as MinLevel)}>
              {MIN_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="row small" style={{ alignSelf: 'end', paddingBottom: 10 }}>
            <input type="checkbox" checked={hideD} onChange={(e) => setHideD(e.target.checked)} /> Hide Fair Work D
          </label>
          <label className="row small" style={{ alignSelf: 'end', paddingBottom: 10 }}>
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> Verified suppliers only
          </label>
        </div>
      </div>

      {!line && <div className="empty">No parts in this sector yet.</div>}

      {line && listed.length === 0 && <div className="empty">No suppliers match these filters for {line.name}.</div>}

      {listed.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Company</th><th className="num">Sangam score</th><th>Sustainability</th><th>Fair Work</th>
                <th className="num">Landed cost</th><th className="num">Distance</th><th className="num">Reviews</th><th className="num">CO₂ / unit</th><th />
              </tr>
            </thead>
            <tbody>
              {listed.map((r, i) => {
                const s = sellers.find((x) => x.id === r.sellerId)!;
                const d = district(s.districtId);
                const fw = fairWorkFor(s);
                const a = answers[s.id];
                const sus = a ? scoreSustainability(a, active.sector) : null;
                const isOpen = openRow === r.sellerId;
                return (
                  <Fragment key={r.sellerId}>
                    <tr>
                      <td style={{ fontWeight: 700 }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          <button className="linkish" onClick={() => openSupplier(s.id)}>{s.name}</button>
                          {isRural(s) && <> <span className="chip rural">{s.type}</span></>}
                        </div>
                        <div className="tiny muted">{d.name}, {d.state} · {s.process}</div>
                      </td>
                      <td className="num">
                        <b style={{ fontSize: i === 0 ? 22 : 15, color: 'var(--ink)' }}>
                          {i === 0 ? <CountUp value={r.sangamScore} format={(n) => Math.round(n).toString()} /> : Math.round(r.sangamScore)}
                        </b>
                      </td>
                      <td>{sus ? <SustainabilityBadge result={sus} showLabel={false} size="sm" /> : <span className="chip plain" title="Checklist not filled in yet">Not assessed</span>}</td>
                      <td>{fw ? <FairWorkBadge score={fw} showLabel={false} size="sm" /> : <span className="chip plain" title="No Fair Work Scorecard yet: the supplier has not filled in a workforce profile">Not graded</span>}</td>
                      <td className="num">{inr(r.landedCost)} <Src kind="estimated" /></td>
                      <td className="num">{r.km.toLocaleString('en-IN')} km</td>
                      <td className="num">{r.stars != null ? `${r.stars.toFixed(1)}★` : '—'}</td>
                      <td className="num">{co2Label(r.co2KgPerUnit)} <Src kind="estimated" title="Route model estimate, information only - not part of the score" /></td>
                      <td><button className="link-btn" onClick={() => setOpenRow(isOpen ? null : r.sellerId)}>{isOpen ? 'Hide' : `Why #${i + 1}?`}</button></td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={10}>
                          <div className="stack" style={{ gap: 10, padding: '6px 2px 10px' }}>
                            <div className="small" style={{ fontWeight: 600 }}>Why #{i + 1}? Each metric on its fixed 0-100 scale, weighted {Object.values(weights).reduce((a, b) => a + b, 0)} points in total</div>
                            {METRICS.map((m) => {
                              const c = r.contributions[m.id];
                              return (
                                <div key={m.id}>
                                  <div className="row small" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                                    <span>{m.label} <SourceTag source={c.source} /></span>
                                    <span className="tiny muted">{rawValue(m.id, r)} → {Math.round(c.scaled)}/100 × weight {c.weight}</span>
                                  </div>
                                  <div style={{ height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.max(c.scaled, c.scaled > 0 ? 1.5 : 0)}%`, height: '100%', background: '#3d5a45', borderRadius: 4 }} />
                                  </div>
                                </div>
                              );
                            })}
                            <div className="tiny muted">CO₂ per unit uses the estimated route model and is information only - it never enters the score.</div>
                            {(() => {
                              const app = state.funding.find((f) => f.sellerId === r.sellerId && (f.status === 'listed' || f.status === 'funded'));
                              if (!app) return null;
                              const remaining = app.projections.totalAskLakh - app.commitments.reduce((a, c) => a + c.amountLakh, 0);
                              return remaining > 0 ? (
                                <div className="row small" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
                                  <span>Needs ₹{remaining.toFixed(2)} L for {app.items[0]?.label.toLowerCase()} —</span>
                                  <button className="link-btn" onClick={() => go('buyer', 'funding')}>fund it</button>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {blocked.length > 0 && (
        <div className="note">
          <b>Removed from the ranking:</b>{' '}
          {blocked.map((r) => {
            const s = sellers.find((x) => x.id === r.sellerId);
            return s?.name ?? r.sellerId;
          }).join(', ')}
          {' '}— Fair Work grade E (child- or forced-labour flag) blocks the deal, so they never appear in the list.
        </div>
      )}

      {listed.length > 0 && (
        <div className="row">
          <button className="btn primary" onClick={() => go('buyer', 'requirements')}>Invite top {Math.min(3, listed.length)} to a requirement</button>
          <span className="tiny muted">Opens Requirements and quotes, where they can bid on {line?.name.toLowerCase() ?? 'this part'}.</span>
        </div>
      )}
    </div>
  );
}
