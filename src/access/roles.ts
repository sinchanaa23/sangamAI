// Who may open what. Buyers and suppliers each get their own workspace plus the shared Ecosystem; a Sangam team account
// (the allowlisted third role in server/auth.ts) opens everything and sees the team-only tools.
import type { Workspace } from '../ui';

export type Role = 'buyer' | 'supplier' | 'ecosystem';

export const workspacesFor = (role: Role | null): Workspace[] =>
  role === 'buyer' ? ['buyer', 'ecosystem'] : role === 'supplier' ? ['supplier', 'ecosystem'] : role === 'ecosystem' ? ['buyer', 'supplier', 'ecosystem'] : [];

export const homeWorkspace = (role: Role | null): Workspace => (role === 'supplier' ? 'supplier' : role === 'ecosystem' ? 'ecosystem' : 'buyer');

export const ROLE_LABEL: Record<Role, string> = { buyer: 'Buyer', supplier: 'Supplier', ecosystem: 'Sangam team' };

/** Pages that moved into the Ecosystem. Old links such as go('buyer', 'negotiate') still land in the right place. */
const MOVED: Record<string, [Workspace, string]> = {
  'buyer:negotiate': ['ecosystem', 'negotiate'],
  'buyer:clusters': ['ecosystem', 'clusters'],
  'supplier:architect': ['ecosystem', 'architect'],
  'supplier:reviews': ['ecosystem', 'reviews'],
};
export const resolvePage = (w: Workspace, page: string): [Workspace, string] => MOVED[`${w}:${page}`] ?? [w, page];
