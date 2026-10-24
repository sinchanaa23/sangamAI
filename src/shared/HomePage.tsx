import type { Workspace } from '../ui';

const DOORS: { w: Workspace; page: string; title: string; who: string; does: string; shortcuts?: { page: string; label: string }[] }[] = [
  { w: 'buyer', page: 'today', title: 'I need parts or products', who: 'Manufacturers, builders, food processors, public buyers', does: 'See which inputs depend on one country, get ranked Indian supply chains and a switch-over plan, and let your agent negotiate the order.', shortcuts: [{ page: 'today', label: 'Supply chain today' }, { page: 'india', label: 'Indian options' }, { page: 'network', label: 'Future network' }, { page: 'negotiate', label: 'Agent negotiation' }] },
  { w: 'supplier', page: 'overview', title: 'I make things', who: 'MSMEs, FPOs, SHGs, cooperatives, ODOP clusters', does: 'See pooled demand for what you make, close gaps with scheme support, team up in consortia, and let your agent quote for you.' },
  { w: 'ecosystem', page: 'districts', title: 'I build clusters and check claims', who: 'The Sangam team, districts and states', does: 'See where demand meets local capability, verify suppliers, sign skill and audit credentials, and track SDG 8 impact.' },
];

const STEPS = [
  'Break a product into its parts and process steps, with India’s real imports for each.',
  'Mark every input as ready, potential with named gaps, or a true gap.',
  'Overlay climate, terrain, power and freight connectivity for every district.',
  'Score whole chains on cost, lead time, quality, import dependence and rural share, with a phased switch-over plan.',
];

export default function HomePage({ go }: { go: (w: Workspace, page: string) => void }) {
  return (
    <div className="home">
      <section className="home-hero">
        <div className="eyebrow">आत्मनिर्भर भारत · विकसित भारत</div>
        <h1>Supply chains India can build, with wages people can live on.</h1>
        <p className="lede">
          Sangam finds the Indian producers that can replace imported inputs, lets an agent on each side negotiate the order, and blocks any contract that pays below a living wage. Rural clusters grow alongside urban industry.
        </p>
        <div className="home-actions">
          <button className="btn primary" onClick={() => go('buyer', 'negotiate')}>Watch an agent negotiation</button>
          <button className="link-btn" onClick={() => go('ecosystem', 'impact')}>See the SDG 8 impact</button>
        </div>
        <div className="home-meta"><span>Manufacturing</span><span>Construction materials</span><span>Agri and food processing</span></div>
      </section>

      <section className="home-doors" aria-label="Choose where to start">
        {DOORS.map((d, i) => (
          <div key={d.w} className={`door${i === 0 ? ' first' : ''}`}>
            <button className="door-main" onClick={() => go(d.w, d.page)}>
            <div>
              <span className="idx">0{i + 1}</span>
              <h2>{d.title}</h2>
              <div className="who">{d.who}</div>
              <p>{d.does}</p>
            </div>
            <span className="go">Open <span aria-hidden="true">→</span></span>
            </button>
            {d.shortcuts && (
              <ul className="door-links" aria-label="Jump to">
                {d.shortcuts.map((x) => <li key={x.page}><button className="door-link" onClick={() => go(d.w, x.page)}>{x.label}<span aria-hidden="true">→</span></button></li>)}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section className="home-steps">
        <h2>How Sangam designs a chain</h2>
        <ol>{STEPS.map((t) => <li key={t}>{t}</li>)}</ol>
      </section>

      <section className="home-sdg">
        <div>
          <h2>The SDG 8 decent-work layer <span className="chip ready">UN SDG 8</span></h2>
          <p>
            Once the chain is designed, agents for the buyer and each supplier negotiate, and no offer may pay below the district’s living wage. An Auditor Agent grades wages, hours and safety, Sangam signs the contract and the workers’ skills, and every deal counts towards jobs, fair pay and rural income.
          </p>
        </div>
        <div className="acts">
          <button className="btn" onClick={() => go('buyer', 'negotiate')}>Agent negotiation</button>
          <button className="btn" onClick={() => go('ecosystem', 'impact')}>SDG 8 impact</button>
        </div>
      </section>
    </div>
  );
}
