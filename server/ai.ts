// AI endpoints served by the Hono server (server/index.ts). API keys stay here; the browser never sees them.
// Ask Sangam and certificate reading both use the configured LLM (server/llm.ts); certificate reading needs a model that accepts images.
import { readCertificate } from './certificates';
import { ask, chatText, llmConfigured } from './llm';

const SYSTEM = `You are Ask Sangam, the assistant inside Sangam, a platform that helps Indian companies localise supply chains and helps MSMEs, cooperatives, FPOs and SHGs win that business.

Answer using the context block the app sends with each question. It holds the page the user is on and the numbers Sangam has calculated.
- Every number you state must come from that context. If the context does not contain what is needed, say so and suggest which page in Sangam would show it.
- Never invent companies, prices, capacities or schemes. Say whether a figure is simulated, an estimate or real public data when the context labels it.
- Keep answers short and plain: a direct answer first, then two to five bullets of reasons or next steps.
- Many suppliers are small rural collectives. Avoid jargon; explain acronyms once.
- If the user writes in Hindi or another Indian language, answer in that language.`;

export interface Reply { status: number; body: unknown }
const reply = (status: number, body: unknown): Reply => ({ status, body });

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

export interface ExtractBody { mediaType: string; data: string; filename: string; holderName?: string }

/** Read an uploaded certificate with the vision model, then check what was read. The page may ignore `checks`; the Verification desk should not. */
export async function handleExtract(body: ExtractBody): Promise<Reply> {
  const isPdf = body.mediaType === 'application/pdf';
  const isImage = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(body.mediaType);
  if (!isPdf && !isImage) return reply(400, { error: 'Upload a PDF, PNG, JPEG, WebP or GIF.' });
  if (!llmConfigured()) return reply(503, { error: 'Certificate reading is not configured. Set LLM_API_KEY in .env.local (see .env.example) and restart `npm run dev`.' });
  try {
    return reply(200, await readCertificate(ask, { mediaType: body.mediaType, data: body.data, filename: body.filename }, body.holderName));
  } catch (e) {
    const msg = String((e as Error).message);
    if (/LLM 401|LLM 403/.test(msg)) return reply(401, { error: 'The LLM API key was rejected. Check LLM_API_KEY.' });
    if (/LLM 429/.test(msg)) return reply(429, { error: 'The free model is rate limited. Try again in a minute.' });
    if (/LLM 400/.test(msg) && isPdf) return reply(422, { error: 'This model could not read the PDF. Upload a photo or scan (PNG or JPEG) of the certificate, or set LLM_VISION_MODEL to a model that reads PDFs.' });
    return reply(422, { error: `Could not read this document: ${msg}` });
  }
}
