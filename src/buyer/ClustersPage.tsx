// F11: skilled-worker clusters on the India map. Clusters and their skills come from the official
// One District One Product list (src/real/clusters.json); suppliers and requirements come from Sangam.
import { useState } from 'react';
import { sellers, unitLabel } from '../data';
import { district } from '../engine';
import type { Requirement } from '../model';
import { useStore } from '../store';
import { checksFor } from '../trust';
import { useUi } from '../ui';
import type { LonLat } from '../routes';
import MapCanvas from '../components/MapCanvas';
import type { MapPoint } from '../components/MapCanvas';
import Src from '../components/Src';
import data from '../real/clusters.json';
import NegotiateButton from './negotiation/NegotiateButton';
import SupplierGrade from './negotiation/SupplierGrade';

type Kind = 'Textile' | 'Handloom' | 'Handicraft' | 'Manufacturing';
interface Ref { source: keyof typeof data.sources; row?: number; note?: string }
interface Cluster { id: string; name: string; district: string; state: string; districtId?: string; moreDistrictIds?: string[]; lat?: number; lon?: number; kind: Kind; skills: string[]; refs: Ref[] }

const CLUSTERS = data.clusters as Cluster[];
const KIND_COLOR: Record<Kind, string> = { Textile: '#a4552c', Handloom: '#5b6f8f', Handicraft: '#956400', Manufacturing: '#3d5a45' };
const KINDS = Object.keys(KIND_COLOR) as Kind[];

const pointOf = (c: Cluster): LonLat => {
  if (c.districtId) { const d = district(c.districtId); return [d.lon, d.lat]; }
  return [c.lon!, c.lat!];
};

function RefLink({ r }: { r: Ref }) {
  const s = data.sources[r.source];
  return (
    <li className="tiny">
      <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>{r.row ? `, row ${r.row}` : ''}{r.note ? `: ${r.note}` : ''} <Src kind="public" />
    </li>
  );
}

export default function ClustersPage() {
  const { state } = useStore();
  const { openSupplier } = useUi();
  const [kinds, setKinds] = useState<Kind[]>(KINDS);
  const [pick, setPick] = useState<string>('hosur-auto');
  const shown = CLUSTERS.filter((c) => kinds.includes(c.kind));
  const sel = CLUSTERS.find((c) => c.id === pick) ?? CLUSTERS[0];

  const suppliersIn = (c: Cluster) => { const ids = [c.districtId, ...(c.moreDistrictIds ?? [])]; return sellers.filter((s) => ids.includes(s.districtId)); };
  const members = suppliersIn(sel)
    .map((s) => ({ s, verified: checksFor(s, state).identity === 'verified' }))
    .sort((a, b) => Number(b.verified) - Number(a.verified));
  const processes = new Set(members.map((m) => m.s.process));
  const openReqs = state.requirements.filter((r) => r.sector === state.sector && r.status === 'open' && processes.has(r.process));
  const supplierIdsFor = (r: Requirement) => members.filter((m) => m.s.process === r.process).map((m) => m.s.id);

  const points: MapPoint[] = shown.map((c) => ({
    id: c.id, at: pointOf(c), color: KIND_COLOR[c.kind], r: c.id === sel.id ? 7 : 5, ring: c.id === sel.id, bold: c.id === sel.id,
    label: c.id === sel.id ? c.name : undefined, hollow: suppliersIn(c).length === 0,
  }));

  return (
    <div className="stack">
      <div>
        <h1 className="lead">Skill clusters</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Districts the government has named for a craft or industry, from weaving towns to engineering hubs. Pick one to see the suppliers Sangam has there, how fairly they pay, and the requirements they could take on.
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="toggle-row" style={{ marginBottom: 12 }}>
            {KINDS.map((k) => (
              <button key={k} className={`pill ${kinds.includes(k) ? 'on' : ''}`} onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: KIND_COLOR[k], marginRight: 6 }} />{k}
              </button>
            ))}
          </div>
          <MapCanvas view="india" lines={[]} points={points} ariaLabel="Skill clusters on the map of India" onPick={setPick} />
          <div className="legend">
            <span><i className="dot" style={{ background: 'var(--ink-3)' }} />Suppliers on Sangam</span>
            <span><i className="dot" style={{ background: '#fff', border: '2px solid var(--ink-3)' }} />None on Sangam yet</span>
          </div>
          <p className="tiny" style={{ marginTop: 8 }}>Clusters and skills from the official One District One Product list <Src kind="public" />. Map points are district locations, approximate.</p>
        </div>

        <div className="stack">
          <div className="card">
            <div className="eyebrow">{sel.kind} · {sel.district}, {sel.state}</div>
            <div className="section-title" style={{ margin: '4px 0 8px', fontSize: 18 }}>{sel.name}</div>
            <div className="toggle-row">{sel.skills.map((s) => <span key={s} className="chip plain">{s}</span>)}</div>
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>{sel.refs.map((r, i) => <RefLink key={i} r={r} />)}</ul>
          </div>

          <div className="card">
            <div className="section-title">Suppliers on Sangam here</div>
            {members.length === 0 ? (
              <div className="tiny">None in this sector yet. Clusters like this are where Sangam&apos;s onboarding goes next.</div>
            ) : (
              <div className="stack" style={{ gap: 0 }}>
                {members.map(({ s, verified }) => (
                  <div key={s.id} style={{ display: 'grid', gap: 4, padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                    <button className="linkish" style={{ fontWeight: 500, justifySelf: 'start' }} onClick={() => openSupplier(s.id)}>{s.name}</button>
                    <div className="tiny">{s.type} · {s.process} · {s.workers} workers <Src kind={s.origin === 'simulated' ? 'simulated' : 'declared'} /></div>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <span className={`chip ${verified ? 'ready' : 'potential'}`}>{verified ? 'Verified' : 'Not yet verified'}</span>
                      <SupplierGrade supplierId={s.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title">Open requirements they could take</div>
            {openReqs.length === 0 ? <div className="tiny">No open requirements for these skills right now.</div> : (
              <div className="stack" style={{ gap: 10 }}>
                {openReqs.map((r) => (
                  <div key={r.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{r.title}</div>
                      <div className="tiny">{r.monthlyVolume.toLocaleString('en-IN')} {unitLabel()} a month from {r.startBy} {r.sample && <Src kind="simulated" />}</div>
                    </div>
                    <NegotiateButton req={r} supplierIds={supplierIdsFor(r)} label="Negotiate with these suppliers" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">All clusters</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cluster</th><th>District</th><th>Skills</th><th className="num">On Sangam</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className={`rowsel ${c.id === sel.id ? 'on' : ''}`} onClick={() => setPick(c.id)}>
                  <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: KIND_COLOR[c.kind], marginRight: 8 }} />{c.name}</td>
                  <td className="small">{c.district}, {c.state}</td>
                  <td className="small">{c.skills.join(', ')}</td>
                  <td className="num">{suppliersIn(c).length || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny" style={{ marginTop: 8 }}>&ldquo;On Sangam&rdquo; counts suppliers in the sector picked at the top of the page.</p>
      </div>
    </div>
  );
}
