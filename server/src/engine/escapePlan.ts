// Player-facing overview of every way off the island: where/what it needs,
// how hard each roll is right now, and exactly what failure costs.
import type { CheckView, EscapeMethodView, EscapePlanView } from '../../../shared/types.js';
import { REGION_DEFS, SLOT_NAMES } from '../content/defs.js';
import { signalChoices } from '../content/events.js';
import { count, routeBetween } from './ctx.js';
import { journey, penaltyText, previewStages } from './escape.js';
import { findInstance, unmetReasons } from './game.js';
import type { CheckSpec, GameState, RegionId } from './types.js';

type CheckViewFn = (s: GameState, spec: CheckSpec) => CheckView;

function startInfo(s: GameState, key: string) {
  const inst = findInstance(s, key);
  if (!inst) return { actionKey: undefined, reasons: [] as string[] };
  const reasons = unmetReasons(s, inst);
  return { actionKey: reasons.length ? undefined : key, reasons };
}

function travelToCoast(s: GameState): string | undefined {
  if (s.location === 'coast') return undefined;
  const r = routeBetween(s, s.location, 'coast');
  return r && r.known && r.status === 'open' ? 'travel:coast' : undefined;
}

export function buildEscapePlan(s: GameState, checkView: CheckViewFn): EscapePlanView {
  const atCoast = s.location === 'coast';
  const raft = s.projects.find((p) => p.id === 'raft');
  const methods: EscapeMethodView[] = [];

  // ---- raft
  {
    const { actionKey, reasons } = startInfo(s, 'escape_raft');
    const specs = previewStages(s, 'raft');
    methods.push({
      id: 'raft',
      name: 'Ra khơi bằng bè',
      icon: '⛵',
      summary: 'Cách thoát đảo chủ động và đáng tin nhất. Bè càng tốt, càng hiểu hải lưu và mang đủ nước thì càng dễ.',
      status: actionKey ? 'ready' : !raft ? 'locked' : atCoast ? 'locked' : 'not_here',
      statusText: actionKey
        ? 'Sẵn sàng ra khơi'
        : !raft
          ? 'Chưa có bè — đóng bè ở Bãi biển'
          : atCoast
            ? reasons[0] ?? 'Chưa thể ra khơi'
            : 'Bè ở Bãi biển — hãy tới đó để ra khơi',
      actionKey,
      travelKey: raft ? travelToCoast(s) : undefined,
      reqs: [
        { label: 'Đứng ở Bãi biển', met: atCoast },
        { label: raft ? `Có bè (${raft.stage}/3 giai đoạn, độ bền ${raft.integrity}%)` : 'Có bè (đóng ít nhất giai đoạn 1: Khung bè)', met: !!raft },
        { label: 'Năng lượng từ 10 trở lên', met: s.vitals.energy >= 10 },
      ],
      stages: journey('raft').map((st, i) => ({ name: st.name, desc: st.desc, check: checkView(s, specs[i]) })),
      info: [
        raft ? `Bè hiện tại: ${['', 'khung thô', 'có phao', 'có buồm'][raft.stage]}, độ bền ${raft.integrity}%.` : 'Chưa có bè: độ khó bên dưới tính cho một chiếc bè thô mới đóng.',
        `Hiểu biết hải lưu: ${s.world.currents}/3 (giúp chặng 3).${count(s.inventory, 'chart') ? ' Có hải đồ (+2 chặng 3).' : ''}`,
        'Mang theo ít nhất 3 phần nước và 2 phần thức ăn để chặng 2 không bị trừ điểm.',
        'Phao, buồm, hiểu hải lưu và thời tiết tốt (gió mát, nắng ráo, biển lặng) đều giảm độ khó.',
      ],
      timeCost: 'Mỗi chặng tốn 1 buổi (3 chặng). Có thể quay về đảo giữa chừng.',
      penalties: penaltyText('raft'),
    });
  }

  // ---- desperate
  {
    const { actionKey, reasons } = startInfo(s, 'escape_desperate');
    const specs = previewStages(s, 'desperate');
    const hasFloat = count(s.inventory, 'wood') >= 2 || count(s.inventory, 'barrel') >= 1;
    methods.push({
      id: 'desperate',
      name: 'Liều mình ra khơi',
      icon: '🌊',
      summary: 'Ôm khúc gỗ lao ra biển, phó mặc số phận. Làm được ngay từ Ngày 1 nhưng gần như chắc chắn thất bại.',
      status: actionKey ? 'ready' : atCoast ? 'locked' : 'not_here',
      statusText: actionKey ? 'Có thể thử ngay' : atCoast ? reasons[0] ?? 'Chưa thể thử' : 'Chỉ thử được ở Bãi biển',
      actionKey,
      travelKey: travelToCoast(s),
      reqs: [
        { label: 'Đứng ở Bãi biển', met: atCoast },
        { label: 'Mang theo 2 gỗ hoặc 1 thùng phuy làm phao', met: hasFloat },
        { label: 'Năng lượng từ 10 trở lên', met: s.vitals.energy >= 10 },
      ],
      stages: journey('desperate').map((st, i) => ({ name: st.name, desc: st.desc, check: checkView(s, specs[i]) })),
      info: ['Cả 3 chặng đều phải đạt "Thành công" trở lên — không có cơ hội thử lại.', 'Hiểu hải lưu giúp chặng 2.'],
      timeCost: 'Mỗi chặng tốn 1 buổi. Không thể quay đầu.',
      penalties: penaltyText('desperate'),
    });
  }

  // ---- rescue signal (event-driven: a ship or plane must pass)
  {
    const seaView = REGION_DEFS[s.location].seaView;
    const preview = {
      ...s,
      inventory: [...s.inventory, { id: 'flare', qty: 1 }, { id: 'signal_mirror', qty: 1 }],
    };
    const choices = signalChoices(preview, { bonus: 0, onPartial: () => {}, win: ['', '', ''] }).filter((c) => c.id !== 'ignore' && c.check);
    const owned: Record<string, boolean> = {
      pyre: s.structures.some((x) => x.id === 'signal_pyre' && x.integrity > 0),
      flare: count(s.inventory, 'flare') > 0,
      mirror: count(s.inventory, 'signal_mirror') > 0,
      wave: true,
    };
    const pyres = s.structures.filter((x) => x.id === 'signal_pyre').map((x) => REGION_DEFS[x.region as RegionId].name);
    const next = s.world.ships[0];
    const anyMeans = owned.pyre || owned.flare || owned.mirror;
    methods.push({
      id: 'signal',
      name: 'Phát tín hiệu cứu hộ',
      icon: '🔥',
      summary: 'Khi tàu hoặc máy bay đi ngang, ra hiệu để được cứu. Không tự bắt đầu được — phải có mặt ở nơi nhìn ra biển đúng lúc.',
      status: anyMeans ? 'waiting' : 'locked',
      statusText: anyMeans ? 'Đã có phương tiện phát tín hiệu — chờ tàu đi qua' : 'Chưa có phương tiện tốt — chỉ có thể vẫy gọi',
      reqs: [
        { label: `Đống lửa tín hiệu${pyres.length ? ` (đã có ở ${pyres.join(', ')})` : ''} + nguồn lửa, hoặc pháo sáng, hoặc gương`, met: anyMeans },
        { label: 'Đứng ở nơi nhìn ra biển khi tàu đi qua (Bãi biển, Núi đá, Mũi Hải Đăng)', met: seaView },
        { label: 'Biết lịch tàu (leo đỉnh núi hoặc đọc sổ trực hải đăng)', met: s.world.shipKnown },
      ],
      signals: choices.map((c) => ({
        id: c.id,
        name: c.label,
        icon: c.icon ?? '🔥',
        desc: c.desc ?? '',
        owned: owned[c.id] ?? false,
        check: checkView(s, c.check!),
      })),
      info: [
        s.world.shipKnown && next !== undefined
          ? `🚢 Tàu kế tiếp dự kiến: Ngày ${Math.floor(next / 4) + 1}, buổi ${SLOT_NAMES[next % 4]}.`
          : '🚢 Chưa biết lịch tàu. Tàu đi qua khoảng 4–7 ngày một lần.',
        `Độ khó bên dưới tính tại ${REGION_DEFS[s.location].name}${seaView ? '' : ' (nơi này không nhìn ra biển — tàu sẽ không thấy bạn)'}. Mũi Hải Đăng +4, Núi đá +1, Bãi biển -3.`,
        'Máy bay thỉnh thoảng bay ngang (từ Ngày 6, khi trời không mưa/sương mù).',
      ],
      timeCost: 'Mỗi lần phát tín hiệu tốn 1 buổi.',
      penalties: [
        'Thành công một phần: con tàu chậm lại — bạn có thêm một lần thử dễ hơn (+4).',
        'Thất bại: tàu đi mất. Phải chờ chuyến sau (4–7 ngày).',
        'Đống lửa tín hiệu cháy hết sau khi đốt (phải dựng lại). Pháo sáng chỉ dùng một lần.',
        'Thất bại thảm hại khi đốt lửa: bị bỏng nhẹ.',
        'Không mất Sức khỏe hay đồ đạc — đây là cách thoát an toàn nhất.',
      ],
    });
  }

  return { methods, atSea: !!s.escape };
}

