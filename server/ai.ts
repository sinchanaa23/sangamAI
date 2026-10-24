// AI endpoints served by the Hono server (server/index.ts). API keys stay here; the browser never sees them.
// Ask Sangam uses the configured free LLM (server/llm.ts). Certificate reading needs a vision model with structured
// output, so it still uses the Anthropic API and is available only when ANTHROPIC_API_KEY is set.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { chatText, llmConfigured } from './llm';

const MODEL = 'claude-opus-5-5';

const SYSTEM = `You are Ask Sangam, the assistant inside Sangam, a platform that helps Indian companies localise supply chains and helps MSMEs, cooperatives, FPOs and SHGs win that business.

Answer using the context block the app sends with each question. It holds the page the user is on and the numbers Sangam has calculated.
- Every number you state must come from that context. If the context does not contain what is needed, say so and suggest which page in Sangam would show it.
- Never invent companies, prices, capacities or schemes. Say whether a figure is simulated, an estimate or real public data when the context labels it.
- Keep answers short and plain: a direct answer first, then two to five bullets of reasons or next steps.
- Many suppliers are small rural collectives. Avoid jargon; explain acronyms once.
- If the user writes in Hindi or another Indian language, answer in that language.`;

export interface Reply { status: number; body: unknown }
const reply = (status: number, body: unknown): Reply => ({ status, body });

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

function explainError(e: unknown): { status: number; error: string } {
  if (e instanceof Anthropic.AuthenticationError) return { status: 401, error: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.' };
  if (e instanceof Anthropic.RateLimitError) return { status: 429, error: 'Rate limited by the Anthropic API. Try again in a minute.' };
  if (e instanceof Anthropic.APIError) return { status: e.status ?? 502, error: `Anthropic API error: ${e.message}` };
  const msg = String((e as Error)?.message ?? e);
  if (/api key|apiKey|credentials|authentication/i.test(msg)) {
    return { status: 503, error: 'Certificate reading is not configured. It needs ANTHROPIC_API_KEY in .env.local; everything else works without it.' };
  }
  return { status: 500, error: msg };
}

export interface AskBody { question: string; context: string; history?: { role: 'user' | 'assistant'; content: string }[] }

export async function handleAsk(body: AskBody): Promise<Reply> {
  if (!body.question?.trim()) return reply(400, { error: 'Empty question' });
  if (!llmConfigured()) return reply(503, { error: 'Ask Sangam is not configured. Set LLM_API_KEY in .env.local (a free Groq or Gemini key works; see .env.example) and restart `npm run dev`.' });
  try {
    const history = (body.history ?? []).slice(-8).map((m) => ({ role: m.role, content: m.content }));
    const answer = await chatText({ system: SYSTEM, messages: [...history, { role: 'user', content: `<context>
${body.context}
</context>

${body.question}` }] });
    return reply(200, { answer: answer || 'Sorry, I could not produce an answer.' });
  } catch (e) {
    const msg = String((e as Error).message);
    if (/LLM 401|LLM 403/.test(msg)) return reply(401, { error: 'The LLM API key was rejected. Check LLM_API_KEY.' });
    if (/LLM 429/.test(msg)) return reply(429, { error: 'The free model is rate limited. Try again in a minute.' });
    return reply(502, { error: `Ask Sangam could not reach the model: ${msg}` });
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

export interface ExtractBody { mediaType: string; data: string; filename: string }

export async function handleExtract(body: ExtractBody): Promise<Reply> {
  try {
    const isPdf = body.mediaType === 'application/pdf';
    const isImage = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(body.mediaType);
    if (!isPdf && !isImage) return reply(400, { error: 'Upload a PDF, PNG, JPEG, WebP or GIF.' });
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
    if (response.stop_reason === 'refusal' || !response.parsed_output) return reply(422, { error: 'Could not read this document.' });
    return reply(200, { fields: response.parsed_output });
  } catch (e) {
    const { status, error } = explainError(e);
    return reply(status, { error });
  }
}
