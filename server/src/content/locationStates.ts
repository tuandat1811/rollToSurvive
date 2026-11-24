// Persistent location states (GDD Diversity-01 §2.3 "persistent world state").
// A discovered location can change state and stays that way until something
// changes it again — e.g. the cave mouth collapses and stays blocked until cleared.
import type { GameState } from '../engine/types.js';

export interface LocationStateDef {
  label: string;
  desc: string;
  good?: boolean;
  /** can the player use the location (shelter, actions)? */
  accessible: boolean;
}

export interface LocationStateMachine {
  initial: string;
  states: Record<string, LocationStateDef>;
}

export const LOCATION_STATES: Record<string, LocationStateMachine> = {
  cave: {
    initial: 'open',
    states: {
      open: { label: 'Lối vào thông thoáng', desc: 'Có thể trú ẩn trong hang.', good: true, accessible: true },
      collapsed: {
        label: 'Cửa hang bị sạt lở',
        desc: 'Đất đá lấp kín lối vào — không thể trú trong hang cho tới khi dọn được đường vào.',
        accessible: false,
      },
      cleared: {
        label: 'Đã dọn lại lối vào',
        desc: 'Lối vào được chèn đá cẩn thận, hang lại dùng được.',
        good: true,
        accessible: true,
      },
    },
  },
};

export function locationState(s: GameState, loc: string): string {
  return s.locations?.[loc]?.state ?? LOCATION_STATES[loc]?.initial ?? 'open';
}

export function locationAccessible(s: GameState, loc: string): boolean {
  const m = LOCATION_STATES[loc];
  if (!m) return true;
  return m.states[locationState(s, loc)]?.accessible ?? true;
}

export function locationStateDef(s: GameState, loc: string): LocationStateDef | undefined {
  return LOCATION_STATES[loc]?.states[locationState(s, loc)];
}
