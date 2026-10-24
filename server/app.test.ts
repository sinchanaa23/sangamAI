import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('server', () => {
  const app = createApp();

  it('answers the health check', async () => {
    const r = await app.request('/api/health');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it('rejects an empty question before calling the model', async () => {
    const r = await app.request('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: ' ', context: '' }) });
    expect(r.status).toBe(400);
  });
});
