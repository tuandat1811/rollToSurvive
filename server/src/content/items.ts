export type ItemKind = 'food' | 'water' | 'material' | 'tool' | 'medical' | 'special';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  kind: ItemKind;
  weight: number;
  desc: string;
  food?: { hunger: number; thirst?: number; risk?: number; cookTo?: string; smokeTo?: string };
  water?: { thirst: number };
  spoilDays?: number;
  /** durability for tools; undefined = never breaks */
  dur?: number;
  tags?: string[];
  container?: number;
  carryBonus?: number;
}

const defs: ItemDef[] = [
  // ---- materials
  { id: 'wood', name: 'Gỗ', icon: '🪵', kind: 'material', weight: 1.2, desc: 'Gỗ trôi dạt và cành cây. Vật liệu cơ bản nhất.' },
  { id: 'palm', name: 'Lá cọ', icon: '🌿', kind: 'material', weight: 0.3, desc: 'Lá cọ lớn để lợp mái, đan lát.' },
  { id: 'fiber', name: 'Sợi dây leo', icon: '🧵', kind: 'material', weight: 0.2, desc: 'Sợi thực vật dai, dùng để buộc, bện dây.' },
  { id: 'stone', name: 'Đá', icon: '🪨', kind: 'material', weight: 1.2, desc: 'Đá cuội và đá tảng nhỏ.' },
  { id: 'flint', name: 'Đá lửa', icon: '🔸', kind: 'material', weight: 0.3, desc: 'Đánh ra tia lửa — nhóm lửa dễ hơn nhiều. Làm lưỡi dao sắc.' },
  { id: 'resin', name: 'Nhựa cây', icon: '🍯', kind: 'material', weight: 0.2, desc: 'Nhựa dễ cháy, dùng làm đuốc và trét bè.' },
  { id: 'herbs', name: 'Thảo dược', icon: '🌱', kind: 'material', weight: 0.1, desc: 'Lá cây thuốc. Nguyên liệu bào chế thuốc đắp.' },
  { id: 'canvas', name: 'Vải bạt', icon: '🏳️', kind: 'material', weight: 1, desc: 'Vải bạt từ xác tàu. Làm buồm, mái che, hứng nước, băng gạc.' },
  { id: 'rope', name: 'Dây thừng', icon: '🪢', kind: 'material', weight: 0.5, desc: 'Dây chắc chắn. Leo trèo có lợi, cần để đóng bè.', tags: ['rope'] },
  { id: 'scrap', name: 'Mảnh kim loại', icon: '🔩', kind: 'material', weight: 0.5, desc: 'Mảnh kim loại vụn. Làm lưỡi câu, gương tín hiệu.' },
  { id: 'barrel', name: 'Thùng phuy rỗng', icon: '🛢️', kind: 'material', weight: 3, desc: 'Thùng kín nổi tốt — phao tuyệt vời cho bè.' },

  // ---- food
  { id: 'coconut', name: 'Dừa', icon: '🥥', kind: 'food', weight: 1, desc: 'Cùi dừa và nước dừa — nguồn nước sạch ở bãi biển.', food: { hunger: 10, thirst: 12 }, spoilDays: 10 },
  { id: 'fruit', name: 'Trái cây rừng', icon: '🍌', kind: 'food', weight: 0.4, desc: 'Chuối dại, xoài rừng… an toàn để ăn.', food: { hunger: 14, thirst: 3 }, spoilDays: 3 },
  { id: 'berries', name: 'Quả mọng lạ', icon: '🫐', kind: 'food', weight: 0.2, desc: 'Không chắc có an toàn không.', food: { hunger: 10, risk: 0.35 }, spoilDays: 2 },
  { id: 'shellfish', name: 'Sò ốc sống', icon: '🦪', kind: 'food', weight: 0.4, desc: 'Ăn sống dễ bị ngộ độc. Nên nấu chín.', food: { hunger: 8, risk: 0.3, cookTo: 'shellfish_cooked' }, spoilDays: 1 },
  { id: 'shellfish_cooked', name: 'Sò ốc nướng', icon: '🍢', kind: 'food', weight: 0.3, desc: 'Sò ốc đã nướng chín.', food: { hunger: 16 }, spoilDays: 2 },
  { id: 'fish_raw', name: 'Cá sống', icon: '🐟', kind: 'food', weight: 0.8, desc: 'Cá tươi. Ăn sống có rủi ro.', food: { hunger: 9, risk: 0.2, cookTo: 'fish_cooked', smokeTo: 'fish_smoked' }, spoilDays: 1 },
  { id: 'fish_cooked', name: 'Cá nướng', icon: '🍣', kind: 'food', weight: 0.6, desc: 'Cá nướng thơm lừng.', food: { hunger: 24 }, spoilDays: 2 },
  { id: 'fish_smoked', name: 'Cá hun khói', icon: '🐠', kind: 'food', weight: 0.4, desc: 'Cá hun khói giữ được lâu.', food: { hunger: 20 }, spoilDays: 8 },
  { id: 'meat_raw', name: 'Thịt sống', icon: '🥩', kind: 'food', weight: 1, desc: 'Thịt thú rừng. Ăn sống rất rủi ro.', food: { hunger: 10, risk: 0.35, cookTo: 'meat_cooked', smokeTo: 'meat_smoked' }, spoilDays: 1 },
  { id: 'meat_cooked', name: 'Thịt nướng', icon: '🍖', kind: 'food', weight: 0.8, desc: 'Thịt nướng chín, rất no bụng.', food: { hunger: 28 }, spoilDays: 2 },
  { id: 'meat_smoked', name: 'Thịt hun khói', icon: '🥓', kind: 'food', weight: 0.5, desc: 'Thịt hun khói giữ được lâu.', food: { hunger: 25 }, spoilDays: 8 },
  { id: 'eggs', name: 'Trứng', icon: '🥚', kind: 'food', weight: 0.3, desc: 'Trứng chim/rùa. Nên nấu chín.', food: { hunger: 8, risk: 0.15, cookTo: 'eggs_cooked' }, spoilDays: 3 },
  { id: 'eggs_cooked', name: 'Trứng luộc', icon: '🍳', kind: 'food', weight: 0.3, desc: 'Trứng đã nấu chín.', food: { hunger: 14 }, spoilDays: 2 },
  { id: 'canned', name: 'Đồ hộp', icon: '🥫', kind: 'food', weight: 0.5, desc: 'Đồ hộp từ xác tàu. Không bao giờ hỏng.', food: { hunger: 30, thirst: 5 } },
  { id: 'honey', name: 'Mật ong rừng', icon: '🍯', kind: 'food', weight: 0.4, desc: 'Ngọt lịm, rất lâu hỏng. Ăn vào thấy khỏe hẳn.', food: { hunger: 12, thirst: 2 }, spoilDays: 30 },
  { id: 'mushroom', name: 'Nấm rừng', icon: '🍄', kind: 'food', weight: 0.2, desc: 'Mọc sau mưa. Không chắc loại nào ăn được — nấu chín đỡ rủi ro hơn.', food: { hunger: 7, risk: 0.4, cookTo: 'mushroom_cooked' }, spoilDays: 2 },
  { id: 'mushroom_cooked', name: 'Nấm nướng', icon: '🍢', kind: 'food', weight: 0.2, desc: 'Nấm nướng thơm, vẫn còn chút rủi ro.', food: { hunger: 13, risk: 0.15 }, spoilDays: 2 },
  { id: 'kelp', name: 'Rong biển', icon: '🥬', kind: 'food', weight: 0.3, desc: 'Rong biển dạt vào bờ. Ăn được, không no lắm.', food: { hunger: 6, thirst: 2 }, spoilDays: 2 },
  { id: 'yam', name: 'Khoai mỡ rừng', icon: '🍠', kind: 'food', weight: 0.8, desc: 'Củ rừng nhiều tinh bột. Ăn sống dễ ngứa, đau bụng — nên nấu chín.', food: { hunger: 9, risk: 0.25, cookTo: 'yam_cooked' }, spoilDays: 6 },
  { id: 'yam_cooked', name: 'Khoai nướng', icon: '🍠', kind: 'food', weight: 0.7, desc: 'Khoai nướng bùi, rất no.', food: { hunger: 24 }, spoilDays: 3 },
  { id: 'crab', name: 'Cua biển', icon: '🦀', kind: 'food', weight: 0.5, desc: 'Cua bắt ở bãi đá. Nên nấu chín.', food: { hunger: 8, risk: 0.25, cookTo: 'crab_cooked' }, spoilDays: 1 },
  { id: 'crab_cooked', name: 'Cua nướng', icon: '🦀', kind: 'food', weight: 0.4, desc: 'Cua nướng chắc thịt.', food: { hunger: 18 }, spoilDays: 2 },

  // ---- water
  { id: 'water_raw', name: 'Nước chưa xử lý', icon: '💧', kind: 'water', weight: 1, desc: 'Chưa xác định an toàn. Đun sôi trước khi uống.', water: { thirst: 22 } },
  { id: 'water_safe', name: 'Nước sạch', icon: '🫗', kind: 'water', weight: 1, desc: 'Nước an toàn để uống.', water: { thirst: 22 } },

  // ---- tools & equipment
  { id: 'knife', name: 'Dao gấp', icon: '🔪', kind: 'tool', weight: 0.3, desc: 'Con dao thép từ xác tàu. Rất hữu ích.', dur: 40, tags: ['knife'] },
  { id: 'stone_knife', name: 'Dao đá', icon: '🗡️', kind: 'tool', weight: 0.3, desc: 'Lưỡi đá ghè sắc buộc vào cán gỗ.', dur: 12, tags: ['knife'] },
  { id: 'stone_axe', name: 'Rìu đá', icon: '🪓', kind: 'tool', weight: 1.5, desc: 'Chặt gỗ nhanh hơn, dọn đường dễ hơn.', dur: 15, tags: ['axe'] },
  { id: 'spear', name: 'Giáo gỗ', icon: '🔱', kind: 'tool', weight: 1, desc: 'Săn bắt +2, đâm cá +1.', dur: 10, tags: ['spear'] },
  { id: 'fishing_rod', name: 'Cần câu', icon: '🎣', kind: 'tool', weight: 0.8, desc: 'Đánh cá +3.', dur: 15, tags: ['rod'] },
  { id: 'glass_bottle', name: 'Chai thủy tinh', icon: '🍾', kind: 'tool', weight: 0.3, desc: 'Đựng được 1 phần nước.', container: 1 },
  { id: 'gourd', name: 'Quả bầu khô', icon: '🫙', kind: 'tool', weight: 0.4, desc: 'Vỏ bầu khô rỗng ruột, đựng được 2 phần nước.', container: 2 },
  { id: 'compass', name: 'La bàn', icon: '🧭', kind: 'special', weight: 0.2, desc: 'Tìm đường vòng +2; khi ra khơi, chặng tìm đường vào bờ +1.' },
  { id: 'torch', name: 'Đuốc', icon: '🔥', kind: 'tool', weight: 0.5, desc: 'Nguồn lửa mang theo. Đốt lửa tín hiệu ở bất cứ đâu.', dur: 3, tags: ['fire'] },
  { id: 'bottle', name: 'Chai nhựa', icon: '🍶', kind: 'tool', weight: 0.2, desc: 'Đựng được 2 phần nước.', container: 2 },
  { id: 'coconut_cup', name: 'Gáo dừa', icon: '🥣', kind: 'tool', weight: 0.2, desc: 'Đựng được 1 phần nước.', container: 1 },
  { id: 'tin_can', name: 'Lon thiếc', icon: '🥫', kind: 'tool', weight: 0.2, desc: 'Đựng 1 phần nước. Dùng để đun sôi nước.', container: 1, tags: ['pot'] },
  { id: 'pot', name: 'Nồi nhôm', icon: '🍲', kind: 'tool', weight: 1, desc: 'Đựng 3 phần nước. Đun nước, nấu ăn tốt hơn.', container: 3, tags: ['pot'] },
  { id: 'basket', name: 'Giỏ đan', icon: '🧺', kind: 'tool', weight: 0.5, desc: 'Mang thêm được 10 đơn vị khối lượng.', carryBonus: 10 },
  { id: 'signal_mirror', name: 'Gương tín hiệu', icon: '🪞', kind: 'tool', weight: 0.2, desc: 'Phản chiếu ánh nắng để ra hiệu cho tàu, máy bay (cần trời nắng).', tags: ['mirror'] },
  { id: 'flare', name: 'Pháo sáng', icon: '🎆', kind: 'special', weight: 0.3, desc: 'Một phát pháo sáng cứu hộ. Cơ hội vàng khi có tàu.' },
  { id: 'lamp_oil', name: 'Dầu đèn', icon: '🛢️', kind: 'special', weight: 0.8, desc: 'Dầu cũ của hải đăng. Làm lửa tín hiệu sáng rực hơn.' },
  { id: 'chart', name: 'Hải đồ rách', icon: '🗺️', kind: 'special', weight: 0.1, desc: 'Một phần hải đồ khu vực. Định hướng trên biển dễ hơn nhiều.' },
  { id: 'snare', name: 'Bẫy thú', icon: '🪤', kind: 'tool', weight: 0.5, desc: 'Đặt ở rừng, quay lại thu thú vào ngày sau.' },
  { id: 'fish_trap', name: 'Bẫy cá', icon: '🧺', kind: 'tool', weight: 2, desc: 'Đặt ở suối hoặc bãi biển, thu cá vào ngày sau.' },

  // ---- medical
  { id: 'bandage', name: 'Băng gạc', icon: '🩹', kind: 'medical', weight: 0.1, desc: 'Băng bó vết thương, ngăn nhiễm trùng.', tags: ['bandage'] },
  { id: 'first_aid', name: 'Hộp sơ cứu', icon: '⛑️', kind: 'medical', weight: 0.6, desc: 'Chữa mọi loại thương tích có lợi thế. Dùng được 3 lần.', dur: 3, tags: ['first_aid'] },
  { id: 'poultice', name: 'Thuốc đắp thảo dược', icon: '🌿', kind: 'medical', weight: 0.1, desc: 'Chữa nhiễm trùng, ngộ độc, nọc độc.', tags: ['poultice'] },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(defs.map((d) => [d.id, d]));

export function item(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error(`Unknown item ${id}`);
  return d;
}

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}
