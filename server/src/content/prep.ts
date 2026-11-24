// Preparation (Phase C resolution variety): spending time beforehand to gain an edge.
// A preparation action sets a token for a check tag; the next check carrying that tag
// is rolled with advantage (2d20, keep the higher) and the token is used up.
import type { GameState, RegionId } from '../engine/types.js';

export interface PrepDef {
  tag: string;
  /** action name */
  name: string;
  icon: string;
  desc: string;
  /** label shown on the check once prepared */
  label: string;
  regions: RegionId[];
  energy: number;
  /** how long the preparation stays useful */
  slots: number;
}

export const PREPS: PrepDef[] = [
  {
    tag: 'hunting',
    name: 'Theo dõi lối mòn thú',
    icon: '👣',
    desc: 'Dành một buổi rình xem thú đi lối nào, ăn ở đâu, uống nước giờ nào. Lần săn bắt tiếp theo sẽ có lợi thế.',
    label: 'Đã theo dõi lối mòn thú',
    regions: ['jungle'],
    energy: 6,
    slots: 8,
  },
  {
    tag: 'fishing',
    name: 'Bắt mồi, dò chỗ cá',
    icon: '🪱',
    desc: 'Đào giun, bắt mồi và quan sát chỗ cá hay tụ. Lần đánh cá tiếp theo sẽ có lợi thế.',
    label: 'Đã chuẩn bị mồi và chỗ câu',
    regions: ['coast', 'river'],
    energy: 4,
    slots: 8,
  },
  {
    tag: 'climb',
    name: 'Khảo sát đường leo',
    icon: '🧗',
    desc: 'Đi quanh chân vách, tìm chỗ bám chắc và đường lui. Lần leo trèo tiếp theo sẽ có lợi thế.',
    label: 'Đã khảo sát đường leo',
    regions: ['mountain', 'coast', 'cape'],
    energy: 3,
    slots: 8,
  },
];

export const PREP_BY_TAG: Record<string, PrepDef> = Object.fromEntries(PREPS.map((p) => [p.tag, p]));

export const prepFlag = (tag: string) => `prep:${tag}`;

/** the active preparation that applies to a check with these tags, if any */
export function activePrep(s: GameState, tags: string[] | undefined, now: number): PrepDef | undefined {
  for (const t of tags ?? []) {
    const until = Number(s.flags[prepFlag(t)] ?? -1);
    if (until >= now && PREP_BY_TAG[t]) return PREP_BY_TAG[t];
  }
  return undefined;
}
