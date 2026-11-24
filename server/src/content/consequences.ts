// Consequence registry (GDD Diversity-01 §5). A consequence is a meaningful,
// reusable change to the game with its own code and function. Events, actions and
// world objects apply consequences by id with parameters (see engine/consequence.ts).
// Counting rule: different numbers / items for the same mechanic are the SAME
// consequence (vital_change with -5 or -10 is one entry).

import { LOCATION_DEFS, ROUTE_DEFS } from './defs.js';
import { ITEMS } from './items.js';
import { OBJECT_DEFS } from './objects.js';
import { LOCATION_STATES } from './locationStates.js';
import { loseCarried } from '../engine/common.js';
import { type Ctx, regionName } from '../engine/ctx.js';
import type { ConParams, GameState, RegionId, ResourceKind, SkillId, VitalId } from '../engine/types.js';

export type ConType = 'immediate' | 'delayed' | 'persistent' | 'environmental' | 'opportunity' | 'chain';
export type ConTarget = 'character' | 'inventory' | 'region' | 'route' | 'location' | 'structure' | 'knowledge' | 'world' | 'story';
export type ConPersistence = 'instant' | 'temporary' | 'until_resolved' | 'environmental_recovery' | 'permanent';

export interface ConsequenceDef {
  code: string;
  id: string;
  name: string;
  type: ConType;
  target: ConTarget;
  persistence: ConPersistence;
  desc: string;
  /** what it acts on (for conflict detection within one transaction) */
  key?: (p: ConParams) => string;
  /** consequence ids that contradict this one on the same key in the same transaction */
  conflicts?: string[];
  /** precondition — a consequence that makes no sense in the current world is skipped */
  requires?: (s: GameState, p: ConParams) => boolean;
  /** default delay (slots) for delayed consequences */
  delay?: number;
  apply: (ctx: Ctx, p: ConParams) => void;
}

const str = (p: ConParams, k: string, d = '') => String(p[k] ?? d);
const num = (p: ConParams, k: string, d = 0) => Number(p[k] ?? d);

/** open, known, safe routes a random blockage can hit (optionally limited to `among`) */
function randomRoutes(s: GameState, p: ConParams) {
  const among = p.among ? str(p, 'among').split(',') : null;
  return s.routes.filter((r) => r.known && r.status === 'open' && !r.danger && r.id !== 'coast-jungle' && (!among || among.includes(r.id)));
}

const defs: ConsequenceDef[] = [
  // ======================================================== IMMEDIATE
  {
    code: 'CON-IMM-001', id: 'vital_change', name: 'Thay đổi chỉ số sinh tồn', type: 'immediate', target: 'character', persistence: 'instant',
    desc: 'Tăng/giảm Sức khỏe, No bụng, Nước hoặc Năng lượng.',
    apply: (ctx, p) => ctx.vital(str(p, 'vital') as VitalId, num(p, 'amount'), p.cause ? str(p, 'cause') : undefined),
  },
  {
    code: 'CON-IMM-002', id: 'gain_item', name: 'Nhận vật phẩm', type: 'immediate', target: 'inventory', persistence: 'instant',
    desc: 'Nhận vật phẩm (vào hành trang, hoặc kho nếu đầy và đang ở căn cứ).',
    requires: (_s, p) => !!ITEMS[str(p, 'item')],
    apply: (ctx, p) => {
      ctx.addItem(str(p, 'item'), num(p, 'qty', 1), p.risk !== undefined ? { risk: num(p, 'risk') } : {});
    },
  },
  {
    code: 'CON-IMM-003', id: 'lose_item', name: 'Mất vật phẩm', type: 'immediate', target: 'inventory', persistence: 'instant',
    desc: 'Mất một số vật phẩm cụ thể.',
    apply: (ctx, p) => {
      ctx.removeItem(str(p, 'item'), num(p, 'qty', 1));
    },
  },
  {
    code: 'CON-IMM-004', id: 'gain_xp', name: 'Kinh nghiệm kỹ năng', type: 'immediate', target: 'character', persistence: 'instant',
    desc: 'Nhận XP cho một kỹ năng.',
    apply: (ctx, p) => ctx.grantXp(str(p, 'skill') as SkillId, num(p, 'amount', 5)),
  },
  {
    code: 'CON-IMM-005', id: 'injury', name: 'Bị thương', type: 'immediate', target: 'character', persistence: 'until_resolved',
    desc: 'Thương tích (cộng dồn mức độ, tối đa 3).',
    apply: (ctx, p) => ctx.addCondition('injury', num(p, 'sev', 1)),
  },
  {
    code: 'CON-IMM-006', id: 'illness', name: 'Ngộ độc / đau bụng', type: 'immediate', target: 'character', persistence: 'until_resolved',
    desc: 'Bệnh đường ruột, giảm dần qua đêm.',
    apply: (ctx, p) => ctx.addCondition('illness', num(p, 'sev', 1)),
  },
  {
    code: 'CON-IMM-007', id: 'poisoned', name: 'Trúng độc', type: 'immediate', target: 'character', persistence: 'temporary',
    desc: 'Mất Sức khỏe mỗi buổi cho tới khi hết độc.',
    apply: (ctx, p) => ctx.addCondition('poisoned', 1, num(p, 'slots', 3)),
  },
  {
    code: 'CON-IMM-008', id: 'exposure', name: 'Nhiễm lạnh', type: 'immediate', target: 'character', persistence: 'temporary',
    desc: 'Kiểm tra -1, ngủ hồi sức kém.',
    apply: (ctx, p) => ctx.addCondition('exposure', 1, num(p, 'slots', 8)),
  },
  {
    code: 'CON-IMM-009', id: 'shaken', name: 'Hoảng sợ', type: 'immediate', target: 'character', persistence: 'temporary',
    desc: 'Kiểm tra PER/INT -1 trong một thời gian.',
    conflicts: ['determined'],
    key: () => 'mood',
    apply: (ctx, p) => ctx.addCondition('shaken', 1, num(p, 'slots', 4)),
  },
  {
    code: 'CON-IMM-010', id: 'determined', name: 'Quyết tâm', type: 'immediate', target: 'character', persistence: 'temporary',
    desc: 'Mọi kiểm tra +1 trong một thời gian.',
    conflicts: ['shaken'],
    key: () => 'mood',
    apply: (ctx, p) => ctx.addCondition('determined', 1, num(p, 'slots', 6)),
  },
  {
    code: 'CON-IMM-011', id: 'infection', name: 'Nhiễm trùng', type: 'immediate', target: 'character', persistence: 'until_resolved',
    desc: 'Mất Sức khỏe mỗi đêm cho tới khi chữa.',
    apply: (ctx) => ctx.addCondition('infection'),
  },
  {
    code: 'CON-IMM-012', id: 'cure_condition', name: 'Khỏi một trạng thái', type: 'immediate', target: 'character', persistence: 'instant',
    desc: 'Xóa một trạng thái đang mắc.',
    apply: (ctx, p) => ctx.removeCondition(str(p, 'condition')),
  },
  {
    code: 'CON-IMM-013', id: 'tool_wear', name: 'Hao mòn công cụ', type: 'immediate', target: 'inventory', persistence: 'instant',
    desc: 'Công cụ mất độ bền, có thể hỏng.',
    apply: (ctx, p) => {
      ctx.useTool(str(p, 'tag'), num(p, 'wear', 1));
    },
  },
  {
    code: 'CON-IMM-014', id: 'lose_carried', name: 'Mất đồ mang theo', type: 'immediate', target: 'inventory', persistence: 'instant',
    desc: 'Một phần đồ đang mang bị trôi mất / rơi mất.',
    apply: (ctx, p) => loseCarried(ctx, num(p, 'frac', 0.5)),
  },
  {
    code: 'CON-IMM-015', id: 'food_stolen', name: 'Bị lấy mất thức ăn', type: 'immediate', target: 'inventory', persistence: 'instant',
    desc: 'Thú rừng lấy mất một phần thức ăn trong kho (hoặc hành trang nếu chưa có căn cứ).',
    apply: (ctx, p) => {
      const s = ctx.s;
      const list = s.baseRegion ? s.storage : s.inventory;
      for (const st of list) {
        if (ITEMS[st.id]?.kind !== 'food') continue;
        const n = Math.min(st.qty, Math.max(p.minOne ? 1 : 0, Math.round(st.qty * num(p, 'frac', 0.3))));
        if (n > 0) {
          st.qty -= n;
          ctx.change('loss', `-${n} ${ITEMS[st.id].icon} ${ITEMS[st.id].name}`);
        }
      }
      ctx.prune(list);
    },
  },

  // ======================================================== DELAYED
  {
    code: 'CON-DLY-001', id: 'delayed_infection', name: 'Vết thương nhiễm trùng muộn', type: 'delayed', target: 'character', persistence: 'until_resolved',
    desc: 'Sau một thời gian, vết thương chưa băng bó sẽ nhiễm trùng.',
    delay: 4,
    requires: (s) => s.conditions.some((c) => c.id === 'injury' && !c.treated),
    apply: (ctx) => {
      ctx.addCondition('infection');
      ctx.journal('Vết thương không được băng bó đã nhiễm trùng.', 'consequence');
    },
  },
  {
    code: 'CON-DLY-002', id: 'delayed_food_poisoning', name: 'Ngộ độc thực phẩm muộn', type: 'delayed', target: 'character', persistence: 'until_resolved',
    desc: 'Vài buổi sau khi ăn đồ hỏng, cơn đau bụng mới kéo đến.',
    delay: 2,
    apply: (ctx) => {
      ctx.addCondition('illness', 1);
      ctx.change('bad', '🤢 Bụng bắt đầu quặn đau vì món ăn lúc trước');
    },
  },
  {
    code: 'CON-DLY-003', id: 'delayed_fatigue', name: 'Kiệt sức muộn', type: 'delayed', target: 'character', persistence: 'instant',
    desc: 'Gắng sức quá độ khiến cơ thể sụp xuống sau đó.',
    delay: 2,
    apply: (ctx, p) => ctx.vital('energy', -num(p, 'amount', 15), 'Kiệt sức sau khi gắng quá sức'),
  },

  // ======================================================== PERSISTENT
  {
    code: 'CON-PER-001', id: 'water_contaminated', name: 'Nguồn nước suối bị ô nhiễm', type: 'persistent', target: 'region', persistence: 'until_resolved',
    desc: 'Nước suối rất dễ gây bệnh cho tới khi xử lý nguồn ô nhiễm hoặc tự hồi phục.',
    key: () => 'river_water',
    conflicts: ['water_cleaned'],
    requires: (s) => s.regions.river.water !== 'contaminated',
    apply: (ctx, p) => {
      ctx.s.regions.river.water = 'contaminated';
      ctx.flag('contamDays', num(p, 'days', 7));
      ctx.s.chains.contamination = { status: 'active', step: 0 };
    },
  },
  {
    code: 'CON-PER-002', id: 'water_cleaned', name: 'Nguồn ô nhiễm đã được xử lý', type: 'persistent', target: 'region', persistence: 'instant',
    desc: 'Nước suối sẽ trong lại từ ngày mai.',
    key: () => 'river_water',
    conflicts: ['water_contaminated'],
    apply: (ctx) => ctx.flag('contamCleared'),
  },
  {
    code: 'CON-PER-003', id: 'area_danger', name: 'Khu vực trở nên nguy hiểm', type: 'persistent', target: 'region', persistence: 'temporary',
    desc: 'Săn bắt trong rừng khó hơn trong một thời gian.',
    apply: (ctx, p) => {
      ctx.flag('jungleDangerUntil', ctx.now + num(p, 'slots', 12));
      ctx.change('bad', '⚠️ Rừng nguy hiểm: săn bắt khó hơn (-3)');
    },
  },
  {
    code: 'CON-PER-004', id: 'camp_guarded', name: 'Trại được rào tạm', type: 'persistent', target: 'structure', persistence: 'temporary',
    desc: 'Thú rừng không phá được kho trong vài ngày.',
    apply: (ctx, p) => ctx.flag('campGuarded', ctx.s.day + num(p, 'days', 4)),
  },
  {
    code: 'CON-PER-005', id: 'damp_fuel', name: 'Củi ẩm', type: 'persistent', target: 'world', persistence: 'temporary',
    desc: 'Nhóm lửa -3 trong ngày.',
    apply: (ctx) => ctx.flag('dampDay', ctx.s.day),
  },
  {
    code: 'CON-PER-006', id: 'hunt_bonus', name: 'Biết lối mòn thú', type: 'persistent', target: 'knowledge', persistence: 'temporary',
    desc: 'Săn bắt +2 trong một thời gian.',
    apply: (ctx, p) => {
      ctx.flag('huntBonusUntil', ctx.now + num(p, 'slots', 8));
      ctx.change('good', `Săn bắt ở Rừng rậm +2 trong ${Math.round(num(p, 'slots', 8) / 4)} ngày`);
    },
  },
  {
    code: 'CON-PER-007', id: 'fish_run', name: 'Đàn cá vào bờ', type: 'persistent', target: 'region', persistence: 'temporary',
    desc: 'Đánh cá +3 trong ngày.',
    apply: (ctx) => {
      ctx.flag('fishBonusDay', ctx.s.day);
      ctx.change('good', 'Hôm nay: đánh cá +3');
    },
  },
  {
    code: 'CON-PER-008', id: 'calm_sea', name: 'Biển lặng', type: 'persistent', target: 'world', persistence: 'temporary',
    desc: 'Ra khơi +2 trong ngày.',
    apply: (ctx) => {
      ctx.flag('calmSeaDay', ctx.s.day);
      ctx.change('good', 'Hôm nay: ra khơi bằng bè +2');
    },
  },
  {
    code: 'CON-PER-009', id: 'animal_ally', name: 'Thú rừng thân thiện canh trại', type: 'persistent', target: 'world', persistence: 'permanent',
    desc: 'Thú rừng khác không còn phá kho.',
    apply: (ctx) => {
      ctx.flag('boarFriend');
      ctx.change('good', '🐗 Có lợn rừng quen canh trại: thú rừng không còn phá kho');
    },
  },

  // ======================================================== ENVIRONMENTAL
  {
    code: 'CON-ENV-001', id: 'route_blocked', name: 'Tuyến đường bị chặn', type: 'environmental', target: 'route', persistence: 'until_resolved',
    desc: 'Cây đổ, sạt lở chặn một tuyến đường (dọn hoặc tìm đường vòng).',
    key: (p) => `route:${str(p, 'route')}`,
    conflicts: ['route_opened'],
    requires: (s, p) => {
      if (str(p, 'route') === 'random') return randomRoutes(s, p).length > 0;
      return s.routes.some((r) => r.id === str(p, 'route') && r.status === 'open');
    },
    apply: (ctx, p) => {
      const s = ctx.s;
      const r =
        str(p, 'route') === 'random'
          ? ctx.rng.pick(randomRoutes(s, p))
          : s.routes.find((x) => x.id === str(p, 'route'))!;
      r.status = 'blocked';
      const why = str(p, 'cause', 'Cây đổ');
      ctx.change('bad', `🌳 ${why} chặn đường ${regionName(r.a)} ↔ ${regionName(r.b)}`);
      ctx.journal(`${why} chặn tuyến ${regionName(r.a)} ↔ ${regionName(r.b)}. Cần dọn đường hoặc tìm đường vòng.`, 'consequence');
    },
  },
  {
    code: 'CON-ENV-002', id: 'route_opened', name: 'Tuyến đường thông lại', type: 'environmental', target: 'route', persistence: 'permanent',
    desc: 'Một tuyến đường bị chặn đã thông.',
    key: (p) => `route:${str(p, 'route')}`,
    conflicts: ['route_blocked'],
    apply: (ctx, p) => {
      const r = ctx.s.routes.find((x) => x.id === str(p, 'route'));
      if (!r) return;
      r.status = 'open';
      ctx.change('good', `Tuyến ${regionName(r.a)} ↔ ${regionName(r.b)} đã thông`);
    },
  },
  {
    code: 'CON-ENV-003', id: 'route_detour', name: 'Mở đường vòng', type: 'environmental', target: 'route', persistence: 'permanent',
    desc: 'Đi được nhưng xa hơn (tốn thêm năng lượng mỗi lần).',
    key: (p) => `route:${str(p, 'route')}`,
    apply: (ctx, p) => {
      const r = ctx.s.routes.find((x) => x.id === str(p, 'route'));
      if (!r) return;
      r.status = 'open';
      r.detour = true;
      r.energy += num(p, 'extra', 6);
      ctx.change('good', `Tìm ra đường vòng ${regionName(r.a)} ↔ ${regionName(r.b)}`);
    },
  },
  {
    code: 'CON-ENV-004', id: 'abundance_change', name: 'Trữ lượng tài nguyên thay đổi', type: 'environmental', target: 'region', persistence: 'environmental_recovery',
    desc: 'Thức ăn, cá, thú hoặc gỗ của một vùng tăng/giảm; tự hồi phục dần.',
    apply: (ctx, p) => {
      const r = ctx.s.regions[str(p, 'region') as RegionId];
      const k = str(p, 'kind') as ResourceKind;
      r.abundance[k] = Math.max(0, Math.min(r.maxAbundance[k] * 1.3, r.abundance[k] + num(p, 'delta')));
    },
  },
  {
    code: 'CON-ENV-005', id: 'structure_damage', name: 'Công trình hư hại', type: 'environmental', target: 'structure', persistence: 'until_resolved',
    desc: 'Công trình mất độ bền; về 0 thì bị phá hủy.',
    requires: (s) => s.structures.length > 0,
    apply: (ctx, p) => {
      const s = ctx.s;
      const targets = p.id ? s.structures.filter((x) => x.id === str(p, 'id')) : s.structures;
      for (const st of [...targets]) {
        st.integrity -= num(p, 'amount', 20);
        if (st.integrity <= 0) {
          s.structures = s.structures.filter((x) => x !== st);
          ctx.change('loss', `${st.id} ở ${regionName(st.region)} bị phá hủy`);
        }
      }
    },
  },
  {
    code: 'CON-ENV-006', id: 'fire_out', name: 'Lửa trại tắt', type: 'environmental', target: 'structure', persistence: 'until_resolved',
    desc: 'Lửa trại ở một vùng bị dập tắt.',
    requires: (s, p) => s.structures.some((x) => x.id === 'campfire' && x.lit && x.region === str(p, 'region')),
    apply: (ctx, p) => {
      for (const f of ctx.s.structures) if (f.id === 'campfire' && f.region === str(p, 'region')) f.lit = false;
      ctx.change('bad', `🔥 Lửa trại ở ${regionName(str(p, 'region') as RegionId)} đã tắt`);
    },
  },
  {
    code: 'CON-ENV-007', id: 'river_muddy', name: 'Nước suối đục', type: 'environmental', target: 'region', persistence: 'environmental_recovery',
    desc: 'Nước suối đục sau mưa, rủi ro cao hơn; trong lại khi tạnh.',
    requires: (s) => s.regions.river.water === 'clean',
    apply: (ctx) => {
      ctx.s.regions.river.water = 'muddy';
    },
  },
  {
    code: 'CON-ENV-008', id: 'location_state', name: 'Địa điểm đổi trạng thái', type: 'environmental', target: 'location', persistence: 'until_resolved',
    desc: 'Một địa điểm đã biết chuyển trạng thái (ví dụ cửa hang bị sạt lở / đã dọn).',
    key: (p) => `loc:${str(p, 'loc')}`,
    requires: (s, p) => !!LOCATION_STATES[str(p, 'loc')]?.states[str(p, 'state')],
    apply: (ctx, p) => {
      const loc = str(p, 'loc');
      const state = str(p, 'state');
      ctx.s.locations ??= {};
      ctx.s.locations[loc] = { state, since: ctx.now };
      const st = LOCATION_STATES[loc].states[state];
      ctx.change(st.good ? 'good' : 'bad', `${LOCATION_DEFS[loc]?.icon ?? '📍'} ${LOCATION_DEFS[loc]?.name ?? loc}: ${st.label}`);
      ctx.journal(`${LOCATION_DEFS[loc]?.name ?? loc} — ${st.label}. ${st.desc}`, 'consequence');
    },
  },
  {
    code: 'CON-ENV-009', id: 'spawn_object', name: 'Xuất hiện vật thể', type: 'environmental', target: 'world', persistence: 'until_resolved',
    desc: 'Một vật thể (thùng hàng, gói đồ…) xuất hiện và tồn tại tới khi xử lý hoặc hết hạn.',
    requires: (_s, p) => !!OBJECT_DEFS[str(p, 'kind')],
    apply: (ctx, p) => {
      const def = OBJECT_DEFS[str(p, 'kind')];
      const region = str(p, 'region', ctx.s.location) as RegionId;
      ctx.s.objects ??= [];
      const days = num(p, 'days', def.lifetimeDays ?? 0);
      ctx.s.objects.push({ uid: ctx.nextUid(), kind: def.id, region, createdAt: ctx.now, expiresAt: days ? ctx.now + days * 4 : undefined });
      ctx.change('info', `${def.icon} ${def.name} ở ${regionName(region)}${days ? ` (còn khoảng ${days} ngày)` : ''}`);
    },
  },
  {
    code: 'CON-ENV-010', id: 'remove_object', name: 'Vật thể biến mất', type: 'environmental', target: 'world', persistence: 'instant',
    desc: 'Vật thể đã được xử lý hoặc bị cuốn đi.',
    apply: (ctx, p) => {
      ctx.s.objects = (ctx.s.objects ?? []).filter((o) => o.uid !== num(p, 'uid'));
    },
  },
  {
    code: 'CON-ENV-011', id: 'wreck_restock', name: 'Xác tàu lộ thêm khoang', type: 'environmental', target: 'location', persistence: 'permanent',
    desc: 'Có thêm đồ để lục soát trong xác tàu.',
    apply: (ctx, p) => {
      const items = str(p, 'items', 'canvas,rope,scrap,canned,wood').split(',');
      for (let i = 0; i < num(p, 'count', 1); i++) ctx.s.world.wreckPool.push(ctx.rng.pick(items));
    },
  },

  // ======================================================== OPPORTUNITY
  {
    code: 'CON-OPP-001', id: 'discover_location', name: 'Phát hiện địa điểm', type: 'opportunity', target: 'location', persistence: 'permanent',
    desc: 'Mở một địa điểm mới với hành động / tài nguyên riêng.',
    key: (p) => `loc:${str(p, 'loc')}`,
    requires: (s, p) => {
      const loc = LOCATION_DEFS[str(p, 'loc')];
      return !!loc && !s.regions[loc.region].found.includes(loc.id);
    },
    apply: (ctx, p) => ctx.findLocation(str(p, 'loc')),
  },
  {
    code: 'CON-OPP-002', id: 'discover_route', name: 'Tìm ra tuyến đường', type: 'opportunity', target: 'route', persistence: 'permanent',
    desc: 'Biết thêm một tuyến đường giữa hai vùng.',
    requires: (s, p) => s.routes.some((r) => r.id === str(p, 'route') && !r.known) && ROUTE_DEFS.some((r) => r.id === str(p, 'route')),
    apply: (ctx, p) => ctx.discoverRoute(str(p, 'route')),
  },
  {
    code: 'CON-OPP-003', id: 'clue_region', name: 'Manh mối về vùng đất mới', type: 'opportunity', target: 'knowledge', persistence: 'permanent',
    desc: 'Biết đến sự tồn tại của một vùng chưa khám phá.',
    requires: (s, p) => s.regions[str(p, 'region') as RegionId]?.discovery === 'unknown',
    apply: (ctx, p) => ctx.clueRegion(str(p, 'region') as RegionId),
  },
  {
    code: 'CON-OPP-004', id: 'learn_knowledge', name: 'Học được kiến thức', type: 'opportunity', target: 'knowledge', persistence: 'permanent',
    desc: 'Mở khóa kiến thức (bản vẽ bè, cách đặt bẫy, cây thuốc…).',
    requires: (s, p) => !s.flags[str(p, 'flag')],
    apply: (ctx, p) => {
      ctx.flag(str(p, 'flag'));
      if (p.label) ctx.change('good', `📘 ${str(p, 'label')}`);
    },
  },
  {
    code: 'CON-OPP-005', id: 'ship_schedule_known', name: 'Biết lịch tàu', type: 'opportunity', target: 'knowledge', persistence: 'permanent',
    desc: 'Biết khi nào tàu kế tiếp đi qua.',
    apply: (ctx) => {
      ctx.s.world.shipKnown = true;
    },
  },
  {
    code: 'CON-OPP-006', id: 'currents_knowledge', name: 'Hiểu thêm hải lưu', type: 'opportunity', target: 'knowledge', persistence: 'permanent',
    desc: 'Hiểu biết hải lưu +1 (tối đa 3), giúp ra khơi.',
    requires: (s) => s.world.currents < 3,
    apply: (ctx, p) => {
      ctx.s.world.currents = Math.min(3, ctx.s.world.currents + num(p, 'amount', 1));
      ctx.change('good', `🧭 Hiểu biết hải lưu: ${ctx.s.world.currents}/3`);
    },
  },
  {
    code: 'CON-OPP-007', id: 'forecast_known', name: 'Biết trước thời tiết', type: 'opportunity', target: 'knowledge', persistence: 'temporary',
    desc: 'Biết thời tiết ngày mai.',
    apply: (ctx) => {
      ctx.s.world.forecastUntil = Math.max(ctx.s.world.forecastUntil, ctx.s.day + 1);
    },
  },
  {
    code: 'CON-OPP-008', id: 'land_sighted', name: 'Biết hướng đất liền', type: 'opportunity', target: 'knowledge', persistence: 'permanent',
    desc: 'Ra khơi chặng 3 +2.',
    apply: (ctx) => {
      ctx.flag('landSighted');
      ctx.change('good', '🧭 Biết hướng đất liền: ra khơi chặng 3 +2');
    },
  },
  {
    code: 'CON-OPP-009', id: 'sea_guide', name: 'Đàn cá heo dẫn đường', type: 'opportunity', target: 'knowledge', persistence: 'permanent',
    desc: 'Ra khơi chặng 1 +1.',
    apply: (ctx) => {
      ctx.flag('dolphinSaved');
      ctx.change('good', '🐬 Đàn cá heo sẽ nhớ bạn: ra khơi chặng 1 +1');
    },
  },

  // ======================================================== CHAIN
  {
    code: 'CON-CHN-001', id: 'schedule_event', name: 'Hẹn sự kiện tiếp nối', type: 'chain', target: 'story', persistence: 'until_resolved',
    desc: 'Một sự kiện tiếp nối sẽ xảy ra sau vài ngày, khi đúng ngữ cảnh.',
    apply: (ctx, p) => {
      const min = num(p, 'minDays', 1) * 4;
      const max = num(p, 'maxDays', num(p, 'minDays', 1)) * 4;
      ctx.schedule(str(p, 'event'), p.slots !== undefined ? num(p, 'slots') : ctx.rng.int(min, max), undefined, num(p, 'window', 16));
    },
  },
  {
    code: 'CON-CHN-002', id: 'chain_state', name: 'Ghi nhận nhánh câu chuyện', type: 'chain', target: 'story', persistence: 'permanent',
    desc: 'Ghi lại lựa chọn của người chơi trong một chuỗi để các sự kiện sau phản ứng theo.',
    key: (p) => `chain:${str(p, 'chain')}`,
    apply: (ctx, p) => ctx.flag(`chain_${str(p, 'chain')}`, str(p, 'state')),
  },
];

export const CONSEQUENCES: Record<string, ConsequenceDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
export const CONSEQUENCE_LIST = defs;
export const CONSEQUENCE_TARGET_TOTAL = 500;

