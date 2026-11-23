import type { AttrId, RegionId, SkillId } from '../engine/types.js';

export const SLOT_NAMES = ['Sáng', 'Trưa', 'Chiều', 'Tối'];

export const ATTR_DEFS: Record<AttrId, { name: string; short: string; desc: string }> = {
  STR: { name: 'Sức mạnh', short: 'STR', desc: 'Mang vác, chặt gỗ, dựng công trình, vượt sóng.' },
  AGI: { name: 'Nhanh nhẹn', short: 'AGI', desc: 'Leo trèo, săn bắt, đánh cá, né tránh nguy hiểm.' },
  END: { name: 'Sức bền', short: 'END', desc: 'Chịu đựng gian khổ, lao động dài, sống sót trên biển.' },
  INT: { name: 'Trí tuệ', short: 'INT', desc: 'Chế tạo, chữa trị, nhóm lửa, tính toán hải trình.' },
  PER: { name: 'Quan sát', short: 'PER', desc: 'Tìm kiếm, khám phá, theo dấu, phát tín hiệu.' },
};

export const SKILL_DEFS: Record<SkillId, { name: string; icon: string; desc: string; perks: Record<number, string> }> = {
  survival: {
    name: 'Sinh tồn',
    icon: '🏕️',
    desc: 'Tìm thức ăn, thu thập, khám phá, nhóm lửa.',
    perks: { 2: 'Nhận biết quả mọng an toàn', 3: 'Ngủ ngoài trời hồi phục tốt hơn' },
  },
  hunting: {
    name: 'Săn bắt',
    icon: '🏹',
    desc: 'Săn thú, đặt bẫy, đối phó động vật.',
    perks: { 1: 'Mở công thức Bẫy thú', 3: 'Săn được nhiều thịt hơn' },
  },
  fishing: {
    name: 'Đánh cá',
    icon: '🎣',
    desc: 'Câu cá, đâm cá, đặt bẫy cá.',
    perks: { 1: 'Mở công thức Bẫy cá', 3: 'Bắt được nhiều cá hơn' },
  },
  crafting: {
    name: 'Chế tạo',
    icon: '🔨',
    desc: 'Chế tạo công cụ, xây công trình, đóng bè.',
    perks: { 2: 'Mở công trình Chòi kiên cố', 3: 'Công cụ tự chế bền hơn' },
  },
  medicine: {
    name: 'Y thuật',
    icon: '🩺',
    desc: 'Sơ cứu, chữa bệnh, tìm thảo dược.',
    perks: { 1: 'Mở công thức Thuốc đắp thảo dược', 3: 'Chữa trị có lợi thế' },
  },
  navigation: {
    name: 'Định hướng',
    icon: '🧭',
    desc: 'Đọc thời tiết, tìm đường, hải trình khi thoát đảo.',
    perks: { 1: 'Dự báo thời tiết xa hơn', 2: 'Nghiên cứu hải lưu hiệu quả hơn' },
  },
};

export { WEATHER_DEFS, WEATHER_MARKOV } from './weather.js';

export interface RegionDef {
  id: RegionId;
  name: string;
  icon: string;
  desc: string;
  seaView: boolean;
  exploreDC: number;
  pos: { x: number; y: number };
  terrain: string;
}

export const REGION_DEFS: Record<RegionId, RegionDef> = {
  coast: {
    id: 'coast',
    name: 'Bãi biển',
    icon: '🏖️',
    desc: 'Bờ cát nơi bạn tỉnh dậy. Xác tàu đắm mắc cạn gần mỏm đá. Nhiều gỗ trôi dạt, dừa và sò ốc, nhưng không có nước ngọt.',
    seaView: true,
    exploreDC: 10,
    pos: { x: 470, y: 560 },
    terrain: 'Cát, đá ven bờ',
  },
  jungle: {
    id: 'jungle',
    name: 'Rừng rậm',
    icon: '🌴',
    desc: 'Rừng nhiệt đới rậm rạp. Nhiều gỗ, dây leo, trái cây và thú nhỏ — cùng những nguy hiểm khó lường.',
    seaView: false,
    exploreDC: 12,
    pos: { x: 280, y: 370 },
    terrain: 'Rừng rậm',
  },
  river: {
    id: 'river',
    name: 'Dòng suối',
    icon: '🏞️',
    desc: 'Con suối chảy từ núi xuống. Nguồn nước ngọt chính của đảo, có cá và đá cuội.',
    seaView: false,
    exploreDC: 11,
    pos: { x: 640, y: 390 },
    terrain: 'Ven suối',
  },
  mountain: {
    id: 'mountain',
    name: 'Núi đá',
    icon: '⛰️',
    desc: 'Ngọn núi đá giữa đảo. Từ đỉnh có thể nhìn bao quát hòn đảo và vùng biển xung quanh.',
    seaView: true,
    exploreDC: 13,
    pos: { x: 460, y: 190 },
    terrain: 'Đá dốc',
  },
  cape: {
    id: 'cape',
    name: 'Mũi Hải Đăng',
    icon: '🗼',
    desc: 'Mũi đá nhô ra biển với tàn tích một ngọn hải đăng cũ. Vị trí cao, lộng gió, nhìn thẳng ra tuyến hàng hải.',
    seaView: true,
    exploreDC: 12,
    pos: { x: 790, y: 150 },
    terrain: 'Vách đá ven biển',
  },
};

export interface LocationDef {
  id: string;
  name: string;
  icon: string;
  region: RegionId;
  desc: string;
}

export const LOCATION_DEFS: Record<string, LocationDef> = {
  wreck: { id: 'wreck', name: 'Xác tàu đắm', icon: '🚢', region: 'coast', desc: 'Con tàu bạn đi đã vỡ nát. Có thể còn đồ dùng được bên trong.' },
  lagoon: { id: 'lagoon', name: 'Đầm phá', icon: '🐠', region: 'coast', desc: 'Vùng nước lặng sau rạn san hô. Đánh cá dễ hơn (+2).' },
  rain_pool: { id: 'rain_pool', name: 'Hốc đá trữ mưa', icon: '🪨', region: 'coast', desc: 'Hốc đá giữ lại nước mưa sạch. Lấy được nước trong 2 ngày sau mưa.' },
  turtle_beach: { id: 'turtle_beach', name: 'Bãi rùa', icon: '🐢', region: 'coast', desc: 'Rùa biển lên đây đẻ trứng vào buổi tối.' },
  seep: { id: 'seep', name: 'Mạch nước rỉ', icon: '⛲', region: 'coast', desc: 'Nước ngọt rỉ ra dưới lớp cát ẩm. Lấy được 2 phần nước mỗi ngày ngay tại Bãi biển.' },
  bee_tree: { id: 'bee_tree', name: 'Cây có tổ ong', icon: '🐝', region: 'jungle', desc: 'Một tổ ong rừng trong hốc cây cổ thụ.' },
  banana_grove: { id: 'banana_grove', name: 'Lùm chuối dại', icon: '🍌', region: 'jungle', desc: 'Một lùm chuối dại. Tìm thức ăn ở rừng hiệu quả hơn.' },
  water_vine: { id: 'water_vine', name: 'Dây leo nước', icon: '🌿', region: 'jungle', desc: 'Loại dây leo chứa nước sạch bên trong. Lấy được 1–2 phần nước an toàn.' },
  herb_patch: { id: 'herb_patch', name: 'Bãi thảo dược', icon: '🌱', region: 'jungle', desc: 'Nhiều cây thuốc mọc dưới tán rừng. Tìm thảo dược dễ hơn.' },
  footprints: { id: 'footprints', name: 'Dấu chân cũ', icon: '👣', region: 'jungle', desc: 'Những dấu chân người đã mờ. Ai đó từng ở đây trước bạn.' },
  abandoned_camp: { id: 'abandoned_camp', name: 'Trại bỏ hoang', icon: '⛺', region: 'jungle', desc: 'Trại của một người bị nạn trước bạn. Có thể còn đồ đạc.' },
  waterfall: { id: 'waterfall', name: 'Thác nước', icon: '💦', region: 'river', desc: 'Nước từ thác trong và sạch hơn hẳn nước suối bên dưới.' },
  flint_bed: { id: 'flint_bed', name: 'Bãi đá lửa', icon: '🔸', region: 'river', desc: 'Lòng suối có nhiều đá lửa. Thu thập ở đây luôn có đá lửa.' },
  deep_pool: { id: 'deep_pool', name: 'Vũng sâu', icon: '🐟', region: 'river', desc: 'Vũng nước sâu nhiều cá. Đánh cá ở suối +2.' },
  bird_cliff: { id: 'bird_cliff', name: 'Vách chim biển', icon: '🐦', region: 'mountain', desc: 'Chim biển làm tổ trên vách đá. Tìm thức ăn ở núi được trứng chim.' },
  cave: { id: 'cave', name: 'Hang đá', icon: '🕳️', region: 'mountain', desc: 'Hang khô ráo, kín gió. Ngủ ở đây như có nơi trú ẩn.' },
  lookout: { id: 'lookout', name: 'Đỉnh quan sát', icon: '🔭', region: 'mountain', desc: 'Đỉnh núi nhìn bao quát cả đảo và biển.' },
  lighthouse: { id: 'lighthouse', name: 'Tàn tích hải đăng', icon: '🗼', region: 'cape', desc: 'Ngọn hải đăng đổ nát. Vị trí phát tín hiệu tốt nhất đảo.' },
};

/** secondary locations that may or may not appear in a run (hybrid island) */
export const SECONDARY_POOLS: Record<RegionId, string[]> = {
  coast: ['lagoon', 'rain_pool', 'turtle_beach'],
  jungle: ['banana_grove', 'water_vine', 'herb_patch'],
  river: ['waterfall', 'flint_bed', 'deep_pool'],
  mountain: ['bird_cliff', 'cave'],
  cape: [],
};

export const ROUTE_DEFS: { id: string; a: RegionId; b: RegionId; known: boolean; energy: number; danger?: number; name: string }[] = [
  { id: 'coast-jungle', a: 'coast', b: 'jungle', known: true, energy: 8, name: 'Lối mòn bìa rừng' },
  { id: 'coast-river', a: 'coast', b: 'river', known: true, energy: 8, name: 'Cửa suối' },
  { id: 'jungle-river', a: 'jungle', b: 'river', known: true, energy: 8, name: 'Đường xuyên rừng' },
  { id: 'jungle-mountain', a: 'jungle', b: 'mountain', known: false, energy: 14, name: 'Dốc rừng lên núi' },
  { id: 'river-mountain', a: 'river', b: 'mountain', known: false, energy: 14, name: 'Ngược dòng lên núi' },
  { id: 'mountain-cape', a: 'mountain', b: 'cape', known: false, energy: 12, name: 'Sống núi ra mũi đá' },
  { id: 'coast-cape', a: 'coast', b: 'cape', known: false, energy: 12, danger: 13, name: 'Ghềnh đá ven biển' },
];
