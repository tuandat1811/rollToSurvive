// Additional events for run-to-run variety. Many are adapted from the
// "Dùng được" cards of the 350-card proposal, with concrete outcomes.
import { fireSource, isSuccess, snakeBite } from '../engine/common.js';
import { type Ctx, countBoth, hasTag, shelterAt, structuresAt } from '../engine/ctx.js';
import type { GameState, Tier } from '../engine/types.js';
import { REGION_DEFS } from './defs.js';
import type { EventChoice, EventDef } from './events.js';
import { con } from '../engine/consequence.js';

const ignore = (label = 'Bỏ qua', text = 'Bạn quyết định không can dự.'): EventChoice => ({
  id: 'ignore',
  label,
  icon: '↩️',
  slots: 0,
  resolve: (ctx) => ctx.say(text),
});

const at = (...regions: string[]) => (s: GameState) => regions.includes(s.location);
const did = (s: GameState, key: string) => !!s.flags[`done:${key}`];

export const EXTRA_EVENTS: EventDef[] = [
  // ======================= RESOURCES / DISCOVERY
  {
    id: 'bottles_in_sand',
    title: 'Chai lọ trong cát',
    icon: '🍾',
    category: 'resources',
    risk: 1,
    trigger: 'slot_start',
    cooldownDays: 4,
    eligible: at('coast'),
    weight: () => 2,
    text: () => 'Sóng rút để lộ mấy chiếc chai thủy tinh vùi trong cát. Thứ đựng nước quý giá!',
    passive: (ctx) => {
      ctx.addItem('glass_bottle', ctx.rng.chance(0.4) ? 2 : 1);
    },
  },
  {
    id: 'freshwater_seep',
    title: 'Cát ẩm dưới chân',
    icon: '⛲',
    category: 'discovery',
    risk: 1,
    trigger: 'slot_start',
    once: true,
    notable: true,
    eligible: (s) => s.location === 'coast' && s.day >= 2,
    weight: () => 2.5,
    text: () => 'Bạn để ý một vệt cát luôn ẩm ướt dù trời nắng, sát chân vách đá. Có thể bên dưới có mạch nước ngọt!',
    choices: () => [
      {
        id: 'dig',
        label: 'Đào ngay',
        icon: '⛏️',
        desc: 'Đào xem có nước không. Nếu có, bạn có nguồn nước ngay tại Bãi biển.',
        slots: 1,
        energy: 8,
        check: { label: 'Đào tìm nước', attr: 'STR', skill: 'survival', dc: 10, outdoor: true },
        resolve: (ctx, tier) => {
          ctx.findLocation('seep');
          if (isSuccess(tier)) {
            ctx.say('Nước ngọt rỉ ra, trong veo! Từ giờ bạn có thể lấy nước ngay tại Bãi biển.');
            ctx.addItem('water_raw', 2, { risk: 0.06 });
          } else ctx.say('Hố đào sụp liên tục, nhưng đúng là có nước ở dưới. Lần sau quay lại đào tiếp.');
        },
      },
      {
        id: 'mark',
        label: 'Đánh dấu để sau',
        icon: '📍',
        slots: 0,
        resolve: (ctx) => {
          ctx.findLocation('seep');
          ctx.say('Bạn cắm một cành cây đánh dấu chỗ này.');
        },
      },
    ],
  },
  {
    id: 'sharp_stone',
    title: 'Hòn đá sắc cạnh',
    icon: '🪨',
    category: 'resources',
    risk: 1,
    trigger: 'slot_start',
    once: true,
    eligible: at('river', 'mountain'),
    weight: () => 1.5,
    text: (s) =>
      hasTag(s, 'knife')
        ? 'Bạn nhặt được một hòn đá lửa sắc như dao — đánh vào nhau tóe lửa.'
        : 'Một hòn đá vỡ có cạnh sắc như lưỡi dao. Buộc thêm cán là thành dao dùng tạm!',
    passive: (ctx) => {
      if (hasTag(ctx.s, 'knife')) ctx.addItem('flint', 1);
      else ctx.addItem('stone_knife', 1, { durMult: 0.7 });
    },
  },
  {
    id: 'kelp_washup',
    title: 'Rong biển dạt bờ',
    icon: '🥬',
    category: 'resources',
    risk: 1,
    trigger: 'slot_start',
    cooldownDays: 3,
    eligible: at('coast'),
    weight: () => 2,
    text: () => 'Triều rút để lại từng đám rong biển còn tươi, lẫn vài con cua nhỏ bò lổm ngổm.',
    passive: (ctx) => {
      ctx.addItem('kelp', 2);
      if (ctx.rng.chance(0.4)) ctx.addItem('crab', 1);
    },
  },
  {
    id: 'mushrooms_after_rain',
    title: 'Nấm mọc sau mưa',
    icon: '🍄',
    category: 'ecology',
    risk: 1,
    trigger: 'slot_start',
    cooldownDays: 3,
    eligible: (s) => s.location === 'jungle' && s.world.lastRainDay >= s.day - 1,
    weight: () => 3,
    text: () => 'Sau cơn mưa, những cây nấm trắng mọc kín một thân gỗ mục. Ăn được hay không thì… chưa chắc.',
    passive: (ctx) => {
      ctx.addItem('mushroom', ctx.rng.int(2, 3));
    },
  },
  {
    id: 'falling_fruit',
    title: 'Trái chín rụng',
    icon: '🍈',
    category: 'resources',
    risk: 1,
    trigger: 'slot_start',
    cooldownDays: 4,
    eligible: (s) => s.location === 'jungle' && ['breezy', 'windy'].includes(s.world.weather),
    weight: () => 3,
    text: () => 'Gió thổi mạnh làm trái chín rụng lộp độp quanh bạn. Chỉ việc nhặt!',
    passive: (ctx) => {
      ctx.addItem('fruit', ctx.rng.int(2, 4));
    },
  },
  {
    id: 'wild_yams',
    title: 'Dây khoai rừng',
    icon: '🍠',
    category: 'resources',
    risk: 1,
    trigger: 'slot_start',
    cooldownDays: 5,
    eligible: at('jungle'),
    weight: () => 2,
    text: () => 'Bạn nhận ra dây leo của khoai mỡ rừng. Dưới đất chắc chắn có củ — nếu chịu khó đào.',
    choices: () => [
      {
        id: 'dig',
        label: 'Đào củ',
        icon: '⛏️',
        desc: 'Mất một buổi đào bới. Khoai sống dễ gây đau bụng — nên nấu chín.',
        slots: 1,
        energy: 8,
        check: { label: 'Đào khoai', attr: 'STR', skill: 'survival', dc: 10, outdoor: true, tags: ['gather'] },
        resolve: (ctx, tier) => {
          const n = ({ crit_success: 4, success: 3, partial: 1 } as Partial<Record<Tier, number>>)[tier] ?? 0;
          if (n) ctx.addItem('yam', n);
          else ctx.say('Đất cứng như đá, bạn chỉ đào được vài rễ con.');
        },
      },
      ignore('Để sau', 'Bạn nhớ chỗ này, nhưng giờ còn việc khác.'),
    ],
  },
  {
    id: 'lost_cargo',
    title: 'Thùng hàng trôi dạt',
    icon: '📦',
    category: 'resources',
    risk: 2,
    trigger: 'slot_start',
    once: true,
    notable: true,
    eligible: (s) => s.location === 'coast' && s.day >= 3 && s.world.weather !== 'storm',
    weight: () => 1.3,
    text: () => 'Một thùng gỗ niêm phong dập dềnh cách bờ chừng năm chục mét. Hàng từ con tàu của bạn chăng?',
    choices: () => [
      {
        id: 'swim',
        label: 'Bơi ra kéo vào',
        icon: '🏊',
        desc: 'Sóng khá mạnh. Kiệt sức giữa chừng thì nguy.',
        slots: 1,
        energy: 15,
        check: { label: 'Bơi ra lấy thùng hàng', attr: 'STR', skill: 'survival', dc: 13, outdoor: true },
        resolve: (ctx, tier) => {
          if (isSuccess(tier) || tier === 'partial') {
            ctx.addItem('canned', tier === 'partial' ? 1 : 2);
            if (tier !== 'partial') ctx.addItem('rope', 1);
            if (tier === 'crit_success') ctx.addItem(ctx.rng.pick(['compass', 'flare', 'pot', 'first_aid']), 1);
            if (tier === 'partial') {
              ctx.say('Bạn kéo được thùng vào, nhưng bị sóng quật vào đá.');
              ctx.addCondition('injury', 1);
            } else ctx.say('Bạn đẩy thùng hàng vào bờ và cạy nắp. Đồ dùng còn nguyên!');
          } else if (tier === 'failure') {
            ctx.say('Sóng đẩy thùng ra xa. Bạn phải bơi vào trong tiếc nuối.');
            ctx.vital('energy', -10, 'Bơi kiệt sức');
          } else {
            ctx.say('Một con sóng lớn nhấn chìm bạn. Bạn sặc nước, vật lộn mãi mới vào được bờ.');
            ctx.vital('health', -10, 'Suýt chết đuối');
          }
        },
      },
      ignore('Để nó trôi', 'Không đáng liều. Thùng hàng trôi dần ra xa.'),
    ],
  },

  // ======================= WILDLIFE
  {
    id: 'snake_at_spring',
    title: 'Rắn bên dòng suối',
    icon: '🐍',
    category: 'wildlife',
    risk: 2,
    trigger: 'slot_start',
    notable: true,
    cooldownDays: 4,
    eligible: at('river'),
    weight: () => 2.5,
    text: () => 'Một con rắn đầu tam giác nằm cuộn tròn trên tảng đá ngay chỗ bạn hay lấy nước.',
    choices: () => [
      {
        id: 'scare',
        label: 'Ném đá xua đuổi',
        icon: '🪨',
        slots: 0,
        energy: 3,
        check: { label: 'Xua rắn', attr: 'AGI', skill: 'survival', dc: 11, outdoor: true },
        resolve: (ctx, tier) => {
          if (tier === 'crit_success') {
            ctx.say('Hòn đá trúng đầu con rắn. Thêm chút thịt cho bữa tối!');
            ctx.addItem('meat_raw', 1);
          } else if (isSuccess(tier)) ctx.say('Con rắn trườn đi mất vào bụi rậm.');
          else if (tier === 'partial') ctx.say('Con rắn ngóc đầu lên đe dọa rồi mới chịu bỏ đi.');
          else if (tier === 'failure' ? ctx.rng.chance(0.5) : true) snakeBite(ctx);
          else ctx.say('Con rắn lao tới — bạn nhảy lùi kịp lúc.');
        },
      },
      ignore('Lặng lẽ tránh xa', 'Bạn lùi lại thật chậm, đi vòng xuống chỗ khác.'),
    ],
  },
  {
    id: 'bee_hive',
    title: 'Tổ ong rừng',
    icon: '🐝',
    category: 'wildlife',
    risk: 2,
    trigger: 'slot_start',
    notable: true,
    cooldownDays: 6,
    eligible: at('jungle'),
    weight: () => 1.5,
    text: () => 'Tiếng vo ve rộn ràng trong hốc một cây cổ thụ. Một tổ ong rừng — và mật ong!',
    passive: (ctx) => {
      ctx.findLocation('bee_tree');
    },
    choices: (s) => [
      {
        id: 'smoke',
        label: 'Hun khói lấy mật',
        icon: '🔥',
        desc: 'Khói làm ong lừ đừ. Cần nguồn lửa.',
        slots: 1,
        energy: 6,
        reqs: [{ label: 'Có nguồn lửa (lửa trại, đuốc hoặc đá lửa)', met: !!fireSource(s) }],
        check: { label: 'Hun khói lấy mật', attr: 'INT', skill: 'survival', dc: 11, outdoor: true },
        resolve: (ctx, tier) => takeHoney(ctx, tier, { crit_success: 3, success: 2, partial: 1 }),
      },
      {
        id: 'grab',
        label: 'Thò tay lấy mật',
        icon: '✋',
        desc: 'Nhanh tay thì được, chậm thì bị đốt sưng người.',
        slots: 0,
        energy: 4,
        check: { label: 'Lấy mật bằng tay', attr: 'AGI', skill: 'survival', dc: 15, outdoor: true },
        resolve: (ctx, tier) => takeHoney(ctx, tier, { crit_success: 3, success: 2, partial: 1 }),
      },
      ignore('Để yên', 'Bạn ghi nhớ chỗ có tổ ong rồi lặng lẽ đi tiếp.'),
    ],
  },
  {
    id: 'wounded_boar',
    title: 'Vết máu thú',
    icon: '🐗',
    category: 'wildlife',
    risk: 2,
    trigger: 'slot_start',
    notable: true,
    cooldownDays: 5,
    eligible: at('jungle', 'river'),
    weight: () => 1.5,
    text: () => 'Những vệt máu còn tươi trên lá. Một con lợn rừng bị thương — dễ săn hơn, nhưng thú bị dồn đường thì rất liều.',
    choices: () => [
      {
        id: 'track',
        label: 'Lần theo vết máu',
        icon: '👣',
        slots: 1,
        energy: 10,
        check: { label: 'Săn thú bị thương', attr: 'PER', skill: 'hunting', dc: 11, outdoor: true, tags: ['hunting'] },
        resolve: (ctx, tier) => {
          const meat = ({ crit_success: 4, success: 3, partial: 2 } as Partial<Record<Tier, number>>)[tier] ?? 0;
          if (meat) ctx.addItem('meat_raw', meat);
          if (tier === 'partial') {
            ctx.say('Con lợn quay lại húc bạn trước khi gục xuống.');
            ctx.addCondition('injury', 1);
          } else if (tier === 'failure') ctx.say('Vết máu mất hút bên bờ suối.');
          else if (tier === 'crit_failure') {
            ctx.say('Con lợn đực lao ra từ bụi rậm, húc bạn ngã sấp.');
            ctx.addCondition('injury', 2);
          }
        },
      },
      ignore('Tránh xa', 'Thú bị thương rất nguy hiểm. Bạn đi đường khác.'),
    ],
  },
  {
    id: 'stranded_dolphin',
    title: 'Cá heo mắc cạn',
    icon: '🐬',
    category: 'wildlife',
    risk: 1,
    trigger: 'slot_start',
    once: true,
    notable: true,
    eligible: (s) => s.location === 'coast' && s.day >= 2,
    weight: () => 1.2,
    text: () => 'Một chú cá heo con mắc cạn trong vũng nước nông, thở hổn hển. Nếu không ai giúp, nó sẽ chết.',
    choices: () => [
      {
        id: 'push',
        label: 'Đẩy nó về biển',
        icon: '🌊',
        desc: 'Nặng và trơn. Tốn sức, nhưng biết đâu biển sẽ đáp lại.',
        slots: 1,
        energy: 12,
        check: { label: 'Cứu cá heo', attr: 'STR', skill: 'survival', dc: 13, outdoor: true },
        resolve: (ctx, tier) => {
          if (tier === 'failure' || tier === 'crit_failure') {
            ctx.say('Bạn cố hết sức nhưng không đẩy nổi. Chú cá heo dần lịm đi trong vòng tay bạn.');
            ctx.addCondition('shaken', 1, 6);
            ctx.schedule('dolphin_washed', ctx.rng.int(4, 8));
            return;
          }
          ctx.schedule('dolphins_return', ctx.rng.int(16, 28));
          if (tier === 'partial') {
            ctx.say('Bạn đẩy được nó ra biển, nhưng trượt ngã trên đá.');
            ctx.addCondition('injury', 1);
          } else ctx.say('Chú cá heo vẫy đuôi lao ra biển khơi, quay lại nhảy lên một vòng như lời cảm ơn.');
          con(ctx, 'sea_guide');
          con(ctx, 'determined', { slots: 8 });
          ctx.journal('Cứu một chú cá heo mắc cạn. Từ đó, đàn cá heo thường bơi gần bờ.', 'event');
        },
      },
      {
        ...ignore('Quay đi', 'Bạn còn không lo nổi cho mình. Bạn quay đi, cố không nghe tiếng thở yếu ớt phía sau.'),
        resolve: (ctx) => {
          ctx.say('Bạn còn không lo nổi cho mình. Bạn quay đi, cố không nghe tiếng thở yếu ớt phía sau.');
          ctx.schedule('dolphin_washed', ctx.rng.int(4, 8));
        },
      },
    ],
  },
  {
    id: 'wounded_seabird',
    title: 'Chim biển bị thương',
    icon: '🕊️',
    category: 'wildlife',
    risk: 1,
    trigger: 'slot_start',
    cooldownDays: 6,
    eligible: at('coast', 'cape'),
    weight: () => 1.2,
    text: () => 'Một con hải âu gãy cánh nằm thoi thóp trên bãi đá.',
    choices: (s) => [
      {
        id: 'heal',
        label: 'Băng bó cho nó',
        icon: '🩹',
        desc: 'Tốn một băng gạc hoặc thảo dược. Luyện tay nghề y thuật.',
        slots: 0,
        reqs: [{ label: 'Có băng gạc hoặc thảo dược', met: countBoth(s, 'bandage') > 0 || countBoth(s, 'herbs') > 0 }],
        check: { label: 'Chữa cho chim', attr: 'INT', skill: 'medicine', dc: 9, crit: 'safe' },
        resolve: (ctx, tier) => {
          ctx.removeItem(countBoth(ctx.s, 'bandage') > 0 ? 'bandage' : 'herbs', 1);
          if (isSuccess(tier) || tier === 'partial') {
            ctx.say('Con chim nằm yên cho bạn nẹp cánh. Vài hôm sau, nó chập chững bay lên được.');
            ctx.addCondition('determined', 1, 6);
          } else ctx.say('Bạn làm hết sức nhưng con chim không qua khỏi.');
        },
      },
      {
        id: 'eat',
        label: 'Làm thức ăn',
        icon: '🍖',
        slots: 0,
        resolve: (ctx) => {
          ctx.say('Sinh tồn là vậy.');
          ctx.addItem('meat_raw', 1);
        },
      },
      ignore('Để yên'),
    ],
  },

  // ======================= WEATHER / BASE
  {
    id: 'damp_fuel',
    title: 'Củi ẩm',
    icon: '🪵',
    category: 'weather',
    risk: 1,
    trigger: 'day_start',
    cooldownDays: 3,
    eligible: (s) => ['rain', 'drizzle', 'storm'].includes(s.world.weather) || s.world.lastRainDay >= s.day - 1,
    weight: () => 3,
    text: () => 'Hơi ẩm ngấm vào mọi thứ. Củi hôm nay ẩm sì — nhóm lửa sẽ khó hơn (-3).',
    passive: (ctx) => {
      con(ctx, 'damp_fuel');
    },
  },
  {
    id: 'rainbow',
    title: 'Cầu vồng sau mưa',
    icon: '🌈',
    category: 'psychology',
    risk: 1,
    trigger: 'day_start',
    cooldownDays: 4,
    eligible: (s) => ['clear', 'breezy'].includes(s.world.weather) && s.world.lastRainDay === s.day - 1,
    weight: () => 3,
    text: () => 'Một dải cầu vồng vắt ngang hòn đảo sau cơn mưa đêm qua. Bạn thấy lòng nhẹ bẫng.',
    passive: (ctx) => {
      ctx.addCondition('determined', 1, 4);
      ctx.vital('energy', 5, 'Tinh thần phấn chấn');
    },
  },
  {
    id: 'loose_roof',
    title: 'Mái lều lung lay',
    icon: '⛺',
    category: 'base',
    risk: 2,
    trigger: 'slot_start',
    cooldownDays: 3,
    eligible: (s) =>
      s.slot === 3 &&
      !!s.baseRegion &&
      s.location === s.baseRegion &&
      !!shelterAt(s, s.baseRegion) &&
      ['rain', 'storm', 'windy'].includes(s.world.tomorrow),
    weight: () => 4,
    text: () => 'Gió chiều thổi mái lều kêu lật phật. Nếu đêm nay hay ngày mai trời trở xấu, mái che sẽ không trụ nổi.',
    choices: () => [
      {
        id: 'fix',
        label: 'Gia cố mái',
        icon: '🔧',
        desc: 'Tốn 1 gỗ, 2 lá cọ và một buổi.',
        slots: 1,
        energy: 8,
        materials: [
          { id: 'wood', qty: 1 },
          { id: 'palm', qty: 2 },
        ],
        check: { label: 'Gia cố mái', attr: 'STR', skill: 'crafting', dc: 10, crit: 'safe' },
        resolve: (ctx, tier) => {
          const st = structuresAt(ctx.s, ctx.s.baseRegion!).find((x) => x.id === 'lean_to' || x.id === 'hut');
          if (st && (isSuccess(tier) || tier === 'partial')) {
            st.integrity = Math.min(100, st.integrity + (tier === 'partial' ? 10 : 25));
            ctx.change('good', `Mái che chắc chắn hơn (độ bền ${st.integrity}%)`);
          } else ctx.say('Bạn buộc mãi mà dây cứ tuột.');
        },
      },
      ignore('Để mai tính', 'Hy vọng trời thương.'),
    ],
  },

  // ======================= HEALTH
  {
    id: 'twisted_ankle',
    title: 'Hụt chân',
    icon: '🦶',
    category: 'health',
    risk: 2,
    trigger: 'slot_start',
    cooldownDays: 5,
    eligible: at('mountain', 'cape'),
    weight: () => 1.5,
    text: () => 'Một hòn đá lăn dưới chân, bạn trẹo cổ chân. Cơn đau nhói lên mỗi bước đi.',
    choices: () => [
      {
        id: 'rest',
        label: 'Ngồi nghỉ cho đỡ',
        icon: '🪑',
        desc: 'Mất một buổi, nhưng không bị thương.',
        slots: 1,
        resolve: (ctx) => {
          ctx.say('Bạn xoa bóp và nghỉ một lúc. Cơn đau dịu dần.');
          ctx.vital('energy', 8, 'Nghỉ ngơi');
        },
      },
      {
        id: 'push',
        label: 'Cố đi tiếp',
        icon: '🥾',
        slots: 0,
        check: { label: 'Chịu đau đi tiếp', attr: 'END', skill: 'survival', dc: 11 },
        resolve: (ctx, tier) => {
          if (isSuccess(tier)) ctx.say('Bạn nghiến răng bước tiếp — rồi cũng quen.');
          else {
            ctx.say('Cổ chân sưng vù lên.');
            ctx.addCondition('injury', 1);
          }
        },
      },
    ],
  },

  // ======================= NARRATIVE / ESCAPE
  {
    id: 'copper_locket',
    title: 'Mặt dây chuyền đồng',
    icon: '📿',
    category: 'narrative',
    risk: 1,
    trigger: 'slot_start',
    once: true,
    eligible: (s) => s.location === 'coast' && s.day >= 2 && did(s, 'search_wreck'),
    weight: () => 1.5,
    text: () =>
      'Lẫn trong đống mảnh vỡ là một mặt dây chuyền đồng. Bên trong là tấm ảnh nhòe nước của một gia đình đang cười. Bạn chợt nghĩ tới những người đang chờ mình trở về.',
    passive: (ctx) => {
      ctx.addCondition('determined', 1, 8);
    },
    journal: 'Tìm thấy mặt dây chuyền của một hành khách. Phải sống sót trở về.',
  },
  {
    id: 'island_in_distance',
    title: 'Bóng đất liền',
    icon: '🏝️',
    category: 'escape',
    risk: 1,
    trigger: 'slot_start',
    once: true,
    notable: true,
    eligible: (s) => (s.location === 'mountain' || s.location === 'cape') && s.day >= 3 && ['clear', 'breezy'].includes(s.world.weather),
    weight: () => 2,
    text: () => 'Trời trong vắt. Phía tây bắc, sát đường chân trời, hiện lên một dải mờ xanh thẫm — đất liền! Bạn ghi nhớ hướng đó.',
    passive: (ctx) => {
      con(ctx, 'land_sighted');
    },
    journal: 'Nhìn thấy bóng đất liền ở phía tây bắc.',
  },
  {
    id: 'false_beacon',
    title: 'Ánh sáng ngoài khơi',
    icon: '💡',
    category: 'escape',
    risk: 1,
    trigger: 'slot_start',
    once: true,
    eligible: (s) => s.slot === 3 && REGION_DEFS[s.location].seaView && s.day >= 4,
    weight: () => 1.2,
    text: () => 'Lúc chạng vạng, một đốm sáng chớp tắt ngoài khơi xa. Tàu ư? Hay chỉ là ảo giác?',
    choices: (s) => [
      {
        id: 'watch',
        label: 'Quan sát thật kỹ',
        icon: '👁️',
        slots: 0,
        check: { label: 'Nhận định ánh sáng', attr: 'PER', skill: 'navigation', dc: 12 },
        resolve: (ctx, tier) => {
          if (tier === 'crit_success') {
            ctx.say('Đó là đèn một tàu cá đang đi theo tuyến cố định! Giờ bạn biết tàu thường qua lại phía này.');
            ctx.s.world.shipKnown = true;
            ctx.journal('Phát hiện tuyến tàu cá đi ngang qua đảo. Biết được lịch tàu.', 'escape');
          } else if (isSuccess(tier)) ctx.say('Chỉ là ánh trăng phản chiếu trên mỏm đá ngầm. May mà bạn không phí công.');
          else ctx.say('Đốm sáng tắt hẳn trước khi bạn kịp nhận ra đó là gì.');
        },
      },
      {
        id: 'signal',
        label: 'Đốt lửa tín hiệu ngay',
        icon: '🔥',
        desc: 'Nếu đó không phải tàu thì đống lửa coi như bỏ.',
        slots: 0,
        reqs: [
          { label: 'Có đống lửa tín hiệu tại đây', met: structuresAt(s, s.location, 'signal_pyre').length > 0 },
          { label: 'Có nguồn lửa', met: !!fireSource(s) },
        ],
        resolve: (ctx) => {
          ctx.s.structures = ctx.s.structures.filter((x) => !(x.region === ctx.s.location && x.id === 'signal_pyre'));
          ctx.change('loss', '🔥 Đống lửa tín hiệu đã cháy hết');
          ctx.say('Lửa bùng lên rực rỡ… và đốm sáng ngoài khơi vẫn lặng lẽ chớp tắt — chỉ là ánh trăng trên đá ngầm.');
          ctx.addCondition('shaken', 1, 4);
        },
      },
      ignore('Mặc kệ', 'Có lẽ chỉ là ảo giác.'),
    ],
  },
];

function takeHoney(ctx: Ctx, tier: Tier, yields: Partial<Record<Tier, number>>) {
  const n = yields[tier] ?? 0;
  if (n) ctx.addItem('honey', n);
  if (tier === 'partial' || tier === 'failure') {
    ctx.say('Đàn ong nổi giận, bạn bị đốt mấy phát sưng vù.');
    ctx.addCondition('poisoned', 1, 2);
  } else if (tier === 'crit_failure') {
    ctx.say('Cả đàn ong bổ nhào xuống! Bạn chạy trối chết, ngã sõng soài.');
    ctx.addCondition('poisoned', 1, 3);
    ctx.addCondition('injury', 1);
  } else ctx.say('Mật ong vàng óng chảy đầy lá chuối. Ngọt lịm!');
}
