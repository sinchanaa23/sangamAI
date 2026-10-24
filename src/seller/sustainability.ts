// Loading and saving a supplier's sustainability checklist. P1's route
// (PUT /api/suppliers/:id/sustainability, added in Phase 4) is the source of
// truth once it exists; until then answers are kept on this device, and the
// demo answers in src/seeds.ts (tagged simulated) fill the page so it is never
// empty — the same three-layer pattern as src/seller/workforce.ts.
import { seedSustainabilityFor } from '../seeds';
import type { SustainabilityAnswers } from '../sustainability';

export type SustainabilitySource = 'server' | 'device' | 'seed' | 'blank';

const localKey = (id: string) => `sangam-sustainability-${id}`;

export async function loadSustainability(supplierId: string, supplierName: string): Promise<{ answers: SustainabilityAnswers | null; source: SustainabilitySource }> {
  try {
    const r = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/sustainability`);
    if (r.ok) {
      const j = await r.json();
      if (j && typeof j === 'object' && j.answers) return { answers: j.answers as SustainabilityAnswers, source: 'server' };
    }
  } catch { /* route not mounted yet or server offline */ }
  try {
    const raw = localStorage.getItem(localKey(supplierId));
    if (raw) return { answers: JSON.parse(raw) as SustainabilityAnswers, source: 'device' };
  } catch { /* storage unavailable */ }
  const seed = seedSustainabilityFor(supplierName);
  return seed ? { answers: seed, source: 'seed' } : { answers: null, source: 'blank' };
}

export async function saveSustainability(supplierId: string, answers: SustainabilityAnswers): Promise<'server' | 'device'> {
  try {
    const r = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/sustainability`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    if (r.ok) return 'server';
  } catch { /* fall through to the device copy */ }
  try {
    localStorage.setItem(localKey(supplierId), JSON.stringify(answers));
  } catch { /* storage unavailable: the live page state is still on screen */ }
  return 'device';
}
