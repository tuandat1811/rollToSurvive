import {
  abundanceMult,
  atLeastPartial,
  deplete,
  isSuccess,
  rawCookable,
  snakeBite,
} from '../engine/common.js';
import {
  Ctx,
  condSev,
  containerCap,
  count,
  countBoth,
  fireLit,
  hasStructure,
  hasTag,
  regionName,
  routeBetween,
  shelterAt,
  structuresAt,
  waterCount,
} from '../engine/ctx.js';
import type { CheckSpec, GameState, Req, RegionId, Tier } from '../engine/types.js';
import { RAFT_REGION, RAFT_STAGES, RECIPES, STRUCTURES } from './crafting.js';
import { CONDITIONS } from './conditions.js';
import { LOCATION_DEFS, REGION_DEFS, ROUTE_DEFS, SLOT_NAMES, WEATHER_DEFS } from './defs.js';
import { ITEMS, itemName } from './items.js';

export type ActionGroup = 'survival' | 'explore' | 'food' | 'craft' | 'base' | 'medical' | 'escape' | 'travel';

export const GROUP_NAMES: Record<ActionGroup, string> = {
  survival: 'Sinh tồn',
  food: 'Săn bắt & Đánh cá',
  explore: 'Khám phá',
  travel: 'Di chuyển',
  craft: 'Chế tạo',
  base: 'Căn cứ',
  medical: 'Y tế',
  escape: 'Thoát đảo',
};

export interface Material {
  id: string;
  qty: number;
}

export interface ActionDef {
  id: string;
  group: ActionGroup;
  icon: (s: GameState, p: string) => string;
  name: (s: GameState, p: string) => string;
  desc: (s: GameState, p: string) => string;
  /** short readable outcome preview */
  hint?: (s: GameState, p: string) => string;
  slots?: number;
  energy: (s: GameState, p: string) => number;
  variants?: (s: GameState) => string[];
  visible: (s: GameState, p: string) => boolean;
  reqs?: (s: GameState, p: string) => Req[];
  materials?: (s: GameState, p: string) => Material[];
  check?: (s: GameState, p: string) => CheckSpec | null;
  notes?: (s: GameState, p: string) => string[];
  resolve: (ctx: Ctx, tier: Tier, p: string) => void;
  priority?: (s: GameState, p: string) => number;
  followUp?: boolean;
  /** XP key for repetition tracking (defaults to id:param) */
  xpKey?: (s: GameState, p: string) => string;
}

const k = <T>(v: T) => () => v;
const here = (s: GameState) => s.location;
const found = (s: GameState, loc: string) => s.regions[LOCATION_DEFS[loc].region].found.includes(loc);
const tool = (s: GameState, tag: string, value: number, label: string) => (hasTag(s, tag) ? { label, value } : null);
const mods = (...m: ({ label: string; value: number } | null | false)[]) =>
  m.filter((x): x is { label: string; value: number } => !!x);
const injuryEnergy = (s: GameState) => condSev(s, 'injury') * 3;
const stormExtra = (s: GameState) => (s.world.weather === 'storm' ? 5 : 0);
const needWater = (s: GameState) => s.vitals.thirst < 40;
const needFood = (s: GameState) => s.vitals.hunger < 40;

function refundHalf(ctx: Ctx, mats: Material[]) {
  for (const m of mats) {
    const n = Math.floor(m.qty / 2);
    if (n > 0) ctx.addItem(m.id, n, { quiet: true });
  }
  ctx.change('info', 'Thu hồi lại được một nửa vật liệu');
}

function tierYield(tier: Tier, table: Partial<Record<Tier, number>>): number {
  return table[tier] ?? 0;
}

// ---------------------------------------------------------------- exploration reveal

function reveal(ctx: Ctx, region: RegionId, n: number) {
  const r = ctx.s.regions[region];
  for (let i = 0; i < n && r.explorePool.length; i++) {
    const next = r.explorePool[0];
    if (next.startsWith('route:')) ctx.discoverRoute(next.slice(6));
    else if (next.startsWith('loc:')) ctx.findLocation(next.slice(4));
    else if (next.startsWith('clue:')) {
      r.explorePool.shift();
      const target = next.slice(5) as RegionId;
      ctx.clueRegion(target);
      ctx.journal(`Từ ${regionName(region)}, bạn trông thấy dấu vết của ${REGION_DEFS[target].name} ở phía xa.`, 'discovery');
    } else r.explorePool.shift();
  }
  if (!r.explorePool.length && !r.surveyed) {
    r.surveyed = true;
    ctx.change('info', `Đã khảo sát toàn bộ ${regionName(region)}`);
  }
}

// ---------------------------------------------------------------- the catalog

const actions: ActionDef[] = [
  // ============================== SURVIVAL
  {
    id: 'rest',
    group: 'survival',
    icon: k('😴'),
    name: k('Nghỉ ngơi'),
    desc: (s) =>
      `Nghỉ ngơi một buổi để hồi sức.${shelterAt(s, here(s)) ? ' Có nơi trú ẩn nên hồi phục tốt hơn.' : ''}`,
    hint: (s) => `Năng lượng +${22 + (shelterAt(s, here(s)) ? 10 : 0)}, Sức khỏe +2`,
    energy: k(0),
    visible: k(true),
    priority: (s) => (s.vitals.energy < 25 ? 90 : s.vitals.energy < 45 ? 40 : 5),
    resolve: (ctx) => {
      const s = ctx.s;
      ctx.say('Bạn tìm một chỗ râm mát, nằm nghỉ và lấy lại sức.');
      ctx.vital('energy', 22 + (shelterAt(s, here(s)) ? 10 : 0));
      ctx.vital('health', 2);
      ctx.removeCondition('shaken', true);
    },
  },
  {
    id: 'collect_water',
    group: 'survival',
    icon: (s, p) => (p === 'vine' ? '🌿' : p === 'pool' ? '🪨' : p === 'waterfall' ? '💦' : '💧'),
    name: (s, p) =>
      p === 'vine' ? 'Lấy nước từ dây leo' : p === 'pool' ? 'Lấy nước ở hốc đá' : p === 'waterfall' ? 'Lấy nước ở thác' : 'Lấy nước suối',
    desc: (s, p) => {
      if (p === 'vine') return 'Chặt dây leo nước lấy nước sạch uống được ngay. Mỗi ngày chỉ lấy được một lần.';
      if (p === 'pool') return 'Hốc đá giữ nước mưa sạch trong 2 ngày sau mưa.';
      if (p === 'waterfall') return 'Nước thác trong và sạch hơn nước suối, rủi ro rất thấp — nhưng tốt nhất vẫn nên đun sôi.';
      const r = s.regions.river;
      return `Đổ đầy các bình chứa bằng nước suối. Nước chưa xử lý có thể gây ngộ độc — nên đun sôi.${
        r.waterKnown && r.water === 'contaminated' ? ' ⚠️ Nước suối đang bị ô nhiễm!' : r.water === 'muddy' ? ' Nước đang đục sau mưa.' : ''
      }`;
    },
    hint: (s) => `Chứa được ${Math.max(0, containerCap(s.inventory) - waterCount(s.inventory))} phần nước`,
    energy: k(4),
    variants: (s) => {
      const v: string[] = [];
      if (here(s) === 'river') v.push('river');
      if (here(s) === 'river' && found(s, 'waterfall')) v.push('waterfall');
      if (here(s) === 'jungle' && found(s, 'water_vine')) v.push('vine');
      if (here(s) === 'coast' && found(s, 'rain_pool')) v.push('pool');
      return v;
    },
    visible: k(true),
    reqs: (s, p) => {
      const free = containerCap(s.inventory) - waterCount(s.inventory);
      const r: Req[] = [{ label: 'Còn chỗ trong bình chứa nước', met: free > 0 }];
      if (p === 'vine') r.push({ label: 'Dây leo đã hồi nước (mỗi ngày 1 lần)', met: s.flags.vineDay !== s.day });
      if (p === 'pool') r.push({ label: 'Có mưa trong 2 ngày qua', met: s.world.lastRainDay >= s.day - 2 && s.flags.poolDay !== s.day });
      return r;
    },
    priority: (s, p) => (needWater(s) ? 85 : 35) + (p === 'vine' || p === 'pool' || p === 'waterfall' ? 5 : 0),
    resolve: (ctx, _t, p) => {
      const s = ctx.s;
      const free = containerCap(s.inventory) - waterCount(s.inventory);
      if (p === 'vine') {
        ctx.flag('vineDay', s.day);
        ctx.addItem('water_safe', Math.min(free, 2));
        ctx.say('Bạn chặt những đoạn dây leo, nước trong vắt nhỏ giọt vào bình.');
        return;
      }
      if (p === 'pool') {
        ctx.flag('poolDay', s.day);
        ctx.addItem('water_safe', Math.min(free, 3));
        ctx.say('Nước mưa đọng trong hốc đá mát lạnh và sạch sẽ.');
        return;
      }
      const r = s.regions.river;
      const risk = p === 'waterfall' ? (r.water === 'contaminated' ? 0.15 : 0.04) : r.water === 'contaminated' ? 0.65 : r.water === 'muddy' ? 0.3 : 0.12;
      ctx.addItem('water_raw', free, { risk });
      ctx.say(p === 'waterfall' ? 'Bạn hứng nước dưới chân thác.' : 'Bạn ngồi xuống bờ suối và đổ đầy các bình chứa.');
      if (r.water === 'contaminated' && !r.waterKnown) {
        const nat = ctx.rng.d20();
        if (nat + s.attrs.PER + s.skills.survival.lvl >= 13) {
          r.waterKnown = true;
          ctx.change('bad', '⚠️ Nước có mùi lạ — suối có thể đã bị ô nhiễm!');
          ctx.journal('Nước suối có mùi hôi lạ. Có thể có thứ gì đó làm ô nhiễm ở thượng nguồn.', 'consequence');
        }
      }
    },
  },
  {
    id: 'forage',
    group: 'survival',
    icon: (s) => (here(s) === 'coast' ? '🥥' : here(s) === 'mountain' ? '🥚' : '🍌'),
    name: k('Tìm kiếm thức ăn'),
    desc: (s) => {
      const r = here(s);
      if (r === 'coast') return 'Nhặt dừa và mò sò ốc trên bãi đá. Sò ốc nên nấu chín.';
      if (r === 'mountain') return 'Trèo vách đá tìm trứng chim biển.';
      return `Hái trái cây và quả mọng trong rừng.${found(s, 'banana_grove') ? ' Lùm chuối dại cho thêm trái cây.' : ''} Quả mọng lạ có thể gây ngộ độc.`;
    },
    hint: (s) => `2–4 phần thức ăn (trữ lượng khu vực: ${Math.round(s.regions[here(s)].abundance.forage)}%)`,
    energy: k(8),
    visible: (s) => here(s) === 'coast' || here(s) === 'jungle' || (here(s) === 'mountain' && found(s, 'bird_cliff')),
    check: (s) => ({
      label: 'Tìm thức ăn',
      attr: 'PER',
      skill: 'survival',
      dc: here(s) === 'coast' ? 10 : here(s) === 'jungle' ? 11 : 13,
      outdoor: true,
      mods: mods(here(s) === 'jungle' && found(s, 'banana_grove') && { label: 'Lùm chuối dại', value: 1 }),
    }),
    priority: (s) => (needFood(s) ? 75 : 30),
    resolve: (ctx, tier) => {
      const s = ctx.s;
      const r = here(s);
      const base = tierYield(tier, { crit_success: 5, success: 4, partial: 2 });
      const n = base ? Math.max(1, ctx.rng.round(base * abundanceMult(s, r, 'forage'))) : 0;
      deplete(s, r, 'forage', tier === 'crit_success' ? 13 : 10);
      if (r === 'coast') {
        let c = 0;
        for (let i = 0; i < n; i++) if (ctx.rng.chance(0.5)) c++;
        ctx.addItem('coconut', c);
        ctx.addItem('shellfish', n - c);
      } else if (r === 'jungle') {
        let f = 0;
        for (let i = 0; i < n; i++) if (ctx.rng.chance(0.6)) f++;
        ctx.addItem('fruit', f + (found(s, 'banana_grove') && base ? 1 : 0));
        ctx.addItem('berries', n - f);
      } else ctx.addItem('eggs', n);
      if (!n) ctx.say(tier === 'crit_failure' ? 'Bạn chẳng tìm được gì, lại còn gặp rắc rối.' : 'Bạn lục lọi cả buổi mà không tìm được gì ăn được.');
      else if (s.regions[r].abundance.forage < 30) ctx.say('Khu vực này đã bị khai thác nhiều, thức ăn ngày càng khan hiếm.');
      if (tier === 'crit_failure') {
        if (r === 'jungle' && ctx.rng.chance(0.5)) snakeBite(ctx);
        else {
          ctx.say('Bạn trượt chân trên đá trơn.');
          ctx.addCondition('injury', 1);
        }
      }
    },
  },
  {
    id: 'gather',
    group: 'survival',
    icon: (s) => (here(s) === 'river' || here(s) === 'mountain' ? '🪨' : '🪵'),
    name: k('Thu thập vật liệu'),
    desc: (s) => {
      const t: Record<RegionId, string> = {
        coast: 'Nhặt gỗ trôi dạt và lá cọ dọc bãi biển.',
        jungle: 'Chặt cành, tước dây leo, hái lá cọ, lấy nhựa cây.',
        river: `Nhặt đá cuội và đá lửa dưới lòng suối.${found(s, 'flint_bed') ? ' Bãi đá lửa luôn có đá lửa.' : ''}`,
        mountain: 'Ghè đá và tìm đá lửa trên sườn núi.',
        cape: 'Nhặt đá và gỗ mục quanh tàn tích.',
      };
      return t[here(s)] + (hasTag(s, 'axe') && (here(s) === 'jungle' || here(s) === 'coast') ? ' Rìu giúp lấy nhiều gỗ hơn.' : '');
    },
    hint: (s) => {
      const t: Record<RegionId, string> = {
        coast: 'Gỗ, lá cọ',
        jungle: 'Gỗ, sợi dây leo, lá cọ, nhựa cây',
        river: 'Đá, đá lửa, sợi',
        mountain: 'Đá, đá lửa',
        cape: 'Đá, gỗ',
      };
      return t[here(s)];
    },
    energy: (s) => (hasTag(s, 'axe') && (here(s) === 'jungle' || here(s) === 'coast') ? 8 : 11),
    visible: k(true),
    check: (s) => ({
      label: 'Thu thập vật liệu',
      tags: ['gather'],
      attr: 'STR',
      skill: 'survival',
      dc: here(s) === 'mountain' ? 11 : 10,
      outdoor: true,
      mods: mods((here(s) === 'jungle' || here(s) === 'coast') && tool(s, 'axe', 2, 'Rìu đá')),
    }),
    priority: (s) => (s.day <= 2 ? 45 : 30),
    resolve: (ctx, tier) => {
      const s = ctx.s;
      const r = here(s);
      const m = tierYield(tier, { crit_success: 1.5, success: 1, partial: 0.6, failure: 0.25 });
      const woodM = abundanceMult(s, r, 'wood');
      const axe = hasTag(s, 'axe') && (r === 'jungle' || r === 'coast');
      const add = (id: string, n: number) => ctx.addItem(id, ctx.rng.round(n * m));
      if (r === 'coast') {
        add('wood', (2.5 + (axe ? 1 : 0)) * woodM);
        add('palm', 2.5);
      } else if (r === 'jungle') {
        add('wood', (2.5 + (axe ? 1.5 : 0)) * woodM);
        add('fiber', 3.5);
        add('palm', 2);
        if (ctx.rng.chance(0.5 * m)) ctx.addItem('resin', 1);
      } else if (r === 'river') {
        add('stone', 2.5);
        add('fiber', 1);
        if (found(s, 'flint_bed')) add('flint', 1.6);
        else if (ctx.rng.chance(0.35 * m)) ctx.addItem('flint', 1);
      } else if (r === 'mountain') {
        add('stone', 3);
        add('flint', 1.2);
      } else {
        add('stone', 2);
        add('wood', 1 * woodM);
      }
      if (axe) ctx.useTool('axe');
      if (r === 'jungle' || r === 'coast') deplete(s, r, 'wood', 10);
      if (tier === 'crit_failure') {
        ctx.say('Một cành cây gãy đập trúng người bạn.');
        ctx.addCondition('injury', 1);
      }
    },
  },
  {
    id: 'collect_debris',
    group: 'survival',
    icon: k('🌊'),
    name: k('Nhặt đồ trôi dạt'),
    desc: k('Sau bão, bãi biển đầy gỗ và đồ vật trôi dạt. Chỉ có trong ngày hôm nay.'),
    hint: k('Gỗ, lá cọ và vài món đồ ngẫu nhiên'),
    energy: k(8),
    followUp: true,
    visible: (s) => here(s) === 'coast' && s.flags.debrisDay === s.day && !s.flags[`debrisTaken${s.day}`],
    priority: k(80),
    resolve: (ctx) => {
      ctx.flag(`debrisTaken${ctx.s.day}`);
      ctx.addItem('wood', ctx.rng.int(3, 5));
      ctx.addItem('palm', ctx.rng.int(1, 3));
      const extras = ['canvas', 'rope', 'scrap', 'canned', 'barrel', 'fiber'];
      ctx.addItem(ctx.rng.pick(extras), 1);
      if (ctx.rng.chance(0.5)) ctx.addItem(ctx.rng.pick(extras), 1);
      ctx.say('Bạn gom nhặt những gì sóng bão mang tới.');
    },
  },

  // ============================== FOOD (hunting / fishing / traps / cooking)
  {
    id: 'fish',
    group: 'food',
    icon: k('🎣'),
    name: k('Đánh cá'),
    desc: (s) =>
      `Bắt cá ${here(s) === 'coast' ? 'ở vùng nước nông ven bờ' : 'dưới suối'}. ${
        hasTag(s, 'rod') ? 'Cần câu giúp ích rất nhiều.' : hasTag(s, 'spear') ? 'Dùng giáo để đâm cá.' : 'Bắt bằng tay rất khó.'
      }`,
    hint: (s) => `1–3 cá sống (trữ lượng cá: ${Math.round(s.regions[here(s)].abundance.fish)}%)`,
    energy: k(8),
    visible: (s) => here(s) === 'coast' || here(s) === 'river',
    check: (s) => {
      const best = hasTag(s, 'rod') ? { label: 'Cần câu', value: 3 } : hasTag(s, 'spear') ? { label: 'Giáo gỗ', value: 1 } : { label: 'Tay không', value: -2 };
      return {
        label: 'Đánh cá',
        tags: ['fishing'],
        attr: 'AGI',
        skill: 'fishing',
        dc: 13,
        outdoor: true,
        mods: mods(
          best,
          here(s) === 'coast' && found(s, 'lagoon') && { label: 'Đầm phá', value: 2 },
          here(s) === 'river' && found(s, 'deep_pool') && { label: 'Vũng sâu', value: 2 },
          s.flags.fishBonusDay === s.day && { label: 'Đàn cá vào bờ', value: 3 },
        ),
      };
    },
    priority: (s) => (needFood(s) ? 65 : 35) + (s.flags.fishBonusDay === s.day ? 25 : 0),
    resolve: (ctx, tier) => {
      const s = ctx.s;
      const r = here(s);
      const base = tierYield(tier, { crit_success: 3, success: 2, partial: 1 });
      let n = base ? Math.max(1, ctx.rng.round(base * abundanceMult(s, r, 'fish'))) : 0;
      if (n && isSuccess(tier) && s.skills.fishing.lvl >= 3) n++;
      ctx.addItem('fish_raw', n);
      deplete(s, r, 'fish', 14);
      const wear = tier === 'crit_failure' ? 3 : 1;
      if (hasTag(s, 'rod')) ctx.useTool('rod', wear);
      else if (hasTag(s, 'spear')) ctx.useTool('spear', wear);
      if (!n) ctx.say('Cá cứ lượn lờ trước mặt mà bạn không bắt được con nào.');
      if (s.regions[r].abundance.fish < 30) ctx.say('Cá ở đây đã thưa thớt — có lẽ nên để chúng hồi lại vài ngày.');
    },
  },
  {
    id: 'hunt',
    group: 'food',
    icon: k('🏹'),
    name: k('Săn thú nhỏ'),
    desc: (s) =>
      `Rình bắt heo rừng, thỏ, chim trong rừng. ${hasTag(s, 'spear') ? 'Giáo gỗ +2.' : 'Không có vũ khí rất bất lợi.'} Thú sẽ cảnh giác hơn nếu bị săn liên tục.`,
    hint: (s) => `2–4 thịt sống. Thú cảnh giác: ${Math.round(s.regions.jungle.wildlifeAlert)}%`,
    energy: k(14),
    visible: (s) => here(s) === 'jungle',
    check: (s) => ({
      label: 'Săn bắt',
      tags: ['hunting'],
      attr: 'AGI',
      skill: 'hunting',
      dc: 14 + Math.floor(s.regions.jungle.wildlifeAlert / 20),
      outdoor: true,
      mods: mods(
        hasTag(s, 'spear') ? { label: 'Giáo gỗ', value: 2 } : { label: 'Không có vũ khí', value: -3 },
        Number(s.flags.huntBonusUntil ?? -1) >= (s.day - 1) * 4 + s.slot && { label: 'Biết lối mòn thú', value: 2 },
      ),
    }),
    priority: (s) => (needFood(s) ? 50 : 25),
    resolve: (ctx, tier) => {
      const s = ctx.s;
      const base = tierYield(tier, { crit_success: 4, success: 3, partial: 2 });
      let n = base ? Math.max(1, ctx.rng.round(base * abundanceMult(s, 'jungle', 'game'))) : 0;
      if (n && isSuccess(tier) && s.skills.hunting.lvl >= 3) n++;
      ctx.addItem('meat_raw', n);
      deplete(s, 'jungle', 'game', 15);
      s.regions.jungle.wildlifeAlert = Math.min(100, s.regions.jungle.wildlifeAlert + 25);
      if (hasTag(s, 'spear')) ctx.useTool('spear', tier === 'crit_failure' ? 3 : 1);
      if (tier === 'partial' && ctx.rng.chance(0.35)) {
        ctx.say('Con mồi giãy giụa làm bạn bị thương.');
        ctx.addCondition('injury', 1);
      }
      if (tier === 'failure') ctx.say('Con mồi đánh hơi thấy bạn và chạy mất.');
      if (tier === 'crit_failure') {
        ctx.say('Một con lợn rừng đực lao ra húc thẳng vào bạn!');
        ctx.addCondition('injury', ctx.rng.chance(0.4) ? 2 : 1);
      }
    },
  },
  {
    id: 'set_trap',
    group: 'food',
    icon: (s, p) => (p === 'snare' ? '🪤' : '🧺'),
    name: (s, p) => (p === 'snare' ? 'Đặt bẫy thú' : 'Đặt bẫy cá'),
    desc: (s, p) =>
      p === 'snare'
        ? 'Đặt bẫy trên lối mòn của thú. Quay lại từ ngày hôm sau để thu thịt (không tốn thời gian).'
        : 'Đặt lờ đón cá. Quay lại từ ngày hôm sau để thu cá (không tốn thời gian).',
    hint: k('Thu hoạch thụ động từ ngày mai'),
    energy: k(4),
    variants: (s) => {
      const v: string[] = [];
      if (here(s) === 'jungle' && count(s.inventory, 'snare')) v.push('snare');
      if ((here(s) === 'coast' || here(s) === 'river') && count(s.inventory, 'fish_trap')) v.push('fish_trap');
      return v;
    },
    visible: k(true),
    priority: k(55),
    resolve: (ctx, _t, p) => {
      const s = ctx.s;
      ctx.removeItem(p, 1, 'inv');
      s.traps.push({ uid: ctx.nextUid(), kind: p as 'snare' | 'fish_trap', region: here(s), readyAt: ctx.now + 4, dur: 5 });
      ctx.say(`Bạn đặt ${p === 'snare' ? 'bẫy thú' : 'bẫy cá'} cẩn thận và ngụy trang kỹ.`);
      ctx.journal(`Đặt ${p === 'snare' ? 'bẫy thú' : 'bẫy cá'} ở ${regionName(here(s))}.`, 'info');
    },
  },
  {
    id: 'check_traps',
    group: 'food',
    icon: k('🪤'),
    name: k('Thu bẫy'),
    desc: k('Kiểm tra các bẫy đã đặt ở khu vực này. Việc nhanh, không tốn thời gian.'),
    hint: (s) => `${s.traps.filter((t) => t.region === here(s) && t.readyAt <= (s.day - 1) * 4 + s.slot).length} bẫy sẵn sàng`,
    slots: 0,
    energy: k(2),
    followUp: true,
    visible: (s) => s.traps.some((t) => t.region === here(s)),
    reqs: (s) => [{ label: 'Có bẫy đã đủ thời gian', met: s.traps.some((t) => t.region === here(s) && t.readyAt <= (s.day - 1) * 4 + s.slot) }],
    priority: k(95),
    resolve: (ctx) => {
      const s = ctx.s;
      let caught = 0;
      for (const t of s.traps.filter((x) => x.region === here(s) && x.readyAt <= ctx.now)) {
        if (t.kind === 'snare') {
          if (ctx.rng.chance(0.6 * abundanceMult(s, t.region, 'game'))) {
            ctx.addItem('meat_raw', 2);
            deplete(s, t.region, 'game', 8);
            caught++;
          }
          ctx.grantXp('hunting', 3);
        } else {
          if (ctx.rng.chance(0.75 * abundanceMult(s, t.region, 'fish'))) {
            ctx.addItem('fish_raw', ctx.rng.int(2, 3));
            deplete(s, t.region, 'fish', 8);
            caught++;
          }
          ctx.grantXp('fishing', 3);
        }
        t.readyAt = ctx.now + 4;
        t.dur--;
        if (t.dur <= 0) {
          s.traps = s.traps.filter((x) => x !== t);
          ctx.change('loss', `${t.kind === 'snare' ? 'Bẫy thú' : 'Bẫy cá'} đã hỏng sau nhiều lần dùng`);
        }
      }
      ctx.say(caught ? 'Bẫy đã có thu hoạch!' : 'Bẫy trống trơn. Bạn đặt lại bẫy và hy vọng lần sau.');
    },
  },
  {
    id: 'cook',
    group: 'food',
    icon: k('🍳'),
    name: k('Nấu ăn'),
    desc: k('Nướng chín đồ ăn sống bên lửa trại (tối đa 6 phần). Đồ chín no hơn và an toàn.'),
    hint: (s) => `Nấu: ${rawCookable(s).map(itemName).join(', ') || 'không có gì'}`,
    energy: k(4),
    visible: (s) => fireLit(s) && rawCookable(s).length > 0,
    check: (s) => ({ label: 'Nấu ăn', attr: 'INT', skill: 'survival', dc: 8, crit: 'safe', mods: mods(tool(s, 'pot', 2, 'Có nồi')) }),
    priority: (s) => 60 + (s.inventory.some((x) => x.id === 'fish_raw' || x.id === 'meat_raw') ? 20 : 0),
    resolve: (ctx, tier) => {
      const s = ctx.s;
      let budget = 6;
      let burnt = 0;
      const lostFrac = tier === 'partial' ? 0.2 : tier === 'failure' ? 0.5 : 0;
      for (const id of rawCookable(s)) {
        const n = Math.min(budget, countBoth(s, id));
        if (!n) continue;
        budget -= n;
        ctx.removeItem(id, n, 'both', true);
        const lost = Math.min(n, Math.round(n * lostFrac + (tier === 'partial' ? 0.5 : 0)));
        burnt += lost;
        ctx.addItem(ITEMS[id].food!.cookTo!, n - lost);
        if (budget <= 0) break;
      }
      if (burnt) ctx.change('loss', `${burnt} phần bị cháy khét`);
      ctx.say(isSuccess(tier) ? 'Mùi thơm lan tỏa khắp khu trại.' : 'Lửa quá lớn, một phần đồ ăn bị cháy.');
    },
  },
  {
    id: 'smoke_food',
    group: 'food',
    icon: k('🥓'),
    name: k('Hun khói thực phẩm'),
    desc: k('Hun khói cá/thịt sống trên giá phơi (tối đa 6 phần). Giữ được 8 ngày — rất hợp để tích trữ cho chuyến ra khơi.'),
    hint: k('Cá/thịt sống → hun khói'),
    energy: k(5),
    materials: k([{ id: 'wood', qty: 2 }]),
    visible: (s) =>
      s.baseRegion === here(s) &&
      hasStructure(s, 'storage_rack') &&
      fireLit(s) &&
      (countBoth(s, 'fish_raw') > 0 || countBoth(s, 'meat_raw') > 0),
    check: k({ label: 'Hun khói', attr: 'INT', skill: 'survival', dc: 10, crit: 'safe' }),
    priority: k(50),
    resolve: (ctx, tier) => {
      const s = ctx.s;
      let budget = 6;
      const lostFrac = tier === 'partial' ? 0.2 : tier === 'failure' ? 0.5 : 0;
      for (const id of ['fish_raw', 'meat_raw']) {
        const n = Math.min(budget, countBoth(s, id));
        if (!n) continue;
        budget -= n;
        ctx.removeItem(id, n, 'both', true);
        const lost = Math.round(n * lostFrac);
        ctx.addItem(ITEMS[id].food!.smokeTo!, n - lost);
        if (lost) ctx.change('loss', `${lost} ${itemName(id)} bị hỏng khi hun`);
      }
    },
  },
  {
    id: 'boil_water',
    group: 'survival',
    icon: k('♨️'),
    name: k('Đun sôi nước'),
    desc: k('Đun sôi toàn bộ nước chưa xử lý (cả trong kho nếu ở căn cứ) thành nước sạch. Cần lửa trại và nồi/lon thiếc.'),
    hint: (s) => `${countBoth(s, 'water_raw')} phần nước → nước sạch`,
    energy: k(3),
    visible: (s) => fireLit(s) && countBoth(s, 'water_raw') > 0,
    reqs: (s) => [{ label: 'Có nồi hoặc lon thiếc', met: hasTag(s, 'pot') || (s.baseRegion === here(s) && s.storage.some((x) => ITEMS[x.id]?.tags?.includes('pot'))) }],
    priority: (s) => (needWater(s) ? 88 : 55),
    resolve: (ctx) => {
      const s = ctx.s;
      const inv = count(s.inventory, 'water_raw');
      const sto = s.baseRegion === here(s) ? count(s.storage, 'water_raw') : 0;
      ctx.removeItem('water_raw', inv, 'inv', true);
      ctx.removeItem('water_raw', sto, 'storage', true);
      if (inv) ctx.addItem('water_safe', inv, { to: 'inv', quiet: true });
      if (sto) ctx.addItem('water_safe', sto, { to: 'storage', quiet: true });
      ctx.change('gain', `${inv + sto} phần nước đã được đun sôi → Nước sạch`);
      ctx.say('Nước sôi sùng sục. Giờ thì yên tâm uống được rồi.');
    },
  },

  // ============================== MEDICAL
  {
    id: 'treat',
    group: 'medical',
    icon: (s, p) => ITEMS[p.split(':')[1]].icon,
    name: (s, p) => {
      const [c, it] = p.split(':');
      return `Chữa ${CONDITIONS[c].name(condSev(s, c)).toLowerCase()} (${itemName(it)})`;
    },
    desc: (s, p) => {
      const [c] = p.split(':');
      return `${CONDITIONS[c].desc(condSev(s, c))}`;
    },
    hint: (s, p) => {
      const c = p.split(':')[0];
      return c === 'injury' ? 'Giảm mức thương tích, ngăn nhiễm trùng' : 'Chữa khỏi tình trạng';
    },
    energy: k(3),
    variants: (s) => {
      const v: string[] = [];
      const has = (id: string) => countBoth(s, id) > 0;
      for (const c of s.conditions) {
        if (c.id === 'injury' && !c.treated) {
          if (has('bandage')) v.push('injury:bandage');
          if (has('first_aid')) v.push('injury:first_aid');
        }
        if (c.id === 'injury' && c.treated && has('first_aid')) v.push('injury:first_aid');
        if (c.id === 'infection' || c.id === 'poisoned' || c.id === 'illness') {
          if (has('poultice')) v.push(`${c.id}:poultice`);
          if (has('first_aid') && c.id !== 'illness') v.push(`${c.id}:first_aid`);
        }
      }
      return [...new Set(v)];
    },
    visible: k(true),
    materials: (s, p) => (p.endsWith('first_aid') ? [] : [{ id: p.split(':')[1], qty: 1 }]),
    check: (s, p) => {
      const [c, it] = p.split(':');
      const dc = c === 'injury' ? 9 + condSev(s, 'injury') : c === 'infection' ? 13 : c === 'poisoned' ? 11 : 10;
      return {
        label: 'Sơ cứu',
        attr: 'INT',
        skill: 'medicine',
        dc,
        crit: 'safe',
        adv: it === 'first_aid' || s.skills.medicine.lvl >= 3 ? 1 : 0,
      };
    },
    priority: k(92),
    resolve: (ctx, tier, p) => {
      const [c, it] = p.split(':');
      if (it === 'first_aid') ctx.useTool('first_aid');
      const cond = ctx.s.conditions.find((x) => x.id === c);
      if (!cond) return;
      if (c === 'injury') {
        if (tier === 'crit_success') ctx.reduceCondition('injury', 2);
        else if (tier === 'success') ctx.reduceCondition('injury', 1);
        const left = ctx.s.conditions.find((x) => x.id === 'injury');
        if (left && atLeastPartial(tier)) {
          left.treated = true;
          ctx.change('good', 'Vết thương đã được băng bó (không còn nguy cơ nhiễm trùng)');
        }
      } else if (c === 'illness') {
        if (tier === 'crit_success') ctx.removeCondition('illness');
        else if (atLeastPartial(tier)) ctx.reduceCondition('illness', 1);
      } else {
        if (isSuccess(tier) || (tier === 'partial' && ctx.rng.chance(0.5))) ctx.removeCondition(c);
        else if (c === 'poisoned' && tier === 'partial') cond.until = ctx.now + 1;
      }
      if (!atLeastPartial(tier)) ctx.say('Bạn loay hoay mãi nhưng không xử lý được. Vật phẩm đã bị lãng phí.');
    },
  },
  {
    id: 'search_herbs',
    group: 'medical',
    icon: k('🌱'),
    name: k('Tìm thảo dược'),
    desc: (s) => `Tìm cây thuốc dưới tán rừng.${found(s, 'herb_patch') ? ' Bãi thảo dược giúp tìm dễ hơn.' : ''}`,
    hint: k('1–4 thảo dược'),
    energy: k(8),
    visible: (s) => here(s) === 'jungle',
    check: (s) => ({
      label: 'Tìm thảo dược',
      attr: 'PER',
      skill: 'medicine',
      dc: 12,
      outdoor: true,
      mods: mods(found(s, 'herb_patch') && { label: 'Bãi thảo dược', value: 3 }),
    }),
    priority: (s) => (s.conditions.some((c) => c.id === 'infection' || c.id === 'poisoned' || c.id === 'illness') ? 80 : 15),
    resolve: (ctx, tier) => {
      ctx.addItem('herbs', tierYield(tier, { crit_success: 4, success: 3, partial: 1 }));
      if (tier === 'crit_failure') snakeBite(ctx);
    },
  },

  // ============================== EXPLORATION
  {
    id: 'explore',
    group: 'explore',
    icon: k('🧭'),
    name: (s) => `Khám phá ${REGION_DEFS[here(s)].name}`,
    desc: (s) => `Đi sâu vào khu vực, tìm địa điểm mới, đường đi và manh mối. Còn khoảng ${s.regions[here(s)].explorePool.length} điều chưa khám phá.`,
    hint: k('Phát hiện địa điểm, tuyến đường, manh mối'),
    energy: k(12),
    visible: (s) => s.regions[here(s)].explorePool.length > 0,
    check: (s) => ({
      label: 'Khám phá',
      attr: 'PER',
      skill: 'survival',
      dc: REGION_DEFS[here(s)].exploreDC,
      outdoor: true,
    }),
    priority: (s) => (s.day <= 4 ? 60 : 40),
    resolve: (ctx, tier) => {
      const s = ctx.s;
      const n = tierYield(tier, { crit_success: 2, success: 1, partial: 1 });
      if (tier === 'partial') {
        ctx.say('Bạn bị lạc một lúc trước khi tìm ra thứ gì đó.');
        ctx.vital('energy', -5, 'Lạc đường');
      }
      if (!n) ctx.say('Bạn đi loanh quanh mà không phát hiện được gì mới.');
      reveal(ctx, here(s), n);
      if (tier === 'crit_failure') {
        if ((here(s) === 'jungle' || here(s) === 'river') && ctx.rng.chance(0.5)) snakeBite(ctx);
        else {
          ctx.say('Bạn trượt ngã khi băng qua địa hình hiểm trở.');
          ctx.addCondition('injury', 1);
        }
      }
    },
  },
  {
    id: 'travel',
    group: 'travel',
    icon: (s, p) => REGION_DEFS[p as RegionId].icon,
    name: (s, p) => `Đi tới ${REGION_DEFS[p as RegionId].name}`,
    desc: (s, p) => {
      const r = routeBetween(s, here(s), p as RegionId)!;
      const def = ROUTE_DEFS.find((d) => d.id === r.id)!;
      return `Theo ${def.name.toLowerCase()}${r.detour ? ' (đường vòng)' : ''}. ${
        r.danger ? 'Tuyến đường nguy hiểm — có thể trượt ngã. ' : ''
      }${s.regions[p as RegionId].discovery !== 'discovered' ? 'Bạn chưa từng tới nơi này.' : ''}`;
    },
    energy: (s, p) => {
      const r = routeBetween(s, here(s), p as RegionId)!;
      return r.energy + injuryEnergy(s) + stormExtra(s);
    },
    variants: (s) =>
      s.routes.filter((r) => r.known && (r.a === here(s) || r.b === here(s))).map((r) => (r.a === here(s) ? r.b : r.a)),
    visible: k(true),
    reqs: (s, p) => {
      const r = routeBetween(s, here(s), p as RegionId)!;
      return [{ label: r.status === 'blocked' ? 'Đường đang bị chặn' : 'Đường thông', met: r.status === 'open' }];
    },
    check: (s, p) => {
      const r = routeBetween(s, here(s), p as RegionId)!;
      if (!r.danger) return null;
      return {
        label: 'Vượt ghềnh đá',
        tags: ['climb'],
        attr: 'AGI',
        skill: 'survival',
        dc: r.danger + (s.world.weather === 'storm' ? 3 : 0),
        outdoor: true,
        mods: mods(tool(s, 'rope', 2, 'Dây thừng')),
      };
    },
    priority: (s, p) => {
      const t = p as RegionId;
      let v = 20;
      if (s.regions[t].discovery !== 'discovered') v += 15;
      if (needWater(s) && t === 'river') v += 30;
      if (s.baseRegion === t && s.slot >= 2) v += 20;
      return v;
    },
    xpKey: (s, p) => `travel:${p}`,
    resolve: (ctx, tier, p) => {
      const s = ctx.s;
      const to = p as RegionId;
      const r = routeBetween(s, here(s), to)!;
      if (r.danger) {
        if (tier === 'failure') {
          ctx.say('Sóng đánh dữ dội vào ghềnh đá, bạn buộc phải quay lại.');
          return;
        }
        if (tier === 'crit_failure') {
          ctx.say('Bạn trượt chân trên đá rêu và ngã mạnh. Phải quay lại thôi.');
          ctx.addCondition('injury', 2);
          return;
        }
        if (tier === 'partial') {
          ctx.say('Bạn vượt qua được nhưng bị đá sắc cứa vào chân.');
          ctx.addCondition('injury', 1);
        }
      }
      s.location = to;
      const reg = s.regions[to];
      ctx.say(`Bạn đến ${REGION_DEFS[to].name}.`);
      if (reg.discovery !== 'discovered') {
        reg.discovery = 'discovered';
        ctx.change('good', `Lần đầu đặt chân tới ${REGION_DEFS[to].icon} ${REGION_DEFS[to].name}`);
        ctx.journal(`Lần đầu đặt chân tới ${REGION_DEFS[to].name}. ${REGION_DEFS[to].desc}`, 'discovery');
      }
      if (to === 'cape') ctx.findLocation('lighthouse');
    },
  },
  {
    id: 'search_wreck',
    group: 'explore',
    icon: k('🚢'),
    name: k('Lục soát xác tàu'),
    desc: k('Trèo vào xác tàu tìm đồ dùng còn sót lại. Cẩn thận mảnh kim loại sắc nhọn.'),
    hint: (s) => `Còn khoảng ${s.world.wreckPool.length} món có thể tìm thấy`,
    energy: k(8),
    visible: (s) => here(s) === 'coast' && s.world.wreckPool.length > 0,
    check: k({ label: 'Lục soát xác tàu', attr: 'PER', skill: 'survival', dc: 10 }),
    priority: (s) => (s.day <= 3 ? 75 : 45),
    resolve: (ctx, tier) => {
      const pool = ctx.s.world.wreckPool;
      const n = tierYield(tier, { crit_success: 3, success: 2, partial: 1 });
      for (let i = 0; i < n && pool.length; i++) ctx.addItem(pool.shift()!, 1);
      if (!pool.length) ctx.say('Bạn đã lục tung mọi ngóc ngách của xác tàu.');
      if (!n) ctx.say('Nước tràn vào khoang, bạn không lấy được gì.');
      if ((tier === 'partial' && ctx.rng.chance(0.3)) || tier === 'crit_failure') {
        ctx.say('Một mảnh tôn sắc cứa vào tay bạn.');
        ctx.addCondition('injury', 1);
      }
    },
  },
  {
    id: 'track_footprints',
    group: 'explore',
    icon: k('👣'),
    name: k('Lần theo dấu chân'),
    desc: k('Lần theo những dấu chân cũ xem chúng dẫn tới đâu. Có thể ai đó từng sống ở đây.'),
    hint: k('Tìm ra nơi dấu chân dẫn tới'),
    energy: k(10),
    followUp: true,
    visible: (s) => here(s) === 'jungle' && found(s, 'footprints') && !found(s, 'abandoned_camp'),
    check: k({ label: 'Theo dấu', attr: 'PER', skill: 'survival', dc: 12, outdoor: true }),
    priority: k(70),
    resolve: (ctx, tier) => {
      if (atLeastPartial(tier)) {
        ctx.say('Dấu chân dẫn bạn tới một khoảng rừng thưa — nơi có một khu trại bỏ hoang!');
        ctx.findLocation('abandoned_camp');
        if (tier === 'partial') ctx.vital('energy', -5, 'Đi vòng vèo');
      } else if (tier === 'failure') ctx.say('Dấu vết mất hút giữa đám lá mục. Có lẽ phải thử lại.');
      else {
        ctx.say('Bạn lạc giữa rừng sâu rất lâu mới tìm được đường ra.');
        ctx.addCondition('shaken', 1, 6);
      }
    },
  },
  {
    id: 'search_camp',
    group: 'explore',
    icon: k('⛺'),
    name: k('Lục soát trại bỏ hoang'),
    desc: k('Xem xét kỹ khu trại của người bị nạn trước bạn.'),
    hint: (s) => `Còn khoảng ${s.world.campPool.length} món`,
    energy: k(6),
    followUp: true,
    visible: (s) => here(s) === 'jungle' && found(s, 'abandoned_camp') && s.world.campPool.length > 0,
    check: k({ label: 'Lục soát trại', attr: 'PER', skill: 'survival', dc: 9 }),
    priority: k(72),
    resolve: (ctx, tier) => {
      const pool = ctx.s.world.campPool;
      const n = tierYield(tier, { crit_success: 3, success: 2, partial: 1 });
      for (let i = 0; i < n && pool.length; i++) {
        const id = pool.shift()!;
        if (id === 'journal') readOldJournal(ctx);
        else ctx.addItem(id, id === 'herbs' ? 2 : 1);
      }
      if (!n) ctx.say('Mọi thứ đã mục nát, bạn chưa tìm được gì.');
    },
  },
  {
    id: 'climb_lookout',
    group: 'explore',
    icon: k('🔭'),
    name: k('Leo lên đỉnh núi'),
    desc: (s) =>
      s.flags.lookoutDone
        ? 'Leo lên đỉnh quan sát thời tiết và tuyến hàng hải.'
        : 'Leo lên đỉnh núi để nhìn bao quát hòn đảo và vùng biển. Leo trèo nguy hiểm.',
    hint: k('Quan sát đảo, dự báo thời tiết, tuyến tàu biển'),
    energy: k(18),
    visible: (s) => here(s) === 'mountain',
    reqs: (s) => [{ label: 'Không có bão', met: s.world.weather !== 'storm' }],
    check: (s) => ({ label: 'Leo núi', tags: ['climb'], attr: 'AGI', skill: 'survival', dc: 14, outdoor: true, mods: mods(tool(s, 'rope', 2, 'Dây thừng')) }),
    priority: (s) => (s.flags.lookoutDone ? 25 : 75),
    resolve: (ctx, tier) => {
      const s = ctx.s;
      if (!atLeastPartial(tier)) {
        if (tier === 'crit_failure') {
          ctx.say('Một mỏm đá sụt dưới chân — bạn ngã xuống!');
          ctx.addCondition('injury', 2);
        } else ctx.say('Vách đá quá dốc, bạn phải quay xuống.');
        return;
      }
      if (tier === 'partial') ctx.vital('energy', -6, 'Leo trèo vất vả');
      ctx.say('Từ đỉnh núi, cả hòn đảo trải ra dưới chân bạn.');
      if (!s.flags.lookoutDone) {
        ctx.flag('lookoutDone');
        ctx.findLocation('lookout');
        ctx.clueRegion('cape');
        ctx.discoverRoute('mountain-cape');
        ctx.journal('Từ đỉnh núi, bạn nhìn thấy tàn tích hải đăng ở mũi đá phía đông bắc, và những vệt khói tàu xa xa ngoài khơi.', 'discovery');
      }
      s.world.shipKnown = true;
      s.world.forecastUntil = Math.max(s.world.forecastUntil, s.day + 1);
      const next = s.world.ships[0];
      if (next !== undefined) {
        const d = Math.floor(next / 4) + 1;
        ctx.change('good', `🚢 Tuyến hàng hải: tàu kế tiếp dự kiến đi qua vào Ngày ${d}, buổi ${SLOT_NAMES[next % 4]}`);
      }
      ctx.change('info', `Ngày mai: ${WEATHER_DEFS[s.world.tomorrow].icon} ${WEATHER_DEFS[s.world.tomorrow].name}`);
      if (tier === 'crit_success' && s.world.currents < 3) {
        s.world.currents++;
        ctx.change('good', `🧭 Quan sát mặt biển: hiểu biết hải lưu ${s.world.currents}/3`);
      }
    },
  },
  {
    id: 'search_ruins',
    group: 'explore',
    icon: k('🗼'),
    name: k('Lục soát tàn tích hải đăng'),
    desc: k('Ngọn hải đăng bỏ hoang có thể còn thứ hữu ích: dầu, gương, sổ sách của người gác đèn.'),
    hint: (s) => `Còn khoảng ${s.world.ruinsPool.length} món`,
    energy: k(8),
    visible: (s) => here(s) === 'cape' && s.world.ruinsPool.length > 0,
    check: k({ label: 'Lục soát hải đăng', attr: 'PER', skill: 'survival', dc: 11 }),
    priority: k(70),
    resolve: (ctx, tier) => {
      const s = ctx.s;
      const n = tierYield(tier, { crit_success: 3, success: 2, partial: 1 });
      for (let i = 0; i < n && s.world.ruinsPool.length; i++) {
        const id = s.world.ruinsPool.shift()!;
        if (id === 'logbook') {
          s.world.shipKnown = true;
          if (s.world.currents < 3) s.world.currents++;
          ctx.change('good', '📖 Sổ trực của người gác đèn: biết lịch tàu đi qua, hiểu biết hải lưu +1');
          ctx.journal('Đọc sổ trực của người gác đèn: tàu hàng đi qua vùng này khoảng 4–7 ngày một chuyến. Có ghi chép về hải lưu.', 'discovery');
        } else ctx.addItem(id, 1);
      }
      if (tier === 'crit_failure') {
        ctx.say('Cầu thang gỉ sét sụp dưới chân bạn.');
        ctx.addCondition('injury', 1);
      }
    },
  },
  {
    id: 'study_currents',
    group: 'explore',
    icon: k('🌊'),
    name: k('Nghiên cứu hải lưu'),
    desc: (s) =>
      `Quan sát sóng, vật trôi và hướng gió để hiểu dòng hải lưu quanh đảo. Hiểu biết hiện tại: ${s.world.currents}/3. Rất quan trọng khi ra khơi.`,
    hint: k('Hiểu biết hải lưu +1'),
    energy: k(6),
    visible: (s) => (here(s) === 'coast' || here(s) === 'cape') && s.world.currents < 3,
    reqs: (s) => [{ label: 'Không có bão', met: s.world.weather !== 'storm' }],
    check: (s) => ({
      label: 'Nghiên cứu hải lưu',
      attr: 'INT',
      skill: 'navigation',
      dc: 12 + s.world.currents,
      crit: 'safe',
      mods: mods(here(s) === 'cape' && { label: 'Tầm nhìn từ mũi đá', value: 2 }, s.inventory.some((x) => x.id === 'chart') && { label: 'Hải đồ', value: 2 }),
    }),
    priority: (s) => (s.projects.some((p) => p.id === 'raft') ? 55 : 25),
    resolve: (ctx, tier) => {
      const w = ctx.s.world;
      if (isSuccess(tier)) {
        const gain = tier === 'crit_success' && ctx.s.skills.navigation.lvl >= 2 ? 2 : 1;
        w.currents = Math.min(3, w.currents + gain);
        ctx.change('good', `🧭 Hiểu biết hải lưu: ${w.currents}/3`);
        if (w.currents === 3) ctx.journal('Đã nắm rõ các dòng hải lưu quanh đảo.', 'milestone');
      } else ctx.say('Những con sóng vẫn còn là bí ẩn với bạn. Có lẽ cần quan sát thêm.');
    },
  },
  {
    id: 'read_sky',
    group: 'explore',
    icon: k('🌤️'),
    name: k('Quan sát bầu trời'),
    desc: k('Nhìn mây, gió và chim chóc để đoán thời tiết. Việc nhanh, mỗi ngày một lần.'),
    hint: (s) => `Dự báo ${s.skills.navigation.lvl >= 1 ? '2 ngày' : 'ngày mai'}`,
    slots: 0,
    energy: k(2),
    visible: (s) => s.flags.readSkyDay !== s.day,
    check: k({ label: 'Đọc thời tiết', attr: 'PER', skill: 'navigation', dc: 10, crit: 'safe' }),
    priority: (s) => (s.world.forecastUntil > s.day ? 5 : 30),
    resolve: (ctx, tier) => {
      const s = ctx.s;
      ctx.flag('readSkyDay', s.day);
      if (!isSuccess(tier)) {
        ctx.say('Bầu trời khó đoán quá.');
        return;
      }
      s.world.forecastUntil = Math.max(s.world.forecastUntil, s.day + 1);
      ctx.change('info', `Ngày mai: ${WEATHER_DEFS[s.world.tomorrow].icon} ${WEATHER_DEFS[s.world.tomorrow].name}`);
    },
  },

  // ============================== FOLLOW-UPS FROM WORLD CHANGES
  {
    id: 'clear_route',
    group: 'travel',
    icon: k('🪓'),
    name: (s, p) => {
      const r = s.routes.find((x) => x.id === p)!;
      return `Dọn đường tới ${REGION_DEFS[r.a === here(s) ? r.b : r.a].name}`;
    },
    desc: (s) => `Dọn cây đổ, đất đá chắn đường. ${hasTag(s, 'axe') ? 'Rìu đá giúp ích rất nhiều.' : 'Không có rìu sẽ rất vất vả.'}`,
    hint: k('Mở lại tuyến đường'),
    energy: k(16),
    followUp: true,
    variants: (s) => s.routes.filter((r) => r.known && r.status === 'blocked' && (r.a === here(s) || r.b === here(s))).map((r) => r.id),
    visible: k(true),
    check: (s) => ({ label: 'Dọn đường', attr: 'STR', skill: 'survival', dc: 13, outdoor: true, mods: mods(tool(s, 'axe', 3, 'Rìu đá')) }),
    priority: k(65),
    resolve: (ctx, tier, p) => {
      const r = ctx.s.routes.find((x) => x.id === p)!;
      if (hasTag(ctx.s, 'axe')) ctx.useTool('axe', 2);
      if (atLeastPartial(tier)) {
        r.status = 'open';
        ctx.change('good', `Tuyến ${regionName(r.a)} ↔ ${regionName(r.b)} đã thông`);
        ctx.journal(`Đã dọn thông tuyến ${regionName(r.a)} ↔ ${regionName(r.b)}.`, 'consequence');
        if (tier === 'partial') ctx.vital('energy', -8, 'Làm việc quá sức');
      } else ctx.say('Thân cây quá lớn, bạn chưa thể dịch chuyển nó.');
      if (tier === 'crit_failure') ctx.addCondition('injury', 1);
    },
  },
  {
    id: 'find_detour',
    group: 'travel',
    icon: k('🗺️'),
    name: (s, p) => {
      const r = s.routes.find((x) => x.id === p)!;
      return `Tìm đường vòng tới ${REGION_DEFS[r.a === here(s) ? r.b : r.a].name}`;
    },
    desc: k('Tìm một lối đi khác thay vì dọn đường. Đường vòng dài hơn — tốn thêm năng lượng mỗi lần đi.'),
    hint: k('Mở tuyến đường vòng (+6 năng lượng mỗi lần đi)'),
    energy: k(12),
    followUp: true,
    variants: (s) => s.routes.filter((r) => r.known && r.status === 'blocked' && (r.a === here(s) || r.b === here(s))).map((r) => r.id),
    visible: k(true),
    check: k({ label: 'Tìm đường vòng', attr: 'PER', skill: 'navigation', dc: 14, outdoor: true }),
    priority: k(50),
    resolve: (ctx, tier, p) => {
      const r = ctx.s.routes.find((x) => x.id === p)!;
      if (isSuccess(tier)) {
        r.status = 'open';
        r.detour = true;
        r.energy += 6;
        ctx.change('good', `Tìm ra đường vòng ${regionName(r.a)} ↔ ${regionName(r.b)}`);
        ctx.journal(`Tìm ra đường vòng giữa ${regionName(r.a)} và ${regionName(r.b)}.`, 'consequence');
      } else ctx.say('Mọi lối đi đều dẫn vào ngõ cụt.');
    },
  },
  {
    id: 'trace_contamination',
    group: 'explore',
    icon: k('🔍'),
    name: k('Truy tìm nguồn ô nhiễm'),
    desc: k('Ngược dòng suối tìm xem thứ gì làm nước bị ô nhiễm.'),
    hint: k('Tìm ra nguyên nhân để xử lý'),
    energy: k(10),
    followUp: true,
    visible: (s) => here(s) === 'river' && s.regions.river.water === 'contaminated' && s.regions.river.waterKnown && !s.flags.contamFound,
    check: k({ label: 'Truy tìm nguồn ô nhiễm', attr: 'PER', skill: 'survival', dc: 12, outdoor: true }),
    priority: k(70),
    resolve: (ctx, tier) => {
      if (atLeastPartial(tier)) {
        ctx.flag('contamFound');
        ctx.say('Ở thượng nguồn, xác một con lợn rừng đang thối rữa chắn ngang dòng suối.');
        ctx.journal('Tìm ra nguồn ô nhiễm: xác lợn rừng thối rữa ở thượng nguồn suối.', 'consequence');
      } else ctx.say('Bạn không tìm ra nguyên nhân.');
    },
  },
  {
    id: 'remove_carcass',
    group: 'explore',
    icon: k('🧤'),
    name: k('Dọn xác thú khỏi dòng suối'),
    desc: k('Kéo xác thú ra khỏi dòng nước. Việc nặng nhọc và mất vệ sinh.'),
    hint: k('Nước suối sạch trở lại từ ngày mai'),
    energy: k(12),
    followUp: true,
    visible: (s) => here(s) === 'river' && !!s.flags.contamFound && !s.flags.contamCleared && s.regions.river.water === 'contaminated',
    check: k({ label: 'Dọn xác thú', attr: 'STR', skill: 'survival', dc: 9, outdoor: true }),
    priority: k(75),
    resolve: (ctx, tier) => {
      if (atLeastPartial(tier)) {
        ctx.flag('contamCleared');
        ctx.say('Bạn kéo được xác thú lên bờ và chôn đi. Dòng suối sẽ sớm trong lại.');
        if (tier === 'partial' && ctx.rng.chance(0.3)) ctx.addCondition('illness', 1);
      } else {
        ctx.say('Xác thú quá nặng và trơn.');
        if (tier === 'crit_failure') ctx.addCondition('illness', 1);
      }
    },
  },

  // ============================== CRAFTING
  {
    id: 'craft',
    group: 'craft',
    icon: (s, p) => RECIPES.find((r) => r.id === p)!.icon,
    name: (s, p) => `Chế tạo ${RECIPES.find((r) => r.id === p)!.name}`,
    desc: (s, p) => RECIPES.find((r) => r.id === p)!.desc,
    hint: (s, p) => {
      const r = RECIPES.find((x) => x.id === p)!;
      return `Tạo ra ${r.output.qty > 1 ? r.output.qty + ' ' : ''}${ITEMS[r.output.id].icon} ${ITEMS[r.output.id].name}`;
    },
    energy: k(6),
    variants: () => RECIPES.map((r) => r.id),
    visible: k(true),
    reqs: (s, p) => {
      const r = RECIPES.find((x) => x.id === p)!;
      const out: Req[] = [];
      if (r.unlocked) out.push({ label: r.lockText ?? 'Chưa mở khóa', met: r.unlocked(s) });
      if (r.tool) out.push({ label: `Có dao (${itemName('knife')} hoặc ${itemName('stone_knife')})`, met: hasTag(s, r.tool) });
      return out;
    },
    materials: (s, p) => RECIPES.find((r) => r.id === p)!.inputs,
    check: (s, p) => {
      const r = RECIPES.find((x) => x.id === p)!;
      return { label: `Chế tạo ${r.name}`, attr: r.attr, skill: r.skill, dc: r.dc, crit: 'safe' };
    },
    priority: (s, p) => {
      const important: Record<string, number> = { stone_knife: 40, stone_axe: 35, spear: 30, basket: 25, coconut_cup: 30 };
      const owned = countBoth(s, p) > 0;
      return owned ? 5 : (important[p] ?? 15);
    },
    xpKey: (s, p) => `craft:${p}`,
    resolve: (ctx, tier, p) => {
      const r = RECIPES.find((x) => x.id === p)!;
      const def = ITEMS[r.output.id];
      if (!atLeastPartial(tier)) {
        ctx.say('Sản phẩm hỏng giữa chừng.');
        refundHalf(ctx, r.inputs);
        return;
      }
      ctx.s.stats.crafted++;
      let durMult = ctx.s.skills.crafting.lvl >= 3 ? 1.5 : 1;
      if (tier === 'partial') durMult *= 0.6;
      if (tier === 'crit_success') durMult *= 1.3;
      ctx.addItem(r.output.id, r.output.qty, def.dur !== undefined ? { durMult } : {});
      if (def.dur !== undefined && tier === 'partial') ctx.say('Sản phẩm hơi ọp ẹp, có lẽ sẽ không bền lắm.');
      if (def.dur !== undefined && tier === 'crit_success') ctx.say('Một sản phẩm tuyệt hảo — chắc chắn sẽ rất bền.');
      if (p === 'coconut_cup') ctx.vital('hunger', 8, 'Ăn cùi dừa');
    },
  },

  // ============================== BASE
  {
    id: 'build',
    group: 'base',
    icon: (s, p) => STRUCTURES.find((x) => x.id === p)!.icon,
    name: (s, p) => `Xây ${STRUCTURES.find((x) => x.id === p)!.name}`,
    desc: (s, p) => {
      const d = STRUCTURES.find((x) => x.id === p)!;
      if (d.where === 'shelter' && !s.baseRegion) return `${d.desc} ⚑ Căn cứ sẽ được lập tại ${REGION_DEFS[here(s)].name}.`;
      if (p === 'campfire') return `${d.desc} ${countBoth(s, 'flint') ? 'Có đá lửa — nhóm lửa dễ hơn nhiều.' : 'Không có đá lửa, phải dùi gỗ — khá khó.'}`;
      return d.desc;
    },
    hint: (s, p) => (p === 'campfire' ? 'Mở: nấu ăn, đun nước, hun khói' : STRUCTURES.find((x) => x.id === p)!.desc.split('.')[0]),
    energy: (s, p) => STRUCTURES.find((x) => x.id === p)!.energy,
    variants: () => STRUCTURES.map((x) => x.id),
    visible: (s, p) => {
      const d = STRUCTURES.find((x) => x.id === p)!;
      const loc = here(s);
      if (d.where === 'signal') return REGION_DEFS[loc].seaView && !hasStructure(s, 'signal_pyre');
      if (d.where === 'shelter') return !shelterAtBase(s) && (!s.baseRegion || s.baseRegion === loc);
      if (!s.baseRegion || s.baseRegion !== loc) return false;
      if (d.replaces) return hasStructure(s, d.replaces);
      if (p === 'campfire') return !structuresAt(s, loc, 'campfire').length;
      return !hasStructure(s, p);
    },
    reqs: (s, p) => {
      const d = STRUCTURES.find((x) => x.id === p)!;
      const out: Req[] = [];
      if (d.unlocked) out.push({ label: d.lockText ?? 'Chưa mở khóa', met: d.unlocked(s) });
      return out;
    },
    materials: (s, p) => STRUCTURES.find((x) => x.id === p)!.inputs,
    check: (s, p) => {
      const d = STRUCTURES.find((x) => x.id === p)!;
      return {
        label: `Xây ${d.name}`,
        attr: d.attr,
        skill: d.skill,
        dc: d.dc,
        crit: 'safe',
        outdoor: d.id === 'campfire',
        tags: d.id === 'campfire' ? ['fire'] : undefined,
        mods: mods(
          p === 'campfire' && countBoth(s, 'flint') > 0 && { label: 'Đá lửa', value: 5 },
          p === 'campfire' && hasTag(s, 'fire') && { label: 'Đuốc', value: 5 },
        ),
      };
    },
    priority: (s, p) => {
      const pr: Record<string, number> = { lean_to: 70, campfire: 68, rain_collector: 45, storage_rack: 30, fence: 25, hut: 35, signal_pyre: here(s) === 'cape' ? 60 : 25 };
      return pr[p] ?? 20;
    },
    xpKey: (s, p) => `build:${p}`,
    resolve: (ctx, tier, p) => {
      const s = ctx.s;
      const d = STRUCTURES.find((x) => x.id === p)!;
      if (!atLeastPartial(tier)) {
        ctx.say(p === 'campfire' ? 'Bạn cọ xát mãi mà ngọn lửa không chịu bén.' : 'Công trình đổ sụp giữa chừng.');
        if (p !== 'campfire') refundHalf(ctx, d.inputs);
        else ctx.addItem('wood', 2, { quiet: true });
        return;
      }
      const loc = here(s);
      if (d.where === 'shelter' && !s.baseRegion) {
        s.baseRegion = loc;
        ctx.change('good', `⚑ Lập căn cứ tại ${REGION_DEFS[loc].name}`);
        ctx.journal(`Lập căn cứ tại ${REGION_DEFS[loc].name}.`, 'milestone');
      }
      if (d.replaces) s.structures = s.structures.filter((x) => !(x.region === loc && x.id === d.replaces));
      s.structures.push({ uid: ctx.nextUid(), id: p, region: loc, integrity: tier === 'partial' ? 60 : 100, lit: p === 'campfire' ? true : undefined });
      ctx.change('good', `${d.icon} Đã xây ${d.name}${tier === 'partial' ? ' (chưa chắc chắn lắm, độ bền 60%)' : ''}`);
      if (p !== 'campfire') ctx.journal(`Xây ${d.name} tại ${REGION_DEFS[loc].name}.`, 'milestone');
    },
  },
  {
    id: 'relight_fire',
    group: 'base',
    icon: k('🔥'),
    name: k('Nhóm lại lửa trại'),
    desc: (s) => `Lửa trại đã tắt. ${countBoth(s, 'flint') ? 'Có đá lửa — dễ dàng.' : 'Không có đá lửa, phải dùi gỗ.'}`,
    hint: k('Lửa trại cháy trở lại'),
    energy: k(4),
    materials: k([{ id: 'wood', qty: 1 }]),
    visible: (s) => structuresAt(s, here(s), 'campfire').some((f) => !f.lit),
    check: (s) => ({
      label: 'Nhóm lửa',
      tags: ['fire'],
      attr: 'INT',
      skill: 'survival',
      dc: 12,
      outdoor: true,
      crit: 'safe',
      mods: mods(countBoth(s, 'flint') > 0 && { label: 'Đá lửa', value: 5 }, hasTag(s, 'fire') && { label: 'Đuốc', value: 5 }),
    }),
    priority: k(66),
    resolve: (ctx, tier) => {
      if (atLeastPartial(tier)) {
        for (const f of structuresAt(ctx.s, here(ctx.s), 'campfire')) f.lit = true;
        ctx.change('good', '🔥 Lửa trại đã cháy trở lại');
      } else ctx.say('Củi ẩm quá, lửa không bén.');
    },
  },
  {
    id: 'repair',
    group: 'base',
    icon: k('🔧'),
    name: (s, p) => {
      const st = s.structures.find((x) => String(x.uid) === p)!;
      return `Sửa ${STRUCTURES.find((d) => d.id === st.id)!.name} (${st.integrity}%)`;
    },
    desc: k('Gia cố, thay thế phần hư hỏng.'),
    hint: k('Độ bền +50%'),
    energy: k(10),
    variants: (s) => s.structures.filter((x) => x.region === here(s) && x.integrity < 80 && x.id !== 'campfire').map((x) => String(x.uid)),
    visible: k(true),
    materials: (s, p) => {
      const st = s.structures.find((x) => String(x.uid) === p)!;
      return st.id === 'lean_to' || st.id === 'hut' || st.id === 'rain_collector'
        ? [{ id: 'wood', qty: 2 }, { id: 'palm', qty: 2 }]
        : [{ id: 'wood', qty: 2 }, { id: 'fiber', qty: 1 }];
    },
    check: k({ label: 'Sửa chữa', attr: 'STR', skill: 'crafting', dc: 9, crit: 'safe' }),
    priority: (s, p) => {
      const st = s.structures.find((x) => String(x.uid) === p)!;
      return st.integrity < 40 ? 70 : 35;
    },
    xpKey: k('repair'),
    resolve: (ctx, tier, p) => {
      const st = ctx.s.structures.find((x) => String(x.uid) === p)!;
      const add = tierYield(tier, { crit_success: 100, success: 50, partial: 25 });
      if (add) {
        st.integrity = Math.min(100, st.integrity + add);
        ctx.change('good', `Độ bền: ${st.integrity}%`);
      } else ctx.say('Bạn loay hoay mà không gia cố được.');
    },
  },

  // ============================== ESCAPE PREP
  {
    id: 'build_raft',
    group: 'escape',
    icon: k('🛶'),
    name: (s, p) => {
      const stage = raftStage(s);
      return `Đóng bè: ${RAFT_STAGES[stage].name} (${stage + 1}/3)${p === 'alt' ? ' — phương án thay thế' : ''}`;
    },
    desc: (s, p) => {
      const st = RAFT_STAGES[raftStage(s)];
      return `${st.desc}${p === 'alt' && st.altLabel ? ` (${st.altLabel})` : ''}${s.flags.raft_design ? ' Bản vẽ của người đi trước giúp ích (+2).' : ''}`;
    },
    hint: (s) => (raftStage(s) === 0 ? 'Có bè thô để thử thoát đảo' : 'Bè chắc chắn hơn, ra khơi dễ hơn'),
    energy: (s) => RAFT_STAGES[Math.min(2, raftStage(s))].energy,
    variants: (s) => {
      const st = raftStage(s);
      if (st >= 3) return [];
      return RAFT_STAGES[st].alt ? ['main', 'alt'] : ['main'];
    },
    visible: (s) => here(s) === RAFT_REGION,
    materials: (s, p) => {
      const st = RAFT_STAGES[raftStage(s)];
      return p === 'alt' && st.alt ? st.alt : st.inputs;
    },
    check: (s) => {
      const st = RAFT_STAGES[raftStage(s)];
      return {
        label: `Đóng bè — ${st.name}`,
        attr: st.attr,
        skill: 'crafting',
        dc: st.dc,
        crit: 'safe',
        mods: mods(!!s.flags.raft_design && { label: 'Bản vẽ bè', value: 2 }),
      };
    },
    priority: (s) => 40 + raftStage(s) * 10,
    xpKey: (s) => `raft:${raftStage(s)}`,
    resolve: (ctx, tier, p) => {
      const s = ctx.s;
      const stage = raftStage(s);
      const st = RAFT_STAGES[stage];
      if (!atLeastPartial(tier)) {
        ctx.say('Các mối buộc tuột ra, công sức đổ sông đổ biển.');
        refundHalf(ctx, p === 'alt' && st.alt ? st.alt : st.inputs);
        return;
      }
      let raft = s.projects.find((x) => x.id === 'raft');
      if (!raft) {
        raft = { id: 'raft', region: 'coast', stage: 0, integrity: 0 };
        s.projects.push(raft);
      }
      raft.stage = stage + 1;
      raft.integrity = Math.min(100, stage === 0 ? (tier === 'crit_success' ? 85 : tier === 'partial' ? 60 : 70) : raft.integrity + (tier === 'partial' ? 5 : 15));
      ctx.change('good', `🛶 Hoàn thành: ${st.name} (độ bền bè ${raft.integrity}%)`);
      ctx.journal(`Hoàn thành giai đoạn đóng bè: ${st.name}.`, 'milestone');
    },
  },
  {
    id: 'repair_raft',
    group: 'escape',
    icon: k('🔧'),
    name: (s) => `Sửa bè (${s.projects.find((x) => x.id === 'raft')?.integrity ?? 0}%)`,
    desc: k('Thay dây buộc, gia cố thân bè.'),
    hint: k('Độ bền bè +35%'),
    energy: k(12),
    visible: (s) => here(s) === RAFT_REGION && (s.projects.find((x) => x.id === 'raft')?.integrity ?? 100) < 90,
    materials: k([{ id: 'wood', qty: 3 }, { id: 'rope', qty: 1 }]),
    check: k({ label: 'Sửa bè', attr: 'STR', skill: 'crafting', dc: 10, crit: 'safe' }),
    priority: (s) => ((s.projects.find((x) => x.id === 'raft')?.integrity ?? 100) < 50 ? 60 : 30),
    resolve: (ctx, tier) => {
      const raft = ctx.s.projects.find((x) => x.id === 'raft')!;
      const add = tierYield(tier, { crit_success: 50, success: 35, partial: 15 });
      raft.integrity = Math.min(100, raft.integrity + add);
      if (add) ctx.change('good', `Độ bền bè: ${raft.integrity}%`);
      else ctx.say('Sửa không được, phí mất vật liệu.');
    },
  },
  {
    id: 'escape_raft',
    group: 'escape',
    icon: k('⛵'),
    name: k('Ra khơi bằng bè'),
    desc: k('Rời đảo trên chiếc bè. Hành trình gồm 3 chặng, mỗi chặng tốn một buổi và một lần tung xúc xắc. Thất bại có thể làm hỏng bè, bị thương — hoặc tệ hơn.'),
    hint: k('Thoát đảo — chiến thắng nếu vượt qua 3 chặng'),
    slots: 0,
    energy: k(10),
    visible: (s) => here(s) === RAFT_REGION && s.projects.some((x) => x.id === 'raft' && x.stage >= 1),
    notes: (s) => raftRiskNotes(s),
    priority: (s) => (raftStage(s) >= 2 ? 55 : 20),
    resolve: (ctx) => {
      ctx.s.escape = { method: 'raft', stage: 0, adv: 0, dcPenalty: 0, canReturn: false, log: [] };
      ctx.say('Bạn đẩy bè xuống nước, hít một hơi thật sâu và chèo ra phía những con sóng…');
      ctx.journal('Ra khơi bằng bè.', 'escape');
    },
  },
  {
    id: 'escape_desperate',
    group: 'escape',
    icon: k('🌊'),
    name: k('Liều mình ra khơi'),
    desc: k('Ôm lấy khúc gỗ nổi và lao ra biển, phó mặc cho số phận. Khả năng thành công cực thấp; thất bại sẽ bị sóng đánh dạt về bờ trong tình trạng tồi tệ — hoặc không bao giờ trở về.'),
    hint: k('Cơ hội cực thấp — 3 lần thử thách rất khó'),
    slots: 0,
    energy: k(10),
    visible: (s) => here(s) === 'coast',
    reqs: (s) => [{ label: 'Mang theo 2 gỗ hoặc 1 thùng phuy làm phao', met: count(s.inventory, 'wood') >= 2 || count(s.inventory, 'barrel') >= 1 }],
    notes: (s) => [
      `Thời tiết: ${WEATHER_DEFS[s.world.weather].icon} ${WEATHER_DEFS[s.world.weather].name}`,
      'Không có bè: mọi chặng đều cực khó (DC 19–21)',
      'Thất bại: mất 20–35 Sức khỏe và phần lớn đồ mang theo',
    ],
    priority: k(3),
    resolve: (ctx) => {
      const s = ctx.s;
      if (count(s.inventory, 'barrel') >= 1) ctx.removeItem('barrel', 1, 'inv');
      else ctx.removeItem('wood', 2, 'inv');
      s.escape = { method: 'desperate', stage: 0, adv: 0, dcPenalty: 0, canReturn: false, log: [] };
      ctx.say('Bạn ôm chặt chiếc phao tạm bợ và lội ra biển. Không còn đường lui.');
      ctx.journal('Liều mình ra khơi không có bè.', 'escape');
    },
  },
];

// ---------------------------------------------------------------- helpers used above

function shelterAtBase(s: GameState) {
  return !!s.baseRegion && (hasStructure(s, 'lean_to', s.baseRegion) || hasStructure(s, 'hut', s.baseRegion));
}

export function raftStage(s: GameState): number {
  return s.projects.find((x) => x.id === 'raft')?.stage ?? 0;
}

export function raftRiskNotes(s: GameState): string[] {
  const raft = s.projects.find((x) => x.id === 'raft');
  const water = waterCount(s.inventory);
  const food = s.inventory.reduce((a, st) => (ITEMS[st.id]?.kind === 'food' ? a + st.qty : a), 0);
  return [
    `Thời tiết: ${WEATHER_DEFS[s.world.weather].icon} ${WEATHER_DEFS[s.world.weather].name}${s.flags.calmSeaDay === s.day ? ' — biển lặng' : ''}`,
    `Bè: ${['', 'khung thô', 'có phao', 'có buồm'][raft?.stage ?? 0]}, độ bền ${raft?.integrity ?? 0}%`,
    `Hiểu biết hải lưu: ${s.world.currents}/3${s.inventory.some((x) => x.id === 'chart') ? ' + hải đồ' : ''}`,
    `Mang theo: ${water} nước, ${food} thức ăn ${water >= 3 && food >= 2 ? '(đủ)' : '(thiếu — chặng 2 sẽ khó hơn)'}`,
    `Thể trạng: Sức khỏe ${Math.round(s.vitals.health)}, Năng lượng ${Math.round(s.vitals.energy)}`,
  ];
}

function readOldJournal(ctx: Ctx) {
  const s = ctx.s;
  ctx.flag('raft_design');
  ctx.flag('know_traps');
  ctx.flag('know_herbs');
  if (s.world.currents < 3) s.world.currents++;
  ctx.clueRegion('cape');
  ctx.discoverRoute('coast-cape');
  ctx.change('good', '📓 Nhật ký người đi trước: bản vẽ bè, cách đặt bẫy, cây thuốc, hải lưu +1');
  ctx.journal(
    'Đọc được nhật ký của người bị nạn trước: “…Tôi đã đóng xong bè. Tàu hàng thường đi qua phía hải đăng cũ — có thể tới đó theo ghềnh đá ven biển. Nếu ai đọc được những dòng này, đừng ra khơi khi trời nổi gió…” Kèm theo là bản vẽ bè, cách đặt bẫy và các loại cây thuốc.',
    'discovery',
  );
}

export const ACTIONS: Record<string, ActionDef> = Object.fromEntries(actions.map((a) => [a.id, a]));
export const ACTION_LIST = actions;
