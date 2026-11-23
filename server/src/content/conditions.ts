import type { AttrId } from '../engine/types.ts';

export type StackPolicy = 'reject' | 'refresh' | 'add' | 'replace' | 'highest';

export interface ConditionDef {
  id: string;
  name: (sev: number) => string;
  icon: string;
  kind: 'physical' | 'psych';
  maxSev: number;
  stack: StackPolicy;
  /** check modifier for an attribute */
  checkMod: (sev: number, attr: AttrId) => number;
  desc: (sev: number) => string;
  good?: boolean;
}

const PHYS: AttrId[] = ['STR', 'AGI', 'END'];

export const CONDITIONS: Record<string, ConditionDef> = {
  injury: {
    id: 'injury',
    name: (s) => ['Trầy xước', 'Bong gân', 'Vết thương sâu', 'Thương tích nặng'][s] ?? 'Thương tích',
    icon: '🤕',
    kind: 'physical',
    maxSev: 3,
    stack: 'add',
    checkMod: (s, a) => (PHYS.includes(a) ? -s : 0),
    desc: (s) =>
      `Kiểm tra STR/AGI/END -${s}. Di chuyển tốn thêm ${s * 3} năng lượng.` +
      (s >= 2 ? ' Chưa băng bó có thể nhiễm trùng qua đêm.' : ' Có thể tự lành khi nghỉ ngơi.') +
      (s >= 3 ? ' Mất máu: -2 Sức khỏe mỗi buổi.' : ''),
  },
  infection: {
    id: 'infection',
    name: () => 'Nhiễm trùng',
    icon: '🦠',
    kind: 'physical',
    maxSev: 1,
    stack: 'reject',
    checkMod: () => -2,
    desc: () => 'Mọi kiểm tra -2. Mất 6 Sức khỏe mỗi đêm, không hồi Sức khỏe. Cần thuốc đắp thảo dược hoặc hộp sơ cứu.',
  },
  illness: {
    id: 'illness',
    name: (s) => (s >= 2 ? 'Ngộ độc nặng' : 'Đau bụng'),
    icon: '🤢',
    kind: 'physical',
    maxSev: 3,
    stack: 'add',
    checkMod: (s) => -s,
    desc: (s) => `Mọi kiểm tra -${s}. Khát nhanh hơn, hồi năng lượng kém. Thường giảm dần qua đêm, thảo dược giúp khỏi nhanh.`,
  },
  poisoned: {
    id: 'poisoned',
    name: () => 'Trúng độc',
    icon: '🐍',
    kind: 'physical',
    maxSev: 1,
    stack: 'refresh',
    checkMod: () => -2,
    desc: () => 'Mất 5 Sức khỏe mỗi buổi cho tới khi hết độc (khoảng 3 buổi). Thuốc đắp thảo dược giải độc ngay.',
  },
  exposure: {
    id: 'exposure',
    name: () => 'Nhiễm lạnh',
    icon: '🥶',
    kind: 'physical',
    maxSev: 1,
    stack: 'refresh',
    checkMod: () => -1,
    desc: () => 'Mọi kiểm tra -1. Hồi năng lượng ban đêm kém. Ngủ có mái che và lửa sẽ khỏi.',
  },
  shaken: {
    id: 'shaken',
    name: () => 'Hoảng sợ',
    icon: '😰',
    kind: 'psych',
    maxSev: 1,
    stack: 'refresh',
    checkMod: (_s, a) => (a === 'PER' || a === 'INT' ? -1 : 0),
    desc: () => 'Kiểm tra PER/INT -1. Sẽ qua sau một thời gian.',
  },
  determined: {
    id: 'determined',
    name: () => 'Quyết tâm',
    icon: '💪',
    kind: 'psych',
    maxSev: 1,
    stack: 'refresh',
    good: true,
    checkMod: () => 1,
    desc: () => 'Mọi kiểm tra +1. Ý chí sống sót đang dâng cao.',
  },
};
