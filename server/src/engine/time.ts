import { BALANCE } from '../content/balance.ts';
import { REGION_DEFS, WEATHER_DEFS, WEATHER_MARKOV } from '../content/defs.ts';
import { ITEMS } from '../content/items.ts';
import { Ctx, fireLit, hasCondition, hasStructure, shelterAt, structuresAt } from './ctx.ts';
import { runTrigger } from './director.ts';
import type { ItemStack, Pacing, WeatherId } from './types.ts';

const D = BALANCE.decay;
const T = BALANCE.thresholds;

/** quiet decay with threshold warnings (avoids notification spam) */
function decay(ctx: Ctx, id: 'hunger' | 'thirst', amount: number) {
  const v = ctx.s.vitals;
  const before = v[id];
  v[id] = Math.max(0, Math.round((before - amount) * 10) / 10);
  const label = id === 'hunger' ? 'đói' : 'khát';
  if (before >= T.low && v[id] < T.low) ctx.change('bad', `Bạn đang ${label}${id === 'hunger' ? ' (-1 mọi kiểm tra)' : ' (-1 mọi kiểm tra)'}`);
  if (before >= T.critical && v[id] < T.critical && v[id] > 0) ctx.change('bad', `Bạn ${label} lả đi — cần ${id === 'hunger' ? 'ăn' : 'uống'} ngay!`);
}

function applyNeedsDamage(ctx: Ctx) {
  const v = ctx.s.vitals;
  if (v.hunger <= 0) ctx.vital('health', -D.starveDamage, 'Đói lả');
  if (v.thirst <= 0) ctx.vital('health', -D.dehydrateDamage, 'Mất nước');
}

function endOfSlot(ctx: Ctx) {
  const s = ctx.s;
  const thirstMult = WEATHER_DEFS[s.world.weather].thirst ?? 1;
  decay(ctx, 'hunger', D.hungerPerSlot);
  decay(ctx, 'thirst', D.thirstPerSlot * thirstMult +(hasCondition(s, 'illness') ? D.illnessThirstExtra : 0));
  applyNeedsDamage(ctx);
  if (hasCondition(s, 'poisoned')) ctx.vital('health', -5, 'Trúng độc');
  const inj = s.conditions.find((c) => c.id === 'injury');
  if (inj && inj.sev >= 3 && !inj.treated) ctx.vital('health', -2, 'Mất máu');
  // expire timed conditions
  const next = ctx.now + 1;
  for (const c of [...s.conditions]) if (c.until !== undefined && c.until <= next) ctx.removeCondition(c.id);
}

export function checkDeath(ctx: Ctx): boolean {
  const s = ctx.s;
  if (s.status !== 'playing') return true;
  if (s.vitals.health > 0) return false;
  s.status = 'dead';
  const cause = s.stats.lastDamage || 'Kiệt quệ';
  s.ending = {
    kind: 'dead',
    title: 'Bạn đã không qua khỏi',
    text: `Nguyên nhân: ${cause}. Bạn đã cầm cự được ${s.day} ngày trên hòn đảo.`,
    day: s.day,
  };
  ctx.journal(`Ngày ${s.day}: ${cause}. Hành trình kết thúc tại đây.`, 'event');
  return true;
}

function night(ctx: Ctx) {
  const s = ctx.s;
  const N = BALANCE.night;
  const shelter = shelterAt(s, s.location);
  const atBase = s.baseRegion === s.location;
  const fire = fireLit(s, s.location);
  const w = s.world.weather;
  const nightChanges = ctx.capture(() => {
    decay(ctx, 'hunger', D.hungerNight);
    decay(ctx, 'thirst', D.thirstNight * (hasCondition(s, 'illness') ? 1.3 : 1));
    applyNeedsDamage(ctx);

    const exposure = WEATHER_DEFS[w].exposure ?? 0;
    if (!shelter && exposure > 0) {
      if (ctx.rng.chance(exposure)) ctx.addCondition('exposure', 1, 8);
      if (w === 'storm') ctx.vital('health', -8, 'Ngủ ngoài trời giữa bão');
    }

    // energy recovery
    let energy = shelter === 'hut' ? N.energyHut : shelter === 'lean_to' ? N.energyLeanTo : shelter === 'cave' ? N.energyCave : N.energyBase;
    if (!shelter && s.skills.survival.lvl >= 3) energy += 10;
    if (fire) energy += N.energyFire;
    const shelterStruct = atBase ? structuresAt(s, s.location).find((x) => x.id === 'hut' || x.id === 'lean_to') : undefined;
    if (shelterStruct && shelterStruct.integrity < 40 && (WEATHER_DEFS[w].rainWater ?? 0) > 0) {
      energy -= 12;
      ctx.change('bad', 'Mái che dột nát, ngủ không yên');
    }
    if (s.vitals.hunger < T.low || s.vitals.thirst < T.low) energy -= N.energyPenaltyNeeds;
    if (hasCondition(s, 'exposure')) energy -= N.energyPenaltyExposure;
    if (hasCondition(s, 'illness')) energy -= N.energyPenaltyIllness;
    ctx.vital('energy', Math.max(5, energy), 'Ngủ qua đêm');

    // health regen
    const needsOk = s.vitals.hunger >= N.regenNeedMin && s.vitals.thirst >= N.regenNeedMin;
    const sick = hasCondition(s, 'infection') || hasCondition(s, 'illness') || hasCondition(s, 'poisoned');
    if (needsOk && !sick) ctx.vital('health', N.healthRegen + (shelter ? N.healthRegenShelter : 0), 'Hồi phục qua đêm');

    // conditions evolve
    const inj = s.conditions.find((c) => c.id === 'injury');
    if (inj) {
      if (inj.sev === 1) {
        if (ctx.rng.chance(shelter ? 0.7 : 0.5)) ctx.reduceCondition('injury');
      } else {
        const heal = inj.treated ? (inj.sev === 2 ? 0.4 : 0.3) : 0.12;
        if (ctx.rng.chance(heal)) ctx.reduceCondition('injury');
        else if (!inj.treated && ctx.rng.chance(inj.sev >= 3 ? 0.3 : 0.15)) {
          ctx.addCondition('infection');
          ctx.journal('Vết thương không được băng bó đã bị nhiễm trùng.', 'consequence');
        }
      }
    }
    if (hasCondition(s, 'infection')) {
      ctx.vital('health', -6, 'Nhiễm trùng');
      if (ctx.rng.chance(0.1)) ctx.removeCondition('infection');
    }
    if (hasCondition(s, 'illness') && ctx.rng.chance(shelter ? 0.65 : 0.5)) ctx.reduceCondition('illness');
    if (hasCondition(s, 'exposure') && ((shelter && fire) || ctx.rng.chance(0.35))) ctx.removeCondition('exposure');

    runTrigger(ctx, 'night');

    spoil(ctx);
    regenerate(ctx);
  });

  const milestone = BALANCE.milestones as readonly number[];
  if (milestone.includes(s.day)) {
    s.attrPoints++;
    nightChanges.changes.push({ kind: 'good', text: `⭐ Sống sót ${s.day} ngày: +1 điểm thuộc tính` });
    ctx.journal(`Đã sống sót ${s.day} ngày. Cơ thể thích nghi dần — nhận 1 điểm thuộc tính.`, 'milestone');
    ctx.addCondition('determined', 1, 8);
  }

  const where = shelter === 'hut' ? 'trong chòi' : shelter === 'lean_to' ? 'trong lều' : shelter === 'cave' ? 'trong hang đá' : 'ngoài trời';
  ctx.notice({
    title: `Đêm thứ ${s.day}`,
    icon: '🌙',
    text: `Bạn ngủ ${where} tại ${REGION_DEFS[s.location].name}${fire ? ', cạnh đống lửa ấm' : ''}.`,
    changes: nightChanges.changes,
  });
}

function spoil(ctx: Ctx) {
  const s = ctx.s;
  const limit = ctx.now + 1;
  const hasRack = s.baseRegion ? hasStructure(s, 'storage_rack', s.baseRegion) : false;
  if (hasRack) for (const st of s.storage) if (st.exp !== undefined) st.exp += 2;
  // humid weather: food spoils half a day sooner
  if (WEATHER_DEFS[s.world.weather].spoilFaster)
    for (const st of [...s.inventory, ...s.storage]) if (st.exp !== undefined) st.exp -= 2;
  const lost: Record<string, number> = {};
  const check = (list: ItemStack[]) => {
    for (const st of list) {
      if (st.exp !== undefined && st.exp <= limit) {
        lost[st.id] = (lost[st.id] ?? 0) + st.qty;
        st.qty = 0;
      }
    }
    ctx.prune(list);
  };
  check(s.inventory);
  check(s.storage);
  for (const [id, n] of Object.entries(lost)) ctx.change('loss', `${ITEMS[id].icon} ${n} ${ITEMS[id].name} bị hỏng`);
}

function regenerate(ctx: Ctx) {
  const s = ctx.s;
  const R = BALANCE.regen;
  for (const r of Object.values(s.regions)) {
    for (const k of ['forage', 'fish', 'game', 'wood'] as const) r.abundance[k] = Math.min(r.maxAbundance[k], r.abundance[k] + R[k]);
    r.wildlifeAlert = Math.max(0, r.wildlifeAlert - R.alertDecay);
  }
  const river = s.regions.river;
  if (river.water === 'muddy' && !WEATHER_DEFS[s.world.weather].muddies) river.water = 'clean';
  if (river.water === 'contaminated') {
    const left = Number(s.flags.contamDays ?? 0) - 1;
    if (s.flags.contamCleared || left <= 0) {
      river.water = 'clean';
      delete s.flags.contamDays;
      if (s.flags.contamCleared || river.waterKnown) {
        ctx.journal('Nước suối đã trong trở lại.', 'consequence');
        ctx.change('good', '💧 Nước suối đã trong trở lại');
      }
      river.waterKnown = false;
      if (s.chains.contamination && s.chains.contamination.status === 'active') s.chains.contamination.status = 'resolved';
    } else s.flags.contamDays = left;
  }
}

function nextWeather(ctx: Ctx, from: WeatherId, day: number): WeatherId {
  let w = ctx.rng.weighted(WEATHER_MARKOV[from]) ?? 'clear';
  if (w === 'storm' && day <= 3) w = 'rain';
  return w;
}

function dayStart(ctx: Ctx) {
  const s = ctx.s;
  s.world.weather = s.world.tomorrow;
  s.world.tomorrow = nextWeather(ctx, s.world.weather, s.day + 1);
  const w = s.world.weather;
  const wd = WEATHER_DEFS[w];
  if ((wd.rainWater ?? 0) > 0) s.world.lastRainDay = s.day;

  // pacing for the new day
  const prev = s.world.pacing;
  s.world.pacing = (ctx.rng.weighted<Pacing>([
    ['calm', prev === 'tense' ? 50 : 25],
    ['normal', 50],
    ['tense', prev === 'tense' ? 5 : 25],
  ]) ?? 'normal');
  s.world.notableToday = 0;
  delete s.flags.readSkyDay;

  const changes = ctx.capture(() => {
    // fires
    for (const f of s.structures.filter((x) => x.id === 'campfire' && x.lit)) {
      const covered = !!shelterAt(s, f.region);
      const p = wd.fireOut ? wd.fireOut[covered ? 1 : 0] : 0;
      if (p && ctx.rng.chance(p)) {
        f.lit = false;
        ctx.change('bad', `🔥 Lửa trại ở ${REGION_DEFS[f.region].name} bị tắt (${wd.name.toLowerCase()})`);
      }
    }
    // wind wear on structures (storms have their own event)
    if (wd.structureDamage) {
      for (const st of [...s.structures]) {
        const dmg = ctx.rng.int(wd.structureDamage[0], wd.structureDamage[1]);
        st.integrity = Math.max(1, st.integrity - dmg);
      }
      if (s.structures.length) ctx.change('bad', `${wd.icon} Gió lớn làm các công trình hư hại nhẹ`);
    }
    // rain collection
    if (s.baseRegion && wd.rainWater) {
      const n = structuresAt(s, s.baseRegion, 'rain_collector').length;
      if (n > 0) ctx.addItem('water_safe', wd.rainWater * n, { to: 'storage' });
    }
    if (wd.muddies && s.regions.river.water === 'clean') s.regions.river.water = 'muddy';
  });

  ctx.notice({
    title: `Ngày ${s.day} — ${wd.icon} ${wd.name}`,
    icon: wd.icon,
    text: `${dayText(s.world.pacing, w)}\nHiệu ứng hôm nay: ${wd.effects.map((e) => `${e.good ? '▲' : '▼'} ${e.text}`).join(' · ')}`,
    changes: changes.changes,
  });

  runTrigger(ctx, 'day_start');
}

function dayText(p: Pacing, w: WeatherId): string {
  const base = WEATHER_DEFS[w].dayText;
  if (WEATHER_DEFS[w].mood === 'danger') return base;
  if (p === 'calm') return `${base} Mọi thứ có vẻ yên bình.`;
  if (p === 'tense') return `${base} Có gì đó bất an trong không khí.`;
  return base;
}

/**
 * Advance n time slots: needs decay per slot, night processing after Evening,
 * new-day world update, then slot-start events for the slot the player lands in.
 */
export function advanceSlots(ctx: Ctx, n: number, opts: { atSea?: boolean } = {}) {
  const s = ctx.s;
  for (let i = 0; i < n; i++) {
    if (s.status !== 'playing') return;
    endOfSlot(ctx);
    if (checkDeath(ctx)) return;
    ctx.res.timeAdvanced++;
    if (s.slot >= 3) {
      night(ctx);
      if (checkDeath(ctx)) return;
      s.day++;
      s.slot = 0;
      dayStart(ctx);
      if (checkDeath(ctx)) return;
    } else s.slot++;
    if (!opts.atSea && i === n - 1) runTrigger(ctx, 'slot_start');
    if (checkDeath(ctx)) return;
  }
}

