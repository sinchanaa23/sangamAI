import { useEffect, useRef, useState } from 'react';
import { bom, buyer, sellers } from '../data';
import { district } from '../engine';
import { opportunitiesFor } from '../diversify';
import { architectures, horizon } from '../network';
import { evaluateLanes, todayLane } from '../routes';
import { simulateShock } from '../sim';
import { useStore } from '../store';
import { trustScore } from '../trust';
import { useUi } from '../ui';
import type { Workspace } from '../ui';
import { useBuyer } from '../buyer/context';

const SUGGEST: Record<Workspace, string[]> = {
  buyer: ['Why is the recommended chain better than switching now?', 'Which part is riskiest to localise and why?', 'Explain the break-even of the selected network design.', 'What should I do first next quarter?'],
  supplier: ['Which opportunity should we pursue first?', 'What do we need to qualify for the open requirements?', 'Explain our trust score and how to raise it.', 'हमें कौन सी योजनाएँ मदद कर सकती हैं?'],
  ecosystem: ['Which districts have the biggest unmet demand?', 'What checks are pending for the Sangam team?'],
};

const r0 = (n: number) => Math.round(n);

export default function AskSangam({ initial, onClose, context }: { initial?: string; onClose: () => void; context: { workspace: Workspace; page: string } }) {
  const { state } = useStore();
  const { actingSeller } = useUi();
  const b = useBuyer();
  const [msgs, setMsgs] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [q, setQ] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const buildContext = () => {
    const ws = context.workspace;
    const base: Record<string, unknown> = {
      page: `${ws} / ${context.page}`,
      note: 'Companies, capacities and prices are simulated demo data; districts climate/infrastructure, India import statistics and live feeds are real.',
      buyer: { name: buyer.name, product: buyer.product, unit: buyer.unitLabel, plant: district(buyer.plantDistrictId).name, monthlyUnits: buyer.monthlyUnits, unitCostToday: r0(buyer.unitCost) },
      parts: bom.map((l) => ({ name: l.name, costPerUnit: l.cost, from: l.importedFrom, process: l.process, certsNeeded: l.requiredCerts, upstream: l.tiers.map((t) => `${t.name} (India supply ${t.indianSupply})`) })),
    };
    if (ws === 'buyer') {
      const shock = simulateShock(b.scenario);
      const lanes = evaluateLanes(b.scenario, b.risk);
      const archs = architectures(b.scenario, b.weights).map((a) => ({ a, h: horizon(a, b.scenario, 15) }));
      Object.assign(base, {
        scenario: b.scenario,
        shock: { unitCost: r0(shock.unitCost), leadDays: shock.leadDays, stockoutDays: shock.stockoutDays, extraCostPerMonth: r0(shock.extraPerMonth) },
        todayRoute: todayLane().origin,
        routes: lanes.map((l) => ({ from: `${l.lane.origin}, ${l.lane.country}`, status: l.status, days: l.days, worstCaseDays: l.p90, landedCostPerUnit: r0(l.costPerUnit), onTimeProbability: +l.reliability.toFixed(2), agreement: l.lane.agreement ?? null })),
        indianChains: b.chains.map((c) => ({ name: c.name, unitCost: r0(c.unitCost), importSharePct: r0(c.importShare), readyInMonths: c.readyInMonths, ruralSharePct: r0(c.ruralShare), investmentLakh: r0(c.investmentLakh), picks: Object.fromEntries(bom.map((l) => [l.name, c.picks[l.id] ? c.picks[l.id]!.sellers.map((s) => `${s.name} (${district(s.districtId).name}, ${c.picks[l.id]!.status})`).join(' + ') : 'keep importing'])) })),
        selectedChain: b.chain.name,
        networkDesigns15yr: archs.map(({ a, h }) => ({ name: a.name, unitCost: r0(a.unitCost), setupCr: +h.capexCr.toFixed(1), breakEvenYear: h.breakEvenYear, netReturnCr: r0(h.netSavingCr), npvCr: r0(h.npvCr), resilience: a.resilience, ruralSharePct: r0(a.ruralShare), hybridNetCr: r0(h.hybrid.netSavingCr) })),
        requirements: state.requirements.filter((r) => r.sector === state.sector).map((r) => ({ title: r.title, stage: r.firmness, status: r.status, quotes: state.quotes.filter((x) => x.reqId === r.id).length })),
      });
    } else if (ws === 'supplier') {
      const s = sellers.find((x) => x.id === actingSeller);
      if (s) {
        const t = trustScore(s, state);
        Object.assign(base, {
          supplier: { name: s.name, type: s.type, district: district(s.districtId).name, process: s.process, capacity: s.monthlyCapacity, certs: s.certs, defectPpm: s.details.defectPpm, otifPct: s.details.otifPct, trust: { score: t.score, band: t.band, parts: t.parts } },
          openRequirementsForThisProcess: state.requirements.filter((r) => r.sector === state.sector && r.process === s.process && r.status === 'open').map((r) => ({ title: r.title, monthlyVolume: r.monthlyVolume, stage: r.firmness, from: r.startBy })),
          diversification: opportunitiesFor(s).map((o) => ({ name: o.opp.name, fitPct: o.fit, investmentLakh: r0(o.investment.total), profitPerYearLakh: r0(o.profitLakh), paybackYears: o.paybackYears ? +o.paybackYears.toFixed(1) : null, roi5Pct: r0(o.roi5 * 100), needs: [...o.opp.needs, ...o.certsMissing] })),
          developmentProjects: state.projects.filter((p) => p.sellerId === s.id).map((p) => ({ part: p.lineId, milestones: p.milestones.map((m) => `${m.label}: ${m.status}`) })),
        });
      }
    } else {
      Object.assign(base, {
        pendingChecks: { reviews: state.reviews.filter((r) => r.status === 'pending').length, onboarded: state.onboarded.length, milestonesSubmitted: state.projects.flatMap((p) => p.milestones).filter((m) => m.status === 'submitted').length },
        suppliersByProcess: Object.fromEntries([...new Set(sellers.map((s) => s.process))].map((p) => [p, sellers.filter((s) => s.process === p).map((s) => `${s.name} (${district(s.districtId).name}, ${s.monthlyCapacity})`)])),
      });
    }
    return JSON.stringify(base);
  };

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setErr('');
    setBusy(true);
    const history = msgs;
    setMsgs([...history, { role: 'user', content: question }]);
    setQ('');
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, context: buildContext(), history }) });
      const j = await r.json().catch(() => ({ error: `Server returned ${r.status}` }));
      if (!r.ok || j.error) throw new Error(j.error ?? `Error ${r.status}`);
      setMsgs((m) => [...m, { role: 'assistant', content: j.answer }]);
    } catch (e) {
      setErr(String((e as Error).message));
      setMsgs(history);
      setQ(question);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (initial) void ask(initial); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Ask Sangam">
        <div className="drawer-head">
          <div>
            <h2 style={{ fontSize: 19 }}>Ask Sangam</h2>
            <div className="tiny">Explains the numbers on this page in plain language. It never changes them.</div>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">{'×'}</button>
        </div>
        <div className="drawer-body">
          {msgs.length === 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <div className="small muted">Try asking:</div>
              {SUGGEST[context.workspace].map((s) => <button key={s} className="pill" style={{ textAlign: 'left', borderRadius: 10 }} onClick={() => void ask(s)}>{s}</button>)}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'chat-q' : 'chat-a'}>{m.content}</div>
          ))}
          {busy && <div className="chat-a muted">Thinking{'…'}</div>}
          {err && <div className="note warn">{err}</div>}
          <div ref={end} />
          <form className="row" style={{ gap: 8, position: 'sticky', bottom: 0, background: 'var(--bg)', paddingTop: 8 }} onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about this page" style={{ flex: 1, font: 'inherit', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10 }} aria-label="Question" />
            <button className="btn primary" disabled={busy || !q.trim()}>Ask</button>
          </form>
        </div>
      </aside>
    </>
  );
}
