import { BALANCE } from '../content/balance.js';
import { CONDITIONS } from '../content/conditions.js';
import { LOCATION_DEFS, REGION_DEFS, ROUTE_DEFS, SKILL_DEFS } from '../content/defs.js';
import { ITEMS, item, itemName } from '../content/items.js';
import { locationAccessible } from '../content/locationStates.js';
import { Rng } from './rng.js';
import type {
  ChangeKind,
  GameState,
  ItemStack,
  JournalEntry,
  Notice,
  RegionId,
  SkillId,
  TurnResult,
  VitalId,
} from './types.js';

// ---------------------------------------------------------------- pure helpers

export const absSlot = (s: GameState) => (s.day - 1) * 4 + s.slot;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function count(list: ItemStack[], id: string): number {
  return list.reduce((a, st) => (st.id === id ? a + st.qty : a), 0);
}

export function countBoth(s: GameState, id: string): number {
  const atBase = s.baseRegion === s.location;
  return count(s.inventory, id) + (atBase ? count(s.storage, id) : 0);
}

export function weightOf(list: ItemStack[]): number {
  return list.reduce((a, st) => a + (ITEMS[st.id]?.weight ?? 0) * st.qty, 0);
}

export function carryMax(s: GameState): number {
  const bonus = s.inventory.reduce((a, st) => Math.max(a, ITEMS[st.id]?.carryBonus ?? 0), 0);
  return BALANCE.carry.base + bonus;
}

export function containerCap(list: ItemStack[]): number {
  return list.reduce((a, st) => a + (ITEMS[st.id]?.container ?? 0) * st.qty, 0);
}

export function waterCount(list: ItemStack[]): number {
  return count(list, 'water_raw') + count(list, 'water_safe');
}

export function structuresAt(s: GameState, region: RegionId, id?: string) {
  return s.structures.filter((st) => st.region === region && (!id || st.id === id) && st.integrity > 0);
}

export function hasStructure(s: GameState, id: string, region: RegionId = s.location): boolean {
  return structuresAt(s, region, id).length > 0;
}

export function storageWaterCap(s: GameState): number {
  if (!s.baseRegion) return 0;
  const collectors = structuresAt(s, s.baseRegion, 'rain_collector').length;
  return containerCap(s.storage) + collectors * 6;
}

export function shelterAt(s: GameState, region: RegionId): 'hut' | 'lean_to' | 'cave' | null {
  if (hasStructure(s, 'hut', region)) return 'hut';
  if (hasStructure(s, 'lean_to', region)) return 'lean_to';
  if (region === 'mountain' && s.regions.mountain.found.includes('cave') && locationAccessible(s, 'cave')) return 'cave';
  return null;
}

export function fireLit(s: GameState, region: RegionId = s.location): boolean {
  return s.structures.some((st) => st.region === region && st.id === 'campfire' && st.integrity > 0 && st.lit);
}

export function hasTag(s: GameState, tag: string): boolean {
  return s.inventory.some((st) => ITEMS[st.id]?.tags?.includes(tag));
}

export function hasCondition(s: GameState, id: string): boolean {
  return s.conditions.some((c) => c.id === id);
}

export function condSev(s: GameState, id: string): number {
  return s.conditions.find((c) => c.id === id)?.sev ?? 0;
}

export function routeBetween(s: GameState, a: RegionId, b: RegionId) {
  return s.routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

export function regionName(id: RegionId) {
  return REGION_DEFS[id].name;
}

// ---------------------------------------------------------------- Ctx

/**
 * Transaction context. Every mutation during an action/event goes through here,
 * operating on a cloned state; the caller commits the whole state atomically.
 */
export class Ctx {
  rng: Rng;
  res: TurnResult;
  /** consequences applied in this transaction (conflict detection) */
  applied: { id: string; key?: string }[] = [];

  constructor(
    public s: GameState,
    title = '',
    icon = '',
  ) {
    this.rng = new Rng(s.rng);
    this.res = { title, icon, narrative: [], changes: [], notices: [], timeAdvanced: 0 };
  }

  get now() {
    return absSlot(this.s);
  }

  /** collector stack — notices capture changes separately */
  private sink: { changes: Change2[] }[] = [];

  /** redirect changes into a notice while running passive event effects */
  capture<T>(fn: () => T): { value: T; changes: Change2[] } {
    const frame = { changes: [] as Change2[] };
    this.sink.push(frame);
    try {
      const value = fn();
      return { value, changes: frame.changes };
    } finally {
      this.sink.pop();
    }
  }

  sync() {
    this.s.rng = this.rng.state;
  }

  change(kind: ChangeKind, text: string) {
    const target = this.sink.length ? this.sink[this.sink.length - 1].changes : this.res.changes;
    target.push({ kind, text });
  }

  say(text: string) {
    this.res.narrative.push(text);
  }

  notice(n: Notice) {
    this.res.notices.push(n);
  }

  journal(text: string, kind: JournalEntry['kind'] = 'info') {
    this.s.journal.push({ day: this.s.day, slot: this.s.slot, kind, text });
    if (this.s.journal.length > 300) this.s.journal.splice(0, this.s.journal.length - 300);
  }

  flag(key: string, value: number | boolean | string = true) {
    this.s.flags[key] = value;
  }

  nextUid() {
    return ++this.s.uid;
  }

  // ------------------------------------------------------------ vitals

  vital(id: VitalId, delta: number, cause?: string) {
    if (!delta) return;
    const v = this.s.vitals;
    const before = v[id];
    v[id] = clamp(Math.round((before + delta) * 10) / 10, 0, 100);
    const d = Math.round(v[id] - before);
    if (d === 0) return;
    const names: Record<VitalId, string> = { health: 'Sức khỏe', hunger: 'No bụng', thirst: 'Nước', energy: 'Năng lượng' };
    this.change(d > 0 ? 'good' : 'bad', `${names[id]} ${d > 0 ? '+' : ''}${d}${cause ? ` (${cause})` : ''}`);
    if (id === 'health' && d < 0 && cause) this.s.stats.lastDamage = cause;
  }

  // ------------------------------------------------------------ items

  private stackFor(list: ItemStack[], id: string, exp?: number, risk?: number): ItemStack {
    const def = item(id);
    if (def.dur === undefined) {
      const ex = list.find((st) => st.id === id && st.exp === exp && st.risk === risk && st.dur === undefined);
      if (ex) return ex;
    }
    const st: ItemStack = { id, qty: 0 };
    if (exp !== undefined) st.exp = exp;
    if (risk !== undefined) st.risk = risk;
    if (def.dur !== undefined) st.dur = def.dur;
    list.push(st);
    return st;
  }

  /**
   * Adds items. 'auto' fills the backpack and, if standing at base, overflows into storage;
   * anything that still does not fit is left behind (reported).
   */
  addItem(id: string, qty: number, opts: { to?: 'auto' | 'inv' | 'storage'; risk?: number; quiet?: boolean; durMult?: number } = {}): number {
    if (qty <= 0) return 0;
    const def = item(id);
    const s = this.s;
    const to = opts.to ?? 'auto';
    const exp = def.spoilDays ? this.now + def.spoilDays * 4 : undefined;
    const atBase = s.baseRegion === s.location;
    let left = qty;
    let toInv = 0;
    let toStore = 0;

    const fitInv = () => {
      let n = left;
      if (def.weight > 0) n = Math.min(n, Math.floor((carryMax(s) - weightOf(s.inventory) + 1e-6) / def.weight));
      if (def.kind === 'water') n = Math.min(n, containerCap(s.inventory) - waterCount(s.inventory));
      return Math.max(0, n);
    };
    const fitStore = () => {
      let n = left;
      if (def.kind === 'water') n = Math.min(n, storageWaterCap(s) - waterCount(s.storage));
      return Math.max(0, n);
    };

    const put = (list: ItemStack[], n: number) => {
      if (n <= 0) return;
      if (def.dur !== undefined) {
        for (let i = 0; i < n; i++) {
          const st = this.stackFor(list, id, exp, opts.risk);
          st.qty = 1;
          if (opts.durMult) st.dur = Math.round(def.dur * opts.durMult);
        }
      } else {
        this.stackFor(list, id, exp, opts.risk).qty += n;
      }
    };

    if (to === 'storage') {
      toStore = fitStore();
      put(s.storage, toStore);
      left -= toStore;
    } else {
      toInv = fitInv();
      put(s.inventory, toInv);
      left -= toInv;
      if (left > 0 && to === 'auto' && atBase) {
        toStore = fitStore();
        put(s.storage, toStore);
        left -= toStore;
      }
    }
    if (!opts.quiet) {
      const got = toInv + toStore;
      if (got > 0) this.change('gain', `+${got} ${def.icon} ${def.name}${toStore > 0 && toInv > 0 ? ` (${toStore} vào kho)` : toStore > 0 ? ' (vào kho)' : ''}`);
      if (left > 0)
        this.change(
          'bad',
          def.kind === 'water' ? `Bỏ lại ${left} ${def.name}: không đủ đồ đựng nước` : `Bỏ lại ${left} ${def.name}: hành trang quá nặng`,
        );
    }
    return toInv + toStore;
  }

  /** removes oldest first. 'both' takes from backpack then base storage (if at base) */
  removeItem(id: string, qty: number, from: 'inv' | 'storage' | 'both' = 'both', quiet = false): number {
    const s = this.s;
    let left = qty;
    const lists: ItemStack[][] = [];
    if (from !== 'storage') lists.push(s.inventory);
    if (from === 'storage' || (from === 'both' && s.baseRegion === s.location)) lists.push(s.storage);
    for (const list of lists) {
      const stacks = list.filter((st) => st.id === id).sort((a, b) => (a.exp ?? 1e9) - (b.exp ?? 1e9));
      for (const st of stacks) {
        if (left <= 0) break;
        const take = Math.min(st.qty, left);
        st.qty -= take;
        left -= take;
      }
      this.prune(list);
    }
    const removed = qty - left;
    if (!quiet && removed > 0) this.change('loss', `-${removed} ${item(id).icon} ${itemName(id)}`);
    return removed;
  }

  prune(list: ItemStack[]) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].qty <= 0) list.splice(i, 1);
  }

  /** wear the best tool carrying `tag`; returns true if a tool was used */
  useTool(tag: string, wear = 1): boolean {
    const tools = this.s.inventory
      .filter((st) => ITEMS[st.id]?.tags?.includes(tag) && (ITEMS[st.id]?.kind === 'tool' || ITEMS[st.id]?.kind === 'medical'))
      .sort((a, b) => (b.dur ?? 999) - (a.dur ?? 999));
    const t = tools[0];
    if (!t) return false;
    if (t.dur !== undefined) {
      t.dur -= wear;
      if (t.dur <= 0) {
        t.qty = 0;
        this.prune(this.s.inventory);
        this.change('loss', `${item(t.id).icon} ${itemName(t.id)} đã hỏng`);
      }
    }
    return true;
  }

  // ------------------------------------------------------------ conditions

  addCondition(id: string, sev = 1, durationSlots?: number) {
    const def = CONDITIONS[id];
    const s = this.s;
    const ex = s.conditions.find((c) => c.id === id);
    const until = durationSlots ? this.now + durationSlots : undefined;
    if (ex) {
      switch (def.stack) {
        case 'reject':
          return;
        case 'refresh':
          ex.until = until;
          return;
        case 'add':
          ex.sev = Math.min(def.maxSev, ex.sev + sev);
          ex.treated = false;
          break;
        case 'replace':
          ex.sev = Math.min(def.maxSev, sev);
          ex.until = until;
          break;
        case 'highest':
          ex.sev = Math.min(def.maxSev, Math.max(ex.sev, sev));
          break;
      }
      this.change(def.good ? 'good' : 'bad', `${def.icon} ${def.name(ex.sev)} nặng thêm`);
      return;
    }
    s.conditions.push({ id, sev: Math.min(def.maxSev, sev), until });
    this.change(def.good ? 'good' : 'bad', `${def.icon} Mắc: ${def.name(sev)}`);
  }

  reduceCondition(id: string, by = 1) {
    const s = this.s;
    const c = s.conditions.find((x) => x.id === id);
    if (!c) return;
    const def = CONDITIONS[id];
    c.sev -= by;
    if (c.sev <= 0) {
      s.conditions = s.conditions.filter((x) => x !== c);
      this.change('good', `${def.icon} Đã khỏi: ${def.name(1)}`);
    } else this.change('good', `${def.icon} ${def.name(c.sev + by)} → ${def.name(c.sev)}`);
  }

  removeCondition(id: string, quiet = false) {
    const s = this.s;
    const c = s.conditions.find((x) => x.id === id);
    if (!c) return;
    s.conditions = s.conditions.filter((x) => x !== c);
    if (!quiet) this.change('good', `${CONDITIONS[id].icon} Hết: ${CONDITIONS[id].name(c.sev)}`);
  }

  // ------------------------------------------------------------ world memory

  findLocation(locId: string) {
    const loc = LOCATION_DEFS[locId];
    const r = this.s.regions[loc.region];
    if (r.found.includes(locId)) return;
    r.found.push(locId);
    r.explorePool = r.explorePool.filter((x) => x !== `loc:${locId}`);
    this.change('good', `Phát hiện: ${loc.icon} ${loc.name}`);
    this.journal(`Phát hiện ${loc.name} (${REGION_DEFS[loc.region].name}). ${loc.desc}`, 'discovery');
  }

  discoverRoute(routeId: string) {
    const r = this.s.routes.find((x) => x.id === routeId);
    if (!r || r.known) return;
    r.known = true;
    for (const reg of [r.a, r.b]) {
      this.s.regions[reg].explorePool = this.s.regions[reg].explorePool.filter((x) => x !== `route:${routeId}`);
      if (this.s.regions[reg].discovery === 'unknown') this.s.regions[reg].discovery = 'clued';
    }
    const name = ROUTE_DEFS.find((d) => d.id === routeId)?.name ?? routeId;
    this.change('good', `Tìm ra đường: ${name} (${regionName(r.a)} ↔ ${regionName(r.b)})${r.status === 'blocked' ? ' — đang bị chặn' : ''}`);
    this.journal(`Tìm ra tuyến đường ${name} nối ${regionName(r.a)} và ${regionName(r.b)}.${r.status === 'blocked' ? ' Đường đang bị cây đổ chặn.' : ''}`, 'discovery');
  }

  clueRegion(id: RegionId) {
    const r = this.s.regions[id];
    if (r.discovery === 'unknown') {
      r.discovery = 'clued';
      this.change('info', `Biết đến một vùng mới: ${REGION_DEFS[id].icon} ${REGION_DEFS[id].name}`);
    }
  }

  // ------------------------------------------------------------ progression

  grantXp(skill: SkillId, amount: number) {
    const sk = this.s.skills[skill];
    const max = BALANCE.xp.maxLevel;
    if (sk.lvl >= max || amount <= 0) return;
    sk.xp += Math.round(amount);
    this.change('info', `+${Math.round(amount)} XP ${SKILL_DEFS[skill].name}`);
    while (sk.lvl < max && sk.xp >= BALANCE.xp.perLevel[sk.lvl]) {
      sk.xp -= BALANCE.xp.perLevel[sk.lvl];
      sk.lvl++;
      const perk = SKILL_DEFS[skill].perks[sk.lvl];
      this.change('good', `⬆️ ${SKILL_DEFS[skill].name} lên cấp ${sk.lvl}!${perk ? ` Mở khóa: ${perk}` : ''}`);
      this.journal(`Kỹ năng ${SKILL_DEFS[skill].name} đạt cấp ${sk.lvl}.${perk ? ` ${perk}.` : ''}`, 'milestone');
    }
    if (sk.lvl >= max) sk.xp = 0;
  }

  /**
   * Schedule a follow-up event in `inSlots` slots. If its context does not fit
   * when it comes due, it waits up to `windowSlots` more before lapsing.
   */
  schedule(eventId: string, inSlots: number, data?: Record<string, unknown>, windowSlots = 16) {
    const at = this.now + inSlots;
    this.s.scheduled.push({ eventId, at, expires: at + windowSlots, data });
  }

  /** event memory: the last recorded choice/outcome for an event, if any */
  memory(eventId: string) {
    return [...this.s.history].reverse().find((h) => h.id === eventId);
  }
}

type Change2 = { kind: ChangeKind; text: string };
