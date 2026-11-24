// Risk escalation (Phase C resolution variety): push-your-luck expeditions.
// Each step is harder than the last. Loot gathered so far stays in a bag that is
// only safe once you turn back: a failed step drops half of it (and hurts),
// a disastrous one loses everything.
import { con } from '../engine/consequence.js';
import { type Ctx, hasTag } from '../engine/ctx.js';
import type { CheckSpec, GameState, Tier } from '../engine/types.js';
import { ITEMS } from './items.js';
import { locationAccessible } from './locationStates.js';

export type Bag = Record<string, number>;

export interface ExpeditionStep {
  name: string;
  text: string;
  check: (s: GameState) => CheckSpec;
  /** energy to push on into this step (the first step's cost is the action's) */
  energy: number;
  loot: (ctx: Ctx, tier: Tier, bag: Bag) => void;
}

export interface ExpeditionDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  energy: number;
  /** how many times the expedition can be run before the place is exhausted */
  runs: number;
  visible: (s: GameState) => boolean;
  steps: ExpeditionStep[];
  /** harm when a step fails (tier failure or crit_failure) */
  hazard: (ctx: Ctx, tier: Tier) => void;
}

const add = (bag: Bag, id: string, n = 1) => {
  bag[id] = (bag[id] ?? 0) + n;
};
const pickInto = (ctx: Ctx, bag: Bag, table: [string, number][], n: number) => {
  for (let i = 0; i < n; i++) add(bag, ctx.rng.weighted(table) ?? table[0][0]);
};
const lootCount = (tier: Tier, good: number) => (tier === 'crit_success' ? good + 1 : tier === 'success' ? good : 1);

export const EXPEDITIONS: ExpeditionDef[] = [
  {
    id: 'wreck_hold',
    name: 'Lặn vào khoang chìm',
    icon: '🤿',
    desc: 'Phần đuôi xác tàu chìm dưới nước, các khoang sâu chưa ai đụng tới. Càng vào sâu càng nhiều đồ quý — và càng dễ mắc kẹt.',
    energy: 8,
    runs: 3,
    visible: (s) => s.location === 'coast' && s.regions.coast.found.includes('wreck') && s.world.weather !== 'storm',
    steps: [
      {
        name: 'Khoang hàng phía trên',
        text: 'Nước ngập tới ngực, thùng hàng trôi lềnh bềnh.',
        energy: 0,
        check: () => ({ label: 'Lặn khoang trên', attr: 'AGI', skill: 'survival', dc: 10, outdoor: true }),
        loot: (ctx, tier, bag) => pickInto(ctx, bag, [['rope', 3], ['canvas', 3], ['scrap', 2], ['canned', 2]], lootCount(tier, 2)),
      },
      {
        name: 'Khoang giữa ngập nước',
        text: 'Phải nín thở lặn qua một hành lang tối om.',
        energy: 8,
        check: () => ({ label: 'Lặn qua hành lang ngập', attr: 'END', skill: 'survival', dc: 13, outdoor: true }),
        loot: (ctx, tier, bag) => pickInto(ctx, bag, [['canned', 3], ['lamp_oil', 2], ['bandage', 2], ['first_aid', 1]], lootCount(tier, 2)),
      },
      {
        name: 'Buồng thuyền trưởng',
        text: 'Cửa buồng kẹt cứng dưới đáy tàu, lối ra rất xa.',
        energy: 10,
        check: () => ({ label: 'Cạy cửa buồng thuyền trưởng', attr: 'STR', skill: 'survival', dc: 16, outdoor: true }),
        loot: (ctx, tier, bag) => {
          const rare = ['compass', 'chart', 'flare', 'signal_mirror'].filter((id) => !ctx.s.inventory.some((x) => x.id === id) && !bag[id]);
          add(bag, rare.length ? ctx.rng.pick(rare) : 'canned');
          if (tier !== 'partial') add(bag, 'lamp_oil');
        },
      },
    ],
    hazard: (ctx, tier) => {
      if (tier === 'crit_failure') {
        ctx.say('Bạn mắc kẹt dưới đáy tàu, phổi như muốn nổ tung trước khi kịp ngoi lên.');
        con(ctx, 'vital_change', { vital: 'health', amount: -15, cause: 'Suýt chết đuối trong xác tàu' });
        con(ctx, 'injury', { sev: 1 });
      } else {
        ctx.say('Hết hơi giữa chừng, bạn phải buông tay vội vàng ngoi lên.');
        con(ctx, 'vital_change', { vital: 'health', amount: -6, cause: 'Sặc nước trong xác tàu' });
      }
    },
  },
  {
    id: 'deep_cave',
    name: 'Thám hiểm sâu trong hang',
    icon: '🔦',
    desc: 'Phía sau hang đá là những đường hầm tối dẫn sâu vào lòng núi. Có thể có đồ quý, nước ngầm, cả dấu vết người xưa — nếu bạn tìm được đường ra.',
    energy: 8,
    runs: 2,
    visible: (s) => s.location === 'mountain' && s.regions.mountain.found.includes('cave') && locationAccessible(s, 'cave'),
    steps: [
      {
        name: 'Hành lang tối',
        text: 'Ánh sáng từ cửa hang tắt dần sau lưng.',
        energy: 0,
        check: (s) => ({
          label: 'Dò đường trong hành lang tối',
          attr: 'PER',
          skill: 'survival',
          dc: 10,
          mods: hasTag(s, 'fire') ? [{ label: 'Có đuốc', value: 2 }] : [{ label: 'Không có đuốc', value: -3 }],
        }),
        loot: (ctx, tier, bag) => pickInto(ctx, bag, [['flint', 3], ['resin', 2], ['stone', 2]], lootCount(tier, 2)),
      },
      {
        name: 'Hang dơi',
        text: 'Trần hang đen kịt dơi, không khí nồng nặc.',
        energy: 8,
        check: (s) => ({
          label: 'Vượt qua hang dơi',
          attr: 'END',
          skill: 'survival',
          dc: 13,
          mods: hasTag(s, 'fire') ? [{ label: 'Có đuốc', value: 2 }] : [{ label: 'Không có đuốc', value: -3 }],
        }),
        loot: (ctx, tier, bag) => pickInto(ctx, bag, [['mushroom', 3], ['herbs', 2], ['flint', 1]], lootCount(tier, 2)),
      },
      {
        name: 'Hồ nước ngầm',
        text: 'Tiếng nước nhỏ giọt vọng lại từ một khoang rất sâu.',
        energy: 10,
        check: (s) => ({
          label: 'Xuống hồ nước ngầm',
          attr: 'AGI',
          skill: 'navigation',
          dc: 16,
          mods: hasTag(s, 'fire') ? [{ label: 'Có đuốc', value: 2 }] : [{ label: 'Không có đuốc', value: -3 }],
        }),
        loot: (ctx, tier, bag) => {
          add(bag, 'water_safe', tier === 'partial' ? 1 : 2);
          add(bag, 'lore:cave_paintings');
        },
      },
    ],
    hazard: (ctx, tier) => {
      if (tier === 'crit_failure') {
        ctx.say('Bạn trượt chân xuống một khe đá, phải mò mẫm hàng giờ trong bóng tối mới ra được.');
        con(ctx, 'injury', { sev: 1 });
        con(ctx, 'shaken', { slots: 6 });
      } else {
        ctx.say('Bạn lạc hướng trong bóng tối, mất rất lâu mới lần được về cửa hang.');
        con(ctx, 'vital_change', { vital: 'energy', amount: -10, cause: 'Lạc trong hang' });
        con(ctx, 'shaken', { slots: 3 });
      }
    },
  },
];

export const EXPEDITION_BY_ID: Record<string, ExpeditionDef> = Object.fromEntries(EXPEDITIONS.map((e) => [e.id, e]));

export const runsFlag = (id: string) => `expeditionRuns:${id}`;

export function bagText(bag: Bag): string {
  const parts = Object.entries(bag).map(([id, n]) =>
    id.startsWith('lore:') ? '📜 hình vẽ cổ trên vách' : `${n} ${ITEMS[id]?.icon ?? ''} ${ITEMS[id]?.name ?? id}`,
  );
  return parts.length ? parts.join(', ') : 'chưa có gì';
}

/** carry the bag out: items go to the player, lore becomes knowledge */
export function grantBag(ctx: Ctx, bag: Bag) {
  for (const [id, n] of Object.entries(bag)) {
    if (id === 'lore:cave_paintings') {
      ctx.say('Trên vách hồ ngầm là những hình vẽ cổ: thuyền độc mộc, mũi tên chỉ theo dòng hải lưu ra khơi.');
      con(ctx, 'currents_knowledge', { amount: 1 });
      ctx.journal('Tìm thấy hình vẽ cổ về hải lưu trong lòng hang núi.', 'discovery');
    } else con(ctx, 'gain_item', { item: id, qty: n });
  }
}

/** a failed step: drop half the bag (all of it on a disaster) */
export function spillBag(ctx: Ctx, bag: Bag, tier: Tier): Bag {
  if (tier === 'crit_failure') {
    if (Object.keys(bag).length) ctx.change('loss', `Đánh rơi toàn bộ: ${bagText(bag)}`);
    return {};
  }
  const kept: Bag = {};
  const lost: Bag = {};
  for (const [id, n] of Object.entries(bag)) {
    const keep = Math.floor(n / 2);
    if (keep) kept[id] = keep;
    if (n - keep) lost[id] = n - keep;
  }
  if (Object.keys(lost).length) ctx.change('loss', `Đánh rơi: ${bagText(lost)}`);
  return kept;
}

/**
 * Resolve one step. Returns the bag to continue with, or null when the
 * expedition is over (the bag has already been granted or spilled).
 */
export function resolveStep(ctx: Ctx, exp: ExpeditionDef, step: number, tier: Tier, bag: Bag): Bag | null {
  const st = exp.steps[step];
  if (tier === 'failure' || tier === 'crit_failure') {
    exp.hazard(ctx, tier);
    const kept = spillBag(ctx, bag, tier);
    if (Object.keys(kept).length) {
      ctx.say(`Bạn thoát ra được, còn giữ: ${bagText(kept)}.`);
      grantBag(ctx, kept);
    }
    return null;
  }
  const before = { ...bag };
  st.loot(ctx, tier, bag);
  const found: Bag = {};
  for (const [id, n] of Object.entries(bag)) if (n > (before[id] ?? 0)) found[id] = n - (before[id] ?? 0);
  ctx.say(`${st.name}: tìm được ${bagText(found)}.`);
  if (tier === 'partial') con(ctx, 'vital_change', { vital: 'energy', amount: -4, cause: 'Vất vả' });
  if (step >= exp.steps.length - 1) {
    ctx.say('Không còn đường nào sâu hơn. Bạn mang tất cả quay ra.');
    grantBag(ctx, bag);
    return null;
  }
  return bag;
}
