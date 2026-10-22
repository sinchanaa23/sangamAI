import { bom, certInfo, sellers } from '../data';
import { district, lakh } from '../engine';
import { now } from '../model';
import type { Milestone } from '../model';
import { useStore } from '../store';
import { useUi } from '../ui';
import Slider from '../components/Slider';

const STATUS: Record<Milestone['status'], { label: string; cls: string }> = {
  todo: { label: 'Not started', cls: 'plain' },
  doing: { label: 'In progress', cls: 'potential' },
  submitted: { label: 'Evidence submitted', cls: 'new' },
  verified: { label: 'Verified', cls: 'ready' },
};

const schemesFor = (label: string) => (label.startsWith('Add ') ? ['CGTMSE credit guarantee', 'PMEGP'] : certInfo(label).schemes);

export default function DevelopmentPage({ role }: { role: 'buyer' | 'supplier' }) {
  const { state, update } = useStore();
  const { actingSeller, openSupplier, go } = useUi();
  const projects = state.projects.filter((p) => p.sector === state.sector && (role === 'buyer' || p.sellerId === actingSeller));

  const setMilestone = (pid: string, mid: string, patch: Partial<Milestone>) => update((s) => ({
    ...s,
    projects: s.projects.map((p) => (p.id !== pid ? p : { ...p, milestones: p.milestones.map((m) => (m.id === mid ? { ...m, ...patch, updatedAt: now() } : m)) })),
  }));
  const setShare = (pid: string, v: number) => update((s) => ({ ...s, projects: s.projects.map((p) => (p.id === pid ? { ...p, buyerSharePct: v } : p)) }));

  return (
    <div className="stack">
      <div>
        <h1 className="lead">{role === 'buyer' ? 'Supplier development' : 'Development projects'}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {role === 'buyer'
            ? 'Suppliers you are helping to qualify. Each gap is a milestone; the supplier uploads evidence and the Sangam team verifies it before the switch-over gate opens.'
            : 'Buyers are co-funding these upgrades. Start each step, upload evidence when done, and the Sangam team will verify it.'}
        </p>
      </div>

      {projects.length === 0 && (
        <div className="empty">
          {role === 'buyer'
            ? <>No projects yet. Start one from <button className="linkish" onClick={() => go('buyer', 'india')}>Indian options</button> or <button className="linkish" onClick={() => go('buyer', 'network')}>Future network</button>.</>
            : 'No development projects for this company yet. They appear when a buyer chooses to co-fund your upgrade.'}
        </div>
      )}

      {projects.map((p) => {
        const seller = sellers.find((s) => s.id === p.sellerId);
        const line = bom.find((l) => l.id === p.lineId);
        const total = p.milestones.reduce((t, m) => t + m.costLakh, 0);
        const done = p.milestones.filter((m) => m.status === 'verified').length;
        const pct = p.milestones.length ? done / p.milestones.length : 0;
        return (
          <div key={p.id} className="card stack" style={{ gap: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="eyebrow">{line?.name ?? 'Part'}</div>
                <div style={{ fontWeight: 600, fontSize: 17, marginTop: 4 }}>
                  {seller ? <button className="linkish" onClick={() => openSupplier(seller.id)}>{seller.name}</button> : 'Supplier'}
                  {seller && <span className="small muted">, {district(seller.districtId).name}</span>}
                </div>
                <div className="small muted">{lakh(total)} in total · buyer pays {p.buyerSharePct}% ({lakh((total * p.buyerSharePct) / 100)}), supplier and schemes the rest</div>
              </div>
              <div style={{ minWidth: 180 }}>
                <div className="small" style={{ textAlign: 'right' }}><b>{done}</b> of {p.milestones.length} verified</div>
                <div className="meter" style={{ marginTop: 6 }}><span style={{ width: `${pct * 100}%`, background: 'var(--ready)' }} /></div>
              </div>
            </div>
            {role === 'buyer' && <Slider label="Your co-funding share" value={p.buyerSharePct} min={0} max={100} step={10} format={(v) => `${v}%`} onChange={(v) => setShare(p.id, v)} />}
            <table>
              <thead><tr><th>Milestone</th><th className="num">Cost</th><th className="num">Time</th><th>Status</th><th /></tr></thead>
              <tbody>
                {p.milestones.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.label}</div>
                      <div className="tiny">Support: {schemesFor(m.label).join(' · ')}</div>
                      {m.evidence && <div className="tiny">Evidence: {m.evidence}</div>}
                    </td>
                    <td className="num">{lakh(m.costLakh)}</td>
                    <td className="num">{m.months} mo</td>
                    <td><span className={`chip ${STATUS[m.status].cls}`}>{STATUS[m.status].label}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {role === 'supplier' && m.status === 'todo' && <button className="btn small" onClick={() => setMilestone(p.id, m.id, { status: 'doing' })}>Start</button>}
                      {role === 'supplier' && m.status === 'doing' && (
                        <label className="btn small" style={{ display: 'inline-block' }}>
                          Upload evidence
                          <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setMilestone(p.id, m.id, { status: 'submitted', evidence: f.name }); }} />
                        </label>
                      )}
                      {m.status === 'submitted' && <span className="tiny">Waiting for the Sangam team</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
