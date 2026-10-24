import { Fragment, useState } from 'react';
import { bom, buyer, unitLabel } from '../data';
import { baselineImportShare, district, inr, isImported } from '../engine';
import { SOURCES, trade } from '../realdata';
import { useUi } from '../ui';
import Src from '../components/Src';
import TierDiagram from '../components/TierDiagram';

const usdM = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)} billion` : `$${(v / 1e6).toFixed(1)} million`);
const concentration = (hhi: number) => (hhi >= 2500 ? { label: 'Highly concentrated', cls: 'danger' } : hhi >= 1500 ? { label: 'Moderately concentrated', cls: 'potential' } : { label: 'Diversified', cls: 'ready' });
const SUPPLY_CHIP = { strong: 'ready', partial: 'potential', weak: 'danger' } as const;

export default function SupplyChainPage() {
  const { go } = useUi();
  const [open, setOpen] = useState<string | null>(null);
  const plant = district(buyer.plantDistrictId);
  const imported = bom.filter(isImported);
  const weak = bom.flatMap((l) => l.tiers.filter((t) => t.indianSupply === 'weak').map((t) => ({ t, l })));

  return (
    <div className="stack">
      <div className="card">
        <div className="eyebrow">{buyer.name} · {buyer.product} <Src kind="simulated" title="The buyer company is a demo; edit it under Company and parts" /></div>
        <h1 className="lead" style={{ marginTop: 6 }}>{baselineImportShare().toFixed(0)}% of what goes into each {buyer.unitLabel} is imported.</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {imported.length} of {bom.length} parts come from abroad for the plant in {plant.name}, {plant.state}. You make {buyer.monthlyUnits.toLocaleString('en-IN')} {unitLabel()} a month at {inr(buyer.unitCost)} each, with {buyer.importLeadDays}-day import lead times.
        </p>
        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={() => go('buyer', 'setup')}>Edit company and parts</button>
          <button className="btn small ghost" onClick={() => go('buyer', 'sim')}>Test a disruption</button>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Your parts, and India&apos;s real import picture for each</div>
        <p className="small muted" style={{ marginBottom: 12 }}>
          Your sourcing is simulated; the national figures are India&apos;s actual imports for the same product code from UN Comtrade <Src kind="public" />. Click a part for its upstream inputs.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Part</th><th>Your source</th><th className="num">Cost / {buyer.unitLabel}</th><th>India&apos;s imports of this product (real)</th></tr></thead>
            <tbody>
              {bom.map((l) => {
                const t = trade(l.hs);
                const c = t ? concentration(t.hhi) : null;
                return (
                  <Fragment key={l.id}>
                    <tr className="rowsel" onClick={() => setOpen(open === l.id ? null : l.id)}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{l.name} <span className="tiny">{open === l.id ? '▴' : '▾'}</span></div>
                        <div className="tiny">{l.hs ? `HS ${l.hs} · ` : ''}{l.spec}</div>
                      </td>
                      <td><span className={`chip ${isImported(l) ? 'import' : 'ready'}`}>{l.importedFrom}</span></td>
                      <td className="num">{inr(l.cost)}<div className="tiny">{l.sharePct.toFixed(0)}%</div></td>
                      <td style={{ minWidth: 240 }}>
                        {t ? (
                          <>
                            <div className="small"><b>{usdM(t.totalUsd)}</b> in {t.year} · <span className={`chip ${c!.cls}`}>{c!.label}</span></div>
                            <div className="stack" style={{ gap: 3, marginTop: 6 }}>
                              {t.partners.slice(0, 3).map((p) => (
                                <div key={p.code} className="row tiny" style={{ gap: 8 }}>
                                  <span style={{ width: 92, color: 'var(--ink-2)' }}>{p.name.replace('Rep. of Korea', 'South Korea')}</span>
                                  <div className="bar" style={{ width: 90 }}><span style={{ width: `${p.share * 100}%` }} /></div>
                                  <span>{(p.share * 100).toFixed(0)}%</span>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : <span className="tiny">No national data for this item</span>}
                      </td>
                    </tr>
                    {open === l.id && (
                      <tr>
                        <td colSpan={4} style={{ background: '#fbfbfa' }}>
                          <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>What the supplier of this part has to buy</div>
                          <div className="stack" style={{ gap: 8 }}>
                            {l.tiers.map((tier) => {
                              const ts = trade(tier.hs);
                              return (
                                <div key={tier.name} className="row" style={{ alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                                  <span className={`chip ${SUPPLY_CHIP[tier.indianSupply]}`} style={{ minWidth: 112, textAlign: 'center' }}>India: {tier.indianSupply}</span>
                                  <div style={{ flex: 1, minWidth: 200 }}>
                                    <div className="small"><b>{tier.name}</b> · {tier.stage} <Src kind="estimated" title="Supply strength is Sangam's assessment" /></div>
                                    <div className="tiny">{tier.indianRegions}{tier.note ? ` · ${tier.note}` : ''}</div>
                                    {ts && <div className="tiny">India imported {usdM(ts.totalUsd)} in {ts.year}; top origins {ts.partners.slice(0, 3).map((p) => `${p.name} ${(p.share * 100).toFixed(0)}%`).join(', ')} <Src kind="public" /></div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>Concentration uses the Herfindahl-Hirschman index of import shares by country. Source: {SOURCES.comtrade.detail}, fetched {SOURCES.comtrade.fetched}.</p>
      </div>

      <div className="card">
        <div className="section-title">The whole chain, down to raw materials</div>
        <div className="table-wrap"><div style={{ minWidth: 700 }}><TierDiagram /></div></div>
        <div className="legend">
          <span><i style={{ background: '#346538' }} />India can supply well</span>
          <span><i style={{ background: '#956400' }} />Partly</span>
          <span><i style={{ background: '#9f2f2d' }} />Weak: mostly imported</span>
          <span><i style={{ background: '#b4b2ac' }} />Part imported today</span>
        </div>
        {weak.length > 0 && (
          <div className="note warn" style={{ marginTop: 14 }}>
            <b>Gaps below tier 1:</b> {weak.map(({ t, l }) => `${t.name} (for ${l.name.toLowerCase()})`).join('; ')}. Even an all-Indian tier-1 network depends on these imports. They are the long-term Atmanirbhar targets.
          </div>
        )}
      </div>
    </div>
  );
}
