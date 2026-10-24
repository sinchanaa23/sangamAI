import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { sellers } from './data';
import { SECTOR_LIST } from './sectors';
import { StoreProvider, useStore } from './store';
import { UiContext } from './ui';
import type { Workspace } from './ui';
import type { SectorId } from './types';
import { BuyerProvider } from './buyer/context';
import SupplyChainPage from './buyer/SupplyChainPage';
import SimulatorPage from './buyer/SimulatorPage';
import RoutesPage from './buyer/RoutesPage';
import StepChains from './buyer/StepChains';
import NetworkPage from './buyer/NetworkPage';
import LocationPlanner from './buyer/LocationPlanner';
import RequirementsPage from './buyer/RequirementsPage';
import SwitchoverPage from './buyer/SwitchoverPage';
import DevelopmentPage from './shared/DevelopmentPage';
import SetupPage from './buyer/SetupPage';
import IntegrationsPage from './buyer/IntegrationsPage';
import NegotiationRoom from './buyer/NegotiationRoom';
import HomePage from './shared/HomePage';
import SellerView from './seller/SellerView';
import WorkforcePage from './seller/WorkforcePage';
import SustainabilityPage from './seller/SustainabilityPage';
import RankingPage from './buyer/RankingPage';
import OpportunitiesPage from './seller/OpportunitiesPage';
import ConsortiaPage from './seller/ConsortiaPage';
import ProfilePage from './seller/ProfilePage';
import Diversification from './seller/Diversification';
import FundingPage from './seller/FundingPage';
import FundingMarketPage from './buyer/FundingMarketPage';
import { seedSustainabilityFor } from './seeds';
import { scoreSustainability } from './sustainability';
import ArchitectPage from './architect/ArchitectPage';
import ClustersPage from './buyer/ClustersPage';
import ReviewsHub from './reviews/ReviewsHub';
import { AccessProvider, useAccess } from './access/Access';
import SignInPanel from './access/SignInPanel';
import { homeWorkspace, resolvePage, ROLE_LABEL } from './access/roles';
import VerificationBadge from './auth/VerificationBadge';
import './access/access.css';
import SideNav from './nav/SideNav';
import SectionHub from './nav/SectionHub';
import SubNav from './nav/SubNav';
import { groupOf, hubId, isHub } from './nav/catalog';
import type { NavGroup } from './nav/catalog';
import './nav/nav.css';
import VerificationDesk from './ecosystem/VerificationDesk';
import DistrictDashboard from './ecosystem/DistrictDashboard';
import ImpactPage from './ecosystem/ImpactPage';
import PassportPage from './ecosystem/PassportPage';
import VerifyPage from './ecosystem/VerifyPage';
import GrievancePage from './ecosystem/GrievancePage';
import DataSourcesPage from './ecosystem/DataSourcesPage';
import { useLedger } from './ecosystem/ledger';
import SupplierDrawer from './components/SupplierDrawer';
import AskSangam from './components/AskSangam';
import RiverBackdrop from './components/RiverBackdrop';
import NavRiver from './components/NavRiver';
import SmoothScroll from './components/SmoothScroll';
import ScrollProgress from './components/ScrollProgress';
import useScrollReveal from './components/ScrollReveal';
import type { Lang } from './seller/i18n';

function Logo() {
  // Two streams meeting: the "sangam" (confluence)
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 4c0 10 12 10 12 18v6" fill="none" stroke="#111111" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M28 4c0 10-12 10-12 18" fill="none" stroke="#a4552c" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** Pages only a Sangam team account may open. */
const TEAM_ONLY = ['ecosystem:verify', 'ecosystem:districts', 'ecosystem:@team'];


function Shell() {
  const { state, update, dataVersion } = useStore();
  const access = useAccess();
  const signedIn = !!access.role;
  const [notice, setNotice] = useState('');
  const [workspace, setWorkspace] = useState<Workspace>('buyer');
  const [pages, setPages] = useState<Record<Workspace, string>>({ buyer: '@understand', supplier: '@today', ecosystem: '@deal' });
  const [drawer, setDrawer] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ open: boolean; q?: string }>({ open: false });
  const [acting, setActing] = useState('s13');
  const [lang, setLang] = useState<Lang>('en');
  const [home, setHome] = useState(true);
  const ledger = useLedger();
  const showHome = home || !signedIn;
  const page = pages[workspace];
  const pageKey = `${showHome ? 'home' : workspace}:${page}`;
  const mainRef = useRef<HTMLElement>(null);
  // Pages that moved into the Ecosystem still open from old links; a page the account may not open shows a note instead
  const go = (w0: Workspace, p0: string) => {
    const [w, p] = resolvePage(w0, p0);
    if (!access.workspaces.includes(w) || (!access.isTeam && TEAM_ONLY.includes(`${w}:${p}`))) {
      setNotice(signedIn ? `Your ${ROLE_LABEL[access.role!]} account can't open that page.` : 'Sign in as a buyer or a supplier to open that.');
      setHome(true); window.scrollTo(0, 0); return;
    }
    setNotice(''); setHome(false); setWorkspace(w); setPages((x) => ({ ...x, [w]: p })); window.scrollTo(0, 0);
  };
  // Signing in lands on the account's own workspace; signing out returns to the public landing page
  useEffect(() => { setNotice(''); setHome(true); if (access.role) setWorkspace(homeWorkspace(access.role)); }, [access.role]);
  const linkedSeller = access.role === 'supplier' && access.supplierId && sellers.some((s) => s.id === access.supplierId) ? access.supplierId : '';
  const actingSeller = linkedSeller || (sellers.some((s) => s.id === acting) ? acting : sellers[0]?.id ?? '');

  const sector = state.sector;
  const reqs = state.requirements.filter((r) => r.sector === sector);
  const pendingChecks = !access.isTeam ? 0 : state.reviews.filter((r) => r.status === 'pending').length
    + state.onboarded.filter((o) => (state.verifications[o.id]?.identity ?? 'pending') === 'pending').length
    + state.projects.flatMap((p) => p.milestones).filter((m) => m.status === 'submitted').length
    + ledger.flags.filter((f) => f.status === 'open').length + ledger.grievances.filter((g) => g.status === 'open').length;

  const nav: Record<Workspace, NavGroup[]> = {
    buyer: [
      { id: 'understand', title: 'Understand', items: [{ id: 'today', label: 'Supply chain today' }, { id: 'sim', label: 'Simulator' }, { id: 'routes', label: 'Routes' }] },
      { id: 'design', title: 'Design', items: [{ id: 'india', label: 'Indian options' }, { id: 'ranking', label: 'Find suppliers' }, { id: 'network', label: 'Future network' }, { id: 'location', label: 'Location planner' }] },
      { id: 'act', title: 'Act', items: [{ id: 'requirements', label: 'Requirements and quotes', count: reqs.filter((r) => r.status === 'open').length }, { id: 'funding', label: 'Fund suppliers', count: state.funding.filter((f) => f.sector === sector && f.status === 'listed').length }, { id: 'switch', label: 'Switch-over plan' }, { id: 'devel', label: 'Supplier development', count: state.projects.filter((p) => p.sector === sector).length }] },
      { id: 'setup', title: 'Set up', items: [{ id: 'setup', label: 'Company and parts' }, { id: 'integrations', label: 'Integrations' }] },
    ],
    supplier: [
      { id: 'today', title: 'Today', items: [{ id: 'overview', label: 'Overview' }, { id: 'opps', label: 'Opportunities and quotes' }, { id: 'consortia', label: 'Consortia' }] },
      { id: 'grow', title: 'Grow', items: [{ id: 'projects', label: 'Development projects' }, { id: 'funding', label: 'Funding' }, { id: 'grow', label: 'Future diversification' }] },
      { id: 'trust', title: 'Trust', items: [{ id: 'workforce', label: 'Workforce and fair work' }, { id: 'sustainability', label: 'Sustainability' }, { id: 'profile', label: 'Profile and documents' }] },
    ],
    ecosystem: [
      { id: 'deal', title: 'Deal together', items: [{ id: 'negotiate', label: 'Agent negotiation' }, { id: 'reviews', label: 'Reviews' }] },
      { id: 'build', title: 'Build and grow', items: [{ id: 'architect', label: 'AI Supply Chain Architect' }, { id: 'clusters', label: 'Skill clusters' }] },
      { id: 'fair', title: 'Fair work and trust', items: [{ id: 'impact', label: 'SDG 8 impact' }, { id: 'passport', label: 'Skill Passports' }, { id: 'check', label: 'Check a credential' }, { id: 'report', label: 'Report a problem' }] },
      { id: 'data', title: 'About the data', items: [{ id: 'sources', label: 'Data sources' }] },
      ...(access.isTeam ? [{ id: 'team', title: 'Sangam team', items: [{ id: 'verify', label: 'Verification desk', count: pendingChecks }, { id: 'districts', label: 'District dashboard' }] }] : []),
    ],
  };

  const groups: NavGroup[] = nav[workspace];
  const group = groupOf(groups, page);

  useScrollReveal(mainRef, `${pageKey}:${dataVersion}`);

  const content: Record<string, ReactNode> = {
    'buyer:today': <SupplyChainPage />, 'buyer:sim': <SimulatorPage />, 'buyer:routes': <RoutesPage />, 'buyer:india': <StepChains />, 'buyer:ranking': <RankingPage />,
    'buyer:network': <NetworkPage />, 'buyer:location': <LocationPlanner />, 'buyer:requirements': <RequirementsPage />,
    'buyer:switch': <SwitchoverPage />, 'buyer:devel': <DevelopmentPage role="buyer" />, 'buyer:setup': <SetupPage />, 'buyer:integrations': <IntegrationsPage />,
    'buyer:funding': <FundingMarketPage />,
    'supplier:overview': <SellerView lang={lang} />, 'supplier:opps': <OpportunitiesPage />, 'supplier:consortia': <ConsortiaPage />,
    'supplier:projects': <DevelopmentPage role="supplier" />, 'supplier:funding': <FundingPage />, 'supplier:grow': <Diversification seller={sellers.find((s) => s.id === actingSeller)!} lang={lang} />,
    'supplier:workforce': <WorkforcePage />, 'supplier:sustainability': <SustainabilityPage />, 'supplier:profile': <ProfilePage />,
    'ecosystem:negotiate': <NegotiationRoom />, 'ecosystem:reviews': <ReviewsHub />, 'ecosystem:architect': <ArchitectPage />, 'ecosystem:clusters': <ClustersPage />,
    'ecosystem:verify': <VerificationDesk />, 'ecosystem:passport': <PassportPage />, 'ecosystem:check': <VerifyPage />,
    'ecosystem:impact': <ImpactPage />, 'ecosystem:districts': <DistrictDashboard />, 'ecosystem:report': <GrievancePage />, 'ecosystem:sources': <DataSourcesPage />,
  };

  return (
    <UiContext.Provider value={{ openSupplier: setDrawer, go, askSangam: (q) => setAsk({ open: true, q }), actingSeller, setActingSeller: setActing }}>
      <RiverBackdrop where={showHome ? 'home' : workspace} />
      <SmoothScroll pageKey={pageKey} />
      <ScrollProgress pageKey={`${pageKey}:${dataVersion}`} />
      <a className="skip" href="#content">Skip to content</a>
      <header className="topbar">
        <button className="brand" onClick={() => { setHome(true); window.scrollTo(0, 0); }} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }} aria-label="Sangam home">
          <Logo />
          <span className="brand-name">Sangam</span>
          <span className="brand-tag">Atmanirbhar Bharat · Viksit Bharat</span>
        </button>
        <select className="sector-pick" value={sector} aria-label="Sector" onChange={(e) => update((s) => ({ ...s, sector: e.target.value as SectorId }))}>
          {SECTOR_LIST.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {signedIn && (
          <div className="segmented" role="tablist" aria-label="Workspace">
            {access.workspaces.map((w) => (
              <button key={w} className={!showHome && workspace === w ? 'on' : ''} onClick={() => { setNotice(''); setHome(false); setWorkspace(w); }}>{{ buyer: 'Buyer', supplier: 'Supplier', ecosystem: 'Ecosystem' }[w]}</button>
            ))}
          </div>
        )}
        <button className="btn small" onClick={() => setAsk({ open: true })}>Ask Sangam</button>
        {signedIn ? (
          <div className="account-bar">
            <span className="who" title={access.name}>{access.name}</span>
            {access.mode === 'offline' ? <span className="tag-offline" title="Not signed in: the server was not reachable, so this is a demo kept in this browser tab">Offline demo</span>
              : access.verification && <span className="hide-sm"><VerificationBadge v={access.verification} /></span>}
            {access.mode === 'server' && <a className="link-btn small" href="#/account">Account</a>}
            <button className="btn small ghost" onClick={() => void access.signOut()}>Sign out</button>
          </div>
        ) : <a className="btn small primary" href="#sign-in">Sign in</a>}
        <NavRiver pageKey={pageKey} />
      </header>

      <div className={`shell${signedIn ? '' : ' solo'}`}>
        <nav className="sidebar" aria-label="Pages">
          {workspace === 'supplier' && (
            <div className="group" style={{ marginBottom: 14 }}>
              {!linkedSeller && <div className="group-title">Acting as</div>}
              {!linkedSeller && <select value={actingSeller} onChange={(e) => setActing(e.target.value)} style={{ width: '100%', fontSize: 13 }}>
                {sellers.map((s) => {
                  const seed = seedSustainabilityFor(s.name);
                  const res = seed ? scoreSustainability(seed, sector) : null;
                  const label = res ? `${s.name} · ${res.level} (${res.score})` : s.name;
                  return <option key={s.id} value={s.id}>{label}</option>;
                })}
              </select>}
              <div className="segmented" style={{ marginTop: 8 }}>
                <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
                <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिंदी</button>
              </div>
            </div>
          )}
          <SideNav groups={groups} activeGroup={showHome ? undefined : group?.id} page={showHome ? '' : page} onHub={(id) => go(workspace, hubId(id))} onPage={(id) => go(workspace, id)} />
          <div className="group" style={{ marginTop: 24 }}>
            <div className="tiny" style={{ margin: '0 8px' }}>Demo companies and figures are labelled <b>Simulated</b>; real data is labelled <b>Public data</b> or <b>Live</b>.</div>
          </div>
        </nav>
        <main ref={mainRef} id="content" tabIndex={-1} key={`${showHome ? 'home' : workspace}-${dataVersion}`}>
          {showHome ? (
            <>
              {signedIn && notice && <div className="note warn" role="status" style={{ marginBottom: 16 }}>{notice}</div>}
              <HomePage go={go} allowed={signedIn ? access.workspaces : undefined} signIn={signedIn ? undefined : <SignInPanel note={notice} />} />
            </>
          ) : isHub(page) ? (
            <SectionHub workspace={workspace} group={group ?? groups[0]!} onPage={(id) => go(workspace, id)} />
          ) : (
            <>
              {group && <SubNav group={group} page={page} onHub={() => go(workspace, hubId(group.id))} onPage={(id) => go(workspace, id)} />}
              {content[`${workspace}:${page}`]}
            </>
          )}
        </main>
      </div>

      {drawer && <SupplierDrawer id={drawer} onClose={() => setDrawer(null)} />}
      {ask.open && <AskSangam initial={ask.q} onClose={() => setAsk({ open: false })} context={{ workspace, page }} />}
    </UiContext.Provider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AccessProvider>
        <BuyerProvider>
          <Shell />
        </BuyerProvider>
      </AccessProvider>
    </StoreProvider>
  );
}
