import type { Workspace } from '../ui';

const DOORS: { w: Workspace; page: string; title: string; who: string; does: string }[] = [
  { w: 'buyer', page: 'today', title: 'I need parts or products', who: 'Indian and global buyers', does: 'See what you import today, find verified Indian suppliers and rural clusters, and let your agent negotiate a fair deal.' },
  { w: 'supplier', page: 'overview', title: 'I make things', who: 'MSMEs, cooperatives, FPOs, SHG federations', does: 'Find buyers, team up with nearby suppliers, show your workforce and fair pay, and let your agent quote for you.' },
  { w: 'ecosystem', page: 'impact', title: 'I check and measure', who: 'The Sangam team, districts and states', does: 'Verify claims, sign skill and audit credentials, hear workers, and track SDG 8 impact by district.' },
];

export default function HomePage({ go }: { go: (w: Workspace, page: string) => void }) {
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="card" style={{ background: 'linear-gradient(90deg, #fff1e8, #ffffff 45%, #e8f6ec)', padding: '28px 24px' }}>
        <div className="eyebrow" style={{ color: 'var(--rural)' }}>आत्मनिर्भर भारत · विकसित भारत</div>
        <h1 className="lead" style={{ fontSize: 28, marginTop: 6 }}>Atmanirbhar Bharat, Viksit Bharat</h1>
        <p style={{ marginTop: 10, maxWidth: 720 }}>
          From an import-dependent India to a self-sufficient one, with rural India growing alongside urban India. Sangam connects skilled workers and suppliers in India's districts with buyers at home and abroad, at fair wages and in decent conditions.
        </p>
        <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <span className="chip plain">UN SDG 8: Decent work and economic growth</span>
          <span className="chip rural">Rural clusters first</span>
          <span className="chip ready">Fair wage floor in every deal</span>
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
        <div className="section-title">How a deal works</div>
        <ol className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>A buyer's agent turns a need into a request and finds verified Indian suppliers.</li>
          <li>Each supplier's agent quotes from real capacity and never below the district's living wage.</li>
          <li>The agents negotiate; the Auditor Agent checks wages, hours and safety on the winning offer.</li>
          <li>Sangam signs the contract and the workers' skill records, and the SDG 8 dashboard updates.</li>
        </ol>
      </div>
    </div>
  );
}
