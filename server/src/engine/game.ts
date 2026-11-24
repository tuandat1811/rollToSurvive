import { ACTIONS, type ActionDef, type Material } from '../content/actions.js';
import { BALANCE } from '../content/balance.js';
import { ATTR_DEFS, ROUTE_DEFS, SECONDARY_POOLS, WEATHER_DEFS, WEATHER_MARKOV } from '../content/defs.js';
import { EVENTS } from '../content/events.js';
import { ITEMS } from '../content/items.js';
import { CONDITIONS } from '../content/conditions.js';
import { MISFORTUNE } from '../content/families.js';
import { awardXp, roll } from './check.js';
import { Ctx, absSlot, count, countBoth, storageWaterCap, waterCount, containerCap, carryMax, weightOf } from './ctx.js';
import { escapeDecision } from './escape.js';
import { runAfterAction } from './director.js';
import { Rng } from './rng.js';
import { advanceSlots, checkDeath, rollWeather } from './time.js';
import { pickTraits, traitDefs } from '../content/traits.js';
import {
  ATTRS,
  REGIONS,
  SKILLS,
  type AttrId,
  type GameState,
  type ItemStack,
  type RegionId,
  type RegionState,
  type ResourceKind,
  type Tier,
  type TurnResult,
  type WeatherId,
} from './types.js';

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
  const traits = pickTraits(() => rng.next(), 2);
  const tdefs = traitDefs({ traits });

  const regions = {} as Record<RegionId, RegionState>;
  const pick = (arr: string[], n: number) => rng.shuffle([...arr]).slice(0, n);
  const secondary: Record<RegionId, string[]> = {
    coast: pick(SECONDARY_POOLS.coast, 2),
    jungle: pick(SECONDARY_POOLS.jungle, 2),
    river: pick(SECONDARY_POOLS.river, 2),
    mountain: rng.chance(0.5) ? ['bird_cliff', 'cave'] : pick(SECONDARY_POOLS.mountain, 1),
    cape: [],
  };
  for (const t of tdefs) {
    const loc = t.guaranteeLocation;
    if (!loc) continue;
    const reg = (Object.keys(SECONDARY_POOLS) as RegionId[]).find((r) => SECONDARY_POOLS[r].includes(loc));
    if (reg && !secondary[reg].includes(loc)) secondary[reg][0] = loc;
  }
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
    for (const kk of ['forage', 'fish', 'game', 'wood'] as ResourceKind[]) {
      const mult = tdefs.reduce((m, t) => m * (t.abundance?.[id]?.[kk] ?? 1) * (t.abundance?.['*']?.[kk] ?? 1), 1);
      abundance[kk] = Math.round(ABUNDANCE[id][kk] * mult * (0.75 + rng.next() * 0.45));
    }
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
  // a couple of random odds and ends so no two wrecks hold the same things
  for (const extra of pick(['glass_bottle', 'scrap', 'rope', 'canned', 'compass', 'bandage', 'fiber', 'glass_bottle'], 2)) wreck.push(extra);
  for (const t of tdefs) wreck.push(...(t.wreck ?? []));
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

  const shipTrait = tdefs.find((t) => t.shipGap);
  const firstRange = tdefs.find((t) => t.firstShip)?.firstShip ?? [BALANCE.ships.firstMin, BALANCE.ships.firstMax];
  const firstShipDay = rng.int(firstRange[0], firstRange[1]);

  // day 1 is always clear so the first day is forgiving; from day 2 the weather
  // follows the (trait-shaped) random transitions
  const startWeather: WeatherId = 'clear';
  const tomorrow = rollWeather(rng, startWeather, 2, { traits } as GameState);

  // what the survivor managed to hold on to, and how the wreck left them
  const KITS: { id: string; qty: number; text: string }[] = [
    { id: 'knife', qty: 1, text: 'Con dao gấp vẫn nằm trong túi quần bạn.' },
    { id: 'rope', qty: 2, text: 'Trên vai bạn vẫn quấn hai cuộn dây thừng từ boong tàu.' },
    { id: 'canned', qty: 2, text: 'Hai hộp đồ ăn còn nằm nguyên trong túi áo khoác.' },
    { id: 'first_aid', qty: 1, text: 'Bạn ôm chặt được hộp sơ cứu của tàu.' },
    { id: 'tin_can', qty: 1, text: 'Một chiếc lon thiếc rỗng lăn cạnh chân bạn — đun nước được đấy.' },
    { id: 'bandage', qty: 2, text: 'Túi áo bạn còn vài cuộn băng gạc.' },
    { id: 'coconut', qty: 2, text: 'Mấy trái dừa trôi dạt nằm ngay cạnh bạn.' },
    { id: 'compass', qty: 1, text: 'Chiếc la bàn của thuyền trưởng mắc trong túi áo bạn.' },
    { id: 'flint', qty: 1, text: 'Bạn mò thấy một hòn đá lửa trong túi — có thể nhóm lửa dễ dàng.' },
  ];
  const kit = rng.pick(KITS);
  const injured = rng.chance(0.35);
  const jitter = (v: number, d: number) => Math.max(40, Math.min(100, v + rng.int(-d, d)));
  const OPENINGS = [
    'Cơn bão đêm qua đã đánh chìm con tàu chở bạn. Bạn tỉnh dậy trên bãi cát, người ướt sũng, xung quanh là xác tàu và những mảnh vỡ.',
    'Tiếng sóng vỗ đánh thức bạn. Miệng đầy cát mặn, con tàu chỉ còn là một khối sắt vụn mắc cạn ngoài mỏm đá.',
    'Bạn không nhớ mình đã bám vào mảnh gỗ bao lâu. Khi mở mắt, bạn đang nằm trên bờ cát của một hòn đảo lạ, bên cạnh xác con tàu.',
    'Chiếc xuồng cứu sinh lật úp trên bãi biển. Không còn ai khác. Chỉ có bạn, xác tàu và hòn đảo im lặng đến rợn người.',
  ];

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
    vitals: {
      health: injured ? 92 : B.vitals.health,
      hunger: jitter(B.vitals.hunger, 8),
      thirst: jitter(B.vitals.thirst, 8),
      energy: jitter(B.vitals.energy, 8),
    },
    conditions: injured ? [{ id: 'injury', sev: 1 }] : [],
    traits,
    knowledge: [],
    location: 'coast',
    baseRegion: null,
    inventory: [
      { id: 'bottle', qty: 1 },
      { id: 'water_safe', qty: 1 },
      { id: 'coconut', qty: 1, exp: 40 },
    ],
    // (the random kit item is added below so it stacks/expires like any other item)
    storage: [],
    structures: [],
    projects: [],
    traps: [],
    regions,
    routes,
    world: {
      weather: startWeather,
      tomorrow,
      shipGap: shipTrait?.shipGap,
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
  // the random kit item (stacked/expiring like any other)
  const kitDef = ITEMS[kit.id];
  for (let i = 0; i < kit.qty; i++) {
    const st: ItemStack = { id: kit.id, qty: 1 };
    if (kitDef.dur !== undefined) st.dur = kitDef.dur;
    if (kitDef.spoilDays) st.exp = kitDef.spoilDays * 4;
    const ex = kitDef.dur === undefined ? s.inventory.find((x) => x.id === kit.id && x.exp === st.exp) : undefined;
    if (ex) ex.qty++;
    else s.inventory.push(st);
  }
  s.rng = rng.state;

  const intro = rng.pick(OPENINGS);
  const traitLines = tdefs.map((t) => `${t.icon} ${t.name}: ${t.desc}`);
  s.journal.push({ day: 1, slot: 0, kind: 'event', text: `${intro} ${kit.text}` });
  s.journal.push({ day: 1, slot: 0, kind: 'discovery', text: `Đặc điểm hòn đảo lần này — ${traitLines.join(' · ')}` });
  s.last = {
    title: 'Ngày 1 — Tỉnh dậy trên đảo hoang',
    icon: '🏝️',
    narrative: [
      `${intro} ${kit.text}${injured ? ' Chân tay bạn trầy xước vì va vào đá ngầm.' : ''}`,
      'Ưu tiên trước mắt: nước uống, thức ăn và một chỗ trú qua đêm. Xác tàu có thể còn đồ dùng được. Và bạn có thể thử rời đảo bất cứ lúc nào — nếu dám.',
    ],
    changes: [
      { kind: 'gain', text: `+${kit.qty} ${kitDef.icon} ${kitDef.name}` },
      ...(injured ? [{ kind: 'bad' as const, text: '🤕 Trầy xước sau vụ đắm tàu' }] : []),
    ],
    notices: [
      {
        title: 'Hòn đảo lần này',
        icon: '🎲',
        text: 'Mỗi ván, hòn đảo có 2 đặc điểm ngẫu nhiên. Xem lại bất cứ lúc nào ở tab Bản đồ.',
        changes: tdefs.map((t) => ({ kind: t.mood === 'good' ? ('good' as const) : t.mood === 'bad' ? ('bad' as const) : ('info' as const), text: `${t.icon} ${t.name} — ${t.desc}` })),
      },
    ],
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

/** controlled randomness: how hard did this transaction hit the player? */
export function updateMisfortune(ctx: Ctx) {
  const s = ctx.s;
  const st = ctx.start;
  let m = 0;
  const drop = st.health - s.vitals.health;
  if (drop > 0) m += drop / 12;
  for (const c of s.conditions) if (!CONDITIONS[c.id]?.good && !st.bad.includes(c.id)) m += 1;
  m += st.structures.filter((uid) => !s.structures.some((x) => x.uid === uid)).length * 1.5;
  if (ctx.res.roll?.tier === 'crit_failure') m += 0.5;
  if (m > 0) s.world.misfortune = Math.min(MISFORTUNE.max, Math.round(((s.world.misfortune ?? 0) + m) * 10) / 10);
}

function finish(ctx: Ctx): { state: GameState; result: TurnResult } {
  updateMisfortune(ctx);
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

  // action events: may put a card in front of the player before time moves on
  if (s.status === 'playing' && !s.escape) runAfterAction(ctx, def.id);

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
  // event memory: remember what the player chose and how it went
  const mem = [...s.history].reverse().find((h) => h.id === def.id && !h.choice);
  if (mem) {
    mem.choice = choice.id;
    if (choice.check) mem.tier = tier;
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

