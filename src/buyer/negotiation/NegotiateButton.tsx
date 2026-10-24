// Starts the agents on a requirement (POST /api/negotiations) and opens the negotiation room on it.
import { useState } from 'react';
import { buyer } from '../../data';
import type { Requirement } from '../../model';
import { useUi } from '../../ui';
import { useGlobalBuyer } from '../global/settings';
import { openRoom, startNegotiation } from './live';
import type { RfqInput } from './live';

export function rfqFor(req: Requirement, buyerCountry: string): RfqInput {
  return {
    id: `rfq-${req.id}`,
    buyerId: buyer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    buyerCountry,
    part: req.title,
    quantity: req.monthlyVolume,
    needBy: req.startBy,
    budget: { amount: req.targetPrice * req.monthlyVolume, currency: 'INR' },
    verifiedOnly: false,
  };
}

export default function NegotiateButton({ req, supplierIds, label = 'Negotiate with agents', small = true, primary = false }: { req: Requirement; supplierIds: string[]; label?: string; small?: boolean; primary?: boolean }) {
  const { go } = useUi();
  const g = useGlobalBuyer();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const rfq = rfqFor(req, g.country);
      const n = await startNegotiation(rfq, supplierIds);
      openRoom({ id: n.id, rfq: { ...rfq, id: n.rfqId }, mode: n.mode });
      go('buyer', 'negotiate');
    } catch (e) {
      setError(e instanceof Error && !/fetch|Server returned 50/.test(e.message) ? e.message : 'The agent server is not running. Start it with npm run server, or watch the recorded demo in the Negotiation room.');
    } finally { setBusy(false); }
  };

  if (supplierIds.length === 0) return null;
  return (
    <span style={{ display: 'inline-grid', gap: 4 }}>
      <button className={`btn${small ? ' small' : ''}${primary ? ' primary' : ''}`} style={{ visibility: 'visible', opacity: busy ? 0.6 : 1 }} disabled={busy} title={`Buyer and Supplier Agents negotiate with ${supplierIds.length} supplier${supplierIds.length > 1 ? 's' : ''} under the living-wage floor`} onClick={start}>
        {busy ? 'Starting agents…' : label}
      </button>
      {error && <span className="tiny" style={{ color: 'var(--danger)', maxWidth: 320, whiteSpace: 'normal' }}>{error}</span>}
    </span>
  );
}
