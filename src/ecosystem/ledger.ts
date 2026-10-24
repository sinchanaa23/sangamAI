// Ecosystem records: signed credentials, worker grievances and Auditor flags.
// Uses the shared server (server/credentials.ts, server/grievances.ts) when it is running,
// and this browser's storage otherwise, so the pages work before the server lands.
import { useSyncExternalStore } from 'react';
import { generateIssuerKey, signCredential, verifyCredential } from './vc';
import type { Credential, CredentialKind, IssuerKey } from './vc';
import type { DealRecord } from './impact';

export type GrievanceCategory = 'wages' | 'hours' | 'safety' | 'harassment' | 'child-or-forced' | 'other';

export interface Grievance {
  id: string;
  sellerId: string;
  category: GrievanceCategory;
  text: string;
  at: string;
  status: 'open' | 'resolved';
  resolution?: string;
}

export interface AuditFlag {
  id: string;
  sellerId: string;
  reqId?: string;
  reason: string;
  raisedBy: 'Auditor Agent' | 'Grievance';
  at: string;
  status: 'open' | 'approved' | 'blocked';
  note?: string;
  /** what gets signed as an audit credential if a person approves */
  subject?: Record<string, unknown>;
}

interface Ledger {
  credentials: Credential[];
  grievances: Grievance[];
  flags: AuditFlag[];
  /** deals the agents confirmed in this browser (see negotiation.ts) */
  deals: DealRecord[];
  browserKey?: { key: IssuerKey; privateJwk: JsonWebKey };
}

export const CATEGORY_LABEL: Record<GrievanceCategory, string> = {
  wages: 'Wages unpaid or below what was agreed',
  hours: 'Too many hours or forced overtime',
  safety: 'Unsafe work or no protective equipment',
  harassment: 'Harassment or discrimination',
  'child-or-forced': 'Child labour or forced labour',
  other: 'Something else',
};

const KEY = 'sangam-ecosystem-v1';
const load = (): Ledger => {
  try { return { credentials: [], grievances: [], flags: [], deals: [], ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { credentials: [], grievances: [], flags: [], deals: [] }; }
};
let ledger: Ledger = load();
const listeners = new Set<() => void>();
const set = (fn: (l: Ledger) => Ledger) => {
  ledger = fn(ledger);
  try { localStorage.setItem(KEY, JSON.stringify(ledger)); } catch { /* storage full or blocked: keep in memory */ }
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

export function useLedger() {
  return useSyncExternalStore(subscribe, () => ledger);
}

const id = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

async function api<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const r = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

/** The server's issuer key, or null while the shared server isn't running. */
let serverKey: Promise<IssuerKey | null> | null = null;
export const getServerKey = () => (serverKey ??= api<IssuerKey>('/api/credentials/issuer'));

async function browserKey() {
  if (!ledger.browserKey) {
    const k = await generateIssuerKey('Demo key in this browser');
    set((l) => ({ ...l, browserKey: k }));
  }
  return ledger.browserKey!;
}

/** Keys this verifier trusts: the Sangam server's, plus this browser's demo key. */
export async function trustedKeys(): Promise<IssuerKey[]> {
  const out: IssuerKey[] = [];
  const s = await getServerKey();
  if (s) out.push(s);
  if (ledger.browserKey) out.push(ledger.browserKey.key);
  return out;
}

/** Sign with the Sangam server when it is up; otherwise with this browser's demo key. */
export async function issue(type: CredentialKind, subject: Record<string, unknown>): Promise<Credential> {
  const fromServer = (await getServerKey()) && await api<Credential>('/api/credentials/sign', { type, subject });
  const c = fromServer ?? await (async () => { const k = await browserKey(); return signCredential(type, subject, k.key, k.privateJwk); })();
  set((l) => ({ ...l, credentials: [c, ...l.credentials] }));
  return c;
}

export const verify = async (c: unknown) => verifyCredential(c, await trustedKeys());

/** Adds the records of one confirmed deal; a deal already recorded is left as it is. */
export function addDeal(records: DealRecord[]) {
  if (!records.length || ledger.deals.some((d) => d.reqId === records[0].reqId)) return false;
  set((l) => ({ ...l, deals: [...records, ...l.deals] }));
  return true;
}

export function credentialsFor(sellerId: string) {
  return ledger.credentials.filter((c) => c.subject.supplierId === sellerId);
}

export function reportGrievance(g: Omit<Grievance, 'id' | 'at' | 'status'>) {
  const rec: Grievance = { ...g, id: id('grv'), at: new Date().toISOString(), status: 'open' };
  set((l) => ({ ...l, grievances: [rec, ...l.grievances] }));
  void api('/api/grievances', rec);
  // The gravest reports go straight to the Verification desk as a flag
  if (g.category === 'child-or-forced') {
    raiseFlag({ sellerId: g.sellerId, reason: `Worker report: ${CATEGORY_LABEL[g.category].toLowerCase()}`, raisedBy: 'Grievance' });
  }
  return rec;
}

export function resolveGrievance(gid: string, resolution: string) {
  set((l) => ({ ...l, grievances: l.grievances.map((g) => (g.id === gid ? { ...g, status: 'resolved', resolution } : g)) }));
  void api(`/api/grievances/${gid}/resolve`, { resolution });
}

/** Open grievances for a supplier. P3's Fair Work Scorecard lowers the grade one step while any are open. */
export const openGrievanceCount = (sellerId: string) => ledger.grievances.filter((g) => g.sellerId === sellerId && g.status === 'open').length;

export function raiseFlag(f: Omit<AuditFlag, 'id' | 'at' | 'status'>) {
  const rec: AuditFlag = { ...f, id: id('flag'), at: new Date().toISOString(), status: 'open' };
  set((l) => ({ ...l, flags: [rec, ...l.flags] }));
  return rec;
}

/** A person decides on an Auditor flag; approving signs the audit credential. */
export async function decideFlag(fid: string, decision: 'approved' | 'blocked', note: string) {
  const f = ledger.flags.find((x) => x.id === fid);
  set((l) => ({ ...l, flags: l.flags.map((x) => (x.id === fid ? { ...x, status: decision, note } : x)) }));
  if (f && decision === 'approved') {
    await issue('AuditCredential', { supplierId: f.sellerId, reqId: f.reqId, outcome: 'approved after human review', reviewNote: note, ...(f.subject ?? {}) });
  }
}
