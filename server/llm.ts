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
  /** 'audit' uses LLM_AUDITOR_MODEL when set */
  role: 'turn' | 'audit';
  system: string;
  user: string;
  tools?: Tool[];
  schema: z.ZodType<T>;
  timeoutMs?: number;
}

/** Agents receive this as a parameter so tests can replace the model with a script. */
export type Ask = <T>(o: AskOptions<T>) => Promise<T>;

export const llmConfigured = () => Boolean(process.env.LLM_API_KEY);

const settings = () => ({
  key: process.env.LLM_API_KEY ?? '',
  base: (process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
  model: process.env.LLM_MODEL ?? 'openai/gpt-oss-120b',
  auditModel: process.env.LLM_AUDITOR_MODEL || process.env.LLM_MODEL || 'openai/gpt-oss-120b',
});

type Message = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: unknown[]; tool_call_id?: string };
interface ToolCall { id: string; function: { name: string; arguments: string } }

const MAX_TOOL_ROUNDS = 3;

async function post(url: string, key: string, body: unknown, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
    // Free tiers rate-limit hard: wait the few seconds the provider asks for, once
    if (r.status === 429 && attempt === 0) {
      const wait = Math.min(Number(r.headers.get('retry-after') ?? 2), 5) * 1000;
      await new Promise((res) => setTimeout(res, wait));
      continue;
    }
    if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return (await r.json()) as { choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[] };
  }
}

/** The first JSON object in a reply, tolerating prose or code fences around it. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON in reply');
  return JSON.parse(text.slice(start, end + 1));
}

export const ask: Ask = async <T>({ role, system, user, tools = [], schema, timeoutMs = 20_000 }: AskOptions<T>) => {
  const cfg = settings();
  if (!cfg.key) throw new Error('LLM_API_KEY is not set');
  const signal = AbortSignal.timeout(timeoutMs); // one deadline for the whole turn, tool calls included
  const messages: Message[] = [{ role: 'system', content: system }, { role: 'user', content: user }];
  const toolDefs = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

  for (let step = 0, repaired = false; ; step++) {
    const allowTools = toolDefs.length > 0 && step < MAX_TOOL_ROUNDS;
    const res = await post(`${cfg.base}/chat/completions`, cfg.key, {
      model: role === 'audit' ? cfg.auditModel : cfg.model,
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
  const res = await post(`${cfg.base}/chat/completions`, cfg.key, { model: cfg.model, temperature: 0.3, messages: [{ role: 'system', content: system }, ...messages] }, AbortSignal.timeout(timeoutMs));
  return (res.choices[0]?.message.content ?? '').trim();
}
