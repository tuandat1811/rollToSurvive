// Core engine types for Roll To Survive.
// GameState is the single source of truth, persisted as JSON per run.

export type AttrId = 'STR' | 'AGI' | 'END' | 'INT' | 'PER';
export type SkillId = 'survival' | 'hunting' | 'fishing' | 'crafting' | 'medicine' | 'navigation';
export type VitalId = 'health' | 'hunger' | 'thirst' | 'energy';
export type RegionId = 'coast' | 'jungle' | 'river' | 'mountain' | 'cape';
export type WeatherId = 'clear' | 'hot' | 'cloudy' | 'breezy' | 'windy' | 'fog' | 'drizzle' | 'rain' | 'humid' | 'storm';
export type Tier = 'crit_success' | 'success' | 'partial' | 'failure' | 'crit_failure';
export type Discovery = 'unknown' | 'clued' | 'discovered';
export type Pacing = 'calm' | 'normal' | 'tense';
export type CritPolicy = 'standard' | 'safe' | 'none';
export type ChangeKind = 'gain' | 'loss' | 'good' | 'bad' | 'info';

export const ATTRS: AttrId[] = ['STR', 'AGI', 'END', 'INT', 'PER'];
export const SKILLS: SkillId[] = ['survival', 'hunting', 'fishing', 'crafting', 'medicine', 'navigation'];
export const REGIONS: RegionId[] = ['coast', 'jungle', 'river', 'mountain', 'cape'];

export interface ItemStack {
  id: string;
  qty: number;
  /** absolute slot index at which the item spoils */
  exp?: number;
  /** remaining durability for tools */
  dur?: number;
  /** illness risk (0..1) for raw water / unsafe food */
  risk?: number;
}

export interface ConditionInst {
  id: string;
  sev: number;
  /** absolute slot index at which the condition ends (timed conditions) */
  until?: number;
  treated?: boolean;
}

export interface StructureInst {
  uid: number;
  id: string;
  region: RegionId;
  integrity: number;
  lit?: boolean;
}

export interface ProjectInst {
  id: 'raft';
  region: RegionId;
  stage: number; // completed stages
  integrity: number;
}

export interface TrapInst {
  uid: number;
  kind: 'snare' | 'fish_trap';
  region: RegionId;
  readyAt: number;
  dur: number;
}

export interface RegionState {
  discovery: Discovery;
  surveyed: boolean;
  explorePool: string[];
  found: string[];
  abundance: Record<ResourceKind, number>;
  maxAbundance: Record<ResourceKind, number>;
  wildlifeAlert: number;
  water: 'clean' | 'muddy' | 'contaminated';
  waterKnown: boolean;
}

export type ResourceKind = 'forage' | 'fish' | 'game' | 'wood';

export interface RouteState {
  id: string;
  a: RegionId;
  b: RegionId;
  known: boolean;
  status: 'open' | 'blocked';
  energy: number;
  danger?: number;
  detour?: boolean;
}

export interface JournalEntry {
  day: number;
  slot: number;
  kind: 'discovery' | 'event' | 'milestone' | 'consequence' | 'info' | 'escape';
  text: string;
}

export interface PendingEvent {
  uid: number;
  eventId: string;
  data?: Record<string, unknown>;
  /** passive outcome lines already applied when the card appeared */
  changes?: Change[];
}

export interface EscapeState {
  method: 'raft' | 'desperate';
  stage: number; // index of next stage to resolve
  adv: number; // advantage carried into the next stage
  dcPenalty: number; // retry penalty on the current stage
  canReturn: boolean;
  log: string[];
}

export interface ChainState {
  status: 'active' | 'suspended' | 'resolved' | 'expired';
  step: number;
  deadline?: number;
}

export interface ScheduledEvent {
  eventId: string;
  at: number;
  data?: Record<string, unknown>;
}

export interface Change {
  kind: ChangeKind;
  text: string;
}

export interface RollInfo {
  label: string;
  attr: AttrId;
  attrMod: number;
  skill?: SkillId;
  skillMod: number;
  mods: { label: string; value: number }[];
  dc: number;
  dice: number[];
  adv: number;
  natural: number;
  total: number;
  tier: Tier;
  /** score thresholds at the time of the roll (absent on saves made before this field existed) */
  bands?: Band[];
  crit?: CritPolicy;
}

export interface Band {
  tier: Tier;
  faceMin: number;
  faceMax: number;
  totalMin: number;
  totalMax: number;
}

export interface Notice {
  title: string;
  icon: string;
  text: string;
  changes: Change[];
}

export interface TurnResult {
  title: string;
  icon: string;
  roll?: RollInfo;
  narrative: string[];
  changes: Change[];
  notices: Notice[];
  timeAdvanced: number;
}

export interface GameState {
  schema: 1;
  version: number;
  seed: number;
  rng: number;
  name: string;
  createdAt: number;
  status: 'playing' | 'victory' | 'dead';
  ending?: { kind: string; title: string; text: string; day: number };
  day: number;
  slot: number;
  attrs: Record<AttrId, number>;
  attrPoints: number;
  skills: Record<SkillId, { lvl: number; xp: number }>;
  vitals: Record<VitalId, number>;
  conditions: ConditionInst[];
  knowledge: string[];
  location: RegionId;
  baseRegion: RegionId | null;
  inventory: ItemStack[];
  storage: ItemStack[];
  structures: StructureInst[];
  projects: ProjectInst[];
  traps: TrapInst[];
  regions: Record<RegionId, RegionState>;
  routes: RouteState[];
  world: {
    weather: WeatherId;
    tomorrow: WeatherId;
    forecastUntil: number; // last day whose weather the player knows
    pacing: Pacing;
    notableToday: number;
    ships: number[]; // absolute slots of upcoming ship passes
    shipKnown: boolean;
    currents: number; // sea-current knowledge 0..3
    lastRainDay: number;
    wreckPool: string[];
    ruinsPool: string[];
    campPool: string[];
  };
  flags: Record<string, number | boolean | string>;
  history: { id: string; at: number }[];
  chains: Record<string, ChainState>;
  scheduled: ScheduledEvent[];
  pending: PendingEvent | null;
  escape: EscapeState | null;
  journal: JournalEntry[];
  recentActions: { key: string; at: number }[];
  stats: {
    actions: number;
    checks: number;
    crits: number;
    critFails: number;
    events: number;
    crafted: number;
    lastDamage: string;
  };
  uid: number;
  last: TurnResult | null;
}

export interface CheckSpec {
  label?: string;
  attr: AttrId;
  skill?: SkillId;
  dc: number;
  mods?: { label: string; value: number }[];
  adv?: number;
  crit?: CritPolicy;
  /** outdoor checks get weather modifiers */
  outdoor?: boolean;
  /** action tags that weather (and other rules) can key on: fishing, hunting, gather, signal, fire, climb */
  tags?: string[];
  /** when false, no XP is granted */
  xp?: boolean;
}

export interface Req {
  label: string;
  met: boolean;
}
