// The follow-up card of a push-your-luck expedition: go one step deeper, or turn
// back with the bag. Never picked at random — only set by the expedition itself.
import type { EventDef } from './events.js';
import { type Bag, EXPEDITION_BY_ID, bagText, grantBag, resolveStep } from './expeditions.js';

interface StepData {
  exp: string;
  step: number;
  bag: Bag;
}

const read = (data?: Record<string, unknown>) => data as StepData | undefined;

export const EXPEDITION_EVENTS: EventDef[] = [
  {
    id: 'expedition_step',
    title: 'Đi sâu hơn hay quay ra?',
    icon: '⬇️',
    category: 'discovery',
    risk: 2,
    trigger: 'after_action',
    cause: () => 'Bạn đang trong một chuyến thám hiểm — mỗi chặng sâu hơn lại khó hơn',
    text: (_s, data) => {
      const d = read(data);
      const exp = d && EXPEDITION_BY_ID[d.exp];
      if (!d || !exp) return '';
      const next = exp.steps[d.step];
      return `${exp.icon} ${exp.name}: đã qua ${d.step}/${exp.steps.length} chặng.\n🎒 Trong túi: ${bagText(d.bag)}.\n\nChặng tiếp theo — ${next.name}: ${next.text}\nNếu thất bại, bạn đánh rơi một nửa số đồ trong túi (thất bại thảm hại: mất hết) và gặp nguy hiểm. Quay ra bây giờ thì giữ được tất cả.`;
    },
    choices: (s, data) => {
      const d = read(data);
      const exp = d && EXPEDITION_BY_ID[d.exp];
      if (!d || !exp) return [];
      const next = exp.steps[d.step];
      return [
        {
          id: 'push',
          label: `Tiến vào ${next.name}`,
          icon: '⬇️',
          desc: `Chặng ${d.step + 1}/${exp.steps.length}. Đồ quý hơn, nhưng khó hơn.`,
          slots: 0,
          energy: next.energy,
          check: next.check(s),
          resolve: (ctx, tier) => {
            const bag = resolveStep(ctx, exp, d.step, tier, { ...d.bag });
            if (bag) ctx.s.pending = { uid: ctx.nextUid(), eventId: 'expedition_step', data: { exp: exp.id, step: d.step + 1, bag } };
          },
        },
        {
          id: 'stop',
          label: 'Quay ra với những gì đã có',
          icon: '🎒',
          desc: 'An toàn mang toàn bộ đồ trong túi về.',
          slots: 0,
          resolve: (ctx) => {
            ctx.say('Bạn quyết định không liều thêm và quay ra.');
            grantBag(ctx, d.bag);
          },
        },
      ];
    },
  },
];
