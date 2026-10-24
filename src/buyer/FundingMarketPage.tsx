// Fund suppliers (plan §4): the buyer-side marketplace. Suppliers' funding applications
// are listed as FundingCards; the buyer filters them, commits to specific items (a
// simulated pledge bounded by the remaining ask, validated by src/funding.ts), and tracks
// their pledges vs released money in the My-commitments tab. No money ever moves — the
// header says so, and every amount carries its provenance tag.
import { useEffect, useMemo, useState } from 'react';
import { sellers } from '../data';
import { FUNDING_KINDS, commitTotal } from '../funding';
import type { FundingApplication, FundingKind } from '../funding';
import { CHECKLIST, scoreSustainability } from '../sustainability';
import type { PillarId, SustainabilityAnswers, SustainabilityLevel } from '../sustainability';
import { SECTOR_LIST } from '../sectors';
import { loadSustainability } from '../seller/sustainability';
import { useStore } from '../store';
import FundingCard, { FUNDING_STATUS_CHIP, formatLakh } from '../components/FundingCard';
import Src from '../components/Src';
import Tabs from '../components/Tabs';
import { useUi } from '../ui';

type TabId = 'market' | 'mine';
type GoalId = 'renewables' | 'recycling' | 'water' | 'local';

const MIN_LEVELS = ['Any', 'Silver+', 'Gold+', 'Platinum'] as const;
type MinLevel = (typeof MIN_LEVELS)[number];
const LADDER: SustainabilityLevel[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

/** Goal chips derive from the linked CHECKLIST items' pillars (plan §4). */
const GOALS: { id: GoalId; label: string; pillar: PillarId }[] = [
  { id: 'renewables', label: 'Renewables', pillar: 'energy' },
  { id: 'recycling', label: 'Recycling', pillar: 'materials' },
  { id: 'water', label: 'Water', pillar: 'water' },
  { id: 'local', label: 'Local sourcing', pillar: 'local' },
];

/** The marketplace lists live applications only: listed, funded and completed work. */
const LIVE_STATUSES: FundingApplication['status'][] = ['listed', 'funded', 'completed'];

const round2 = (n: number) => Math.round(n * 100) / 100;

const goalsFor = (app: FundingApplication): GoalId[] => {
  const out = new Set<GoalId>();
  for (const it of app.items) {
    if (!it.sustainabilityItemId) continue;
    const pillar = CHECKLIST.find((c) => c.id === it.sustainabilityItemId)?.pillar;
    const goal = GOALS.find((g) => g.pillar === pillar);
    if (goal) out.add(goal.id);
  }
  return [...out];
};

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function FundingMarketPage() {
  const { state, update, dataVersion } = useStore();
  const [tab, setTab] = useState<TabId>('market');
  const [minLevel, setMinLevel] = useState<MinLevel>('Any');
  const [kinds, setKinds] = useState<FundingKind[]>([]);
  const [goals, setGoals] = useState<GoalId[]>([]);
  const [query, setQuery] = useState('');
  const [answers, setAnswers] = useState<Record<string, SustainabilityAnswers | null>>({});

  // Each supplier's checklist answers load once (server → device → seed), the RankingPage
  // pattern; the level filter scores them as they stand today, before any funding.
  useEffect(() => {
    let alive = true;
    Promise.all(sellers.map(async (s) => [s.id, (await loadSustainability(s.id, s.name)).answers] as const))
      .then((entries) => { if (alive) setAnswers(Object.fromEntries(entries)); });
    return () => { alive = false; };
  }, [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useMemo(
    () => state.funding.filter((a) => a.sector === state.sector && LIVE_STATUSES.includes(a.status)),
    [state.funding, state.sector],
  );

  const need = MIN_LEVELS.indexOf(minLevel); // 0 = Any; 1..3 = minimum rung on the ladder
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return live.filter((app) => {
      if (kinds.length > 0 && !app.items.some((it) => kinds.includes(it.kind))) return false;
      if (goals.length > 0 && !goals.some((g) => goalsFor(app).includes(g))) return false;
      if (need > 0) {
        const a = answers[app.sellerId];
        const level = a ? scoreSustainability(a, app.sector).level : 'Not assessed';
        if (LADDER.indexOf(level) < need) return false;
      }
      if (q && !`${app.title} ${app.sellerName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [live, kinds, goals, need, answers, query]);

  const mine = useMemo(
    () => live.filter((app) => app.commitments.some((c) => c.buyerId === 'buyer')),
    [live],
  );

  const toggle = <T,>(list: T[], id: T, set: (v: T[]) => void) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Fund suppliers</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Suppliers apply for capital item by item — machines, green technology, R&amp;D,
          certifications, working capital — and you back exactly the items that serve your
          sustainability goals. Projections are Sangam estimates, not promises; the return is
          the supplier relationship and the sustainability outcome, with receipts.
        </p>
      </div>

      <div className="note">
        <b>Simulated pledges.</b> Commitments on Sangam are simulated pledges for the prototype — no money moves. <Src kind="simulated" />
      </div>

      <div className="card stack" style={{ gap: 14 }}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
          <label className="field">Sector
            <select value={state.sector} onChange={(e) => update((s) => ({ ...s, sector: e.target.value as typeof state.sector }))}>
              {SECTOR_LIST.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field">Minimum sustainability level
            <select value={minLevel} onChange={(e) => setMinLevel(e.target.value as MinLevel)}>
              {MIN_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="field">Search title or seller
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. solar, press" />
          </label>
        </div>

        <div>
          <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Funding kind</div>
          <div className="toggle-row">
            {FUNDING_KINDS.map((k) => (
              <button key={k.id} className={`pill ${kinds.includes(k.id) ? 'on' : ''}`} onClick={() => toggle(kinds, k.id, setKinds)}>{k.label}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Sustainability goal</div>
          <div className="toggle-row">
            {GOALS.map((g) => (
              <button key={g.id} className={`pill ${goals.includes(g.id) ? 'on' : ''}`} onClick={() => toggle(goals, g.id, setGoals)}>{g.label}</button>
            ))}
          </div>
        </div>

        <div className="tiny muted">
          The level filter reads each supplier's sustainability checklist as it stands today — demo answers, before any funding. <Src kind="simulated" />
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'market' as TabId, label: 'Marketplace', hint: `${filtered.length}` },
          { id: 'mine' as TabId, label: 'My commitments', hint: `${mine.length}` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'market' && (
        filtered.length === 0
          ? <div className="empty">No funding applications match these filters yet.</div>
          : <div className="stack">{filtered.map((app) => <FundingCard key={app.id} app={app} mode="market" />)}</div>
      )}

      {tab === 'mine' && (
        mine.length === 0
          ? <div className="empty">You have not pledged to anything yet — commit on the Marketplace tab.</div>
          : <div className="stack">{mine.map((app) => <MyCommitments key={app.id} app={app} onOpen={() => setTab('market')} />)}</div>
      )}
    </div>
  );
}

/** One application the demo buyer has pledged to: pledged vs released, per commitment. */
function MyCommitments({ app, onOpen }: { app: FundingApplication; onOpen: () => void }) {
  const { openSupplier } = useUi();
  const rows = app.commitments.filter((c) => c.buyerId === 'buyer');
  const pledged = round2(rows.filter((c) => c.status === 'pledged').reduce((n, c) => n + c.amountLakh, 0));
  const released = round2(rows.filter((c) => c.status === 'released').reduce((n, c) => n + c.amountLakh, 0));

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{app.title}</div>
          <div className="tiny muted">
            <button className="linkish" onClick={() => openSupplier(app.sellerId)}>{app.sellerName}</button>
            {' · '}{app.items.length} item{app.items.length === 1 ? '' : 's'} ·{' '}
            <button className="linkish" onClick={onOpen}>view listing</button>
          </div>
        </div>
        <span className={`chip ${FUNDING_STATUS_CHIP[app.status].cls}`}>{FUNDING_STATUS_CHIP[app.status].label}</span>
      </div>

      <div className="stack" style={{ gap: 8, marginTop: 10 }}>
        {rows.map((c, i) => {
          const labels = app.items.filter((it) => c.itemIds.includes(it.id)).map((it) => it.label);
          return (
            <div key={`${c.committedAt}-${i}`} style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <div className="row small" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <span><b>{formatLakh(c.amountLakh)}</b> <Src kind="simulated" /></span>
                <span className={`chip ${c.status === 'released' ? 'ready' : 'potential'}`}>
                  {c.status === 'released' ? 'Released — impact delivered' : 'Pledged'}
                </span>
              </div>
              <div className="tiny muted">{labels.length > 0 ? labels.join(' · ') : 'Application-level pledge'}</div>
              <div className="tiny muted">Pledged {dateLabel(c.committedAt)}</div>
            </div>
          );
        })}
      </div>

      <div className="row small" style={{ flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
        <span>Pledged {formatLakh(pledged)}</span>
        <span>Released {formatLakh(released)} — impact delivered</span>
        <span className="tiny muted">of {formatLakh(commitTotal(app))} committed by all buyers</span>
      </div>
      <div className="tiny muted" style={{ marginTop: 4 }}>
        Released money means the desk verified the backed work's evidence. No repayment is tracked — this is milestone co-funding, not a loan.
      </div>
    </div>
  );
}
