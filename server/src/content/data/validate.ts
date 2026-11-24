// Content-pack validator: syntax, references and registry rules. Run by
// `npm run content:import` (blocks a broken import) and by the test suite.
import { ACTION_CATEGORY_NAMES, ACTION_META, EVENT_META, type ActionCategory } from '../meta.js';
import { PACK } from './pack.js';
import { CODE_ACTION_IDS, GROUP_NAMES } from '../actions.js';
import { CONSEQUENCES, CONSEQUENCE_LIST } from '../consequences.js';
import { CONSEQUENCE_PARAMS } from '../consequence-params.js';
import { CONDITIONS } from '../conditions.js';
import { LOCATION_DEFS, ROUTE_DEFS, SKILL_DEFS } from '../defs.js';
import { CODE_EVENT_IDS, EVENTS } from '../events.js';
import { ITEMS } from '../items.js';
import { LOCATION_STATES } from '../locationStates.js';
import { OBJECT_DEFS } from '../objects.js';
import { ATTRS, REGIONS } from '../../engine/types.js';
import { type Condition, parseConditions, parseConsequences, parseContext, parseMaterials, parseMods, parseOpposed, list } from './parse.js';
import type { ContentPack } from './schema.js';

const TIERS = ['crit_success', 'success', 'partial', 'failure', 'crit_failure', 'always'];
const TRIGGERS = ['day_start', 'slot_start', 'night', 'after_action'];
const CATEGORIES = ['weather', 'wildlife', 'ecology', 'discovery', 'resources', 'base', 'health', 'psychology', 'narrative', 'escape'];
const RARITIES = ['common', 'uncommon', 'rare', 'unique'];
const SOURCES = ['world', 'action', 'persistent', 'narrative'];
const CRITS = ['', 'standard', 'safe', 'none'];
const EVENT_CODE: Record<string, string> = {
  weather: 'WTH', wildlife: 'WLD', ecology: 'ECO', discovery: 'DIS', resources: 'RES',
  base: 'BAS', health: 'HEA', psychology: 'PSY', narrative: 'NAR', escape: 'ESC',
};

/** codes used by code-defined content and consequences (a pack may not reuse them) */
export function existingCodes(pack: ContentPack): Set<string> {
  const packIds = new Set([...PACK.actions.map((a) => a.id), ...PACK.events.map((e) => e.id), ...pack.actions.map((a) => a.id), ...pack.events.map((e) => e.id)]);
  return new Set([
    ...Object.entries(ACTION_META).filter(([k]) => !packIds.has(k)).map(([, m]) => m.code),
    ...Object.entries(EVENT_META).filter(([k]) => !packIds.has(k)).map(([, m]) => m.code),
    ...CONSEQUENCE_LIST.map((c) => c.code),
  ]);
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validatePack(pack: ContentPack, existingCodes: Set<string> = new Set()): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const at = (where: string, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      errors.push(`${where}: ${(e as Error).message}`);
    }
  };
  const eventIds = new Set([...Object.keys(EVENTS)]);
  const dataEventIds = new Set(pack.events.map((e) => e.id));
  const codes = new Set(existingCodes);
  const ids = new Set<string>();

  const checkConds = (where: string, conds: Condition[]) => {
    for (const c of conds) {
      if (c.key === 'item' && !ITEMS[c.arg!]) errors.push(`${where}: vật phẩm "${c.arg}" không tồn tại`);
      if ((c.key === 'found' || c.key === 'state') && !LOCATION_DEFS[c.arg!]) errors.push(`${where}: địa điểm "${c.arg}" không tồn tại`);
      if (c.key === 'state' && LOCATION_DEFS[c.arg!] && !LOCATION_STATES[c.arg!]?.states[c.value!]) errors.push(`${where}: "${c.arg}" không có trạng thái "${c.value}"`);
      if (c.key === 'skill' && !SKILL_DEFS[c.arg as keyof typeof SKILL_DEFS]) errors.push(`${where}: kỹ năng "${c.arg}" không tồn tại`);
      if (c.key === 'vital' && !['health', 'hunger', 'thirst', 'energy'].includes(c.arg!)) errors.push(`${where}: chỉ số "${c.arg}" không tồn tại`);
      if (c.key === 'region') for (const r of list(c.value ?? '')) if (!REGIONS.includes(r as never)) errors.push(`${where}: vùng "${r}" không tồn tại`);
    }
  };

  const checkCons = (where: string, src: string) =>
    at(where, () => {
      for (const c of parseConsequences(src)) {
        if (!CONSEQUENCES[c.id]) {
          errors.push(`${where}: hậu quả "${c.id}" không có trong danh mục`);
          continue;
        }
        const spec = CONSEQUENCE_PARAMS[c.id] ?? [];
        const known = spec.map((p) => p.replace('*', ''));
        for (const p of spec.filter((x) => x.endsWith('*'))) if (!(p.slice(0, -1) in c.params)) errors.push(`${where}: ${c.id} thiếu tham số bắt buộc "${p.slice(0, -1)}"`);
        for (const p of Object.keys(c.params)) if (!known.includes(p)) errors.push(`${where}: ${c.id} không có tham số "${p}" (có: ${known.join(', ') || '—'})`);
        const v = c.params;
        if (v.item && !ITEMS[v.item]) errors.push(`${where}: vật phẩm "${v.item}" không tồn tại`);
        if (v.loc && !LOCATION_DEFS[v.loc]) errors.push(`${where}: địa điểm "${v.loc}" không tồn tại`);
        if (v.region && v.region !== '$here' && !REGIONS.includes(v.region as never)) errors.push(`${where}: vùng "${v.region}" không tồn tại`);
        if (v.skill && !SKILL_DEFS[v.skill as keyof typeof SKILL_DEFS]) errors.push(`${where}: kỹ năng "${v.skill}" không tồn tại`);
        if (v.condition && !CONDITIONS[v.condition]) errors.push(`${where}: trạng thái "${v.condition}" không tồn tại`);
        if (v.kind && c.id === 'spawn_object' && !OBJECT_DEFS[v.kind]) errors.push(`${where}: vật thể "${v.kind}" không tồn tại`);
        if (v.route && v.route !== 'random' && !ROUTE_DEFS.some((r) => r.id === v.route)) errors.push(`${where}: tuyến đường "${v.route}" không tồn tại`);
        if (c.id === 'schedule_event' && !eventIds.has(v.event) && !dataEventIds.has(v.event)) errors.push(`${where}: sự kiện "${v.event}" không tồn tại`);
      }
    });

  const checkCheck = (where: string, r: { attr: string; skill: string; dc: number | ''; crit: string; mods: string; opposed: string }) => {
    if (!r.attr) {
      if (r.dc !== '' || r.skill) errors.push(`${where}: có DC/kỹ năng nhưng thiếu Thuộc tính`);
      return;
    }
    if (!ATTRS.includes(r.attr as never)) errors.push(`${where}: thuộc tính "${r.attr}" không hợp lệ (${ATTRS.join(', ')})`);
    if (r.skill && !SKILL_DEFS[r.skill as keyof typeof SKILL_DEFS]) errors.push(`${where}: kỹ năng "${r.skill}" không tồn tại`);
    if (r.dc === '' && !r.opposed) errors.push(`${where}: thiếu DC (hoặc cột Đối kháng)`);
    if (!CRITS.includes(r.crit)) errors.push(`${where}: Crit phải là standard, safe hoặc none`);
    at(where, () => {
      for (const m of parseMods(r.mods)) checkConds(where, m.when);
      parseOpposed(r.opposed);
    });
  };

  const checkCode = (where: string, code: string, re: RegExp) => {
    if (!re.test(code)) errors.push(`${where}: mã "${code}" sai định dạng`);
    else if (codes.has(code)) errors.push(`${where}: mã "${code}" bị trùng`);
    codes.add(code);
  };

  // ---------------- actions
  for (const a of pack.actions) {
    const where = `Actions/${a.id || '?'}`;
    if (!/^[a-z][a-z0-9_]*$/.test(a.id)) errors.push(`${where}: ID chỉ gồm chữ thường, số và _`);
    if (ids.has(a.id) || CODE_ACTION_IDS.has(a.id)) errors.push(`${where}: ID bị trùng với nội dung khác`);
    ids.add(a.id);
    checkCode(where, a.code, /^ACT-(EXP|GAT|HUN|FSH|CRF|BLD|COK|MED|RES|NAV|SOC|ESC)-\d{3}$/);
    if (!(a.code.split('-')[1] in ACTION_CATEGORY_NAMES)) errors.push(`${where}: loại hành động không hợp lệ`);
    void (a.code.split('-')[1] as ActionCategory);
    if (!(a.group in GROUP_NAMES)) errors.push(`${where}: Nhóm "${a.group}" không hợp lệ (${Object.keys(GROUP_NAMES).join(', ')})`);
    if (![1, 2, 3].includes(Number(a.tier))) errors.push(`${where}: Bậc phải là 1, 2 hoặc 3`);
    if (!a.name) errors.push(`${where}: thiếu Tên`);
    at(where, () => checkConds(where, parseConditions(a.conditions)));
    at(where, () => checkConds(where, parseConditions(a.requires)));
    at(where, () => {
      for (const m of parseMaterials(a.materials)) if (!ITEMS[m.id]) errors.push(`${where}: vật liệu "${m.id}" không tồn tại`);
    });
    checkCheck(where, a);
    const outs = pack.outcomes.filter((o) => o.owner === a.id);
    if (!outs.length) errors.push(`${where}: chưa có dòng Outcomes nào`);
    if (a.attr && !outs.some((o) => o.tier === 'success')) warnings.push(`${where}: có tung xúc xắc nhưng không có kết quả "success"`);
    if (!a.attr && !outs.some((o) => o.tier === 'success' || o.tier === 'always')) errors.push(`${where}: không tung xúc xắc thì cần kết quả "success" hoặc "always"`);
  }

  // ---------------- events
  for (const e of pack.events) {
    const where = `Events/${e.id || '?'}`;
    if (!/^[a-z][a-z0-9_]*$/.test(e.id)) errors.push(`${where}: ID chỉ gồm chữ thường, số và _`);
    if (ids.has(e.id) || CODE_EVENT_IDS.has(e.id)) errors.push(`${where}: ID bị trùng với nội dung khác`);
    ids.add(e.id);
    checkCode(where, e.code, /^EVT-(WTH|WLD|ECO|DIS|RES|BAS|HEA|PSY|NAR|ESC)-\d{3}$/);
    if (!CATEGORIES.includes(e.category)) errors.push(`${where}: Loại "${e.category}" không hợp lệ`);
    else if (EVENT_CODE[e.category] !== e.code.split('-')[1]) warnings.push(`${where}: mã ${e.code} không khớp loại ${e.category} (${EVENT_CODE[e.category]})`);
    if (!RARITIES.includes(e.rarity)) errors.push(`${where}: Độ hiếm "${e.rarity}" không hợp lệ`);
    if (!SOURCES.includes(e.source)) errors.push(`${where}: Nguồn "${e.source}" không hợp lệ`);
    if (!TRIGGERS.includes(e.trigger)) errors.push(`${where}: Kích hoạt "${e.trigger}" không hợp lệ`);
    if (e.trigger === 'after_action') {
      if (!list(e.onAction).length && Number(e.weight || 0) > 0) errors.push(`${where}: kích hoạt sau hành động cần cột "Sau hành động"`);
      for (const id of list(e.onAction)) if (!CODE_ACTION_IDS.has(id) && !pack.actions.some((a) => a.id === id)) errors.push(`${where}: hành động "${id}" không tồn tại`);
    }
    if (![1, 2, 3, 4].includes(Number(e.risk))) errors.push(`${where}: Rủi ro phải từ 1 đến 4`);
    if (!e.text) errors.push(`${where}: thiếu Nội dung`);
    at(where, () => checkConds(where, parseConditions(e.conditions)));
    at(where, () => {
      for (const r of parseContext(e.context)) checkConds(where, r.when);
    });
    const choices = pack.choices.filter((c) => c.event === e.id);
    const passive = pack.outcomes.filter((o) => o.owner === `event:${e.id}`);
    if (!choices.length && !passive.length) errors.push(`${where}: không có lựa chọn và cũng không có kết quả bị động (event:${e.id})`);
    // meaningful risk (Phase 2 rule)
    if (Number(e.risk) >= 2 && !choices.length && !e.cause) errors.push(`${where}: rủi ro ≥ 2 cần có lựa chọn hoặc cột "Vì sao"`);
    if (Number(e.weight || 0) <= 0 && e.source !== 'persistent') warnings.push(`${where}: trọng số 0 — chỉ xảy ra khi được hẹn (schedule_event)`);
  }

  // ---------------- choices
  const choiceKeys = new Set<string>();
  for (const c of pack.choices) {
    const where = `Choices/${c.event}:${c.id}`;
    if (!dataEventIds.has(c.event)) errors.push(`${where}: sự kiện "${c.event}" không có trong sheet Events`);
    if (choiceKeys.has(`${c.event}:${c.id}`)) errors.push(`${where}: ID lựa chọn bị trùng`);
    choiceKeys.add(`${c.event}:${c.id}`);
    if (!c.label) errors.push(`${where}: thiếu Nhãn`);
    at(where, () => checkConds(where, parseConditions(c.requires)));
    at(where, () => {
      for (const m of parseMaterials(c.materials)) if (!ITEMS[m.id]) errors.push(`${where}: vật liệu "${m.id}" không tồn tại`);
    });
    checkCheck(where, c);
    const outs = pack.outcomes.filter((o) => o.owner === `${c.event}:${c.id}`);
    if (!outs.length) warnings.push(`${where}: chưa có dòng Outcomes nào`);
  }

  // ---------------- outcomes
  const owners = new Set([...pack.actions.map((a) => a.id), ...pack.events.map((e) => `event:${e.id}`), ...choiceKeys]);
  pack.outcomes.forEach((o, i) => {
    const where = `Outcomes/dòng ${i + 2} (${o.owner})`;
    if (!owners.has(o.owner)) errors.push(`${where}: "Thuộc về" không khớp hành động, event:<id> hay <sự kiện>:<lựa chọn> nào`);
    if (!TIERS.includes(o.tier)) errors.push(`${where}: Mức kết quả "${o.tier}" không hợp lệ (${TIERS.join(', ')})`);
    at(where, () => checkConds(where, parseConditions(o.if)));
    checkCons(where, o.consequences);
    if (!o.text && !o.consequences) warnings.push(`${where}: dòng trống (không lời kể, không hậu quả)`);
  });

  return { errors, warnings };
}
