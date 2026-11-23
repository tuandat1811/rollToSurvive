import type { GameState, RegionId, ResourceKind, WeatherId } from '../engine/types.js';

/**
 * Island traits: each run rolls 2 (non-conflicting) traits that change the
 * weather mix, resources, ship traffic, wildlife and the sea — so two runs on
 * the same island play out differently.
 */
export interface TraitDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  mood: 'good' | 'bad' | 'mixed';
  conflicts?: string[];
  /** multipliers on the chance of tomorrow being this weather */
  weather?: Partial<Record<WeatherId, number>>;
  /** multipliers on starting/maximum resource abundance */
  abundance?: Partial<Record<RegionId | '*', Partial<Record<ResourceKind, number>>>>;
  /** days between passing ships, and the day of the first one */
  shipGap?: [number, number];
  firstShip?: [number, number];
  /** extra items hidden in the wreck */
  wreck?: string[];
  /** multipliers on random event weights */
  events?: Record<string, number>;
  /** added illness risk of raw river water */
  riverRisk?: number;
  /** modifier on every sailing stage */
  sea?: number;
  /** a secondary location that is guaranteed to exist */
  guaranteeLocation?: string;
}

export const TRAITS: TraitDef[] = [
  {
    id: 'rainy',
    name: 'Đảo mưa nhiều',
    icon: '🌧️',
    mood: 'mixed',
    desc: 'Mưa và mưa phùn thường xuyên: dễ có nước sạch, nhưng ẩm ướt, khó nhóm lửa, bão nhiều hơn.',
    conflicts: ['dry'],
    weather: { rain: 1.8, drizzle: 1.6, storm: 1.3, hot: 0.4, humid: 0.7, clear: 0.8 },
  },
  {
    id: 'dry',
    name: 'Mùa khô hạn',
    icon: '🏜️',
    mood: 'bad',
    desc: 'Nắng gắt và oi bức kéo dài, hiếm mưa. Nước uống là thử thách lớn nhất.',
    conflicts: ['rainy'],
    weather: { hot: 2.2, humid: 1.6, rain: 0.45, drizzle: 0.45, storm: 0.6 },
    abundance: { river: { fish: 0.8 } },
  },
  {
    id: 'stormy',
    name: 'Vùng biển bão tố',
    icon: '⛈️',
    mood: 'bad',
    desc: 'Bão và gió lớn kéo đến thường xuyên. Ra khơi khó hơn (-1 mỗi chặng).',
    conflicts: ['calm'],
    weather: { storm: 2.2, windy: 1.6, breezy: 0.7 },
    sea: -1,
  },
  {
    id: 'calm',
    name: 'Biển hiền hòa',
    icon: '🌅',
    mood: 'good',
    desc: 'Biển lặng, ít bão. Ra khơi dễ hơn (+1 mỗi chặng), những ngày biển lặng đến thường hơn.',
    conflicts: ['stormy'],
    weather: { storm: 0.5, windy: 0.7, breezy: 1.4 },
    sea: 1,
    events: { calm_sea: 2 },
  },
  {
    id: 'lush',
    name: 'Rừng trù phú',
    icon: '🌴',
    mood: 'good',
    desc: 'Rừng rậm nhiều trái cây, thú và gỗ hơn hẳn bình thường.',
    abundance: { jungle: { forage: 1.4, game: 1.3, wood: 1.2 } },
    events: { falling_fruit: 2, bee_hive: 1.5 },
  },
  {
    id: 'poor_sea',
    name: 'Biển nghèo cá',
    icon: '🐟',
    mood: 'bad',
    desc: 'Cá thưa thớt ở cả bãi biển lẫn dòng suối.',
    conflicts: ['rich_sea'],
    abundance: { '*': { fish: 0.6 } },
    events: { fish_school: 0.3 },
  },
  {
    id: 'rich_sea',
    name: 'Ngư trường',
    icon: '🐠',
    mood: 'good',
    desc: 'Vùng nước quanh đảo đầy cá; đàn cá vào bờ thường xuyên.',
    conflicts: ['poor_sea'],
    abundance: { '*': { fish: 1.5 } },
    events: { fish_school: 2.5, kelp_washup: 1.5 },
  },
  {
    id: 'busy_lane',
    name: 'Tuyến hàng hải đông đúc',
    icon: '🚢',
    mood: 'good',
    desc: 'Tàu đi qua thường xuyên (3–5 ngày một chuyến), chuyến đầu tiên đến sớm.',
    conflicts: ['remote'],
    shipGap: [3, 5],
    firstShip: [3, 5],
  },
  {
    id: 'remote',
    name: 'Đảo hẻo lánh',
    icon: '🧭',
    mood: 'bad',
    desc: 'Rất ít tàu qua lại (6–9 ngày một chuyến), máy bay hiếm khi bay ngang.',
    conflicts: ['busy_lane'],
    shipGap: [6, 9],
    firstShip: [7, 10],
    events: { plane_overhead: 0.4 },
  },
  {
    id: 'cargo_wreck',
    name: 'Xác tàu chở hàng',
    icon: '📦',
    mood: 'good',
    desc: 'Con tàu đắm chở theo nhiều hàng hóa: xác tàu có thêm đồ hộp, dây thừng, vải bạt, thùng phuy.',
    wreck: ['canned', 'canned', 'rope', 'canvas', 'barrel', 'scrap'],
  },
  {
    id: 'wild',
    name: 'Thú rừng hung dữ',
    icon: '🐗',
    mood: 'mixed',
    desc: 'Thú rừng nhiều và liều lĩnh: săn được nhiều thịt hơn nhưng hay bị tấn công, phá trại.',
    abundance: { jungle: { game: 1.3 }, river: { game: 1.3 } },
    events: { bush_noise: 2, boar_raid: 2, wounded_boar: 2, monkey_thief: 1.5 },
  },
  {
    id: 'monkeys',
    name: 'Đảo của bầy khỉ',
    icon: '🐒',
    mood: 'mixed',
    desc: 'Bầy khỉ đông đúc hay trộm đồ ăn — nhưng chúng dẫn bạn tới lùm chuối dại.',
    events: { monkey_thief: 3 },
    guaranteeLocation: 'banana_grove',
  },
  {
    id: 'mineral_water',
    name: 'Nước suối nhiễm khoáng',
    icon: '💧',
    mood: 'bad',
    desc: 'Nước suối có vị lạ, uống sống dễ đau bụng hơn — nên đun sôi hoặc tìm nguồn khác.',
    riverRisk: 0.12,
  },
  {
    id: 'strong_current',
    name: 'Hải lưu xiết',
    icon: '🌊',
    mood: 'mixed',
    desc: 'Dòng chảy quanh đảo rất mạnh: ra khơi khó hơn, nhưng sóng đánh dạt nhiều đồ vào bờ.',
    sea: -1,
    events: { bottles_in_sand: 2, kelp_washup: 1.5, coconut_fall: 1.5 },
  },
];

const BY_ID: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

export function traitDefs(s: Pick<GameState, 'traits'>): TraitDef[] {
  return (s.traits ?? []).map((id) => BY_ID[id]).filter(Boolean);
}

/** pick n traits that don't conflict */
export function pickTraits(rand: () => number, n = 2): string[] {
  const pool = [...TRAITS];
  const out: TraitDef[] = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(rand() * pool.length);
    const t = pool.splice(i, 1)[0];
    if (out.some((o) => o.conflicts?.includes(t.id) || t.conflicts?.includes(o.id))) continue;
    out.push(t);
  }
  return out.map((t) => t.id);
}

export function traitEventMult(s: GameState, eventId: string): number {
  return traitDefs(s).reduce((m, t) => m * (t.events?.[eventId] ?? 1), 1);
}

export function traitWeatherMult(s: GameState, w: WeatherId): number {
  return traitDefs(s).reduce((m, t) => m * (t.weather?.[w] ?? 1), 1);
}

export function traitSea(s: GameState): { label: string; value: number }[] {
  return traitDefs(s)
    .filter((t) => t.sea)
    .map((t) => ({ label: `${t.icon} ${t.name}`, value: t.sea! }));
}
