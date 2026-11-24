// Branching event chains: what the player chooses today changes what the island
// throws at them days later. Continuity of the world instead of repeats.
import { carriedFood, isSuccess } from '../engine/common.js';
import { type Ctx, countBoth, hasStructure } from '../engine/ctx.js';
import type { GameState, Tier } from '../engine/types.js';
import type { EventChoice, EventDef } from './events.js';
import { ITEMS } from './items.js';

const ignore = (label: string, text: string, after?: (ctx: Ctx) => void): EventChoice => ({
  id: 'ignore',
  label,
  icon: '↩️',
  slots: 0,
  resolve: (ctx) => {
    ctx.say(text);
    after?.(ctx);
  },
});

const days = (ctx: Ctx, min: number, max: number) => ctx.rng.int(min * 4, max * 4);
const atCampOrJungle = (s: GameState) => s.location === 'jungle' || (!!s.baseRegion && s.location === s.baseRegion);

/** take some food from the base storage (or, without a base, from the backpack) */
function loseFood(ctx: Ctx, frac: number, minOne: boolean): number {
  const s = ctx.s;
  const list = s.baseRegion ? s.storage : s.inventory;
  let lost = 0;
  for (const st of list) {
    if (ITEMS[st.id]?.kind !== 'food') continue;
    const n = Math.min(st.qty, Math.max(minOne ? 1 : 0, Math.round(st.qty * frac)));
    if (n > 0) {
      st.qty -= n;
      lost += n;
      ctx.change('loss', `-${n} ${ITEMS[st.id].icon} ${ITEMS[st.id].name}`);
    }
  }
  ctx.prune(list);
  return lost;
}

export const CHAIN_EVENTS: EventDef[] = [
  // =====================================================================
  // CHAIN 1 — The injured boar
  //   heal → (days later) a friendly boar near camp → guards the camp from raids
  //   leave → tracks around camp → (if ignored) a night raid
  //   kill → the sow turns dangerous: hunting in the jungle gets riskier
  // =====================================================================
  {
    id: 'injured_boar',
    title: 'Lợn rừng mắc bẫy dây leo',
    icon: '🐗',
    category: 'wildlife',
    risk: 2,
    trigger: 'slot_start',
    once: true,
    notable: true,
    eligible: (s) => (s.location === 'jungle' || s.location === 'river') && s.day >= 2,
    weight: () => 2,
    text: () =>
      'Một con lợn rừng non vướng chân vào bụi dây leo gai, máu rỉ ra từ vết cứa. Nó gầm gừ khi thấy bạn nhưng không thoát ra được.',
    choices: (s) => [
      {
        id: 'heal',
        label: 'Gỡ dây và băng vết thương',
        icon: '🩹',
        desc: 'Tốn một băng gạc hoặc thảo dược. Thú rừng có trí nhớ…',
        slots: 1,
        energy: 6,
        reqs: [{ label: 'Có băng gạc hoặc thảo dược', met: countBoth(s, 'bandage') > 0 || countBoth(s, 'herbs') > 0 }],
        check: { label: 'Chữa cho lợn rừng', attr: 'INT', skill: 'medicine', dc: 12, outdoor: true },
        resolve: (ctx, tier) => {
          ctx.removeItem(countBoth(ctx.s, 'bandage') > 0 ? 'bandage' : 'herbs', 1);
          if (isSuccess(tier) || tier === 'partial') {
            ctx.say('Con lợn giãy giụa rồi chạy biến vào rừng, ngoái lại nhìn bạn một lần.');
            if (tier === 'partial') {
              ctx.say('Nó kịp cắn vào tay bạn trước khi chạy.');
              ctx.addCondition('injury', 1);
            }
            ctx.flag('chain_boar', 'healed');
            ctx.schedule('boar_friend_visit', days(ctx, 3, 5));
            ctx.journal('Chữa cho một con lợn rừng mắc bẫy rồi thả nó đi.', 'event');
          } else {
            ctx.say('Con lợn hoảng loạn húc bạn ngã rồi thoát được, máu vẫn chảy. Nó sẽ không quên chuyện này.');
            ctx.addCondition('injury', 1);
            ctx.flag('chain_boar', 'abandoned');
            ctx.schedule('boar_tracks_camp', days(ctx, 2, 4));
          }
        },
      },
      {
        id: 'kill',
        label: 'Kết liễu lấy thịt',
        icon: '🔪',
        desc: 'Thịt tươi — nhưng nó có mẹ.',
        slots: 1,
        energy: 8,
        check: { label: 'Hạ lợn rừng', attr: 'STR', skill: 'hunting', dc: 10, outdoor: true, tags: ['hunting'] },
        resolve: (ctx, tier) => {
          const meat = ({ crit_success: 4, success: 3, partial: 2, failure: 1 } as Partial<Record<Tier, number>>)[tier] ?? 0;
          if (meat) ctx.addItem('meat_raw', meat);
          if (tier === 'crit_failure') ctx.addCondition('injury', 1);
          ctx.say('Từ sâu trong rừng vọng ra tiếng rống giận dữ.');
          ctx.flag('chain_boar', 'killed');
          ctx.schedule('boar_sow_angry', days(ctx, 2, 4));
          ctx.journal('Giết con lợn rừng non mắc bẫy. Có tiếng lợn mẹ rống trong rừng.', 'event');
        },
      },
      ignore('Bỏ đi', 'Không phải việc của bạn. Bạn bỏ đi, sau lưng là tiếng rít đau đớn.', (ctx) => {
        ctx.flag('chain_boar', 'abandoned');
        ctx.schedule('boar_tracks_camp', days(ctx, 2, 4));
      }),
    ],
  },
  {
    id: 'boar_friend_visit',
    title: 'Vị khách quen',
    icon: '🐗',
    category: 'wildlife',
    risk: 1,
    trigger: 'slot_start',
    eligible: atCampOrJungle,
    text: () =>
      'Con lợn rừng bạn từng chữa đứng ở bìa rừng, vết thương đã lành. Nó không bỏ chạy, chỉ khịt khịt mũi nhìn bạn.',
    choices: (s) => [
      {
        id: 'feed',
        label: 'Cho nó ăn',
        icon: '🍌',
        desc: 'Tốn 1 phần thức ăn. Một con lợn rừng quen sẽ xua những con khác khỏi trại.',
        slots: 0,
        reqs: [{ label: 'Có thức ăn mang theo', met: carriedFood(s) > 0 }],
        resolve: (ctx) => {
          const food = ctx.s.inventory.find((x) => ITEMS[x.id]?.kind === 'food');
          if (food) ctx.removeItem(food.id, 1, 'inv');
          ctx.flag('boarFriend');
          ctx.say('Nó ăn ngon lành rồi nằm phục dưới gốc cây gần trại. Từ giờ, đám lợn rừng khác ít dám lại gần.');
          ctx.change('good', '🐗 Có lợn rừng quen canh trại: thú rừng không còn phá kho');
          ctx.addCondition('determined', 1, 6);
          ctx.journal('Con lợn rừng được cứu quay lại và ở gần trại. Nó xua đuổi những con thú khác.', 'event');
        },
      },
      ignore('Xua nó đi', 'Bạn vung tay đuổi. Con lợn ngơ ngác rồi lủi vào rừng.', (ctx) => ctx.flag('chain_boar', 'done')),
    ],
  },
  {
    id: 'boar_tracks_camp',
    title: 'Dấu chân quanh trại',
    icon: '🐾',
    category: 'base',
    risk: 2,
    trigger: 'slot_start',
    eligible: atCampOrJungle,
    text: (s) =>
      `${s.baseRegion ? 'Quanh căn cứ' : 'Quanh chỗ bạn nghỉ'} chi chít dấu chân lợn rừng, đất bị cày xới. Con lợn bị thương hôm trước — giờ nó đói và liều lĩnh.`,
    choices: (s) => [
      {
        id: 'fortify',
        label: 'Rào chắn quanh kho',
        icon: '🚧',
        desc: 'Tốn 3 gỗ, 2 sợi dây leo và một buổi.',
        slots: 1,
        energy: 10,
        materials: [
          { id: 'wood', qty: 3 },
          { id: 'fiber', qty: 2 },
        ],
        check: { label: 'Dựng rào tạm', attr: 'STR', skill: 'crafting', dc: 10, crit: 'safe' },
        resolve: (ctx, tier) => {
          if (isSuccess(tier) || tier === 'partial') {
            ctx.flag('campGuarded', ctx.s.day + 4);
            ctx.say('Hàng rào tạm đủ chắc để một con lợn đói phải bỏ cuộc.');
          } else {
            ctx.say('Rào chắn ọp ẹp, chắc không cản được gì.');
            ctx.schedule('boar_night_raid', 2);
          }
        },
      },
      {
        id: 'trap',
        label: 'Đặt bẫy trên lối mòn',
        icon: '🪤',
        desc: 'Cần một bẫy thú. Có thể bắt được chính nó.',
        slots: 0,
        reqs: [{ label: 'Mang theo bẫy thú', met: countBoth(s, 'snare') > 0 }],
        check: { label: 'Đặt bẫy lợn', attr: 'PER', skill: 'hunting', dc: 12, outdoor: true, tags: ['hunting'] },
        resolve: (ctx, tier) => {
          ctx.removeItem('snare', 1);
          if (isSuccess(tier)) {
            ctx.say('Đêm đó bẫy sập. Sáng ra con lợn nằm gọn trong bẫy.');
            ctx.addItem('meat_raw', 4);
          } else {
            ctx.say('Con lợn giật đứt bẫy rồi tấn công kho đồ.');
            ctx.schedule('boar_night_raid', 2);
          }
        },
      },
      ignore('Mặc kệ', 'Chắc nó chỉ đi ngang qua…', (ctx) => ctx.schedule('boar_night_raid', 2)),
    ],
  },
  {
    id: 'boar_night_raid',
    title: 'Lợn rừng phá trại',
    icon: '🐗',
    category: 'base',
    risk: 2,
    trigger: 'night',
    notable: true,
    text: (s) =>
      hasStructure(s, 'fence', s.baseRegion ?? s.location) || Number(s.flags.campGuarded ?? 0) >= s.day
        ? 'Nửa đêm có tiếng húc rầm rầm vào hàng rào… rồi im bặt. Con lợn đã bỏ cuộc.'
        : 'Nửa đêm, con lợn rừng đói lao vào phá tung kho đồ ăn của bạn.',
    passive: (ctx) => {
      const s = ctx.s;
      if (hasStructure(s, 'fence', s.baseRegion ?? s.location) || Number(s.flags.campGuarded ?? 0) >= s.day) return;
      const lost = loseFood(ctx, 0.5, true);
      if (!lost) ctx.say('May mà trong kho chẳng còn gì đáng giá.');
      ctx.flag('chain_boar', 'done');
      ctx.journal('Con lợn rừng bị bỏ mặc hôm trước quay lại phá kho thức ăn.', 'consequence');
    },
  },
  {
    id: 'boar_sow_angry',
    title: 'Lợn mẹ nổi giận',
    icon: '🐗',
    category: 'wildlife',
    risk: 3,
    trigger: 'slot_start',
    notable: true,
    eligible: (s) => s.location === 'jungle' || s.location === 'river',
    text: () => 'Một con lợn rừng cái khổng lồ chặn ngang lối mòn, hai mắt đỏ ngầu. Nó đã lần theo mùi của bạn.',
    passive: (ctx) => {
      ctx.flag('jungleDangerUntil', ctx.now + 12);
      ctx.change('bad', '⚠️ Rừng nguy hiểm trong 3 ngày: săn bắt khó hơn (-3)');
    },
    choices: (s) => [
      {
        id: 'climb',
        label: 'Trèo lên cây',
        icon: '🌳',
        slots: 0,
        energy: 6,
        check: { label: 'Trèo tránh lợn mẹ', attr: 'AGI', skill: 'survival', dc: 12, outdoor: true },
        resolve: (ctx, tier) => {
          if (isSuccess(tier)) ctx.say('Bạn bám trên cành cao tới khi con lợn bỏ đi.');
          else {
            ctx.say('Bạn trượt chân, con lợn húc trúng chân bạn.');
            ctx.addCondition('injury', tier === 'crit_failure' ? 2 : 1);
          }
        },
      },
      {
        id: 'fight',
        label: 'Đối đầu',
        icon: '🔱',
        desc: s.inventory.some((x) => x.id === 'spear') ? 'Có giáo trong tay.' : 'Tay không đối đầu là liều mạng.',
        slots: 1,
        energy: 14,
        check: {
          label: 'Đối đầu lợn mẹ',
          attr: 'STR',
          skill: 'hunting',
          dc: 15,
          outdoor: true,
          tags: ['hunting'],
          mods: s.inventory.some((x) => x.id === 'spear') ? [{ label: 'Giáo gỗ', value: 2 }] : [{ label: 'Tay không', value: -3 }],
        },
        resolve: (ctx, tier) => {
          if (isSuccess(tier)) {
            ctx.say('Một trận vật lộn sinh tử — và bạn thắng. Rừng đã an toàn trở lại.');
            ctx.addItem('meat_raw', 5);
            ctx.flag('jungleDangerUntil', 0);
          } else {
            ctx.say('Con lợn mẹ quá khỏe. Bạn thoát chết trong gang tấc.');
            ctx.addCondition('injury', tier === 'crit_failure' ? 3 : 2);
          }
        },
      },
      {
        id: 'run',
        label: 'Ném đồ ăn rồi chạy',
        icon: '🏃',
        desc: 'Mất 1–2 phần thức ăn mang theo, nhưng an toàn.',
        slots: 0,
        reqs: [{ label: 'Có thức ăn mang theo', met: carriedFood(s) > 0 }],
        resolve: (ctx) => {
          const foods = ctx.s.inventory.filter((x) => ITEMS[x.id]?.kind === 'food');
          const f = ctx.rng.pick(foods);
          ctx.removeItem(f.id, Math.min(f.qty, 2), 'inv');
          ctx.say('Con lợn dừng lại ngửi đồ ăn. Bạn chạy một mạch không dám ngoái lại.');
        },
      },
    ],
  },

  // =====================================================================
  // CHAIN 2 — The monkey troop
  //   feed → they lead you to food or a hidden spot
  //   chase off → they come back at night to raid your stores
  //   ignore → petty theft becomes more common
  // =====================================================================
  {
    id: 'monkey_troop',
    title: 'Bầy khỉ tò mò',
    icon: '🐒',
    category: 'wildlife',
    risk: 1,
    trigger: 'slot_start',
    once: true,
    notable: true,
    eligible: (s) => s.location === 'jungle' && s.day >= 2,
    weight: () => 2,
    text: () => 'Cả một bầy khỉ kéo đến, đu cành quanh bạn, kêu chí chóe. Con đầu đàn nhìn chằm chằm vào túi đồ của bạn.',
    choices: (s) => [
      {
        id: 'feed',
        label: 'Chia cho chúng ít đồ ăn',
        icon: '🍌',
        desc: 'Tốn 1 phần thức ăn. Có qua có lại?',
        slots: 0,
        reqs: [{ label: 'Có thức ăn mang theo', met: carriedFood(s) > 0 }],
        resolve: (ctx) => {
          const food = ctx.s.inventory.find((x) => ITEMS[x.id]?.kind === 'food');
          if (food) ctx.removeItem(food.id, 1, 'inv');
          ctx.say('Con đầu đàn chộp lấy, rồi cả bầy chuyền cành đi mất, thỉnh thoảng ngoái lại nhìn bạn.');
          ctx.flag('chain_monkey', 'friendly');
          ctx.schedule('monkeys_lead', days(ctx, 2, 4));
        },
      },
      {
        id: 'chase',
        label: 'Xua đuổi',
        icon: '🪵',
        slots: 0,
        energy: 4,
        check: { label: 'Xua bầy khỉ', attr: 'STR', skill: 'survival', dc: 10, outdoor: true },
        resolve: (ctx, tier) => {
          ctx.say(isSuccess(tier) ? 'Bầy khỉ la hét bỏ chạy.' : 'Bầy khỉ chạy đi nhưng ném trả cả trái cây thối vào bạn.');
          ctx.flag('chain_monkey', 'hostile');
          ctx.schedule('monkey_raid', days(ctx, 2, 3));
        },
      },
      ignore('Phớt lờ', 'Bạn mặc kệ chúng. Bầy khỉ theo bạn một đoạn rồi tản đi.', (ctx) => ctx.flag('chain_monkey', 'neutral')),
    ],
  },
  {
    id: 'monkeys_lead',
    title: 'Bầy khỉ dẫn đường',
    icon: '🐒',
    category: 'discovery',
    risk: 1,
    trigger: 'slot_start',
    eligible: (s) => s.location === 'jungle',
    text: () => 'Bầy khỉ hôm trước xuất hiện, kêu inh ỏi rồi chuyền cành về một hướng — như muốn bạn đi theo.',
    passive: (ctx) => {
      const s = ctx.s;
      const next = s.regions.jungle.explorePool.find((x) => x.startsWith('loc:') && x !== 'loc:footprints');
      if (next) ctx.findLocation(next.slice(4));
      else {
        ctx.addItem('fruit', 4);
        if (ctx.rng.chance(0.5)) ctx.addItem('honey', 1);
      }
      ctx.flag('chain_monkey', 'done');
    },
    journal: 'Bầy khỉ từng được cho ăn dẫn bạn tới một nơi mới trong rừng.',
  },
  {
    id: 'monkey_raid',
    title: 'Bầy khỉ báo thù',
    icon: '🐒',
    category: 'base',
    risk: 2,
    trigger: 'night',
    notable: true,
    text: (s) =>
      hasStructure(s, 'fence', s.baseRegion ?? s.location)
        ? 'Đêm qua bầy khỉ kéo đến, nhưng hàng rào gai làm chúng bỏ cuộc.'
        : 'Đêm qua bầy khỉ bị xua đuổi hôm trước kéo đến lục tung đồ ăn của bạn.',
    passive: (ctx) => {
      const s = ctx.s;
      if (hasStructure(s, 'fence', s.baseRegion ?? s.location)) return;
      loseFood(ctx, 0.3, true);
      ctx.flag('chain_monkey', 'done');
      ctx.journal('Bầy khỉ bị xua đuổi quay lại trộm đồ ăn ban đêm.', 'consequence');
    },
  },

  // =====================================================================
  // CHAIN 3 — The stranded dolphin (start: stranded_dolphin in events-extra)
  //   saved → the pod returns: fish, or a lesson about the currents
  //   left/failed → a carcass washes up: meat (risky) or a burial
  // =====================================================================
  {
    id: 'dolphins_return',
    title: 'Đàn cá heo trở lại',
    icon: '🐬',
    category: 'wildlife',
    risk: 1,
    trigger: 'slot_start',
    eligible: (s) => s.location === 'coast' || s.location === 'cape',
    text: () => 'Một đàn cá heo lượn sát bờ, nhảy lên khỏi mặt nước. Một con nhỏ hơn bơi tách ra, quay vòng trước mặt bạn — là nó!',
    choices: () => [
      {
        id: 'fish',
        label: 'Bắt cá theo đàn',
        icon: '🐟',
        desc: 'Đàn cá heo dồn cá vào vùng nước nông.',
        slots: 1,
        energy: 6,
        resolve: (ctx) => {
          ctx.say('Cá bị dồn vào sát bờ, bạn chỉ việc vớt.');
          ctx.addItem('fish_raw', ctx.rng.int(3, 4));
        },
      },
      {
        id: 'follow',
        label: 'Quan sát hướng bơi',
        icon: '🧭',
        desc: 'Cá heo bơi theo dòng hải lưu.',
        slots: 0,
        check: { label: 'Đọc hải lưu theo đàn cá heo', attr: 'PER', skill: 'navigation', dc: 11 },
        resolve: (ctx, tier) => {
          if (isSuccess(tier) && ctx.s.world.currents < 3) {
            ctx.s.world.currents++;
            ctx.change('good', `🧭 Hiểu biết hải lưu: ${ctx.s.world.currents}/3`);
          } else ctx.say('Bạn ngắm đàn cá heo cho tới khi chúng khuất hẳn. Lòng nhẹ nhõm lạ thường.');
          ctx.addCondition('determined', 1, 4);
        },
      },
    ],
  },
  {
    id: 'dolphin_washed',
    title: 'Xác cá heo dạt bờ',
    icon: '🌊',
    category: 'wildlife',
    risk: 1,
    trigger: 'slot_start',
    eligible: (s) => s.location === 'coast',
    text: () => 'Sóng đánh dạt xác chú cá heo hôm trước lên bãi cát. Chim biển đã bắt đầu sà xuống.',
    choices: () => [
      {
        id: 'meat',
        label: 'Xẻ lấy thịt',
        icon: '🔪',
        desc: 'Nhiều thịt, nhưng đã để lâu — dễ ngộ độc.',
        slots: 1,
        energy: 6,
        resolve: (ctx) => {
          ctx.addItem('meat_raw', 3);
          if (ctx.rng.chance(0.3)) {
            ctx.say('Mùi thịt ôi khiến bạn buồn nôn.');
            ctx.addCondition('illness', 1);
          }
        },
      },
      {
        id: 'bury',
        label: 'Chôn nó',
        icon: '🪦',
        slots: 1,
        energy: 6,
        resolve: (ctx) => {
          ctx.say('Bạn đào một hố cát sâu và chôn chú cá heo. Một nỗi buồn khó tả.');
          ctx.removeCondition('shaken', true);
          ctx.addCondition('determined', 1, 4);
        },
      },
    ],
  },
];
