// Supplier funding page (plan §3): the supplier applies for capital item-by-item,
// tracks each application from draft through the desk pre-check to the buyer-side
// marketplace, and once an application is funded runs the work through the same
// start → upload evidence → desk-verify lifecycle as DevelopmentPage's milestones.
//
// The core maths and the rules live in src/funding.ts (FUNDING_KINDS, FUNDING_RULES,
// validateApplication, computeProjections, commitTotal, itemCoveredLakh, remainingAsk,
// fundedFlip) - nothing financial is recomputed here. Every mutation goes through the
// store's update() (the source of truth the marketplace and the desk read) and then
// best-effort putServerFunding() so two laptops see the same listings. Every rupee is
// simulated or estimated and tagged; scheme names are display-only pointers into
// src/real/sustainability-refs.json - no invented schemes, no repayment language.
import { useEffect, useMemo, useRef, useState } from 'react';
import { sellers } from '../data';
import { CHECKLIST } from '../sustainability';
import type { SustainabilityAnswers } from '../sustainability';
import { FUNDING_KINDS, FUNDING_RULES, commitTotal, computeProjections, fundedFlip, itemCoveredLakh, remainingAsk, validateApplication } from '../funding';
import type { FundingApplication, FundingItem, FundingKind, FundingProjections, FundingStatus } from '../funding';
import { now, uid } from '../model';
import { putServerFunding } from './funding';
import { loadSustainability } from './sustainability';
import Src from '../components/Src';
import TextReveal from '../components/motion/TextReveal';
import ClickSpark from '../components/motion/ClickSpark';
import DotGrid from '../components/motion/DotGrid';
import Magnetic from '../components/motion/Magnetic';
import ShinyText from '../components/motion/ShinyText';
import { AnimatePresence, motion } from 'motion/react';
import { useUi } from '../ui';
import { useStore } from '../store';
import useScrollReveal from '../components/ScrollReveal';

/** Money on this page is always ₹X.XX L, and always sits next to a Src tag. */
const money = (n: number) => `₹${n.toFixed(2)} L`;

const STATUS_CHIP: Record<FundingStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'plain' },
  submitted: { label: 'Awaiting desk check', cls: 'new' },
  listed: { label: 'Listed on the marketplace', cls: 'potential' },
  funded: { label: 'Funded', cls: 'ready' },
  completed: { label: 'Completed', cls: 'ready' },
};

const ITEM_STATUS: Record<FundingItem['status'], { label: string; cls: string }> = {
  todo: { label: 'Not started', cls: 'plain' },
  doing: { label: 'In progress', cls: 'potential' },
  submitted: { label: 'Evidence submitted', cls: 'new' },
  verified: { label: 'Verified', cls: 'ready' },
};

const kindMeta = (k: FundingKind) => FUNDING_KINDS.find((x) => x.id === k);

/** One projections figure: label, value, and an Estimated tag (the source is always 'estimated'). */
function ProjStat({ label, value, tagged }: { label: string; value: string; tagged: boolean }) {
  return (
    <div>
      <div className="tiny muted">{label}</div>
      <div className="small" style={{ fontWeight: 600 }}>
        {value} {tagged && <Src kind="estimated" />}
      </div>
    </div>
  );
}

/** The live projections row: payback and uplifts, each tagged estimated (plan §2.3). */
function ProjectionsRow({ p }: { p: FundingProjections }) {
  const up = p.sustainabilityUplift;
  return (
    <div className="row" style={{ gap: 18, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <ProjStat label="Total ask" value={money(p.totalAskLakh)} tagged />
      <ProjStat label="Payback" value={p.paybackMonths == null ? '—' : `${p.paybackMonths} mo`} tagged={p.paybackMonths != null} />
      <ProjStat label="5-year ROI" value={p.roi5yrPct == null ? '—' : `${p.roi5yrPct}%`} tagged={p.roi5yrPct != null} />
      <ProjStat label="Capacity uplift" value={p.capacityUpliftPct == null ? '—' : `+${p.capacityUpliftPct}%`} tagged={p.capacityUpliftPct != null} />
      <ProjStat label="Quality uplift" value={p.qualityUpliftPct == null ? '—' : `+${p.qualityUpliftPct}%`} tagged={p.qualityUpliftPct != null} />
      <ProjStat label="Sustainability level" value={up ? `${up.from} → ${up.to} (+${up.points} pts)` : '—'} tagged={!!up} />
      <ProjStat label="Sangam score" value={p.sangamScoreUplift == null ? '—' : `+${p.sangamScoreUplift}`} tagged={p.sangamScoreUplift != null} />
    </div>
  );
}

export default function FundingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef, 'funding');
  const { actingSeller, setActingSeller } = useUi();
  const { state, update } = useStore();
  const sector = state.sector;
  const seller = sellers.find((s) => s.id === actingSeller) ?? sellers[0];

  // the acting seller's checklist answers feed the sustainability-uplift projections
  const [answers, setAnswers] = useState<SustainabilityAnswers | null>(null);
  useEffect(() => {
    if (!seller) return;
    let alive = true;
    loadSustainability(seller.id, seller.name).then(({ answers: a }) => {
      if (alive) setAnswers(a);
    });
    return () => { alive = false; };
  }, [seller?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [draft, setDraft] = useState<FundingApplication | null>(null);
  const [saveMsg, setSaveMsg] = useState('');

  const apps = useMemo(
    () => state.funding.filter((f) => f.sellerId === actingSeller),
    [state.funding, actingSeller],
  );

  const checkItems = useMemo(() => CHECKLIST.filter((it) => !it.sectors || it.sectors.includes(sector)), [sector]);

  /** Refresh an application's projections with the model - never hand-typed (plan §2.1). */
  const withProjections = (app: FundingApplication) =>
    computeProjections(app, { monthlyCapacity: seller.monthlyCapacity, priceIndex: seller.priceIndex }, sector, answers);

  // ---------- persistence: store first (the marketplace reads it), server best-effort ----------

  const saveApp = (app: FundingApplication, msg?: string) => {
    update((s) => ({
      ...s,
      funding: s.funding.some((f) => f.id === app.id) ? s.funding.map((f) => (f.id === app.id ? app : f)) : [...s.funding, app],
    }));
    if (msg) setSaveMsg(msg);
    void putServerFunding(app).then((ok) => {
      if (!ok) setSaveMsg(`${msg ?? 'Changes saved'} on this device - the Sangam server is offline, so it will sync when Sangam is back.`);
    });
  };

  // funded-work tracker: start / upload evidence, then the model re-flips the status
  const patchItem = (app: FundingApplication, itemId: string, patch: Partial<FundingItem>, msg?: string) => {
    const next: FundingApplication = {
      ...app,
      items: app.items.map((it) => (it.id === itemId ? { ...it, ...patch, updatedAt: now() } : it)),
      updatedAt: now(),
    };
    next.status = fundedFlip(next);
    saveApp(next, msg);
  };

  const withdraw = (app: FundingApplication) =>
    saveApp({ ...app, status: 'draft', updatedAt: now() }, 'Application pulled back to draft. Edit it and submit again when it is ready.');

  // ---------- the draft form ----------

  const newDraft = (): FundingApplication => ({
    id: uid(`fund-${sector}`),
    sector,
    sellerId: seller.id,
    sellerName: seller.name,
    title: '',
    purpose: '',
    items: [],
    evidence: [],
    status: 'draft',
    commitments: [],
    projections: withProjections({
      id: '', sector, sellerId: '', sellerName: '', title: '', purpose: '', items: [], evidence: [],
      status: 'draft', commitments: [], createdAt: now(), updatedAt: now(),
      projections: {
        totalAskLakh: 0, paybackMonths: null, roi5yrPct: null, capacityUpliftPct: null,
        qualityUpliftPct: null, sustainabilityUplift: null, sangamScoreUplift: null, source: 'estimated',
      },
    }).projections,
    createdAt: now(),
    updatedAt: now(),
  });

  const blankItem = (): FundingItem => ({
    id: uid('fi'),
    kind: 'machine',
    label: '',
    labelHi: '',
    costLakh: 0,
    months: FUNDING_RULES.defaultMonths.machine,
    purpose: '',
    schemes: kindMeta('machine')?.schemes,
    status: 'todo',
  });

  const editDraft = (fn: (d: FundingApplication) => FundingApplication) => setDraft((d) => (d ? fn(d) : d));
  const editItem = (itemId: string, patch: Partial<FundingItem>) =>
    editDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }));

  // picking a kind pre-fills the execution months and the kind's scheme hints (plan §3);
  // the Hindi label follows too until the supplier types their own wording
  const changeKind = (itemId: string, kind: FundingKind) =>
    editDraft((d) => ({
      ...d,
      items: d.items.map((it) => {
        if (it.id !== itemId) return it;
        const meta = kindMeta(kind);
        return {
          ...it,
          kind,
          months: meta?.defaultMonths ?? it.months,
          schemes: meta?.schemes ?? it.schemes,
          labelHi: it.labelHi === '' || FUNDING_KINDS.some((k) => k.labelHi === it.labelHi) ? meta?.labelHi ?? it.labelHi : it.labelHi,
        };
      }),
    }));

  const addItem = () => editDraft((d) => ({ ...d, items: [...d.items, blankItem()] }));
  const removeItem = (itemId: string) => editDraft((d) => ({ ...d, items: d.items.filter((it) => it.id !== itemId) }));

  const preview = draft ? withProjections(draft) : null;
  const draftCheck = draft ? validateApplication(draft) : null;
  // the model's gate is items + purpose + evidence; a title is the desk's first line of the card
  const ready = !!draft && !!draftCheck?.ok && draft.title.trim().length > 0;

  const saveDraft = () => {
    if (!draft || !draft.title.trim()) return;
    saveApp(withProjections({ ...draft, updatedAt: now() }), 'Draft saved. Buyers see an application once it is submitted and the desk has checked it.');
    setDraft(null);
  };

  const submitDraft = () => {
    if (!draft || !ready) return;
    saveApp(
      { ...withProjections({ ...draft, updatedAt: now() }), status: 'submitted' },
      'Application submitted - the Sangam desk pre-checks it before the marketplace lists it.',
    );
    setDraft(null);
  };

  if (!seller) return null;

  return (
    <div className="stack" ref={rootRef} style={{ position: 'relative' }}>
      <DotGrid color="#346538" dim={0.12} spacing={28} />
      <div>
        <TextReveal as="h1" className="lead" text="Funding" />
        <p className="muted" style={{ marginTop: 6 }}>
          Apply for machines, green technology, R&amp;D or working capital. Buyers see your
          application on the marketplace and can commit to items - every rupee is simulated in
          this prototype.
        </p>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="small">Viewing as</span>
          <select className="sector-pick" value={seller.id} aria-label="Viewing as" onChange={(e) => setActingSeller(e.target.value)}>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Magnetic>
            <ClickSpark>
              <button className="btn primary" onClick={() => setDraft(newDraft())}>Start an application</button>
            </ClickSpark>
          </Magnetic>
          {draft && <button className="btn" onClick={() => setDraft(null)}>Close the form</button>}
          <AnimatePresence>
            {saveMsg && (
              <motion.span
                key={saveMsg}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="small"
              >
                {saveMsg}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="tiny" style={{ margin: 0 }}>
          Commitments on Sangam are simulated pledges for the prototype - no money moves. Scheme
          names are display only; see the sustainability references for what each one really offers.
        </p>
      </div>

      {/* ---------- new / draft application form ---------- */}
      {draft && preview && draftCheck && (
        <div className="card stack" style={{ gap: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>{draft.title.trim() ? `Editing: ${draft.title}` : 'New application'}</div>
          <label className="field">Title
            <input value={draft.title} onChange={(e) => editDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Solar power and testing R&D for export-grade output" />
          </label>
          <label className="field">Purpose - why this work matters (2-3 sentences)
            <textarea value={draft.purpose} onChange={(e) => editDraft((d) => ({ ...d, purpose: e.target.value }))} />
            <span className={`tiny ${draft.purpose.trim().length >= FUNDING_RULES.minPurposeChars ? '' : 'muted'}`}>
              {draft.purpose.trim().length} of {FUNDING_RULES.minPurposeChars} characters
            </span>
          </label>

          <div className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="small" style={{ fontWeight: 600 }}>Items to fund</span>
              <button className="btn small" onClick={addItem}>Add an item</button>
            </div>
            {draft.items.length === 0 && (
              <p className="tiny muted" style={{ margin: 0 }}>
                Add at least one item. Picking a kind pre-fills the execution time and the scheme
                hints for that kind.
              </p>
            )}
            {draft.items.map((it) => (
              <div key={it.id} className="stack" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <label className="field" style={{ flex: '1 1 170px' }}>Kind
                    <select value={it.kind} onChange={(e) => changeKind(it.id, e.target.value as FundingKind)}>
                      {FUNDING_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </select>
                  </label>
                  <label className="field" style={{ flex: '2 1 240px' }}>What the money buys
                    <input value={it.label} onChange={(e) => editItem(it.id, { label: e.target.value })} placeholder="Rooftop solar 15 kW with net meter" />
                  </label>
                  <label className="field" style={{ flex: '0 1 110px' }}>Cost (₹ lakh)
                    <input type="number" min={0} step={0.1} value={it.costLakh} onChange={(e) => editItem(it.id, { costLakh: Math.max(0, Number(e.target.value) || 0) })} />
                  </label>
                  <label className="field" style={{ flex: '0 1 90px' }}>Months
                    <input type="number" min={1} value={it.months} onChange={(e) => editItem(it.id, { months: Math.max(1, Math.round(Number(e.target.value) || 1)) })} />
                  </label>
                </div>
                <label className="field">Why this item (one line)
                  <input value={it.purpose} onChange={(e) => editItem(it.id, { purpose: e.target.value })} placeholder="Daytime power from solar instead of the diesel generator." />
                </label>
                <label className="field">Sustainability checklist item this serves (optional - it shows buyers the level uplift)
                  <select value={it.sustainabilityItemId ?? ''} onChange={(e) => editItem(it.id, { sustainabilityItemId: e.target.value || undefined })}>
                    <option value="">Not linked to the checklist</option>
                    {checkItems.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {(it.schemes ?? []).map((s) => <span key={s} className="chip plain">{s}</span>)}
                  <span className="tiny muted">scheme hints for this kind - names only</span>
                  <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => removeItem(it.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <label className="field">Evidence documents (comma-separated file names)
            <input
              value={draft.evidence.join(', ')}
              onChange={(e) => editDraft((d) => ({ ...d, evidence: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }))}
              placeholder="energy-audit-report.pdf, managing-committee-resolution.pdf"
            />
            <span className="tiny muted">{draft.evidence.length} of {FUNDING_RULES.minEvidence} needed to submit</span>
          </label>

          {draftCheck.problems.length > 0 ? (
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {draftCheck.problems.map((p) => <li key={p} style={{ color: 'var(--danger)' }}>{p}</li>)}
            </ul>
          ) : (
            <p className="small" style={{ margin: 0, color: 'var(--accent)', fontWeight: 600 }}>
              Ready to submit - the desk pre-checks it before the marketplace lists it.
            </p>
          )}

          <div>
            <div className="section-title" style={{ margin: 0 }}>What funding this would do</div>
            <ProjectionsRow p={preview.projections} />
            <p className="tiny muted" style={{ margin: '6px 0 0' }}>
              Estimates update as the items change - the uplift is a model expectation, not a promise.
            </p>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Magnetic>
              <ClickSpark>
                <button className="btn" disabled={!draft.title.trim()} onClick={saveDraft}>Save draft</button>
              </ClickSpark>
            </Magnetic>
            <Magnetic>
              <ClickSpark>
                <button className="btn primary" disabled={!ready} onClick={submitDraft}><ShinyText>Submit to the desk</ShinyText></button>
              </ClickSpark>
            </Magnetic>
          </div>
        </div>
      )}

      {/* ---------- the seller's applications ---------- */}
      {apps.length === 0 && !draft && (
        <div className="empty">
          No applications yet. Start one above - items, a purpose and one evidence document are all the desk needs.
        </div>
      )}

      {apps.map((app) => {
        const committed = commitTotal(app);
        const total = app.projections.totalAskLakh;
        const pct = total > 0 ? Math.min(100, (committed / total) * 100) : 0;
        const tracking = app.status === 'funded' || app.status === 'completed';
        const withdrawable = app.status === 'submitted' || app.status === 'listed';
        return (
          <div key={app.id} className="card stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{app.title}</div>
                <div className="tiny muted">
                  Opened {new Date(app.createdAt).toLocaleDateString('en-IN')} · {app.items.length} item{app.items.length === 1 ? '' : 's'} · {app.evidence.length} evidence document{app.evidence.length === 1 ? '' : 's'}
                </div>
              </div>
              <span className={`chip ${STATUS_CHIP[app.status].cls}`}>{STATUS_CHIP[app.status].label}</span>
            </div>
            <p className="small muted" style={{ margin: 0 }}>{app.purpose}</p>

            <div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <span className="small">{money(committed)} committed by buyers <Src kind="simulated" /></span>
                <span className="small muted">{money(remainingAsk(app))} of {money(total)} still open</span>
              </div>
              <div className="meter" style={{ marginTop: 6 }}>
                <span style={{ width: `${pct}%`, background: 'var(--accent)' }} />
              </div>
            </div>

            <div className="stack" style={{ gap: 10 }}>
              {app.items.map((it) => {
                const covered = itemCoveredLakh(app, it.id);
                const ipct = it.costLakh > 0 ? Math.min(100, (covered / it.costLakh) * 100) : 0;
                const meta = kindMeta(it.kind);
                return (
                  <div key={it.id} className="stack" style={{ gap: 6, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="small" style={{ fontWeight: 500, flex: 1, minWidth: 200 }}>{it.label}</span>
                      <span className="chip plain">{meta?.label ?? it.kind}</span>
                      <span className={`chip ${ITEM_STATUS[it.status].cls}`}>{ITEM_STATUS[it.status].label}</span>
                    </div>
                    {it.labelHi && <div className="tiny muted">{it.labelHi}</div>}
                    <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="small">{money(it.costLakh)} <Src kind="declared" /></span>
                      <span className="tiny muted">{it.months} months once funded</span>
                    </div>
                    {it.purpose && <div className="tiny muted">{it.purpose}</div>}
                    {!!it.schemes?.length && (
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {it.schemes.map((s) => <span key={s} className="chip plain">{s}</span>)}
                      </div>
                    )}
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <div className="meter" style={{ flex: 1 }}>
                        <span style={{ width: `${ipct}%`, background: 'var(--ready)' }} />
                      </div>
                      <span className="tiny muted" style={{ flex: '0 0 auto' }}>{money(covered)} of {money(it.costLakh)} covered</span>
                    </div>
                    {it.evidence && <div className="tiny muted">Evidence: {it.evidence}</div>}

                    {/* funded-work tracker: the DevelopmentPage milestone flow */}
                    {tracking && (
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {it.status === 'todo' && (
                          <button className="btn small" onClick={() => patchItem(app, it.id, { status: 'doing' })}>Start</button>
                        )}
                        {it.status === 'doing' && (
                          <label className="btn small" style={{ display: 'inline-block' }}>
                            Upload evidence
                            <input
                              type="file"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) patchItem(app, it.id, { status: 'submitted', evidence: f.name }, `Evidence "${f.name}" uploaded - the Sangam desk will verify it.`);
                              }}
                            />
                          </label>
                        )}
                        {it.status === 'submitted' && <span className="tiny">Waiting for the Sangam team to verify</span>}
                        {it.status === 'verified' && <span className="tiny">Verified <Src kind="verified" /></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <ProjectionsRow p={app.projections} />

            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {app.status === 'draft' && (
                <button className="btn small" onClick={() => setDraft(app)}>Edit draft</button>
              )}
              {withdrawable && app.commitments.length === 0 && (
                <button className="btn small" onClick={() => withdraw(app)}>Withdraw to draft</button>
              )}
              {withdrawable && app.commitments.length > 0 && (
                <span className="tiny muted">
                  Cannot withdraw: {app.commitments.length} buyer commitment{app.commitments.length === 1 ? ' is' : 's are'} already
                  pledged ({money(committed)} <Src kind="simulated" />). Ask the desk to return the application instead.
                </span>
              )}
              {app.status === 'submitted' && <span className="tiny muted">The desk pre-checks purpose, items and evidence before listing.</span>}
              {app.status === 'funded' && <span className="tiny muted">Fully committed - start the work and upload evidence per item; the desk verifies each one.</span>}
              {app.status === 'completed' && <span className="tiny muted">Every item verified - the commitments behind them are released as impact delivered.</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
