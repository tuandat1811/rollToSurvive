// Content catalog export (GDD Diversity-01): every action, event and consequence
// with its code and classification → docs/content-catalog.csv (UTF-8, opens in Excel).
// Usage: npm run content:export
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from '../src/content/actions.js';
import { CONSEQUENCE_LIST, CONSEQUENCE_TARGET_TOTAL } from '../src/content/consequences.js';
import { EVENTS } from '../src/content/events.js';
import { ACTION_CATEGORY_NAMES, ACTION_META, ACTION_TARGETS, EVENT_META, type ActionCategory } from '../src/content/meta.js';
import { OBJECT_DEFS } from '../src/content/objects.js';
import { LOCATION_STATES } from '../src/content/locationStates.js';
import { LOCATION_DEFS } from '../src/content/defs.js';
import { newGame } from '../src/engine/game.js';

const s = newGame('Catalog', { STR: 2, AGI: 2, END: 2, INT: 2, PER: 2 }, 1);
const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

type Row = [string, string, string, string, string, string, string, string, string];
const rows: Row[] = [];

// ------------------------------------------------------------ actions
for (const [key, meta] of Object.entries(ACTION_META)) {
  const cat = meta.code.split('-')[1] as ActionCategory;
  const parts = key.split(':');
  let name = key;
  let desc = '';
  if (parts[0] === 'object') {
    const obj = OBJECT_DEFS[parts[1]];
    const a = obj?.actions.find((x) => x.id === parts[2]);
    name = a ? `${a.label} (${obj.name})` : key;
    desc = a?.desc ?? '';
  } else {
    const def = ACTIONS[parts[0]];
    if (!def) throw new Error(`ACTION_META key without action: ${key}`);
    const p = parts[1] ?? safe(() => def.variants?.(s)[0] ?? '', '');
    name = parts[1] ? safe(() => def.name(s, p), key) : safe(() => def.name(s, p), key).replace(/ tới .*$/, '');
    desc = safe(() => def.desc(s, p), '');
  }
  rows.push(['Action', meta.code, key, name, ACTION_CATEGORY_NAMES[cat], `Tier ${meta.tier}`, '', '', desc]);
}

// ------------------------------------------------------------ events
for (const [id, meta] of Object.entries(EVENT_META)) {
  const def = EVENTS[id];
  if (!def) throw new Error(`EVENT_META id without event: ${id}`);
  rows.push(['Event', meta.code, id, def.title, def.category, meta.rarity, meta.source, def.once ? 'once' : def.cooldownDays ? `cooldown ${def.cooldownDays}d` : '', safe(() => def.text(s), '')]);
}

// ------------------------------------------------------------ consequences
for (const c of CONSEQUENCE_LIST) rows.push(['Consequence', c.code, c.id, c.name, c.type, '', c.target, c.persistence, c.desc]);

// ------------------------------------------------------------ world state content (no codes yet)
for (const o of Object.values(OBJECT_DEFS))
  rows.push(['WorldObject', '', o.id, o.name, 'object', '', '', o.lifetimeDays ? `${o.lifetimeDays} days` : 'until handled', o.desc]);
for (const [loc, m] of Object.entries(LOCATION_STATES))
  for (const [st, d] of Object.entries(m.states))
    rows.push(['LocationState', '', `${loc}:${st}`, `${LOCATION_DEFS[loc]?.name ?? loc}: ${d.label}`, 'location', '', '', st === m.initial ? 'initial' : 'until_resolved', d.desc]);

// ------------------------------------------------------------ write
const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const header: Row = ['Type', 'Code', 'ID', 'Name', 'Category', 'Tier/Rarity', 'Source/Target', 'Persistence', 'Description'];
const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/content-catalog.csv');
writeFileSync(out, csv);

const count = (t: string) => rows.filter((r) => r[0] === t).length;
const target = Object.values(ACTION_TARGETS).reduce((a, b) => a + b, 0);
console.log(`Wrote ${rows.length} rows → ${out}`);
console.log(`Actions: ${count('Action')} / ${target} · Events: ${count('Event')} / 350 · Consequences: ${count('Consequence')} / ${CONSEQUENCE_TARGET_TOTAL}`);
const byCat: Record<string, number> = {};
for (const r of rows) if (r[0] === 'Action') byCat[r[1].split('-')[1]] = (byCat[r[1].split('-')[1]] ?? 0) + 1;
console.log('Actions by category:', Object.entries(ACTION_TARGETS).map(([c, t]) => `${c} ${byCat[c] ?? 0}/${t}`).join(' · '));
