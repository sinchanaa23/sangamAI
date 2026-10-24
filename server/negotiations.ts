// A negotiation is an append-only list of events that any number of browsers can follow live.
// The replay runner and (later) the agent orchestrator both write through `emit`, so the stream route does not care which one is running.
import { readFileSync } from 'node:fs';
import type { NegotiationEvent, NegotiationSummary, Rfq } from '../src/contracts';
import type { Db } from './db';

export const fixture = JSON.parse(readFileSync(new URL('./fixtures/demo-negotiation.json', import.meta.url), 'utf8')) as { rfq: Rfq; events: NegotiationEvent[] };

interface Run { events: NegotiationEvent[]; done: boolean; listeners: Set<() => void> }

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const replayDelayMs = () => Number(process.env.SANGAM_REPLAY_MS ?? 600);

export function createNegotiations(db: Db) {
  const runs = new Map<string, Run>();

  const emit = (id: string, event: NegotiationEvent) => {
    const run = runs.get(id);
    if (!run) return;
    db.addEvent(id, event);
    run.events.push(event);
    if (event.type === 'end') {
      run.done = true;
      const s = db.get<NegotiationSummary>('negotiations', id);
      if (s) db.put('negotiations', { ...s, status: 'done', outcome: event.outcome, dealId: event.dealId });
    }
    run.listeners.forEach((l) => l());
  };

  const start = (rfq: Rfq, mode: NegotiationSummary['mode'] = 'replay'): NegotiationSummary => {
    const id = `neg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const summary: NegotiationSummary = { id, rfqId: rfq.id, status: 'running', mode };
    db.put('negotiations', summary);
    runs.set(id, { events: [], done: false, listeners: new Set() });
    if (mode === 'replay') {
      void (async () => {
        for (const e of fixture.events) { await sleep(replayDelayMs()); emit(id, e); }
      })();
    }
    return summary;
  };

  /** Yields every event of a negotiation, past ones first, then new ones until it ends. */
  async function* follow(id: string, signal?: AbortSignal): AsyncGenerator<NegotiationEvent> {
    const run = runs.get(id);
    if (!run) { yield* db.events<NegotiationEvent>(id); return; } // finished before a restart: the log is in the database
    let i = 0;
    while (!signal?.aborted) {
      while (i < run.events.length) yield run.events[i++]!;
      if (run.done) return;
      await new Promise<void>((resolve) => {
        const wake = () => { run.listeners.delete(wake); resolve(); };
        run.listeners.add(wake);
        signal?.addEventListener('abort', wake, { once: true });
      });
    }
  }

  /** The recorded demo, played to one viewer with no key and no database writes. */
  async function* demo(): AsyncGenerator<NegotiationEvent> {
    for (const e of fixture.events) { await sleep(replayDelayMs()); yield e; }
  }

  return { start, follow, demo };
}
