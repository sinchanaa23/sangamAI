// Suppliers review buyers. Buyers already review suppliers through the store (src/components/ReviewForm.tsx, checked on the
// Verification desk), because the trust score reads those. This is the other direction: a supplier rates a buyer on an order
// (paid on time, clear specifications, fair terms, communication). Like supplier reviews it stays pending until a Sangam team
// account matches it to a real order, and only then counts. The author always comes from the session, never from the request.
import type { Hono } from 'hono';
import { z } from 'zod';
import { currentUser, guard } from './auth';
import type { Db } from './db';

export const BUYER_REVIEW_DIMS = ['payment', 'specs', 'terms', 'communication'] as const;
export type BuyerReviewDim = (typeof BUYER_REVIEW_DIMS)[number];

export interface BuyerReview {
  id: string;
  /** the buying company being rated, as the supplier names it */
  buyerName: string;
  /** the supplier account that wrote it (set by the server) */
  authorUserId: string;
  author: string;
  orderRef: string;
  orderValueLakh: number;
  ratings: Record<BuyerReviewDim, number>;
  text: string;
  /** a note on the evidence (PO number, invoice, goods receipt) the team will check */
  evidence: string;
  status: 'pending' | 'verified' | 'rejected';
  verifierNote?: string;
  at: string;
}

const rating = z.number().int().min(1).max(5);
const Draft = z.object({
  buyerName: z.string().trim().min(2).max(120),
  orderRef: z.string().trim().min(3).max(60),
  orderValueLakh: z.number().min(0).max(1_000_000),
  ratings: z.object({ payment: rating, specs: rating, terms: rating, communication: rating }),
  text: z.string().trim().min(10).max(1500),
  evidence: z.string().trim().min(3).max(300),
});
const Decision = z.object({ status: z.enum(['verified', 'rejected']), note: z.string().trim().max(300).optional() });

export function mountReviews(app: Hono, db: Db, now: () => number = Date.now) {
  const bad = (e: { issues: { path: PropertyKey[]; message: string }[] }) => ({ error: e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') });

  // Everyone can read verified reviews. A supplier also sees their own pending ones; a team account sees every pending one.
  app.get('/api/reviews/buyers', (c) => {
    const s = currentUser(c, db, now());
    const all = db.list<BuyerReview>('buyerReviews');
    const visible = all.filter((r) => r.status === 'verified' || (s && (s.user.role === 'ecosystem' || r.authorUserId === s.user.id)));
    return c.json(visible.map(({ authorUserId, ...r }) => ({ ...r, mine: s?.user.id === authorUserId })).reverse());
  });

  app.post('/api/reviews/buyers', async (c) => {
    const g = guard(c, db, ['supplier'], now());
    if (g instanceof Response) return g;
    const p = Draft.safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return c.json(bad(p.error), 400);
    const review: BuyerReview = {
      id: `br-${crypto.randomUUID().slice(0, 8)}`, ...p.data, authorUserId: g.user.id, author: g.user.displayName,
      status: 'pending', at: new Date(now()).toISOString(),
    };
    db.put('buyerReviews', review);
    const { authorUserId, ...out } = review;
    return c.json({ ...out, mine: true }, 201);
  });

  app.post('/api/reviews/buyers/:id/decide', async (c) => {
    const g = guard(c, db, ['ecosystem'], now());
    if (g instanceof Response) return g;
    const p = Decision.safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return c.json(bad(p.error), 400);
    const r = db.get<BuyerReview>('buyerReviews', c.req.param('id'));
    if (!r) return c.json({ error: 'No such review.' }, 404);
    const next: BuyerReview = { ...r, status: p.data.status, ...(p.data.note ? { verifierNote: p.data.note } : {}) };
    db.put('buyerReviews', next);
    const { authorUserId, ...out } = next;
    return c.json(out);
  });
}
