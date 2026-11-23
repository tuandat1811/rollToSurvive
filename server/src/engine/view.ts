import type { ActionView, CheckView, ChoiceView, GameView, ItemView } from '../../../shared/types.js';
import { GROUP_NAMES, raftRiskNotes } from '../content/actions.js';
import { BALANCE, dcLabel } from '../content/balance.js';
import { CONDITIONS } from '../content/conditions.js';
import { RAFT_STAGES, RECIPES, STRUCTURES } from '../content/crafting.js';
import { ATTR_DEFS, LOCATION_DEFS, REGION_DEFS, ROUTE_DEFS, SKILL_DEFS, SLOT_NAMES, WEATHER_DEFS } from '../content/defs.js';
import { EVENTS } from '../content/events.js';
import { ITEMS } from '../content/items.js';
import { bands, odds, resolveCheck, successFace } from './check.js';
import { absSlot, carryMax, containerCap, storageWaterCap, waterCount, weightOf } from './ctx.js';
import { journey, stageCheck } from './escape.js';
import { buildEscapePlan } from './escapePlan.js';
import { actionEnergy, eventChoices, instances, materialStatus, unmetReasons } from './game.js';
import { ATTRS, REGIONS, SKILLS, type CheckSpec, type GameState, type ItemStack } from './types.js';

function checkView(s: GameState, spec: CheckSpec): CheckView {
  const rc = resolveCheck(s, spec);
  const b = bands(rc.totalMod, rc.dc, spec.crit);
  return {
    label: spec.label ?? '',
    attr: spec.attr,
    attrName: ATTR_DEFS[spec.attr].name,
    attrMod: rc.attrMod,
    skill: spec.skill,
    skillName: spec.skill ? SKILL_DEFS[spec.skill].name : undefined,
    skillMod: rc.skillMod,
    mods: rc.mods,
    totalMod: rc.totalMod,
    dc: rc.dc,
    dcLabel: dcLabel(rc.dc),
    adv: rc.adv,
    odds: odds(rc),
    dice: rc.adv === 0 ? 1 : 2,
    bands: b,
    successFace: successFace(b),
    crit: spec.crit ?? 'standard',
  };
}

function itemViews(s: GameState, list: ItemStack[]): ItemView[] {
  const now = absSlot(s);
  // merge stacks with the same id + same spoil day for display
  const groups = new Map<string, ItemView>();
  for (const st of list) {
    const d = ITEMS[st.id];
    if (!d) continue;
    const spoilsIn = st.exp !== undefined ? Math.max(0, Math.ceil((st.exp - now) / 4)) : undefined;
    const risky = (st.risk ?? 0) > 0 || (d.food?.risk && !(st.id === 'berries' && s.skills.survival.lvl >= 2));
    const key = `${st.id}|${spoilsIn ?? ''}|${st.dur ?? ''}|${risky ? 1 : 0}`;
    const ex = groups.get(key);
    if (ex) {
      ex.qty += st.qty;
      continue;
    }
    const restores = d.food
      ? `No +${d.food.hunger}${d.food.thirst ? `, Nước +${d.food.thirst}` : ''}`
      : d.water
        ? `Nước +${d.water.thirst}`
        : undefined;
    groups.set(key, {
      id: st.id,
      name: d.name,
      icon: d.icon,
      kind: d.kind,
      desc: d.desc,
      qty: st.qty,
      weight: d.weight,
      spoilsIn,
      dur: st.dur,
      maxDur: d.dur,
      risky: !!risky,
      usable: d.water ? 'drink' : d.food ? 'eat' : undefined,
      restores,
    });
  }
  const order = ['water', 'food', 'medical', 'tool', 'special', 'material'];
  return [...groups.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name));
}

export function buildView(id: string, s: GameState): GameView {
  const now = absSlot(s);
  const actions: ActionView[] =
    s.status === 'playing' && !s.pending && !s.escape
      ? instances(s).map((inst) => {
          const { def, param } = inst;
          const reasons = unmetReasons(s, inst);
          const spec = def.check?.(s, param) ?? null;
          return {
            key: inst.key,
            id: def.id,
            group: def.group,
            groupName: GROUP_NAMES[def.group],
            icon: def.icon(s, param),
            name: def.name(s, param),
            desc: def.desc(s, param),
            hint: def.hint?.(s, param),
            slots: def.slots ?? 1,
            energy: actionEnergy(s, def, param),
            materials: materialStatus(s, def.materials?.(s, param) ?? []).map((m) => ({
              ...m,
              name: ITEMS[m.id].name,
              icon: ITEMS[m.id].icon,
            })),
            reqs: def.reqs?.(s, param) ?? [],
            available: reasons.length === 0,
            reasons,
            check: spec ? checkView(s, spec) : undefined,
            notes: def.notes?.(s, param) ?? [],
            priority: def.priority?.(s, param) ?? 10,
            followUp: !!def.followUp,
          };
        })
      : [];

  let pending: GameView['pending'] = null;
  if (s.pending && s.status === 'playing') {
    const def = EVENTS[s.pending.eventId];
    const choices: ChoiceView[] = eventChoices(s).map((c) => {
      const reasons = (c.reqs ?? []).filter((r) => !r.met).map((r) => r.label);
      if ((c.energy ?? 0) > s.vitals.energy) reasons.push(`Không đủ năng lượng (cần ${c.energy})`);
      return {
        id: c.id,
        label: c.label,
        icon: c.icon,
        desc: c.desc,
        slots: c.slots,
        energy: c.energy ?? 0,
        reqs: c.reqs ?? [],
        available: reasons.length === 0,
        reasons,
        check: c.check ? checkView(s, c.check) : undefined,
      };
    });
    const extra = typeof s.pending.data?.extra === 'string' ? ` ${s.pending.data.extra}` : '';
    pending = {
      uid: s.pending.uid,
      id: def.id,
      title: def.title,
      icon: def.icon,
      category: def.category,
      risk: def.risk,
      text: def.text(s, s.pending.data) + extra,
      changes: s.pending.changes ?? [],
      choices,
    };
  }

  let escape: GameView['escape'] = null;
  if (s.escape && s.status === 'playing') {
    const stages = journey(s.escape.method);
    escape = {
      method: s.escape.method,
      stage: s.escape.stage,
      stages: stages.map((x) => ({ name: x.name, desc: x.desc })),
      canReturn: s.escape.canReturn,
      check: checkView(s, stageCheck(s)),
      notes: s.escape.method === 'raft' ? raftRiskNotes(s) : [],
    };
  }

  const forecast: GameView['forecast'] = [];
  if (s.world.forecastUntil > s.day) {
    const w = WEATHER_DEFS[s.world.tomorrow];
    forecast.push({ day: s.day + 1, id: s.world.tomorrow, name: w.name, icon: w.icon, mood: w.mood, effects: w.effects });
  }

  const raft = s.projects.find((p) => p.id === 'raft');
  const next = s.world.ships[0];

  return {
    id,
    name: s.name,
    version: s.version,
    status: s.status,
    ending: s.ending,
    day: s.day,
    slot: s.slot,
    slotNames: SLOT_NAMES,
    weather: (() => {
      const w = WEATHER_DEFS[s.world.weather];
      return { id: s.world.weather, name: w.name, icon: w.icon, desc: w.desc, mood: w.mood, effects: w.effects };
    })(),
    forecast,
    stormWarning: s.world.tomorrow === 'storm' && s.world.forecastUntil > s.day,
    location: { id: s.location, name: REGION_DEFS[s.location].name, icon: REGION_DEFS[s.location].icon, desc: REGION_DEFS[s.location].desc },
    baseRegion: s.baseRegion,
    vitals: {
      health: Math.round(s.vitals.health),
      hunger: Math.round(s.vitals.hunger),
      thirst: Math.round(s.vitals.thirst),
      energy: Math.round(s.vitals.energy),
    },
    conditions: s.conditions.map((c) => {
      const d = CONDITIONS[c.id];
      return { id: c.id, name: d.name(c.sev), icon: d.icon, sev: c.sev, desc: d.desc(c.sev), good: !!d.good, treated: c.treated };
    }),
    attrs: ATTRS.map((a) => ({ id: a, name: ATTR_DEFS[a].name, desc: ATTR_DEFS[a].desc, value: s.attrs[a] })),
    attrPoints: s.attrPoints,
    attrMax: BALANCE.start.attrMax,
    skills: SKILLS.map((k) => {
      const sk = s.skills[k];
      const d = SKILL_DEFS[k];
      return {
        id: k,
        name: d.name,
        icon: d.icon,
        desc: d.desc,
        lvl: sk.lvl,
        xp: sk.xp,
        next: sk.lvl >= BALANCE.xp.maxLevel ? 0 : BALANCE.xp.perLevel[sk.lvl],
        perks: Object.entries(d.perks).map(([l, text]) => ({ lvl: Number(l), text, unlocked: sk.lvl >= Number(l) })),
      };
    }),
    inventory: itemViews(s, s.inventory),
    storage: itemViews(s, s.storage),
    carry: { weight: Math.round(weightOf(s.inventory) * 10) / 10, max: carryMax(s) },
    water: { carried: waterCount(s.inventory), cap: containerCap(s.inventory), stored: waterCount(s.storage), storeCap: storageWaterCap(s) },
    raft: raft ? { stage: raft.stage, integrity: raft.integrity, stages: RAFT_STAGES.map((x) => x.name) } : undefined,
    traps: s.traps.map((t) => ({ kind: t.kind, region: REGION_DEFS[t.region].name, ready: t.readyAt <= now })),
    escapePlan: buildEscapePlan(s, checkView),
    knowledge: {
      currents: s.world.currents,
      shipKnown: s.world.shipKnown,
      shipNext: s.world.shipKnown && next !== undefined ? { day: Math.floor(next / 4) + 1, slot: next % 4 } : undefined,
      recipes: [
        ...RECIPES.filter((r) => !r.unlocked || r.unlocked(s)).map((r) => r.name),
        ...STRUCTURES.filter((r) => !r.unlocked || r.unlocked(s)).map((r) => r.name),
      ],
    },
    map: {
      regions: REGIONS.map((rid) => {
        const r = s.regions[rid];
        const d = REGION_DEFS[rid];
        const visited = r.discovery === 'discovered';
        return {
          id: rid,
          name: r.discovery === 'unknown' ? '???' : d.name,
          icon: r.discovery === 'unknown' ? '❔' : d.icon,
          desc: r.discovery === 'discovered' ? d.desc : r.discovery === 'clued' ? 'Bạn mới chỉ nhìn thấy nơi này từ xa.' : 'Chưa biết.',
          discovery: r.discovery,
          surveyed: r.surveyed,
          unexplored: r.explorePool.length,
          x: d.pos.x,
          y: d.pos.y,
          here: s.location === rid,
          base: s.baseRegion === rid,
          seaView: d.seaView,
          locations: r.found.map((l) => ({ id: l, name: LOCATION_DEFS[l].name, icon: LOCATION_DEFS[l].icon, desc: LOCATION_DEFS[l].desc })),
          structures: s.structures
            .filter((x) => x.region === rid)
            .map((x) => {
              const sd = STRUCTURES.find((q) => q.id === x.id)!;
              return { id: x.id, name: sd.name, icon: sd.icon, integrity: x.integrity, lit: x.lit };
            }),
          traps: s.traps.filter((t) => t.region === rid).length,
          water:
            rid === 'river' && visited
              ? r.waterKnown && r.water === 'contaminated'
                ? 'Ô nhiễm!'
                : r.water === 'muddy'
                  ? 'Đục sau mưa'
                  : 'Bình thường'
              : undefined,
          abundance: visited ? { ...r.abundance } : undefined,
        };
      }),
      routes: s.routes
        .filter((r) => r.known)
        .map((r) => ({
          id: r.id,
          name: ROUTE_DEFS.find((d) => d.id === r.id)!.name,
          a: r.a,
          b: r.b,
          status: r.status,
          energy: r.energy,
          danger: !!r.danger,
          detour: !!r.detour,
        })),
    },
    actions,
    pending,
    escape,
    journal: [...s.journal].reverse().slice(0, 150),
    stats: {
      actions: s.stats.actions,
      checks: s.stats.checks,
      crits: s.stats.crits,
      critFails: s.stats.critFails,
      events: s.stats.events,
      crafted: s.stats.crafted,
    },
    last: s.last,
  };
}
