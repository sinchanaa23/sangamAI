// Who is using Sangam right now, built on P1's sign-in (src/auth/AuthContext.tsx). The server session is the real thing.
// If the server is not reachable (or busy), "Try as a buyer / supplier" falls back to an offline demo kept in this browser
// tab only: clearly labelled, never signed in, and nothing it writes reaches the shared store.
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { Verification } from '../auth/AuthContext';
import type { Workspace } from '../ui';
import { workspacesFor } from './roles';
import type { Role } from './roles';

const OFFLINE_KEY = 'sangam.offlineDemo';
const DEMO = {
  buyer: { identifier: 'demo.buyer@sangam.example', name: 'Demo buyer' },
  supplier: { identifier: '9000000010', name: 'Demo supplier' },
} as const;

type DemoRole = 'buyer' | 'supplier';
const readOffline = (): DemoRole | null => { try { const v = sessionStorage.getItem(OFFLINE_KEY); return v === 'buyer' || v === 'supplier' ? v : null; } catch { return null; } };

export interface Access {
  /** false while the first /api/me call is still running */
  ready: boolean;
  role: Role | null;
  name: string;
  /** server = a real session; offline = the labelled in-browser demo */
  mode: 'server' | 'offline' | null;
  verification: Verification | null;
  supplierId?: string;
  isTeam: boolean;
  workspaces: Workspace[];
  /** one click into the demo; the second value says why it went offline, if it did */
  signInDemo: (role: DemoRole) => Promise<{ offlineBecause?: string }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Access | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [offline, setOffline] = useState<DemoRole | null>(readOffline);

  const signInDemo = useCallback<Access['signInDemo']>(async (role) => {
    const d = DEMO[role];
    try {
      const r = await auth.startCode(role, d.identifier, d.name);
      // Only the mock sender hands the code back; with a real SMS or email sender the person types it in instead
      if (!r.devCode) throw new Error('This server sends a real code. Use the sign-in form.');
      await auth.signIn(role, d.identifier, r.devCode, d.name);
      return {};
    } catch (e) {
      try { sessionStorage.setItem(OFFLINE_KEY, role); } catch { /* private window: keep it in memory */ }
      setOffline(role);
      return { offlineBecause: (e as Error).message };
    }
  }, [auth]);

  const signOut = useCallback(async () => {
    try { sessionStorage.removeItem(OFFLINE_KEY); } catch { /* nothing stored */ }
    setOffline(null);
    if (!auth.me) return;
    // If the server cannot be reached the logout call fails; asking again who we are then also comes back empty, so the screen signs out
    try { await auth.signOut(); } catch { await auth.refresh(); }
  }, [auth]);

  const value = useMemo<Access>(() => {
    const me = auth.me;
    const role: Role | null = me ? me.user.role : offline;
    return {
      ready: !auth.loading,
      role,
      name: me ? me.user.displayName : offline ? `${DEMO[offline].name} (offline demo)` : '',
      mode: me ? 'server' : offline ? 'offline' : null,
      verification: me ? me.verification : null,
      supplierId: me?.user.supplierId,
      isTeam: role === 'ecosystem',
      workspaces: workspacesFor(role),
      signInDemo, signOut,
    };
  }, [auth.me, auth.loading, offline, signInDemo, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccess() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAccess outside AccessProvider');
  return c;
}
