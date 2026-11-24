// Forced day-1 camp tutorial: build a lean-to before anything else.
import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../src/content/actions.js';
import { LOCKED_REASON } from '../src/content/tutorial.js';
import { Ctx, countBoth } from '../src/engine/ctx.js';
import { runTrigger } from '../src/engine/director.js';
import { newGame, performAction } from '../src/engine/game.js';
import { advanceSlots } from '../src/engine/time.js';
import type { GameState } from '../src/engine/types.js';
import { buildView } from '../src/engine/view.js';

const ATTRS = { STR: 2, AGI: 2, END: 2, INT: 2, PER: 2 };
const enough = (s: GameState) => countBoth(s, 'wood') >= 3 && countBoth(s, 'palm') >= 4 && countBoth(s, 'fiber') >= 2;

describe('day-1 camp tutorial', () => {
  it('a new run starts with the camp objective and only the actions that lead there', () => {
    const s = newGame('T', ATTRS, 1);
    const v = buildView('t', s);
    expect(v.objective?.title).toMatch(/Dựng lều tạm/);
    const open = v.actions.filter((a) => a.available).map((a) => a.id);
    expect(new Set(open)).toEqual(new Set(open.filter((id) => ['gather', 'rest', 'travel', 'collect_water', 'build'].includes(id))));
    const wreck = v.actions.find((a) => a.key === 'search_wreck')!;
    expect(wreck.available).toBe(false);
    expect(wreck.reasons[0]).toBe(LOCKED_REASON);
    // the lean-to is shown (locked only by materials) and gathering leads the suggestions
    expect(v.actions.find((a) => a.key === 'build:lean_to')).toBeDefined();
    const top = v.actions.filter((a) => a.available).sort((a, b) => b.priority - a.priority)[0];
    expect(top.id).toBe('gather');
  });

  it('building the lean-to completes the tutorial and unlocks everything', () => {
    let s = newGame('T', ATTRS, 2);
    s.inventory.push({ id: 'wood', qty: 3 }, { id: 'palm', qty: 4 }, { id: 'fiber', qty: 2 });
    s = performAction(s, 'build:lean_to').state;
    expect(s.baseRegion).toBe('coast');
    expect(s.flags.tutorial).toBeUndefined();
    const v = buildView('t', s);
    expect(v.objective).toBeUndefined();
    expect(v.actions.find((a) => a.key === 'search_wreck')!.reasons).not.toContain(LOCKED_REASON);
  });

  it('the guided first lean-to never collapses', () => {
    const s = newGame('T', ATTRS, 3);
    s.inventory.push({ id: 'wood', qty: 3 }, { id: 'palm', qty: 4 }, { id: 'fiber', qty: 2 });
    const ctx = new Ctx(s);
    ACTIONS.build.resolve(ctx, 'failure', 'lean_to');
    expect(s.baseRegion).toBe('coast');
    expect(s.structures.find((x) => x.id === 'lean_to')?.integrity).toBe(60);
  });

  it('if night falls first, a flimsy lean-to goes up anyway', () => {
    let s = newGame('T', ATTRS, 4);
    for (let i = 0; i < 4 && s.day === 1; i++) s = performAction(s, 'rest').state;
    expect(s.day).toBe(2);
    expect(s.baseRegion).toBe('coast');
    expect(s.structures.find((x) => x.id === 'lean_to')?.integrity).toBe(35);
    expect(s.flags.tutorial).toBeUndefined();
  });

  it('the Director holds back random events during the tutorial', () => {
    const s = newGame('T', ATTRS, 5);
    s.slot = 1;
    s.world.pacing = 'tense';
    const before = s.history.length;
    for (let i = 0; i < 200; i++) runTrigger(new Ctx(s), 'slot_start');
    expect(s.history.length).toBe(before);
  });

  it('balance: gathering at the beach builds the camp before nightfall in most runs', () => {
    let built = 0;
    const N = 200;
    for (let seed = 0; seed < N; seed++) {
      let s = newGame('T', ATTRS, 1000 + seed);
      while (s.day === 1 && s.status === 'playing') {
        if (s.pending) s.pending = null;
        if (enough(s)) {
          s = performAction(s, 'build:lean_to').state;
          break;
        }
        s = performAction(s, 'gather').state;
      }
      const lean = s.structures.find((x) => x.id === 'lean_to');
      if (lean && lean.integrity > 35) built++;
    }
    expect(built / N).toBeGreaterThan(0.9);
    void advanceSlots;
  });
});
