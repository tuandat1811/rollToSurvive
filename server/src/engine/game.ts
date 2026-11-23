import { ACTIONS, type ActionDef, type Material } from '../content/actions.ts';
import { BALANCE } from '../content/balance.ts';
import { ATTR_DEFS, ROUTE_DEFS, SECONDARY_POOLS, WEATHER_DEFS, WEATHER_MARKOV } from '../content/defs.ts';
import { EVENTS } from '../content/events.ts';
import { ITEMS } from '../content/items.ts';
import { awardXp, roll } from './check.ts';
import { Ctx, absSlot, count, countBoth, storageWaterCap, waterCount, containerCap, carryMax, weightOf } from './ctx.ts';
import { escapeDecision } from './escape.ts';
import { Rng } from './rng.ts';
import { advanceSlots, checkDeath } from './time.ts';
import {
  ATTRS,
  REGIONS,
  SKILLS,
  type AttrId,
  type GameState,
  type RegionId,
  type RegionState,
  type ResourceKind,
  type Tier,
  type TurnResult,
} from './types.ts';

export class GameError extends Error {}

// ---------------------------------------------------------------- new game (hybrid island)

const ABUNDANCE: Record<RegionId, Record<ResourceKind, number>> = {
  coast: { forage: 90, fish: 90, game: 0, wood: 70 },
  jungle: { forage: 100, fish: 0, game: 100, wood: 110 },
  river: { forage: 40, fish: 90, game: 40, wood: 60 },
  mountain: { forage: 60, fish: 0, game: 30, wood: 30 },
  cape: { forage: 30, fish: 60, game: 0, wood: 25 },
};

export function newGame(name: string, attrs: Record<AttrId, number>, seed: number): GameState {
  const B = BALANCE.start;
  let spent = 0;
  for (const a of ATTRS) {
    const v = attrs[a];
    if (!Number.isInteger(v) || v < B.attrBase || v > B.attrCreationMax) throw new GameError(`Chỉ số ${ATTR_DEFS[a].name} không hợp lệ`);
    spent += v - B.attrBase;
  }
  if (spent !== B.attrPoints) throw new GameError(`Cần phân bổ đúng ${B.attrPoints} điểm thuộc tính`);

  const rng = new Rng(seed);

  const regions = {} as Record<RegionId, RegionState>;
  const pick = (arr: string[], n: number) => rng.shuffle([...arr]).slice(0, n);
  const secondary: Record<RegionId, string[]> = {
    coast: pick(SECONDARY_POOLS.coast, 2),
    jungle: pick(SECONDARY_POOLS.jungle, 2),
    river: pick(SECONDARY_POOLS.river, 2),
    mountain: rng.chance(0.5) ? ['bird_cliff', 'cave'] : pick(SECONDARY_POOLS.mountain, 1),
    cape: [],
  };
  const pools: Record<RegionId, string[]> = {
    coast: [...secondary.coast.map((l) => `loc:${l}`)],
    jungle: [...secondary.jungle.map((l) => `loc:${l}`)],
    river: [...secondary.river.map((l) => `loc:${l}`)],
    mountain: [...secondary.mountain.map((l) => `loc:${l}`)],
    cape: [],
  };
  pools.coast.splice(1, 0, 'route:coast-cape');
  pools.jungle.unshift('route:jungle-mountain');
  pools.jungle.splice(rng.int(1, 2), 0, 'loc:footprints');
  pools.river.unshift('route:river-mountain');
  pools.mountain.push('route:mountain-cape');

  for (const id of REGIONS) {
    const abundance = {} as Record<ResourceKind, number>;
    for (const kk of ['forage', 'fish', 'game', 'wood'] as ResourceKind[]) abundance[kk] = Math.round(ABUNDANCE[id][kk] * (0.8 + rng.next() * 0.35));
    regions[id] = {
      discovery: id === 'coast' || id === 'jungle' || id === 'river' ? 'discovered' : id === 'mountain' ? 'clued' : 'unknown',
      surveyed: false,
      explorePool: pools[id],
      found: id === 'coast' ? ['wreck'] : [],
      abundance: { ...abundance },
      maxAbundance: abundance,
      wildlifeAlert: 0,
      water: 'clean',
      waterKnown: false,
    };
  }
  regions.jungle.discovery = 'discovered';

  const routes = ROUTE_DEFS.map((d) => ({ id: d.id, a: d.a, b: d.b, known: d.known, status: 'open' as const, energy: d.energy, danger: d.danger }));
  if (rng.chance(0.65)) {
    const blockedId = rng.pick(['jungle-mountain', 'river-mountain']);
    const r = routes.find((x) => x.id === blockedId)!;
    (r as { status: string }).status = 'blocked';
  }

  const wreck = ['knife', 'rope', 'rope', 'canvas', 'canvas', 'tin_can', 'canned', 'canned', 'first_aid', 'scrap', 'scrap', 'barrel', 'barrel'];
  if (rng.chance(0.4)) wreck.push('flare');
  if (rng.chance(0.5)) wreck.push('chart');
  if (rng.chance(0.5)) wreck.push('pot');
  rng.shuffle(wreck);
  // the knife and a pot-like container should not be buried at the very bottom
  for (const must of ['knife', 'tin_can']) {
    const i = wreck.indexOf(must);
    if (i > 4) {
      wreck.splice(i, 1);
      wreck.splice(rng.int(0, 4), 0, must);
    }
  }
  const ruins = rng.shuffle(['logbook', 'lamp_oil', 'signal_mirror', 'scrap', 'canvas', ...(wreck.includes('flare') ? [] : ['flare'])]);
  const camp = ['journal', rng.pick(['fishing_rod', 'stone_axe']), 'herbs', 'canvas'];
  rng.shuffle(camp);
  if (camp.indexOf('journal') > 1) {
    camp.splice(camp.indexOf('journal'), 1);
    camp.unshift('journal');
  }

  const firstShipDay = rng.int(BALANCE.ships.firstMin, BALANCE.ships.firstMax);
  const tomorrow = (rng.weighted(WEATHER_MARKOV.clear) ?? 'clear') === 'storm' ? 'cloudy' : (rng.weighted(WEATHER_MARKOV.clear) ?? 'clear');

  const s: GameState = {
    schema: 1,
    version: 0,
    seed,
    rng: rng.state,
    name: name.trim().slice(0, 30) || 'Người sống sót',
    createdAt: Date.now(),
    status: 'playing',
    day: 1,
    slot: 0,
    attrs: { ...attrs },
    attrPoints: 0,
    skills: Object.fromEntries(SKILLS.map((k) => [k, { lvl: 0, xp: 0 }])) as GameState['skills'],
    vitals: { ...B.vitals },
    conditions: [],
    knowledge: [],
    location: 'coast',
    baseRegion: null,
    inventory: [
      { id: 'bottle', qty: 1 },
      { id: 'water_safe', qty: 1 },
      { id: 'coconut', qty: 1, exp: 40 },
    ],
    storage: [],
    structures: [],
    projects: [],
    traps: [],
    regions,
    routes,
    world: {
      weather: 'clear',
      tomorrow: tomorrow === 'storm' ? 'cloudy' : tomorrow,
      forecastUntil: 1,
      pacing: 'calm',
      notableToday: 0,
      ships: [(firstShipDay - 1) * 4 + rng.int(0, 3)],
      shipKnown: false,
      currents: 0,
      lastRainDay: -10,
      wreckPool: wreck,
      ruinsPool: ruins,
      campPool: camp,
    },
    flags: {},
    history: [],
    chains: {},
    scheduled: [],
    pending: null,
    escape: null,
    journal: [],
    recentActions: [],
    stats: { actions: 0, checks: 0, crits: 0, critFails: 0, events: 0, crafted: 0, lastDamage: '' },
    uid: 0,
    last: null,
  };
  s.rng = rng.state;
  const intro =
    'Cơn bão đêm qua đã đánh chìm con tàu chở bạn. Bạn tỉnh dậy trên bãi cát, người ướt sũng, xung quanh là xác tàu và những mảnh vỡ. Hòn đảo im lặng đến rợn người.';
  s.journal.push({ day: 1, slot: 0, kind: 'event', text: intro });
  s.last = {
    title: 'Ngày 1 — Tỉnh dậy trên đảo hoang',
    icon: '🏝️',
    narrative: [
      intro,
      'Ưu tiên trước mắt: nước uống, thức ăn và một chỗ trú qua đêm. Xác tàu có thể còn đồ dùng được. Và bạn có thể thử rời đảo bất cứ lúc nào — nếu dám.',
    ],
    changes: [],
    notices: [],
    timeAdvanced: 0,
  };
  return s;
}

// ---------------------------------------------------------------- action availability

export interface ActionInstance {
  key: string;
  def: ActionDef;
  param: string;
}

export function instances(s: GameState): ActionInstance[] {
  const out: ActionInstance[] = [];
  for (const def of Object.values(ACTIONS)) {
    const params = def.variants ? def.variants(s) : [''];
    for (const p of params) {
      if (!def.visible(s, p)) continue;
      out.push({ key: p ? `${def.id}:${p}` : def.id, def, param: p });
    }
  }
  return out;
}

export function findInstance(s: GameState, key: string): ActionInstance | undefined {
  const [id, ...rest] = key.split(':');
  const def = ACTIONS[id];
  if (!def) return undefined;
  const param = rest.join(':');
  if (def.variants && !def.variants(s).includes(param)) return undefined;
  if (!def.visible(s, param)) return undefined;
  return { key, def, param };
}

export function materialStatus(s: GameState, mats: Material[]) {
  return mats.map((m) => ({ ...m, have: countBoth(s, m.id) }));
}

/** energy cost including weather: heavy physical work (base ≥ 6) is lighter in a breeze, heavier when humid */
export function actionEnergy(s: GameState, def: ActionDef, param: string): number {
  const base = def.energy(s, param);
  const delta = WEATHER_DEFS[s.world.weather].energy ?? 0;
  return base >= 6 ? Math.max(1, base + delta) : base;
}

export function unmetReasons(s: GameState, inst: ActionInstance): string[] {
  const { def, param } = inst;
  const out: string[] = [];
  for (const r of def.reqs?.(s, param) ?? []) if (!r.met) out.push(r.label);
  for (const m of materialStatus(s, def.materials?.(s, param) ?? [])) if (m.have < m.qty) out.push(`Thiếu ${ITEMS[m.id].name} (${m.have}/${m.qty})`);
  const e = actionEnergy(s, def, param);
  if (e > s.vitals.energy) out.push(`Không đủ năng lượng (cần ${e})`);
  return out;
}

function assertPlaying(s: GameState) {
  if (s.status !== 'playing') throw new GameError('Ván chơi đã kết thúc');
}

function begin(s: GameState): GameState {
  return structuredClone(s);
}

function finish(ctx: Ctx): { state: GameState; result: TurnResult } {
  checkDeath(ctx);
  ctx.sync();
  ctx.s.version++;
  ctx.s.last = ctx.res;
  return { state: ctx.s, result: ctx.res };
}

// ---------------------------------------------------------------- perform action

export function performAction(prev: GameState, key: string) {
  assertPlaying(prev);
  if (prev.pending) throw new GameError('Hãy giải quyết sự kiện đang diễn ra trước');
  if (prev.escape) throw new GameError('Bạn đang ở trên biển');
  const inst = findInstance(prev, key);
  if (!inst) throw new GameError('Hành động không khả dụng');
  const unmet = unmetReasons(prev, inst);
  if (unmet.length) throw new GameError(unmet.join('; '));

  const s = begin(prev);
  const { def, param } = inst;
  const ctx = new Ctx(s, def.name(s, param), def.icon(s, param));
  // commit start costs
  const energy = actionEnergy(s, def, param);
  if (energy) ctx.vital('energy', -energy);
  for (const m of def.materials?.(s, param) ?? []) ctx.removeItem(m.id, m.qty, 'both');

  let tier: Tier = 'success';
  const spec = def.check?.(s, param) ?? null;
  const xpKey = def.xpKey ? def.xpKey(s, param) : def.id;
  if (spec) {
    const info = roll(ctx, spec);
    ctx.res.roll = info;
    tier = info.tier;
  }
  def.resolve(ctx, tier, param);
  if (spec && ctx.res.roll) awardXp(ctx, spec, ctx.res.roll, xpKey);

  s.stats.actions++;
  s.flags[`done:${xpKey}`] = true;
  s.recentActions.push({ key: xpKey, at: absSlot(s) });
  if (s.recentActions.length > 60) s.recentActions.splice(0, s.recentActions.length - 60);

  const slots = def.slots ?? 1;
  if (s.status === 'playing' && slots > 0 && !s.escape) advanceSlots(ctx, slots);
  return finish(ctx);
}

// ---------------------------------------------------------------- events

export function eventChoices(s: GameState) {
  if (!s.pending) return [];
  const def = EVENTS[s.pending.eventId];
  return def.choices ? def.choices(s, s.pending.data) : [];
}

export function chooseEvent(prev: GameState, choiceId: string) {
  assertPlaying(prev);
  if (!prev.pending) throw new GameError('Không có sự kiện nào đang chờ');
  const choice = eventChoices(prev).find((c) => c.id === choiceId);
  if (!choice) throw new GameError('Lựa chọn không hợp lệ');
  const unmet = (choice.reqs ?? []).filter((r) => !r.met).map((r) => r.label);
  if ((choice.energy ?? 0) > prev.vitals.energy) unmet.push(`Không đủ năng lượng (cần ${choice.energy})`);
  for (const m of choice.materials ?? []) if (countBoth(prev, m.id) < m.qty) unmet.push(`Thiếu ${ITEMS[m.id].name}`);
  if (unmet.length) throw new GameError(unmet.join('; '));

  const s = begin(prev);
  const def = EVENTS[s.pending!.eventId];
  const data = s.pending!.data;
  s.pending = null;
  const ctx = new Ctx(s, `${def.title} — ${choice.label}`, choice.icon ?? def.icon);
  if (choice.energy) ctx.vital('energy', -choice.energy);
  for (const m of choice.materials ?? []) ctx.removeItem(m.id, m.qty, 'both');
  let tier: Tier = 'success';
  if (choice.check) {
    const info = roll(ctx, choice.check);
    ctx.res.roll = info;
    tier = info.tier;
  }
  choice.resolve(ctx, tier, data);
  if (choice.check && ctx.res.roll) awardXp(ctx, choice.check, ctx.res.roll, `event:${def.id}:${choice.id}`);
  if (s.status === 'playing' && choice.slots > 0) advanceSlots(ctx, choice.slots);
  return finish(ctx);
}

// ---------------------------------------------------------------- escape

export function escapeStep(prev: GameState, decision: 'roll' | 'return') {
  assertPlaying(prev);
  if (!prev.escape) throw new GameError('Bạn không ở trên biển');
  const s = begin(prev);
  const ctx = new Ctx(s);
  escapeDecision(ctx, decision);
  return finish(ctx);
}

// ---------------------------------------------------------------- free actions

export function consume(prev: GameState, itemId: string, from: 'inv' | 'storage') {
  assertPlaying(prev);
  const def = ITEMS[itemId];
  if (!def || (!def.food && !def.water)) throw new GameError('Không thể dùng vật phẩm này');
  if (from === 'storage' && prev.baseRegion !== prev.location) throw new GameError('Bạn không ở căn cứ');
  const list = from === 'inv' ? prev.inventory : prev.storage;
  if (count(list, itemId) < 1) throw new GameError('Không còn vật phẩm này');

  const s = begin(prev);
  const ctx = new Ctx(s, `${def.water ? 'Uống' : 'Ăn'} ${def.name}`, def.icon);
  const src = from === 'inv' ? s.inventory : s.storage;
  const stack = src.filter((x) => x.id === itemId).sort((a, b) => (a.exp ?? 1e9) - (b.exp ?? 1e9))[0];
  const risk =
    stack.risk ??
    (itemId === 'berries' && s.skills.survival.lvl >= 2 ? 0 : def.food?.risk ?? 0);
  stack.qty--;
  ctx.prune(src);
  s.flags['done:consume'] = true;
  if (def.food) {
    ctx.vital('hunger', def.food.hunger);
    if (def.food.thirst) ctx.vital('thirst', def.food.thirst);
  }
  if (def.water) ctx.vital('thirst', def.water.thirst);
  if (risk > 0 && ctx.rng.chance(risk)) {
    ctx.addCondition('illness', 1);
    ctx.say(itemId === 'water_raw' ? 'Bụng bạn quặn lên — nước không sạch.' : 'Một lúc sau bụng bạn bắt đầu cồn cào khó chịu.');
    ctx.journal(`Bị đau bụng sau khi ${def.water ? 'uống' : 'ăn'} ${def.name.toLowerCase()}.`, 'consequence');
  }
  return finish(ctx);
}

export function transfer(prev: GameState, itemId: string, qty: number, dir: 'store' | 'take') {
  assertPlaying(prev);
  if (prev.baseRegion !== prev.location) throw new GameError('Chỉ chuyển đồ được khi ở căn cứ');
  if (!Number.isInteger(qty) || qty < 1) throw new GameError('Số lượng không hợp lệ');
  const s = begin(prev);
  const ctx = new Ctx(s, dir === 'store' ? 'Cất đồ vào kho' : 'Lấy đồ từ kho', '📦');
  const from = dir === 'store' ? s.inventory : s.storage;
  const to = dir === 'store' ? s.storage : s.inventory;
  const def = ITEMS[itemId];
  if (!def) throw new GameError('Vật phẩm không tồn tại');
  let n = Math.min(qty, count(from, itemId));
  if (n < 1) throw new GameError('Không có vật phẩm này');
  if (dir === 'take') {
    if (def.weight > 0) n = Math.min(n, Math.floor((carryMax(s) - weightOf(s.inventory) + 1e-6) / def.weight));
    if (def.kind === 'water') n = Math.min(n, containerCap(s.inventory) - waterCount(s.inventory));
  } else if (def.kind === 'water') {
    n = Math.min(n, storageWaterCap(s) - waterCount(s.storage));
  }
  // carrying the last container away must not leave water floating in the air
  if (def.container && dir === 'store') {
    const capAfter = containerCap(s.inventory) - def.container * n;
    if (waterCount(s.inventory) > capAfter) throw new GameError('Hãy cất/uống bớt nước trước khi cất bình chứa');
  }
  if (def.container && dir === 'take') {
    const capAfter = storageWaterCap(s) - def.container * n;
    if (waterCount(s.storage) > capAfter) throw new GameError('Kho cần bình này để chứa nước');
  }
  if (n < 1) throw new GameError(def.kind === 'water' ? 'Không đủ chỗ chứa nước' : 'Hành trang quá nặng');
  const moving = from.filter((x) => x.id === itemId).sort((a, b) => (a.exp ?? 1e9) - (b.exp ?? 1e9));
  let left = n;
  for (const st of moving) {
    if (left <= 0) break;
    const take = Math.min(st.qty, left);
    st.qty -= take;
    left -= take;
    if (st.dur !== undefined) to.push({ ...st, qty: take });
    else {
      const ex = to.find((x) => x.id === st.id && x.exp === st.exp && x.risk === st.risk && x.dur === undefined);
      if (ex) ex.qty += take;
      else to.push({ id: st.id, qty: take, ...(st.exp !== undefined ? { exp: st.exp } : {}), ...(st.risk !== undefined ? { risk: st.risk } : {}) });
    }
  }
  ctx.prune(from);
  ctx.change('info', `${dir === 'store' ? 'Cất' : 'Lấy'} ${n} ${def.icon} ${def.name}`);
  return finish(ctx);
}

export function dropItem(prev: GameState, itemId: string, qty: number) {
  assertPlaying(prev);
  const s = begin(prev);
  const ctx = new Ctx(s, 'Bỏ đồ', '🗑️');
  const n = ctx.removeItem(itemId, Math.max(1, Math.floor(qty)), 'inv');
  if (!n) throw new GameError('Không có vật phẩm này');
  return finish(ctx);
}

export function allocateAttr(prev: GameState, attr: AttrId) {
  assertPlaying(prev);
  if (prev.attrPoints < 1) throw new GameError('Không có điểm thuộc tính');
  if (!ATTRS.includes(attr)) throw new GameError('Thuộc tính không hợp lệ');
  if (prev.attrs[attr] >= BALANCE.start.attrMax) throw new GameError('Thuộc tính đã tối đa');
  const s = begin(prev);
  const ctx = new Ctx(s, 'Tăng thuộc tính', '⭐');
  s.attrs[attr]++;
  s.attrPoints--;
  ctx.change('good', `${ATTR_DEFS[attr].name} → ${s.attrs[attr]}`);
  ctx.journal(`Tăng ${ATTR_DEFS[attr].name} lên ${s.attrs[attr]}.`, 'milestone');
  return finish(ctx);
}

