// Balance & robustness simulation: a heuristic bot plays many runs directly
// against the engine. Usage: npm run sim -- [runs] [maxDays]
import { ITEMS } from '../src/content/items.js';
import {
  allocateAttr,
  chooseEvent,
  consume,
  escapeStep,
  newGame,
  performAction,
} from '../src/engine/game.js';
import { Rng } from '../src/engine/rng.js';
import type { GameState } from '../src/engine/types.js';
import { buildView } from '../src/engine/view.js';

const RUNS = Number(process.argv[2] ?? 300);
const MAX_DAYS = Number(process.argv[3] ?? 60);
const SMART = process.argv[4] !== 'dumb';

function eatDrink(s: GameState): GameState {
  for (let guard = 0; guard < 10; guard++) {
    if (s.vitals.thirst < 60) {
      const w = s.inventory.find((x) => x.id === 'water_safe') ?? (s.vitals.thirst < 25 ? s.inventory.find((x) => x.id === 'water_raw') : undefined);
      if (w) {
        s = consume(s, w.id, 'inv').state;
        continue;
      }
      const ws = s.baseRegion === s.location ? s.storage.find((x) => x.id === 'water_safe') : undefined;
      if (ws) {
        s = consume(s, ws.id, 'storage').state;
        continue;
      }
    }
    if (s.vitals.hunger < 55) {
      const foods = s.inventory
        .filter((x) => ITEMS[x.id].food && (!ITEMS[x.id].food!.risk || s.vitals.hunger < 20))
        .sort((a, b) => (a.exp ?? 1e9) - (b.exp ?? 1e9));
      if (foods[0]) {
        s = consume(s, foods[0].id, 'inv').state;
        continue;
      }
      const sf = s.baseRegion === s.location ? s.storage.find((x) => ITEMS[x.id].food && !ITEMS[x.id].food!.risk) : undefined;
      if (sf) {
        s = consume(s, sf.id, 'storage').state;
        continue;
      }
    }
    break;
  }
  return s;
}

function step(s: GameState, rng: Rng): GameState {
  s = eatDrink(s);
  if (s.attrPoints > 0) {
    const open = (['STR', 'AGI', 'END', 'INT', 'PER'] as const).filter((a) => s.attrs[a] < 6);
    if (open.length) s = allocateAttr(s, rng.pick(open)).state;
  }
  const view = buildView('sim', s);
  if (view.pending) {
    const ok = view.pending.choices.filter((c) => c.available);
    const best = ok
      .map((c) => [c, c.check ? c.check.odds.success + c.check.odds.crit_success : 0.5] as const)
      .sort((a, b) => b[1] - a[1])[0];
    return chooseEvent(s, (best ?? [ok[0]])[0].id).state;
  }
  if (view.escape) {
    const p = view.escape.check.odds.success + view.escape.check.odds.crit_success;
    if (view.escape.canReturn && p < 0.35) return escapeStep(s, 'return').state;
    return escapeStep(s, 'roll').state;
  }
  const avail = view.actions.filter((a) => a.available);
  // only launch the raft when it looks reasonable
  const filtered = avail.filter((a) => {
    if (a.id === 'escape_desperate') return s.day > 40 && rng.chance(0.05);
    if (a.id === 'escape_raft') return (s.projects[0]?.stage ?? 0) >= 2 && s.world.currents >= 2 && s.world.weather !== 'storm';
    return true;
  });
  if (SMART) {
    const find = (...prefixes: string[]) => {
      for (const p of prefixes) {
        const a = filtered.find((x) => x.key === p || x.key.startsWith(p + ':'));
        if (a) return a;
      }
      return undefined;
    };
    const atBase = s.baseRegion === s.location;
    const water = s.inventory.filter((x) => x.id.startsWith('water')).reduce((a, x) => a + x.qty, 0) +
      (atBase ? s.storage.filter((x) => x.id === 'water_safe').reduce((a, x) => a + x.qty, 0) : 0);
    const food = s.inventory.filter((x) => ITEMS[x.id].food).reduce((a, x) => a + x.qty, 0) +
      (atBase ? s.storage.filter((x) => ITEMS[x.id].food).reduce((a, x) => a + x.qty, 0) : 0);
    const goal =
      (s.vitals.energy < 20 && find('rest')) ||
      find('check_traps', 'treat') ||
      (water < 2 && find('collect_water', 'travel:river')) ||
      find('boil_water', 'cook') ||
      (food < 2 && s.vitals.hunger < 60 && find('forage', 'fish', 'travel:coast')) ||
      (!s.baseRegion && s.location === 'river' && find('build:lean_to')) ||
      find('build:campfire', 'search_wreck', 'build:rain_collector', 'craft:stone_knife', 'set_trap');
    if (goal) return performAction(s, goal.key).state;
  }
  const pick = rng.weighted(filtered.map((a) => [a, Math.pow(a.priority + 1, 2)] as const));
  if (!pick) return performAction(s, 'rest').state;
  return performAction(s, pick.key).state;
}

const results: { status: string; day: number; ending?: string; cause?: string }[] = [];
let errors = 0;
const t0 = Date.now();
for (let i = 0; i < RUNS; i++) {
  const rng = new Rng(1000 + i);
  let s = newGame('Bot', { STR: 2, AGI: 2, END: 2, INT: 2, PER: 2 }, 5000 + i);
  let steps = 0;
  try {
    while (s.status === 'playing' && s.day <= MAX_DAYS && steps < 5000) {
      s = step(s, rng);
      steps++;
    }
  } catch (e) {
    errors++;
    if (errors <= 5) console.error(`run ${i} day ${s.day}:`, (e as Error).message);
  }
  results.push({ status: s.status, day: s.day, ending: s.ending?.kind, cause: s.stats.lastDamage });
}

const by = (f: (r: (typeof results)[0]) => string) =>
  results.reduce<Record<string, number>>((a, r) => ((a[f(r)] = (a[f(r)] ?? 0) + 1), a), {});
const dead = results.filter((r) => r.status === 'dead');
const days = dead.map((r) => r.day).sort((a, b) => a - b);
console.log(`runs=${RUNS} in ${((Date.now() - t0) / 1000).toFixed(1)}s, errors=${errors}`);
console.log('status:', by((r) => r.status));
console.log('endings:', by((r) => r.ending ?? '-'));
console.log('death causes:', by((r) => (r.status === 'dead' ? r.cause || '?' : 'alive')));
if (days.length) console.log(`death day: min ${days[0]}, median ${days[Math.floor(days.length / 2)]}, max ${days[days.length - 1]}`);
const wins = results.filter((r) => r.status === 'victory').map((r) => r.day).sort((a, b) => a - b);
if (wins.length) console.log(`victory day: min ${wins[0]}, median ${wins[Math.floor(wins.length / 2)]}, max ${wins[wins.length - 1]}`);
