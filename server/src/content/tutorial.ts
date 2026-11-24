// Forced day-1 tutorial: before anything else the player builds a lean-to, which
// becomes their base. Until then only the actions that lead there are open, the
// Director holds back random events, and if night falls first the castaway throws
// up a flimsy lean-to anyway — every run leaves day 1 with a camp.
import { type Ctx, countBoth, regionName } from '../engine/ctx.js';
import type { GameState } from '../engine/types.js';
import { STRUCTURES } from './crafting.js';
import { ITEMS } from './items.js';

export const TUTORIAL_FLAG = 'tutorial';
export const CAMP = 'camp';

/** action ids (any variant) and exact keys open during the camp tutorial */
const ALLOWED_IDS = new Set(['gather', 'rest', 'travel', 'collect_water']);
const ALLOWED_KEYS = new Set(['build:lean_to']);

export const LOCKED_REASON = '🏕️ Dựng lều tạm trước đã (nhiệm vụ ngày 1)';

export function campTutorial(s: GameState): boolean {
  return s.flags[TUTORIAL_FLAG] === CAMP && !s.baseRegion;
}

export function tutorialAllows(key: string): boolean {
  return ALLOWED_KEYS.has(key) || ALLOWED_IDS.has(key.split(':')[0]);
}

const leanTo = () => STRUCTURES.find((x) => x.id === 'lean_to')!;

export interface ObjectiveView {
  title: string;
  text: string;
  steps: { label: string; done: boolean }[];
  note: string;
}

/** the pinned objective card while the tutorial runs */
export function campObjective(s: GameState): ObjectiveView | undefined {
  if (!campTutorial(s)) return undefined;
  const mats = leanTo().inputs.map((m) => {
    const have = countBoth(s, m.id);
    return { label: `${ITEMS[m.id].icon} ${ITEMS[m.id].name}: ${Math.min(have, m.qty)}/${m.qty}`, done: have >= m.qty };
  });
  const ready = mats.every((m) => m.done);
  return {
    title: 'Nhiệm vụ ngày 1: Dựng lều tạm',
    text:
      'Trước khi làm bất cứ điều gì khác, bạn cần một chỗ trú qua đêm. Lều tạm sẽ là căn cứ: nơi ngủ an toàn, cất đồ vào kho và xây thêm công trình.',
    steps: [
      { label: `Thu thập vật liệu (Sinh tồn → “Thu thập vật liệu”)`, done: ready },
      ...mats,
      { label: `Dựng lều tạm (Căn cứ → “Xây Lều tạm”) — căn cứ đặt tại ${regionName(s.location)}`, done: false },
    ],
    note:
      'Có thể sang Dòng suối để đặt căn cứ cạnh nguồn nước (tốn 1 buổi). Nếu tới tối vẫn chưa dựng xong, bạn sẽ phải dựng vội một lều sơ sài (độ bền thấp).',
  };
}

/** the lean-to was built: the tutorial is over */
export function completeCamp(ctx: Ctx) {
  if (ctx.s.flags[TUTORIAL_FLAG] !== CAMP) return;
  delete ctx.s.flags[TUTORIAL_FLAG];
  ctx.change('good', '✅ Hoàn thành nhiệm vụ: đã có căn cứ. Mọi hành động đã được mở.');
}

/** night falls on day 1 without a camp: throw up a flimsy lean-to with whatever is at hand */
export function forceCamp(ctx: Ctx) {
  const s = ctx.s;
  if (!campTutorial(s)) {
    if (s.flags[TUTORIAL_FLAG] === CAMP) delete s.flags[TUTORIAL_FLAG];
    return;
  }
  for (const m of leanTo().inputs) ctx.removeItem(m.id, Math.min(m.qty, countBoth(s, m.id)), 'both', true);
  s.baseRegion = s.location;
  s.structures.push({ uid: ctx.nextUid(), id: 'lean_to', region: s.location, integrity: 35 });
  delete s.flags[TUTORIAL_FLAG];
  ctx.vital('energy', -8, 'Dựng lều trong bóng tối');
  ctx.change('bad', `⛺ Trời tối, bạn dựng vội một lều tạm sơ sài tại ${regionName(s.location)} (độ bền 35%)`);
  ctx.journal(`Trời tối, dựng vội một lều tạm sơ sài tại ${regionName(s.location)}. Đây sẽ là căn cứ.`, 'milestone');
}
