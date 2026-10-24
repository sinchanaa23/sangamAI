// Anonymous worker grievances. Owned by P4; mounted by P1 alongside credentialRoutes.
import { json } from './credentials';
import type { Route } from './credentials';
import type { Grievance } from '../src/ecosystem/ledger';

/** In memory by default; P1 can swap in SQLite with setGrievanceStore. */
export interface GrievanceStore { save(g: Grievance): void; list(): Grievance[] }
const mem = new Map<string, Grievance>();
let store: GrievanceStore = { save: (g) => { mem.set(g.id, g); }, list: () => [...mem.values()] };
export const setGrievanceStore = (s: GrievanceStore) => { store = s; };

/** Open grievances for a supplier: the Fair Work Scorecard lowers the grade one step while any are open. */
export const openGrievances = (supplierId: string) => store.list().filter((g) => g.sellerId === supplierId && g.status === 'open').length;

export const grievanceRoutes: Route[] = [
  {
    method: 'POST', path: '/api/grievances', handler: async (req) => {
      const g = (await req.json().catch(() => null)) as Grievance | null;
      if (!g?.id || !g.sellerId || !g.category) return json({ error: 'Send a grievance with id, sellerId and category' }, 400);
      // No name, phone or ID is accepted: reports stay anonymous
      store.save({ id: g.id, sellerId: g.sellerId, category: g.category, text: String(g.text ?? '').slice(0, 2000), at: g.at, status: 'open' });
      return json({ ok: true }, 201);
    },
  },
  { method: 'GET', path: '/api/grievances', handler: async () => json(store.list()) },
  {
    method: 'POST', path: '/api/grievances/:id/resolve', handler: async (req, p) => {
      const g = store.list().find((x) => x.id === p.id);
      if (!g) return json({ error: 'Not found' }, 404);
      const b = (await req.json().catch(() => ({}))) as { resolution?: string };
      store.save({ ...g, status: 'resolved', resolution: b.resolution ?? '' });
      return json({ ok: true });
    },
  },
];
