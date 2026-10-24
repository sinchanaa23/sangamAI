import type { Workspace } from '../ui';

const DOORS: { w: Workspace; page: string; title: string; who: string; does: string }[] = [
  { w: 'buyer', page: 'today', title: 'I need parts or products', who: 'Manufacturers, builders, food processors, PSUs', does: 'See which inputs depend on one country, get ranked Indian supply chains and a switch-over roadmap, and let your agent negotiate the order.' },
  { w: 'supplier', page: 'overview', title: 'I make things', who: 'MSMEs, FPOs, SHGs, cooperatives, ODOP clusters', does: 'See pooled demand for what you make, get gap cards linked to schemes, team up in consortia, and let your agent quote for you.' },
  { w: 'ecosystem', page: 'districts', title: 'I build clusters and check claims', who: 'The Sangam team, districts and states', does: 'See where demand meets local capability, verify suppliers, sign skill and audit credentials, and track SDG 8 impact.' },
];

export default function HomePage({ go }: { go: (w: Workspace, page: string) => void }) {
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="card" style={{ background: 'linear-gradient(90deg, #fff1e8, #ffffff 45%, #e8f6ec)', padding: '28px 24px' }}>
        <div className="eyebrow" style={{ color: 'var(--rural)' }}>आत्मनिर्भर भारत · विकसित भारत</div>
        <h1 className="lead" style={{ fontSize: 28, marginTop: 6 }}>Design the Indian supply chain you will need in five years</h1>
        <p style={{ marginTop: 10, maxWidth: 760 }}>
          India is building assembly capacity fast, but the inputs underneath still come from one or two countries. Sangam doesn't just find a replacement supplier after a disruption: it designs the domestic supply chain a company will need, and shows which Indian regions, cooperatives and MSMEs can be developed to deliver it.
        </p>
        <p className="small muted" style={{ marginTop: 8, maxWidth: 760 }}>
          Atmanirbhar Bharat and Viksit Bharat: from an import-dependent India to a self-sufficient one, with rural India growing alongside urban India.
        </p>
        <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <span className="chip plain">Manufacturing</span>
          <span className="chip plain">Construction materials</span>
          <span className="chip plain">Agri and food processing</span>
        </div>
      </div>

      <div className="grid-3">
        {DOORS.map((d) => (
          <button key={d.w} className="card stack" onClick={() => go(d.w, d.page)} style={{ textAlign: 'left', gap: 8, cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
            <div className="section-title" style={{ margin: 0 }}>{d.title}</div>
            <div className="tiny">{d.who}</div>
            <p className="small">{d.does}</p>
            <span className="small" style={{ color: 'var(--accent)', fontWeight: 600 }}>Open →</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="section-title">How Sangam designs a chain</div>
        <ol className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Breaks a product into its parts and process steps, with India's real imports for each.</li>
          <li>Marks every input as ready, potential (with named gaps) or a true gap.</li>
          <li>Overlays climate, terrain, power and freight connectivity for every district.</li>
          <li>Scores whole chains on cost, lead time, quality, import dependence and rural share, with a phased switch-over plan.</li>
        </ol>
      </div>

      <div className="card" style={{ borderLeft: '4px solid var(--ready)' }}>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="section-title" style={{ margin: 0 }}>On top: the SDG 8 decent-work layer</div>
          <span className="chip ready">UN SDG 8</span>
        </div>
        <p className="small" style={{ marginTop: 8 }}>
          Once the chain is designed, AI agents for the buyer and each supplier negotiate the order, and no offer may pay below the district's living wage. An Auditor Agent grades wages, hours and safety, Sangam signs the contract and the workers' skills, and every deal counts towards jobs, fair pay and rural income.
        </p>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn small" onClick={() => go('buyer', 'negotiate')}>Watch an agent negotiation</button>
          <button className="btn small" onClick={() => go('ecosystem', 'impact')}>See SDG 8 impact</button>
        </div>
      </div>
    </div>
  );
}
