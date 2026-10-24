// The Hono application. Kept apart from server/index.ts so tests can call it without opening a port.
import { Hono } from 'hono';
import { ROUTES } from '../src/contracts';
import { handleAsk, handleExtract } from './ai';
import type { AskBody, ExtractBody, Reply } from './ai';

export function createApp() {
  const app = new Hono();

  app.get(ROUTES.health, (c) => c.json({ ok: true }));

  const json = async <T,>(c: { req: { json: () => Promise<T> } }) => c.req.json().catch(() => ({}) as T);
  const send = (c: { json: (b: unknown, s: never) => Response }, r: Reply) => c.json(r.body, r.status as never);

  app.post('/api/ask', async (c) => send(c, await handleAsk(await json<AskBody>(c))));
  app.post('/api/extract-certificate', async (c) => send(c, await handleExtract(await json<ExtractBody>(c))));

  app.onError((e, c) => c.json({ error: e.message }, 500));
  return app;
}
