import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bom, buyer, sellers, unitLabel } from '../data';
import { district, inr } from '../engine';
import { bidderKey, now, uid } from '../model';
import type { Firmness, Quote, Requirement, Visibility } from '../model';
import { useStore } from '../store';
import { bidderName, bidderSellers, quoteTco } from '../tco';
import { useUi } from '../ui';
import Src from '../components/Src';
import { exportRoute } from '../routes';
import GlobalBuyerPanel from './global/GlobalBuyerPanel';
import { buildPack, downloadPack } from './global/pack';
import { countryOf, fmt, laneFor, useGlobalBuyer } from './global/settings';
import NegotiateButton from './negotiation/NegotiateButton';
import SupplierGrade from './negotiation/SupplierGrade';

export const FIRMNESS: Record<Firmness, { label: string; cls: string; help: string }> = {
  exploring: { label: 'Exploring', cls: 'plain', help: 'Looking at options; no commitment yet' },
  rfq: { label: 'Request for quotes', cls: 'potential', help: 'Inviting formal quotes' },
  committed: { label: 'Committed', cls: 'ready', help: 'Budget approved; will place orders' },
};
export const VISIBILITY: Record<Visibility, string> = { anonymous: 'Anonymous', named: 'Company named', invite: 'Invited suppliers only' };

function NewRequirement({ onDone }: { onDone: () => void }) {
  const { state, update } = useStore();
  const g = useGlobalBuyer();
  const [lineId, setLineId] = useState(bom[0]?.id ?? '');
  const line = bom.find((l) => l.id === lineId)!;
  const [spec, setSpec] = useState(line?.spec ?? '');
  const [volume, setVolume] = useState(buyer.monthlyUnits);
  const [startBy, setStartBy] = useState(new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10));
  const [firmness, setFirmness] = useState<Firmness>('exploring');
  const [target, setTarget] = useState(Math.round((line?.cost ?? 0) * 0.95));
  const [visibility, setVisibility] = useState<Visibility>('anonymous');
  const [invited, setInvited] = useState<string[]>([]);
  const [showTarget, setShowTarget] = useState(state.sharing.showTargetPriceDefault);
  const [exactVolume, setExactVolume] = useState(true);
  const candidates = sellers.filter((s) => s.process === line?.process);

  const pickLine = (id: string) => {
    const l = bom.find((x) => x.id === id)!;
    setLineId(id); setSpec(l.spec); setTarget(Math.round(l.cost * 0.95)); setInvited([]);
  };
  const save = () => {
    const r: Requirement = {
      id: uid('req'), sector: state.sector, lineId, title: line.name, process: line.process, spec, monthlyVolume: volume, startBy, firmness,
      targetPrice: target, visibility, invited: visibility === 'invite' ? invited : [], showTarget, exactVolume, status: 'open', createdAt: now(),
    };
    update((s) => ({ ...s, requirements: [r, ...s.requirements] }));
    onDone();
  };

  return (
    <div className="card stack" style={{ gap: 14 }}>
      <div className="section-title" style={{ margin: 0 }}>Publish a requirement</div>
      <div className="form-grid">
        <label className="field">Part<select value={lineId} onChange={(e) => pickLine(e.target.value)}>{bom.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label className="field">How firm is it<select value={firmness} onChange={(e) => setFirmness(e.target.value as Firmness)}>{(Object.keys(FIRMNESS) as Firmness[]).map((f) => <option key={f} value={f}>{FIRMNESS[f].label}: {FIRMNESS[f].help}</option>)}</select></label>
        <label className="field">Volume ({unitLabel()} a month)<input type="number" min={1} value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></label>
        <label className="field">Needed from<input type="date" value={startBy} onChange={(e) => setStartBy(e.target.value)} /></label>
        <label className="field">Target price per {buyer.unitLabel} (₹)<input type="number" min={0} value={target} onChange={(e) => setTarget(Number(e.target.value))} />{g.currency !== 'INR' && <span className="tiny">About {fmt(target, g)} <Src kind="estimated" title="Converted with the fixed exchange-rate table" /></span>}</label>
        <label className="field">Who can see it<select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>{(Object.keys(VISIBILITY) as Visibility[]).map((v) => <option key={v} value={v}>{VISIBILITY[v]}</option>)}</select></label>
      </div>
      <label className="field">Specification<textarea value={spec} onChange={(e) => setSpec(e.target.value)} /></label>
      {visibility === 'invite' && (
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>Invite suppliers ({line.process})</div>
          <div className="toggle-row">{candidates.map((s) => <button key={s.id} className={`pill ${invited.includes(s.id) ? 'on' : ''}`} onClick={() => setInvited(invited.includes(s.id) ? invited.filter((x) => x !== s.id) : [...invited, s.id])}>{s.name}</button>)}</div>
        </div>
      )}
      <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
        <label className="row small"><input type="checkbox" checked={showTarget} onChange={(e) => setShowTarget(e.target.checked)} /> Show target price to suppliers</label>
        <label className="row small"><input type="checkbox" checked={exactVolume} onChange={(e) => setExactVolume(e.target.checked)} /> Show exact volume (otherwise a range)</label>
      </div>
      <div className="row"><button className="btn primary" disabled={!spec || volume <= 0 || (visibility === 'invite' && invited.length === 0)} onClick={save}>Publish</button><button className="btn" onClick={onDone}>Cancel</button></div>
    </div>
  );
}

function QuoteCompare({ req }: { req: Requirement }) {
  const { state, update } = useStore();
  const { openSupplier, go } = useUi();
  const g = useGlobalBuyer();
  const lane = laneFor(g.country);
  const line = bom.find((l) => l.id === req.lineId);
  const quotes = state.quotes.filter((q) => q.reqId === req.id && q.status !== 'declined');
  if (!quotes.length) return <p className="small muted">No quotes yet. {req.firmness === 'exploring' ? 'Move it to "Request for quotes" to invite formal quotes.' : ''}</p>;
  const routeFor = (q: Quote) => {
    const lead = [...bidderSellers(q.bidder, state)].sort((a, b) => b.share - a.share)[0];
    return lane && lead ? exportRoute(lane, district(lead.seller.districtId), q.unitPrice, line?.weightKg ?? 1, g.dutyPct) : null;
  };
  const rows = quotes.map((q) => { const r = routeFor(q); return { q, t: quoteTco(q, req, state), name: bidderName(q.bidder, state), landed: r ? q.unitPrice + r.costPerUnit : null }; }).sort((a, b) => (a.landed ?? a.t.total) - (b.landed ?? b.t.total));
  const best = rows[0];
  const shown = rows.find((r) => r.q.status === 'awarded') ?? best;
  const shownRoute = routeFor(shown.q);
  const pack = async (q: Quote, kind: 'html' | 'json') => downloadPack(await buildPack(q, req, state, g, routeFor(q)), kind);
  const setStatus = (id: string, status: 'shortlisted' | 'awarded' | 'declined') => update((s) => ({
    ...s,
    quotes: s.quotes.map((q) => (q.id === id ? { ...q, status } : status === 'awarded' && q.reqId === req.id && q.status !== 'declined' ? { ...q, status: 'submitted' } : q)),
    requirements: status === 'awarded' ? s.requirements.map((r) => (r.id === req.id ? { ...r, status: 'awarded', awardedQuoteId: id } : r)) : s.requirements,
  }));
  const chart = rows.map((r) => ({ name: r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name, Price: Math.round(r.t.price), Freight: Math.round(r.t.freight), Tooling: Math.round(r.t.tooling), Quality: Math.round(r.t.quality), Risk: Math.round(r.t.risk) }));

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Bidder</th><th className="num">Quoted</th>{lane ? <th className="num">Landed at {lane.port.replace(/^Port of /, '')}</th> : <th className="num">Total cost</th>}<th className="num">Lead</th><th className="num">MOQ</th><th className="num">Pay</th><th className="num">Trust</th><th /></tr></thead>
          <tbody>
            {rows.map(({ q, t, name }) => (
              <tr key={q.id} className={q.status === 'awarded' ? 'rowsel on' : ''}>
                <td>
                  <div style={{ fontWeight: 500 }}>
                    {q.bidder.kind === 'seller' ? <button className="linkish" onClick={() => openSupplier(q.bidder.id)}>{name}</button> : name}
                    {q === best.q && <> <span className="chip ready">{lane ? 'Lowest landed cost' : 'Lowest total cost'}</span></>}
                  </div>
                  <div className="row" style={{ gap: 6, margin: '4px 0', flexWrap: 'wrap' }}>
                    <span className="tiny">Fair Work</span>
                    {bidderSellers(q.bidder, state).map((m) => <SupplierGrade key={m.seller.id} supplierId={m.seller.id} />)}
                  </div>
                  <div className="tiny">{bidderSellers(q.bidder, state).map((m) => district(m.seller.districtId).name).join(' + ')} · {q.notes || 'No notes'} {q.sample && <Src kind="simulated" />}</div>
                  <div className="tiny"><button className="link-btn" title="Supplier verification, Fair Work Scorecard, credentials and route, as a printable page" onClick={() => pack(q, 'html')}>Due-diligence pack</button> · <button className="link-btn" title="The same pack as JSON" onClick={() => pack(q, 'json')}>JSON</button></div>
                  {!t.capacityOk && <div className="tiny up">Capacity {q.capacity.toLocaleString('en-IN')} is below the {req.monthlyVolume.toLocaleString('en-IN')} needed</div>}
                </td>
                <td className="num">{fmt(q.unitPrice, g)}{g.currency !== 'INR' && <div className="tiny">{inr(q.unitPrice)}</div>}{req.targetPrice > 0 && <div className={`tiny ${q.unitPrice > req.targetPrice ? 'up' : 'down'}`}>{q.unitPrice > req.targetPrice ? '+' : ''}{(((q.unitPrice - req.targetPrice) / req.targetPrice) * 100).toFixed(0)}% vs target</div>}</td>
                {!lane && <td className="num"><b>{inr(t.total)}</b></td>}
                {lane && (() => { const r = routeFor(q); return <td className="num">{r ? <><b>{fmt(q.unitPrice + r.costPerUnit, g)}</b><div className="tiny">{r.days} days <Src kind="estimated" /></div></> : '–'}</td>; })()}
                <td className="num">{q.leadDays} d</td>
                <td className="num">{q.moq.toLocaleString('en-IN')}</td>
                <td className="num">{q.paymentDays} d</td>
                <td className="num">{t.trust}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {q.status === 'awarded' ? <span className="chip ready">Awarded</span> : req.status === 'awarded' ? null : (
                    <>
                      <NegotiateButton req={req} supplierIds={bidderSellers(q.bidder, state).map((m) => m.seller.id)} label="Negotiate" />{' '}
                      <button className="btn small" onClick={() => setStatus(q.id, 'awarded')}>Award</button>{' '}
                      {q.status !== 'shortlisted' && <button className="btn small ghost" onClick={() => setStatus(q.id, 'shortlisted')}>Shortlist</button>}
                      {q.status === 'shortlisted' && <span className="chip plain">Shortlisted</span>}{' '}
                      <button className="btn small ghost" style={{ color: 'var(--danger)' }} onClick={() => setStatus(q.id, 'declined')}>Decline</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ height: 60 + rows.length * 42 }}>
        <ResponsiveContainer>
          <BarChart data={chart} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 10 }}>
            <CartesianGrid stroke="#efeeea" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11, fill: '#6b6a66' }} />
            <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11.5, fill: '#111111' }} />
            <Tooltip formatter={(v: number) => inr(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Price" stackId="a" fill="#3d5a45" isAnimationActive={false} />
            <Bar dataKey="Freight" stackId="a" fill="#5f5e5a" isAnimationActive={false} />
            <Bar dataKey="Tooling" stackId="a" fill="#5b6f8f" isAnimationActive={false} />
            <Bar dataKey="Quality" stackId="a" fill="#956400" isAnimationActive={false} />
            <Bar dataKey="Risk" stackId="a" fill="#9f2f2d" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {shownRoute && (
        <div className="note">
          <b>Export route for {shown.name}:</b> {shownRoute.legs.filter((l) => l.days > 0).map((l) => l.title).join(' → ')}. About {shownRoute.days} days and {fmt(shownRoute.costPerUnit, g)} a {buyer.unitLabel} on top of the price, including {g.dutyPct}% duty <Src kind="estimated" />.
          {countryOf(g.country).onward && <> {countryOf(g.country).onward}.</>}
        </div>
      )}
      <p className="tiny">Total cost per {buyer.unitLabel} = quoted price + inbound freight on the best domestic route + tooling spread over a year&apos;s volume + defect cost (supplier defect rate × 3) + a risk charge of up to 3% that falls as the trust score rises.</p>
      {req.status === 'awarded' && <div className="note">Awarded. <button className="linkish" onClick={() => go('buyer', 'switch')}>Plan the switch-over</button> · after the first orders, review the supplier from their profile.</div>}
    </div>
  );
}

export default function RequirementsPage() {
  const { state, update } = useStore();
  const { openSupplier } = useUi();
  /** Who the agents talk to: suppliers who quoted, else those invited, else every supplier with the process. */
  const negotiationSuppliers = (r: Requirement) => {
    const quoted = state.quotes.filter((q) => q.reqId === r.id && q.status !== 'declined').flatMap((q) => bidderSellers(q.bidder, state).map((m) => m.seller.id));
    if (quoted.length) return [...new Set(quoted)];
    if (r.invited.length) return r.invited;
    return sellers.filter((s) => s.process === r.process).map((s) => s.id);
  };
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const reqs = state.requirements.filter((r) => r.sector === state.sector);
  const setSharing = (k: keyof typeof state.sharing, v: boolean) => update((s) => ({ ...s, sharing: { ...s.sharing, [k]: v } }));

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="lead">Requirements and quotes</h1>
          <p className="muted" style={{ marginTop: 6 }}>Publish what you need now and later. Suppliers see only what you choose to share; you see who looked, who is interested and every quote side by side.</p>
        </div>
        {!creating && <button className="btn primary" onClick={() => setCreating(true)}>Publish a requirement</button>}
      </div>

      <GlobalBuyerPanel />

      {creating && <NewRequirement onDone={() => setCreating(false)} />}

      <details>
        <summary>Confidentiality settings</summary>
        <div className="card stack" style={{ gap: 10 }}>
          <label className="row small"><input type="checkbox" checked={state.sharing.nameToVerifiedOnly} onChange={(e) => setSharing('nameToVerifiedOnly', e.target.checked)} /> Show my company name only to suppliers the Sangam team has verified</label>
          <label className="row small"><input type="checkbox" checked={state.sharing.aggregateDemand} onChange={(e) => setSharing('aggregateDemand', e.target.checked)} /> Include my requirements, anonymised and aggregated, in district and cluster dashboards</label>
          <label className="row small"><input type="checkbox" checked={state.sharing.showTargetPriceDefault} onChange={(e) => setSharing('showTargetPriceDefault', e.target.checked)} /> Show target prices by default on new requirements</label>
          <p className="tiny">Suppliers never see other suppliers&apos; quotes. Anonymous requirements show your sector and state only. Every supplier view is logged below each requirement.</p>
        </div>
      </details>

      {reqs.length === 0 && <div className="empty">No requirements yet.</div>}
      {reqs.map((r) => {
        const interests = state.interests.filter((i) => i.reqId === r.id);
        const quotes = state.quotes.filter((q) => q.reqId === r.id && q.status !== 'declined');
        const views = state.views.filter((v) => v.reqId === r.id);
        const viewers = [...new Set(views.map((v) => v.sellerId))];
        const isOpen = open === r.id;
        return (
          <div key={r.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(isOpen ? null : r.id)}>
              <div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <span className={`chip ${FIRMNESS[r.firmness].cls}`}>{FIRMNESS[r.firmness].label}</span>
                  <span className="chip plain">{VISIBILITY[r.visibility]}</span>
                  {r.status === 'awarded' && <span className="chip ready">Awarded</span>}
                  {r.sample && <Src kind="simulated" title="Sample requirement created for the demo" />}
                </div>
                <div style={{ fontWeight: 600, fontSize: 16, marginTop: 6 }}>{r.title}</div>
                <div className="small muted">{r.monthlyVolume.toLocaleString('en-IN')} {unitLabel()} a month from {r.startBy} · target {inr(r.targetPrice)}{r.showTarget ? ' (shown)' : ' (hidden)'}</div>
              </div>
              <div className="row small muted" style={{ gap: 14 }}>
                <span><b style={{ color: 'var(--ink)' }}>{viewers.length}</b> viewed</span>
                <span><b style={{ color: 'var(--ink)' }}>{interests.length}</b> interested</span>
                <span><b style={{ color: 'var(--ink)' }}>{quotes.length}</b> quotes</span>
                <span>{isOpen ? '▴' : '▾'}</span>
              </div>
            </div>

            {isOpen && (
              <div className="stack" style={{ marginTop: 14, gap: 14 }}>
                <p className="small">{r.spec}</p>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span className="small muted">Stage:</span>
                  {(Object.keys(FIRMNESS) as Firmness[]).map((f) => <button key={f} className={`pill ${r.firmness === f ? 'on' : ''}`} onClick={() => update((s) => ({ ...s, requirements: s.requirements.map((x) => (x.id === r.id ? { ...x, firmness: f } : x)) }))}>{FIRMNESS[f].label}</button>)}
                </div>
                {r.status !== 'awarded' && (
                  <div className="note row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <span>Let a Buyer Agent negotiate this with {negotiationSuppliers(r).length} supplier{negotiationSuppliers(r).length === 1 ? '' : 's'}. No offer below the living wage gets through.</span>
                    <NegotiateButton req={r} supplierIds={negotiationSuppliers(r)} primary />
                  </div>
                )}
                {interests.length > 0 && (
                  <div>
                    <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Interested</div>
                    {interests.map((i) => (
                      <div key={i.id} className="row small" style={{ justifyContent: 'space-between', flexWrap: 'wrap', borderTop: '1px solid var(--line)', padding: '8px 0' }}>
                        <span>{i.bidder.kind === 'seller' ? <button className="linkish" onClick={() => openSupplier(i.bidder.id)}>{bidderName(i.bidder, state)}</button> : bidderName(i.bidder, state)}: <span className="muted">{i.note}</span></span>
                        {!quotes.some((q) => bidderKey(q.bidder) === bidderKey(i.bidder)) && r.firmness === 'exploring' && <button className="btn small" onClick={() => update((s) => ({ ...s, requirements: s.requirements.map((x) => (x.id === r.id ? { ...x, firmness: 'rfq' } : x)) }))}>Ask for quotes</button>}
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Quotes</div>
                  <QuoteCompare req={r} />
                </div>
                <div className="tiny">Viewed by: {viewers.length ? viewers.map((id) => sellers.find((s) => s.id === id)?.name ?? id).join(', ') : 'no suppliers yet'}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
