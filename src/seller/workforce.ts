// Loading and saving a supplier's workforce profile. P1's route
// (PUT /api/suppliers/:id/workforce, feat/agents) is the source of truth once
// merged; until then the profile is kept on this device, and the demo seeds in
// src/seeds.ts (tagged simulated) fill the page so it is never empty.
// When src/api.ts merges, saveWorkforce/getWorkforce there can replace these —
// the shapes are the same (WorkforceInput from contracts).
import { seedWorkforceFor } from '../seeds';
import type { WorkforceProfile } from '../fairwork';

export type WorkforceSource = 'server' | 'device' | 'seed' | 'blank';

const localKey = (id: string) => `sangam-workforce-${id}`;

export async function loadWorkforce(supplierId: string, supplierName: string): Promise<{ profile: WorkforceProfile | null; source: WorkforceSource }> {
  try {
    const r = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/workforce`);
    if (r.ok) {
      const j = await r.json();
      if (j && typeof j.supplierId === 'string') return { profile: j as WorkforceProfile, source: 'server' };
    }
  } catch { /* server not merged or not running yet */ }
  try {
    const raw = localStorage.getItem(localKey(supplierId));
    if (raw) return { profile: JSON.parse(raw) as WorkforceProfile, source: 'device' };
  } catch { /* storage unavailable */ }
  const seed = seedWorkforceFor(supplierName, supplierId);
  return seed ? { profile: seed, source: 'seed' } : { profile: null, source: 'blank' };
}

export async function saveWorkforce(supplierId: string, profile: Omit<WorkforceProfile, 'supplierId' | 'updatedAt'>): Promise<'server' | 'device'> {
  try {
    const r = await fetch(`/api/suppliers/${encodeURIComponent(supplierId)}/workforce`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (r.ok) return 'server';
  } catch { /* fall through to the device copy */ }
  try {
    localStorage.setItem(localKey(supplierId), JSON.stringify({ ...profile, supplierId, updatedAt: new Date().toISOString() }));
  } catch { /* storage unavailable: the form state is still live on screen */ }
  return 'device';
}
