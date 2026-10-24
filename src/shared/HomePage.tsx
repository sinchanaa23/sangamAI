import { useRef } from 'react';
import type { Workspace } from '../ui';
import Confluence from '../components/Confluence';
import WaveDivider from '../components/WaveDivider';
import { gsap, MOTION_OK, NO_MOTION, ScrollTrigger, SplitText, useGSAP } from '../gsapSetup';

const DOORS: { w: Workspace; page: string; title: string; who: string; does: string; shortcuts?: { page: string; label: string }[] }[] = [
  { w: 'buyer', page: 'today', title: 'I need parts or products', who: 'Manufacturers, builders, food processors, public buyers', does: 'See which inputs depend on one country, get ranked Indian supply chains and a switch-over plan, and let your agent negotiate the order.', shortcuts: [{ page: 'today', label: 'Supply chain today' }, { page: 'india', label: 'Indian options' }, { page: 'network', label: 'Future network' }, { page: 'negotiate', label: 'Agent negotiation' }] },
  { w: 'supplier', page: 'overview', title: 'I make things', who: 'MSMEs, FPOs, SHGs, cooperatives, ODOP clusters', does: 'See pooled demand for what you make, close gaps with scheme support, team up in consortia, and let your agent quote for you.' },
  { w: 'ecosystem', page: 'districts', title: 'I build clusters and check claims', who: 'The Sangam team, districts and states', does: 'See where demand meets local capability, verify suppliers, sign skill and audit credentials, and track SDG 8 impact.' },
];

// One step per river, then the meeting. The scroll animation draws each river as its step comes into view.
const STEPS = [
  { name: 'Buyers', text: 'A company’s demand, broken into parts and process steps, with India’s real imports for each.' },
  { name: 'Producers', text: 'Cooperatives, SHGs and MSMEs with real capacity, marked ready, potential with named gaps, or a true gap, and mapped against each district’s climate, power and freight links.' },
  { name: 'Fair work', text: 'The river you do not see: a living-wage floor for every district and an auditor that no negotiation can pass below.' },
  { name: 'The confluence', text: 'An agent on each side negotiates, the auditor grades wages, hours and safety, and one signed deal carries all three.' },
];

export default function HomePage({ go }: { go: (w: Workspace, page: string) => void }) {
  const stepsRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  // The headline rises in word by word from behind each line, the rest follows; scrolling away lets the hero drift and fade
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      SplitText.create('h1', {
        type: 'lines, words', mask: 'lines', autoSplit: true,
        onSplit: (self) => gsap.from(self.words, { yPercent: 115, duration: 1.15, ease: 'expo.out', stagger: 0.05, delay: 0.1 }),
      });
      gsap.from(['.eyebrow', '.lede', '.home-actions', '.home-meta'], { autoAlpha: 0, y: 18, duration: 0.9, ease: 'expo.out', stagger: 0.08, delay: 0.45 });
      const away = { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.home-hero-text', { yPercent: -14, autoAlpha: 0.2, ease: 'none', scrollTrigger: away });
      gsap.to('.home-hero-art', { y: 90, scale: 0.92, ease: 'none', scrollTrigger: away });
    });
    return () => mm.revert();
  }, { scope: heroRef });

  // Each step lights up as it crosses the middle of the screen (all lit when motion is reduced)
  useGSAP(() => {
    const mm = gsap.matchMedia();
    const items = gsap.utils.toArray<HTMLElement>('li', listRef.current);
    mm.add(MOTION_OK, () => {
      items.forEach((li) => ScrollTrigger.create({ trigger: li, start: 'top 62%', end: 'bottom 62%', toggleClass: { targets: li, className: 'on' } }));
    });
    mm.add(NO_MOTION, () => { items.forEach((li) => li.classList.add('on')); });
    return () => mm.revert();
  }, { scope: stepsRef });

  return (
    <div className="home">
      <section className="home-hero" ref={heroRef}>
        <div className="home-hero-text">
          <div className="eyebrow">आत्मनिर्भर भारत · विकसित भारत</div>
          <h1>Supply chains India can build, with wages people can live on.</h1>
          <p className="lede">
            Sangam means the place where rivers meet. Here, buyers and producers meet, with a third thing running beneath them both: a living wage. An agent on each side negotiates the order, and no contract can pay below the floor.
          </p>
          <div className="home-actions">
            <button className="btn primary" onClick={() => go('buyer', 'negotiate')}>Watch an agent negotiation</button>
            <button className="link-btn" onClick={() => go('ecosystem', 'impact')}>See the SDG 8 impact</button>
          </div>
          <div className="home-meta"><span>Manufacturing</span><span>Construction materials</span><span>Agri and food processing</span></div>
        </div>
        <div className="home-hero-art"><Confluence mode="intro" /></div>
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

      <WaveDivider />

      <section className="home-steps" ref={stepsRef}>
        <div className="home-steps-left">
          <h2>How the rivers meet</h2>
          <p className="home-caption">Like the Triveni Sangam at Prayagraj, where the Ganga and Yamuna meet and the Saraswati is said to join unseen.</p>
          <Confluence mode="scrub" trigger={listRef} className="cf-small" />
        </div>
        <ol ref={listRef}>
          {STEPS.map((s) => <li key={s.name}><div><b>{s.name}</b><span>{s.text}</span></div></li>)}
        </ol>
      </section>

      <WaveDivider />

      <section className="home-sdg">
        <div>
          <h2>The SDG 8 decent-work layer <span className="chip ready">UN SDG 8</span></h2>
          <p>
            Once the chain is designed, agents for the buyer and each supplier negotiate, and no offer may pay below the district&rsquo;s living wage. An Auditor Agent grades wages, hours and safety, Sangam signs the contract and the workers&rsquo; skills, and every deal counts towards jobs, fair pay and rural income.
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
