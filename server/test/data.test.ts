// Phase 3: data-driven content — mini-syntax, validator, Excel round trip and
// pack content running through the real engine.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../src/content/actions.js';
import { EVENTS } from '../src/content/events.js';
import { ACTION_META, EVENT_META } from '../src/content/meta.js';
import { PACK } from '../src/content/data/pack.js';
import {
  ParseError,
  evalAll,
  parseConditions,
  parseConsequences,
  parseContext,
  parseMaterials,
  parseMods,
  parseOpposed,
  resolveParams,
} from '../src/content/data/parse.js';
import { existingCodes, validatePack } from '../src/content/data/validate.js';
import type { ContentPack } from '../src/content/data/schema.js';
import { Ctx } from '../src/engine/ctx.js';
import { fire } from '../src/engine/director.js';
import { chooseEvent, findInstance, newGame, performAction } from '../src/engine/game.js';
import { buildView } from '../src/engine/view.js';
import { readWorkbook, writeWorkbook } from '../scripts/lib/workbook.js';

const ATTRS = { STR: 2, AGI: 2, END: 2, INT: 2, PER: 2 };
const fresh = (seed = 42) => newGame('Test', ATTRS, seed);
const clone = (p: ContentPack): ContentPack => JSON.parse(JSON.stringify(p));

describe('mini-syntax', () => {
  it('parses and evaluates conditions', () => {
    const s = fresh();
    s.location = 'river';
    s.day = 5;
    s.inventory.push({ id: 'rope', qty: 2 });
    expect(evalAll(s, parseConditions('region=coast,river; day>=3; item:rope>=2; !flag:boarFriend'))).toBe(true);
    expect(evalAll(s, parseConditions('region!=river'))).toBe(false);
    expect(evalAll(s, parseConditions('item:rope>=3'))).toBe(false);
    expect(() => parseConditions('nonsense=1')).toThrow(ParseError);
    expect(() => parseConditions('item')).toThrow(/tham số/);
  });

  it('parses materials, consequences, mods, context and opponents', () => {
    expect(parseMaterials('wood:2, fiber:1')).toEqual([{ id: 'wood', qty: 2 }, { id: 'fiber', qty: 1 }]);
    expect(parseConsequences('gain_item(item=fish_raw, qty=1..3); fish_run')).toEqual([
      { id: 'gain_item', params: { item: 'fish_raw', qty: '1..3' } },
      { id: 'fish_run', params: {} },
    ]);
    expect(parseMods('+2 Giáo gỗ [tool:spear]; -3 Tay không [!tool:spear]').map((m) => m.value)).toEqual([2, -3]);
    expect(parseContext('x2 [weather=rain]')[0].mult).toBe(2);
    expect(parseOpposed('🐗 Lợn rừng +3')).toEqual({ icon: '🐗', label: 'Lợn rừng', bonus: 3 });
    expect(parseOpposed('Con khỉ -1')).toEqual({ icon: undefined, label: 'Con khỉ', bonus: -1 });
    expect(() => parseConsequences('gain_item(item)')).toThrow(ParseError);
    const p = resolveParams({ qty: '2..2', region: '$here', ok: 'true', item: 'wood' }, fresh(), (a) => a);
    expect(p).toEqual({ qty: 2, region: 'coast', ok: true, item: 'wood' });
  });
});

describe('validator', () => {
  it('the shipped pack is valid', () => {
    const r = validatePack(PACK, existingCodes(PACK));
    expect(r.errors).toEqual([]);
  });

  it('catches broken references, duplicates and rule violations', () => {
    const bad = clone(PACK);
    bad.actions[0].id = 'rest'; // clashes with a code-defined action
    bad.actions[1].code = PACK.actions[2].code; // duplicate code
    bad.outcomes[0].consequences = 'gain_item(item=unicorn)';
    bad.outcomes[1].consequences = 'teleport(to=moon)';
    bad.outcomes[2].consequences = 'vital_change(amount=-5)'; // missing required vital
    bad.events[0].conditions = 'found:atlantis';
    const sq = bad.events.find((e) => e.id === 'sudden_squall')!;
    bad.choices = bad.choices.filter((c) => c.event !== 'sudden_squall');
    sq.cause = ''; // risky with neither choices nor a cause
    const { errors } = validatePack(bad, existingCodes(bad));
    const text = errors.join('\n');
    expect(text).toMatch(/Actions\/rest: ID bị trùng/);
    expect(text).toMatch(/bị trùng/);
    expect(text).toMatch(/unicorn/);
    expect(text).toMatch(/teleport/);
    expect(text).toMatch(/thiếu tham số bắt buộc "vital"/);
    expect(text).toMatch(/atlantis/);
    expect(text).toMatch(/sudden_squall: rủi ro ≥ 2/);
  });
});

describe('Excel round trip', () => {
  it('writing the pack to a workbook and reading it back is lossless', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rts-pack-'));
    try {
      const file = join(dir, 'pack.xlsx');
      await writeWorkbook(PACK, file);
      const back = await readWorkbook(file);
      expect(back).toEqual(PACK);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);
});

describe('pack content in the engine', () => {
  it('registers codes and definitions for every pack row', () => {
    for (const a of PACK.actions) {
      expect(ACTIONS[a.id]).toBeDefined();
      expect(ACTION_META[a.id].code).toBe(a.code);
    }
    for (const e of PACK.events) {
      expect(EVENTS[e.id]).toBeDefined();
      expect(EVENT_META[e.id].code).toBe(e.code);
    }
  });

  it('a data action shows up with its check, and its outcome applies consequences', () => {
    const s = fresh();
    s.vitals.energy = 100;
    const a = buildView('t', s).actions.find((x) => x.key === 'dig_clams')!;
    expect(a.code).toBe('ACT-GAT-008');
    expect(a.check?.dc).toBe(9);
    const r = performAction(s, 'dig_clams');
    const tier = r.result.roll!.tier;
    const clams = r.state.inventory.filter((x) => x.id === 'shellfish').reduce((n, x) => n + x.qty, 0) -
      s.inventory.filter((x) => x.id === 'shellfish').reduce((n, x) => n + x.qty, 0);
    expect(clams).toBeGreaterThanOrEqual(tier === 'failure' ? 0 : 1);
    // daily cooldown
    expect(buildView('t', r.state).actions.find((x) => x.key === 'dig_clams')!.available).toBe(false);
  });

  it('requirements come from the Requires column and use readable labels', () => {
    const s = fresh();
    s.location = 'river';
    s.inventory = s.inventory.filter((x) => x.id !== 'spear');
    const inst = findInstance(s, 'spear_fishing')!;
    const reqs = inst.def.reqs!(s, '');
    expect(reqs).toContainEqual({ label: 'Có công cụ: spear', met: false });
  });

  it('opposed checks and mods work from data', () => {
    const s = fresh();
    s.slot = 2;
    const crabs = buildView('t', s).actions.find((x) => x.key === 'catch_crabs')!;
    expect(crabs.check?.opposed?.label).toBe('Cua đá');
    const sf = fresh();
    sf.location = 'river';
    sf.world.weather = 'clear';
    sf.inventory.push({ id: 'spear', qty: 1, dur: 20 });
    const check = buildView('t', sf).actions.find((x) => x.key === 'spear_fishing')!.check!;
    expect(check.mods).toContainEqual({ label: 'Nước trong', value: 2 });
  });

  it('event chains work from data: feeding the parrot schedules its return', () => {
    const s = fresh();
    s.location = 'jungle';
    s.inventory.push({ id: 'fruit', qty: 2 });
    const ctx = new Ctx(s);
    fire(ctx, EVENTS.curious_parrot);
    ctx.sync();
    expect(s.pending?.eventId).toBe('curious_parrot');
    const after = chooseEvent(s, 'feed').state;
    expect(after.flags.chain_parrot).toBe('friend');
    expect(after.scheduled.some((e) => e.eventId === 'parrot_returns')).toBe(true);
  });

  it('a risky data event states its cause on the card', () => {
    const s = fresh();
    s.location = 'river';
    s.pending = { uid: 1, eventId: 'leech_bite' };
    const v = buildView('t', s).pending!;
    expect(v.cause).toBe('Bạn vừa lội xuống nước suối');
    expect(v.code).toBe('EVT-HEA-002');
    expect(v.choices.map((c) => c.id)).toEqual(['pull', 'burn']);
  });
});
