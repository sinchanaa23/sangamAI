import { Fragment, useState } from 'react';
import { buyer, sellers } from '../data';
import { district, isRural, leadDaysFrom, roadKm } from '../engine';
import { METRICS } from '../realdata';
import { useStore } from '../store';
import { checksFor, fieldSource, trustScore } from '../trust';
import Src from './Src';
import Stars from './Stars';
import ReviewForm from './ReviewForm';

const CHECK_LABEL = { verified: 'Verified', pending: 'Not yet checked', rejected: 'Rejected' } as const;

export default function SupplierDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { state } = useStore();
  const [writing, setWriting] = useState(false);
  const s = sellers.find((x) => x.id === id);
  if (!s) return null;
  const d = district(s.districtId);
  const m = METRICS[s.districtId];
  const plant = district(buyer.plantDistrictId);
  const t = trustScore(s, state);
  const checks = checksFor(s, state);
  const capSrc = fieldSource(s, checks.capacity);
  const perfSrc = s.origin === 'simulated' ? 'simulated' as const : 'declared' as const;
  const free = Math.round(s.monthlyCapacity * (1 - s.details.utilisationPct / 100));
  const onboarded = state.onboarded.find((o) => o.id === s.id);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={s.name}>
        <div className="drawer-head">
          <div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              <span className={`chip ${isRural(s) ? 'rural' : 'plain'}`}>{s.type}</span>
              <span className={`trust-badge trust-${t.band}`}>Trust {t.score} · {t.band}</span>
              {s.origin === 'simulated' ? <Src kind="simulated" title="A demo company invented for the prototype" /> : <Src kind="declared" title="Profile created in the app" />}
            </div>
            <h2 style={{ fontSize: 20, marginTop: 8 }}>{s.name}</h2>
            <div className="small muted">{d.name}, {d.state} · {s.process}</div>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">{'×'}</button>
        </div>

        <div className="drawer-body">
          <p className="small">{s.details.about}</p>

          <div className="card" style={{ padding: 16 }}>
            <div className="section-title" style={{ fontSize: 14 }}>Why the trust score is {t.score}</div>
            <div className="stack" style={{ gap: 10 }}>
              {t.parts.map((p) => (
                <div key={p.label}>
                  <div className="row small" style={{ justifyContent: 'space-between' }}><span>{p.label}</span><b>{p.points}/{p.max}</b></div>
                  <div className="meter" style={{ marginTop: 4 }}><span style={{ width: `${(p.points / p.max) * 100}%`, background: p.points / p.max > 0.66 ? 'var(--ready)' : p.points / p.max > 0.33 ? 'var(--accent)' : 'var(--potential)' }} /></div>
                  <div className="tiny">{p.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="section-title" style={{ fontSize: 14 }}>Capacity and performance</div>
            <div className="kv">
              <span>Monthly capacity</span><span>{s.monthlyCapacity.toLocaleString('en-IN')} <Src kind={capSrc} /></span>
              <span>Capacity in use</span><span>{s.details.utilisationPct}% · {free.toLocaleString('en-IN')} free <Src kind={perfSrc} /></span>
              <span>Defect rate</span><span>{s.details.defectPpm.toLocaleString('en-IN')} ppm <Src kind={perfSrc} /></span>
              <span>On time in full</span><span>{s.details.otifPct}% <Src kind={perfSrc} /></span>
              <span>Completed orders</span><span>{s.details.completedOrders} <Src kind={perfSrc} /></span>
              <span>Workers</span><span>{s.workers}</span>
              <span>Years in business</span><span>{s.details.yearsInBusiness}</span>
              <span>Turnover</span><span>₹{s.details.turnoverCr} Cr <Src kind={perfSrc} /></span>
              <span>Credit rating band</span><span>{s.details.creditBand} <Src kind={perfSrc} /></span>
              <span>Price vs import parity</span><span>{s.priceIndex.toFixed(2)}× <Src kind={perfSrc} /></span>
              <span>Languages</span><span>{s.details.languages.join(', ')}</span>
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="section-title" style={{ fontSize: 14 }}>Certificates</div>
            {s.details.certDetails.length === 0 ? <p className="small muted">No certificates claimed.</p> : (
              <table>
                <thead><tr><th>Certificate</th><th>Expires</th><th>Check</th></tr></thead>
                <tbody>
                  {s.details.certDetails.map((c) => (
                    <tr key={c.name}>
                      <td><div style={{ fontWeight: 500 }}>{c.name}</div><div className="tiny">{c.issuer}</div></td>
                      <td className="small">{c.expires}</td>
                      <td><span className={`chip ${checks.certs[c.name] === 'verified' ? 'ready' : checks.certs[c.name] === 'rejected' ? 'danger' : 'potential'}`}>{CHECK_LABEL[checks.certs[c.name] ?? 'pending']}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {onboarded && onboarded.docs.length > 0 && <p className="tiny" style={{ marginTop: 8 }}>Documents on file: {onboarded.docs.map((x) => x.name).join(', ')}</p>}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="section-title" style={{ fontSize: 14 }}>Machines and processes</div>
            <div className="toggle-row">{s.details.machines.map((x) => <span key={x} className="chip plain">{x}</span>)}</div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="section-title" style={{ fontSize: 14 }}>Location: {d.name}</div>
            <div className="kv">
              <span>Road distance to your plant</span><span>{roadKm(d, plant).toLocaleString('en-IN')} km · about {leadDaysFrom(d.id)} days incl. production</span>
              {m.climate && <><span>Rainfall, 10-year average</span><span>{m.climate.annualRainMm.toLocaleString('en-IN')} mm a year <Src kind="public" /></span></>}
              {m.climate && <><span>Heavy-rain days (IMD 64.5 mm+)</span><span>{m.climate.heavyRainDays} a year <Src kind="public" /></span></>}
              {m.climate && <><span>Days at 40 °C or more</span><span>{m.climate.hotDays} a year <Src kind="public" /></span></>}
              {m.osm && <><span>Industrial areas within 20 km</span><span>{m.osm.industrialAreas} <Src kind="public" /></span></>}
              {m.osm && <><span>Rail stations within 25 km</span><span>{m.osm.railStations} <Src kind="public" /></span></>}
              {m.osm && <><span>Airport within 80 km</span><span>{m.osm.airports > 0 ? 'Yes' : 'No'} <Src kind="public" /></span></>}
              <span>Nearest major port</span><span>{m.nearestPort.name}, about {m.nearestPort.km} km</span>
              <span>Grid reliability</span><span>{Math.round(m.power * 100)}% <Src kind="estimated" /></span>
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="section-title" style={{ fontSize: 14, margin: 0 }}>Reviews from buyers and partners</div>
              {!writing && <button className="btn small" onClick={() => setWriting(true)}>Write a review</button>}
            </div>
            {writing ? (
              <ReviewForm sellerId={s.id} defaultAuthor={buyer.name} onDone={() => setWriting(false)} />
            ) : (
              <>
                {t.reviews.dims && (
                  <div className="kv" style={{ marginBottom: 12 }}>
                    {(Object.entries(t.reviews.dims) as [string, number][]).map(([k, v]) => (<Fragment key={k}><span style={{ textTransform: 'capitalize' }}>{k}</span><span><Stars value={v} /> {v.toFixed(1)}</span></Fragment>))}
                  </div>
                )}
                {t.reviews.verified.length === 0 && <p className="small muted">No verified reviews yet.</p>}
                <div className="stack" style={{ gap: 10 }}>
                  {t.reviews.verified.slice(0, 5).map((r) => (
                    <div key={r.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <span className="small" style={{ fontWeight: 600 }}>{r.author}</span>
                        <span className="tiny"><Stars value={(r.ratings.quality + r.ratings.delivery + r.ratings.communication + r.ratings.compliance) / 4} /> · {r.authorType}</span>
                      </div>
                      <p className="small" style={{ marginTop: 4 }}>{r.text}</p>
                      <div className="tiny">Verified against {r.orderRef} (₹{r.orderValueLakh} lakh) {r.sample && <Src kind="simulated" />}</div>
                    </div>
                  ))}
                </div>
                {t.reviews.pending > 0 && <p className="tiny" style={{ marginTop: 8 }}>{t.reviews.pending} review{t.reviews.pending > 1 ? 's' : ''} waiting for the Sangam team to check the order.</p>}
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
