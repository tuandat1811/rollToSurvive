// Balance configuration. All values are provisional (GDD: numbers are not locked)
// and live here so they can be tuned without touching game logic.

export const BALANCE = {
  start: {
    vitals: { health: 100, hunger: 80, thirst: 70, energy: 85 },
    attrBase: 1,
    attrPoints: 5,
    attrCreationMax: 4,
    attrMax: 6,
  },
  carry: { base: 25, basket: 10 },
  decay: {
    hungerPerSlot: 4,
    thirstPerSlot: 6,
    hungerNight: 6,
    thirstNight: 8,
    hotThirstMult: 1.5,
    illnessThirstExtra: 3,
    starveDamage: 5, // per slot when hunger = 0
    dehydrateDamage: 8, // per slot when thirst = 0
  },
  thresholds: { low: 25, critical: 10, exhausted: 15 },
  rest: { energy: 22, shelterBonus: 10, health: 2 },
  night: {
    energyBase: 30,
    energyLeanTo: 50,
    energyHut: 62,
    energyCave: 45,
    energyFire: 6,
    energyPenaltyNeeds: 10,
    energyPenaltyExposure: 15,
    energyPenaltyIllness: 10,
    healthRegen: 4,
    healthRegenShelter: 4,
    regenNeedMin: 35,
  },
  regen: { forage: 8, fish: 10, game: 6, wood: 6, alertDecay: 12 },
  dc: { trivial: 6, easy: 9, normal: 12, hard: 15, veryHard: 18, extreme: 21 },
  xp: {
    perLevel: [20, 35, 55, 80, 110],
    maxLevel: 5,
    novelty: 1.5,
    repeatWindowSlots: 32,
    repeatFactor: 0.35,
  },
  milestones: [3, 6, 10, 15, 21, 28, 36, 45],
  ships: { firstMin: 5, firstMax: 8, gapMinDays: 4, gapMaxDays: 7 },
  events: {
    pacingChance: { calm: 0.1, normal: 0.22, tense: 0.36 },
    softCap: 2,
    overCapMult: 0.25,
  },
} as const;

export const DC_LABELS: [number, string][] = [
  [7, 'Rất dễ'],
  [10, 'Dễ'],
  [13, 'Trung bình'],
  [16, 'Khó'],
  [19, 'Rất khó'],
  [99, 'Cực khó'],
];

export function dcLabel(dc: number): string {
  for (const [max, label] of DC_LABELS) if (dc <= max) return label;
  return 'Cực khó';
}
