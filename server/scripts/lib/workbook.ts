// Excel ⇄ content pack. The workbook has 4 editable sheets (Actions, Events,
// Choices, Outcomes) plus a README and read-only reference sheets that list every
// valid ID, so designers never have to guess.
import ExcelJS from 'exceljs';
import { ACTIONS, CODE_ACTION_IDS, GROUP_NAMES } from '../../src/content/actions.js';
import { CONSEQUENCE_LIST } from '../../src/content/consequences.js';
import { CONSEQUENCE_PARAMS } from '../../src/content/consequence-params.js';
import { CONDITIONS } from '../../src/content/conditions.js';
import { LOCATION_DEFS, REGION_DEFS, SKILL_DEFS } from '../../src/content/defs.js';
import { CODE_EVENT_IDS, EVENTS } from '../../src/content/events.js';
import { ITEMS } from '../../src/content/items.js';
import { ACTION_META, EVENT_META } from '../../src/content/meta.js';
import { OBJECT_DEFS } from '../../src/content/objects.js';
import { WEATHER_DEFS } from '../../src/content/weather.js';
import { CONDITION_KEYS } from '../../src/content/data/parse.js';
import { type ContentPack, NUMERIC_COLUMNS, SHEETS, type SheetName } from '../../src/content/data/schema.js';
import { ATTRS } from '../../src/engine/types.js';

const ENUMS: Record<string, string[]> = {
  group: Object.keys(GROUP_NAMES),
  category: ['weather', 'wildlife', 'ecology', 'discovery', 'resources', 'base', 'health', 'psychology', 'narrative', 'escape'],
  rarity: ['common', 'uncommon', 'rare', 'unique'],
  source: ['world', 'action', 'persistent', 'narrative'],
  trigger: ['day_start', 'slot_start', 'night', 'after_action'],
  tier: ['crit_success', 'success', 'partial', 'failure', 'crit_failure', 'always'],
  attr: [...ATTRS],
  skill: Object.keys(SKILL_DEFS),
  crit: ['standard', 'safe', 'none'],
};
/** which enum list a column uses, per sheet */
const COLUMN_ENUM: Partial<Record<SheetName, Record<string, string>>> = {
  Actions: { group: 'group', attr: 'attr', skill: 'skill', crit: 'crit' },
  Events: { category: 'category', rarity: 'rarity', source: 'source', trigger: 'trigger' },
  Choices: { attr: 'attr', skill: 'skill', crit: 'crit' },
  Outcomes: { tier: 'tier' },
};

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4044' } };
const REF_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B4A2E' } };

function styleHeader(ws: ExcelJS.Worksheet, fill: ExcelJS.Fill) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = fill;
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 30;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function refSheet(wb: ExcelJS.Workbook, name: string, headers: string[], rows: (string | number)[][], widths: number[]) {
  const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: 'FF8A6D3B' } } });
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  ws.columns.forEach((c, i) => (c.width = widths[i] ?? 18));
  styleHeader(ws, REF_FILL);
  return ws;
}

const README: [string, string][] = [
  ['Roll To Survive — Content Pack', ''],
  ['Quy trình', '1) Sửa 4 sheet Actions, Events, Choices, Outcomes  2) Lưu file  3) Chạy: npm run content:import  4) Sửa các lỗi được báo (nếu có)  5) Chơi thử.'],
  ['', 'Các sheet màu nâu chỉ để tra cứu (danh sách ID hợp lệ) — sửa cũng không có tác dụng; chúng được tạo lại mỗi lần chạy npm run content:template.'],
  ['Nguyên tắc đếm nội dung', 'Một dòng = một nội dung có chức năng riêng. Đổi tên, đổi số lượng hay viết lại lời kể KHÔNG phải nội dung mới.'],
  ['Mã (Code)', 'ACT-<LOẠI>-<3 số> cho hành động (EXP GAT HUN FSH CRF BLD COK MED RES NAV SOC ESC); EVT-<LOẠI>-<3 số> cho sự kiện (WTH WLD ECO DIS RES BAS HEA PSY NAR ESC). Không được trùng mã đã có (xem sheet "Nội dung có sẵn").'],
  ['ID', 'chữ thường, số và dấu _ (ví dụ: dig_clams). Không được trùng ID đã có.'],
  ['', ''],
  ['Điều kiện (Conditions)', 'Nhiều điều kiện cách nhau bằng dấu ; — TẤT CẢ phải đúng. Thêm ! phía trước để phủ định. Ví dụ: region=coast,river; day>=3; !flag:boarFriend; item:rope>=1; tool:knife'],
  ...Object.entries(CONDITION_KEYS).map(([k, v]) => [`   ${k}`, v.doc] as [string, string]),
  ['', ''],
  ['Vật liệu', 'id:số lượng, cách nhau bằng dấu phẩy. Ví dụ: wood:2, fiber:1 — bị trừ khi thực hiện, kể cả thất bại.'],
  ['Kiểm tra D20', 'Điền Thuộc tính (STR AGI END INT PER), Kỹ năng (không bắt buộc), DC. Bỏ trống Thuộc tính = không tung xúc xắc (luôn "success").'],
  ['Crit', 'standard (mặc định): có Thất bại thảm hại · safe: việc an toàn, không có Thất bại thảm hại · none: bỏ quy tắc tung ra 20/1.'],
  ['Tags', 'Nhãn của lần kiểm tra để thời tiết, chuẩn bị, hy sinh tài nguyên áp dụng: fishing, hunting, gather, signal, fire, climb.'],
  ['Mods', 'Cộng/trừ điểm có điều kiện, cách nhau bằng ;  Ví dụ: +2 Giáo gỗ [tool:spear]; -3 Tay không [!tool:spear]'],
  ['Đối kháng', 'Đối thủ tung d20 + điểm. Ví dụ: 🐗 Lợn rừng +3 (khi có cột này, DC có thể bỏ trống).'],
  ['Ngữ cảnh (C)', 'Nhân trọng số khi đúng ngữ cảnh. Ví dụ: x2 [weather=rain]; x0.5 [pacing=calm]'],
  ['Kích hoạt', 'day_start (đầu ngày) · slot_start (đầu mỗi buổi) · night (ban đêm) · after_action (ngay sau hành động ở cột "Sau hành động")'],
  ['Trọng số', 'Độ thường gặp khi Director chọn ngẫu nhiên (1 = bình thường, 3 = hay gặp). Để 0/trống: chỉ xảy ra khi được hẹn bằng schedule_event.'],
  ['Một lần / Đáng chú ý / Hồi phục', 'Ghi x để bật. Hồi phục: được ưu tiên sau chuỗi xui. Đáng chú ý: tính vào giới hạn ~2 sự kiện lớn mỗi ngày.'],
  ['Vì sao', 'Bắt buộc với sự kiện rủi ro ≥ 2 không có lựa chọn: giải thích vì sao chuyện này xảy ra với người chơi.'],
  ['', ''],
  ['Outcomes — Thuộc về', '<id hành động>  ·  event:<id sự kiện> (kết quả bị động, áp dụng ngay khi sự kiện xuất hiện)  ·  <id sự kiện>:<id lựa chọn>'],
  ['Outcomes — Mức kết quả', 'crit_success, success, partial, failure, crit_failure, always (luôn áp dụng). Bỏ trống một mức: Vang dội dùng như Thành công; Thảm hại và Một phần dùng như Thất bại.'],
  ['Outcomes — Chỉ khi', 'Điều kiện thêm cho riêng dòng này (cùng cú pháp Điều kiện).'],
  ['Outcomes — Hậu quả', 'Tên hậu quả(tham số=giá trị, ...) cách nhau bằng ;  Số ngẫu nhiên: qty=1..3   Vùng hiện tại: region=$here. Danh sách đầy đủ ở sheet "Hậu quả".'],
  ['Lời kể', 'Dùng {region} cho tên vùng hiện tại, {day} cho số ngày.'],
];

/** write the editable sheets from a pack, plus README and reference sheets */
export async function writeWorkbook(pack: ContentPack, path: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Roll To Survive';
  const readme = wb.addWorksheet('README', { properties: { tabColor: { argb: 'FF2B5458' } } });
  for (const r of README) readme.addRow(r);
  readme.getColumn(1).width = 28;
  readme.getColumn(2).width = 140;
  readme.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
  readme.getRow(1).font = { bold: true, size: 16 };

  const rowsOf: Record<SheetName, Record<string, unknown>[]> = {
    Actions: pack.actions as never,
    Events: pack.events as never,
    Choices: pack.choices as never,
    Outcomes: pack.outcomes as never,
  };
  for (const name of Object.keys(SHEETS) as SheetName[]) {
    const cols = SHEETS[name];
    const ws = wb.addWorksheet(name, { properties: { tabColor: { argb: 'FF2E7D5B' } } });
    ws.columns = cols.map(([key, header]) => ({
      key,
      header,
      width: ['desc', 'text', 'consequences', 'notes', 'conditions', 'requires', 'mods', 'cause', 'context'].includes(key) ? 48 : key === 'code' || key === 'owner' ? 18 : 14,
    }));
    for (const r of rowsOf[name]) ws.addRow(Object.fromEntries(cols.map(([key]) => [key, r[key] ?? ''])));
    styleHeader(ws, HEADER_FILL);
    ws.eachRow((row) => (row.alignment = { wrapText: true, vertical: 'top' }));
    // dropdowns for enum columns (generous row range for new content)
    const enums = COLUMN_ENUM[name] ?? {};
    cols.forEach(([key], i) => {
      const e = enums[key];
      if (!e) return;
      const letter = ws.getColumn(i + 1).letter;
      for (let r = 2; r <= 600; r++)
        ws.getCell(`${letter}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${ENUMS[e].join(',')}"`] };
    });
  }

  refSheet(
    wb,
    'Hậu quả',
    ['Code', 'ID', 'Tên', 'Loại', 'Tham số (* bắt buộc)', 'Mô tả'],
    CONSEQUENCE_LIST.map((c) => [c.code, c.id, c.name, c.type, (CONSEQUENCE_PARAMS[c.id] ?? []).join(', '), c.desc]),
    [14, 22, 30, 14, 34, 70],
  );
  refSheet(wb, 'Vật phẩm', ['ID', 'Tên', 'Icon', 'Loại', 'Mô tả'], Object.values(ITEMS).map((i) => [i.id, i.name, i.icon, i.kind, i.desc]), [18, 24, 8, 12, 70]);
  refSheet(
    wb,
    'Địa điểm',
    ['ID', 'Tên', 'Vùng', 'Mô tả'],
    Object.values(LOCATION_DEFS).map((l) => [l.id, l.name, l.region, l.desc]),
    [18, 24, 12, 70],
  );
  refSheet(
    wb,
    'Danh sách',
    ['Vùng (region)', 'Thời tiết (weather)', 'Trạng thái (condition)', 'Vật thể (spawn_object kind)', 'Kỹ năng', 'Nhóm hành động'],
    (() => {
      const cols = [
        Object.keys(REGION_DEFS),
        Object.keys(WEATHER_DEFS),
        Object.keys(CONDITIONS),
        Object.keys(OBJECT_DEFS),
        Object.keys(SKILL_DEFS),
        Object.keys(GROUP_NAMES),
      ];
      const n = Math.max(...cols.map((c) => c.length));
      return Array.from({ length: n }, (_, i) => cols.map((c) => c[i] ?? ''));
    })(),
    [16, 18, 22, 26, 16, 18],
  );
  refSheet(
    wb,
    'Nội dung có sẵn',
    ['Loại', 'Code', 'ID', 'Tên'],
    [
      ...Object.entries(ACTION_META)
        .filter(([k]) => CODE_ACTION_IDS.has(k.split(':')[0]))
        .map(([k, m]) => ['Action', m.code, k, ACTIONS[k.split(':')[0]] ? k : k]),
      ...Object.entries(EVENT_META)
        .filter(([k]) => CODE_EVENT_IDS.has(k))
        .map(([k, m]) => ['Event', m.code, k, EVENTS[k]?.title ?? '']),
    ],
    [10, 14, 30, 40],
  );
  await wb.xlsx.writeFile(path);
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('text' in v) return String(v.text);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

/** read the 4 editable sheets back into a pack (header text identifies columns) */
export async function readWorkbook(path: string): Promise<ContentPack> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const out: Record<string, Record<string, string | number>[]> = {};
  for (const name of Object.keys(SHEETS) as SheetName[]) {
    const ws = wb.getWorksheet(name);
    if (!ws) throw new Error(`Thiếu sheet "${name}"`);
    const header = (ws.getRow(1).values as ExcelJS.CellValue[]).map(cellText);
    const colIndex = SHEETS[name].map(([key, h]) => {
      const i = header.indexOf(h);
      if (i < 0) throw new Error(`Sheet ${name}: thiếu cột "${h}"`);
      return [key, i] as const;
    });
    const rows: Record<string, string | number>[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const vals = row.values as ExcelJS.CellValue[];
      const rec: Record<string, string | number> = {};
      let any = false;
      for (const [key, i] of colIndex) {
        const raw = cellText(vals[i]).trim();
        if (raw) any = true;
        rec[key] = NUMERIC_COLUMNS[name].has(key) ? (raw === '' ? '' : Number(raw)) : raw;
      }
      if (any) rows.push(rec);
    });
    out[name] = rows;
  }
  // non-optional numeric columns default to sensible values
  for (const a of out.Actions) {
    if (a.tier === '') a.tier = 1;
    if (a.slots === '') a.slots = 1;
    if (a.energy === '') a.energy = 0;
  }
  for (const e of out.Events) if (e.risk === '') e.risk = 1;
  for (const c of out.Choices) if (c.slots === '') c.slots = 0;
  return { version: 1, actions: out.Actions as never, events: out.Events as never, choices: out.Choices as never, outcomes: out.Outcomes as never };
}

/** the generated pack.ts module */
export function packModule(pack: ContentPack): string {
  return `// GENERATED by \`npm run content:import\` from docs/content-pack.xlsx — edit the workbook, not this file.
import type { ContentPack } from './schema.js';

export const PACK: ContentPack = ${JSON.stringify(pack, null, 2)};
`;
}
