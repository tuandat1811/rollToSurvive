import { BALANCE } from '../content/balance.js';
import { REGION_DEFS } from '../content/defs.js';
import { EVENTS, type EventDef, type EventTrigger } from '../content/events.js';
import { AFTER_ACTION_CHANCE, FAMILY_COOLDOWN_DAYS, MISFORTUNE, NOVELTY, PACING_CATEGORY_MULT, RECOVERY_EVENTS, familyOf } from '../content/families.js';
import { EVENT_META, RARITY_WEIGHT } from '../content/meta.js';
import { type Bag, grantBag } from '../content/expeditions.js';
import { traitEventMult } from '../content/traits.js';
import type { Ctx } from './ctx.js';

/**
 * Event Director: picks events from trigger context (time, region, world state,
 * history, pacing). Order: ship schedule → scheduled chain follow-ups → forced
 * world events → one random notable event (soft-capped ~1–2 per day).
 */
export function runTrigger(ctx: Ctx, trigger: EventTrigger) {
  const s = ctx.s;
  if (s.status !== 'playing' || s.escape) return;

  if (trigger === 'slot_start') handleShips(ctx);

  // scheduled follow-ups (event chains). A follow-up waits until its context fits
  // (e.g. the player is back at camp) and lapses after its window expires.
  const due = s.scheduled.filter((e) => e.at <= ctx.now && EVENTS[e.eventId] && (EVENTS[e.eventId].trigger === trigger || (trigger !== 'night' && EVENTS[e.eventId].trigger !== 'night')));
  for (const e of due) {
    const def = EVENTS[e.eventId];
    if (def.choices && s.pending) continue; // wait until the current card is resolved
    if (def.eligible && !def.eligible(s, e.data)) {
      if (ctx.now > (e.expires ?? e.at + 16)) s.scheduled = s.scheduled.filter((x) => x !== e);
      continue;
    }
    s.scheduled = s.scheduled.filter((x) => x !== e);
    fire(ctx, def, e.data);
  }

  // forced world events (e.g. storm landfall, warnings)
  for (const def of Object.values(EVENTS)) {
    if (def.trigger !== trigger || !def.forced || def.omen) continue;
    if (!available(ctx, def)) continue;
    if (def.choices && s.pending) continue;
    if (def.forced(s)) fire(ctx, def);
  }

  // random notable
  if (s.pending) return;
  const E = BALANCE.events;
  let p = trigger === 'night' ? 0.3 : trigger === 'day_start' ? 0.25 : E.pacingChance[s.world.pacing];
  if (s.world.notableToday >= E.softCap) p *= E.overCapMult;
  if (trigger === 'day_start' && rough(s)) p = Math.max(p, MISFORTUNE.roughEventChance);
  if (s.day === 1 && s.slot === 0) p = 0; // let the player get their bearings
  if (!ctx.rng.chance(p)) return;
  const pool = Object.values(EVENTS)
    .filter((d) => d.trigger === trigger && !d.forced && !d.omen && d.weight && available(ctx, d) && !familyOnCooldown(ctx, d.id))
    .map((d) => [d, directorWeight(ctx, d)] as const)
    .filter(([, w]) => w > 0);
  const pick = ctx.rng.weighted(pool);
  if (pick) fire(ctx, pick);
}

/**
 * Director weight W = B × N × C × P × rarity × island trait
 * (base weight, novelty, context fit, pacing fit, rarity, island modifier).
 */
export function directorWeight(ctx: Ctx, def: EventDef): number {
  const s = ctx.s;
  const B = def.weight ? def.weight(s) : 0;
  if (B <= 0) return 0;
  const N = novelty(ctx, def.id);
  const C = def.context ? def.context(s) : 1;
  const P = PACING_CATEGORY_MULT[s.world.pacing][def.category] ?? 1;
  const meta = EVENT_META[def.id];
  const R = meta ? RARITY_WEIGHT[meta.rarity] : 1;
  return B * N * C * P * R * traitEventMult(s, def.id) * hardship(s, def);
}

const rough = (s: { world: { misfortune?: number } }) => (s.world.misfortune ?? 0) >= MISFORTUNE.rough;

/** controlled randomness: after a rough patch, ease off risky events and favour recovery */
function hardship(s: { world: { misfortune?: number } }, def: EventDef): number {
  if (!rough(s)) return 1;
  if (RECOVERY_EVENTS.has(def.id) || def.recovery) return MISFORTUNE.recoveryMult;
  if (def.risk >= 2) return MISFORTUNE.riskyMult;
  return 1;
}

/** Action events: what the player just did can trigger an event (fishing → snagged net…) */
export function runAfterAction(ctx: Ctx, actionId: string) {
  const s = ctx.s;
  if (s.status !== 'playing' || s.escape || s.pending) return;
  const E = BALANCE.events;
  let p = AFTER_ACTION_CHANCE;
  if (s.world.notableToday >= E.softCap) p *= E.overCapMult;
  const pool = Object.values(EVENTS)
    .filter((d) => d.trigger === 'after_action' && !d.omen && d.onAction?.includes(actionId) && available(ctx, d) && !familyOnCooldown(ctx, d.id))
    .map((d) => [d, directorWeight(ctx, d)] as const)
    .filter(([, w]) => w > 0);
  if (!pool.length || !ctx.rng.chance(p)) return;
  const pick = ctx.rng.weighted(pool);
  if (pick) fire(ctx, pick);
}

/** anti-repetition: no two random events of the same family within its cooldown */
export function familyOnCooldown(ctx: Ctx, eventId: string): boolean {
  const fam = familyOf(eventId);
  const days = FAMILY_COOLDOWN_DAYS[fam];
  if (!days) return false;
  const last = [...ctx.s.history].reverse().find((h) => familyOf(h.id) === fam);
  return !!last && ctx.now - last.at < days * 4;
}

/** novelty weighting: favour unseen events, damp repeats and recently-seen families */
export function novelty(ctx: Ctx, eventId: string): number {
  const s = ctx.s;
  const fam = familyOf(eventId);
  const seen = s.history.filter((h) => h.id === eventId).length;
  const recentFamily = s.history.filter((h) => familyOf(h.id) === fam && ctx.now - h.at < NOVELTY.familyWindowDays * 4).length;
  const base = seen === 0 ? NOVELTY.neverSeen : 1 / (1 + NOVELTY.perTimeSeen * seen);
  return base / (1 + NOVELTY.perRecentFamily * recentFamily);
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
  if ((RECOVERY_EVENTS.has(def.id) || def.recovery) && s.world.misfortune) s.world.misfortune = Math.max(0, s.world.misfortune - MISFORTUNE.recoveryRelief);
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
  const [gMin, gMax] = W.shipGap ?? [B.gapMinDays, B.gapMaxDays];
  const gap = ctx.rng.int(gMin, gMax) * 4;
  const nextDayStart = Math.floor((ctx.now + gap) / 4) * 4;
  W.ships.push(nextDayStart + ctx.rng.int(0, 3));

  const view = REGION_DEFS[s.location].seaView;
  if (W.weather === 'storm') {
    ctx.journal('Giữa cơn bão, bạn thoáng thấy ánh đèn một con tàu ngoài khơi — rồi nó biến mất.', 'escape');
    return;
  }
  if (view) {
    if (s.pending?.eventId === 'expedition_step') {
      grantBag(ctx, (s.pending.data?.bag ?? {}) as Bag);
      ctx.change('info', 'Bạn vội quay ra với những gì đã có');
    }
    if (s.pending) s.pending = null; // the ship takes priority over a minor card
    fire(ctx, EVENTS.ship_sighted);
  } else {
    fire(ctx, EVENTS.ship_missed);
  }
}
