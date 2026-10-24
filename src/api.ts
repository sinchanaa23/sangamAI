// Browser helpers for the Sangam server (server/index.ts, reached through the Vite /api proxy).
import { ROUTES } from './contracts';
import type { FairWorkScore, NegotiationEvent, NegotiationSummary, Rfq, WorkforceProfile } from './contracts';

const fill = (route: string, params: Record<string, string>) =>
  Object.entries(params).reduce((p, [k, v]) => p.replace(`:${k}`, encodeURIComponent(v)), route);

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
  const j = await r.json().catch(() => ({ error: `Server returned ${r.status}` }));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Error ${r.status}`);
  return j as T;
}
const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export type RfqInput = Omit<Rfq, 'id'> & { id?: string };
export type WorkforceInput = Omit<WorkforceProfile, 'supplierId' | 'updatedAt'>;

export const createRfq = (rfq: RfqInput) => call<Rfq>(ROUTES.rfq, send('POST', rfq));
export const listRfqs = () => call<Rfq[]>(ROUTES.rfq);

/** Start the agents on an RFQ (an id already stored, or a new one). Returns the negotiation to follow. */
export const startNegotiation = (rfq: string | RfqInput, supplierIds: string[] = []) =>
  call<NegotiationSummary>(ROUTES.negotiations, send('POST', typeof rfq === 'string' ? { rfqId: rfq, supplierIds } : { rfq, supplierIds }));
export const getNegotiation = (id: string) =>
  call<NegotiationSummary & { events?: NegotiationEvent[] }>(fill(ROUTES.negotiation, { id }));

/** Follow a negotiation live. Pass id "demo" for the recorded demo. Returns a function that stops listening. */
export function streamNegotiation(id: string, onEvent: (e: NegotiationEvent) => void, onError?: (e: Event) => void): () => void {
  const es = new EventSource(fill(ROUTES.negotiationStream, { id }));
  es.onmessage = (m) => {
    const e = JSON.parse(m.data) as NegotiationEvent;
    onEvent(e);
    if (e.type === 'end') es.close(); // the server closes after "end"; without this EventSource would reconnect and replay
  };
  es.onerror = (e) => { if (es.readyState === EventSource.CLOSED) onError?.(e); else es.close(); };
  return () => es.close();
}

export const getScorecard = (supplierId: string) => call<FairWorkScore>(fill(ROUTES.scorecard, { supplierId }));
export const saveWorkforce = (supplierId: string, profile: WorkforceInput) => call<WorkforceProfile>(fill(ROUTES.workforce, { id: supplierId }), send('PUT', profile));
export const getWorkforce = (supplierId: string) => call<WorkforceProfile>(fill(ROUTES.workforce, { id: supplierId }));
