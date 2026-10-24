// Sustainability checklist (plan §2.4): the supplier ticks Yes / Partly / No / N/A per
// checklist item and the 0-100 score plus Bronze-Silver-Gold-Platinum level recompute live
// as they tap - the same live behaviour as the Fair Work grade on the Workforce page.
// Built for a cooperative or MSME manager on a phone: one card per pillar, large tap
// targets, English and Hindi labels side by side. The level is Sangam's own scorecard,
// not a ZED certificate.
import { useEffect, useMemo, useRef, useState } from 'react';
import { sellers } from '../data';
import { PILLARS, CHECKLIST, scoreSustainability, nextSteps } from '../sustainability';
import type { SustainabilityAnswers, AnswerValue } from '../sustainability';
import { seedSustainabilityFor } from '../seeds';
import SustainabilityBadge from '../components/SustainabilityBadge';
import Src from '../components/Src';
import TextReveal from '../components/motion/TextReveal';
import GradientText from '../components/motion/GradientText';
import CountUp from '../components/motion/CountUp';
import SpotlightCard from '../components/motion/SpotlightCard';
import ClickSpark from '../components/motion/ClickSpark';
import DotGrid from '../components/motion/DotGrid';
import Magnetic from '../components/motion/Magnetic';
import ShinyText from '../components/motion/ShinyText';
import { AnimatePresence, motion } from 'motion/react';
import { loadSustainability, saveSustainability } from './sustainability';
import type { SustainabilitySource } from './sustainability';
import { useUi } from '../ui';
import { useStore } from '../store';
import useScrollReveal from '../components/ScrollReveal';

const CHOICES: { value: AnswerValue; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'partly', label: 'Partly' },
  { value: 'no', label: 'No' },
  { value: 'na', label: 'N/A' },
];

export default function SustainabilityPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollReveal(rootRef, 'sustainability');
  const { actingSeller, setActingSeller } = useUi();
  const { state } = useStore();
  const sector = state.sector;
  const seller = sellers.find((s) => s.id === actingSeller) ?? sellers[0];
  const [answers, setAnswers] = useState<SustainabilityAnswers>({});
  const [source, setSource] = useState<SustainabilitySource>('blank');
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // load when the acting seller changes: server, then this device, then demo seed
  useEffect(() => {
    if (!seller) return;
    let alive = true;
    setLoading(true);
    setSaveMsg('');
    loadSustainability(seller.id, seller.name).then(({ answers: a, source: s }) => {
      if (!alive) return;
      setSource(s);
      setAnswers(a ?? {});
      setLoading(false);
    });
    return () => { alive = false; };
  }, [seller?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setAnswer = (id: string, value: AnswerValue) =>
    setAnswers((a) => ({ ...a, [id]: { value, evidence: a[id]?.evidence ?? 'declared' } }));

  // local only: no upload backend yet - the file name is discarded and the item is marked
  // 'document' so the Verification desk (Phase 4) can pick it up
  const attachDocument = (id: string) =>
    setAnswers((a) => ({ ...a, [id]: { value: a[id]?.value ?? 'no', evidence: 'document' } }));

  // live score: recomputed on every tap, sector comes from the store
  const result = useMemo(() => scoreSustainability(answers, sector), [answers, sector]);
  const steps = useMemo(() => nextSteps(answers, sector).slice(0, 4), [answers, sector]);

  const save = async () => {
    if (!seller) return;
    setSaving(true);
    setSaveMsg('');
    const where = await saveSustainability(seller.id, answers);
    setSaving(false);
    setSource(where === 'server' ? 'server' : 'device');
    setSaveMsg(where === 'server'
      ? 'Saved to Sangam - buyers now see this level.'
      : 'Saved on this device (the server is offline); it will sync when Sangam is back.');
  };

  if (!seller) return null;

  return (
    <div className="stack" ref={rootRef} style={{ position: 'relative' }}>
      <DotGrid color="#346538" dim={0.12} spacing={28} />
      <div>
        <TextReveal as="h1" className="lead" text="Sustainability" />
        <p className="muted" style={{ marginTop: 6 }}>
          A 0-100 score across five pillars - energy, materials, water, local sourcing and
          certificates - with levels Bronze to Platinum. This is Sangam's own level, not a ZED certificate.
        </p>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="small">Viewing as</span>
          <select className="sector-pick" value={seller.id} aria-label="Viewing as" onChange={(e) => setActingSeller(e.target.value)}>
            {sellers.map((s) => {
              const seed = s.id === seller.id && answers && Object.keys(answers).length > 0
                ? answers
                : seedSustainabilityFor(s.name);
              const res = seed ? scoreSustainability(seed, sector) : null;
              const label = res ? `${s.name} · ${res.level} (${res.score}/100)` : s.name;
              return <option key={s.id} value={s.id}>{label}</option>;
            })}
          </select>
        </div>
        {source !== 'blank' ? (
          <p className="tiny" style={{ margin: 0 }}>
            {source === 'seed' && <>Demo sustainability answers from the {sector} story, tagged </>}
            {source === 'device' && <>Checklist saved on this device, tagged </>}
            {source === 'server' && <>Checklist from the Sangam server, tagged </>}
            <Src kind={source === 'seed' ? 'simulated' : source === 'server' ? 'verified' : 'declared'} />
          </p>
        ) : (
          <p className="tiny" style={{ margin: 0 }}>Fill the checklist to get your level.</p>
        )}
      </div>

      {/* live score: updates on every tap */}
      <div style={{ position: 'relative' }}>
        <SpotlightCard className="card"><div className="stack" style={{ gap: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>Sustainability score</div>
          {loading ? <p className="muted">…</p> : (
            <>
              <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <SustainabilityBadge result={result} size="md" />
                <span style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
                  <GradientText><CountUp value={result.score} /></GradientText>
                  <span className="muted" style={{ fontSize: 16, fontWeight: 400 }}> / 100</span>
                </span>
                <span className="muted small">The score updates as you tap.</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }} className="small">
                {result.reasons.map((r, i) => <li key={i} style={{ marginBottom: 2 }}>{r}</li>)}
              </ul>
              <div className="stack" style={{ gap: 6 }}>
                {PILLARS.map((p) => (
                  <div key={p.id} className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <span className="small" style={{ flex: '0 0 190px' }}>{p.label}</span>
                    <div className="meter" style={{ flex: 1 }}>
                      <span style={{ width: `${result.pillarScores[p.id]}%`, background: 'var(--accent)' }} />
                    </div>
                    <span className="small" style={{ flex: '0 0 30px', textAlign: 'right' }}>{result.pillarScores[p.id]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div></SpotlightCard>
      </div>

      {/* the checklist: one card per pillar, generous phone-friendly tap targets */}
      <div className="stack" style={{ gap: 14 }}>
        {PILLARS.map((p) => {
          const items = CHECKLIST.filter((it) => it.pillar === p.id && (!it.sectors || it.sectors.includes(sector)));
          return (
            <div className="card stack" key={p.id} style={{ gap: 12 }}>
              <div>
                <div className="section-title" style={{ margin: 0 }}>{p.label} · {p.weight} pts · SDG {p.sdg}</div>
                <div className="tiny muted">{p.labelHi}</div>
              </div>
              {items.map((item) => (
                <div key={item.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <div className="small" style={{ fontWeight: 500 }}>{item.label}</div>
                  <div className="tiny muted">{item.labelHi}</div>
                  {item.legalGate && (
                    <div className="tiny" style={{ marginTop: 2, color: 'var(--danger)' }}>
                      Legal requirement: anything short of a clear yes caps the level at Bronze.
                    </div>
                  )}
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {CHOICES.map((c) => (
                      <button
                        key={c.value}
                        className={`pill ${answers[item.id]?.value === c.value ? 'on' : ''}`}
                        style={{ padding: '10px 16px', fontSize: 15 }}
                        onClick={() => setAnswer(item.id, c.value)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  {answers[item.id]?.value === 'na' && (
                    <div className="tiny muted" style={{ marginTop: 4 }}>
                      Not applicable: removed from your score; the remaining weights rescale.
                    </div>
                  )}
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                    {answers[item.id]?.evidence === 'verified' ? (
                      <span className="tiny">Verified by the Sangam team <Src kind="verified" /></span>
                    ) : answers[item.id]?.evidence === 'document' ? (
                      <span className="tiny muted">Document attached (verification pending) <Src kind="declared" /></span>
                    ) : (
                      <button className="btn small" onClick={() => attachDocument(item.id)}>Add a document</button>
                    )}
                  </div>
                  {item.schemes && <div className="tiny muted" style={{ marginTop: 4 }}>Help scheme: {item.schemes}</div>}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* next steps: unticked items sorted by points gained */}
      <div className="card stack" style={{ gap: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>Next steps to reach Gold</div>
        {steps.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>Nothing left on this sector's checklist - every item is a yes or not applicable.</p>
        ) : steps.map(({ item, pointsGained }) => (
          <div key={item.id} className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="pill" style={{ flex: '0 0 auto', fontWeight: 600 }}>+{pointsGained} pts</span>
            <span className="small" style={{ flex: 1, minWidth: 180 }}>{item.label}</span>
            {item.schemes && <span className="tiny muted" style={{ flexBasis: '100%' }}>Help scheme: {item.schemes}</span>}
          </div>
        ))}
      </div>

      {/* save row: same three-layer persistence as the workforce page */}
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Magnetic>
            <ClickSpark>
              <button className="btn primary" disabled={saving} onClick={save}>
                <ShinyText>{saving ? 'Saving…' : 'Save checklist'}</ShinyText>
              </button>
            </ClickSpark>
          </Magnetic>
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
          Verified evidence matters: Gold needs 2 items verified by the Sangam team, Platinum needs 4
          including a certificate. A missing Consent to Operate or hazardous-waste authorisation caps the
          level at Bronze whatever the score.
        </p>
      </div>
    </div>
  );
}
