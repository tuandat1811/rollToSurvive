// Diversity-01 Phase 2: controlled randomness (foreshadowing, recovery, meaningful
// risk) and the in-day chains (water smell → investigation, unfinished repairs).
import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../src/content/actions.js';
import { EVENTS } from '../src/content/events.js';
import { MISFORTUNE, RECOVERY_EVENTS } from '../src/content/families.js';
import { Ctx, shelterAt } from '../src/engine/ctx.js';
import { directorWeight, fire, runAfterAction, runTrigger } from '../src/engine/director.js';
import { findInstance, newGame, performAction, updateMisfortune } from '../src/engine/game.js';
import { advanceSlots } from '../src/engine/time.js';
import type { GameState } from '../src/engine/types.js';
import { buildView } from '../src/engine/view.js';

const ATTRS = { STR: 2, AGI: 2, END: 2, INT: 2, PER: 2 };
/** a new game past the day-1 camp tutorial (tested on its own in tutorial.test.ts) */
const fresh = (seed = 42) => {
  const s = newGame('Test', ATTRS, seed);
  delete s.flags.tutorial;
  return s;
};

function withBase(s: GameState) {
  s.baseRegion = 'coast';
  s.structures.push({ uid: 900, id: 'lean_to', region: 'coast', integrity: 100 });
  s.storage.push({ id: 'fish_smoked', qty: 6 });
  return s;
}

describe('meaningful risk', () => {
  it('every risky event comes with a choice, an omen or a stated cause', () => {
    const bad = Object.values(EVENTS)
      .filter((d) => d.risk >= 2)
      .filter((d) => !d.omen && !d.cause && !(d.choices && d.choices(fresh(), {}).length))
      .map((d) => d.id);
    expect(bad).toEqual([]);
  });

  it('twisting an ankle needs a reason: exhaustion, wet rocks or a heavy pack', () => {
    const s = fresh();
    s.location = 'mountain';
    s.world.weather = 'clear';
    s.vitals.energy = 90;
    expect(EVENTS.twisted_ankle.eligible!(s)).toBe(false);
    s.vitals.energy = 20;
    expect(EVENTS.twisted_ankle.eligible!(s)).toBe(true);
    expect(EVENTS.twisted_ankle.cause!(s)).toMatch(/kiệt sức/i);
  });
});

describe('foreshadowing', () => {
  it('omen-gated threats never fire at random', () => {
    const gated = Object.values(EVENTS).filter((d) => d.omen);
    expect(gated.map((d) => d.id).sort()).toEqual(['boar_raid', 'cave_collapse', 'landslide']);
    for (const d of gated) expect(EVENTS[d.omen!], `omen of ${d.id}`).toBeDefined();
    // a camp that would have been raided at random before: many nights, no omen → no raid
    for (let seed = 0; seed < 60; seed++) {
      const s = withBase(fresh(seed));
      s.location = 'jungle';
      const ctx = new Ctx(s);
      runTrigger(ctx, 'night');
      expect(s.history.some((h) => h.id === 'boar_raid')).toBe(false);
    }
  });

  it('boar signs by day → the raid comes that night; securing the storage saves the food', () => {
    for (const secure of [false, true]) {
      const s = withBase(fresh(7));
      s.slot = 2;
      const ctx = new Ctx(s);
      fire(ctx, EVENTS.boar_signs);
      expect(s.scheduled.some((e) => e.eventId === 'boar_raid')).toBe(true);
      if (secure) {
        expect(findInstance(s, 'secure_storage')).toBeDefined();
        ACTIONS.secure_storage.resolve(ctx, 'success', '');
      }
      s.location = 'jungle'; // away from camp: the worst case
      const food = () => s.storage.filter((x) => x.id === 'fish_smoked').reduce((a, x) => a + x.qty, 0);
      advanceSlots(ctx, 1); // slot 3: the raid waits for the night
      expect(s.history.some((h) => h.id === 'boar_raid')).toBe(false);
      advanceSlots(ctx, 1); // night
      expect(s.history.some((h) => h.id === 'boar_raid')).toBe(true);
      expect(food()).toBe(secure ? 6 : food());
      if (!secure) expect(food()).toBeLessThan(6);
    }
  });

  it('cracks in the cave roof can be shored up before the collapse', () => {
    for (const shore of [false, true]) {
      const s = fresh(3);
      s.location = 'mountain';
      if (!s.regions.mountain.found.includes('cave')) s.regions.mountain.found.push('cave');
      s.world.lastRainDay = s.day;
      s.inventory.push({ id: 'wood', qty: 4 });
      const ctx = new Ctx(s);
      fire(ctx, EVENTS.rockfall_signs);
      if (shore) {
        expect(findInstance(s, 'shore_up_cave')).toBeDefined();
        ACTIONS.shore_up_cave.resolve(ctx, 'success', '');
      }
      advanceSlots(ctx, 12);
      expect(shelterAt(s, 'mountain')).toBe(shore ? 'cave' : null);
    }
  });

  it('reinforcing the shelter takes most of the sting out of a storm', () => {
    const damage = (reinforce: boolean) => {
      const s = withBase(fresh(11));
      s.world.weather = 'storm';
      const ctx = new Ctx(s);
      if (reinforce) ctx.flag('reinforcedUntil', s.day);
      EVENTS.storm_hits.passive!(ctx);
      return 100 - (s.structures.find((x) => x.uid === 900)?.integrity ?? 0);
    };
    expect(damage(true)).toBeLessThan(damage(false));
    expect(damage(true)).toBeLessThanOrEqual(11);
  });

  it('the storm warning names the preparation actions', () => {
    const s = withBase(fresh());
    s.world.tomorrow = 'storm';
    s.world.forecastUntil = s.day + 1;
    expect(EVENTS.storm_warning.text(s)).toContain('Gia cố nơi trú ẩn');
    const a = buildView('t', s).actions.find((x) => x.key === 'reinforce_shelter')!;
    expect(a).toBeDefined();
    expect(a.priority).toBeGreaterThan(50);
  });
});

describe('recovery opportunities', () => {
  it('hardship raises misfortune, nights wear it down', () => {
    const s = fresh();
    const ctx = new Ctx(s);
    ctx.vital('health', -30, 'test');
    ctx.addCondition('injury', 1);
    updateMisfortune(ctx);
    expect(s.world.misfortune).toBeGreaterThanOrEqual(3);
    const before = s.world.misfortune!;
    advanceSlots(ctx, 4); // through one night
    expect(s.world.misfortune!).toBeLessThan(before);
  });

  it('while rough, the Director damps risky events and favours recovery', () => {
    const s = fresh();
    s.location = 'river';
    const ctx = new Ctx(s);
    const risky = EVENTS.snake_at_spring;
    const calm = EVENTS.fish_school;
    const r0 = directorWeight(ctx, risky);
    const c0 = directorWeight(ctx, calm);
    s.world.misfortune = MISFORTUNE.rough + 1;
    expect(directorWeight(ctx, risky)).toBeCloseTo(r0 * MISFORTUNE.riskyMult);
    expect(directorWeight(ctx, calm)).toBeCloseTo(c0 * MISFORTUNE.recoveryMult);
    expect(RECOVERY_EVENTS.has('second_wind')).toBe(true);
    expect(EVENTS.second_wind.weight!(s)).toBeGreaterThan(0);
  });

  it('a recovery event relieves misfortune', () => {
    const s = fresh();
    s.world.misfortune = 5;
    const ctx = new Ctx(s);
    fire(ctx, EVENTS.second_wind);
    expect(s.world.misfortune!).toBeLessThan(5);
    expect(s.conditions.some((c) => c.id === 'determined')).toBe(true);
  });
});

describe('a day of decisions', () => {
  it('collecting water can reveal the contamination and open the investigation', () => {
    let hit: GameState | undefined;
    for (let seed = 0; seed < 300 && !hit; seed++) {
      const s = fresh(seed);
      s.location = 'river';
      s.day = 6;
      const ctx = new Ctx(s);
      runAfterAction(ctx, 'collect_water');
      if (s.pending?.eventId === 'river_contamination') hit = s;
    }
    expect(hit).toBeDefined();
    const s = hit!;
    expect(s.regions.river.water).toBe('contaminated');
    expect(s.regions.river.waterKnown).toBe(true);
    s.pending = null;
    expect(findInstance(s, 'trace_contamination')).toBeDefined();
    expect(findInstance(s, 'find_alt_water')).toBeDefined();
    expect(buildView('t', { ...s, pending: { uid: 1, eventId: 'river_contamination' } }).pending?.cause).toBeUndefined();
  });

  it('a partial repair leaves the roof unfinished until more materials are added', () => {
    const s = withBase(fresh());
    const st = s.structures.find((x) => x.uid === 900)!;
    st.integrity = 30;
    const ctx = new Ctx(s);
    ACTIONS.repair.resolve(ctx, 'partial', '900');
    expect(st.unfinished).toBe(true);
    expect(buildView('t', s).map.regions.find((r) => r.id === 'coast')!.structures.find((x) => x.id === 'lean_to')!.unfinished).toBe(true);
    s.inventory.push({ id: 'palm', qty: 2 }, { id: 'fiber', qty: 1 });
    const next = performAction(s, 'finish_repair:900').state;
    const after = next.structures.find((x) => x.uid === 900)!;
    expect(after.unfinished).toBeUndefined();
    expect(after.integrity).toBeGreaterThan(st.integrity);
  });
});
