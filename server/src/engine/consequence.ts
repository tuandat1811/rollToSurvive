// Consequence engine: applies registry consequences by id with parameters.
// - requires: a consequence that makes no sense in the current world is skipped
// - conflicts: two contradicting consequences on the same key inside one
//   transaction → the later one is dropped (first wins)
// - delayed: queued and resolved when due (precondition re-checked then)
// - every applied consequence is remembered in s.conLog (world memory)
import { CONSEQUENCES } from '../content/consequences.js';
import type { Ctx } from './ctx.js';
import type { ConParams } from './types.js';

const LOG_MAX = 300;

export function con(ctx: Ctx, id: string, params: ConParams = {}): boolean {
  const def = CONSEQUENCES[id];
  if (!def) throw new Error(`Unknown consequence: ${id}`);
  const s = ctx.s;
  if (def.type === 'delayed' && !params.__now) {
    const delay = Number(params.delay ?? def.delay ?? 2);
    s.delayed ??= [];
    s.delayed.push({ con: id, params, at: ctx.now + delay });
    return true;
  }
  if (def.requires && !def.requires(s, params)) return false;
  const key = def.key?.(params);
  if (key && def.conflicts?.length) {
    const clash = ctx.applied.some((a) => a.key === key && def.conflicts!.includes(a.id));
    if (clash) return false;
  }
  def.apply(ctx, params);
  ctx.applied.push({ id, key });
  s.conLog ??= [];
  s.conLog.push(key ? { code: def.code, at: ctx.now, key } : { code: def.code, at: ctx.now });
  if (s.conLog.length > LOG_MAX) s.conLog.splice(0, s.conLog.length - LOG_MAX);
  return true;
}

/** apply several consequences in order; returns how many took effect */
export function cons(ctx: Ctx, list: [string, ConParams?][]): number {
  let n = 0;
  for (const [id, p] of list) if (con(ctx, id, p ?? {})) n++;
  return n;
}

/** resolve delayed consequences whose time has come */
export function processDelayed(ctx: Ctx) {
  const s = ctx.s;
  if (!s.delayed?.length) return;
  const due = s.delayed.filter((d) => d.at <= ctx.now);
  if (!due.length) return;
  s.delayed = s.delayed.filter((d) => d.at > ctx.now);
  for (const d of due) con(ctx, d.con, { ...d.params, __now: true });
}

/** world memory query: has a consequence (by code) happened, optionally within the last n slots */
export function happened(s: { conLog?: { code: string; at: number; key?: string }[] }, code: string, withinSlots?: number, now = 0): boolean {
  return (s.conLog ?? []).some((c) => c.code === code && (withinSlots === undefined || now - c.at <= withinSlots));
}
