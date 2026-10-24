import Src from '../components/Src';
import type { Tag as TagKind } from './engine';

/** Sangam's provenance tag, plus the two kinds the architect adds: an editable assumption and an AI suggestion. */
export default function Tag({ kind, title }: { kind: TagKind; title?: string }) {
  if (kind === 'assumption') return <span className="src ar-src-assumption" title={title ?? 'A default you can edit under Assumptions'}>Assumption</span>;
  if (kind === 'ai') return <span className="src ar-src-ai" title={title ?? 'Suggested by the language model; verify before relying on it'}>AI suggestion</span>;
  return <Src kind={kind} title={title} />;
}
