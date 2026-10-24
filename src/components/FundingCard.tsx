// The shared funding listing card (plan §4): the buyer's Fund-suppliers marketplace
// renders it in 'market' mode (expandable, with a simulated commit panel) and the
// SupplierDrawer embeds it in 'compact' mode (no commit panel). Every rupee is tagged —
// projections carry Estimated tags, commitments carry Simulated tags — and the header
// disclaimer lives on the page, not here. Commit maths is src/funding.ts's job only.
import { useEffect, useMemo, useState } from 'react';
import { CHECKLIST, scoreSustainability } from '../sustainability';
import type { SustainabilityAnswers } from '../sustainability';
import { buyer, sellers } from '../data';
import { district, isRural } from '../engine';
import {
  FUNDING_KINDS,
  applyCommitment,
  commitTotal,
  itemCoveredLakh,
  remainingAsk,
} from '../funding';
import type { FundingApplication, FundingCommitment, FundingItem, FundingKind } from '../funding';
import { fairWorkFor } from '../ranking';
import { putServerFunding } from '../seller/funding';
import { loadSustainability } from '../seller/sustainability';
import { trustScore } from '../trust';
import { useStore } from '../store';
import { useUi } from '../ui';
import ClickSpark from './motion/ClickSpark';
import FairWorkBadge from './FairWorkBadge';
import SustainabilityBadge from './SustainabilityBadge';
import Src from './Src';

/** Money is always rendered as ₹X.XX L, tagged estimated or simulated where it appears. */
export const formatLakh = (n: number) => `₹${n.toFixed(2)} L`;

/** Status chip shared with the My-commitments list on FundingMarketPage. */
export const FUNDING_STATUS_CHIP: Record<FundingApplication['status'], { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'plain' },
  submitted: { label: 'Awaiting desk check', cls: 'potential' },
  listed: { label: 'Listed', cls: 'plain' },
  funded: { label: 'Funded', cls: 'ready' },
  completed: { label: 'Completed', cls: 'ready' },
};

const KIND_LABEL = new Map<FundingKind, string>(FUNDING_KINDS.map((k) => [k.id, k.label]));
const kindLabel = (k: FundingKind) => KIND_LABEL.get(k) ?? k;

const ITEM_STATUS: Record<FundingItem['status'], { label: string; cls: string }> = {
  todo: { label: 'Not started', cls: 'plain' },
  doing: { label: 'In progress', cls: 'potential' },
  submitted: { label: 'Evidence submitted', cls: 'potential' },
  verified: { label: 'Verified', cls: 'ready' },
};

const checklistLabel = (id: string) => CHECKLIST.find((c) => c.id === id)?.label ?? id;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ask still open on one item: its cost minus what commitments already cover. */
const itemRemaining = (app: FundingApplication, it: FundingItem) =>
  Math.max(0, round2(it.costLakh - itemCoveredLakh(app, it.id)));

export default function FundingCard({ app, mode }: { app: FundingApplication; mode: 'market' | 'compact' }) {
  const { state, update, dataVersion } = useStore();
  const { openSupplier } = useUi();
  const [answers, setAnswers] = useState<SustainabilityAnswers | null>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [amountText, setAmountText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // The seller's checklist answers load per card (server → device → seed, the RankingPage
  // pattern) so the current sustainability badge can sit beside the expected uplift.
  useEffect(() => {
    let alive = true;
    loadSustainability(app.sellerId, app.sellerName).then((r) => { if (alive) setAnswers(r.answers); });
    return () => { alive = false; };
  }, [app.sellerId, app.sellerName, dataVersion]);

  const seller = sellers.find((s) => s.id === app.sellerId) ?? null;
  const trust = seller ? trustScore(seller, state) : null;
  const fw = seller ? fairWorkFor(seller) : null;
  const sus = answers ? scoreSustainability(answers, app.sector) : null;

  const p = app.projections;
  const committed = commitTotal(app);
  const remaining = remainingAsk(app);
  const buyers = new Set(app.commitments.map((c) => c.buyerId)).size;
  const schemes = [...new Set(app.items.flatMap((it) => it.schemes ?? []))];
  const openItems = app.items.filter((it) => itemRemaining(app, it) > 0);

  // The commit draft, validated live through the model's own applyCommitment so the UI
  // can never offer a pledge the model would reject (plan §2.2: bounded by remaining ask).
  const amount = amountText.trim() === '' ? 0 : round2(Number.parseFloat(amountText) || 0);
  const draft: FundingCommitment = useMemo(
    () => ({
      buyerId: 'buyer', buyerName: buyer.name, itemIds: picked, amountLakh: amount,
      committedAt: new Date().toISOString(), status: 'pledged',
    }),
    [picked, amount],
  );
  const validation = useMemo(() => applyCommitment(app, draft), [app, draft]);
  const pickedRemaining = round2(
    picked.reduce((n, id) => {
      const it = app.items.find((x) => x.id === id);
      return it ? n + itemRemaining(app, it) : n;
    }, 0),
  );
  const liveProblem = picked.length > 0 && amount > 0 && !validation.ok ? validation.problem : null;

  const toggleItem = (id: string) =>
    setPicked((ps) => (ps.includes(id) ? ps.filter((x) => x !== id) : [...ps, id]));

  const confirm = () => {
    const res = applyCommitment(app, { ...draft, committedAt: new Date().toISOString() });
    if (!res.ok) { setProblem(res.problem ?? 'The commitment was rejected.'); return; }
    update((st) => ({ ...st, funding: st.funding.map((f) => (f.id === res.app.id ? res.app : f)) }));
    void putServerFunding(res.app); // best-effort sync; the store copy already works offline
    setPicked([]);
    setAmountText('');
    setProblem(null);
    setNote(res.app.status === 'funded' ? 'Fully funded — the supplier can start.' : `Pledged ${formatLakh(amount)} — simulated.`);
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <button className="linkish" style={{ fontWeight: 600 }} onClick={() => openSupplier(app.sellerId)}>{app.sellerName}</button>
          {seller && <span className={`chip ${isRural(seller) ? 'rural' : 'plain'}`}>{seller.type}</span>}
          <span className={`chip ${FUNDING_STATUS_CHIP[app.status].cls}`}>{FUNDING_STATUS_CHIP[app.status].label}</span>
        </div>
        {seller && trust && <span className={`trust-badge trust-${trust.band}`}>Trust {trust.score} · {trust.band}</span>}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
        {seller && <span className="tiny muted">{district(seller.districtId).name}, {district(seller.districtId).state}</span>}
        {sus && <SustainabilityBadge result={sus} showLabel size="sm" />}
        {fw && <FairWorkBadge score={fw} showLabel={false} size="sm" />}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 600 }}>{app.title}</div>
        <div className="small muted">{app.purpose}</div>
      </div>

      <div className="stack" style={{ gap: 10, marginTop: 12 }}>
        {app.items.map((it) => {
          const covered = itemCoveredLakh(app, it.id);
          const rem = itemRemaining(app, it);
          const pctCovered = it.costLakh > 0 ? Math.min(100, (covered / it.costLakh) * 100) : 0;
          const st = ITEM_STATUS[it.status];
          return (
            <div key={it.id}>
              <div className="row small" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <span>
                  <span className="chip plain">{kindLabel(it.kind)}</span> <b>{it.label}</b>
                  {it.sustainabilityItemId && <span className="tiny muted"> · serves: {checklistLabel(it.sustainabilityItemId)}</span>}
                </span>
                <span>{formatLakh(it.costLakh)} <Src kind="estimated" /> <span className="tiny muted">· {it.months} mo</span></span>
              </div>
              <div className="meter" style={{ marginTop: 4 }}>
                <span style={{ width: `${pctCovered}%`, background: pctCovered >= 100 ? 'var(--ready)' : 'var(--accent)' }} />
              </div>
              <div className="row tiny muted" style={{ justifyContent: 'space-between', marginTop: 2 }}>
                <span>{formatLakh(covered)} covered · {rem > 0 ? `${formatLakh(rem)} open` : 'fully covered'}</span>
                {it.status !== 'todo' && <span className={`chip ${st.cls}`}>{st.label}</span>}
              </div>
              <div className="tiny muted" style={{ marginTop: 2 }}>{it.purpose}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="row small" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <span><b>{formatLakh(committed)}</b> of {formatLakh(p.totalAskLakh)} committed by {buyers} {buyers === 1 ? 'buyer' : 'buyers'} <Src kind="simulated" /></span>
          <span>{remaining > 0 ? <><b>{formatLakh(remaining)}</b> still open</> : 'Fully committed'}</span>
        </div>
        <div className="meter" style={{ marginTop: 4 }}>
          <span style={{ width: `${p.totalAskLakh > 0 ? Math.min(100, (committed / p.totalAskLakh) * 100) : 0}%`, background: 'var(--ready)' }} />
        </div>
      </div>

      <div className="row small" style={{ flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
        <span>Payback {p.paybackMonths != null ? `${p.paybackMonths} months` : '—'} <Src kind="estimated" /></span>
        {p.sustainabilityUplift && (
          <span>Sustainability {p.sustainabilityUplift.from} → {p.sustainabilityUplift.to} (+{p.sustainabilityUplift.points} pts) <Src kind="estimated" /></span>
        )}
        {p.sangamScoreUplift != null && <span>Sangam score +{p.sangamScoreUplift} expected <Src kind="estimated" /></span>}
      </div>

      {schemes.length > 0 && (
        <div className="toggle-row" style={{ marginTop: 10 }}>
          {schemes.map((s) => <span key={s} className="chip plain">{s}</span>)}
        </div>
      )}

      {mode === 'market' && (
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <button className="link-btn" onClick={() => { setOpen((o) => !o); setProblem(null); }}>
            {open ? 'Hide' : remaining > 0 ? `Fund items — ${formatLakh(remaining)} open` : 'Details'}
          </button>
          <span className="tiny muted">Simulated pledges — no money moves. <Src kind="simulated" /></span>
        </div>
      )}

      {mode === 'market' && open && (
        <div className="stack" style={{ borderTop: '1px solid var(--line)', marginTop: 12, paddingTop: 12, gap: 12 }}>
          <div>
            <div className="small" style={{ fontWeight: 600 }}>Evidence on file</div>
            <div className="tiny muted">{app.evidence.length > 0 ? app.evidence.join(' · ') : 'None attached yet'}</div>
          </div>
          {openItems.length === 0 ? (
            <p className="small muted">Every item is covered — nothing left to commit.</p>
          ) : (
            <>
              <div className="small" style={{ fontWeight: 600 }}>Pick the items to back</div>
              <div className="stack" style={{ gap: 6 }}>
                {app.items.map((it) => {
                  const rem = itemRemaining(app, it);
                  const off = rem <= 0;
                  return (
                    <label key={it.id} className="row small" style={{ gap: 8, opacity: off ? 0.55 : 1 }}>
                      <input type="checkbox" checked={picked.includes(it.id)} disabled={off} onChange={() => toggleItem(it.id)} />
                      <span style={{ flex: 1 }}>{it.label}</span>
                      <span className="tiny muted">{off ? 'covered' : `${formatLakh(rem)} open`}</span>
                    </label>
                  );
                })}
              </div>
              <label className="field">
                Amount to pledge (₹ lakh)
                <input
                  type="number" inputMode="decimal" min={0} step={0.1}
                  max={pickedRemaining > 0 ? pickedRemaining : undefined}
                  value={amountText}
                  placeholder={picked.length > 0 ? `up to ${pickedRemaining.toFixed(2)}` : 'pick items first'}
                  onChange={(e) => { setAmountText(e.target.value); setProblem(null); }}
                />
              </label>
              <div className="tiny muted">
                {picked.length === 0
                  ? 'Pick at least one item — the cap is the ask still open on the picked items.'
                  : `You can pledge up to ${formatLakh(pickedRemaining)}, the combined ask still open on the picked items.`}
              </div>
              {(problem ?? liveProblem) && <div className="note">{problem ?? liveProblem}</div>}
              <div className="row">
                <ClickSpark>
                  <button className="btn primary" disabled={picked.length === 0 || !(amount > 0)} onClick={confirm}>
                    Commit {amount > 0 ? formatLakh(amount) : ''} — simulated
                  </button>
                </ClickSpark>
              </div>
            </>
          )}
        </div>
      )}

      {note && <div className="note" style={{ marginTop: 12 }}>{note} <Src kind="simulated" /></div>}
    </div>
  );
}
