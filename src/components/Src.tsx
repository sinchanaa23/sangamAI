import type { Provenance } from '../types';

const LABEL: Record<Provenance, string> = {
  live: 'Live', public: 'Public data', verified: 'Verified', declared: 'Self-declared', estimated: 'Estimate', simulated: 'Simulated',
};
const HELP: Record<Provenance, string> = {
  live: 'Fetched just now from a public API',
  public: 'From a real public dataset (see Data sources)',
  verified: 'Checked by the Sangam team against documents or orders',
  declared: 'Entered by the company itself, not yet checked',
  estimated: 'Sangam model or assumption; adjust where you can',
  simulated: 'Demo data invented for this prototype',
};

/** Small tag saying where a number comes from. */
export default function Src({ kind, title }: { kind: Provenance; title?: string }) {
  return <span className={`src src-${kind}`} title={title ?? HELP[kind]}>{LABEL[kind]}</span>;
}
