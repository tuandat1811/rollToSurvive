// API DTOs shared by server and client. The client never sees raw GameState:
// the server projects only what the character can know.

export type Tier = 'crit_success' | 'success' | 'partial' | 'failure' | 'crit_failure';
export type ChangeKind = 'gain' | 'loss' | 'good' | 'bad' | 'info';

export interface Change {
  kind: ChangeKind;
  text: string;
}

export interface Mod {
  label: string;
  value: number;
}

export interface RollInfo {
  label: string;
  attr: string;
  attrMod: number;
  skill?: string;
  skillMod: number;
  mods: Mod[];
  dc: number;
  dice: number[];
  adv: number;
  natural: number;
  total: number;
  tier: Tier;
  bands?: Band[];
  crit?: CritPolicy;
}

export type CritPolicy = 'standard' | 'safe' | 'none';

/** which kept-die faces / totals give a tier (best tier first) */
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

export interface CheckView {
  label: string;
  attr: string;
  attrName: string;
  attrMod: number;
  skill?: string;
  skillName?: string;
  skillMod: number;
  mods: Mod[];
  totalMod: number;
  dc: number;
  dcLabel: string;
  adv: number;
  odds: Record<Tier, number>;
  /** number of d20 rolled (2 = advantage/disadvantage, keep higher/lower) */
  dice: number;
  bands: Band[];
  /** lowest kept-die face for Success or better; null = impossible */
  successFace: number | null;
  crit: CritPolicy;
}

export interface MaterialView {
  id: string;
  name: string;
  icon: string;
  qty: number;
  have: number;
}

export interface ActionView {
  key: string;
  id: string;
  group: string;
  groupName: string;
  icon: string;
  name: string;
  desc: string;
  hint?: string;
  slots: number;
  energy: number;
  materials: MaterialView[];
  reqs: { label: string; met: boolean }[];
  available: boolean;
  reasons: string[];
  check?: CheckView;
  notes: string[];
  priority: number;
  followUp: boolean;
  /** content registry code, e.g. ACT-CRF-003 */
  code?: string;
  /** soft progression tier 1–3 */
  tier?: number;
  /** attemptable without the skill/knowledge, at a penalty */
  untrained?: boolean;
  /** set on actions that belong to a world object */
  objectUid?: number;
}

export interface ChoiceView {
  id: string;
  label: string;
  icon?: string;
  desc?: string;
  slots: number;
  energy: number;
  reqs: { label: string; met: boolean }[];
  available: boolean;
  reasons: string[];
  check?: CheckView;
}

export interface EventView {
  uid: number;
  id: string;
  title: string;
  icon: string;
  category: string;
  risk: number;
  text: string;
  changes: Change[];
  choices: ChoiceView[];
  /** content registry code, e.g. EVT-WLD-009 */
  code?: string;
  rarity?: string;
  source?: string;
}

export interface EscapeView {
  method: 'raft' | 'desperate';
  stage: number;
  stages: { name: string; desc: string }[];
  canReturn: boolean;
  check: CheckView;
  notes: string[];
}

export interface ItemView {
  id: string;
  name: string;
  icon: string;
  kind: string;
  desc: string;
  qty: number;
  weight: number;
  spoilsIn?: number; // days
  dur?: number;
  maxDur?: number;
  risky?: boolean;
  usable?: 'eat' | 'drink';
  restores?: string;
}

export interface ConditionView {
  id: string;
  name: string;
  icon: string;
  sev: number;
  desc: string;
  good: boolean;
  treated?: boolean;
}

export interface RegionView {
  id: string;
  name: string;
  icon: string;
  desc: string;
  discovery: 'unknown' | 'clued' | 'discovered';
  surveyed: boolean;
  unexplored: number;
  x: number;
  y: number;
  here: boolean;
  base: boolean;
  seaView: boolean;
  locations: { id: string; name: string; icon: string; desc: string; state?: string; stateGood?: boolean }[];
  /** persistent world objects lying in this region */
  objects: { uid: number; kind: string; name: string; icon: string; desc: string; daysLeft?: number }[];
  structures: { id: string; name: string; icon: string; integrity: number; lit?: boolean }[];
  traps: number;
  water?: string;
  abundance?: { forage: number; fish: number; game: number; wood: number };
}

export interface RouteView {
  id: string;
  name: string;
  a: string;
  b: string;
  status: 'open' | 'blocked';
  energy: number;
  danger: boolean;
  detour: boolean;
}

export interface SkillView {
  id: string;
  name: string;
  icon: string;
  desc: string;
  lvl: number;
  xp: number;
  next: number;
  perks: { lvl: number; text: string; unlocked: boolean }[];
}

export interface EscapeMethodView {
  id: 'raft' | 'desperate' | 'signal';
  name: string;
  icon: string;
  summary: string;
  /** ready = can start here now; not_here = go to the right place; locked = missing something; waiting = needs a ship/plane */
  status: 'ready' | 'not_here' | 'locked' | 'waiting';
  statusText: string;
  /** action key to start right now, when possible */
  actionKey?: string;
  /** action key to travel towards the departure point */
  travelKey?: string;
  reqs: { label: string; met: boolean }[];
  stages?: { name: string; desc: string; check: CheckView }[];
  signals?: { id: string; name: string; icon: string; desc: string; owned: boolean; check: CheckView }[];
  info: string[];
  timeCost: string;
  penalties: string[];
}

export interface EscapePlanView {
  methods: EscapeMethodView[];
  atSea: boolean;
}

export interface WeatherView {
  id: string;
  name: string;
  icon: string;
  desc: string;
  mood: 'good' | 'neutral' | 'bad' | 'danger';
  /** player-facing buffs (good) and nerfs */
  effects: { text: string; good: boolean }[];
}

export interface GameView {
  id: string;
  name: string;
  version: number;
  status: 'playing' | 'victory' | 'dead';
  ending?: { kind: string; title: string; text: string; day: number };
  day: number;
  slot: number;
  slotNames: string[];
  weather: WeatherView;
  forecast: (Omit<WeatherView, 'desc'> & { day: number })[];
  stormWarning: boolean;
  location: { id: string; name: string; icon: string; desc: string };
  baseRegion: string | null;
  vitals: { health: number; hunger: number; thirst: number; energy: number };
  conditions: ConditionView[];
  attrs: { id: string; name: string; desc: string; value: number }[];
  attrPoints: number;
  attrMax: number;
  skills: SkillView[];
  inventory: ItemView[];
  storage: ItemView[];
  carry: { weight: number; max: number };
  water: { carried: number; cap: number; stored: number; storeCap: number };
  raft?: { stage: number; integrity: number; stages: string[] };
  traps: { kind: string; region: string; ready: boolean }[];
  escapePlan: EscapePlanView;
  /** island traits rolled for this run */
  traits: { id: string; name: string; icon: string; desc: string; mood: 'good' | 'bad' | 'mixed' }[];
  knowledge: { currents: number; shipNext?: { day: number; slot: number }; shipKnown: boolean; recipes: string[] };
  map: { regions: RegionView[]; routes: RouteView[] };
  actions: ActionView[];
  pending: EventView | null;
  escape: EscapeView | null;
  journal: { day: number; slot: number; kind: string; text: string }[];
  stats: { actions: number; checks: number; crits: number; critFails: number; events: number; crafted: number };
  last: TurnResult | null;
}

export interface RunSummary {
  id: string;
  name: string;
  day: number;
  slot: number;
  status: 'playing' | 'victory' | 'dead';
  updatedAt: number;
}

export interface NewGameInfo {
  attrs: { id: string; name: string; desc: string }[];
  base: number;
  points: number;
  max: number;
}
