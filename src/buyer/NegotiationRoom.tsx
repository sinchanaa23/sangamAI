// F3: the negotiation room. Shows each agent message in order, the offer behind it, what the
// orchestrator refused and why, and the Auditor's Fair Work Scorecard at the end.
// For now it replays a local fixture; it will switch to P1's SSE stream (src/api.ts) in hours 10-14.
import { Fragment, useEffect, useRef } from 'react';
import { sellers } from '../data';
import { inr, lakh, pct } from '../engine';
import { useUi } from '../ui';
import Src from '../components/Src';
import GradeBadge from './negotiation/GradeBadge';
import { DEMO_EVENTS, DEMO_RFQ, LIVING_WAGE_PER_DAY } from './negotiation/demoFixture';
import { useReplay } from './negotiation/useReplay';
import type { FairWorkScore, Money, NegotiationEvent, Offer, Side } from './negotiation/types';
import './negotiation/room.css';

const MAX_ROUNDS = 4;
const STEPS = ['search', 'select', 'init', 'confirm'] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], string> = { search: 'Search', select: 'Quote', init: 'Negotiate', confirm: 'Confirm' };
const SIDE_LABEL: Record<Side, string> = { buyer: 'Buyer Agent', supplier: 'Supplier Agent', auditor: 'Auditor Agent' };
const SIDE_FOR: Record<Side, string> = { buyer: 'for Veer Electric Mobility', supplier: 'for the supplier', auditor: 'for the Sangam ecosystem' };
const STATUS_CHIP: Record<Offer['status'], { cls: string; label: string }> = {
  proposed: { cls: 'plain', label: 'Proposed' },
  countered: { cls: 'potential', label: 'Counter-offer' },
  rejected: { cls: 'danger', label: 'Blocked' },
  accepted: { cls: 'ready', label: 'Accepted' },
};

const money = (m: Money) => (m.currency === 'INR' ? (m.amount >= 1e5 ? lakh(m.amount / 1e5) : inr(m.amount)) : `${m.currency} ${Math.round(m.amount).toLocaleString('en-IN')}`);
const perUnit = (m: Money, qty: number) => (m.currency === 'INR' ? inr(m.amount / qty) : `${m.currency} ${(m.amount / qty).toFixed(2)}`);
const supplierName = (id: string) => sellers.find((s) => s.id === id)?.name ?? 'Krishnagiri Mahila Harness Collective';

function OfferCard({ offer, qty }: { offer: Offer; qty: number }) {
  const chip = STATUS_CHIP[offer.status];
  const l = offer.labour;
  const belowFloor = l.wagePerWorkerDay < LIVING_WAGE_PER_DAY;
  return (
    <div className={`nr-offer ${offer.status}`}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span className="nr-price">{money(offer.price)}</span>
          <span className="tiny"> · {perUnit(offer.price, qty)} a harness · {offer.leadTimeDays} days</span>
        </div>
        <span className={`chip ${chip.cls}`}>{chip.label}</span>
      </div>
      <div className="nr-labour">
        <div><b>{l.workers}</b>workers</div>
        <div><b>{l.workerDays.toLocaleString('en-IN')}</b>worker-days</div>
        <div><b className={belowFloor ? 'nr-bad' : ''}>{inr(l.wagePerWorkerDay)}</b>wage a day</div>
        <div><b>{l.hoursPerDay} h</b>a day</div>
        <div><b>{pct(l.womenShare)}</b>women</div>
      </div>
      {offer.reason && <div className="nr-reason"><b>Orchestrator:</b> {offer.reason}</div>}
    </div>
  );
}

function Message({ e }: { e: Extract<NegotiationEvent, { from: Side }> }) {
  return (
    <li className={`nr-msg ${e.from}`}>
      <div className="nr-who">
        <span className={`nr-avatar ${e.from}`}>{e.from[0].toUpperCase()}</span>
        <span><b>{SIDE_LABEL[e.from]}</b> <span className="tiny">{SIDE_FOR[e.from]} · {STEP_LABEL[e.type]}{e.offer ? ` · round ${e.offer.round}` : ''}</span></span>
      </div>
      <div className="nr-bubble">
        <p>{e.text}</p>
        {e.offer && <OfferCard offer={e.offer} qty={DEMO_RFQ.quantity} />}
      </div>
    </li>
  );
}

function Scorecard({ score, decision }: { score: FairWorkScore; decision: 'pass' | 'flag' | 'block' }) {
  const rows: [string, string, boolean][] = [
    ['Wage vs living wage', `${Math.round(score.wageVsLivingWage * 100)}%`, score.wageVsLivingWage >= 1],
    ['Wage vs state minimum', `${Math.round(score.wageVsMinimum * 100)}%`, score.wageVsMinimum >= 1],
    ['Overtime', `${score.overtimeHours} h`, score.overtimeHours === 0],
    ['Safety record', pct(score.safety), score.safety >= 1],
    ['Child or forced labour', score.childLabourFlag ? 'Flagged' : 'None found', !score.childLabourFlag],
    ['Women in the workforce', pct(score.womenShare), true],
  ];
  const decisionChip = { pass: { cls: 'ready', label: 'Passed' }, flag: { cls: 'potential', label: 'Flagged for human review' }, block: { cls: 'danger', label: 'Blocked' } }[decision];
  return (
    <div className="card nr-score">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div className="section-title" style={{ margin: 0 }}>Fair Work Scorecard</div>
        <span className={`chip ${decisionChip.cls}`}>{decisionChip.label}</span>
      </div>
      <div style={{ margin: '14px 0' }}><GradeBadge score={score} size="lg" /></div>
      <div className="kv">
        {rows.map(([k, v, ok]) => (
          <Fragment key={k}><span>{k}</span><span style={{ color: ok ? undefined : 'var(--potential)' }}>{v}</span></Fragment>
        ))}
      </div>
      <p className="tiny" style={{ marginTop: 12 }}>Benchmark: {score.benchmarkSource} <Src kind="estimated" /></p>
    </div>
  );
}

export default function NegotiationRoom() {
  const { go } = useUi();
  const replay = useReplay(DEMO_EVENTS);
  const listEnd = useRef<HTMLLIElement>(null);
  const shown = replay.shown;

  const offers = shown.flatMap((e) => ('offer' in e && e.offer ? [e.offer] : []));
  const terms = [...offers].reverse().find((o) => o.status !== 'rejected');
  const blocked = offers.filter((o) => o.status === 'rejected').length;
  const round = offers.reduce((r, o) => Math.max(r, o.round), 0);
  const audit = shown.find((e): e is Extract<NegotiationEvent, { type: 'audit' }> => e.type === 'audit');
  const end = shown.find((e): e is Extract<NegotiationEvent, { type: 'end' }> => e.type === 'end');
  const lastStep = [...shown].reverse().find((e) => e.type !== 'audit' && e.type !== 'end')?.type;
  const stepIdx = end ? STEPS.length : lastStep ? STEPS.indexOf(lastStep as (typeof STEPS)[number]) : -1;

  useEffect(() => { listEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [shown.length]);

  const budget = DEMO_RFQ.budget.amount;
  return (
    <div className="stack">
      <div className="card">
        <div className="eyebrow">Negotiation room · {DEMO_RFQ.id} <Src kind="simulated" title="Replay of a recorded demo negotiation; companies and prices are simulated" /></div>
        <h1 className="lead" style={{ marginTop: 6 }}>{DEMO_RFQ.quantity.toLocaleString('en-IN')} wiring harnesses, negotiated by agents under a living-wage floor.</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          The Buyer Agent bargains for Veer Electric Mobility, the Supplier Agent for {supplierName('s13')}. Plain code checks every offer before the other side sees it: at most {MAX_ROUNDS} rounds, the budget, free capacity and a wage of at least {inr(LIVING_WAGE_PER_DAY)} a worker-day.
        </p>
        <div className="nr-steps" aria-label="Negotiation steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`nr-step ${i < stepIdx ? 'done' : i === stepIdx ? 'on' : ''}`}><span className="num">{i + 1}</span>{STEP_LABEL[s]}</div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
          {!replay.done && <button className="btn small" onClick={replay.toggle}>{replay.playing ? 'Pause' : 'Resume'}</button>}
          {!replay.done && <button className="btn small ghost" onClick={replay.skip}>Skip to the end</button>}
          {replay.done && <button className="btn small" onClick={replay.restart}>Replay negotiation</button>}
          <span className="feed" style={{ marginLeft: 'auto' }}><span className={`d ${end ? 'ok' : 'load'}`} />{end ? 'Finished' : replay.playing ? 'Agents are talking' : 'Paused'} · replay</span>
        </div>
      </div>

      <div className="nr-grid">
        <div className="card">
          <div className="section-title">What each agent said</div>
          {shown.length === 0 ? <div className="empty">Starting the agents…</div> : (
            <ol className="nr-timeline">
              {shown.map((e, i) => {
                if (e.type === 'audit') return null;
                if (e.type === 'end') {
                  return (
                    <li key={i} ref={listEnd} className={`nr-end ${e.outcome}`}>
                      {e.outcome === 'deal' ? `Deal confirmed${e.dealId ? ` · ${e.dealId}` : ''}` : 'No deal: the agents could not agree within the limits'}
                    </li>
                  );
                }
                return <Message key={i} e={e} />;
              })}
              {!end && <li ref={listEnd} className="nr-typing" aria-hidden="true"><span /><span /><span /></li>}
            </ol>
          )}
        </div>

        <div className="stack nr-side">
          <div className="card">
            <div className="section-title">Terms on the table</div>
            {terms ? (
              <>
                <div className="nr-price" style={{ fontSize: 26 }}>{money(terms.price)}</div>
                <div className="tiny">{perUnit(terms.price, DEMO_RFQ.quantity)} a harness · {terms.leadTimeDays} days · round {round} of {MAX_ROUNDS}</div>
                <div className="nr-meter-label"><span>Against budget {money(DEMO_RFQ.budget)}</span><b>{Math.round((terms.price.amount / budget) * 100)}%</b></div>
                <div className="meter"><span style={{ width: `${Math.min(100, (terms.price.amount / budget) * 100)}%`, background: terms.price.amount > budget ? 'var(--potential)' : 'var(--accent)' }} /></div>
                <div className="nr-meter-label"><span>Wage against living wage <Src kind="estimated" /></span><b>{inr(terms.labour.wagePerWorkerDay)}</b></div>
                <div className="meter nr-wage"><span style={{ width: `${Math.min(100, (terms.labour.wagePerWorkerDay / LIVING_WAGE_PER_DAY) * 80)}%`, background: 'var(--ready)' }} /><i title="Living-wage floor" /></div>
                <div className="tiny" style={{ marginTop: 4 }}>The mark is the floor: {inr(LIVING_WAGE_PER_DAY)} a worker-day</div>
              </>
            ) : <div className="tiny">No offer yet.</div>}
            {blocked > 0 && <div className="note warn" style={{ marginTop: 14 }}>{blocked} offer{blocked > 1 ? 's' : ''} blocked for paying below the living wage.</div>}
          </div>

          {audit ? <Scorecard score={audit.score} decision={audit.decision} /> : (
            <div className="card"><div className="section-title">Fair Work Scorecard</div><div className="tiny">The Auditor Agent grades the accepted offer once the two sides agree.</div></div>
          )}

          {end?.outcome === 'deal' && (
            <div className="card">
              <div className="section-title">Next</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn small" onClick={() => go('ecosystem', 'verify')}>See the signed credential</button>
                <button className="btn small ghost" onClick={() => go('buyer', 'requirements')}>Back to requirements</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
