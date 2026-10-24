// Shared store: one SQLite file (node:sqlite, built into Node 22.13+). Every record is a JSON document in a table
// of its own kind, so the agents, the dashboards and the browser all read the same rows.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const TABLES = ['rfqs', 'offers', 'negotiations', 'scorecards', 'credentials', 'deals', 'workforce', 'sustainability', 'grievances', 'users', 'sessions', 'otps', 'verifications', 'buyerReviews'] as const;
export type Table = (typeof TABLES)[number];

export interface Doc { id: string }

export function openDb(path = process.env.SANGAM_DB ?? 'server/data/sangam.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  for (const t of TABLES) db.exec(`CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, json TEXT NOT NULL)`);
  // The event log of a negotiation, in order, so a finished negotiation can be replayed after a restart.
  db.exec('CREATE TABLE IF NOT EXISTS events (negotiation_id TEXT NOT NULL, seq INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY (negotiation_id, seq))');

  const put = <T extends Doc>(table: Table, doc: T): T => {
    db.prepare(`INSERT INTO ${table} (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json`).run(doc.id, JSON.stringify(doc));
    return doc;
  };
  const get = <T extends Doc>(table: Table, id: string): T | undefined => {
    const row = db.prepare(`SELECT json FROM ${table} WHERE id = ?`).get(id) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as T) : undefined;
  };
  // rowid keeps insertion order; an upsert of an existing id keeps its place
  const list = <T extends Doc>(table: Table): T[] =>
    (db.prepare(`SELECT json FROM ${table} ORDER BY rowid`).all() as { json: string }[]).map((r) => JSON.parse(r.json) as T);

  const del = (table: Table, id: string) => { db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id); };

  const addEvent = (negotiationId: string, event: unknown) => {
    const row = db.prepare('SELECT COALESCE(MAX(seq), -1) + 1 AS seq FROM events WHERE negotiation_id = ?').get(negotiationId) as { seq: number };
    db.prepare('INSERT INTO events (negotiation_id, seq, json) VALUES (?, ?, ?)').run(negotiationId, row.seq, JSON.stringify(event));
    return row.seq;
  };
  const events = <T>(negotiationId: string): T[] =>
    (db.prepare('SELECT json FROM events WHERE negotiation_id = ? ORDER BY seq').all(negotiationId) as { json: string }[]).map((r) => JSON.parse(r.json) as T);

  return { put, get, list, del, addEvent, events, close: () => db.close() };
}

export type Db = ReturnType<typeof openDb>;
