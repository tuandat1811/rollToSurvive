// Action-triggered events (GDD Diversity-01 §3 "Event Sources": Action Events) and
// persistent-world events. These fire as a result of what the player just did —
// fishing may snag an old net, gathering in the jungle may reveal a hidden hollow —
// and they change the world through registry consequences (engine/consequence.ts).
import { atLeastPartial, isSuccess } from '../engine/common.js';
import { con } from '../engine/consequence.js';
import { hasTag } from '../engine/ctx.js';
import type { GameState } from '../engine/types.js';
import type { EventChoice, EventDef } from './events.js';
import { locationAccessible } from './locationStates.js';

const ignore = (label = 'Bỏ qua', text = 'Bạn quyết định không can dự.'): EventChoice => ({
  id: 'ignore',
  label,
  icon: '↩️',
  slots: 0,
  resolve: (ctx) => ctx.say(text),
});

const at = (...regions: string[]) => (s: GameState) => regions.includes(s.location);
const found = (s: GameState, region: 'mountain' | 'jungle' | 'river' | 'coast' | 'cape', loc: string) => s.regions[region].found.includes(loc);

export const ACTION_EVENTS: EventDef[] = [
  // ======================= AFTER-ACTION EVENTS
  {
    id: 'strange_rock',
    title: 'Hòn đá lấp lánh',
    icon: '🪨',
    category: 'discovery',
    risk: 1,
    trigger: 'after_action',
    onAction: ['gather', 'explore', 'climb_lookout', 'collect_water'],
    cooldownDays: 5,
    eligible: at('mountain', 'river'),
    weight: () => 2,
    text: () => 'Giữa đống đá vụn, một hòn đá có vân đen bóng lấp lánh dưới nắng — trông giống đá lửa, nhưng lớn hơn hẳn những viên bạn từng thấy.',
    choices: () => [
      {
        id: 'crack',
        label: 'Đập tách ra',
        icon: '🔨',
        desc: 'Dùng đá khác đập để lấy các mảnh sắc bên trong.',
        slots: 0,
        energy: 4,
        check: { label: 'Đập tách đá', attr: 'STR', skill: 'crafting', dc: 10, outdoor: true },
        resolve: (ctx, tier) => {
          if (atLeastPartial(tier)) {
            ctx.say('Hòn đá tách làm đôi, lộ ra những mảnh đá lửa sắc lẹm.');
            con(ctx, 'gain_item', { item: 'flint', qty: tier === 'crit_success' ? 3 : isSuccess(tier) ? 2 : 1 });
          } else {
            ctx.say('Hòn đá vỡ vụn thành bột — chẳng còn mảnh nào dùng được.');
            if (tier === 'crit_failure') con(ctx, 'injury', { sev: 1 });
          }
        },
      },
      {
        id: 'study',
        label: 'Quan sát mạch đá',
        icon: '🔍',
        desc: 'Xem hòn đá từ đâu lăn xuống — có thể còn cả một mạch đá như vậy.',
        slots: 1,
        check: { label: 'Quan sát mạch đá', attr: 'INT', skill: 'survival', dc: 12, outdoor: true },
        resolve: (ctx, tier) => {
          if (isSuccess(tier)) {
            ctx.say('Lần theo vệt đá, bạn tìm được chỗ mạch đá lửa lộ ra trên vách.');
            con(ctx, 'gain_item', { item: 'flint', qty: 2 });
            con(ctx, 'gain_xp', { skill: 'crafting', amount: 8 });
            if (!found(ctx.s, 'river', 'flint_bed') && ctx.s.regions.river.explorePool.includes('loc:flint_bed'))
              con(ctx, 'discover_location', { loc: 'flint_bed' });
          } else {
            ctx.say('Bạn mất cả buổi mà không tìm ra hòn đá từ đâu tới. Ít nhất nó vẫn dùng được.');
            con(ctx, 'gain_item', { item: 'flint', qty: 1 });
          }
        },
      },
      ignore(),
    ],
  },
  {
    id: 'human_footprints',
    title: 'Dấu chân người!',
    icon: '👣',
    category: 'narrative',
    risk: 1,
    trigger: 'after_action',
    onAction: ['forage', 'gather', 'hunt', 'explore'],
    once: true,
    notable: true,
    eligible: (s) => s.location === 'jungle' && s.regions.jungle.explorePool.includes('loc:footprints'),
    weight: () => 3,
    text: () => 'Bạn khựng lại. Trên nền đất ẩm là một dấu chân người — đã cũ, nhưng chắc chắn không phải của bạn. Một hàng dấu chân dẫn sâu vào rừng.',
    passive: (ctx) => {
      con(ctx, 'discover_location', { loc: 'footprints' });
      return 'Bạn có thể lần theo dấu chân này (nhóm Khám phá).';
    },
    journal: 'Phát hiện dấu chân người cũ trong rừng — có ai đó từng ở trên đảo.',
  },
  {
    id: 'net_snag',
    title: 'Mắc phải lưới cũ',
    icon: '🕸️',
    category: 'resources',
    risk: 1,
    trigger: 'after_action',
    onAction: ['fish'],
    cooldownDays: 4,
    eligible: at('coast', 'river', 'cape'),
    weight: () => 2,
    text: () => 'Dây câu của bạn mắc vào thứ gì đó nặng trịch dưới nước: một tấm lưới đánh cá cũ, rong rêu bám đầy, vẫn còn vài con cá mắc bên trong.',
    choices: (s) => [
      {
        id: 'pull',
        label: 'Kéo cả tấm lưới lên',
        icon: '💪',
        desc: 'Lưới còn dùng được làm dây. Nhưng kéo mạnh có thể làm hỏng cần câu.',
        slots: 0,
        energy: 6,
        check: { label: 'Kéo lưới', attr: 'STR', skill: 'fishing', dc: 11, outdoor: true },
        resolve: (ctx, tier) => {
          if (atLeastPartial(tier)) {
            ctx.say('Tấm lưới nặng nề trồi lên khỏi mặt nước.');
            con(ctx, 'gain_item', { item: 'fish_raw', qty: tier === 'crit_success' ? 3 : isSuccess(tier) ? 2 : 1 });
            con(ctx, 'gain_item', { item: 'rope', qty: 1 });
            if (isSuccess(tier)) con(ctx, 'gain_item', { item: 'fiber', qty: 2 });
          } else {
            ctx.say('Lưới mắc vào đá ngầm, kéo mãi không lên. Dây câu căng như sắp đứt.');
            con(ctx, 'tool_wear', { tag: 'rod', wear: tier === 'crit_failure' ? 6 : 2 });
          }
        },
      },
      {
        id: 'cut',
        label: 'Cắt lấy phần lưới',
        icon: '🔪',
        desc: 'Cắt lấy phần lưới còn tốt và mấy con cá — an toàn, không cần sức.',
        slots: 0,
        reqs: [{ label: 'Cần dao', met: hasTag(s, 'knife') }],
        resolve: (ctx) => {
          ctx.say('Bạn cắt lấy một đoạn lưới và gỡ mấy con cá còn mắc lại.');
          con(ctx, 'tool_wear', { tag: 'knife', wear: 1 });
          con(ctx, 'gain_item', { item: 'fish_raw', qty: 1 });
          con(ctx, 'gain_item', { item: 'fiber', qty: 2 });
        },
      },
      ignore('Cắt dây bỏ đi', 'Bạn cắt dây câu, để tấm lưới chìm lại xuống đáy.'),
    ],
  },
  {
    id: 'hidden_hollow',
    title: 'Hốc cây bí ẩn',
    icon: '🌳',
    category: 'discovery',
    risk: 1,
    trigger: 'after_action',
    onAction: ['gather', 'forage', 'search_herbs'],
    once: true,
    notable: true,
    eligible: (s) => s.location === 'jungle' && s.day >= 3,
    weight: () => 2,
    text: () => 'Khi kéo một dây leo, lớp vỏ cây mục bong ra để lộ một hốc cây — bên trong có một gói vải dầu được buộc cẩn thận. Ai đó đã cất giấu nó ở đây.',
    passive: (ctx) => {
      con(ctx, 'spawn_object', { kind: 'old_cache', region: 'jungle' });
      return 'Gói đồ vẫn nằm đó — bạn có thể mở nó bất cứ lúc nào khi ở Rừng rậm.';
    },
    journal: 'Phát hiện một gói đồ được giấu trong hốc cây ở rừng.',
  },
  {
    id: 'bird_nest',
    title: 'Tổ chim trên mỏm đá',
    icon: '🪺',
    category: 'wildlife',
    risk: 2,
    trigger: 'after_action',
    onAction: ['climb_lookout', 'gather', 'explore', 'forage'],
    cooldownDays: 3,
    eligible: at('mountain', 'cape', 'coast'),
    weight: (s) => (s.location === 'mountain' ? 2 : 1),
    text: () => 'Bạn trông thấy một tổ chim biển đầy trứng trên một mỏm đá chênh vênh. Chim bố mẹ đang lượn vòng phía trên, kêu inh ỏi.',
    choices: () => [
      {
        id: 'climb',
        label: 'Trèo lên lấy trứng',
        icon: '🧗',
        desc: 'Mỏm đá trơn trượt và chim bố mẹ sẽ không để yên.',
        slots: 0,
        energy: 6,
        check: { label: 'Trèo lấy trứng', attr: 'AGI', skill: 'survival', dc: 12, outdoor: true, tags: ['climb'] },
        resolve: (ctx, tier) => {
          if (atLeastPartial(tier)) {
            ctx.say(isSuccess(tier) ? 'Bạn nhanh tay lấy trứng và tụt xuống trước khi chim kịp lao tới.' : 'Bạn lấy được ít trứng, nhưng bị chim mổ mấy cái vào tay.');
            con(ctx, 'gain_item', { item: 'eggs', qty: tier === 'crit_success' ? 4 : isSuccess(tier) ? 3 : 1 });
            if (tier === 'partial') con(ctx, 'vital_change', { vital: 'health', amount: -2, cause: 'Bị chim mổ' });
          } else {
            ctx.say('Chân bạn trượt trên đá ướt!');
            con(ctx, 'vital_change', { vital: 'health', amount: tier === 'crit_failure' ? -8 : -3, cause: 'Trượt ngã khi trèo đá' });
            if (tier === 'crit_failure') con(ctx, 'injury', { sev: 1 });
            else con(ctx, 'shaken', { slots: 3 });
          }
        },
      },
      ignore('Để yên tổ chim', 'Bạn để đàn chim yên ổn. Có lẽ đó là quyết định khôn ngoan.'),
    ],
  },

  // ======================= PERSISTENT-WORLD EVENTS
  {
    id: 'cave_collapse',
    title: 'Sạt lở cửa hang',
    icon: '🕳️',
    category: 'ecology',
    risk: 3,
    trigger: 'day_start',
    notable: true,
    cooldownDays: 6,
    eligible: (s) =>
      s.day >= 3 && found(s, 'mountain', 'cave') && locationAccessible(s, 'cave') && s.world.lastRainDay >= s.day - 1,
    weight: (s) => (s.world.weather === 'storm' ? 4 : s.world.weather === 'rain' ? 2 : 1),
    text: (s) =>
      `Sau trận mưa, đất đá trên núi trở nên lỏng lẻo. ${s.location === 'mountain' ? 'Bạn nghe một tiếng ầm vang: ' : 'Tin xấu: '}cửa hang đá đã bị sạt lở, đất đá lấp kín lối vào.`,
    passive: (ctx) => {
      con(ctx, 'location_state', { loc: 'cave', state: 'collapsed' });
      return 'Không thể trú trong hang cho tới khi dọn lối vào (Núi đá → Khám phá).';
    },
  },
];
