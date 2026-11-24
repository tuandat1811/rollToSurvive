import { BALANCE } from '../content/balance.js';
import { CONDITIONS } from '../content/conditions.js';
import { WEATHER_DEFS } from '../content/weather.js';
import { activePrep, prepFlag } from '../content/prep.js';
import { Ctx } from './ctx.js';
import type { Band, CheckSpec, GameState, RollInfo, SkillId, Tier } from './types.js';

export const TIER_ORDER: Tier[] = ['crit_failure', 'failure', 'partial', 'success', 'crit_success'];

export const TIER_NAMES: Record<Tier, string> = {
  crit_success: 'Thành công vang dội',
  success: 'Thành công',
  partial: 'Thành công một phần',
  failure: 'Thất bại',
  crit_failure: 'Thất bại thảm hại',
};

export interface ResolvedCheck {
  spec: CheckSpec;
  attrMod: number;
  skillMod: number;
  mods: { label: string; value: number }[];
  totalMod: number;
  dc: number;
  adv: number;
  /** preparation that grants advantage on this check */
  prepared?: string;
  prepTag?: string;
}

/** situational modifiers derived from the character and the world */
export function situationalMods(s: GameState, spec: CheckSpec): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = [];
  for (const c of s.conditions) {
    const def = CONDITIONS[c.id];
    const v = def.checkMod(c.sev, spec.attr);
    if (v) out.push({ label: def.name(c.sev), value: v });
  }
  const t = BALANCE.thresholds;
  if (s.vitals.hunger < t.low) out.push({ label: 'Đói', value: -1 });
  if (s.vitals.thirst < t.low) out.push({ label: 'Khát', value: -1 });
  if (s.vitals.energy < t.exhausted) out.push({ label: 'Kiệt sức', value: -2 });
  for (const r of WEATHER_DEFS[s.world.weather].rules) {
    if (r.outdoor && !spec.outdoor) continue;
    if (r.attrs && !r.attrs.includes(spec.attr)) continue;
    if (r.tags && !r.tags.some((t) => spec.tags?.includes(t))) continue;
    out.push({ label: `${WEATHER_DEFS[s.world.weather].icon} ${r.label}`, value: r.value });
  }
  return out;
}

export function resolveCheck(s: GameState, spec: CheckSpec): ResolvedCheck {
  const attrMod = s.attrs[spec.attr];
  const skillMod = spec.skill ? s.skills[spec.skill].lvl : 0;
  const mods = [...(spec.mods ?? []).filter((m) => m.value !== 0), ...situationalMods(s, spec)];
  const totalMod = attrMod + skillMod + mods.reduce((a, m) => a + m.value, 0);
  const prep = activePrep(s, spec.tags, (s.day - 1) * 4 + s.slot);
  const adv = Math.sign((spec.adv ?? 0) + (prep ? 1 : 0));
  const dc = spec.opposed ? 11 + spec.opposed.bonus : spec.dc;
  return { spec, attrMod, skillMod, mods, totalMod, dc, adv, prepared: prep?.label, prepTag: prep?.tag };
}

export function tierFor(nat: number, total: number, dc: number, crit: CheckSpec['crit'] = 'standard'): Tier {
  const m = total - dc;
  let t = m >= 10 ? 4 : m >= 0 ? 3 : m >= -4 ? 2 : m >= -9 ? 1 : 0;
  if (crit !== 'none') {
    if (nat === 20) t = Math.min(4, t + 1);
    if (nat === 1) t = Math.max(0, t - 1);
  }
  if (crit === 'safe') t = Math.max(1, t);
  return TIER_ORDER[t];
}

/** exact probability distribution of tiers */
export function odds(rc: ResolvedCheck): Record<Tier, number> {
  if (rc.spec.opposed) {
    const acc: Record<Tier, number> = { crit_failure: 0, failure: 0, partial: 0, success: 0, crit_success: 0 };
    for (let o = 1; o <= 20; o++) {
      const part = odds({ ...rc, spec: { ...rc.spec, opposed: undefined }, dc: o + rc.spec.opposed.bonus });
      for (const t of TIER_ORDER) acc[t] += part[t] / 20;
    }
    return acc;
  }
  const out: Record<Tier, number> = { crit_failure: 0, failure: 0, partial: 0, success: 0, crit_success: 0 };
  for (let a = 1; a <= 20; a++) {
    if (rc.adv === 0) {
      out[tierFor(a, a + rc.totalMod, rc.dc, rc.spec.crit)] += 1 / 20;
      continue;
    }
    for (let b = 1; b <= 20; b++) {
      const n = rc.adv > 0 ? Math.max(a, b) : Math.min(a, b);
      out[tierFor(n, n + rc.totalMod, rc.dc, rc.spec.crit)] += 1 / 400;
    }
  }
  return out;
}

/**
 * Readable thresholds: which kept-die faces (and totals) lead to each tier.
 * Derived by evaluating every face with the real rules, so natural 20/1 effects
 * are included. Tiers are monotonic in the die face, so each band is contiguous.
 */
export function bands(totalMod: number, dc: number, crit: CheckSpec['crit']): Band[] {
  const out: Band[] = [];
  for (let face = 1; face <= 20; face++) {
    const tier = tierFor(face, face + totalMod, dc, crit);
    const last = out[out.length - 1];
    if (last && last.tier === tier) {
      last.faceMax = face;
      last.totalMax = face + totalMod;
    } else out.push({ tier, faceMin: face, faceMax: face, totalMin: face + totalMod, totalMax: face + totalMod });
  }
  return out.reverse(); // best first
}

/** lowest kept-die face that gives Success or better; null if impossible */
export function successFace(b: Band[]): number | null {
  const ok = b.filter((x) => x.tier === 'success' || x.tier === 'crit_success');
  return ok.length ? Math.min(...ok.map((x) => x.faceMin)) : null;
}

export function roll(ctx: Ctx, spec: CheckSpec): RollInfo {
  const rc = resolveCheck(ctx.s, spec);
  const dice = rc.adv === 0 ? [ctx.rng.d20()] : [ctx.rng.d20(), ctx.rng.d20()];
  const natural = rc.adv > 0 ? Math.max(...dice) : rc.adv < 0 ? Math.min(...dice) : dice[0];
  const total = natural + rc.totalMod;
  let opp: RollInfo['opp'];
  if (spec.opposed) {
    const die = ctx.rng.d20();
    opp = { label: spec.opposed.label, icon: spec.opposed.icon, bonus: spec.opposed.bonus, die, total: die + spec.opposed.bonus };
    rc.dc = opp.total;
  }
  const tier = tierFor(natural, total, rc.dc, spec.crit);
  const s = ctx.s;
  if (rc.prepTag) {
    delete s.flags[prepFlag(rc.prepTag)];
    ctx.change('info', `⭐ Đã dùng lợi thế: ${rc.prepared}`);
  }
  s.stats.checks++;
  if (tier === 'crit_success') s.stats.crits++;
  if (tier === 'crit_failure') s.stats.critFails++;
  return {
    label: spec.label ?? '',
    attr: spec.attr,
    attrMod: rc.attrMod,
    skill: spec.skill,
    skillMod: rc.skillMod,
    mods: rc.mods,
    dc: rc.dc,
    dice,
    adv: rc.adv,
    natural,
    total,
    tier,
    bands: bands(rc.totalMod, rc.dc, spec.crit),
    crit: spec.crit ?? 'standard',
    opp,
    prepared: rc.prepared,
  };
}

/** Challenge-based XP: harder checks teach more; repeating easy ones teaches little. */
export function awardXp(ctx: Ctx, spec: CheckSpec, info: RollInfo, key: string) {
  if (!spec.skill || spec.xp === false) return;
  const skill: SkillId = spec.skill;
  const totalMod = info.total - info.natural;
  const gap = info.dc - (totalMod + 10.5);
  let xp = Math.max(1, Math.min(18, 6 + gap * 1.5));
  const mult: Record<Tier, number> = { crit_success: 1.25, success: 1, partial: 0.9, failure: 0.75, crit_failure: 0.5 };
  xp *= mult[info.tier];
  const s = ctx.s;
  const recent = s.recentActions.filter((r) => r.key === key && r.at >= ctx.now - BALANCE.xp.repeatWindowSlots).length;
  const everDone = s.flags[`done:${key}`];
  if (!everDone) xp *= BALANCE.xp.novelty;
  else if (gap < 0) xp /= 1 + BALANCE.xp.repeatFactor * recent;
  ctx.grantXp(skill, Math.max(1, xp));
}
