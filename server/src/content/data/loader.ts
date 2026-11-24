// Turns content-pack rows into live EventDefs and ActionDefs. Building only parses
// strings (pure); registries such as CONSEQUENCES are consulted at play time.
import { con } from '../../engine/consequence.js';
import type { Ctx } from '../../engine/ctx.js';
import type { AttrId, CheckSpec, CritPolicy, GameState, Req, SkillId, Tier } from '../../engine/types.js';
import type { ActionDef, ActionGroup } from '../actions.js';
import type { EventCategory, EventChoice, EventDef, EventTrigger } from '../events.js';
import { PACK } from './pack.js';
import {
  type Condition,
  type ConRef,
  describeCondition,
  evalAll,
  fillText,
  list,
  parseConditions,
  parseConsequences,
  parseContext,
  parseMaterials,
  parseMods,
  parseOpposed,
  resolveParams,
  yes,
} from './parse.js';
import type { ActionRow, ChoiceRow, ContentPack, EventRow, OutcomeRow } from './schema.js';

// ------------------------------------------------------------ outcomes

interface Outcome {
  tier: string;
  when: Condition[];
  text: string;
  cons: ConRef[];
}

const TIER_FALLBACK: Partial<Record<Tier, Tier>> = { crit_success: 'success', crit_failure: 'failure', partial: 'failure' };

function outcomesFor(rows: OutcomeRow[], owner: string): Outcome[] {
  return rows
    .filter((r) => r.owner === owner)
    .map((r) => ({ tier: r.tier.trim(), when: parseConditions(r.if), text: r.text, cons: parseConsequences(r.consequences) }));
}

function applyList(ctx: Ctx, list: Outcome[]) {
  for (const o of list) {
    if (!evalAll(ctx.s, o.when)) continue;
    if (o.text) ctx.say(fillText(o.text, ctx.s));
    for (const c of o.cons) con(ctx, c.id, resolveParams(c.params, ctx.s, (a, b) => ctx.rng.int(a, b)));
  }
}

/** apply the outcome rows of a tier (falling back crit→plain, partial→failure), plus `always` rows */
export function applyOutcome(ctx: Ctx, outcomes: Outcome[], tier: Tier) {
  let t: Tier | undefined = tier;
  let rows = outcomes.filter((o) => o.tier === t);
  while (!rows.length && t && TIER_FALLBACK[t]) {
    t = TIER_FALLBACK[t];
    rows = outcomes.filter((o) => o.tier === t);
  }
  applyList(ctx, rows);
  applyList(ctx, outcomes.filter((o) => o.tier === 'always'));
}

// ------------------------------------------------------------ checks

interface CheckCols {
  attr: string;
  skill: string;
  dc: number | '';
  crit: string;
  checkTags: string;
  mods: string;
  opposed: string;
  label: string;
}

function buildCheck(row: CheckCols): ((s: GameState) => CheckSpec) | null {
  if (!row.attr) return null;
  const mods = parseMods(row.mods);
  const opposed = parseOpposed(row.opposed);
  const tags = list(row.checkTags);
  return (s) => ({
    label: row.label,
    attr: row.attr as AttrId,
    skill: (row.skill || undefined) as SkillId | undefined,
    dc: Number(row.dc || (opposed ? 11 + opposed.bonus : 10)),
    crit: (row.crit || undefined) as CritPolicy | undefined,
    outdoor: true,
    tags: tags.length ? tags : undefined,
    mods: mods.filter((m) => evalAll(s, m.when)).map((m) => ({ label: m.label, value: m.value })),
    opposed,
  });
}

const reqsOf = (s: GameState, conds: Condition[]): Req[] => conds.map((c) => ({ label: describeCondition(c), met: evalAll(s, [c]) }));

// ------------------------------------------------------------ events

function buildEvent(pack: ContentPack, row: EventRow): EventDef {
  const conds = parseConditions(row.conditions);
  const context = parseContext(row.context);
  const passive = outcomesFor(pack.outcomes, `event:${row.id}`);
  const choiceRows = pack.choices.filter((c) => c.event === row.id);
  const choices = choiceRows.map((c) => buildChoice(pack, row.id, c));
  const weight = Number(row.weight || 0);
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    category: row.category as EventCategory,
    risk: Math.max(1, Math.min(4, Number(row.risk) || 1)) as 1 | 2 | 3 | 4,
    trigger: row.trigger as EventTrigger,
    onAction: list(row.onAction).length ? list(row.onAction) : undefined,
    notable: yes(row.notable) || undefined,
    once: yes(row.once) || undefined,
    cooldownDays: row.cooldownDays === '' ? undefined : Number(row.cooldownDays),
    recovery: yes(row.recovery) || undefined,
    eligible: conds.length ? (s) => evalAll(s, conds) : undefined,
    weight: weight > 0 ? () => weight : undefined,
    context: context.length ? (s) => context.reduce((a, r) => (evalAll(s, r.when) ? a * r.mult : a), 1) : undefined,
    cause: row.cause ? (s) => fillText(row.cause, s) : undefined,
    text: (s) => fillText(row.text, s),
    passive: passive.length ? (ctx) => applyOutcome(ctx, passive, 'success') : undefined,
    choices: choices.length ? (s) => choices.map((f) => f(s)) : undefined,
    journal: row.journal ? (yes(row.journal) ? true : row.journal) : undefined,
  };
}

function buildChoice(pack: ContentPack, eventId: string, c: ChoiceRow): (s: GameState) => EventChoice {
  const requires = parseConditions(c.requires);
  const materials = parseMaterials(c.materials);
  const check = buildCheck({ ...c, label: c.label });
  const outcomes = outcomesFor(pack.outcomes, `${eventId}:${c.id}`);
  return (s) => ({
    id: c.id,
    label: c.label,
    icon: c.icon || undefined,
    desc: c.desc || undefined,
    slots: Number(c.slots) || 0,
    energy: c.energy === '' ? undefined : Number(c.energy),
    reqs: requires.length ? reqsOf(s, requires) : undefined,
    materials: materials.length ? materials : undefined,
    check: check ? check(s) : undefined,
    resolve: (ctx, tier) => applyOutcome(ctx, outcomes, tier),
  });
}

// ------------------------------------------------------------ actions

const k = <T>(v: T) => () => v;

function buildAction(pack: ContentPack, row: ActionRow): ActionDef {
  const visible = parseConditions(row.conditions);
  const requires = parseConditions(row.requires);
  const materials = parseMaterials(row.materials);
  const check = buildCheck({ ...row, label: row.name });
  const outcomes = outcomesFor(pack.outcomes, row.id);
  const cd = Number(row.cooldownDays || 0);
  const cdFlag = `dataCooldown:${row.id}`;
  return {
    id: row.id,
    group: row.group as ActionGroup,
    icon: k(row.icon),
    name: k(row.name),
    desc: (s) => fillText(row.desc, s),
    hint: row.hint ? k(row.hint) : undefined,
    slots: Number(row.slots ?? 1),
    energy: k(Number(row.energy) || 0),
    visible: (s) => evalAll(s, visible),
    reqs: (s) => {
      const out = reqsOf(s, requires);
      if (cd) {
        const ready = Number(s.flags[cdFlag] ?? 0);
        out.push({ label: `Chưa làm lại được (mỗi ${cd} ngày một lần)`, met: s.day >= ready });
      }
      return out;
    },
    materials: materials.length ? k(materials) : undefined,
    check: check ? (s) => check(s) : undefined,
    priority: k(row.priority === '' ? 15 : Number(row.priority)),
    resolve: (ctx, tier) => {
      if (cd) ctx.flag(cdFlag, ctx.s.day + cd);
      applyOutcome(ctx, outcomes, tier);
    },
  };
}

// ------------------------------------------------------------ registry

export function buildPack(pack: ContentPack) {
  return {
    events: pack.events.map((r) => buildEvent(pack, r)),
    actions: pack.actions.map((r) => buildAction(pack, r)),
  };
}

const built = buildPack(PACK);
export const DATA_EVENTS: EventDef[] = built.events;
export const DATA_ACTIONS: ActionDef[] = built.actions;
/** event families declared in the pack */
export const DATA_FAMILIES: Record<string, string> = Object.fromEntries(PACK.events.filter((e) => e.family).map((e) => [e.id, e.family]));
