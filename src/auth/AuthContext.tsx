// Who is signed in, and how verified they are. The session itself lives in an httpOnly cookie the browser never reads;
// this only asks the server (GET /api/me) and calls the sign-in routes.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Provenance } from '../types';

export type Role = 'buyer' | 'supplier' | 'ecosystem';
export interface AccountUser { id: string; role: Role; displayName: string; phone?: string; email?: string; supplierId?: string }
export interface Check { id: string; kind: string; input: string; provider: string; at: string; result: string; summary: string; provenance: Provenance; basis?: string }
export interface Verification {
  tier: 0 | 1 | 2 | 3;
  status: 'signed-up' | 'verified' | 'needs-review';
  provenance: Provenance;
  basis?: 'gstin' | 'udyam' | 'cin' | 'vouched';
  label: string;
  checks: Check[];
  recheckDue: boolean;
}
export interface Me { user: AccountUser; verification: Verification }

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: `Server returned ${r.status}` }));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}

interface Ctx {
  me: Me | null;
  loading: boolean;
  startCode: (role: Role, identifier: string, displayName?: string) => Promise<{ provider: string; devCode?: string; simulated?: boolean }>;
  signIn: (role: Role, identifier: string, code: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  verify: (kind: 'gstin' | 'udyam' | 'cin', number: string) => Promise<void>;
  vouch: (userId: string, supplierId?: string, note?: string) => Promise<void>;
  refresh: () => Promise<void>;
}
const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setMe(await call<Me>('/api/me')); } catch { setMe(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<Ctx>(() => ({
    me, loading, refresh,
    startCode: (role, identifier, displayName) => call('/api/auth/otp/start', { role, identifier, displayName }),
    signIn: async (role, identifier, code, displayName) => { await call('/api/auth/otp/verify', { role, identifier, code, displayName }); await refresh(); },
    signOut: async () => { await call('/api/auth/logout', {}); setMe(null); },
    verify: async (kind, number) => { await call(`/api/verify/${kind}`, { number }); await refresh(); },
    vouch: async (userId, supplierId, note) => { await call('/api/vouch', { userId, supplierId: supplierId || undefined, note: note || undefined }); await refresh(); },
  }), [me, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
