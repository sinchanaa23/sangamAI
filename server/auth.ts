// Signup and login. No passwords: a one-time code proves "same person as last time" (suppliers by phone, buyers by email).
// Sessions are random tokens in an httpOnly cookie; only their hash is stored. Verification of the business is separate (server/verify/).
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Context, Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Db } from './db';
import { summarise } from './verify/tiers';
import type { UserDoc } from './verify/tiers';

export type Role = UserDoc['role'];

/** How a code reaches a person. The mock sender prints it on the server and is tagged `simulated`; a real SMS or email sender plugs in here. */
export interface OtpSender { name: string; send(identifier: string, code: string): Promise<void> }
export const mockSender: OtpSender = {
  name: 'mock',
  send: async (identifier, code) => { console.log(`[otp] code for ${identifier}: ${code} (simulated: nothing is sent by SMS or email)`); },
};

export interface AuthOptions {
  otpSender: OtpSender;
  ecosystemAllowlist: string[];
  now?: () => number;
  /** runs after a successful sign-in, for example to re-check a registry result that has gone stale */
  onSignIn?: (user: UserDoc) => Promise<void>;
}

const COOKIE = 'sangam_session';
const OTP_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 7 * 86_400_000;
const MAX_WRONG_CODES = 5;
const START_LIMIT = 3; // codes per identifier per window
const START_WINDOW_MS = 10 * 60_000;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

type Identifier = { kind: 'phone' | 'email'; value: string };
/** Indian mobile numbers become +91XXXXXXXXXX; emails are lower-cased. Returns an error message when it does not look like either. */
export function normaliseIdentifier(raw: string): Identifier | string {
  const s = raw.trim();
  if (s.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? { kind: 'email', value: s.toLowerCase() } : 'That does not look like an email address.';
  const digits = s.replace(/[\s-]/g, '').replace(/^\+/, '');
  const ten = /^91\d{10}$/.test(digits) ? digits.slice(2) : /^\d{10}$/.test(digits) ? digits : '';
  return ten ? { kind: 'phone', value: `+91${ten}` } : 'Enter a 10-digit Indian mobile number.';
}

const StartBody = z.object({ role: z.enum(['buyer', 'supplier', 'ecosystem']), identifier: z.string().min(3).max(120), displayName: z.string().trim().max(120).optional() });
const VerifyBody = StartBody.extend({ code: z.string().min(1).max(12) });

export const publicUser = (u: UserDoc) => ({ id: u.id, role: u.role, displayName: u.displayName, phone: u.phone, email: u.email, supplierId: u.supplierId, createdAt: u.createdAt });

export function currentUser(c: Context, db: Db, now = Date.now()): { user: UserDoc; sessionId: string } | null {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const sessionId = sha(token);
  const s = db.get<{ id: string; userId: string; expiresAt: number }>('sessions', sessionId);
  if (!s || s.expiresAt < now) return null;
  const user = db.get<UserDoc>('users', s.userId);
  return user ? { user, sessionId } : null;
}

/** For routes that need a signed-in user, optionally of certain roles: returns the user, or the response to send. */
export function guard(c: Context, db: Db, roles?: Role[], now = Date.now()): { user: UserDoc } | Response {
  const s = currentUser(c, db, now);
  if (!s) return c.json({ error: 'Sign in first.' }, 401);
  if (roles && !roles.includes(s.user.role)) return c.json({ error: 'This is not available for your kind of account.' }, 403);
  return { user: s.user };
}

export function mountAuth(app: Hono, db: Db, o: AuthOptions) {
  const clock = o.now ?? Date.now;
  const requested = new Map<string, number[]>();
  const allow = o.ecosystemAllowlist.map((x) => normaliseIdentifier(x)).flatMap((x) => (typeof x === 'string' ? [] : [x.value]));
  const otpId = (role: string, ident: string) => sha(`${role}|${ident}`).slice(0, 24);

  /** The identifier for a role, or the response that says why not: suppliers use a phone, buyers an email, ecosystem accounts must be on the allowlist. */
  const identify = (c: Context, role: Role, raw: string): Identifier | Response => {
    const id = normaliseIdentifier(raw);
    if (typeof id === 'string') return c.json({ error: id }, 400);
    if (role === 'supplier' && id.kind !== 'phone') return c.json({ error: 'Suppliers sign in with a mobile number.' }, 400);
    if (role === 'buyer' && id.kind !== 'email') return c.json({ error: 'Buyers sign in with an email address.' }, 400);
    if (role === 'ecosystem' && !allow.includes(id.value)) return c.json({ error: 'This account is not on the list of Sangam ecosystem accounts.' }, 403);
    return id;
  };

  app.post('/api/auth/otp/start', async (c) => {
    const p = StartBody.safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return c.json({ error: p.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') }, 400);
    const id = identify(c, p.data.role, p.data.identifier);
    if (id instanceof Response) return id;
    const now = clock();
    const recent = (requested.get(id.value) ?? []).filter((t) => now - t < START_WINDOW_MS);
    if (recent.length >= START_LIMIT) return c.json({ error: 'Too many codes requested. Try again in a few minutes.' }, 429);
    requested.set(id.value, [...recent, now]);
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const key = otpId(p.data.role, id.value);
    db.put('otps', { id: key, codeHash: sha(`${code}:${key}`), expiresAt: now + OTP_TTL_MS, wrong: 0 });
    await o.otpSender.send(id.value, code);
    const mock = o.otpSender.name === 'mock';
    // Only the mock sender shows the code to the browser, so the demo works with no SMS account; it is tagged simulated
    return c.json({ ok: true, provider: o.otpSender.name, expiresInSec: OTP_TTL_MS / 1000, ...(mock ? { devCode: code, simulated: true } : {}) });
  });

  app.post('/api/auth/otp/verify', async (c) => {
    const p = VerifyBody.safeParse(await c.req.json().catch(() => ({})));
    if (!p.success) return c.json({ error: p.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') }, 400);
    const id = identify(c, p.data.role, p.data.identifier);
    if (id instanceof Response) return id;
    const now = clock();
    const key = otpId(p.data.role, id.value);
    const otp = db.get<{ id: string; codeHash: string; expiresAt: number; wrong: number }>('otps', key);
    if (!otp || otp.expiresAt < now) { if (otp) db.del('otps', key); return c.json({ error: 'That code has expired or was never requested. Ask for a new one.' }, 401); }
    if (otp.wrong >= MAX_WRONG_CODES) return c.json({ error: 'Too many wrong codes. Ask for a new one.' }, 429);
    const a = Buffer.from(sha(`${p.data.code}:${key}`), 'hex'), b = Buffer.from(otp.codeHash, 'hex');
    if (!timingSafeEqual(a, b)) { db.put('otps', { ...otp, wrong: otp.wrong + 1 }); return c.json({ error: 'Wrong code.' }, 401); }
    db.del('otps', key); // a code works once

    const existing = db.list<UserDoc>('users').find((u) => u.role === p.data.role && (id.kind === 'phone' ? u.phone === id.value : u.email === id.value));
    const user: UserDoc = existing ?? {
      id: `u-${randomUUID().slice(0, 8)}`, role: p.data.role, ...(id.kind === 'phone' ? { phone: id.value } : { email: id.value }),
      displayName: p.data.displayName || (id.kind === 'phone' ? `Supplier ${id.value.slice(-4)}` : id.value.split('@')[0]!), createdAt: new Date(now).toISOString(),
    };
    if (!existing) db.put('users', user);
    const token = randomBytes(32).toString('hex');
    db.put('sessions', { id: sha(token), userId: user.id, role: user.role, expiresAt: now + SESSION_TTL_MS });
    setCookie(c, COOKIE, token, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL_MS / 1000, secure: c.req.url.startsWith('https:') });
    await o.onSignIn?.(user).catch(() => undefined);
    return c.json({ user: publicUser(user), verification: summarise(db, user, now) });
  });

  app.post('/api/auth/logout', (c) => {
    const s = currentUser(c, db, clock());
    if (s) db.del('sessions', s.sessionId);
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  app.get('/api/me', (c) => {
    const s = currentUser(c, db, clock());
    return s ? c.json({ user: publicUser(s.user), verification: summarise(db, s.user, clock()) }) : c.json({ error: 'Not signed in.' }, 401);
  });
}
