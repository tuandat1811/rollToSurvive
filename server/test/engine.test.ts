import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { Store } from '../src/db.ts';
import { WEATHER_DEFS, WEATHER_MARKOV } from '../src/content/weather.ts';
import { bands, resolveCheck, successFace, tierFor } from '../src/engine/check.ts';
import { GameError, actionEnergy, chooseEvent, consume, escapeStep, findInstance, newGame, performAction } from '../src/engine/game.ts';
import type { GameState } from '../src/engine/types.ts';
import { buildView } from '../src/engine/view.ts';

const ATTRS = { STR: 2, AGI: 2, END: 2, INT: 2, PER: 2 };
const fresh = (seed = 42) => newGame('Test', ATTRS, seed);

describe('new game', () => {
  it('creates a playable island', () => {
    const s = fresh();
    expect(s.day).toBe(1);
    expect(s.location).toBe('coast');
    expect(s.regions.coast.found).toContain('wreck');
    expect(s.world.ships.length).toBe(1);
    const v = buildView('x', s);
    expect(v.actions.some((a) => a.key === 'search_wreck' && a.available)).toBe(true);
    // escape is allowed from day 1 (with the right materials)
    expect(v.actions.some((a) => a.key === 'escape_desperate')).toBe(true);
  });

  it('rejects invalid attribute allocations', () => {
    expect(() => newGame('x', { STR: 6, AGI: 1, END: 1, INT: 1, PER: 1 }, 1)).toThrow(GameError);
    expect(() => newGame('x', { STR: 1, AGI: 1, END: 1, INT: 1, PER: 1 }, 1)).toThrow(GameError);
  });

  it('varies the island between runs (hybrid world)', () => {
    const pools = new Set<string>();
    for (let i = 0; i < 20; i++) pools.add(fresh(i).regions.coast.explorePool.join(','));
    expect(pools.size).toBeGreaterThan(1);
  });
});

describe('D20 resolution', () => {
  it('maps margins to outcome tiers', () => {
    expect(tierFor(10, 22, 12)).toBe('crit_success');
    expect(tierFor(10, 12, 12)).toBe('success');
    expect(tierFor(10, 9, 12)).toBe('partial');
    expect(tierFor(10, 4, 12)).toBe('failure');
    expect(tierFor(5, 1, 12)).toBe('crit_failure');
  });
  it('lists readable score bands per tier (die face and total)', () => {
    // +2 modifier vs DC 10, standard crit rules
    expect(bands(2, 10, 'standard')).toEqual([
      { tier: 'crit_success', faceMin: 18, faceMax: 20, totalMin: 20, totalMax: 22 },
      { tier: 'success', faceMin: 8, faceMax: 17, totalMin: 10, totalMax: 19 },
      { tier: 'partial', faceMin: 4, faceMax: 7, totalMin: 6, totalMax: 9 },
      { tier: 'failure', faceMin: 2, faceMax: 3, totalMin: 4, totalMax: 5 },
      { tier: 'crit_failure', faceMin: 1, faceMax: 1, totalMin: 3, totalMax: 3 },
    ]);
    expect(successFace(bands(2, 10, 'standard'))).toBe(8);
    // very hard: only a natural 20 can lift a partial into a success
    expect(successFace(bands(0, 23, 'standard'))).toBe(20);
    expect(successFace(bands(0, 30, 'standard'))).toBeNull();
  });

  it('natural 20 / 1 shift one tier, safe actions never critically fail', () => {
    expect(tierFor(20, 27, 30)).toBe('success'); // partial -> success, does not skip to crit
    expect(tierFor(1, 13, 12)).toBe('partial');
    expect(tierFor(1, 1, 15, 'safe')).toBe('failure');
  });
});

describe('transactions', () => {
  it('is deterministic: replaying the same action from the same save gives the same roll', () => {
    const s = fresh(7);
    const a = performAction(s, 'search_wreck');
    const b = performAction(s, 'search_wreck');
    expect(a.result.roll?.natural).toBe(b.result.roll?.natural);
    expect(a.state.inventory).toEqual(b.state.inventory);
  });

  it('does not mutate the input state and advances the version and time', () => {
    const s = fresh();
    const before = JSON.stringify(s);
    const { state } = performAction(s, 'search_wreck');
    expect(JSON.stringify(s)).toBe(before);
    expect(state.version).toBe(s.version + 1);
    expect(state.slot).toBe(1);
    expect(state.vitals.energy).toBeLessThan(s.vitals.energy);
  });

  it('rejects unavailable actions without spending time', () => {
    const s = fresh();
    expect(() => performAction(s, 'travel:mountain')).toThrow(GameError);
    expect(() => performAction(s, 'build:hut')).toThrow(GameError);
    expect(findInstance(s, 'nonsense')).toBeUndefined();
  });

  it('eating and drinking costs no time slot', () => {
    const s = fresh();
    const { state } = consume(s, 'water_safe', 'inv');
    expect(state.slot).toBe(s.slot);
    expect(state.vitals.thirst).toBeGreaterThan(s.vitals.thirst);
  });
});

describe('survival', () => {
  it('ends the run when health reaches 0 and blocks further actions', () => {
    let s: GameState = fresh();
    for (let i = 0; i < 200 && s.status === 'playing'; i++) {
      if (s.pending) {
        const v = buildView('x', s);
        s = chooseEvent(s, v.pending!.choices.find((c) => c.available)!.id).state;
        continue;
      }
      s = performAction(s, 'rest').state;
    }
    expect(s.status).toBe('dead');
    expect(s.vitals.health).toBe(0);
    expect(s.ending?.text).toMatch(/Nguyên nhân/);
    expect(() => performAction(s, 'rest')).toThrow(GameError);
  });

  it('a ship passing while standing at a sea-view spot offers a signal choice', () => {
    const s = fresh();
    s.world.ships = [1];
    const { state } = performAction(s, 'search_wreck');
    expect(state.pending?.eventId).toBe('ship_sighted');
    const v = buildView('x', state);
    expect(v.pending!.choices.map((c) => c.id)).toContain('wave');
  });
});

describe('weather', () => {
  it('defines 10 weather types whose transitions stay within the set', () => {
    const ids = Object.keys(WEATHER_DEFS);
    expect(ids.length).toBe(10);
    for (const [from, to] of Object.entries(WEATHER_MARKOV)) {
      expect(ids).toContain(from);
      for (const [w] of to) expect(ids).toContain(w);
    }
  });

  it('applies weather buffs and nerfs to checks', () => {
    const s = fresh();
    s.world.weather = 'fog';
    const hunt = resolveCheck(s, { attr: 'AGI', skill: 'hunting', dc: 14, outdoor: true, tags: ['hunting'] });
    expect(hunt.mods.some((m) => m.value === 2)).toBe(true);
    const look = resolveCheck(s, { attr: 'PER', dc: 12, outdoor: true });
    expect(look.mods.some((m) => m.value === -2)).toBe(true);
    s.world.weather = 'clear';
    expect(resolveCheck(s, { attr: 'PER', dc: 12, outdoor: true }).mods.some((m) => m.value === 1)).toBe(true);
    // indoor PER checks are not affected by fog
    s.world.weather = 'fog';
    expect(resolveCheck(s, { attr: 'PER', dc: 12 }).mods.length).toBe(0);
  });

  it('changes the energy cost of heavy work', () => {
    const s = fresh();
    const gather = findInstance(s, 'gather')!;
    const base = actionEnergy(s, gather.def, '');
    s.world.weather = 'breezy';
    expect(actionEnergy(s, gather.def, '')).toBe(base - 2);
    s.world.weather = 'humid';
    expect(actionEnergy(s, gather.def, '')).toBe(base + 3);
  });

  it('produces every weather type over a long run, with no storm in the first 3 days', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      let s: GameState = fresh(seed);
      for (let i = 0; i < 80 && s.status === 'playing'; i++) {
        s.vitals.hunger = 100;
        s.vitals.thirst = 100;
        s.vitals.health = 100;
        if (s.pending) {
          const v = buildView('x', s);
          s = chooseEvent(s, v.pending!.choices.find((c) => c.available)!.id).state;
          continue;
        }
        s = performAction(s, 'rest').state;
        if (s.day <= 3) expect(s.world.weather).not.toBe('storm');
        seen.add(s.world.weather);
      }
    }
    expect(seen.size).toBe(10);
  });
});

describe('escape', () => {
  it('a prepared raft can reach victory', () => {
    let wins = 0;
    for (let seed = 0; seed < 40; seed++) {
      let s = newGame('Sailor', { STR: 3, AGI: 1, END: 3, INT: 2, PER: 1 }, seed);
      s.projects.push({ id: 'raft', region: 'coast', stage: 3, integrity: 100 });
      s.world.currents = 3;
      s.inventory.push({ id: 'water_safe', qty: 1 }, { id: 'canned', qty: 3 });
      s = performAction(s, 'escape_raft').state;
      expect(s.escape?.method).toBe('raft');
      for (let i = 0; i < 12 && s.escape && s.status === 'playing'; i++) s = escapeStep(s, 'roll').state;
      if (s.status === 'victory') wins++;
    }
    expect(wins).toBeGreaterThan(5);
  });
});

describe('API', () => {
  it('creates, loads and rejects stale versions (no double-submit)', async () => {
    const app = buildApp(new Store(':memory:'));
    const created = await app.inject({ method: 'POST', url: '/api/runs', payload: { name: 'API', attrs: ATTRS } });
    expect(created.statusCode).toBe(200);
    const view = created.json().view;
    const ok = await app.inject({ method: 'POST', url: `/api/runs/${view.id}/action`, payload: { key: 'search_wreck', version: view.version } });
    expect(ok.statusCode).toBe(200);
    const dup = await app.inject({ method: 'POST', url: `/api/runs/${view.id}/action`, payload: { key: 'search_wreck', version: view.version } });
    expect(dup.statusCode).toBe(409);
    const bad = await app.inject({ method: 'POST', url: `/api/runs/${view.id}/action`, payload: { key: 'build:hut', version: ok.json().view.version } });
    expect(bad.statusCode).toBe(422);
    const missing = await app.inject({ method: 'GET', url: '/api/runs/00000000-0000-4000-8000-000000000000' });
    expect(missing.statusCode).toBe(404);
  });
});
