import { useState } from 'react';
import BuyerFlow from './buyer/BuyerFlow';
import SellerView from './seller/SellerView';

function Logo() {
  // Two streams meeting: the "sangam" (confluence)
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 4c0 10 12 10 12 18v6" fill="none" stroke="#0f766e" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M28 4c0 10-12 10-12 18" fill="none" stroke="#c2410c" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span className="brand-name">Sangam</span>
          <span className="brand-tag">Where Indian demand meets Indian capability</span>
        </div>
        <div className="segmented" role="tablist" aria-label="Workspace">
          <button className={role === 'buyer' ? 'on' : ''} onClick={() => setRole('buyer')}>Buyer</button>
          <button className={role === 'seller' ? 'on' : ''} onClick={() => setRole('seller')}>Supplier</button>
        </div>
        <span className="sim-badge" title="Companies, capacities, prices and scores are fictional">Simulated data</span>
      </header>
      <main>{role === 'buyer' ? <BuyerFlow /> : <SellerView />}</main>
    </>
  );
}
