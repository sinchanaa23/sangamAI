import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ask } from './llm';

// A tiny OpenAI-compatible server that plays back scripted replies, so the client is tested over real HTTP.
let script: ((body: { messages: { role: string; content: string }[] }) => { status?: number; message?: unknown; nativeText?: string })[] = [];
const seen: unknown[] = [];
const urls: string[] = [];
const server = createServer((req, res) => {
  let raw = '';
  req.on('data', (d) => (raw += d));
  req.on('end', () => {
    const body = JSON.parse(raw);
    seen.push(body);
    urls.push(req.url ?? '');
    const step = script.shift()!(body);
    res.statusCode = step.status ?? 200;
    if (step.status === 429) res.setHeader('retry-after', '0');
    res.setHeader('content-type', 'application/json');
    const native = (req.url ?? '').includes(':generateContent');
    res.end(JSON.stringify(step.status && step.status !== 200 ? { error: 'x' } : native ? { candidates: [{ content: { parts: [{ text: step.nativeText }] } }] } : { choices: [{ message: step.message }] }));
  });
});

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, r));
  process.env.LLM_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.LLM_API_KEY = 'test';
  process.env.LLM_MODEL = 'm';
});
afterAll(() => { server.close(); });

const schema = z.object({ n: z.number() });
const opts = { role: 'turn' as const, system: 's', user: 'u', schema };

describe('llm client', () => {
  it('runs a tool call and then parses the JSON answer', async () => {
    script = [
      () => ({ message: { content: null, tool_calls: [{ id: 't1', function: { name: 'two', arguments: '{}' } }] } }),
      (b) => ({ message: { content: `Here you go: {"n": ${JSON.parse(b.messages.at(-1)!.content).value}}` } }),
    ];
    const out = await ask({ ...opts, tools: [{ name: 'two', description: 'd', parameters: { type: 'object', properties: {} }, run: () => ({ value: 2 }) }] });
    expect(out).toEqual({ n: 2 });
  });

  it('asks once more when the reply is not valid, then gives up', async () => {
    script = [() => ({ message: { content: 'no json' } }), () => ({ message: { content: '{"n": 5}' } })];
    expect(await ask(opts)).toEqual({ n: 5 });
    script = [() => ({ message: { content: 'no json' } }), () => ({ message: { content: 'still none' } })];
    await expect(ask(opts)).rejects.toThrow();
  });

  it('retries once after a 429 and reports other errors', async () => {
    script = [() => ({ status: 429 }), () => ({ message: { content: '{"n": 1}' } })];
    expect(await ask(opts)).toEqual({ n: 1 });
    script = [() => ({ status: 400 })];
    await expect(ask(opts)).rejects.toThrow('LLM 400');
  });

  it('retries once when the model is briefly overloaded (503), then gives up', async () => {
    script = [() => ({ status: 503 }), () => ({ message: { content: '{"n": 3}' } })];
    expect(await ask(opts)).toEqual({ n: 3 });
    script = [() => ({ status: 503 }), () => ({ status: 503 })];
    await expect(ask(opts)).rejects.toThrow('LLM 503');
  });

  it('sends the key and the model', async () => {
    seen.length = 0;
    script = [() => ({ message: { content: '{"n": 1}' } })];
    await ask(opts);
    expect((seen[0] as { model: string }).model).toBe('m');
  });

  it('reads a PDF through the native Gemini endpoint, because the OpenAI-style one rejects PDFs', async () => {
    const base = process.env.LLM_BASE_URL!;
    process.env.LLM_VISION_BASE_URL = `${base}/v1beta/openai`;
    process.env.LLM_VISION_MODEL = 'vm';
    urls.length = 0; seen.length = 0;
    script = [() => ({ nativeText: 'Here: {"n": 7}' })];
    try {
      const out = await ask({ ...opts, role: 'vision', files: [{ mediaType: 'application/pdf', data: 'AAAA', filename: 'c.pdf' }] });
      expect(out).toEqual({ n: 7 });
      expect(urls[0]).toBe('/v1beta/models/vm:generateContent');
      const body = seen[0] as { contents: { parts: { inline_data?: { mime_type: string; data: string } }[] }[]; systemInstruction: unknown };
      expect(body.contents[0]!.parts[0]!.inline_data).toEqual({ mime_type: 'application/pdf', data: 'AAAA' });
      expect(body.systemInstruction).toBeTruthy();
    } finally {
      delete process.env.LLM_VISION_BASE_URL; delete process.env.LLM_VISION_MODEL;
    }
  });

  it('keeps images on the OpenAI-style endpoint', async () => {
    process.env.LLM_VISION_BASE_URL = `${process.env.LLM_BASE_URL}/v1beta/openai`;
    urls.length = 0;
    script = [() => ({ message: { content: '{"n": 2}' } })];
    try {
      expect(await ask({ ...opts, role: 'vision', files: [{ mediaType: 'image/png', data: 'AAAA' }] })).toEqual({ n: 2 });
      expect(urls[0]).toContain('/chat/completions');
    } finally { delete process.env.LLM_VISION_BASE_URL; }
  });
});
