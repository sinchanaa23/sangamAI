import { useState } from 'react';
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
import SapPage from './buyer/SapPage';
import SellerView from './seller/SellerView';
import OpportunitiesPage from './seller/OpportunitiesPage';
import ConsortiaPage from './seller/ConsortiaPage';
import ProfilePage from './seller/ProfilePage';
import ReviewsPage from './seller/ReviewsPage';
import Diversification from './seller/Diversification';
import VerificationDesk from './ecosystem/VerificationDesk';
import DistrictDashboard from './ecosystem/DistrictDashboard';
import MetricsPage from './ecosystem/MetricsPage';
import DataSourcesPage from './ecosystem/DataSourcesPage';
import SupplierDrawer from './components/SupplierDrawer';
import AskSangam from './components/AskSangam';
import type { Lang } from './seller/i18n';

function Logo() {
  // Two streams meeting: the "sangam" (confluence)
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 4c0 10 12 10 12 18v6" fill="none" stroke="#0f766e" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M28 4c0 10-12 10-12 18" fill="none" stroke="#c2410c" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

interface NavItem { id: string; label: string; count?: number }
interface NavGroup { title: string; items: NavItem[] }

function Shell() {
  const { state, update, dataVersion } = useStore();
  const [workspace, setWorkspace] = useState<Workspace>('buyer');
  const [pages, setPages] = useState<Record<Workspace, string>>({ buyer: 'today', supplier: 'overview', ecosystem: 'verify' });
  const [drawer, setDrawer] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ open: boolean; q?: string }>({ open: false });
  const [acting, setActing] = useState('s13');
  const [lang, setLang] = useState<Lang>('en');
  const page = pages[workspace];
  const go = (w: Workspace, p: string) => { setWorkspace(w); setPages((x) => ({ ...x, [w]: p })); window.scrollTo(0, 0); };
  const actingSeller = sellers.some((s) => s.id === acting) ? acting : sellers[0]?.id ?? '';

  const sector = state.sector;
  const reqs = state.requirements.filter((r) => r.sector === sector);
  const pendingChecks = state.reviews.filter((r) => r.status === 'pending').length
    + state.onboarded.filter((o) => (state.verifications[o.id]?.identity ?? 'pending') === 'pending').length
    + state.projects.flatMap((p) => p.milestones).filter((m) => m.status === 'submitted').length;

  const nav: Record<Workspace, NavGroup[]> = {
    buyer: [
      { title: 'Understand', items: [{ id: 'today', label: 'Supply chain today' }, { id: 'sim', label: 'Simulator' }, { id: 'routes', label: 'Routes' }] },
      { title: 'Design', items: [{ id: 'india', label: 'Indian options' }, { id: 'network', label: 'Future network' }, { id: 'location', label: 'Location planner' }] },
      { title: 'Act', items: [{ id: 'requirements', label: 'Requirements and quotes', count: reqs.filter((r) => r.status === 'open').length }, { id: 'switch', label: 'Switch-over plan' }, { id: 'devel', label: 'Supplier development', count: state.projects.filter((p) => p.sector === sector).length }] },
      { title: 'Set up', items: [{ id: 'setup', label: 'Company and parts' }, { id: 'sap', label: 'SAP integration' }] },
    ],
    supplier: [
      { title: 'Today', items: [{ id: 'overview', label: 'Overview' }, { id: 'opps', label: 'Opportunities and quotes' }, { id: 'consortia', label: 'Consortia' }] },
      { title: 'Grow', items: [{ id: 'projects', label: 'Development projects' }, { id: 'grow', label: 'Future diversification' }] },
      { title: 'Trust', items: [{ id: 'profile', label: 'Profile and documents' }, { id: 'reviews', label: 'Reviews' }] },
    ],
    ecosystem: [
      { title: 'Sangam team', items: [{ id: 'verify', label: 'Verification desk', count: pendingChecks }] },
      { title: 'Clusters and states', items: [{ id: 'districts', label: 'District dashboard' }, { id: 'metrics', label: 'Platform metrics' }] },
      { title: 'About the data', items: [{ id: 'sources', label: 'Data sources' }] },
    ],
  };

  const content: Record<string, ReactNode> = {
    'buyer:today': <SupplyChainPage />, 'buyer:sim': <SimulatorPage />, 'buyer:routes': <RoutesPage />, 'buyer:india': <StepChains />,
    'buyer:network': <NetworkPage />, 'buyer:location': <LocationPlanner />, 'buyer:requirements': <RequirementsPage />,
    'buyer:switch': <SwitchoverPage />, 'buyer:devel': <DevelopmentPage role="buyer" />, 'buyer:setup': <SetupPage />, 'buyer:sap': <SapPage />,
    'supplier:overview': <SellerView lang={lang} />, 'supplier:opps': <OpportunitiesPage />, 'supplier:consortia': <ConsortiaPage />,
    'supplier:projects': <DevelopmentPage role="supplier" />, 'supplier:grow': <Diversification seller={sellers.find((s) => s.id === actingSeller)!} lang={lang} />,
    'supplier:profile': <ProfilePage />, 'supplier:reviews': <ReviewsPage />,
    'ecosystem:verify': <VerificationDesk />, 'ecosystem:districts': <DistrictDashboard />, 'ecosystem:metrics': <MetricsPage />, 'ecosystem:sources': <DataSourcesPage />,
  };

  return (
    <UiContext.Provider value={{ openSupplier: setDrawer, go, askSangam: (q) => setAsk({ open: true, q }), actingSeller, setActingSeller: setActing }}>
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span className="brand-name">Sangam</span>
          <span className="brand-tag">Where Indian demand meets Indian capability</span>
        </div>
        <select className="sector-pick" value={sector} aria-label="Sector" onChange={(e) => update((s) => ({ ...s, sector: e.target.value as SectorId }))}>
          {SECTOR_LIST.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="segmented" role="tablist" aria-label="Workspace">
          {(['buyer', 'supplier', 'ecosystem'] as Workspace[]).map((w) => (
            <button key={w} className={workspace === w ? 'on' : ''} onClick={() => setWorkspace(w)}>{{ buyer: 'Buyer', supplier: 'Supplier', ecosystem: 'Ecosystem' }[w]}</button>
          ))}
        </div>
        <button className="btn small" onClick={() => setAsk({ open: true })}>Ask Sangam</button>
      </header>

      <div className="shell">
        <nav className="sidebar" aria-label="Pages">
          {workspace === 'supplier' && (
            <div className="group" style={{ marginBottom: 14 }}>
              <div className="group-title">Acting as</div>
              <select value={actingSeller} onChange={(e) => setActing(e.target.value)} style={{ width: '100%', fontSize: 13 }}>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="segmented" style={{ marginTop: 8 }}>
                <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
                <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिंदी</button>
              </div>
            </div>
          )}
          {nav[workspace].map((g) => (
            <div key={g.title} className="group">
              <div className="group-title">{g.title}</div>
              {g.items.map((it) => (
                <button key={it.id} className={`item ${page === it.id ? 'on' : ''}`} onClick={() => go(workspace, it.id)}>
                  <span>{it.label}</span>
                  {!!it.count && <span className="count">{it.count}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="group" style={{ marginTop: 24 }}>
            <div className="tiny" style={{ margin: '0 8px' }}>Demo companies and figures are labelled <b>Simulated</b>; real data is labelled <b>Public data</b> or <b>Live</b>.</div>
          </div>
        </nav>
        <main key={`${workspace}-${dataVersion}`}>{content[`${workspace}:${page}`]}</main>
      </div>

      {drawer && <SupplierDrawer id={drawer} onClose={() => setDrawer(null)} />}
      {ask.open && <AskSangam initial={ask.q} onClose={() => setAsk({ open: false })} context={{ workspace, page }} />}
    </UiContext.Provider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BuyerProvider>
        <Shell />
      </BuyerProvider>
    </StoreProvider>
  );
}
