import type { AttrId, WeatherId } from '../engine/types.ts';

/**
 * A check modifier applied while this weather lasts. A rule matches when every
 * given filter matches: `outdoor` (the check is outdoors), `attrs`, `tags`
 * (action tags such as fishing, hunting, gather, signal, fire, climb).
 */
export interface WeatherRule {
  value: number;
  label: string;
  outdoor?: boolean;
  attrs?: AttrId[];
  tags?: string[];
}

export interface WeatherDef {
  name: string;
  icon: string;
  /** one-line summary used in tooltips */
  desc: string;
  mood: 'good' | 'neutral' | 'bad' | 'danger';
  dayText: string;
  /** readable effect list shown to the player (+ = buff, - = nerf) */
  effects: { text: string; good: boolean }[];
  rules: WeatherRule[];
  /** multiplier on thirst decay */
  thirst?: number;
  /** added to the energy cost of physical actions (base cost ≥ 6) */
  energy?: number;
  /** modifier for every stage when sailing away */
  sea?: number;
  /** safe water per rain collector at day start */
  rainWater?: number;
  /** river turns muddy */
  muddies?: boolean;
  /** chance a lit campfire goes out at day start: [uncovered, under shelter] */
  fireOut?: [number, number];
  /** chance of Exposure when sleeping without shelter */
  exposure?: number;
  /** min/max integrity damage to every structure at day start */
  structureDamage?: [number, number];
  /** food spoils faster tonight */
  spoilFaster?: boolean;
}

export const WEATHER_DEFS: Record<WeatherId, WeatherDef> = {
  clear: {
    name: 'Nắng ráo',
    icon: '☀️',
    mood: 'good',
    desc: 'Trời quang, tầm nhìn xa.',
    dayText: 'Bầu trời trong vắt, nắng vàng trải khắp đảo.',
    effects: [
      { text: 'Quan sát (PER) ngoài trời +1', good: true },
      { text: 'Ra khơi +1', good: true },
      { text: 'Gương tín hiệu dùng được', good: true },
    ],
    rules: [{ value: 1, label: 'Tầm nhìn xa', outdoor: true, attrs: ['PER'] }],
    sea: 1,
  },
  hot: {
    name: 'Nắng gắt',
    icon: '🥵',
    mood: 'bad',
    desc: 'Khát nhanh, lao động nặng mệt mỏi.',
    dayText: 'Mặt trời thiêu đốt từ sáng sớm. Bạn sẽ khát nhanh hơn.',
    effects: [
      { text: 'Khát nhanh gấp 1.5 lần', good: false },
      { text: 'Sức mạnh, Sức bền (STR/END) ngoài trời -1', good: false },
      { text: 'Gương tín hiệu dùng được', good: true },
    ],
    rules: [{ value: -1, label: 'Nắng gắt', outdoor: true, attrs: ['STR', 'END'] }],
    thirst: 1.5,
  },
  cloudy: {
    name: 'Nhiều mây',
    icon: '☁️',
    mood: 'neutral',
    desc: 'Mát mẻ, ít khát, nhưng tín hiệu khó thấy.',
    dayText: 'Mây xám phủ kín bầu trời. Trời mát, dễ chịu.',
    effects: [
      { text: 'Trời mát: khát chậm hơn (x0.8)', good: true },
      { text: 'Phát tín hiệu -1', good: false },
    ],
    rules: [{ value: -1, label: 'Trời âm u', tags: ['signal'] }],
    thirst: 0.8,
  },
  breezy: {
    name: 'Gió mát',
    icon: '🍃',
    mood: 'good',
    desc: 'Làm việc đỡ mệt, gió thuận ra khơi.',
    dayText: 'Gió biển mát rượi thổi qua đảo. Một ngày dễ chịu để làm việc.',
    effects: [
      { text: 'Lao động nặng tốn ít hơn 2 năng lượng', good: true },
      { text: 'Gió thuận: ra khơi +2', good: true },
    ],
    rules: [],
    energy: -2,
    sea: 2,
  },
  windy: {
    name: 'Gió lớn',
    icon: '🌬️',
    mood: 'bad',
    desc: 'Sóng to, khó đánh cá và phát tín hiệu; nhiều cành khô gãy.',
    dayText: 'Gió rít qua tán cây, sóng bạc đầu ngoài khơi.',
    effects: [
      { text: 'Đánh cá, phát tín hiệu, nhóm lửa -2', good: false },
      { text: 'Leo trèo -1', good: false },
      { text: 'Ra khơi -3', good: false },
      { text: 'Công trình hư hại nhẹ', good: false },
      { text: 'Cành khô gãy nhiều: thu thập vật liệu +2', good: true },
    ],
    rules: [
      { value: -2, label: 'Gió lớn', tags: ['fishing', 'signal', 'fire'] },
      { value: -1, label: 'Gió lớn', tags: ['climb'] },
      { value: 2, label: 'Cành khô gãy nhiều', tags: ['gather'] },
    ],
    sea: -3,
    fireOut: [0.25, 0.1],
    exposure: 0.15,
    structureDamage: [3, 8],
  },
  fog: {
    name: 'Sương mù',
    icon: '🌫️',
    mood: 'neutral',
    desc: 'Khó nhìn, nhưng thú rừng cũng không thấy bạn.',
    dayText: 'Sương mù dày đặc, chỉ nhìn rõ vài bước chân.',
    effects: [
      { text: 'Quan sát (PER) ngoài trời -2', good: false },
      { text: 'Phát tín hiệu -4', good: false },
      { text: 'Ra khơi -2', good: false },
      { text: 'Săn bắt +2 (thú không thấy bạn)', good: true },
    ],
    rules: [
      { value: -2, label: 'Sương mù', outdoor: true, attrs: ['PER'] },
      { value: -4, label: 'Sương mù che tín hiệu', tags: ['signal'] },
      { value: 2, label: 'Thú không thấy bạn', tags: ['hunting'] },
    ],
    sea: -2,
    exposure: 0.1,
  },
  drizzle: {
    name: 'Mưa phùn',
    icon: '🌦️',
    mood: 'neutral',
    desc: 'Hứng được ít nước, mát, nhưng củi ẩm.',
    dayText: 'Mưa phùn lất phất cả ngày. Không khí ẩm và mát.',
    effects: [
      { text: 'Khát chậm hơn (x0.8)', good: true },
      { text: 'Bộ hứng nước mưa +2 nước sạch', good: true },
      { text: 'Nhóm lửa, phát tín hiệu -2', good: false },
      { text: 'Ra khơi -1', good: false },
    ],
    rules: [{ value: -2, label: 'Củi ẩm, mưa phùn', tags: ['fire', 'signal'] }],
    thirst: 0.8,
    sea: -1,
    rainWater: 2,
    fireOut: [0.15, 0.05],
    exposure: 0.2,
  },
  rain: {
    name: 'Mưa',
    icon: '🌧️',
    mood: 'bad',
    desc: 'Nhiều nước sạch, nhưng mọi việc ngoài trời khó hơn.',
    dayText: 'Mưa rơi đều trên đảo. Nước ngọt dồi dào, nhưng mọi thứ ẩm ướt.',
    effects: [
      { text: 'Bộ hứng nước mưa +4 nước sạch', good: true },
      { text: 'Mọi việc ngoài trời -1', good: false },
      { text: 'Nhóm lửa -2, phát tín hiệu -4', good: false },
      { text: 'Ra khơi -3', good: false },
      { text: 'Nước suối đục; ngủ ngoài trời dễ nhiễm lạnh', good: false },
    ],
    rules: [
      { value: -1, label: 'Trời mưa', outdoor: true },
      { value: -2, label: 'Củi ướt', tags: ['fire'] },
      { value: -4, label: 'Mưa che tầm nhìn', tags: ['signal'] },
    ],
    sea: -3,
    rainWater: 4,
    muddies: true,
    fireOut: [0.4, 0.15],
    exposure: 0.45,
  },
  humid: {
    name: 'Oi bức',
    icon: '😓',
    mood: 'bad',
    desc: 'Nóng ẩm ngột ngạt: mệt nhanh, đồ ăn mau hỏng.',
    dayText: 'Không khí nóng ẩm, ngột ngạt. Mồ hôi túa ra dù chẳng làm gì.',
    effects: [
      { text: 'Lao động nặng tốn thêm 3 năng lượng', good: false },
      { text: 'Khát nhanh hơn (x1.2)', good: false },
      { text: 'Sức bền (END) ngoài trời -1', good: false },
      { text: 'Đồ ăn hỏng nhanh hơn', good: false },
    ],
    rules: [{ value: -1, label: 'Oi bức', outdoor: true, attrs: ['END'] }],
    thirst: 1.2,
    energy: 3,
    spoilFaster: true,
  },
  storm: {
    name: 'Bão',
    icon: '⛈️',
    mood: 'danger',
    desc: 'Rất nguy hiểm: công trình hư hại, biển động dữ dội.',
    dayText: 'Gió rít từng cơn, mưa quất xối xả. Hôm nay ra ngoài là liều mạng.',
    effects: [
      { text: 'Mọi việc ngoài trời -3', good: false },
      { text: 'Nhóm lửa -5, lửa trại bị dập tắt', good: false },
      { text: 'Ra khơi -8, tàu không thể thấy tín hiệu', good: false },
      { text: 'Công trình, bè, bẫy bị hư hại', good: false },
      { text: 'Bộ hứng nước mưa +6 nước sạch', good: true },
    ],
    rules: [
      { value: -3, label: 'Bão', outdoor: true },
      { value: -5, label: 'Bão', tags: ['fire'] },
    ],
    sea: -8,
    rainWater: 6,
    muddies: true,
    fireOut: [1, 1],
    exposure: 0.85,
  },
};

/** day-to-day transitions; storms only follow unsettled weather (so they can be foreseen) */
export const WEATHER_MARKOV: Record<WeatherId, [WeatherId, number][]> = {
  clear: [['clear', 28], ['hot', 15], ['cloudy', 15], ['breezy', 15], ['humid', 8], ['fog', 6], ['windy', 7], ['drizzle', 6]],
  hot: [['hot', 25], ['clear', 25], ['humid', 20], ['cloudy', 15], ['breezy', 15]],
  cloudy: [['cloudy', 15], ['clear', 15], ['drizzle', 18], ['rain', 18], ['windy', 12], ['fog', 8], ['breezy', 8], ['storm', 6]],
  breezy: [['breezy', 20], ['clear', 30], ['cloudy', 20], ['windy', 15], ['drizzle', 10], ['hot', 5]],
  windy: [['windy', 15], ['cloudy', 20], ['rain', 20], ['storm', 15], ['breezy', 20], ['clear', 10]],
  fog: [['fog', 12], ['clear', 35], ['cloudy', 25], ['drizzle', 15], ['breezy', 13]],
  drizzle: [['drizzle', 15], ['rain', 25], ['cloudy', 25], ['fog', 15], ['clear', 20]],
  rain: [['rain', 25], ['drizzle', 15], ['cloudy', 25], ['clear', 15], ['windy', 10], ['storm', 10]],
  humid: [['humid', 20], ['hot', 20], ['cloudy', 25], ['rain', 20], ['storm', 5], ['clear', 10]],
  storm: [['rain', 45], ['windy', 25], ['cloudy', 20], ['drizzle', 10]],
};
