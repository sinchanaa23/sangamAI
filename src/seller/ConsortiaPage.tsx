import { useState } from 'react';
import { sellers, unitLabel } from '../data';
import { district, isRural, roadKm } from '../engine';
import { now, uid } from '../model';
import type { Consortium } from '../model';
import { useStore } from '../store';
import { trustScore } from '../trust';
import { useUi } from '../ui';
import { visibleTo } from './visibility';

const STATUS_CLS = { invited: 'potential', accepted: 'ready', declined: 'danger' } as const;

export default function ConsortiaPage() {
  const { state, update } = useStore();
  const { actingSeller, openSupplier, setActingSeller } = useUi();
  const seller = sellers.find((s) => s.id === actingSeller);
  const reqs = seller ? state.requirements.filter((r) => r.sector === state.sector && r.status === 'open' && visibleTo(r, seller)) : [];
  const [reqId, setReqId] = useState(reqs[0]?.id ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  if (!seller) return <div className="empty">Pick a company in the sidebar.</div>;
  const req = reqs.find((r) => r.id === reqId);
  const mine = state.consortia.filter((c) => c.sector === state.sector && c.members.some((m) => m.sellerId === seller.id));
  const candidates = sellers.filter((s) => s.id !== seller.id && s.process === seller.process)
    .map((s) => ({ s, km: roadKm(district(s.districtId), district(seller.districtId)) })).sort((a, b) => a.km - b.km);
  const team = [seller, ...picked.map((id) => sellers.find((s) => s.id === id)!)];
  const cap = team.reduce((t, s) => t + s.monthlyCapacity, 0);

  const create = () => {
    if (!req) return;
    const c: Consortium = {
      id: uid('con'), sector: state.sector, name: `${district(seller.districtId).name} ${seller.process} consortium`, reqId: req.id, lead: seller.id, createdAt: now(),
      members: team.map((s) => ({ sellerId: s.id, sharePct: Math.round((s.monthlyCapacity / cap) * 100), status: s.id === seller.id ? 'accepted' : 'invited' })),
    };
    update((st) => ({ ...st, consortia: [...st.consortia, c] }));
    setPicked([]);
  };
  const respond = (c: Consortium, status: 'accepted' | 'declined') => update((st) => ({
    ...st, consortia: st.consortia.map((x) => (x.id === c.id ? { ...x, members: x.members.map((m) => (m.sellerId === seller.id ? { ...m, status } : m)) } : x)),
  }));

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Consortia</h1>
        <p className="muted" style={{ marginTop: 6 }}>Team up with nearby suppliers to meet volumes none of you can supply alone. The lead company quotes for the group; each member supplies its share.</p>
      </div>

      {mine.length > 0 && mine.map((c) => {
        const r = state.requirements.find((x) => x.id === c.reqId);
        const me = c.members.find((m) => m.sellerId === seller.id)!;
        const total = c.members.filter((m) => m.status !== 'declined').reduce((t, m) => t + (sellers.find((x) => x.id === m.sellerId)?.monthlyCapacity ?? 0), 0);
        return (
          <div key={c.id} className="card stack" style={{ gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{c.name}</div>
                <div className="small muted">For: {r?.title ?? 'requirement'} · {total.toLocaleString('en-IN')} of {r?.monthlyVolume.toLocaleString('en-IN')} {unitLabel()} a month covered · lead: {sellers.find((s) => s.id === c.lead)?.name}</div>
              </div>
              {me.status === 'invited' && <div className="row" style={{ gap: 8 }}><button className="btn small primary" onClick={() => respond(c, 'accepted')}>Accept</button><button className="btn small" onClick={() => respond(c, 'declined')}>Decline</button></div>}
            </div>
            <table>
              <thead><tr><th>Member</th><th className="num">Share</th><th className="num">Trust</th><th>Status</th></tr></thead>
              <tbody>
                {c.members.map((m) => {
                  const s = sellers.find((x) => x.id === m.sellerId);
                  return s ? (
                    <tr key={m.sellerId}>
                      <td><button className="linkish" onClick={() => openSupplier(s.id)}>{s.name}</button> <span className="tiny">{district(s.districtId).name}</span></td>
                      <td className="num">{m.sharePct}%</td>
                      <td className="num">{trustScore(s, state).score}</td>
                      <td><span className={`chip ${STATUS_CLS[m.status]}`}>{m.status}</span>{m.status === 'invited' && m.sellerId !== seller.id && <button className="linkish tiny" style={{ marginLeft: 6 }} onClick={() => setActingSeller(m.sellerId)}>act as them to accept</button>}</td>
                    </tr>
                  ) : null;
                })}
              </tbody>
            </table>
            {c.lead === seller.id && c.members.every((m) => m.status === 'accepted') && <p className="tiny">All members accepted. Submit the group quote from Opportunities and quotes.</p>}
          </div>
        );
      })}

      <div className="card stack" style={{ gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Start a consortium</div>
        {reqs.length === 0 ? <p className="small muted">No open requirements to bid for yet.</p> : (
          <>
            <label className="field">For requirement<select value={reqId} onChange={(e) => setReqId(e.target.value)}>{reqs.map((r) => <option key={r.id} value={r.id}>{r.title} ({r.monthlyVolume.toLocaleString('en-IN')} a month)</option>)}</select></label>
            <div className="small muted">Pick partners (nearest first):</div>
            <div className="stack" style={{ gap: 6 }}>
              {candidates.map(({ s, km }) => (
                <label key={s.id} className="row small" style={{ gap: 8 }}>
                  <input type="checkbox" checked={picked.includes(s.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} />
                  <span><b style={{ fontWeight: 500 }}>{s.name}</b>, {district(s.districtId).name} · {s.monthlyCapacity.toLocaleString('en-IN')} a month · {km} km · trust {trustScore(s, state).score}{isRural(s) ? ` · ${s.type}` : ''}</span>
                </label>
              ))}
            </div>
            {req && <div className={`note ${cap >= req.monthlyVolume ? '' : 'warn'}`}>Together: {cap.toLocaleString('en-IN')} of {req.monthlyVolume.toLocaleString('en-IN')} {unitLabel()} a month{cap >= req.monthlyVolume ? ', enough to quote for the full volume.' : '. Add partners or plan a capacity upgrade.'}</div>}
            <div><button className="btn primary" disabled={!picked.length || !req} onClick={create}>Invite partners</button></div>
          </>
        )}
      </div>
    </div>
  );
}
