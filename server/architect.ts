// AI Supply Chain Architect: the language-model half. The plan itself is computed in the browser from Sangam's data
// (src/architect/engine.ts); the model only maps a free-text idea onto Sangam's catalogue and reviews a computed plan.
// Framework-free routes like P4's (Request in, Response out), mounted in server/app.ts. Uses P1's LLM client, so keys
// stay in .env.local and the provider is whatever LLM_* says. With no key the routes answer 503 and the page works without AI.
import { z } from 'zod';
import { json } from './credentials';
import type { Route } from './credentials';
import { ask as defaultAsk, llmConfigured } from './llm';
import type { Ask } from './llm';

const IdeaBody = z.object({
  task: z.literal('idea'),
  idea: z.string().min(3).max(1500),
  sector: z.string().max(80),
  catalogue: z.array(z.object({ id: z.string(), name: z.string(), process: z.string(), spec: z.string().max(300) })).max(40),
});
const ReviewBody = z.object({ task: z.literal('review'), facts: z.string().min(10).max(12_000) });
const Body = z.discriminatedUnion('task', [IdeaBody, ReviewBody]);

const IdeaReply = z.object({
  matchLineId: z.string().nullable(),
  why: z.string(),
  stages: z.array(z.object({ stage: z.enum(['raw', 'processing', 'manufacturing', 'logistics', 'buyer']), name: z.string(), note: z.string() })).max(12),
  questions: z.array(z.string()).max(5),
});
const ReviewReply = z.object({ summary: z.string(), risks: z.array(z.string()).max(6), nextSteps: z.array(z.string()).max(6) });

const RULES = `Rules:
- You are helping an Indian MSME, cooperative or first-time entrepreneur plan a business. Plain words; explain any acronym once.
- Never invent numbers, prices, market sizes, supplier names, buyer names, buyer commitments, subsidies or regulations.
  If something would need a number you were not given, say what to find out instead.
- Everything you write is shown to the user labelled "AI suggestion, verify before relying on it".
- Reply with one JSON object only, exactly in the requested shape.`;

const IDEA_SYSTEM = `You map a business idea onto Sangam's catalogue of parts and sketch its supply chain.
${RULES}
Return {"matchLineId": id from the catalogue or null if none fits, "why": one sentence,
"stages": [{"stage": "raw"|"processing"|"manufacturing"|"logistics"|"buyer", "name": short name, "note": one sentence, no numbers}],
"questions": up to 5 questions the entrepreneur must answer before investing}.`;

const REVIEW_SYSTEM = `You review a business and supply-chain plan that Sangam computed from its data. The facts block is the only source of truth.
${RULES}
- Do not repeat the plan's numbers back unless they make a point; never change them.
- Focus on decent work (SDG 8): fair wages, safety, skills, jobs, as well as the business risks.
Return {"summary": two or three sentences, "risks": up to 6 short risks the plan may be missing, "nextSteps": up to 6 concrete next steps}.`;

export function architectRoutes(ask: Ask = defaultAsk): Route[] {
  return [{
    method: 'POST',
    path: '/api/architect',
    handler: async (req) => {
      const parsed = Body.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return json({ error: parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') }, 400);
      if (ask === defaultAsk && !llmConfigured()) return json({ error: 'AI suggestions are off: set LLM_API_KEY in .env.local (see .env.example). The plan itself does not need AI.' }, 503);
      const b = parsed.data;
      try {
        if (b.task === 'idea') {
          const user = `Sector on screen: ${b.sector}\nCatalogue:\n${b.catalogue.map((c) => `- ${c.id}: ${c.name} (process: ${c.process}; ${c.spec})`).join('\n')}\n\nIdea: ${b.idea}`;
          const out = await ask({ role: 'turn', system: IDEA_SYSTEM, user, schema: IdeaReply, timeoutMs: 30_000 });
          return json({ ...out, matchLineId: b.catalogue.some((c) => c.id === out.matchLineId) ? out.matchLineId : null });
        }
        return json(await ask({ role: 'turn', system: REVIEW_SYSTEM, user: `<facts>\n${b.facts}\n</facts>`, schema: ReviewReply, timeoutMs: 30_000 }));
      } catch (e) {
        const msg = String((e as Error).message);
        if (/LLM 401|LLM 403/.test(msg)) return json({ error: 'The LLM API key was rejected. Check LLM_API_KEY.' }, 401);
        if (/LLM 429/.test(msg)) return json({ error: 'The free model is rate limited. Try again in a minute.' }, 429);
        return json({ error: `The AI could not answer: ${msg.slice(0, 200)}` }, 502);
      }
    },
  }];
}
