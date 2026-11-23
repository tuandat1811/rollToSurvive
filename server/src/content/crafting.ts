import type { AttrId, GameState, RegionId, SkillId } from '../engine/types.js';

export interface RecipeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  output: { id: string; qty: number };
  inputs: { id: string; qty: number }[];
  /** at least one carried tool with this tag is required (not consumed) */
  tool?: string;
  attr: AttrId;
  skill: SkillId;
  dc: number;
  unlocked?: (s: GameState) => boolean;
  lockText?: string;
}

export const RECIPES: RecipeDef[] = [
  {
    id: 'stone_knife', name: 'Dao đá', icon: '🗡️', desc: 'Ghè đá thành lưỡi sắc. Mở khóa nhiều công thức cần dao.',
    output: { id: 'stone_knife', qty: 1 }, inputs: [{ id: 'stone', qty: 2 }, { id: 'fiber', qty: 1 }],
    attr: 'INT', skill: 'crafting', dc: 9,
  },
  {
    id: 'stone_axe', name: 'Rìu đá', icon: '🪓', desc: 'Thu thập gỗ nhiều hơn, tốn ít sức hơn; dọn cây đổ dễ dàng.',
    output: { id: 'stone_axe', qty: 1 }, inputs: [{ id: 'stone', qty: 2 }, { id: 'wood', qty: 1 }, { id: 'fiber', qty: 2 }],
    attr: 'INT', skill: 'crafting', dc: 11,
  },
  {
    id: 'spear', name: 'Giáo gỗ', icon: '🔱', desc: 'Săn bắt +2, đâm cá +1.',
    output: { id: 'spear', qty: 1 }, inputs: [{ id: 'wood', qty: 2 }, { id: 'fiber', qty: 1 }], tool: 'knife',
    attr: 'INT', skill: 'crafting', dc: 10,
  },
  {
    id: 'fishing_rod', name: 'Cần câu', icon: '🎣', desc: 'Đánh cá +3. Lưỡi câu làm từ mảnh kim loại.',
    output: { id: 'fishing_rod', qty: 1 }, inputs: [{ id: 'wood', qty: 1 }, { id: 'fiber', qty: 3 }, { id: 'scrap', qty: 1 }], tool: 'knife',
    attr: 'INT', skill: 'crafting', dc: 12,
  },
  {
    id: 'rope', name: 'Dây thừng', icon: '🪢', desc: 'Bện sợi dây leo thành dây thừng chắc chắn.',
    output: { id: 'rope', qty: 1 }, inputs: [{ id: 'fiber', qty: 4 }],
    attr: 'AGI', skill: 'crafting', dc: 9,
  },
  {
    id: 'coconut_cup', name: 'Gáo dừa', icon: '🥣', desc: 'Đựng thêm 1 phần nước. (Ăn luôn phần cùi dừa.)',
    output: { id: 'coconut_cup', qty: 1 }, inputs: [{ id: 'coconut', qty: 1 }], tool: 'knife',
    attr: 'INT', skill: 'crafting', dc: 7,
  },
  {
    id: 'basket', name: 'Giỏ đan', icon: '🧺', desc: 'Mang thêm 10 đơn vị khối lượng.',
    output: { id: 'basket', qty: 1 }, inputs: [{ id: 'fiber', qty: 5 }, { id: 'palm', qty: 2 }],
    attr: 'AGI', skill: 'crafting', dc: 11,
  },
  {
    id: 'bandage', name: 'Băng gạc', icon: '🩹', desc: 'Xé vải bạt làm 2 cuộn băng.',
    output: { id: 'bandage', qty: 2 }, inputs: [{ id: 'canvas', qty: 1 }],
    attr: 'INT', skill: 'medicine', dc: 7,
  },
  {
    id: 'torch', name: 'Đuốc', icon: '🔥', desc: 'Nguồn lửa mang theo (dùng 3 lần), đốt lửa tín hiệu khi cần.',
    output: { id: 'torch', qty: 1 }, inputs: [{ id: 'wood', qty: 1 }, { id: 'resin', qty: 1 }],
    attr: 'INT', skill: 'survival', dc: 8,
  },
  {
    id: 'signal_mirror', name: 'Gương tín hiệu', icon: '🪞', desc: 'Mài mảnh kim loại thành gương — ra hiệu cho tàu khi trời nắng.',
    output: { id: 'signal_mirror', qty: 1 }, inputs: [{ id: 'scrap', qty: 1 }, { id: 'stone', qty: 1 }],
    attr: 'INT', skill: 'crafting', dc: 12,
  },
  {
    id: 'snare', name: 'Bẫy thú', icon: '🪤', desc: 'Đặt ở rừng để bắt thú nhỏ mà không cần đi săn.',
    output: { id: 'snare', qty: 1 }, inputs: [{ id: 'fiber', qty: 3 }, { id: 'wood', qty: 1 }],
    attr: 'INT', skill: 'hunting', dc: 10,
    unlocked: (s) => s.skills.hunting.lvl >= 1 || !!s.flags.know_traps, lockText: 'Cần Săn bắt cấp 1',
  },
  {
    id: 'fish_trap', name: 'Bẫy cá', icon: '🧺', desc: 'Lờ đan đặt ở suối hoặc biển, thu cá vào ngày hôm sau.',
    output: { id: 'fish_trap', qty: 1 }, inputs: [{ id: 'wood', qty: 3 }, { id: 'fiber', qty: 4 }],
    attr: 'INT', skill: 'fishing', dc: 11,
    unlocked: (s) => s.skills.fishing.lvl >= 1 || !!s.flags.know_traps, lockText: 'Cần Đánh cá cấp 1',
  },
  {
    id: 'poultice', name: 'Thuốc đắp thảo dược', icon: '🌿', desc: 'Giã thảo dược làm thuốc: chữa nhiễm trùng, ngộ độc, nọc độc.',
    output: { id: 'poultice', qty: 1 }, inputs: [{ id: 'herbs', qty: 2 }],
    attr: 'INT', skill: 'medicine', dc: 10,
    unlocked: (s) => s.skills.medicine.lvl >= 1 || !!s.flags.know_herbs, lockText: 'Cần Y thuật cấp 1',
  },
];

export interface StructureDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  inputs: { id: string; qty: number }[];
  attr: AttrId;
  skill: SkillId;
  dc: number;
  /** base: only at the base region (first shelter founds the base); signal: any sea-view region */
  where: 'shelter' | 'base' | 'signal';
  energy: number;
  unlocked?: (s: GameState) => boolean;
  lockText?: string;
  requires?: string; // another structure at the same region
  replaces?: string;
}

export const STRUCTURES: StructureDef[] = [
  {
    id: 'lean_to', name: 'Lều tạm', icon: '⛺', where: 'shelter', energy: 14,
    desc: 'Mái che đơn sơ. Lập căn cứ tại đây, ngủ đêm hồi phục tốt hơn, tránh mưa.',
    inputs: [{ id: 'wood', qty: 4 }, { id: 'palm', qty: 5 }, { id: 'fiber', qty: 2 }],
    attr: 'STR', skill: 'crafting', dc: 9,
  },
  {
    id: 'hut', name: 'Chòi kiên cố', icon: '🛖', where: 'base', energy: 20, requires: 'lean_to', replaces: 'lean_to',
    desc: 'Nơi trú chắc chắn: hồi phục rất tốt, chịu bão tốt hơn.',
    inputs: [{ id: 'wood', qty: 8 }, { id: 'palm', qty: 8 }, { id: 'rope', qty: 2 }],
    attr: 'STR', skill: 'crafting', dc: 13,
    unlocked: (s) => s.skills.crafting.lvl >= 2, lockText: 'Cần Chế tạo cấp 2',
  },
  {
    id: 'campfire', name: 'Lửa trại', icon: '🔥', where: 'base', energy: 6,
    desc: 'Nấu ăn, đun nước, sưởi ấm và xua thú. Mưa bão có thể làm tắt lửa.',
    inputs: [{ id: 'wood', qty: 3 }],
    attr: 'INT', skill: 'survival', dc: 13,
  },
  {
    id: 'rain_collector', name: 'Bộ hứng nước mưa', icon: '🪣', where: 'base', energy: 10,
    desc: 'Tự động hứng nước sạch vào kho mỗi ngày mưa (chứa tối đa 6 phần).',
    inputs: [{ id: 'wood', qty: 3 }, { id: 'palm', qty: 4 }, { id: 'fiber', qty: 2 }],
    attr: 'INT', skill: 'crafting', dc: 10,
  },
  {
    id: 'storage_rack', name: 'Giá phơi & kho', icon: '🗄️', where: 'base', energy: 12,
    desc: 'Đồ ăn trong kho hỏng chậm gấp đôi, ít bị thú lục lọi. Cho phép hun khói.',
    inputs: [{ id: 'wood', qty: 5 }, { id: 'fiber', qty: 3 }, { id: 'palm', qty: 2 }],
    attr: 'INT', skill: 'crafting', dc: 11,
  },
  {
    id: 'fence', name: 'Hàng rào gai', icon: '🚧', where: 'base', energy: 16,
    desc: 'Bảo vệ căn cứ khỏi thú rừng ban đêm.',
    inputs: [{ id: 'wood', qty: 7 }, { id: 'fiber', qty: 3 }],
    attr: 'STR', skill: 'crafting', dc: 11,
  },
  {
    id: 'signal_pyre', name: 'Đống lửa tín hiệu', icon: '🔥', where: 'signal', energy: 12,
    desc: 'Đống củi lớn sẵn sàng đốt khi có tàu. Xây ở nơi nhìn ra biển; Mũi Hải Đăng là tốt nhất.',
    inputs: [{ id: 'wood', qty: 6 }, { id: 'palm', qty: 4 }],
    attr: 'STR', skill: 'survival', dc: 9,
  },
];

export interface RaftStage {
  name: string;
  desc: string;
  inputs: { id: string; qty: number }[];
  alt?: { id: string; qty: number }[];
  altLabel?: string;
  attr: AttrId;
  dc: number;
  energy: number;
}

export const RAFT_STAGES: RaftStage[] = [
  {
    name: 'Khung bè', desc: 'Buộc các thân gỗ thành khung bè thô. Sau bước này đã có thể liều ra khơi.',
    inputs: [{ id: 'wood', qty: 10 }, { id: 'rope', qty: 3 }], attr: 'STR', dc: 13, energy: 20,
  },
  {
    name: 'Phao nổi', desc: 'Gắn phao giúp bè nổi cao, chịu sóng tốt hơn.',
    inputs: [{ id: 'barrel', qty: 2 }, { id: 'rope', qty: 1 }],
    alt: [{ id: 'wood', qty: 6 }, { id: 'resin', qty: 2 }, { id: 'fiber', qty: 4 }],
    altLabel: 'Bó gỗ trét nhựa thay thùng phuy',
    attr: 'INT', dc: 12, energy: 16,
  },
  {
    name: 'Buồm & mái chèo', desc: 'Cánh buồm giúp đi xa và chủ động hướng đi.',
    inputs: [{ id: 'canvas', qty: 2 }, { id: 'wood', qty: 2 }, { id: 'rope', qty: 2 }],
    attr: 'INT', dc: 13, energy: 16,
  },
];

export const RAFT_REGION: RegionId = 'coast';
