// Server-side AI endpoints for the Vite dev/preview server. The API key never reaches the browser:
// the Anthropic client resolves credentials from ANTHROPIC_API_KEY (or an `ant auth login` profile).
import type { IncomingMessage, ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const MODEL = 'claude-opus-5-5';

const SYSTEM = `You are Ask Sangam, the assistant inside Sangam, a platform that helps Indian companies localise supply chains and helps MSMEs, cooperatives, FPOs and SHGs win that business.

Answer using the context block the app sends with each question. It holds the page the user is on and the numbers Sangam has calculated.
- Every number you state must come from that context. If the context does not contain what is needed, say so and suggest which page in Sangam would show it.
- Never invent companies, prices, capacities or schemes. Say whether a figure is simulated, an estimate or real public data when the context labels it.
- Keep answers short and plain: a direct answer first, then two to five bullets of reasons or next steps.
- Many suppliers are small rural collectives. Avoid jargon; explain acronyms once.
- If the user writes in Hindi or another Indian language, answer in that language.`;

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

function explainError(e: unknown): { status: number; error: string } {
  if (e instanceof Anthropic.AuthenticationError) return { status: 401, error: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.' };
  if (e instanceof Anthropic.RateLimitError) return { status: 429, error: 'Rate limited by the Anthropic API. Try again in a minute.' };
  if (e instanceof Anthropic.APIError) return { status: e.status ?? 502, error: `Anthropic API error: ${e.message}` };
  const msg = String((e as Error)?.message ?? e);
  if (/api key|apiKey|credentials|authentication/i.test(msg)) {
    return { status: 503, error: 'Ask Sangam is not configured. Set ANTHROPIC_API_KEY in your environment (or run `ant auth login`) and restart `npm run dev`.' };
  }
  return { status: 500, error: msg };
}

interface AskBody { question: string; context: string; history?: { role: 'user' | 'assistant'; content: string }[] }

export async function handleAsk(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const body = (await readJson(req)) as AskBody;
    if (!body.question?.trim()) return send(res, 400, { error: 'Empty question' });
    const history: Anthropic.Beta.BetaMessageParam[] = (body.history ?? []).slice(-8).map((m) => ({ role: m.role, content: m.content }));
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      // Server-side fallback: if a safety classifier declines, the API retries on a fallback model in the same call
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [
        ...history,
        { role: 'user', content: `<context>\n${body.context}\n</context>\n\n${body.question}` },
      ],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (response.stop_reason === 'refusal') return send(res, 200, { answer: 'Sorry, I can’t help with that request.' });
    const answer = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
    send(res, 200, { answer, model: response.model });
  } catch (e) {
    const { status, error } = explainError(e);
    send(res, status, { error });
  }
}

const Certificate = z.object({
  documentType: z.string().describe('For example: ISO 9001 certificate, BIS licence, FSSAI licence, Udyam registration'),
  standard: z.string().describe('Standard or scheme named on the document, or empty'),
  holderName: z.string(),
  certificateNumber: z.string(),
  issuer: z.string(),
  issueDate: z.string().describe('YYYY-MM-DD if visible, else empty'),
  expiryDate: z.string().describe('YYYY-MM-DD if visible, else empty'),
  scope: z.string().describe('Products or processes covered, or empty'),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string().describe('Anything that looks unclear, altered or inconsistent'),
});

interface ExtractBody { mediaType: string; data: string; filename: string }

export async function handleExtract(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const body = (await readJson(req)) as ExtractBody;
    const isPdf = body.mediaType === 'application/pdf';
    const isImage = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(body.mediaType);
    if (!isPdf && !isImage) return send(res, 400, { error: 'Upload a PDF, PNG, JPEG, WebP or GIF.' });
    const file: Anthropic.ContentBlockParam = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: body.data } }
      : { type: 'image', source: { type: 'base64', media_type: body.mediaType as 'image/png', data: body.data } };
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low', format: zodOutputFormat(Certificate) },
      messages: [{
        role: 'user',
        content: [file, { type: 'text', text: `Read this document uploaded to a supplier profile (${body.filename}). Extract the fields exactly as printed; leave a field empty if it is not on the document. Do not guess.` }],
      }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) return send(res, 422, { error: 'Could not read this document.' });
    send(res, 200, { fields: response.parsed_output });
  } catch (e) {
    const { status, error } = explainError(e);
    send(res, status, { error });
  }
}
