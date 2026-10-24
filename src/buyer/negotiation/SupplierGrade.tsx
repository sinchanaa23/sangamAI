// The Fair Work grade for one supplier, wherever a supplier appears (quotes, chain steps).
import FairWorkBadge from '../../components/FairWorkBadge';
import { useScorecard } from './live';

export default function SupplierGrade({ supplierId }: { supplierId: string }) {
  const score = useScorecard(supplierId);
  if (score === undefined) return null;
  if (!score) return <span className="chip plain" title="No Fair Work Scorecard yet: the supplier has not filled in a workforce profile">Not graded</span>;
  return <FairWorkBadge score={score} showLabel={false} size="sm" />;
}
