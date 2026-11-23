import { ITEMS } from '../content/items.js';
import { WEATHER_DEFS } from '../content/weather.js';
import { awardXp, roll } from './check.js';
import { isSuccess, loseCarried, victory } from './common.js';
import { Ctx, waterCount } from './ctx.js';
import { advanceSlots, checkDeath } from './time.js';
import type { AttrId, CheckSpec, GameState, SkillId } from './types.js';

export interface EscapeStageDef {
  name: string;
  desc: string;
  attr: AttrId;
  skill: SkillId;
  dc: number;
}

export const RAFT_JOURNEY: EscapeStageDef[] = [
  { name: 'Vượt sóng bờ', desc: 'Chèo qua những con sóng đổ ven bờ và dải đá ngầm.', attr: 'STR', skill: 'navigation', dc: 13 },
  { name: 'Lênh đênh giữa biển', desc: 'Nhiều giờ dài dưới nắng gió. Nước uống và thức ăn mang theo sẽ quyết định sức chịu đựng.', attr: 'END', skill: 'survival', dc: 14 },
  { name: 'Tìm đường vào bờ', desc: 'Dựa vào hải lưu, sao trời và hướng gió để tới đất liền hoặc tuyến hàng hải.', attr: 'INT', skill: 'navigation', dc: 15 },
];

export const DESPERATE_JOURNEY: EscapeStageDef[] = [
  { name: 'Lao qua sóng dữ', desc: 'Bám chặt khúc gỗ, vượt qua vùng sóng đổ.', attr: 'STR', skill: 'survival', dc: 19 },
  { name: 'Bám trụ giữa đại dương', desc: 'Không nước, không bóng râm. Chỉ có ý chí.', attr: 'END', skill: 'survival', dc: 20 },
  { name: 'Cầu may', desc: 'Hy vọng dòng nước đưa bạn tới một con tàu.', attr: 'PER', skill: 'navigation', dc: 21 },
];

/** penalties, shared by the rules below and the player-facing escape planner */
export const ESCAPE_PENALTY = {
  ashoreEnergy: 25,
  desperate: { firstStageDamage: 20, laterStageDamage: 30, critExtra: 15, lossFrac: 0.6 },
  raft: {
    partial: { integrity: 15, health: 5 },
    failure: { integrity: 25, health: 8 },
    critFailure: { integrity: 45, health: 15 },
    retryPenalty: 2,
    wreck: { dc: 14, luckyDamage: 12, luckyLoss: 0.4, badDamage: 30, badLoss: 0.7 },
  },
  openSea: { hunger: 10, thirst: 15 },
};
const P = ESCAPE_PENALTY;

export function journey(method: 'raft' | 'desperate') {
  return method === 'raft' ? RAFT_JOURNEY : DESPERATE_JOURNEY;
}

/**
 * The checks each stage would use if the player set off right now — for the
 * planner. Without a raft, the raft route is previewed as a fresh crude raft.
 */
export function previewStages(s: GameState, method: 'raft' | 'desperate'): CheckSpec[] {
  const projects = method === 'raft' && !s.projects.some((p) => p.id === 'raft')
    ? [...s.projects, { id: 'raft' as const, region: 'coast' as const, stage: 1, integrity: 70 }]
    : s.projects;
  return journey(method).map((_, stage) =>
    stageCheck({ ...s, projects, escape: { method, stage, adv: 0, dcPenalty: 0, canReturn: false, log: [] } }),
  );
}

export function penaltyText(method: 'raft' | 'desperate'): string[] {
  if (method === 'desperate') {
    const d = P.desperate;
    return [
      `Mọi kết quả kém hơn "Thành công" ở bất kỳ chặng nào: bị sóng đánh dạt về Bãi biển.`,
      `Mất ${d.firstStageDamage} Sức khỏe nếu thất bại ở chặng 1, ${d.laterStageDamage} ở chặng 2–3 (thêm ${d.critExtra} nếu thất bại thảm hại).`,
      `Mất ${P.ashoreEnergy} Năng lượng và khoảng ${d.lossFrac * 100}% đồ đang mang theo (trôi mất).`,
      `Khúc gỗ/thùng phuy làm phao bị mất ngay khi xuất phát.`,
      `Nếu Sức khỏe về 0: kết thúc ván chơi.`,
    ];
  }
  const r = P.raft;
  return [
    `Thành công một phần: vẫn qua chặng, nhưng bè -${r.partial.integrity} độ bền và Sức khỏe -${r.partial.health}.`,
    `Thất bại: bè -${r.failure.integrity} độ bền, Sức khỏe -${r.failure.health}. Có thể thử lại (khó hơn ${r.retryPenalty} điểm mỗi lần) hoặc quay về đảo.`,
    `Thất bại thảm hại: bè -${r.critFailure.integrity} độ bền, Sức khỏe -${r.critFailure.health}.`,
    `Bè vỡ (độ bền về 0): mất bè; tung thêm Sức bền + Sinh tồn (DC ${r.wreck.dc}) — đạt: mất ${r.wreck.luckyDamage} Sức khỏe và ~${r.wreck.luckyLoss * 100}% đồ; trượt: mất ${r.wreck.badDamage} Sức khỏe và ~${r.wreck.badLoss * 100}% đồ. Kèm -${P.ashoreEnergy} Năng lượng.`,
    `Chặng 2 lênh đênh trên biển: No bụng -${P.openSea.hunger}, Nước -${P.openSea.thirst}.`,
    `Nếu Sức khỏe về 0: kết thúc ván chơi.`,
  ];
}

export function stageCheck(s: GameState): CheckSpec {
  const e = s.escape!;
  const st = journey(e.method)[e.stage];
  const mods: { label: string; value: number }[] = [];
  const w = s.world.weather;
  const wd = WEATHER_DEFS[w];
  if (wd.sea) mods.push({ label: `${wd.icon} ${wd.name}`, value: wd.sea });
  if ((w === 'hot' || w === 'humid') && e.stage === 1) mods.push({ label: `${wd.icon} Nóng bức giữa biển`, value: -1 });
  if (s.flags.calmSeaDay === s.day) mods.push({ label: 'Biển lặng', value: 2 });
  if (e.method === 'raft') {
    const raft = s.projects.find((p) => p.id === 'raft');
    const q = raft?.stage ?? 1;
    if (q === 1) mods.push({ label: 'Bè thô sơ', value: -3 });
    if (q === 3) mods.push({ label: 'Có buồm', value: 2 });
    const integ = raft?.integrity ?? 0;
    if (integ < 40) mods.push({ label: 'Bè hư hại nặng', value: -4 });
    else if (integ < 70) mods.push({ label: 'Bè hư hại', value: -2 });
    if (e.stage === 0 && s.flags.raft_design) mods.push({ label: 'Bè đóng theo bản vẽ', value: 1 });
  }
  if (e.stage === 2 || (e.method === 'desperate' && e.stage === 1)) {
    if (s.world.currents) mods.push({ label: 'Hiểu hải lưu', value: s.world.currents });
  }
  if (e.stage === 2 && s.inventory.some((x) => x.id === 'chart')) mods.push({ label: 'Hải đồ', value: 2 });
  if (e.stage === 1) {
    const water = waterCount(s.inventory);
    const food = s.inventory.reduce((a, x) => (ITEMS[x.id]?.kind === 'food' ? a + x.qty : a), 0);
    if (water < 3 || food < 2) mods.push({ label: 'Thiếu nước/lương thực', value: -3 });
  }
  if (e.dcPenalty) mods.push({ label: 'Thử lại sau thất bại', value: -e.dcPenalty });
  return {
    label: st.name,
    attr: st.attr,
    skill: st.skill,
    dc: st.dc,
    adv: e.adv,
    mods,
  };
}

/** washed back to the island: player survives (unless Health hits 0) */
function castAshore(ctx: Ctx, damage: number, lossFrac: number, text: string) {
  const s = ctx.s;
  ctx.say(text);
  ctx.vital('health', -damage, 'Bị sóng đánh dạt');
  ctx.vital('energy', -P.ashoreEnergy, 'Kiệt sức trên biển');
  loseCarried(ctx, lossFrac);
  s.location = 'coast';
  s.escape = null;
  ctx.journal('Thoát đảo thất bại, bị sóng đánh dạt trở lại bãi biển.', 'escape');
}

function wreckRaft(ctx: Ctx) {
  const s = ctx.s;
  s.projects = s.projects.filter((p) => p.id !== 'raft');
  ctx.change('loss', '🛶 Chiếc bè đã vỡ tan');
  const nat = ctx.rng.d20();
  const total = nat + s.attrs.END + s.skills.survival.lvl;
  const W = P.raft.wreck;
  if (total >= W.dc) castAshore(ctx, W.luckyDamage, W.luckyLoss, 'Bè vỡ tan giữa sóng. Bạn bám vào một mảnh gỗ và may mắn trôi dạt về bãi biển.');
  else castAshore(ctx, W.badDamage, W.badLoss, 'Bè vỡ tan. Bạn chìm nổi giữa sóng hàng giờ liền trước khi bị đánh dạt vào bờ, thương tích đầy mình.');
}

export function escapeDecision(ctx: Ctx, decision: 'roll' | 'return') {
  const s = ctx.s;
  const e = s.escape!;
  const stages = journey(e.method);
  const st = stages[e.stage];

  if (decision === 'return') {
    if (!e.canReturn) throw new Error('Không thể quay về lúc này');
    ctx.res.title = 'Quay về đảo';
    ctx.res.icon = '🏝️';
    ctx.say('Bạn quay mũi bè, vất vả chèo ngược về bãi biển.');
    s.escape = null;
    s.location = 'coast';
    ctx.journal('Từ bỏ chuyến ra khơi, quay bè về đảo.', 'escape');
    advanceSlots(ctx, 1);
    return;
  }

  ctx.res.title = `${e.method === 'raft' ? 'Ra khơi' : 'Liều mình ra khơi'} — ${st.name} (${e.stage + 1}/3)`;
  ctx.res.icon = e.method === 'raft' ? '⛵' : '🌊';
  const spec = stageCheck(s);
  const info = roll(ctx, spec);
  ctx.res.roll = info;
  awardXp(ctx, spec, info, `escape:${e.method}:${e.stage}`);
  e.adv = 0;
  const tier = info.tier;

  // the sea takes its toll on every stage
  if (e.stage === 1) {
    ctx.vital('hunger', -P.openSea.hunger, 'Lênh đênh trên biển');
    ctx.vital('thirst', -P.openSea.thirst, 'Lênh đênh trên biển');
  }

  if (e.method === 'desperate') {
    if (isSuccess(tier)) {
      ctx.say(tier === 'crit_success' ? 'Một phép màu! Mọi thứ diễn ra suôn sẻ đến khó tin.' : 'Bạn vượt qua được — bằng ý chí và may mắn.');
      return advanceStage(ctx);
    }
    const D = P.desperate;
    const dmg = (e.stage === 0 ? D.firstStageDamage : D.laterStageDamage) + (tier === 'crit_failure' ? D.critExtra : 0);
    castAshore(ctx, dmg, D.lossFrac,'Biển cả quá khắc nghiệt. Sóng nhấn chìm bạn hết lần này tới lần khác, rồi quăng bạn trở lại bờ cát.');
    advanceSlots(ctx, 1);
    checkDeath(ctx);
    return;
  }

  // raft
  const raft = s.projects.find((p) => p.id === 'raft')!;
  switch (tier) {
    case 'crit_success':
      ctx.say('Mọi thứ thuận lợi tuyệt vời! Bạn tiến nhanh và có lợi thế ở chặng sau.');
      e.adv = 1;
      return advanceStage(ctx);
    case 'success':
      ctx.say('Bạn vượt qua chặng này an toàn.');
      return advanceStage(ctx);
    case 'partial':
      ctx.say('Bạn vượt qua được, nhưng phải trả giá.');
      raft.integrity -= P.raft.partial.integrity;
      ctx.change('bad', `Bè hư hại (độ bền ${Math.max(0, raft.integrity)}%)`);
      ctx.vital('health', -P.raft.partial.health, 'Sóng đánh');
      if (raft.integrity <= 0) {
        wreckRaft(ctx);
        advanceSlots(ctx, 1);
        return;
      }
      return advanceStage(ctx);
    case 'failure':
    case 'crit_failure': {
      const pen = tier === 'crit_failure' ? P.raft.critFailure : P.raft.failure;
      raft.integrity -= pen.integrity;
      ctx.vital('health', -pen.health, 'Sóng đánh');
      if (raft.integrity <= 0) {
        wreckRaft(ctx);
        advanceSlots(ctx, 1);
        return;
      }
      ctx.change('bad', `Bè hư hại nặng (độ bền ${raft.integrity}%)`);
      ctx.say(
        e.stage === 0
          ? 'Một con sóng lớn hất bè dạt ngược vào bờ. Bạn có thể thử lại — hoặc quay vào nghỉ ngơi.'
          : 'Bạn bị dòng nước cuốn lệch hướng. Có thể cố gắng tiếp — hoặc quay về đảo khi còn kịp.',
      );
      e.canReturn = true;
      e.dcPenalty += P.raft.retryPenalty;
      advanceSlots(ctx, 1, { atSea: true });
      if (checkDeath(ctx)) s.escape = null;
      return;
    }
  }
}

function advanceStage(ctx: Ctx) {
  const s = ctx.s;
  const e = s.escape!;
  e.stage++;
  e.dcPenalty = 0;
  e.canReturn = e.method === 'raft' && e.stage < 3;
  if (e.stage >= 3) {
    if (e.method === 'raft') {
      victory(
        ctx,
        'escape_raft',
        'Thoát đảo bằng bè',
        'Sau nhiều giờ lênh đênh, bạn bắt gặp tuyến hàng hải. Một tàu đánh cá phát hiện chiếc bè nhỏ và kéo bạn lên boong.',
      );
    } else {
      victory(
        ctx,
        'escape_desperate',
        'Phép màu giữa đại dương',
        'Ôm khúc gỗ trôi dạt hai ngày đêm, bạn được một tàu cá vớt lên trong tình trạng thập tử nhất sinh. Không ai tin nổi câu chuyện của bạn.',
      );
    }
    return;
  }
  advanceSlots(ctx, 1, { atSea: true });
  if (checkDeath(ctx)) s.escape = null;
}
