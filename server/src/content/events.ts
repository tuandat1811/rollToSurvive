import {
  carriedFood,
  fireSource,
  isSuccess,
  signalLocationMod,
  victory,
} from '../engine/common.ts';
import { Ctx, count, countBoth, hasStructure, regionName, shelterAt, structuresAt } from '../engine/ctx.ts';
import type { CheckSpec, GameState, Req, Tier } from '../engine/types.ts';
import { REGION_DEFS, SLOT_NAMES } from './defs.ts';
import { ITEMS } from './items.ts';

export type EventTrigger = 'day_start' | 'slot_start' | 'night';
export type EventCategory =
  | 'weather' | 'wildlife' | 'ecology' | 'discovery' | 'resources'
  | 'base' | 'health' | 'psychology' | 'narrative' | 'escape';

export interface EventChoice {
  id: string;
  label: string;
  icon?: string;
  desc?: string;
  /** follow-up time cost, paid only if the player picks this choice */
  slots: number;
  energy?: number;
  reqs?: Req[];
  check?: CheckSpec;
  /** consumed when the choice is committed */
  materials?: { id: string; qty: number }[];
  resolve: (ctx: Ctx, tier: Tier, data?: Record<string, unknown>) => void;
}

export interface EventDef {
  id: string;
  title: string;
  icon: string;
  category: EventCategory;
  risk: 1 | 2 | 3 | 4;
  trigger: EventTrigger;
  notable?: boolean;
  once?: boolean;
  cooldownDays?: number;
  eligible?: (s: GameState, data?: Record<string, unknown>) => boolean;
  forced?: (s: GameState) => boolean;
  weight?: (s: GameState) => number;
  text: (s: GameState, data?: Record<string, unknown>) => string;
  /** applied the moment the event appears; may return extra text */
  passive?: (ctx: Ctx, data?: Record<string, unknown>) => string | void;
  choices?: (s: GameState, data?: Record<string, unknown>) => EventChoice[];
  journal?: boolean | string;
}

const ignore = (label = 'Bỏ qua', text = 'Bạn quyết định không can dự.'): EventChoice => ({
  id: 'ignore',
  label,
  icon: '↩️',
  slots: 0,
  resolve: (ctx) => ctx.say(text),
});

// ---------------------------------------------------------------- signalling (ships, planes)

function signalChoices(s: GameState, opts: { bonus: number; plane?: boolean; onPartial: (ctx: Ctx) => void; win: [string, string, string] }): EventChoice[] {
  const loc = signalLocationMod(s.location);
  const bonus = opts.bonus ? { label: 'Họ đã để ý tới bạn', value: opts.bonus } : null;
  // weather effects on signalling come from the 'signal' check tag
  const mods = (extra: ({ label: string; value: number } | null)[]) =>
    [loc, bonus, ...extra].filter((x): x is { label: string; value: number } => !!x);
  const tags = ['signal'];
  const out: EventChoice[] = [];

  const onResult = (ctx: Ctx, tier: Tier, what: string) => {
    if (isSuccess(tier)) {
      victory(ctx, ...opts.win);
      return;
    }
    if (tier === 'partial') {
      ctx.say(`${what} — có vẻ họ đã thấy gì đó và đang đổi hướng…`);
      opts.onPartial(ctx);
      return;
    }
    ctx.say(`${what} — nhưng ${opts.plane ? 'chiếc máy bay' : 'con tàu'} vẫn đi xa dần rồi khuất hẳn.`);
    ctx.journal(`${opts.plane ? 'Một chiếc máy bay' : 'Một con tàu'} đi qua nhưng không thấy tín hiệu của bạn.`, 'escape');
  };

  const pyre = structuresAt(s, s.location, 'signal_pyre')[0];
  const src = fireSource(s);
  const oil = countBoth(s, 'lamp_oil') > 0;
  out.push({
    id: 'pyre',
    label: 'Đốt đống lửa tín hiệu',
    icon: '🔥',
    desc: 'Ngọn lửa lớn và cột khói dày là tín hiệu rõ nhất. Đống củi sẽ cháy hết.' + (oil ? ' Tưới dầu đèn để lửa bùng sáng.' : ''),
    slots: 1,
    energy: 4,
    reqs: [
      { label: `Có đống lửa tín hiệu tại ${regionName(s.location)}`, met: !!pyre },
      { label: 'Có nguồn lửa (lửa trại, đuốc hoặc đá lửa)', met: !!src },
    ],
    check: {
      label: 'Phát tín hiệu bằng lửa',
      attr: 'PER',
      skill: 'survival',
      dc: 16,
      tags,
      mods: mods([oil ? { label: 'Dầu đèn', value: 3 } : null, opts.plane ? { label: 'Máy bay bay nhanh', value: -1 } : null]),
    },
    resolve: (ctx, tier) => {
      const st = structuresAt(ctx.s, ctx.s.location, 'signal_pyre')[0];
      if (st) ctx.s.structures = ctx.s.structures.filter((x) => x !== st);
      ctx.change('loss', '🔥 Đống lửa tín hiệu đã cháy hết');
      if (countBoth(ctx.s, 'lamp_oil') > 0) ctx.removeItem('lamp_oil', 1);
      if (fireSource(ctx.s) === 'torch') ctx.useTool('fire');
      if (tier === 'crit_failure') {
        ctx.addCondition('injury', 1);
        ctx.say('Ngọn lửa bùng lên quá nhanh, bạn bị bỏng tay.');
      }
      onResult(ctx, tier, 'Cột khói đen cuồn cuộn bốc lên trời');
    },
  });

  if (countBoth(s, 'flare') > 0 || s.inventory.some((x) => x.id === 'flare')) {
    out.push({
      id: 'flare',
      label: 'Bắn pháo sáng',
      icon: '🎆',
      desc: 'Pháo sáng cứu hộ — rất khó bị bỏ qua. Chỉ dùng được một lần.',
      slots: 1,
      reqs: [{ label: 'Mang theo pháo sáng', met: count(s.inventory, 'flare') > 0 }],
      check: { label: 'Bắn pháo sáng', attr: 'PER', dc: 13, tags, mods: mods([]), xp: false },
      resolve: (ctx, tier) => {
        ctx.removeItem('flare', 1, 'inv');
        onResult(ctx, tier, 'Quả pháo đỏ rực vút lên bầu trời');
      },
    });
  }

  if (s.inventory.some((x) => x.id === 'signal_mirror')) {
    const sunny = s.world.weather === 'clear' || s.world.weather === 'hot';
    out.push({
      id: 'mirror',
      label: 'Chiếu gương tín hiệu',
      icon: '🪞',
      desc: 'Lóa ánh nắng về phía họ. Chỉ hiệu quả khi trời nắng.',
      slots: 1,
      reqs: [{ label: 'Trời nắng', met: sunny }],
      check: { label: 'Chiếu gương tín hiệu', attr: 'PER', skill: 'navigation', dc: 15, tags, mods: mods([]) },
      resolve: (ctx, tier) => onResult(ctx, tier, 'Tia sáng lóe lên liên hồi về phía chân trời'),
    });
  }

  out.push({
    id: 'wave',
    label: 'Vẫy áo và la hét',
    icon: '🙋',
    desc: 'Không có gì trong tay — chỉ còn hy vọng. Khả năng rất thấp.',
    slots: 1,
    energy: 6,
    check: { label: 'Vẫy gọi trong tuyệt vọng', attr: 'PER', skill: 'survival', dc: opts.plane ? 24 : 23, tags, mods: mods([]) },
    resolve: (ctx, tier) => onResult(ctx, tier, 'Bạn vẫy gọi đến khản cổ'),
  });
  out.push(ignore('Để họ đi', 'Bạn lặng lẽ nhìn theo cho tới khi nó khuất hẳn.'));
  return out;
}

const shipWin: [string, string, string] = [
  'rescue_ship',
  'Được tàu cứu',
  'Con tàu hàng đổi hướng, hạ xuồng cứu sinh. Thủy thủ đưa bạn lên boong giữa tiếng reo hò.',
];

// ---------------------------------------------------------------- event library

const list: EventDef[] = [
  // ======================= WEATHER
  {
    id: 'storm_warning',
    title: 'Dấu hiệu bão',
    icon: '🌪️',
    category: 'weather',
    risk: 3,
    trigger: 'slot_start',
    cooldownDays: 1,
    forced: (s) => s.slot >= 2 && s.world.tomorrow === 'storm',
    text: () =>
      'Chân trời tối sầm lại. Sóng bạc đầu đánh mạnh vào bờ, chim biển bay vội vào đất liền. Ngày mai bão sẽ đổ bộ!\n\nHãy về nơi trú ẩn, cất đồ vào kho và chuẩn bị đối phó.',
    passive: (ctx) => {
      ctx.s.world.forecastUntil = Math.max(ctx.s.world.forecastUntil, ctx.s.day + 1);
    },
    journal: 'Nhận thấy dấu hiệu bão sắp đổ bộ.',
  },
  {
    id: 'storm_hits',
    title: 'Bão đổ bộ',
    icon: '⛈️',
    category: 'weather',
    risk: 3,
    trigger: 'day_start',
    notable: true,
    forced: (s) => s.world.weather === 'storm',
    text: () => 'Cơn bão quét qua hòn đảo suốt đêm và sáng nay. Cây đổ, sóng tràn lên bờ.',
    passive: (ctx) => {
      const s = ctx.s;
      const lines: string[] = [];
      for (const st of [...s.structures]) {
        const dmg = st.id === 'hut' ? ctx.rng.int(5, 18) : st.id === 'signal_pyre' ? ctx.rng.int(25, 45) : ctx.rng.int(15, 35);
        st.integrity -= dmg;
        const name = STRUCT_NAMES[st.id] ?? st.id;
        if (st.integrity <= 0) {
          s.structures = s.structures.filter((x) => x !== st);
          ctx.change('loss', `${name} ở ${regionName(st.region)} bị bão phá hủy`);
          ctx.journal(`Bão đã phá hủy ${name} ở ${regionName(st.region)}.`, 'consequence');
        } else ctx.change('bad', `${name} hư hại (-${dmg} độ bền)`);
      }
      const raft = s.projects.find((p) => p.id === 'raft');
      if (raft) {
        const dmg = ctx.rng.int(10, 25);
        raft.integrity = Math.max(0, raft.integrity - dmg);
        ctx.change('bad', `Bè bị sóng đánh (-${dmg} độ bền)`);
        if (raft.integrity <= 0) {
          s.projects = s.projects.filter((p) => p !== raft);
          ctx.change('loss', 'Bè đã bị sóng cuốn trôi!');
          ctx.journal('Cơn bão cuốn mất chiếc bè đang đóng dở.', 'consequence');
        }
      }
      for (const t of [...s.traps]) {
        if (ctx.rng.chance(0.5)) {
          s.traps = s.traps.filter((x) => x !== t);
          ctx.change('loss', `Bẫy ở ${regionName(t.region)} bị cuốn mất`);
        }
      }
      const candidates = s.routes.filter((r) => r.known && r.status === 'open' && !r.danger && r.id !== 'coast-jungle');
      if (candidates.length && ctx.rng.chance(0.45)) {
        const r = ctx.rng.pick(candidates);
        r.status = 'blocked';
        ctx.change('bad', `🌳 Cây đổ chặn đường ${regionName(r.a)} ↔ ${regionName(r.b)}`);
        ctx.journal(`Bão quật đổ cây, chặn tuyến ${regionName(r.a)} ↔ ${regionName(r.b)}. Cần dọn đường hoặc tìm đường vòng.`, 'consequence');
      }
      ctx.schedule('storm_debris', 4);
      if (!shelterAt(s, s.location)) lines.push('Bạn không có chỗ trú — hãy cẩn thận.');
      return lines.join(' ');
    },
    journal: 'Bão đổ bộ vào đảo.',
  },
  {
    id: 'storm_debris',
    title: 'Đồ trôi dạt sau bão',
    icon: '🌊',
    category: 'resources',
    risk: 1,
    trigger: 'day_start',
    text: () => 'Sóng bão đánh dạt vào bãi biển đủ thứ: gỗ, dây, mảnh vỡ… Xác tàu cũng bị lật thêm, lộ ra những khoang mới.',
    passive: (ctx) => {
      ctx.flag('debrisDay', ctx.s.day);
      const extra = ['canvas', 'rope', 'scrap', 'canned', 'wood'];
      const n = ctx.rng.int(1, 2);
      for (let i = 0; i < n; i++) ctx.s.world.wreckPool.push(ctx.rng.pick(extra));
      ctx.change('info', 'Có thể nhặt đồ trôi dạt ở Bãi biển hôm nay');
    },
  },
  {
    id: 'heatwave',
    title: 'Nắng như đổ lửa',
    icon: '🥵',
    category: 'weather',
    risk: 2,
    trigger: 'day_start',
    cooldownDays: 4,
    forced: (s) => s.world.weather === 'hot',
    text: () => 'Nắng gắt từ sáng sớm. Hôm nay bạn sẽ mất nước nhanh hơn — hãy mang đủ nước bên mình.',
  },
  {
    id: 'calm_sea',
    title: 'Biển lặng',
    icon: '🌅',
    category: 'escape',
    risk: 1,
    trigger: 'day_start',
    notable: true,
    cooldownDays: 4,
    eligible: (s) => s.day >= 3 && (s.world.weather === 'clear' || s.world.weather === 'cloudy' || s.world.weather === 'breezy'),
    weight: () => 2,
    text: () => 'Mặt biển phẳng lặng như gương, gió nhẹ thổi ra khơi. Một ngày lý tưởng để ra biển.',
    passive: (ctx) => {
      ctx.flag('calmSeaDay', ctx.s.day);
      ctx.change('good', 'Hôm nay: ra khơi bằng bè +2');
    },
  },
  {
    id: 'landslide',
    title: 'Sạt lở',
    icon: '🪨',
    category: 'ecology',
    risk: 2,
    trigger: 'day_start',
    notable: true,
    cooldownDays: 5,
    eligible: (s) =>
      s.world.weather === 'rain' && s.routes.some((r) => r.known && r.status === 'open' && (r.id === 'river-mountain' || r.id === 'jungle-mountain')),
    weight: () => 2,
    text: () => 'Mưa dầm làm sạt một mảng đất đá trên sườn núi.',
    passive: (ctx) => {
      const r = ctx.s.routes.filter((x) => x.known && x.status === 'open' && (x.id === 'river-mountain' || x.id === 'jungle-mountain'));
      const pick = ctx.rng.pick(r);
      pick.status = 'blocked';
      ctx.change('bad', `Đường ${regionName(pick.a)} ↔ ${regionName(pick.b)} bị đất đá chặn`);
      ctx.journal(`Sạt lở chặn tuyến ${regionName(pick.a)} ↔ ${regionName(pick.b)}.`, 'consequence');
    },
  },

  // ======================= ECOLOGY / RESOURCES
  {
    id: 'fish_school',
    title: 'Đàn cá vào bờ',
    icon: '🐟',
    category: 'ecology',
    risk: 1,
    trigger: 'day_start',
    notable: true,
    cooldownDays: 3,
    eligible: (s) => s.world.weather !== 'storm',
    weight: () => 3,
    text: () => 'Từng đàn cá lớn kéo vào vùng nước nông, chim biển lao xuống kiếm mồi không ngớt.',
    passive: (ctx) => {
      ctx.flag('fishBonusDay', ctx.s.day);
      ctx.change('good', 'Hôm nay: đánh cá +3');
    },
  },
  {
    id: 'river_contamination',
    title: 'Nước suối đổi màu',
    icon: '☠️',
    category: 'ecology',
    risk: 2,
    trigger: 'day_start',
    once: true,
    eligible: (s) => s.day >= 3 && s.regions.river.water !== 'contaminated',
    weight: () => 2.5,
    text: (s) =>
      s.location === 'river'
        ? 'Sáng nay nước suối có màu đục lạ và thoang thoảng mùi hôi. Có gì đó không ổn ở thượng nguồn.'
        : 'Bạn có cảm giác bất an mơ hồ, nhưng không rõ vì sao.',
    passive: (ctx) => {
      const r = ctx.s.regions.river;
      r.water = 'contaminated';
      ctx.flag('contamDays', 7);
      ctx.s.chains.contamination = { status: 'active', step: 0 };
      if (ctx.s.location === 'river') {
        r.waterKnown = true;
        ctx.change('bad', 'Nước suối có thể đã bị ô nhiễm');
        ctx.journal('Nước suối đục và có mùi lạ. Có thể có thứ gì đó làm ô nhiễm ở thượng nguồn.', 'consequence');
      }
    },
  },
  {
    id: 'coconut_fall',
    title: 'Dừa rụng',
    icon: '🥥',
    category: 'resources',
    risk: 1,
    trigger: 'slot_start',
    cooldownDays: 3,
    eligible: (s) => s.location === 'coast',
    weight: () => 2,
    text: () => 'Một cơn gió mạnh làm mấy trái dừa rụng lộp độp ngay cạnh bạn.',
    passive: (ctx) => {
      ctx.addItem('coconut', ctx.rng.int(1, 2));
    },
  },
  {
    id: 'message_bottle',
    title: 'Chai trôi dạt',
    icon: '🍾',
    category: 'narrative',
    risk: 1,
    trigger: 'slot_start',
    once: true,
    notable: true,
    eligible: (s) => s.location === 'coast' && s.day >= 4,
    weight: () => 1.5,
    text: () =>
      'Một chiếc chai thủy tinh bị sóng đánh vào chân bạn. Bên trong là mảnh giấy cũ: “…dòng hải lưu phía tây bắc chảy thẳng về đất liền. Đừng ra khơi khi gió chướng…”',
    passive: (ctx) => {
      const w = ctx.s.world;
      if (w.currents < 3) {
        w.currents++;
        ctx.change('good', `🧭 Hiểu biết hải lưu: ${w.currents}/3`);
      }
    },
    journal: 'Nhặt được chai trôi dạt với lời nhắn về dòng hải lưu phía tây bắc.',
  },

  // ======================= WILDLIFE
  {
    id: 'bush_noise',
    title: 'Tiếng động trong bụi cây',
    icon: '🌿',
    category: 'wildlife',
    risk: 2,
    trigger: 'slot_start',
    notable: true,
    cooldownDays: 2,
    eligible: (s) => s.location === 'jungle' || s.location === 'river',
    weight: () => 4,
    text: () => 'Bụi cây trước mặt rung lên sột soạt. Có thứ gì đó khá lớn đang di chuyển trong đó.',
    choices: (s) => [
      {
        id: 'observe',
        label: 'Quan sát',
        icon: '👁️',
        desc: 'Nấp kín và quan sát. Không tốn thời gian.',
        slots: 0,
        energy: 2,
        check: { label: 'Quan sát động vật', attr: 'PER', skill: 'hunting', dc: 11, outdoor: true },
        resolve: (ctx, tier) => {
          if (isSuccess(tier)) {
            ctx.say('Một con lợn rừng! Bạn ghi nhớ lối mòn và nơi nó hay kiếm ăn.');
            ctx.flag('huntBonusUntil', ctx.now + 8);
            ctx.change('good', 'Săn bắt ở Rừng rậm +2 trong 2 ngày');
            ctx.journal('Phát hiện lối mòn của lợn rừng trong rừng.', 'discovery');
          } else if (tier === 'partial') ctx.say('Chỉ là một con kỳ đà lớn. Nó lững thững bỏ đi.');
          else if (tier === 'failure') ctx.say('Bạn không nhìn rõ được gì, tiếng động xa dần.');
          else {
            ctx.say('Một tiếng rít chói tai vang lên ngay sau lưng làm bạn hoảng hốt bỏ chạy.');
            ctx.addCondition('shaken', 1, 6);
          }
        },
      },
      {
        id: 'approach',
        label: 'Tiếp cận và săn',
        icon: '🔱',
        desc: 'Liều tiếp cận con thú. Có thể được thịt, cũng có thể bị thương.',
        slots: 1,
        energy: 10,
        check: {
          label: 'Săn thú lạ',
          tags: ['hunting'],
          attr: 'AGI',
          skill: 'hunting',
          dc: 14,
          outdoor: true,
          mods: s.inventory.some((x) => x.id === 'spear') ? [{ label: 'Giáo gỗ', value: 2 }] : [{ label: 'Tay không', value: -2 }],
        },
        resolve: (ctx, tier) => {
          if (ctx.s.inventory.some((x) => x.id === 'spear')) ctx.useTool('spear');
          if (tier === 'crit_success') {
            ctx.say('Một cú đâm chuẩn xác! Bạn hạ được con lợn rừng.');
            ctx.addItem('meat_raw', 4);
          } else if (tier === 'success') {
            ctx.say('Bạn hạ được một con lợn rừng nhỏ.');
            ctx.addItem('meat_raw', 2);
          } else if (tier === 'partial') {
            ctx.say('Bạn hạ được con thú, nhưng bị nó húc trúng trước đó.');
            ctx.addItem('meat_raw', 2);
            ctx.addCondition('injury', 1);
          } else if (tier === 'failure') {
            ctx.say('Con lợn rừng lao ra húc bạn ngã rồi chạy mất.');
            ctx.addCondition('injury', 1);
          } else {
            ctx.say('Con lợn rừng điên cuồng lao vào bạn. Bạn bị thương nặng.');
            ctx.addCondition('injury', 2);
          }
          ctx.s.regions[ctx.s.location].wildlifeAlert += 20;
        },
      },
      ignore('Lặng lẽ rút lui', 'Bạn lặng lẽ lùi lại. Cẩn thận vẫn hơn.'),
    ],
  },
  {
    id: 'monkey_thief',
    title: 'Khỉ trộm đồ',
    icon: '🐒',
    category: 'wildlife',
    risk: 1,
    trigger: 'slot_start',
    notable: true,
    cooldownDays: 3,
    eligible: (s) => s.location === 'jungle' && carriedFood(s) > 0,
    weight: () => 3,
    text: () => 'Một con khỉ từ trên cây phóng xuống, giật lấy đồ ăn trong túi bạn rồi chạy biến!',
    choices: () => [
      {
        id: 'chase',
        label: 'Đuổi theo',
        icon: '🏃',
        desc: 'Đuổi theo con khỉ qua rừng rậm.',
        slots: 0,
        energy: 8,
        check: { label: 'Đuổi bắt con khỉ', attr: 'AGI', skill: 'survival', dc: 13, outdoor: true },
        resolve: (ctx, tier) => {
          if (isSuccess(tier)) {
            ctx.say('Bạn dồn được con khỉ vào gốc cây, nó vứt lại đồ ăn.');
            if (tier === 'crit_success') {
              ctx.say('Trên đường quay lại, bạn còn phát hiện mấy buồng chuối chín!');
              ctx.addItem('fruit', 2);
            }
          } else {
            stealFood(ctx);
            if (tier === 'crit_failure') {
              ctx.say('Bạn vấp rễ cây ngã sõng soài.');
              ctx.addCondition('injury', 1);
            } else ctx.say('Con khỉ nhanh hơn bạn nhiều.');
          }
        },
      },
      {
        id: 'let_go',
        label: 'Mặc kệ nó',
        icon: '🤷',
        slots: 0,
        resolve: (ctx) => {
          ctx.say('Bạn tiếc rẻ nhìn con khỉ biến mất trên tán cây.');
          stealFood(ctx);
        },
      },
    ],
  },
  {
    id: 'turtle_nesting',
    title: 'Rùa biển lên bờ',
    icon: '🐢',
    category: 'wildlife',
    risk: 1,
    trigger: 'slot_start',
    notable: true,
    cooldownDays: 3,
    eligible: (s) => s.location === 'coast' && s.slot === 3 && s.regions.coast.found.includes('turtle_beach'),
    weight: (s) => Math.max(0.5, 6 - 2 * Number(s.flags.turtleHarvest ?? 0)),
    text: () => 'Hoàng hôn buông xuống, một con rùa biển lớn chậm chạp bò lên bãi cát và bắt đầu đào ổ đẻ trứng.',
    choices: () => [
      {
        id: 'take_all',
        label: 'Lấy hết trứng',
        icon: '🥚',
        desc: 'Nhiều thức ăn, nhưng rùa sẽ ít quay lại đây hơn.',
        slots: 0,
        resolve: (ctx) => {
          ctx.addItem('eggs', 5);
          ctx.flag('turtleHarvest', Number(ctx.s.flags.turtleHarvest ?? 0) + 1);
          ctx.journal('Lấy hết trứng rùa ở bãi biển. Rùa có lẽ sẽ ít quay lại.', 'consequence');
        },
      },
      {
        id: 'take_some',
        label: 'Lấy vài quả',
        icon: '🥚',
        desc: 'Đủ ăn mà vẫn để lại cho đàn rùa.',
        slots: 0,
        resolve: (ctx) => ctx.addItem('eggs', 2),
      },
      {
        id: 'leave',
        label: 'Ngồi ngắm và để yên',
        icon: '🌅',
        desc: 'Khoảnh khắc bình yên giữa chốn hoang vu.',
        slots: 0,
        resolve: (ctx) => {
          ctx.say('Bạn ngồi lặng lẽ nhìn con rùa hoàn thành công việc rồi bò về biển. Lòng bạn nhẹ nhõm lạ thường.');
          ctx.addCondition('determined', 1, 6);
        },
      },
    ],
  },
  {
    id: 'boar_raid',
    title: 'Thú rừng lục lọi trại',
    icon: '🐗',
    category: 'base',
    risk: 2,
    trigger: 'night',
    notable: true,
    cooldownDays: 2,
    eligible: (s) =>
      !!s.baseRegion &&
      !hasStructure(s, 'fence', s.baseRegion) &&
      s.storage.some((x) => ITEMS[x.id]?.kind === 'food'),
    weight: (s) => (s.baseRegion && hasStructure(s, 'storage_rack', s.baseRegion) ? 1.5 : 4),
    text: (s) =>
      s.location === s.baseRegion
        ? 'Nửa đêm, tiếng sột soạt đánh thức bạn. Một con lợn rừng đang lục kho thức ăn! Bạn vung đuốc xua nó đi kịp lúc.'
        : 'Trong lúc bạn vắng mặt, thú rừng đã mò vào căn cứ và lục tung kho thức ăn.',
    passive: (ctx) => {
      const s = ctx.s;
      const rack = hasStructure(s, 'storage_rack', s.baseRegion!);
      const present = s.location === s.baseRegion;
      const frac = (present ? 0.2 : 0.55) * (rack ? 0.5 : 1);
      let lostAny = false;
      for (const st of s.storage) {
        if (ITEMS[st.id]?.kind !== 'food') continue;
        const n = Math.max(present ? 0 : 1, Math.round(st.qty * frac));
        const take = Math.min(st.qty, n);
        if (take > 0) {
          st.qty -= take;
          lostAny = true;
          ctx.change('loss', `-${take} ${ITEMS[st.id].icon} ${ITEMS[st.id].name}`);
        }
      }
      ctx.prune(s.storage);
      if (lostAny) ctx.journal('Thú rừng phá kho thức ăn. Một hàng rào sẽ giúp bảo vệ căn cứ.', 'consequence');
      return rack ? 'Giá phơi treo cao đã giữ được phần lớn.' : '';
    },
  },

  // ======================= PSYCHOLOGY / HEALTH
  {
    id: 'nightmare',
    title: 'Ác mộng',
    icon: '😱',
    category: 'psychology',
    risk: 1,
    trigger: 'night',
    cooldownDays: 2,
    eligible: (s) => !shelterAt(s, s.location),
    weight: () => 3,
    text: () => 'Bạn mơ thấy mình chìm xuống đáy biển cùng con tàu. Tỉnh dậy giữa đêm, tim đập thình thịch.',
    passive: (ctx) => {
      ctx.addCondition('shaken', 1, 4);
    },
  },
  {
    id: 'starry_night',
    title: 'Bầu trời đầy sao',
    icon: '✨',
    category: 'psychology',
    risk: 1,
    trigger: 'night',
    cooldownDays: 4,
    eligible: (s) => s.world.weather === 'clear' || s.world.weather === 'hot' || s.world.weather === 'breezy',
    weight: (s) => (s.world.pacing === 'calm' ? 4 : 1.5),
    text: () => 'Đêm quang đãng, dải Ngân Hà vắt ngang bầu trời. Bạn nằm nhìn các vì sao, nhẩm tính phương hướng.',
    passive: (ctx) => {
      ctx.grantXp('navigation', 6);
      ctx.vital('energy', 5, 'Tinh thần thư thái');
    },
  },

  // ======================= ESCAPE
  {
    id: 'ship_sighted',
    title: 'Tàu ở đường chân trời!',
    icon: '🚢',
    category: 'escape',
    risk: 1,
    trigger: 'slot_start',
    notable: true,
    text: (s) =>
      `Một con tàu hàng đang chạy ngang qua phía xa, cách bờ vài hải lý. Đây có thể là cơ hội rời đảo — nhưng nó sẽ không đợi bạn.${
        s.location === 'coast' ? ' Từ bãi biển thấp, tín hiệu khó được nhìn thấy hơn.' : ''
      }`,
    journal: 'Một con tàu xuất hiện ở đường chân trời.',
    choices: (s) =>
      signalChoices(s, {
        bonus: 0,
        onPartial: (ctx) => ctx.schedule('ship_closer', 1),
        win: shipWin,
      }),
  },
  {
    id: 'ship_closer',
    title: 'Con tàu chậm lại',
    icon: '🚢',
    category: 'escape',
    risk: 1,
    trigger: 'slot_start',
    text: () => 'Con tàu giảm tốc và chếch mũi về phía đảo. Họ đã thấy gì đó! Đây là cơ hội cuối cùng để khiến họ chắc chắn.',
    choices: (s) =>
      signalChoices(s, {
        bonus: 4,
        onPartial: (ctx) => {
          ctx.say('Con tàu lưỡng lự một lúc lâu… rồi lại tiếp tục hành trình.');
          ctx.journal('Con tàu đã chậm lại nhưng rồi vẫn bỏ đi.', 'escape');
        },
        win: shipWin,
      }),
  },
  {
    id: 'ship_missed',
    title: 'Tiếng còi tàu',
    icon: '📯',
    category: 'escape',
    risk: 1,
    trigger: 'slot_start',
    text: (s) =>
      `Tiếng còi tàu trầm đục vọng lại từ phía biển. Từ ${REGION_DEFS[s.location].name} bạn không thể nhìn ra biển — khi bạn hiểu ra thì đã quá muộn.`,
    journal: 'Một con tàu đi qua khi bạn không ở nơi nhìn ra biển.',
  },
  {
    id: 'plane_overhead',
    title: 'Máy bay!',
    icon: '✈️',
    category: 'escape',
    risk: 1,
    trigger: 'slot_start',
    notable: true,
    cooldownDays: 6,
    eligible: (s) => s.day >= 6 && !['storm', 'rain', 'fog', 'drizzle'].includes(s.world.weather) && s.location !== 'jungle',
    weight: () => 0.5,
    text: () => 'Tiếng động cơ ù ù trên đầu — một chiếc máy bay nhỏ đang bay ngang qua đảo! Nó bay rất nhanh.',
    journal: 'Một chiếc máy bay bay ngang qua đảo.',
    choices: (s) =>
      signalChoices(s, {
        bonus: 0,
        plane: true,
        onPartial: (ctx) => {
          ctx.say('Chiếc máy bay chao cánh một vòng rồi bay đi. Có lẽ họ sẽ báo về đội cứu hộ?');
          ctx.schedule('rescue_search', ctx.rng.int(5, 9));
          ctx.journal('Chiếc máy bay dường như đã thấy tín hiệu. Có thể đội cứu hộ sẽ tới.', 'escape');
        },
        win: ['rescue_plane', 'Được máy bay phát hiện', 'Chiếc thủy phi cơ vòng lại và hạ cánh xuống vùng nước lặng gần bờ. Bạn được cứu!'],
      }),
  },
  {
    id: 'rescue_search',
    title: 'Trực thăng tìm kiếm',
    icon: '🚁',
    category: 'escape',
    risk: 1,
    trigger: 'slot_start',
    text: (s) =>
      REGION_DEFS[s.location].seaView
        ? 'Tiếng cánh quạt phành phạch từ xa — một chiếc trực thăng cứu hộ đang bay dọc bờ biển, tìm kiếm!'
        : 'Bạn nghe tiếng trực thăng phía bờ biển nhưng tán cây che kín bầu trời. Nó bay qua rồi xa dần…',
    choices: (s) =>
      REGION_DEFS[s.location].seaView
        ? signalChoices(s, {
            bonus: 8,
            plane: true,
            onPartial: (ctx) => ctx.say('Trực thăng bay qua mà không dừng lại. Lần này bạn đã lỡ cơ hội.'),
            win: ['rescue_heli', 'Trực thăng cứu hộ', 'Trực thăng hạ dây xuống. Bạn được kéo lên giữa tiếng gió rít — hành trình sinh tồn đã kết thúc.'],
          })
        : [],
  },
];

function stealFood(ctx: Ctx) {
  const foods = ctx.s.inventory.filter((x) => ITEMS[x.id]?.kind === 'food');
  if (!foods.length) return;
  const st = ctx.rng.pick(foods);
  const n = Math.min(st.qty, ctx.rng.int(1, 2));
  ctx.removeItem(st.id, n, 'inv');
}

const STRUCT_NAMES: Record<string, string> = {
  lean_to: 'Lều tạm',
  hut: 'Chòi kiên cố',
  campfire: 'Lửa trại',
  rain_collector: 'Bộ hứng nước mưa',
  storage_rack: 'Giá phơi & kho',
  fence: 'Hàng rào gai',
  signal_pyre: 'Đống lửa tín hiệu',
};

export const EVENTS: Record<string, EventDef> = Object.fromEntries(list.map((e) => [e.id, e]));
export { SLOT_NAMES };
