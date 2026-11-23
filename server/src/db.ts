import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import type { GameState } from './engine/types.js';

/**
 * Where runs are stored:
 * - TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN): hosted libSQL/Turso — required on
 *   Vercel, whose functions cannot keep a local file between requests.
 * - otherwise a local SQLite file (RTS_DB, default data/rts.db), or ':memory:'.
 */
function defaultUrl(): { url: string; authToken?: string } {
  if (process.env.TURSO_DATABASE_URL) return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
  if (process.env.VERCEL)
    throw new Error('Thiếu TURSO_DATABASE_URL: trên Vercel cần kết nối database Turso (Storage → Turso) để lưu ván chơi.');
  const path = process.env.RTS_DB ?? resolve(import.meta.dirname, '../../data/rts.db');
  if (path === ':memory:') return { url: ':memory:' };
  mkdirSync(resolve(path, '..'), { recursive: true });
  return { url: `file:${path}` };
}

export class Store {
  private db: Client;
  private ready: Promise<void>;

  constructor(url?: string) {
    const cfg = url ? { url } : defaultUrl();
    this.db = createClient(cfg);
    this.ready = this.db
      .execute(
        `CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          status TEXT NOT NULL,
          day INTEGER NOT NULL,
          slot INTEGER NOT NULL,
          version INTEGER NOT NULL,
          state TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
      )
      .then(() => undefined);
  }

  async create(id: string, s: GameState) {
    await this.ready;
    const now = Date.now();
    await this.db.execute({
      sql: 'INSERT INTO runs (id, name, status, day, slot, version, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      args: [id, s.name, s.status, s.day, s.slot, s.version, JSON.stringify(s), now, now],
    });
  }

  async get(id: string): Promise<GameState | null> {
    await this.ready;
    const res = await this.db.execute({ sql: 'SELECT state FROM runs WHERE id = ?', args: [id] });
    const row = res.rows[0];
    return row ? (JSON.parse(String(row.state)) as GameState) : null;
  }

  /**
   * Atomic commit with optimistic concurrency: succeeds only if nobody else
   * committed since `expectedVersion` (prevents double-submits and duplicate rewards).
   */
  async commit(id: string, s: GameState, expectedVersion: number): Promise<boolean> {
    await this.ready;
    const res = await this.db.execute({
      sql: 'UPDATE runs SET name=?, status=?, day=?, slot=?, version=?, state=?, updated_at=? WHERE id=? AND version=?',
      args: [s.name, s.status, s.day, s.slot, s.version, JSON.stringify(s), Date.now(), id, expectedVersion],
    });
    return res.rowsAffected === 1;
  }

  async summaries(ids: string[]) {
    if (!ids.length) return [];
    await this.ready;
    const res = await this.db.execute({
      sql: `SELECT id, name, status, day, slot, updated_at FROM runs WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY updated_at DESC`,
      args: ids,
    });
    return res.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      status: String(r.status) as GameState['status'],
      day: Number(r.day),
      slot: Number(r.slot),
      updatedAt: Number(r.updated_at),
    }));
  }

  async delete(id: string) {
    await this.ready;
    await this.db.execute({ sql: 'DELETE FROM runs WHERE id = ?', args: [id] });
  }
}
