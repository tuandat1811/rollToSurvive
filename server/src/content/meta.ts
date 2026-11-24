import { PACK } from './data/pack.js';

// Content registry metadata: stable codes + classification for every action and
// event. Counting rule (GDD Diversity-01): one entry = one ID with its own function.
// Renaming an item, changing a reward amount or rewording text is NOT new content —
// e.g. travelling to different regions is one action (ACT-NAV-001), while each
// crafting recipe is its own action because it produces a different tool.

export type ActionCategory = 'EXP' | 'GAT' | 'HUN' | 'FSH' | 'CRF' | 'BLD' | 'COK' | 'MED' | 'RES' | 'NAV' | 'SOC' | 'ESC';
export type EventCategoryCode = 'WTH' | 'WLD' | 'ECO' | 'DIS' | 'RES' | 'BAS' | 'HEA' | 'PSY' | 'NAR' | 'ESC';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'unique';
export type EventSource = 'world' | 'action' | 'persistent' | 'narrative';

export const ACTION_CATEGORY_NAMES: Record<ActionCategory, string> = {
  EXP: 'Exploration',
  GAT: 'Gathering',
  HUN: 'Hunting & Trapping',
  FSH: 'Fishing',
  CRF: 'Crafting',
  BLD: 'Base Building',
  COK: 'Cooking & Preservation',
  MED: 'Medical & Recovery',
  RES: 'Research',
  NAV: 'Navigation',
  SOC: 'Social & Narrative',
  ESC: 'Escape',
};

/** production targets from the GDD (planning numbers, not finished content) */
export const ACTION_TARGETS: Record<ActionCategory, number> = {
  EXP: 20, GAT: 15, HUN: 15, FSH: 10, CRF: 15, BLD: 15, COK: 10, MED: 10, RES: 10, NAV: 10, SOC: 10, ESC: 10,
};

export interface ActionMeta {
  code: string;
  tier: 1 | 2 | 3;
}

/**
 * Keyed by action id, or `id:variant` when each variant is a distinct function
 * (recipes, structures, trap kinds, world-object interactions).
 */
export const ACTION_META: Record<string, ActionMeta> = {
  // Exploration
  explore: { code: 'ACT-EXP-001', tier: 1 },
  search_wreck: { code: 'ACT-EXP-002', tier: 1 },
  climb_lookout: { code: 'ACT-EXP-003', tier: 2 },
  search_ruins: { code: 'ACT-EXP-004', tier: 2 },
  'object:washed_crate:pry': { code: 'ACT-EXP-005', tier: 1 },
  'object:old_cache:open': { code: 'ACT-EXP-006', tier: 1 },
  'clear_location:cave': { code: 'ACT-EXP-007', tier: 2 },
  'expedition:wreck_hold': { code: 'ACT-EXP-008', tier: 2 },
  'expedition:deep_cave': { code: 'ACT-EXP-009', tier: 3 },
  'prepare:climb': { code: 'ACT-EXP-010', tier: 1 },
  // Gathering
  collect_water: { code: 'ACT-GAT-001', tier: 1 },
  forage: { code: 'ACT-GAT-002', tier: 1 },
  gather: { code: 'ACT-GAT-003', tier: 1 },
  beachcomb: { code: 'ACT-GAT-004', tier: 1 },
  collect_debris: { code: 'ACT-GAT-005', tier: 1 },
  'object:washed_crate:smash': { code: 'ACT-GAT-006', tier: 1 },
  find_alt_water: { code: 'ACT-GAT-007', tier: 2 },
  // Hunting & trapping
  hunt: { code: 'ACT-HUN-001', tier: 2 },
  'set_trap:snare': { code: 'ACT-HUN-002', tier: 2 },
  check_traps: { code: 'ACT-HUN-003', tier: 2 },
  'prepare:hunting': { code: 'ACT-HUN-004', tier: 1 },
  // Fishing
  fish: { code: 'ACT-FSH-001', tier: 1 },
  'set_trap:fish_trap': { code: 'ACT-FSH-002', tier: 2 },
  'prepare:fishing': { code: 'ACT-FSH-003', tier: 1 },
  // Crafting
  'craft:stone_knife': { code: 'ACT-CRF-001', tier: 1 },
  'craft:stone_axe': { code: 'ACT-CRF-002', tier: 2 },
  'craft:spear': { code: 'ACT-CRF-003', tier: 2 },
  'craft:fishing_rod': { code: 'ACT-CRF-004', tier: 2 },
  'craft:rope': { code: 'ACT-CRF-005', tier: 1 },
  'craft:coconut_cup': { code: 'ACT-CRF-006', tier: 1 },
  'craft:basket': { code: 'ACT-CRF-007', tier: 2 },
  'craft:bandage': { code: 'ACT-CRF-008', tier: 1 },
  'craft:torch': { code: 'ACT-CRF-009', tier: 1 },
  'craft:signal_mirror': { code: 'ACT-CRF-010', tier: 2 },
  'craft:snare': { code: 'ACT-CRF-011', tier: 2 },
  'craft:fish_trap': { code: 'ACT-CRF-012', tier: 2 },
  'craft:poultice': { code: 'ACT-CRF-013', tier: 2 },
  // Base building
  'build:lean_to': { code: 'ACT-BLD-001', tier: 1 },
  'build:hut': { code: 'ACT-BLD-002', tier: 3 },
  'build:campfire': { code: 'ACT-BLD-003', tier: 1 },
  'build:rain_collector': { code: 'ACT-BLD-004', tier: 2 },
  'build:storage_rack': { code: 'ACT-BLD-005', tier: 2 },
  'build:fence': { code: 'ACT-BLD-006', tier: 2 },
  make_fire: { code: 'ACT-BLD-007', tier: 1 },
  relight_fire: { code: 'ACT-BLD-008', tier: 1 },
  repair: { code: 'ACT-BLD-009', tier: 2 },
  reinforce_shelter: { code: 'ACT-BLD-010', tier: 2 },
  secure_storage: { code: 'ACT-BLD-011', tier: 1 },
  stockpile_wood: { code: 'ACT-BLD-012', tier: 1 },
  finish_repair: { code: 'ACT-BLD-013', tier: 1 },
  shore_up_cave: { code: 'ACT-BLD-014', tier: 2 },
  // Cooking & preservation
  cook: { code: 'ACT-COK-001', tier: 1 },
  smoke_food: { code: 'ACT-COK-002', tier: 2 },
  boil_water: { code: 'ACT-COK-003', tier: 1 },
  // Medical & recovery
  rest: { code: 'ACT-MED-001', tier: 1 },
  treat: { code: 'ACT-MED-002', tier: 2 },
  search_herbs: { code: 'ACT-MED-003', tier: 2 },
  // Research
  trace_contamination: { code: 'ACT-RES-001', tier: 2 },
  remove_carcass: { code: 'ACT-RES-002', tier: 2 },
  // Navigation
  travel: { code: 'ACT-NAV-001', tier: 1 },
  study_currents: { code: 'ACT-NAV-002', tier: 2 },
  read_sky: { code: 'ACT-NAV-003', tier: 1 },
  clear_route: { code: 'ACT-NAV-004', tier: 2 },
  find_detour: { code: 'ACT-NAV-005', tier: 2 },
  // Social & narrative
  track_footprints: { code: 'ACT-SOC-001', tier: 2 },
  search_camp: { code: 'ACT-SOC-002', tier: 2 },
  // Escape
  build_raft: { code: 'ACT-ESC-001', tier: 3 },
  repair_raft: { code: 'ACT-ESC-002', tier: 2 },
  escape_raft: { code: 'ACT-ESC-003', tier: 3 },
  escape_desperate: { code: 'ACT-ESC-004', tier: 3 },
  'build:signal_pyre': { code: 'ACT-ESC-005', tier: 3 },
};

/** metadata lookup for an action instance key like `craft:spear` or `travel:jungle` */
export function actionMeta(key: string): ActionMeta | undefined {
  if (ACTION_META[key]) return ACTION_META[key];
  const parts = key.split(':');
  if (parts[0] === 'object' && parts.length >= 4) return ACTION_META[`object:${parts[2]}:${parts[3]}`];
  if (ACTION_META[`${parts[0]}:${parts[1]}`]) return ACTION_META[`${parts[0]}:${parts[1]}`];
  return ACTION_META[parts[0]];
}

export interface EventMeta {
  code: string;
  rarity: Rarity;
  source: EventSource;
}

export const EVENT_META: Record<string, EventMeta> = {
  // Weather
  storm_warning: { code: 'EVT-WTH-001', rarity: 'common', source: 'world' },
  storm_hits: { code: 'EVT-WTH-002', rarity: 'common', source: 'world' },
  heatwave: { code: 'EVT-WTH-003', rarity: 'common', source: 'world' },
  damp_fuel: { code: 'EVT-WTH-004', rarity: 'common', source: 'world' },
  // Ecology
  landslide: { code: 'EVT-ECO-001', rarity: 'uncommon', source: 'persistent' },
  fish_school: { code: 'EVT-ECO-002', rarity: 'common', source: 'world' },
  river_contamination: { code: 'EVT-ECO-003', rarity: 'unique', source: 'action' },
  mushrooms_after_rain: { code: 'EVT-ECO-004', rarity: 'common', source: 'world' },
  falling_fruit: { code: 'EVT-ECO-005', rarity: 'common', source: 'world' },
  cave_collapse: { code: 'EVT-ECO-006', rarity: 'uncommon', source: 'persistent' },
  ground_cracks: { code: 'EVT-ECO-007', rarity: 'common', source: 'world' },
  rockfall_signs: { code: 'EVT-ECO-008', rarity: 'uncommon', source: 'world' },
  // Resources
  storm_debris: { code: 'EVT-RES-001', rarity: 'common', source: 'persistent' },
  coconut_fall: { code: 'EVT-RES-002', rarity: 'common', source: 'world' },
  bottles_in_sand: { code: 'EVT-RES-003', rarity: 'common', source: 'world' },
  kelp_washup: { code: 'EVT-RES-004', rarity: 'common', source: 'world' },
  wild_yams: { code: 'EVT-RES-005', rarity: 'uncommon', source: 'world' },
  lost_cargo: { code: 'EVT-RES-006', rarity: 'unique', source: 'world' },
  sharp_stone: { code: 'EVT-RES-007', rarity: 'unique', source: 'world' },
  net_snag: { code: 'EVT-RES-008', rarity: 'uncommon', source: 'action' },
  // Discovery
  freshwater_seep: { code: 'EVT-DIS-001', rarity: 'unique', source: 'world' },
  monkeys_lead: { code: 'EVT-DIS-002', rarity: 'common', source: 'persistent' },
  strange_rock: { code: 'EVT-DIS-003', rarity: 'uncommon', source: 'action' },
  hidden_hollow: { code: 'EVT-DIS-004', rarity: 'uncommon', source: 'action' },
  expedition_step: { code: 'EVT-DIS-005', rarity: 'common', source: 'action' },
  // Wildlife
  bush_noise: { code: 'EVT-WLD-001', rarity: 'common', source: 'world' },
  monkey_thief: { code: 'EVT-WLD-002', rarity: 'common', source: 'world' },
  turtle_nesting: { code: 'EVT-WLD-003', rarity: 'uncommon', source: 'world' },
  snake_at_spring: { code: 'EVT-WLD-004', rarity: 'common', source: 'world' },
  bee_hive: { code: 'EVT-WLD-005', rarity: 'uncommon', source: 'world' },
  wounded_boar: { code: 'EVT-WLD-006', rarity: 'uncommon', source: 'world' },
  stranded_dolphin: { code: 'EVT-WLD-007', rarity: 'unique', source: 'world' },
  wounded_seabird: { code: 'EVT-WLD-008', rarity: 'uncommon', source: 'world' },
  injured_boar: { code: 'EVT-WLD-009', rarity: 'unique', source: 'world' },
  boar_friend_visit: { code: 'EVT-WLD-010', rarity: 'common', source: 'persistent' },
  boar_sow_angry: { code: 'EVT-WLD-011', rarity: 'common', source: 'persistent' },
  monkey_troop: { code: 'EVT-WLD-012', rarity: 'unique', source: 'world' },
  dolphins_return: { code: 'EVT-WLD-013', rarity: 'common', source: 'persistent' },
  dolphin_washed: { code: 'EVT-WLD-014', rarity: 'common', source: 'persistent' },
  bird_nest: { code: 'EVT-WLD-015', rarity: 'common', source: 'action' },
  // Base
  boar_raid: { code: 'EVT-BAS-001', rarity: 'common', source: 'persistent' },
  boar_signs: { code: 'EVT-BAS-006', rarity: 'common', source: 'world' },
  loose_roof: { code: 'EVT-BAS-002', rarity: 'common', source: 'world' },
  boar_tracks_camp: { code: 'EVT-BAS-003', rarity: 'common', source: 'persistent' },
  boar_night_raid: { code: 'EVT-BAS-004', rarity: 'common', source: 'persistent' },
  monkey_raid: { code: 'EVT-BAS-005', rarity: 'common', source: 'persistent' },
  // Health
  twisted_ankle: { code: 'EVT-HEA-001', rarity: 'uncommon', source: 'world' },
  // Psychology
  nightmare: { code: 'EVT-PSY-001', rarity: 'common', source: 'world' },
  starry_night: { code: 'EVT-PSY-002', rarity: 'common', source: 'world' },
  rainbow: { code: 'EVT-PSY-003', rarity: 'common', source: 'world' },
  second_wind: { code: 'EVT-PSY-004', rarity: 'common', source: 'world' },
  // Narrative
  message_bottle: { code: 'EVT-NAR-001', rarity: 'unique', source: 'narrative' },
  copper_locket: { code: 'EVT-NAR-002', rarity: 'unique', source: 'narrative' },
  human_footprints: { code: 'EVT-NAR-003', rarity: 'uncommon', source: 'action' },
  // Escape
  calm_sea: { code: 'EVT-ESC-001', rarity: 'uncommon', source: 'world' },
  ship_sighted: { code: 'EVT-ESC-002', rarity: 'common', source: 'world' },
  ship_closer: { code: 'EVT-ESC-003', rarity: 'common', source: 'persistent' },
  ship_missed: { code: 'EVT-ESC-004', rarity: 'common', source: 'world' },
  plane_overhead: { code: 'EVT-ESC-005', rarity: 'rare', source: 'world' },
  rescue_search: { code: 'EVT-ESC-006', rarity: 'common', source: 'persistent' },
  island_in_distance: { code: 'EVT-ESC-007', rarity: 'unique', source: 'narrative' },
  false_beacon: { code: 'EVT-ESC-008', rarity: 'unique', source: 'narrative' },
};

/** rarity multiplies the random-pick weight (unique events are guarded by `once`) */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 1, uncommon: 0.6, rare: 0.3, unique: 1 };

// ---------------------------------------------------------------- data-pack content
// Codes and classification of content authored in docs/content-pack.xlsx.
for (const a of PACK.actions) ACTION_META[a.id] = { code: a.code, tier: (Number(a.tier) || 1) as 1 | 2 | 3 };
for (const e of PACK.events) EVENT_META[e.id] = { code: e.code, rarity: e.rarity as Rarity, source: e.source as EventSource };
