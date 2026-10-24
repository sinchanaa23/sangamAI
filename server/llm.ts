// One place that talks to a language model. It speaks the OpenAI-style chat API, which Groq, Google Gemini and OpenRouter
// (and Anthropic through a compatible gateway) all accept, so the provider is a matter of three environment variables:
//   LLM_API_KEY, LLM_BASE_URL, LLM_MODEL   (LLM_AUDITOR_MODEL optionally picks a stronger model for the Auditor)
// With no LLM_API_KEY the server runs negotiations in replay mode.
import type { z } from 'zod';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
  run: (args: Record<string, unknown>) => unknown;
}

export interface AskOptions<T> {
  /** 'audit' uses LLM_AUDITOR_MODEL when set; 'vision' uses LLM_VISION_MODEL (it must accept images) */
  role: 'turn' | 'audit' | 'vision';
  system: string;
  user: string;
  tools?: Tool[];
  /** images or PDFs sent with the user message, base64 */
  files?: { mediaType: string; data: string; filename?: string }[];
  schema: z.ZodType<T>;
  timeoutMs?: number;
}

/** Agents receive this as a parameter so tests can replace the model with a script. */
export type Ask = <T>(o: AskOptions<T>) => Promise<T>;

/** Why a model turn fell back to the rule-based move; printed when SANGAM_DEBUG is set. */
export const logFallback = (who: string, e: unknown) => { if (process.env.SANGAM_DEBUG) console.warn(`[llm] ${who} fell back to rules: ${String((e as Error)?.message ?? e).slice(0, 300)}`); };

export const llmConfigured = () => Boolean(process.env.LLM_API_KEY);

const settings = () => ({
  key: process.env.LLM_API_KEY ?? '',
  base: (process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
  model: process.env.LLM_MODEL ?? 'openai/gpt-oss-120b',
  auditModel: process.env.LLM_AUDITOR_MODEL || process.env.LLM_MODEL || 'openai/gpt-oss-120b',
  visionModel: process.env.LLM_VISION_MODEL || process.env.LLM_MODEL || 'openai/gpt-oss-120b',
  // Image reading may live on a different provider than the agents (e.g. agents on Groq, certificates on Gemini)
  visionBase: (process.env.LLM_VISION_BASE_URL || process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
  visionKey: process.env.LLM_VISION_API_KEY || process.env.LLM_API_KEY || '',
  /** requests per minute the provider allows; calls are spaced to stay under it (0 = no limit) */
  rpm: Number(process.env.LLM_RPM ?? 0),
  visionRpm: Number(process.env.LLM_VISION_RPM ?? process.env.LLM_RPM ?? 0),
});

type Message = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null | unknown[]; tool_calls?: unknown[]; tool_call_id?: string };
interface ToolCall { id: string; function: { name: string; arguments: string } }

const MAX_TOOL_ROUNDS = 3;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nextSlot = new Map<string, number>();

/** Spaces calls to one provider so a free tier's requests-per-minute limit is not hit; later callers queue behind earlier ones. */
async function slot(base: string, rpm: number) {
  if (!rpm) return;
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(base) ?? 0);
  nextSlot.set(base, at + 60_000 / rpm);
  if (at > now) await sleep(at - now);
}

/** How long a 429 asks us to wait: the Retry-After header, or "retry in 10.9s" in the body. */
function retryDelayMs(r: Response, body: string): number {
  const header = Number(r.headers.get('retry-after'));
  const text = Number(/retry in ([\d.]+)s/i.exec(body)?.[1]);
  return (Number.isFinite(header) && header > 0 ? header : Number.isFinite(text) ? text + 0.5 : 2) * 1000;
}

async function post(base: string, rpm: number, key: string, body: unknown, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    await slot(base, rpm);
    const r = await fetch(`${base}/chat/completions`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
    if (r.ok) return (await r.json()) as { choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[] };
    const text = await r.text();
    // Free tiers rate-limit hard: wait as long as the provider asks (up to 15 s), at most twice
    if (r.status === 429 && attempt < 2 && retryDelayMs(r, text) <= 15_000) { await sleep(retryDelayMs(r, text)); continue; }
    throw new Error(`LLM ${r.status}: ${text.slice(0, 200)}`);
  }
}

/** The first JSON object in a reply, tolerating prose or code fences around it. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON in reply');
  return JSON.parse(text.slice(start, end + 1));
}

export const ask: Ask = async <T>({ role, system, user, tools = [], files = [], schema, timeoutMs = 30_000 }: AskOptions<T>) => {
  const cfg = settings();
  if (!(role === 'vision' ? cfg.visionKey : cfg.key)) throw new Error('LLM_API_KEY is not set');
  const signal = AbortSignal.timeout(timeoutMs); // one deadline for the whole turn, tool calls included
  // Images go as image_url data URIs and a PDF as a file part. Both are OpenAI-style and accepted by Gemini and OpenRouter.
  const part = (f: { mediaType: string; data: string; filename?: string }) => f.mediaType === 'application/pdf'
    ? { type: 'file', file: { filename: f.filename ?? 'document.pdf', file_data: `data:application/pdf;base64,${f.data}` } }
    : { type: 'image_url', image_url: { url: `data:${f.mediaType};base64,${f.data}` } };
  const messages: Message[] = [{ role: 'system', content: system }, { role: 'user', content: files.length ? [...files.map(part), { type: 'text', text: user }] : user }];
  const toolDefs = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

  for (let step = 0, repaired = false; ; step++) {
    const allowTools = toolDefs.length > 0 && step < MAX_TOOL_ROUNDS;
    const vision = role === 'vision';
    const res = await post(vision ? cfg.visionBase : cfg.base, vision ? cfg.visionRpm : cfg.rpm, vision ? cfg.visionKey : cfg.key, {
      model: role === 'audit' ? cfg.auditModel : role === 'vision' ? cfg.visionModel : cfg.model,
      messages,
      temperature: 0.3,
      ...(allowTools ? { tools: toolDefs, tool_choice: 'auto' } : {}),
    }, signal);
    const msg = res.choices[0]?.message;
    if (!msg) throw new Error('Empty LLM reply');

    if (msg.tool_calls?.length && allowTools) {
      messages.push({ role: 'assistant', content: msg.content, tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        const tool = tools.find((t) => t.name === call.function.name);
        let out: unknown;
        try { out = tool ? tool.run(JSON.parse(call.function.arguments || '{}')) : { error: `Unknown tool ${call.function.name}` }; }
        catch (e) { out = { error: String((e as Error).message) }; }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out) });
      }
      continue;
    }

    try {
      return schema.parse(extractJson(msg.content ?? ''));
    } catch (e) {
      if (repaired) throw e;
      repaired = true; // one chance to fix a malformed reply
      messages.push({ role: 'assistant', content: msg.content ?? '' }, { role: 'user', content: `That was not valid. Reply with one JSON object only, exactly in the requested shape. Problem: ${String((e as Error).message).slice(0, 300)}` });
    }
  }
};

/** A plain chat answer with no tools or schema, for Ask Sangam. */
export async function chatText({ system, messages, timeoutMs = 30_000 }: { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; timeoutMs?: number }): Promise<string> {
  const cfg = settings();
  if (!cfg.key) throw new Error('LLM_API_KEY is not set');
  const res = await post(cfg.base, cfg.rpm, cfg.key, { model: cfg.model, temperature: 0.3, messages: [{ role: 'system', content: system }, ...messages] }, AbortSignal.timeout(timeoutMs));
  return (res.choices[0]?.message.content ?? '').trim();
}
