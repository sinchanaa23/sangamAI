// A small badge for supplier cards, offers and the negotiation shortlist: the tier, and where it comes from.
// It reuses the provenance tag (Src) so "simulated", "declared" and "verified" look the same everywhere. A vouched account is
// labelled vouched, never verified.
import Src from '../components/Src';
import type { Verification } from './AuthContext';
import { t } from './i18n';
import type { Lang } from './i18n';

export default function VerificationBadge({ v, lang = 'en' }: { v: Pick<Verification, 'tier' | 'provenance' | 'basis' | 'status'>; lang?: Lang }) {
  const s = t(lang);
  const vouched = v.basis === 'vouched';
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }} title={vouched ? `${s.vouched}. ${s.vouchedHelp}` : s.tiers[v.tier]}>
      <span className="pill on" style={{ cursor: 'default' }}>{s.tier} {v.tier}: {vouched && v.tier === 1 ? s.vouched : s.tiers[v.tier]}</span>
      <Src kind={v.provenance} />
      {v.status === 'needs-review' && <span className="tiny muted">{s.results['needs-review']}</span>}
    </span>
  );
}
