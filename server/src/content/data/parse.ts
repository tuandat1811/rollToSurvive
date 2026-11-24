// Parsers and evaluators for the content-pack mini-syntax. Parsing is pure (safe
// at module load); evaluation reads the game state at call time.
import { carriedFood, fireSource } from '../../engine/common.js';
import { countBoth, fireLit, hasStructure, hasTag } from '../../engine/ctx.js';
import type { ConParams, GameState, RegionId } from '../../engine/types.js';
import { LOCATION_DEFS, REGION_DEFS, SKILL_DEFS } from '../defs.js';
import { ITEMS } from '../items.js';
import { locationState } from '../locationStates.js';

export class ParseError extends Error {}

// ------------------------------------------------------------ conditions

export type Op = '=' | '!=' | '>=' | '<=' | '>' | '<';

export interface Condition {
  not: boolean;
  key: string;
  arg?: string;
  op?: Op;
  value?: string;
}

/** condition keys and whether they take `:arg` and/or a comparison */
export const CONDITION_KEYS: Record<string, { arg?: boolean; cmp?: 'list' | 'num' | 'str'; doc: string }> = {
  region: { cmp: 'list', doc: 'region=coast,river — đang ở vùng nào' },
  weather: { cmp: 'list', doc: 'weather=rain,storm — thời tiết hôm nay' },
  pacing: { cmp: 'list', doc: 'pacing=calm,normal,tense — nhịp độ hôm nay' },
  water: { cmp: 'list', doc: 'water=clean,muddy,contaminated — nước suối' },
  day: { cmp: 'num', doc: 'day>=3 — ngày thứ mấy' },
  slot: { cmp: 'num', doc: 'slot>=2 — buổi (0 sáng, 1 trưa, 2 chiều, 3 tối)' },
  misfortune: { cmp: 'num', doc: 'misfortune>=3 — mức vận rủi gần đây' },
  flag: { arg: true, cmp: 'str', doc: 'flag:boarFriend hoặc flag:chain_boar=healed — cờ trạng thái' },
  chain: { arg: true, cmp: 'str', doc: 'chain:boar=healed — nhánh câu chuyện đã chọn' },
  item: { arg: true, cmp: 'num', doc: 'item:rope>=2 — số vật phẩm mang theo (+ kho nếu ở căn cứ); item:rope nghĩa là ≥ 1' },
  tool: { arg: true, doc: 'tool:knife — có công cụ mang tag này (knife, axe, spear, rod, rope, fire, pot…)' },
  vital: { arg: true, cmp: 'num', doc: 'vital:energy<35 — chỉ số sinh tồn (health, hunger, thirst, energy)' },
  skill: { arg: true, cmp: 'num', doc: 'skill:hunting>=1 — cấp kỹ năng' },
  found: { arg: true, doc: 'found:cave — đã phát hiện địa điểm' },
  state: { arg: true, cmp: 'str', doc: 'state:cave=collapsed — trạng thái địa điểm' },
  structure: { arg: true, doc: 'structure:fence — có công trình tại vùng đang đứng' },
  base: { doc: 'base — đã lập căn cứ' },
  at_base: { doc: 'at_base — đang ở căn cứ' },
  fire: { doc: 'fire — lửa trại đang cháy tại đây' },
  fire_source: { doc: 'fire_source — có lửa trại, đuốc hoặc đá lửa' },
  storage_food: { doc: 'storage_food — kho căn cứ có thức ăn' },
  carry_food: { doc: 'carry_food — đang mang theo thức ăn' },
};

const COND_RE = /^(!)?([a-z_]+)(?::([A-Za-z0-9_]+))?\s*(?:(>=|<=|!=|=|>|<)\s*(.+))?$/;

export function parseConditions(src: string): Condition[] {
  if (!src?.trim()) return [];
  return src
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((part) => {
      const m = COND_RE.exec(part);
      if (!m) throw new ParseError(`Điều kiện không hiểu được: "${part}"`);
      const [, not, key, arg, op, value] = m;
      const spec = CONDITION_KEYS[key];
      if (!spec) throw new ParseError(`Điều kiện không tồn tại: "${key}"`);
      if (spec.arg && !arg) throw new ParseError(`"${key}" cần tham số, ví dụ ${spec.doc.split(' — ')[0]}`);
      if (op && !spec.cmp) throw new ParseError(`"${key}" không dùng phép so sánh`);
      if (spec.cmp && !op && !['item', 'flag'].includes(key)) throw new ParseError(`"${key}" cần phép so sánh, ví dụ ${spec.doc.split(' — ')[0]}`);
      if (spec.cmp === 'list' && op && op !== '=' && op !== '!=') throw new ParseError(`"${key}" chỉ dùng = hoặc !=`);
      if (spec.cmp === 'num' && value !== undefined && Number.isNaN(Number(value))) throw new ParseError(`"${part}": cần một con số`);
      return { not: !!not, key, arg, op: op as Op | undefined, value: value?.trim() };
    });
}

function cmpNum(a: number, op: Op | undefined, b: number): boolean {
  switch (op) {
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '<': return a < b;
    case '!=': return a !== b;
    default: return a === b;
  }
}

function inList(v: string, op: Op | undefined, list: string | undefined) {
  const hit = (list ?? '').split(',').map((x) => x.trim()).includes(v);
  return op === '!=' ? !hit : hit;
}

export function evalCondition(s: GameState, c: Condition): boolean {
  let r: boolean;
  switch (c.key) {
    case 'region': r = inList(s.location, c.op, c.value); break;
    case 'weather': r = inList(s.world.weather, c.op, c.value); break;
    case 'pacing': r = inList(s.world.pacing, c.op, c.value); break;
    case 'water': r = inList(s.regions.river.water, c.op, c.value); break;
    case 'day': r = cmpNum(s.day, c.op, Number(c.value)); break;
    case 'slot': r = cmpNum(s.slot, c.op, Number(c.value)); break;
    case 'misfortune': r = cmpNum(s.world.misfortune ?? 0, c.op, Number(c.value)); break;
    case 'flag': {
      const v = s.flags[c.arg!];
      r = c.op ? (c.op === '!=' ? String(v) !== c.value : String(v) === c.value) : !!v;
      break;
    }
    case 'chain': r = c.op === '!=' ? s.flags[`chain_${c.arg}`] !== c.value : s.flags[`chain_${c.arg}`] === c.value; break;
    case 'item': r = c.op ? cmpNum(countBoth(s, c.arg!), c.op, Number(c.value)) : countBoth(s, c.arg!) >= 1; break;
    case 'tool': r = hasTag(s, c.arg!); break;
    case 'vital': r = cmpNum(s.vitals[c.arg as keyof GameState['vitals']] ?? 0, c.op, Number(c.value)); break;
    case 'skill': r = cmpNum(s.skills[c.arg as keyof GameState['skills']]?.lvl ?? 0, c.op, Number(c.value)); break;
    case 'found': {
      const loc = LOCATION_DEFS[c.arg!];
      r = !!loc && s.regions[loc.region].found.includes(c.arg!);
      break;
    }
    case 'state': r = c.op === '!=' ? locationState(s, c.arg!) !== c.value : locationState(s, c.arg!) === c.value; break;
    case 'structure': r = hasStructure(s, c.arg!); break;
    case 'base': r = !!s.baseRegion; break;
    case 'at_base': r = !!s.baseRegion && s.baseRegion === s.location; break;
    case 'fire': r = fireLit(s); break;
    case 'fire_source': r = !!fireSource(s); break;
    case 'storage_food': r = s.storage.some((x) => ITEMS[x.id]?.kind === 'food'); break;
    case 'carry_food': r = carriedFood(s) > 0; break;
    default: r = false;
  }
  return c.not ? !r : r;
}

export const evalAll = (s: GameState, conds: Condition[]) => conds.every((c) => evalCondition(s, c));

const OP_TEXT: Record<Op, string> = { '=': '', '!=': 'không phải ', '>=': '≥ ', '<=': '≤ ', '>': '> ', '<': '< ' };

/** human-readable requirement label (shown on cards when a requirement is not met) */
export function describeCondition(c: Condition): string {
  const no = c.not ? 'Không ' : '';
  const itemName = (id: string) => `${ITEMS[id]?.icon ?? ''} ${ITEMS[id]?.name ?? id}`.trim();
  switch (c.key) {
    case 'item':
      return c.not ? `Không mang ${itemName(c.arg!)}` : `Có ${c.op ? `${OP_TEXT[c.op]}${c.value} ` : ''}${itemName(c.arg!)}`;
    case 'tool': return `${c.not ? 'Không có' : 'Có'} công cụ: ${c.arg}`;
    case 'vital': {
      const names: Record<string, string> = { health: 'Sức khỏe', hunger: 'No bụng', thirst: 'Nước', energy: 'Năng lượng' };
      return `${names[c.arg!] ?? c.arg} ${OP_TEXT[c.op ?? '=']}${c.value}`;
    }
    case 'skill': return `${SKILL_DEFS[c.arg as keyof typeof SKILL_DEFS]?.name ?? c.arg} cấp ${OP_TEXT[c.op ?? '>=']}${c.value}`;
    case 'fire': return `${no}Có lửa trại đang cháy tại đây`;
    case 'fire_source': return `${no}Có nguồn lửa (lửa trại, đuốc hoặc đá lửa)`;
    case 'at_base': return c.not ? 'Không ở căn cứ' : 'Đang ở căn cứ';
    case 'base': return c.not ? 'Chưa lập căn cứ' : 'Đã lập căn cứ';
    case 'carry_food': return `${no}Có thức ăn mang theo`;
    case 'storage_food': return `${no}Kho có thức ăn`;
    case 'found': return `${c.not ? 'Chưa' : 'Đã'} biết ${LOCATION_DEFS[c.arg!]?.name ?? c.arg}`;
    case 'structure': return `${no}Có công trình: ${c.arg}`;
    case 'region': return `Ở ${(c.value ?? '').split(',').map((r) => REGION_DEFS[r.trim() as RegionId]?.name ?? r).join(' / ')}`;
    default: return `${c.not ? '!' : ''}${c.key}${c.arg ? ':' + c.arg : ''}${c.op ?? ''}${c.value ?? ''}`;
  }
}

// ------------------------------------------------------------ materials

export function parseMaterials(src: string): { id: string; qty: number }[] {
  if (!src?.trim()) return [];
  return src.split(',').map((x) => {
    const m = /^\s*([a-z_]+)\s*:\s*(\d+)\s*$/.exec(x);
    if (!m) throw new ParseError(`Vật liệu không hiểu được: "${x.trim()}" (đúng: wood:2)`);
    return { id: m[1], qty: Number(m[2]) };
  });
}

// ------------------------------------------------------------ consequences

export interface ConRef {
  id: string;
  params: Record<string, string>;
}

export function parseConsequences(src: string): ConRef[] {
  if (!src?.trim()) return [];
  // split on ';' that are not inside parentheses
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of src) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts
    .map((x) => x.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^([a-z_]+)\s*(?:\(([^)]*)\))?$/.exec(part);
      if (!m) throw new ParseError(`Hậu quả không hiểu được: "${part}" (đúng: gain_item(item=wood, qty=2))`);
      const params: Record<string, string> = {};
      for (const kv of (m[2] ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
        const eq = kv.indexOf('=');
        if (eq < 1) throw new ParseError(`Tham số không hiểu được trong "${part}": "${kv}" (đúng: tên=giá_trị)`);
        params[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
      }
      return { id: m[1], params };
    });
}

/** turn raw params into values: numbers, booleans, `1..3` random ranges, `$here` = current region */
export function resolveParams(raw: Record<string, string>, s: GameState, randInt: (a: number, b: number) => number): ConParams {
  const out: ConParams = {};
  for (const [k, v] of Object.entries(raw)) {
    const range = /^(-?\d+)\.\.(-?\d+)$/.exec(v);
    if (range) out[k] = randInt(Number(range[1]), Number(range[2]));
    else if (v === 'true' || v === 'false') out[k] = v === 'true';
    else if (v === '$here') out[k] = s.location;
    else if (v !== '' && !Number.isNaN(Number(v))) out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}

// ------------------------------------------------------------ mods / context / opposed

export interface ModRule {
  value: number;
  label: string;
  when: Condition[];
}

/** "+2 Giáo gỗ [tool:spear]; -3 Tay không [!tool:spear]" */
export function parseMods(src: string): ModRule[] {
  if (!src?.trim()) return [];
  return src.split(';').map((x) => x.trim()).filter(Boolean).map((part) => {
    const m = /^([+-]\d+)\s+([^[]+?)\s*(?:\[([^\]]*)\])?$/.exec(part);
    if (!m) throw new ParseError(`Mod không hiểu được: "${part}" (đúng: +2 Giáo gỗ [tool:spear])`);
    return { value: Number(m[1]), label: m[2].trim(), when: parseConditions(m[3] ?? '') };
  });
}

export interface ContextRule {
  mult: number;
  when: Condition[];
}

/** "x2 [weather=rain]; x0.5 [pacing=calm]" */
export function parseContext(src: string): ContextRule[] {
  if (!src?.trim()) return [];
  return src.split(';').map((x) => x.trim()).filter(Boolean).map((part) => {
    const m = /^x\s*(\d+(?:\.\d+)?)\s*\[([^\]]*)\]$/.exec(part);
    if (!m) throw new ParseError(`Ngữ cảnh không hiểu được: "${part}" (đúng: x2 [weather=rain])`);
    return { mult: Number(m[1]), when: parseConditions(m[2]) };
  });
}

/** "🐗 Lợn rừng +3" → opponent label/icon/bonus */
export function parseOpposed(src: string): { label: string; icon?: string; bonus: number } | undefined {
  if (!src?.trim()) return undefined;
  const m = /^(\S+\s+)?(.+?)\s+([+-]\d+)$/.exec(src.trim());
  if (!m) throw new ParseError(`Đối kháng không hiểu được: "${src}" (đúng: 🐗 Lợn rừng +3)`);
  const first = m[1]?.trim();
  const isIcon = !!first && !/[A-Za-zÀ-ỹ0-9]/.test(first);
  return { icon: isIcon ? first : undefined, label: isIcon ? m[2] : `${first ? first + ' ' : ''}${m[2]}`.trim(), bonus: Number(m[3]) };
}

export const list = (src: string) =>
  (src ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export const yes = (v: string) => ['x', 'yes', 'có', 'true', '1'].includes(String(v ?? '').trim().toLowerCase());

/** text placeholders: {region}, {day} */
export function fillText(text: string, s: GameState): string {
  return (text ?? '').replace(/\{region\}/g, REGION_DEFS[s.location].name).replace(/\{day\}/g, String(s.day));
}
