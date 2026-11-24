// Event families: events that share the same underlying situation/mechanic.
// "Tìm được 3 gỗ" and "Tìm được 5 gỗ" are one family — variety is measured per
// family, not per event id. Families drive the family cooldown and novelty weighting.

export const EVENT_FAMILY: Record<string, string> = {
  // wild boar encounters and their consequences
  bush_noise: 'boar',
  wounded_boar: 'boar',
  injured_boar: 'boar',
  boar_raid: 'boar_camp',
  boar_tracks_camp: 'boar_camp',
  boar_night_raid: 'boar_camp',
  boar_sow_angry: 'boar',
  boar_friend_visit: 'boar_friend',
  // monkeys
  monkey_thief: 'monkey',
  monkey_troop: 'monkey',
  monkeys_lead: 'monkey_friend',
  monkey_raid: 'monkey',
  // other animals
  snake_at_spring: 'snake',
  bee_hive: 'bees',
  stranded_dolphin: 'dolphin',
  dolphins_return: 'dolphin',
  dolphin_washed: 'dolphin',
  wounded_seabird: 'sea_animal',
  turtle_nesting: 'sea_animal',
  // free stuff washing up / falling down
  coconut_fall: 'windfall',
  bottles_in_sand: 'windfall',
  kelp_washup: 'windfall',
  falling_fruit: 'windfall',
  mushrooms_after_rain: 'windfall',
  lost_cargo: 'driftage',
  message_bottle: 'driftage',
  storm_debris: 'driftage',
  // food-finding opportunities
  wild_yams: 'forage_find',
  fish_school: 'fish',
  // mood
  nightmare: 'mood',
  starry_night: 'mood',
  rainbow: 'mood',
  copper_locket: 'mood',
  // base & weather trouble
  loose_roof: 'shelter_trouble',
  damp_fuel: 'fire_trouble',
  landslide: 'route_trouble',
  cave_collapse: 'route_trouble',
  // discoveries
  freshwater_seep: 'discovery',
  sharp_stone: 'discovery',
  second_wind: 'mood',
  boar_signs: 'boar_camp',
  ground_cracks: 'route_trouble',
  rockfall_signs: 'route_trouble',
  strange_rock: 'discovery',
  hidden_hollow: 'discovery',
  human_footprints: 'discovery',
  // action-triggered finds
  net_snag: 'driftage',
  bird_nest: 'bird',
  island_in_distance: 'sea_sign',
  false_beacon: 'sea_sign',
  calm_sea: 'sea_sign',
};

/** minimum days between two random events of the same family */
export const FAMILY_COOLDOWN_DAYS: Record<string, number> = {
  boar: 3,
  boar_camp: 3,
  monkey: 3,
  snake: 4,
  bees: 4,
  dolphin: 3,
  sea_animal: 2,
  windfall: 1,
  driftage: 2,
  forage_find: 2,
  mood: 2,
  shelter_trouble: 2,
  fire_trouble: 2,
  discovery: 1,
  sea_sign: 2,
  bird: 3,
  route_trouble: 3,
};

export function familyOf(eventId: string): string {
  return EVENT_FAMILY[eventId] ?? eventId;
}

/** novelty weighting knobs */
export const NOVELTY = {
  neverSeen: 1.8, // a brand-new event is favoured
  perTimeSeen: 0.35, // weight / (1 + 0.35 × times this event was seen)
  familyWindowDays: 6,
  perRecentFamily: 0.8, // weight / (1 + 0.8 × same-family events in the window)
};

/**
 * Director pacing multiplier P by event category: tense days favour danger,
 * calm days favour discovery, resources and quiet moments.
 */
export const PACING_CATEGORY_MULT: Record<'calm' | 'normal' | 'tense', Partial<Record<string, number>>> = {
  calm: { wildlife: 0.7, health: 0.6, base: 0.7, weather: 0.8, discovery: 1.3, resources: 1.2, psychology: 1.3, narrative: 1.2 },
  normal: {},
  tense: { wildlife: 1.4, health: 1.4, base: 1.3, weather: 1.2, discovery: 0.8, resources: 0.9, psychology: 0.8 },
};

/** chance that a finished action triggers one of its after-action events */
export const AFTER_ACTION_CHANCE = 0.22;


/**
 * Controlled randomness: after a run of hardship (misfortune ≥ ROUGH) the Director
 * damps risky events and favours recovery opportunities. Dice are never touched.
 */
export const MISFORTUNE = {
  rough: 3,
  max: 10,
  riskyMult: 0.25, // weight × for risk ≥ 2 events while rough
  recoveryMult: 2.5, // weight × for recovery events while rough
  roughEventChance: 0.6, // chance of a day_start event while rough (so recovery can show up)
  nightKeep: 0.6, // misfortune × each night
  nightDrop: 0.3,
  recoveryRelief: 1.5, // misfortune − when a recovery event happens
};

/** events that give the player breathing room */
export const RECOVERY_EVENTS = new Set([
  'fish_school', 'coconut_fall', 'falling_fruit', 'kelp_washup', 'bottles_in_sand', 'mushrooms_after_rain',
  'wild_yams', 'starry_night', 'rainbow', 'calm_sea', 'boar_friend_visit', 'dolphins_return', 'second_wind',
]);
