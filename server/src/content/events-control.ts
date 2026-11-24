// Controlled randomness (GDD Diversity-01 §7).
// - Foreshadowing: big threats (camp raid, landslide, cave collapse) never come out of
//   nowhere — an omen event appears first and schedules the threat, leaving the player
//   a slot or two to prepare (secure storage, travel early, shore up the cave…).
// - Recovery: after a run of hardship the Director eases off and offers a way back.
import { con } from '../engine/consequence.js';
import { hasStructure } from '../engine/ctx.js';
import type { GameState } from '../engine/types.js';
import type { EventDef } from './events.js';
import { ITEMS } from './items.js';
import { locationAccessible } from './locationStates.js';

const wet = (s: GameState) => ['rain', 'storm', 'drizzle'].includes(s.world.weather);
const mountainRouteOpen = (s: GameState) =>
  s.routes.some((r) => r.known && r.status === 'open' && (r.id === 'river-mountain' || r.id === 'jungle-mountain'));

export const CONTROL_EVENTS: EventDef[] = [
  // ======================= OMENS (foreshadowing)
  {
    id: 'boar_signs',
    title: 'Dấu vết quanh kho',
    icon: '🐾',
    category: 'base',
    risk: 1,
    trigger: 'slot_start',
    cooldownDays: 3,
    eligible: (s) =>
      !!s.baseRegion &&
      s.location === s.baseRegion &&
      s.slot >= 1 &&
      !s.flags.boarFriend &&
      !hasStructure(s, 'fence', s.baseRegion) &&
      Number(s.flags.campGuarded ?? 0) < s.day &&
      s.storage.some((x) => ITEMS[x.id]?.kind === 'food'),
    weight: (s) => (s.baseRegion && hasStructure(s, 'storage_rack', s.baseRegion) ? 1.5 : 4),
    text: () =>
      'Quanh kho thức ăn, đất bị ủi tung lên thành từng vệt, dấu chân lợn rừng còn mới. Chúng đã đánh hơi thấy mùi đồ ăn — nhiều khả năng đêm nay sẽ quay lại.',
    passive: (ctx) => {
      con(ctx, 'schedule_event', { event: 'boar_raid', slots: 1, window: 6 });
      return 'Có thể “Chằng buộc kho” (nhóm Căn cứ) hoặc ở lại trại tối nay để xua chúng.';
    },
    journal: 'Thấy dấu vết lợn rừng lục lọi quanh kho thức ăn.',
  },
  {
    id: 'ground_cracks',
    title: 'Đất nứt trên sườn dốc',
    icon: '〰️',
    category: 'ecology',
    risk: 1,
    trigger: 'slot_start',
    cooldownDays: 5,
    eligible: (s) => wet(s) && ['jungle', 'river', 'mountain'].includes(s.location) && mountainRouteOpen(s),
    weight: () => 2,
    text: () =>
      'Mưa ngấm làm đất trên sườn dốc nứt thành từng vệt dài, đá vụn lả tả lăn xuống. Nếu mưa còn kéo dài, đường lên núi có thể bị sạt.',
    passive: (ctx) => {
      con(ctx, 'schedule_event', { event: 'landslide', slots: ctx.rng.int(2, 5), window: 8 });
      return 'Nếu cần lên hoặc xuống núi, hãy đi sớm.';
    },
  },
  {
    id: 'rockfall_signs',
    title: 'Vách hang rạn nứt',
    icon: '🕳️',
    category: 'ecology',
    risk: 1,
    trigger: 'slot_start',
    cooldownDays: 6,
    eligible: (s) =>
      s.location === 'mountain' &&
      s.regions.mountain.found.includes('cave') &&
      locationAccessible(s, 'cave') &&
      !s.flags.caveShored &&
      s.world.lastRainDay >= s.day - 1,
    weight: () => 2.5,
    text: () =>
      'Từ vòm cửa hang, đất ướt và đá vụn rơi lộp độp. Những vết nứt mới chạy dọc vách đá phía trên lối vào.',
    passive: (ctx) => {
      ctx.flag('caveOmenUntil', ctx.now + 8);
      con(ctx, 'schedule_event', { event: 'cave_collapse', slots: ctx.rng.int(4, 7), window: 8 });
      return 'Có thể “Chống đỡ cửa hang” bằng gỗ (nhóm Căn cứ) trước khi quá muộn.';
    },
    journal: 'Vách đá trên cửa hang bắt đầu rạn nứt sau mưa.',
  },

  // ======================= RECOVERY OPPORTUNITIES
  {
    id: 'second_wind',
    title: 'Chưa phải lúc bỏ cuộc',
    icon: '🌄',
    category: 'psychology',
    risk: 1,
    trigger: 'day_start',
    cooldownDays: 4,
    weight: (s) => ((s.world.misfortune ?? 0) >= 4 ? 8 : 0),
    text: () =>
      'Sau những ngày tồi tệ, sáng nay bạn tỉnh dậy với một sự bình thản lạ lùng. Bạn nhìn lại những sai lầm vừa qua — và biết mình phải làm gì tiếp theo.',
    passive: (ctx) => {
      con(ctx, 'determined', { slots: 8 });
      con(ctx, 'vital_change', { vital: 'energy', amount: 12, cause: 'Lấy lại tinh thần' });
      con(ctx, 'gain_xp', { skill: 'survival', amount: 6 });
      ctx.s.world.misfortune = Math.max(0, (ctx.s.world.misfortune ?? 0) - 2);
    },
    journal: 'Vượt qua chuỗi ngày tồi tệ, lấy lại tinh thần.',
  },
];
