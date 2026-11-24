// Diversity-01 Phase 1: content registry, consequences, persistent world state,
// action-triggered events, Director weights and soft tiers.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../src/content/actions.js';
import { CONSEQUENCES, CONSEQUENCE_LIST } from '../src/content/consequences.js';
import { EVENTS } from '../src/content/events.js';
import { ACTION_META, EVENT_META, actionMeta } from '../src/content/meta.js';
import { OBJECT_DEFS } from '../src/content/objects.js';
import { con, processDelayed } from '../src/engine/consequence.js';
import { Ctx, shelterAt } from '../src/engine/ctx.js';
import { directorWeight, runAfterAction } from '../src/engine/director.js';
import { findInstance, instances, newGame, performAction } from '../src/engine/game.js';
import { Rng } from '../src/engine/rng.js';
import { advanceSlots } from '../src/engine/time.js';
import type { GameState } from '../src/engine/types.js';
import { buildView } from '../src/engine/view.js';

const ATTRS = { STR: 2, AGI: 2, END: 2, INT: 2, PER: 2 };
const fresh = (seed = 42) => newGame('Test', ATTRS, seed);

describe('content registry', () => {
  it('gives every action, event and consequence a unique, well-formed code', () => {
    const codes = [
      ...Object.values(ACTION_META).map((m) => m.code),
      ...Object.values(EVENT_META).map((m) => m.code),
      ...CONSEQUENCE_LIST.map((c) => c.code),
    ];
    expect(new Set(codes).size).toBe(codes.length);
    for (const m of Object.values(ACTION_META)) expect(m.code).toMatch(/^ACT-(EXP|GAT|HUN|FSH|CRF|BLD|COK|MED|RES|NAV|SOC|ESC)-\d{3}$/);
    for (const m of Object.values(EVENT_META)) expect(m.code).toMatch(/^EVT-(WTH|WLD|ECO|DIS|RES|BAS|HEA|PSY|NAR|ESC)-\d{3}$/);
    for (const c of CONSEQUENCE_LIST) expect(c.code).toMatch(/^CON-(IMM|DLY|PER|ENV|OPP|CHN)-\d{3}$/);
    expect(new Set(CONSEQUENCE_LIST.map((c) => c.id)).size).toBe(CONSEQUENCE_LIST.length);
  });

  it('has metadata for every event, and every metadata entry is implemented', () => {
    for (const id of Object.keys(EVENTS)) expect(EVENT_META[id], `meta for event ${id}`).toBeDefined();
    for (const id of Object.keys(EVENT_META)) expect(EVENTS[id], `event ${id}`).toBeDefined();
    for (const key of Object.keys(ACTION_META)) {
      const [id, kind, act] = key.split(':');
      if (id === 'object') expect(OBJECT_DEFS[kind]?.actions.some((a) => a.id === act), key).toBe(true);
      else expect(ACTIONS[id], key).toBeDefined();
    }
  });

  it('every action instance met during play has a code', () => {
    const missing = new Set<string>();
    for (let run = 0; run < 6; run++) {
      let s = fresh(100 + run);
      const rng = new Rng(run);
      for (let i = 0; i < 120 && s.status === 'playing'; i++) {
        s.vitals.health = 100;
        s.vitals.hunger = 80;
        s.vitals.thirst = 80;
        s.pending = null;
        for (const inst of instances(s)) if (!actionMeta(inst.key)) missing.add(inst.key);
        const avail = buildView('t', s).actions.filter((a) => a.available && !a.id.startsWith('escape'));
        if (!avail.length) break;
        s = performAction(s, rng.pick(avail).key).state;
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('only applies consequences that exist in the registry', () => {
    const dir = join(__dirname, '../src/content');
    const used = new Set<string>();
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/\bcon\(ctx, '([a-z_]+)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(20);
    for (const id of used) expect(CONSEQUENCES[id], `consequence ${id}`).toBeDefined();
  });
});

describe('consequences', () => {
  it('drops a contradicting consequence on the same target in one transaction', () => {
    const s = fresh();
    const ctx = new Ctx(s);
    expect(con(ctx, 'water_contaminated', { days: 5 })).toBe(true);
    expect(con(ctx, 'water_cleaned')).toBe(false);
    expect(s.regions.river.water).toBe('contaminated');
    expect(s.flags.contamCleared).toBeUndefined();
    expect(s.conLog?.map((c) => c.code)).toContain('CON-PER-001');
  });

  it('skips a consequence whose precondition does not hold', () => {
    const s = fresh();
    const ctx = new Ctx(s);
    expect(con(ctx, 'fire_out', { region: 'coast' })).toBe(false); // no fire here
    expect(con(ctx, 'discover_location', { loc: 'wreck' })).toBe(false); // already known
  });

  it('delayed consequences happen later, and re-check their precondition', () => {
    const s = fresh();
    const ctx = new Ctx(s);
    con(ctx, 'delayed_food_poisoning');
    con(ctx, 'delayed_infection'); // no untreated wound by then → nothing happens
    expect(s.delayed?.length).toBe(2);
    expect(s.conditions.some((c) => c.id === 'illness')).toBe(false);
    advanceSlots(ctx, 2);
    processDelayed(ctx);
    expect(s.conditions.some((c) => c.id === 'illness')).toBe(true);
    expect(s.conditions.some((c) => c.id === 'infection')).toBe(false);
    advanceSlots(ctx, 3);
    expect(s.delayed?.length).toBe(0);
  });
});

describe('persistent world state', () => {
  it('a washed-up crate stays on the beach with its own actions, then the tide takes it', () => {
    const s = fresh();
    const ctx = new Ctx(s);
    con(ctx, 'spawn_object', { kind: 'washed_crate', region: 'coast' });
    const obj = s.objects![0];
    const keys = instances(s).map((i) => i.key);
    expect(keys).toContain(`object:${obj.uid}:washed_crate:smash`);
    expect(actionMeta(`object:${obj.uid}:washed_crate:pry`)?.code).toBe('ACT-EXP-005');
    const view = buildView('t', s);
    expect(view.map.regions.find((r) => r.id === 'coast')!.objects[0].daysLeft).toBe(3);
    // the crate is still there two days later…
    advanceSlots(ctx, 8);
    expect(s.objects!.length).toBe(1);
    // …but gone after its lifetime
    advanceSlots(ctx, 8);
    expect(s.objects!.length).toBe(0);
  });

  it('opening the crate removes it and yields items', () => {
    const s = fresh();
    const ctx = new Ctx(s);
    con(ctx, 'spawn_object', { kind: 'washed_crate', region: 'coast' });
    const uid = s.objects![0].uid;
    const before = s.inventory.reduce((a, x) => a + x.qty, 0);
    ACTIONS.object.resolve(ctx, 'success', `${uid}:washed_crate:smash`);
    expect(s.objects!.length).toBe(0);
    expect(s.inventory.reduce((a, x) => a + x.qty, 0)).toBeGreaterThan(before);
  });

  it('a collapsed cave gives no shelter until the entrance is cleared', () => {
    const s = fresh();
    s.location = 'mountain';
    s.regions.mountain.discovery = 'discovered';
    if (!s.regions.mountain.found.includes('cave')) s.regions.mountain.found.push('cave');
    expect(shelterAt(s, 'mountain')).toBe('cave');
    const ctx = new Ctx(s);
    con(ctx, 'location_state', { loc: 'cave', state: 'collapsed' });
    expect(shelterAt(s, 'mountain')).toBeNull();
    expect(findInstance(s, 'clear_location:cave')).toBeDefined();
    const loc = buildView('t', s).map.regions.find((r) => r.id === 'mountain')!.locations.find((l) => l.id === 'cave')!;
    expect(loc.stateGood).toBe(false);
    ACTIONS.clear_location.resolve(ctx, 'success', 'cave');
    expect(shelterAt(s, 'mountain')).toBe('cave');
    expect(findInstance(s, 'clear_location:cave')).toBeUndefined();
  });

  it('loads saves made before world state existed', () => {
    const s = fresh() as GameState;
    delete s.locations;
    delete s.objects;
    delete s.delayed;
    delete s.conLog;
    const v = buildView('t', s);
    expect(v.map.regions.every((r) => Array.isArray(r.objects))).toBe(true);
    const next = performAction(s, 'rest').state;
    expect(next.status).toBe('playing');
  });
});

describe('action-triggered events and Director weights', () => {
  it('fishing can snag a net — only events listening to that action fire', () => {
    const fired = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const s = fresh(seed);
      s.location = 'river';
      s.day = 5;
      const ctx = new Ctx(s);
      runAfterAction(ctx, 'fish');
      if (s.pending) fired.add(s.pending.eventId);
    }
    expect(fired.has('net_snag')).toBe(true);
    for (const id of fired) expect(EVENTS[id].onAction).toContain('fish');
  });

  it('W = B × N × C × P × rarity: rarity and pacing shape the weight', () => {
    const s = fresh();
    s.location = 'coast';
    const ctx = new Ctx(s);
    s.world.pacing = 'normal';
    const normal = directorWeight(ctx, EVENTS.monkey_thief);
    s.world.pacing = 'tense';
    expect(directorWeight(ctx, EVENTS.monkey_thief)).toBeGreaterThan(normal); // wildlife favoured on tense days
    s.world.pacing = 'calm';
    expect(directorWeight(ctx, EVENTS.monkey_thief)).toBeLessThan(normal);
    // an uncommon event weighs less than the same base weight would as common
    s.world.pacing = 'normal';
    expect(EVENT_META.turtle_nesting.rarity).toBe('uncommon');
  });

  it('a hidden hollow leaves a cache that waits in the jungle until opened', () => {
    const s = fresh();
    s.location = 'jungle';
    const ctx = new Ctx(s);
    EVENTS.hidden_hollow.passive!(ctx);
    expect(s.objects?.[0].kind).toBe('old_cache');
    expect(s.objects?.[0].expiresAt).toBeUndefined();
    expect(instances(s).some((i) => i.key.endsWith(':old_cache:open'))).toBe(true);
  });
});

describe('soft tiers', () => {
  it('a skill-locked structure can be attempted untrained, at -5 and with real crit-failure risk', () => {
    const s = fresh();
    s.baseRegion = 'coast';
    s.structures.push({ uid: 999, id: 'lean_to', region: 'coast', integrity: 100 });
    s.skills.crafting.lvl = 0;
    const inst = findInstance(s, 'build:hut')!;
    expect(inst).toBeDefined();
    expect(inst.def.reqs!(s, 'hut').some((r) => !r.met)).toBe(false);
    const spec = inst.def.check!(s, 'hut')!;
    expect(spec.mods).toContainEqual({ label: 'Chưa thành thạo', value: -5 });
    expect(spec.crit).toBe('standard');
    const a = buildView('t', s).actions.find((x) => x.key === 'build:hut')!;
    expect(a.untrained).toBe(true);
    expect(a.code).toBe('ACT-BLD-002');
    // trained: no penalty, safe crits
    s.skills.crafting.lvl = 2;
    const trained = inst.def.check!(s, 'hut')!;
    expect(trained.crit).toBe('safe');
    expect(trained.mods ?? []).not.toContainEqual({ label: 'Chưa thành thạo', value: -5 });
  });

  it('tools and materials stay hard requirements', () => {
    const s = fresh();
    s.inventory = s.inventory.filter((x) => x.id !== 'knife' && x.id !== 'stone_knife');
    const inst = findInstance(s, 'craft:snare');
    if (inst?.def.reqs) {
      const reqs = inst.def.reqs(s, 'snare');
      expect(reqs.every((r) => !r.label.startsWith('Cần Săn bắt'))).toBe(true);
    }
  });
});
