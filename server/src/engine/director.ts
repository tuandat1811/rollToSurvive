import { BALANCE } from '../content/balance.ts';
import { REGION_DEFS } from '../content/defs.ts';
import { EVENTS, type EventDef, type EventTrigger } from '../content/events.ts';
import type { Ctx } from './ctx.ts';

/**
 * Event Director: picks events from trigger context (time, region, world state,
 * history, pacing). Order: ship schedule → scheduled chain follow-ups → forced
 * world events → one random notable event (soft-capped ~1–2 per day).
 */
export function runTrigger(ctx: Ctx, trigger: EventTrigger) {
  const s = ctx.s;
  if (s.status !== 'playing' || s.escape) return;

  if (trigger === 'slot_start') handleShips(ctx);

  // scheduled follow-ups
  const due = s.scheduled.filter((e) => e.at <= ctx.now && EVENTS[e.eventId] && (EVENTS[e.eventId].trigger === trigger || trigger !== 'night'));
  for (const e of due) {
    const def = EVENTS[e.eventId];
    if (def.choices && s.pending) continue; // wait until the current card is resolved
    s.scheduled = s.scheduled.filter((x) => x !== e);
    if (def.eligible && !def.eligible(s, e.data)) continue;
    fire(ctx, def, e.data);
  }

  // forced world events (e.g. storm landfall, warnings)
  for (const def of Object.values(EVENTS)) {
    if (def.trigger !== trigger || !def.forced) continue;
    if (!available(ctx, def)) continue;
    if (def.choices && s.pending) continue;
    if (def.forced(s)) fire(ctx, def);
  }

  // random notable
  if (s.pending) return;
  const E = BALANCE.events;
  let p = trigger === 'night' ? 0.3 : trigger === 'day_start' ? 0.25 : E.pacingChance[s.world.pacing];
  if (s.world.notableToday >= E.softCap) p *= E.overCapMult;
  if (s.day === 1 && s.slot === 0) p = 0; // let the player get their bearings
  if (!ctx.rng.chance(p)) return;
  const pool = Object.values(EVENTS)
    .filter((d) => d.trigger === trigger && !d.forced && d.weight && available(ctx, d))
    .map((d) => [d, d.weight!(s)] as const)
    .filter(([, w]) => w > 0);
  const pick = ctx.rng.weighted(pool);
  if (pick) fire(ctx, pick);
}

function available(ctx: Ctx, def: EventDef): boolean {
  const s = ctx.s;
  const hist = s.history.filter((h) => h.id === def.id);
  if (def.once && hist.length) return false;
  if (def.cooldownDays && hist.length) {
    const last = hist[hist.length - 1].at;
    if (ctx.now - last < def.cooldownDays * 4) return false;
  }
  if (def.eligible && !def.eligible(s)) return false;
  return true;
}

export function fire(ctx: Ctx, def: EventDef, data?: Record<string, unknown>) {
  const s = ctx.s;
  s.history.push({ id: def.id, at: ctx.now });
  if (s.history.length > 400) s.history.splice(0, s.history.length - 400);
  s.stats.events++;
  if (def.notable) s.world.notableToday++;

  const captured = ctx.capture(() => (def.passive ? def.passive(ctx, data) : undefined));
  const extra = captured.value ? ` ${captured.value}` : '';
  if (def.journal) ctx.journal(typeof def.journal === 'string' ? def.journal : `${def.title}: ${def.text(s, data)}`, 'event');

  const choices = def.choices ? def.choices(s, data) : [];
  if (choices.length) {
    s.pending = { uid: ctx.nextUid(), eventId: def.id, data, changes: captured.changes };
    if (extra) s.pending.data = { ...(data ?? {}), extra };
  } else {
    ctx.notice({ title: def.title, icon: def.icon, text: def.text(s, data) + extra, changes: captured.changes });
  }
}

function handleShips(ctx: Ctx) {
  const s = ctx.s;
  const W = s.world;
  if (!W.ships.length || W.ships[0] > ctx.now) return;
  W.ships.shift();
  const B = BALANCE.ships;
  const gap = ctx.rng.int(B.gapMinDays, B.gapMaxDays) * 4;
  const nextDayStart = Math.floor((ctx.now + gap) / 4) * 4;
  W.ships.push(nextDayStart + ctx.rng.int(0, 3));

  const view = REGION_DEFS[s.location].seaView;
  if (W.weather === 'storm') {
    ctx.journal('Giữa cơn bão, bạn thoáng thấy ánh đèn một con tàu ngoài khơi — rồi nó biến mất.', 'escape');
    return;
  }
  if (view) {
    if (s.pending) s.pending = null; // the ship takes priority over a minor card
    fire(ctx, EVENTS.ship_sighted);
  } else {
    fire(ctx, EVENTS.ship_missed);
  }
}
