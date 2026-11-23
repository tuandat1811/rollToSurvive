import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { DatabaseSync as DatabaseSyncT } from 'node:sqlite';
import type { GameState } from './engine/types.ts';

// loaded via require so bundlers/test runners that don't know `node:sqlite` leave it alone
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: typeof DatabaseSyncT };

const DB_PATH = process.env.RTS_DB ?? resolve(import.meta.dirname, '../../data/rts.db');

export class Store {
  private db: DatabaseSyncT;

  constructor(path = DB_PATH) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        day INTEGER NOT NULL,
        slot INTEGER NOT NULL,
        version INTEGER NOT NULL,
        state TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  create(id: string, s: GameState) {
    const now = Date.now();
    this.db
      .prepare('INSERT INTO runs (id, name, status, day, slot, version, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, s.name, s.status, s.day, s.slot, s.version, JSON.stringify(s), now, now);
  }

  get(id: string): GameState | null {
    const row = this.db.prepare('SELECT state FROM runs WHERE id = ?').get(id) as { state: string } | undefined;
    return row ? (JSON.parse(row.state) as GameState) : null;
  }

  /**
   * Atomic commit with optimistic concurrency: succeeds only if nobody else
   * committed since `expectedVersion` (prevents double-submits and duplicate rewards).
   */
  commit(id: string, s: GameState, expectedVersion: number): boolean {
    const res = this.db
      .prepare('UPDATE runs SET name=?, status=?, day=?, slot=?, version=?, state=?, updated_at=? WHERE id=? AND version=?')
      .run(s.name, s.status, s.day, s.slot, s.version, JSON.stringify(s), Date.now(), id, expectedVersion);
    return Number(res.changes) === 1;
  }

  summaries(ids: string[]) {
    if (!ids.length) return [];
    const q = `SELECT id, name, status, day, slot, updated_at FROM runs WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY updated_at DESC`;
    return (this.db.prepare(q).all(...ids) as { id: string; name: string; status: string; day: number; slot: number; updated_at: number }[]).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status as GameState['status'],
      day: r.day,
      slot: r.slot,
      updatedAt: r.updated_at,
    }));
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM runs WHERE id = ?').run(id);
  }
}
