import { REGION_DEFS } from '../content/defs.ts';
import { ITEMS } from '../content/items.ts';
import { Ctx, countBoth } from './ctx.ts';
import type { GameState, RegionId, ResourceKind, Tier } from './types.ts';

export const isSuccess = (t: Tier) => t === 'success' || t === 'crit_success';
export const atLeastPartial = (t: Tier) => t !== 'failure' && t !== 'crit_failure';

export function abundanceMult(s: GameState, region: RegionId, kind: ResourceKind): number {
  return Math.max(0.25, Math.min(1.2, s.regions[region].abundance[kind] / 100));
}

export function deplete(s: GameState, region: RegionId, kind: ResourceKind, amount: number) {
  const r = s.regions[region];
  r.abundance[kind] = Math.max(0, r.abundance[kind] - amount);
}

export function carriedFood(s: GameState): number {
  return s.inventory.reduce((a, st) => (ITEMS[st.id]?.kind === 'food' ? a + st.qty : a), 0);
}

export function rawCookable(s: GameState): string[] {
  const ids = new Set<string>();
  const lists = s.baseRegion === s.location ? [s.inventory, s.storage] : [s.inventory];
  for (const l of lists) for (const st of l) if (ITEMS[st.id]?.food?.cookTo) ids.add(st.id);
  return [...ids];
}

export function snakeBite(ctx: Ctx) {
  ctx.say('Một con rắn lục ẩn trong đám lá đã cắn vào chân bạn!');
  ctx.addCondition('poisoned', 1, 3);
  ctx.journal('Bị rắn cắn khi đang lục lọi bụi rậm.', 'event');
}

/** lose a fraction of carried (non-equipment) items, e.g. when washed ashore */
export function loseCarried(ctx: Ctx, frac: number) {
  const s = ctx.s;
  const lost: Record<string, number> = {};
  for (const st of s.inventory) {
    const kind = ITEMS[st.id]?.kind;
    if (kind === 'tool' && ITEMS[st.id]?.container) continue;
    const n = Math.round(st.qty * frac * (0.6 + ctx.rng.next() * 0.8));
    const take = Math.min(st.qty, n);
    if (take > 0) {
      st.qty -= take;
      lost[st.id] = (lost[st.id] ?? 0) + take;
    }
  }
  ctx.prune(s.inventory);
  for (const [id, n] of Object.entries(lost)) ctx.change('loss', `-${n} ${ITEMS[id].icon} ${ITEMS[id].name} (trôi mất)`);
}

export function victory(ctx: Ctx, kind: string, title: string, text: string) {
  const s = ctx.s;
  s.status = 'victory';
  s.escape = null;
  s.pending = null;
  s.ending = { kind, title, text: `${text} Bạn đã sống sót ${s.day} ngày trên hòn đảo.`, day: s.day };
  ctx.journal(`${title}. ${text}`, 'escape');
}

export function signalLocationMod(region: RegionId): { label: string; value: number } | null {
  if (region === 'cape') return { label: 'Đứng trên mũi hải đăng', value: 4 };
  if (region === 'mountain') return { label: 'Trên cao nhìn ra biển', value: 1 };
  if (region === 'coast') return { label: 'Bãi biển thấp, tàu ở quá xa', value: -3 };
  return null;
}

export function weatherSignalMod(s: GameState): { label: string; value: number } | null {
  if (s.world.weather === 'rain') return { label: 'Mưa che tầm nhìn', value: -4 };
  if (s.world.weather === 'cloudy') return { label: 'Trời âm u', value: -1 };
  return null;
}

export function fireSource(s: GameState): string | null {
  if (s.structures.some((x) => x.region === s.location && x.id === 'campfire' && x.lit && x.integrity > 0)) return 'campfire';
  if (s.inventory.some((x) => x.id === 'torch')) return 'torch';
  if (countBoth(s, 'flint') > 0) return 'flint';
  return null;
}

export const regionLabel = (id: RegionId) => `${REGION_DEFS[id].icon} ${REGION_DEFS[id].name}`;
