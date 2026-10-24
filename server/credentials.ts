// Sangam issuer: signs Skill, audit and contract credentials and checks them.
// Owned by P4. Framework-free routes (Request in, Response out); P1 mounts them in server/index.ts, e.g. with Hono:
//   for (const r of [...credentialRoutes, ...impactRoutes, ...grievanceRoutes])
//     app.on(r.method, r.path, (c) => r.handler(c.req.raw, c.req.param()));
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateIssuerKey, signCredential, verifyCredential } from '../src/ecosystem/vc';
import type { Credential, CredentialKind, IssuerKey } from '../src/ecosystem/vc';

export interface Route {
  method: 'GET' | 'POST';
  /** Hono / Express style path, e.g. /api/credentials/:id */
  path: string;
  handler: (req: Request, params: Record<string, string>) => Promise<Response>;
}

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/** The private key stays on this machine; *.local files are git-ignored. */
const KEY_FILE = '.sangam-issuer.local';
let issuer: Promise<{ key: IssuerKey; privateJwk: JsonWebKey }> | null = null;
function issuerKey() {
  return (issuer ??= (async () => {
    if (existsSync(KEY_FILE)) return JSON.parse(readFileSync(KEY_FILE, 'utf8'));
    const k = await generateIssuerKey('Sangam server');
    writeFileSync(KEY_FILE, JSON.stringify(k));
    return k;
  })());
}

/** Where issued credentials are kept. In memory by default; P1 can swap in SQLite with setCredentialStore. */
export interface CredentialStore { save(c: Credential): void; get(id: string): Credential | undefined; list(): Credential[] }
const mem = new Map<string, Credential>();
let store: CredentialStore = { save: (c) => { mem.set(c.id, c); }, get: (i) => mem.get(i), list: () => [...mem.values()] };
export const setCredentialStore = (s: CredentialStore) => { store = s; };

export async function sign(type: CredentialKind, subject: Record<string, unknown>): Promise<Credential> {
  const k = await issuerKey();
  const c = await signCredential(type, subject, k.key, k.privateJwk);
  store.save(c);
  return c;
}

export async function verify(c: unknown) {
  return verifyCredential(c, [(await issuerKey()).key]);
}

const KINDS: CredentialKind[] = ['SkillCredential', 'AuditCredential', 'ContractCredential'];

export const credentialRoutes: Route[] = [
  { method: 'GET', path: '/api/credentials/issuer', handler: async () => json((await issuerKey()).key) },
  {
    method: 'POST', path: '/api/credentials/sign', handler: async (req) => {
      // Demo only: in production this sits behind the Sangam team's login.
      const b = (await req.json().catch(() => null)) as { type?: CredentialKind; subject?: Record<string, unknown> } | null;
      if (!b?.type || !KINDS.includes(b.type) || !b.subject) return json({ error: 'Send { type, subject }' }, 400);
      return json(await sign(b.type, b.subject));
    },
  },
  { method: 'POST', path: '/api/credentials/verify', handler: async (req) => json(await verify(await req.json().catch(() => null))) },
  { method: 'GET', path: '/api/credentials', handler: async () => json(store.list()) },
  { method: 'GET', path: '/api/credentials/:id', handler: async (_req, p) => { const c = store.get(p.id); return c ? json(c) : json({ error: 'Not found' }, 404); } },
];
