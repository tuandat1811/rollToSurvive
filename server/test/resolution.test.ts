// Phase C: resolution variety — opposed checks, preparation, resource sacrifice
// and risk escalation (push-your-luck expeditions).
import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/content/events.js';
import { EXPEDITION_BY_ID, resolveStep } from '../src/content/expeditions.js';
import { odds, resolveCheck, roll } from '../src/engine/check.js';
import { Ctx, count } from '../src/engine/ctx.js';
import { chooseEvent, findInstance, newGame, performAction } from '../src/engine/game.js';
import type { CheckSpec, GameState } from '../src/engine/types.js';
import { buildView } from '../src/engine/view.js';

const ATTRS = { STR: 2, AGI: 2, END: 2, INT: 2, PER: 2 };
const fresh = (seed = 42) => newGame('Test', ATTRS, seed);

describe('opposed checks', () => {
  const spec: CheckSpec = { label: 'Đấu', attr: 'STR', dc: 14, opposed: { label: 'Lợn mẹ', icon: '🐗', bonus: 3 } };

  it('the opponent rolls too, and that total is what you have to beat', () => {
    const s = fresh();
    for (let i = 0; i < 30; i++) {
      const ctx = new Ctx(s);
      const r = roll(ctx, spec);
      ctx.sync();
      expect(r.opp).toBeDefined();
      expect(r.opp!.total).toBe(r.opp!.die + 3);
      expect(r.dc).toBe(r.opp!.total);
    }
  });

  it('odds average over every opponent roll and sum to 1', () => {
    const o = odds(resolveCheck(fresh(), spec));
    const sum = Object.values(o).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
    // a stronger opponent makes success rarer
    const strong = odds(resolveCheck(fresh(), { ...spec, opposed: { label: 'x', bonus: 8 } }));
    expect(strong.success + strong.crit_success).toBeLessThan(o.success + o.crit_success);
  });

  it('animal confrontations are opposed and the view says who you face', () => {
    expect(EVENTS.boar_sow_angry.choices!(fresh()).find((c) => c.id === 'fight')!.check!.opposed?.label).toBe('Lợn mẹ');
    expect(EVENTS.monkey_thief.choices!(fresh()).find((c) => c.id === 'chase')!.check!.opposed).toBeDefined();
    const s = fresh();
    s.pending = { uid: 1, eventId: 'monkey_thief' };
    const chase = buildView('t', s).pending!.choices.find((c) => c.id === 'chase')!;
    expect(chase.check?.opposed?.label).toBe('Con khỉ');
  });
});

describe('preparation', () => {
  it('scouting the trails gives advantage on the next hunt, then is used up', () => {
    let s = fresh();
    s.location = 'jungle';
    s.inventory.push({ id: 'spear', qty: 1, dur: 20 });
    s = performAction(s, 'prepare:hunting').state;
    const hunt = buildView('t', s).actions.find((a) => a.key === 'hunt')!;
    expect(hunt.check!.adv).toBe(1);
    expect(hunt.check!.dice).toBe(2);
    expect(hunt.check!.prepared).toMatch(/lối mòn/);
    expect(findInstance(s, 'prepare:hunting')).toBeUndefined(); // already prepared
    s.vitals.energy = 100;
    const r = performAction(s, 'hunt');
    expect(r.result.roll!.dice.length).toBe(2);
    expect(r.result.roll!.prepared).toBeDefined();
    expect(r.state.flags['prep:hunting']).toBeUndefined();
  });

  it('a preparation expires if not used', () => {
    let s = fresh();
    s.location = 'river';
    s = performAction(s, 'prepare:fishing').state;
    const until = Number(s.flags['prep:fishing']);
    s.day += 3;
    expect(until).toBeLessThan((s.day - 1) * 4 + s.slot);
    expect(resolveCheck(s, { attr: 'AGI', dc: 10, tags: ['fishing'] }).adv).toBe(0);
  });
});

describe('resource sacrifice', () => {
  it('offers only resources the player carries, and the bonus shows in the preview', () => {
    const s = fresh();
    s.inventory = s.inventory.filter((x) => x.id !== 'flint');
    s.inventory.push({ id: 'wood', qty: 3 }, { id: 'lamp_oil', qty: 1 });
    const a = buildView('t', s).actions.find((x) => x.key === 'make_fire')!;
    expect(a.sacrifices?.map((x) => x.id)).toEqual(['oil_fire']);
    const oil = a.sacrifices![0];
    expect(oil.check.totalMod).toBe(a.check!.totalMod + 4);
  });

  it('spends the resource and adds the bonus to the roll', () => {
    const s = fresh();
    s.inventory.push({ id: 'wood', qty: 3 }, { id: 'lamp_oil', qty: 1 });
    const r = performAction(s, 'make_fire', { sacrifice: 'oil_fire' });
    expect(count(r.state.inventory, 'lamp_oil')).toBe(0);
    expect(r.result.roll!.mods.some((m) => m.label.startsWith('Hy sinh') && m.value === 4)).toBe(true);
  });

  it('rejects a sacrifice the player cannot afford', () => {
    const s = fresh();
    s.inventory.push({ id: 'wood', qty: 3 });
    s.inventory = s.inventory.filter((x) => x.id !== 'lamp_oil');
    expect(() => performAction(s, 'make_fire', { sacrifice: 'oil_fire' })).toThrow();
  });
});

describe('risk escalation (expeditions)', () => {
  const atWreck = () => {
    const s = fresh(5);
    s.vitals.energy = 100;
    return s;
  };

  it('success opens a deeper step; stopping keeps the whole bag', () => {
    const s = atWreck();
    const ctx = new Ctx(s);
    const exp = EXPEDITION_BY_ID.wreck_hold;
    const bag = resolveStep(ctx, exp, 0, 'success', {})!;
    expect(Object.values(bag).reduce((a, b) => a + b, 0)).toBe(2);
    s.pending = { uid: 1, eventId: 'expedition_step', data: { exp: 'wreck_hold', step: 1, bag } };
    const choices = buildView('t', s).pending!.choices.map((c) => c.id);
    expect(choices).toEqual(['push', 'stop']);
    const before = s.inventory.reduce((a, x) => a + x.qty, 0);
    const after = chooseEvent(s, 'stop').state;
    expect(after.pending).toBeNull();
    expect(after.inventory.reduce((a, x) => a + x.qty, 0)).toBe(before + 2);
  });

  it('a failed step drops half the bag and hurts; a disaster loses it all', () => {
    const exp = EXPEDITION_BY_ID.wreck_hold;
    const s1 = atWreck();
    const n1 = s1.inventory.reduce((a, x) => a + x.qty, 0);
    expect(resolveStep(new Ctx(s1), exp, 1, 'failure', { canned: 4, rope: 2 })).toBeNull();
    expect(s1.inventory.reduce((a, x) => a + x.qty, 0)).toBe(n1 + 3);
    expect(s1.vitals.health).toBeLessThan(100);
    const s2 = atWreck();
    const n2 = s2.inventory.reduce((a, x) => a + x.qty, 0);
    expect(resolveStep(new Ctx(s2), exp, 1, 'crit_failure', { canned: 4, rope: 2 })).toBeNull();
    expect(s2.inventory.reduce((a, x) => a + x.qty, 0)).toBe(n2);
  });

  it('the action starts the expedition and the place runs dry after a few dives', () => {
    let s: GameState = atWreck();
    const a = buildView('t', s).actions.find((x) => x.key === 'expedition:wreck_hold')!;
    expect(a.code).toBe('ACT-EXP-008');
    expect(a.notes.join(' ')).toMatch(/Leo thang rủi ro/);
    for (let i = 0; i < 3; i++) {
      s.vitals.energy = 100;
      s.vitals.health = 100;
      s = performAction(s, 'expedition:wreck_hold').state;
      if (s.pending?.eventId === 'expedition_step') s = chooseEvent(s, 'stop').state;
      s.pending = null;
    }
    expect(findInstance(s, 'expedition:wreck_hold')).toBeUndefined();
  });
});
