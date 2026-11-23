import { ITEMS } from '../content/items.ts';
import { awardXp, roll } from './check.ts';
import { isSuccess, loseCarried, victory } from './common.ts';
import { Ctx, waterCount } from './ctx.ts';
import { advanceSlots, checkDeath } from './time.ts';
import type { AttrId, CheckSpec, GameState, SkillId } from './types.ts';

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

export function journey(method: 'raft' | 'desperate') {
  return method === 'raft' ? RAFT_JOURNEY : DESPERATE_JOURNEY;
}

export function stageCheck(s: GameState): CheckSpec {
  const e = s.escape!;
  const st = journey(e.method)[e.stage];
  const mods: { label: string; value: number }[] = [];
  const w = s.world.weather;
  const wm: Record<string, number> = { clear: 1, hot: 0, cloudy: -1, rain: -3, storm: -8 };
  if (wm[w]) mods.push({ label: w === 'clear' ? 'Trời quang' : w === 'cloudy' ? 'Trời âm u' : w === 'rain' ? 'Mưa gió' : 'Bão', value: wm[w] });
  if (w === 'hot' && e.stage === 1) mods.push({ label: 'Nắng gắt', value: -1 });
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
  ctx.vital('energy', -25, 'Kiệt sức trên biển');
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
  if (total >= 14) castAshore(ctx, 12, 0.4, 'Bè vỡ tan giữa sóng. Bạn bám vào một mảnh gỗ và may mắn trôi dạt về bãi biển.');
  else castAshore(ctx, 30, 0.7, 'Bè vỡ tan. Bạn chìm nổi giữa sóng hàng giờ liền trước khi bị đánh dạt vào bờ, thương tích đầy mình.');
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
    ctx.vital('hunger', -10, 'Lênh đênh trên biển');
    ctx.vital('thirst', -15, 'Lênh đênh trên biển');
  }

  if (e.method === 'desperate') {
    if (isSuccess(tier)) {
      ctx.say(tier === 'crit_success' ? 'Một phép màu! Mọi thứ diễn ra suôn sẻ đến khó tin.' : 'Bạn vượt qua được — bằng ý chí và may mắn.');
      return advanceStage(ctx);
    }
    const dmg = (e.stage === 0 ? 20 : 30) + (tier === 'crit_failure' ? 15 : 0);
    castAshore(ctx, dmg, 0.6, 'Biển cả quá khắc nghiệt. Sóng nhấn chìm bạn hết lần này tới lần khác, rồi quăng bạn trở lại bờ cát.');
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
      raft.integrity -= 15;
      ctx.change('bad', `Bè hư hại (độ bền ${Math.max(0, raft.integrity)}%)`);
      ctx.vital('health', -5, 'Sóng đánh');
      if (raft.integrity <= 0) {
        wreckRaft(ctx);
        advanceSlots(ctx, 1);
        return;
      }
      return advanceStage(ctx);
    case 'failure':
    case 'crit_failure': {
      const dmg = tier === 'crit_failure' ? 45 : 25;
      raft.integrity -= dmg;
      ctx.vital('health', tier === 'crit_failure' ? -15 : -8, 'Sóng đánh');
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
      e.dcPenalty += 2;
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
