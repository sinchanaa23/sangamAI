import { bom, buyer } from '../data';
import { baseLineCost, baselineImportShare, district, inr, isImported } from '../engine';

export default function StepToday() {
  const imported = bom.filter(isImported);
  const plant = district(buyer.plantDistrictId);
  return (
    <div className="stack">
      <div className="card">
        <div className="eyebrow">{buyer.name} · {buyer.product}</div>
        <h1 className="lead" style={{ marginTop: 6 }}>
          {baselineImportShare()}% of your harness value comes from a single region.
        </h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {imported.length} of {bom.length} parts are imported from East Asia for the plant in {plant.name}, {plant.state}.
          You build {buyer.monthlyUnits.toLocaleString('en-IN')} harnesses a month at {inr(buyer.unitCost)} each, with {buyer.importLeadDays}-day lead times.
        </p>
      </div>

      <div className="card">
        <div className="section-title">Where each part comes from</div>
        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Part</th>
              <th>Source</th>
              <th className="hide-sm">Share of cost</th>
              <th className="num">Cost per harness</th>
            </tr>
          </thead>
          <tbody>
            {bom.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td><span className={`chip ${isImported(l) ? 'import' : 'ready'}`}>{l.importedFrom}</span></td>
                <td className="hide-sm">
                  <div className="row">
                    <div className="bar"><span style={{ width: `${l.sharePct * 2.5}%` }} /></div>
                    <span className="small muted">{l.sharePct}%</span>
                  </div>
                </td>
                <td className="num">{inr(baseLineCost(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
