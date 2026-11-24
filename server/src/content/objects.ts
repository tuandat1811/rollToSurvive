// Persistent world objects (GDD Diversity-01 §2.3): things that appear somewhere
// on the island and stay there until the player deals with them or they expire —
// a crate washed up after a storm, an old cache hidden in a tree hollow…
// Each object offers its own actions (shown on the location's action board).
import { atLeastPartial, isSuccess } from '../engine/common.js';
import { con } from '../engine/consequence.js';
import { type Ctx, hasTag } from '../engine/ctx.js';
import type { CheckSpec, GameState, Req, Tier, WorldObject } from '../engine/types.js';

export interface ObjectActionDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  hint?: string;
  energy: number;
  slots?: number;
  reqs?: (s: GameState) => Req[];
  check?: (s: GameState) => CheckSpec;
  resolve: (ctx: Ctx, tier: Tier, obj: WorldObject) => void;
}

export interface ObjectDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** default lifetime; undefined = stays until handled */
  lifetimeDays?: number;
  expireText?: string;
  actions: ObjectActionDef[];
}

const CRATE_LOOT: [string, number][] = [
  ['canned', 3],
  ['rope', 3],
  ['canvas', 3],
  ['scrap', 2],
  ['lamp_oil', 1],
  ['bandage', 2],
  ['glass_bottle', 1],
  ['first_aid', 0.5],
];

function crateLoot(ctx: Ctx, n: number) {
  for (let i = 0; i < n; i++) {
    const id = ctx.rng.weighted(CRATE_LOOT) ?? 'scrap';
    con(ctx, 'gain_item', { item: id, qty: id === 'canned' ? ctx.rng.int(1, 2) : 1 });
  }
}

const defs: ObjectDef[] = [
  {
    id: 'washed_crate',
    name: 'Thùng hàng trôi dạt',
    icon: '📦',
    desc: 'Một thùng gỗ đóng đinh kín bị sóng đánh dạt vào bờ. Thủy triều có thể cuốn nó đi bất cứ lúc nào.',
    lifetimeDays: 3,
    expireText: 'Thủy triều đã cuốn thùng hàng trôi dạt ra khơi.',
    actions: [
      {
        id: 'pry',
        label: 'Cạy nắp thùng',
        icon: '🔧',
        desc: 'Dùng dao lách vào khe nắp và cạy từ từ — lấy được đồ nguyên vẹn.',
        hint: 'Lấy 2–3 món, đồ không bị vỡ',
        energy: 5,
        reqs: (s) => [{ label: 'Cần dao để cạy', met: hasTag(s, 'knife') }],
        check: () => ({ label: 'Cạy nắp thùng', attr: 'AGI', skill: 'crafting', dc: 11, crit: 'safe', outdoor: true }),
        resolve: (ctx, tier, obj) => {
          ctx.useTool('knife', 1);
          if (!atLeastPartial(tier)) {
            ctx.say('Đinh gỉ bám chặt, nắp thùng không nhúc nhích. Có thể thử lại sau.');
            return;
          }
          ctx.say(isSuccess(tier) ? 'Nắp thùng bật ra gọn gàng. Bên trong vẫn khô ráo!' : 'Bạn cạy được một góc, lôi ra vài thứ trước khi nắp kẹt lại.');
          crateLoot(ctx, tier === 'crit_success' ? 3 : tier === 'success' ? 2 : 1);
          if (tier !== 'partial') con(ctx, 'remove_object', { uid: obj.uid });
        },
      },
      {
        id: 'smash',
        label: 'Đập vỡ thùng',
        icon: '🪨',
        desc: 'Lấy đá đập vỡ thùng. Nhanh, không cần dụng cụ — nhưng đồ bên trong có thể hỏng và có thể bị dằm đâm.',
        hint: 'Lấy 1–2 món, thu thêm gỗ',
        energy: 8,
        check: () => ({ label: 'Đập vỡ thùng', attr: 'STR', dc: 9, outdoor: true }),
        resolve: (ctx, tier, obj) => {
          if (!atLeastPartial(tier)) {
            ctx.say('Thùng gỗ dày hơn bạn tưởng.');
            if (tier === 'crit_failure') {
              ctx.say('Một mảnh gỗ văng ra cứa vào tay bạn.');
              con(ctx, 'injury', { sev: 1 });
            }
            return;
          }
          ctx.say('Ván thùng vỡ toác. Một vài thứ bên trong đã bị dập nát.');
          crateLoot(ctx, tier === 'crit_success' ? 2 : 1);
          con(ctx, 'gain_item', { item: 'wood', qty: 2 });
          con(ctx, 'remove_object', { uid: obj.uid });
        },
      },
    ],
  },
  {
    id: 'old_cache',
    name: 'Gói đồ trong hốc cây',
    icon: '🎒',
    desc: 'Một gói vải dầu được nhét kỹ trong hốc cây — ai đó đã cất giấu nó từ lâu. Có thể có bẫy hoặc côn trùng làm tổ bên trong.',
    actions: [
      {
        id: 'open',
        label: 'Mở gói đồ cẩn thận',
        icon: '🎒',
        desc: 'Gỡ từng lớp vải dầu, kiểm tra xem có gì nguy hiểm bên trong.',
        hint: 'Có thể chứa la bàn, hải đồ, pháo sáng hoặc ghi chép',
        energy: 3,
        check: () => ({ label: 'Mở gói đồ', attr: 'PER', skill: 'survival', dc: 10, outdoor: true }),
        resolve: (ctx, tier, obj) => {
          const s = ctx.s;
          if (tier === 'crit_failure' || tier === 'failure') {
            ctx.say('Một tổ kiến lửa tràn ra từ lớp vải! Bạn bị đốt nhiều chỗ trước khi kịp phủi đi.');
            con(ctx, 'vital_change', { vital: 'health', amount: tier === 'crit_failure' ? -8 : -4, cause: 'Kiến lửa đốt' });
            if (tier === 'failure') {
              ctx.say('Khi đám kiến tản đi, bạn vẫn lôi được gói đồ ra.');
            } else return;
          }
          const loot = ['compass', 'chart', 'flare', 'signal_mirror'].filter((id) => !s.inventory.some((x) => x.id === id));
          const first = loot.length ? ctx.rng.pick(loot) : 'canned';
          con(ctx, 'gain_item', { item: first });
          if (isSuccess(tier)) con(ctx, 'gain_item', { item: 'lamp_oil' });
          if (tier === 'crit_success' || ctx.rng.chance(0.5)) {
            ctx.say('Kẹp giữa gói đồ là vài trang ghi chép về hải lưu quanh đảo.');
            con(ctx, 'currents_knowledge', { amount: 1 });
          }
          ctx.journal('Mở gói đồ ai đó giấu trong hốc cây từ nhiều năm trước.', 'discovery');
          con(ctx, 'remove_object', { uid: obj.uid });
        },
      },
    ],
  },
];

export const OBJECT_DEFS: Record<string, ObjectDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
export const OBJECT_LIST = defs;

export function objectsAt(s: GameState, region = s.location): WorldObject[] {
  return (s.objects ?? []).filter((o) => o.region === region);
}
