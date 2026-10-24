// The Hono application. Kept apart from server/index.ts so tests can call it without opening a port.
import { Hono } from 'hono';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { ROUTES } from '../src/contracts';
import type { FairWorkScore, NegotiationSummary, Rfq, WorkforceProfile } from '../src/contracts';
import { handleAsk, handleExtract } from './ai';
import type { AskBody, ExtractBody, Reply } from './ai';
import { openDb } from './db';
import type { Db, Doc } from './db';
import { createNegotiations, fixture } from './negotiations';
import { NegotiationInput, RfqInput, WorkforceInput } from './schemas';

const body = (c: Context) => c.req.json().catch(() => ({}));
const reply = (c: Context, r: Reply) => c.json(r.body as object, r.status as 200);
const bad = (c: Context, e: { issues: { path: PropertyKey[]; message: string }[] }) =>
  c.json({ error: e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') }, 400);
const rfqId = () => `rfq-${crypto.randomUUID().slice(0, 8)}`;

export function createApp(db: Db = openDb(), opts: Parameters<typeof createNegotiations>[1] = {}) {
  const app = new Hono();
  const negotiations = createNegotiations(db, opts);

  app.get(ROUTES.health, (c) => c.json({ ok: true }));

  app.post('/api/ask', async (c) => reply(c, await handleAsk((await body(c)) as AskBody)));
  app.post('/api/extract-certificate', async (c) => reply(c, await handleExtract((await body(c)) as ExtractBody)));

  // Requests for quotation
  app.post(ROUTES.rfq, async (c) => {
    const p = RfqInput.safeParse(await body(c));
    if (!p.success) return bad(c, p.error);
    const rfq: Rfq = { ...p.data, id: p.data.id ?? rfqId() };
    return c.json(db.put('rfqs', rfq), 201);
  });
  app.get(ROUTES.rfq, (c) => c.json(db.list<Rfq>('rfqs')));
  app.get(`${ROUTES.rfq}/:id`, (c) => {
    const rfq = db.get<Rfq>('rfqs', c.req.param('id'));
    return rfq ? c.json(rfq) : c.json({ error: 'No such RFQ' }, 404);
  });

  // Negotiations: start one, read its summary, follow its events as server-sent events
  app.post(ROUTES.negotiations, async (c) => {
    const p = NegotiationInput.safeParse(await body(c));
    if (!p.success) return bad(c, p.error);
    const rfq = p.data.rfq ? db.put('rfqs', { ...p.data.rfq, id: p.data.rfq.id ?? rfqId() } as Rfq) : db.get<Rfq>('rfqs', p.data.rfqId!);
    if (!rfq) return c.json({ error: 'No such RFQ' }, 404);
    return c.json(negotiations.start(rfq, p.data.supplierIds, p.data.mode), 201);
  });
  app.get(ROUTES.negotiations, (c) => c.json(db.list<NegotiationSummary>('negotiations')));
  app.get(ROUTES.negotiation, (c) => {
    const id = c.req.param('id');
    if (id === 'demo') return c.json({ id, rfqId: fixture.rfq.id, status: 'done', mode: 'replay' } satisfies NegotiationSummary);
    const n = db.get<NegotiationSummary>('negotiations', id);
    return n ? c.json({ ...n, events: db.events(id) }) : c.json({ error: 'No such negotiation' }, 404);
  });
  app.get(ROUTES.negotiationStream, (c) => {
    const id = c.req.param('id');
    if (id !== 'demo' && !db.get('negotiations', id)) return c.json({ error: 'No such negotiation' }, 404);
    return streamSSE(c, async (stream) => {
      const ac = new AbortController();
      stream.onAbort(() => ac.abort());
      let n = 0;
      for await (const e of id === 'demo' ? negotiations.demo() : negotiations.follow(id, ac.signal)) {
        await stream.writeSSE({ id: String(n++), data: JSON.stringify(e) });
      }
    });
  });

  // Fair Work Scorecard: fixtures until the scoring function (src/fairwork.ts) is wired in
  app.get(ROUTES.scorecard, (c) => {
    const id = c.req.param('supplierId');
    const stored = db.get<FairWorkScore & Doc>('scorecards', id);
    if (stored) return c.json(stored);
    const demo = fixture.events.find((e) => e.type === 'audit');
    return demo?.type === 'audit' && demo.score.supplierId === id ? c.json(demo.score) : c.json({ error: 'No scorecard for this supplier yet' }, 404);
  });

  // Workforce profile saved by the supplier page
  app.put(ROUTES.workforce, async (c) => {
    const p = WorkforceInput.safeParse(await body(c));
    if (!p.success) return bad(c, p.error);
    const id = c.req.param('id');
    const profile: WorkforceProfile & Doc = { ...p.data, id, supplierId: id, updatedAt: new Date().toISOString() };
    return c.json(db.put('workforce', profile));
  });
  app.get(ROUTES.workforce, (c) => {
    const w = db.get<WorkforceProfile & Doc>('workforce', c.req.param('id'));
    return w ? c.json(w) : c.json({ error: 'No workforce profile yet' }, 404);
  });

  app.onError((e, c) => c.json({ error: e.message }, 500));
  return app;
}
