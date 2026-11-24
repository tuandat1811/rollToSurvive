// Data-driven content (GDD Diversity-01 §8). Designers author content in Excel
// (docs/content-pack.xlsx); `npm run content:import` validates it and writes
// pack.ts. Rows mirror the spreadsheet columns one-to-one, as plain strings and
// numbers, so the round trip Excel ⇄ pack is lossless.
//
// Mini-syntax used inside cells (see the README sheet of the workbook):
//   Conditions   region=coast,river; day>=3; !flag:boarFriend; item:rope>=1; tool:knife
//   Materials    wood:2, fiber:1
//   Consequences gain_item(item=fish_raw, qty=1..3); vital_change(vital=health, amount=-4, cause=Bị cắn)
//   Mods         +2 Giáo gỗ [tool:spear]; -3 Tay không [!tool:spear]
//   Context      x2 [weather=rain]; x0.5 [pacing=calm]
//   Opposed      🐗 Lợn rừng +3

export interface ActionRow {
  code: string;
  id: string;
  name: string;
  icon: string;
  group: string;
  tier: number;
  conditions: string;
  requires: string;
  desc: string;
  hint: string;
  slots: number;
  energy: number;
  materials: string;
  attr: string;
  skill: string;
  dc: number | '';
  crit: string;
  checkTags: string;
  mods: string;
  opposed: string;
  cooldownDays: number | '';
  priority: number | '';
  notes: string;
}

export interface EventRow {
  code: string;
  id: string;
  title: string;
  icon: string;
  category: string;
  rarity: string;
  source: string;
  trigger: string;
  onAction: string;
  risk: number;
  weight: number | '';
  context: string;
  cooldownDays: number | '';
  once: string;
  notable: string;
  recovery: string;
  family: string;
  conditions: string;
  text: string;
  cause: string;
  journal: string;
  notes: string;
}

export interface ChoiceRow {
  event: string;
  id: string;
  label: string;
  icon: string;
  desc: string;
  slots: number;
  energy: number | '';
  requires: string;
  materials: string;
  attr: string;
  skill: string;
  dc: number | '';
  crit: string;
  checkTags: string;
  mods: string;
  opposed: string;
}

/** owner: an action id, `event:<id>` (passive) or `<eventId>:<choiceId>` */
export interface OutcomeRow {
  owner: string;
  tier: string;
  if: string;
  text: string;
  consequences: string;
}

export interface ContentPack {
  version: number;
  actions: ActionRow[];
  events: EventRow[];
  choices: ChoiceRow[];
  outcomes: OutcomeRow[];
}

/** column order and Vietnamese header per sheet (header text is what designers see) */
export const SHEETS = {
  Actions: [
    ['code', 'Code'], ['id', 'ID'], ['name', 'Tên'], ['icon', 'Icon'], ['group', 'Nhóm'], ['tier', 'Bậc'],
    ['conditions', 'Hiện khi (Conditions)'], ['requires', 'Yêu cầu (Requires)'], ['desc', 'Mô tả'], ['hint', 'Kết quả mong đợi'],
    ['slots', 'Buổi'], ['energy', 'Năng lượng'], ['materials', 'Vật liệu'], ['attr', 'Thuộc tính'], ['skill', 'Kỹ năng'],
    ['dc', 'DC'], ['crit', 'Crit'], ['checkTags', 'Tags'], ['mods', 'Mods'], ['opposed', 'Đối kháng'],
    ['cooldownDays', 'Hồi (ngày)'], ['priority', 'Ưu tiên'], ['notes', 'Ghi chú thiết kế'],
  ],
  Events: [
    ['code', 'Code'], ['id', 'ID'], ['title', 'Tiêu đề'], ['icon', 'Icon'], ['category', 'Loại'], ['rarity', 'Độ hiếm'],
    ['source', 'Nguồn'], ['trigger', 'Kích hoạt'], ['onAction', 'Sau hành động'], ['risk', 'Rủi ro'], ['weight', 'Trọng số'],
    ['context', 'Ngữ cảnh (C)'], ['cooldownDays', 'Hồi (ngày)'], ['once', 'Một lần'], ['notable', 'Đáng chú ý'],
    ['recovery', 'Hồi phục'], ['family', 'Họ sự kiện'], ['conditions', 'Điều kiện'], ['text', 'Nội dung'], ['cause', 'Vì sao'],
    ['journal', 'Nhật ký'], ['notes', 'Ghi chú thiết kế'],
  ],
  Choices: [
    ['event', 'Sự kiện'], ['id', 'ID lựa chọn'], ['label', 'Nhãn'], ['icon', 'Icon'], ['desc', 'Mô tả'], ['slots', 'Buổi'],
    ['energy', 'Năng lượng'], ['requires', 'Yêu cầu'], ['materials', 'Vật liệu'], ['attr', 'Thuộc tính'], ['skill', 'Kỹ năng'],
    ['dc', 'DC'], ['crit', 'Crit'], ['checkTags', 'Tags'], ['mods', 'Mods'], ['opposed', 'Đối kháng'],
  ],
  Outcomes: [['owner', 'Thuộc về'], ['tier', 'Mức kết quả'], ['if', 'Chỉ khi'], ['text', 'Lời kể'], ['consequences', 'Hậu quả']],
} as const;

export type SheetName = keyof typeof SHEETS;
/** numeric columns per sheet (Outcomes.tier is a tier name, Actions.tier a number) */
export const NUMERIC_COLUMNS: Record<SheetName, Set<string>> = {
  Actions: new Set(['tier', 'slots', 'energy', 'dc', 'cooldownDays', 'priority']),
  Events: new Set(['risk', 'weight', 'cooldownDays']),
  Choices: new Set(['slots', 'energy', 'dc']),
  Outcomes: new Set(),
};
