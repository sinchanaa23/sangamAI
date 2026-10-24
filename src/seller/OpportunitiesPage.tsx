import { useState } from 'react';
import { bom, buyer, sellers, unitLabel } from '../data';
import { inr, leadDaysFrom, sellerGaps } from '../engine';
import { bidderKey, now, uid } from '../model';
import type { Bidder, Requirement } from '../model';
import { useStore } from '../store';
import { useUi } from '../ui';
import { FIRMNESS } from '../buyer/RequirementsPage';
import { buyerLabel, visibleTo, volumeLabel } from './visibility';
import { useSupplierTheme } from '../components/motion/theme';

function QuoteForm({ req, bidders, onDone }: { req: Requirement; bidders: { b: Bidder; label: string; capacity: number; districtId: string }[]; onDone: () => void }) {
  const { update } = useStore();
  const line = bom.find((l) => l.id === req.lineId);
  const [who, setWho] = useState(0);
  const sel = bidders[who];
  const [price, setPrice] = useState(Math.round(line?.cost ?? req.targetPrice));
  const [moq, setMoq] = useState(Math.round(req.monthlyVolume * 0.2));
  const [lead, setLead] = useState(leadDaysFrom(sel.districtId) + 3);
  const [pay, setPay] = useState(45);
  const [validity, setValidity] = useState(90);
  const [tooling, setTooling] = useState(0);
  const [notes, setNotes] = useState('');
  const submit = () => {
    update((s) => ({
      ...s,
      quotes: [...s.quotes.filter((q) => !(q.reqId === req.id && bidderKey(q.bidder) === bidderKey(sel.b))), {
        id: uid('q'), reqId: req.id, bidder: sel.b, unitPrice: price, moq, leadDays: lead, paymentDays: pay, validityDays: validity,
        toolingLakh: tooling, capacity: sel.capacity, notes, at: now(), status: 'submitted',
      }],
    }));
    onDone();
  };
  return (
    <div className="stack" style={{ gap: 12, marginTop: 10 }}>
      {bidders.length > 1 && (
        <label className="field">Quote as<select value={who} onChange={(e) => setWho(Number(e.target.value))}>{bidders.map((x, i) => <option key={bidderKey(x.b)} value={i}>{x.label}</option>)}</select></label>
      )}
      <div className="form-grid">
        <label className="field">Price per {buyer.unitLabel} (₹)<input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
        <label className="field">Minimum order ({unitLabel()})<input type="number" min={0} value={moq} onChange={(e) => setMoq(Number(e.target.value))} /></label>
        <label className="field">Lead time (days)<input type="number" min={1} value={lead} onChange={(e) => setLead(Number(e.target.value))} /></label>
        <label className="field">Payment terms (days)<input type="number" min={0} value={pay} onChange={(e) => setPay(Number(e.target.value))} /></label>
        <label className="field">Quote valid for (days)<input type="number" min={1} value={validity} onChange={(e) => setValidity(Number(e.target.value))} /></label>
        <label className="field">One-time tooling (₹ lakh)<input type="number" min={0} step={0.5} value={tooling} onChange={(e) => setTooling(Number(e.target.value))} /></label>
      </div>
      <label className="field">Notes (what is included, assumptions)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <p className="tiny">Capacity offered: {sel.capacity.toLocaleString('en-IN')} a month. Buyers compare quotes on total cost, including freight from your location, your defect rate and your trust score.</p>
      <div className="row"><button className="btn primary" disabled={price <= 0} onClick={submit}>Submit quote</button><button className="btn" onClick={onDone}>Cancel</button></div>
    </div>
  );
}

export default function OpportunitiesPage() {
  useSupplierTheme();
  const { state, update } = useStore();
  const { actingSeller, go } = useUi();
  const [open, setOpen] = useState<string | null>(null);
  const [quoting, setQuoting] = useState<string | null>(null);
  const [note, setNote] = useState('We can supply this. Please share drawings and test requirements.');
  const seller = sellers.find((s) => s.id === actingSeller);
  if (!seller) return <div className="empty">Pick a company in the sidebar.</div>;
  const reqs = state.requirements.filter((r) => r.sector === state.sector && r.status !== 'closed' && visibleTo(r, seller));
  const myConsortia = state.consortia.filter((c) => c.lead === seller.id && c.members.every((m) => m.status === 'accepted' || m.sellerId === seller.id));

  const view = (r: Requirement) => {
    setOpen(open === r.id ? null : r.id);
    if (!state.views.some((v) => v.reqId === r.id && v.sellerId === seller.id)) update((s) => ({ ...s, views: [...s.views, { reqId: r.id, sellerId: seller.id, at: now() }] }));
  };
  const interest = (r: Requirement) => update((s) => ({ ...s, interests: [...s.interests, { id: uid('i'), reqId: r.id, bidder: { kind: 'seller', id: seller.id }, note, at: now() }] }));

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Opportunities for {seller.name}</h1>
        <p className="muted" style={{ marginTop: 6 }}>Requirements from buyers that match your process. Buyers see that you looked; your quotes are visible only to that buyer.</p>
      </div>
      {reqs.length === 0 && <div className="empty">No open requirements for {seller.process.toLowerCase()} right now. Check Future diversification for adjacent markets.</div>}
      {reqs.map((r) => {
        const line = bom.find((l) => l.id === r.lineId);
        const gaps = line ? sellerGaps(seller, line, r.monthlyVolume) : [];
        const mine = state.quotes.filter((q) => q.reqId === r.id && (bidderKey(q.bidder) === `seller:${seller.id}` || myConsortia.some((c) => bidderKey(q.bidder) === `consortium:${c.id}`)));
        const interested = state.interests.some((i) => i.reqId === r.id && bidderKey(i.bidder) === `seller:${seller.id}`);
        const consortia = myConsortia.filter((c) => c.reqId === r.id);
        const bidders = [
          { b: { kind: 'seller', id: seller.id } as Bidder, label: `${seller.name} alone`, capacity: seller.monthlyCapacity, districtId: seller.districtId },
          ...consortia.map((c) => ({ b: { kind: 'consortium', id: c.id } as Bidder, label: `${c.name} (consortium)`, capacity: c.members.filter((m) => m.status !== 'declined').reduce((t, m) => t + (sellers.find((x) => x.id === m.sellerId)?.monthlyCapacity ?? 0), 0), districtId: seller.districtId })),
        ];
        const canQuote = r.firmness !== 'exploring' && r.status === 'open';
        return (
          <div key={r.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, cursor: 'pointer' }} onClick={() => view(r)}>
              <div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <span className={`chip ${FIRMNESS[r.firmness].cls}`}>{FIRMNESS[r.firmness].label}</span>
                  {r.status === 'awarded' && <span className="chip plain">Awarded</span>}
                  {gaps.length === 0 ? <span className="chip ready">You qualify</span> : <span className="chip potential">{gaps.length} gap{gaps.length > 1 ? 's' : ''} to close</span>}
                  {mine.length > 0 && <span className="chip new">Quote {mine[0].status}</span>}
                </div>
                <div style={{ fontWeight: 600, fontSize: 16, marginTop: 6 }}>{r.title}</div>
                <div className="small muted">{buyerLabel(r, seller, state)} · {volumeLabel(r)} {unitLabel()} a month from {r.startBy}{r.showTarget ? ` · target ${inr(r.targetPrice)}` : ''}</div>
              </div>
              <span className="small muted">{open === r.id ? '▴' : '▾'}</span>
            </div>
            {open === r.id && (
              <div className="stack" style={{ marginTop: 12, gap: 12 }}>
                <p className="small">{r.spec}</p>
                {line && line.requiredCerts.length > 0 && <p className="small">Certificates required: {line.requiredCerts.join(', ')}</p>}
                {gaps.length > 0 && (
                  <div className="note warn">To supply the full volume you would need: {gaps.map((g) => `${g.label} (₹${g.costLakh} lakh, ${g.months} months)`).join('; ')}. <button className="linkish" onClick={() => go('supplier', 'consortia')}>Team up with others</button></div>
                )}
                {r.status === 'open' && (
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {!interested && <><input value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 220, font: 'inherit', fontSize: 13, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8 }} aria-label="Note to buyer" /><button className="btn small" onClick={() => interest(r)}>Express interest</button></>}
                    {interested && <span className="chip plain">Interest sent</span>}
                    {canQuote && quoting !== r.id && <button className="btn small primary" onClick={() => setQuoting(r.id)}>{mine.length ? 'Revise quote' : 'Submit a quote'}</button>}
                    {!canQuote && <span className="tiny">The buyer is still exploring; quotes open when they move to a request for quotes.</span>}
                  </div>
                )}
                {quoting === r.id && <QuoteForm req={r} bidders={bidders} onDone={() => setQuoting(null)} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
