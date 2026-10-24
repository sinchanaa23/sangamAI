// The Fair Work grade for one supplier, wherever a supplier appears (quotes, chain steps).
import GradeBadge from './GradeBadge';
import { useScorecard } from './live';

export default function SupplierGrade({ supplierId }: { supplierId: string }) {
  const score = useScorecard(supplierId);
  if (score === undefined) return null;
  if (!score) return <span className="chip plain" title="No Fair Work Scorecard yet: the supplier has not filled in a workforce profile">Not graded</span>;
  return <GradeBadge score={score} />;
}
