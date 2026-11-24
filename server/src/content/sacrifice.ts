// Resource sacrifice (Phase C resolution variety): before rolling, the player may
// burn a valuable resource for a bonus on the check — lamp oil on a stubborn fire,
// bait on the hook, extra lashings on a build. One sacrifice per check.
import type { CheckSpec } from '../engine/types.js';

export interface SacrificeDef {
  id: string;
  label: string;
  item: string;
  qty: number;
  bonus: number;
  applies: (actionId: string, spec: CheckSpec) => boolean;
}

const tagged = (tag: string) => (_a: string, spec: CheckSpec) => !!spec.tags?.includes(tag);
const actions = (...ids: string[]) => (a: string) => ids.includes(a);

export const SACRIFICES: SacrificeDef[] = [
  { id: 'oil_fire', label: 'Tưới dầu đèn vào bùi nhùi', item: 'lamp_oil', qty: 1, bonus: 4, applies: tagged('fire') },
  { id: 'resin_fire', label: 'Mồi lửa bằng nhựa cây', item: 'resin', qty: 1, bonus: 2, applies: tagged('fire') },
  { id: 'bait_fish', label: 'Mồi sò ốc', item: 'shellfish', qty: 1, bonus: 2, applies: tagged('fishing') },
  { id: 'bait_hunt', label: 'Mồi thịt sống', item: 'meat_raw', qty: 1, bonus: 2, applies: tagged('hunting') },
  { id: 'rope_climb', label: 'Dùng hẳn một sợi dây thừng', item: 'rope', qty: 1, bonus: 3, applies: tagged('climb') },
  {
    id: 'extra_lashing',
    label: 'Buộc thêm dây cho chắc',
    item: 'fiber',
    qty: 2,
    bonus: 2,
    applies: actions('build', 'craft', 'repair', 'reinforce_shelter', 'build_raft', 'repair_raft', 'shore_up_cave'),
  },
  { id: 'extra_herbs', label: 'Đắp thêm thảo dược', item: 'herbs', qty: 1, bonus: 2, applies: actions('treat') },
];

export const SACRIFICE_BY_ID: Record<string, SacrificeDef> = Object.fromEntries(SACRIFICES.map((x) => [x.id, x]));
