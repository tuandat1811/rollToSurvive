import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyReply } from 'fastify';
import { z } from 'zod';
import { BALANCE } from './content/balance.js';
import { ATTR_DEFS } from './content/defs.js';
import { Store } from './db.js';
import {
  GameError,
  allocateAttr,
  chooseEvent,
  consume,
  dropItem,
  escapeStep,
  newGame,
  performAction,
  transfer,
} from './engine/game.js';
import { newSeed } from './engine/rng.js';
import { ATTRS, type AttrId, type GameState, type TurnResult } from './engine/types.js';
import { buildView } from './engine/view.js';

const ID = z.string().uuid();
const attrSchema = z.enum(['STR', 'AGI', 'END', 'INT', 'PER']);

export function buildApp(store = new Store()) {
  const app = Fastify({ logger: process.env.NODE_ENV === 'production' ? { level: 'warn' } : false });

  const load = async (id: string, reply: FastifyReply): Promise<GameState | null> => {
    if (!ID.safeParse(id).success) {
      reply.code(400).send({ error: 'Mã ván chơi không hợp lệ' });
      return null;
    }
    const s = await store.get(id);
    if (!s) {
      reply.code(404).send({ error: 'Không tìm thấy ván chơi' });
      return null;
    }
    return s;
  };

  /** run a state transition and commit it atomically */
  const mutate = async (
    id: string,
    version: number,
    reply: FastifyReply,
    fn: (s: GameState) => { state: GameState; result: TurnResult },
  ) => {
    const s = await load(id, reply);
    if (!s) return;
    if (s.version !== version) return reply.code(409).send({ error: 'Trạng thái đã thay đổi, đang tải lại…', view: buildView(id, s) });
    try {
      const { state } = fn(s);
      if (!(await store.commit(id, state, version))) {
        const cur = (await store.get(id))!;
        return reply.code(409).send({ error: 'Trạng thái đã thay đổi, đang tải lại…', view: buildView(id, cur) });
      }
      return { view: buildView(id, state) };
    } catch (e) {
      if (e instanceof GameError) return reply.code(422).send({ error: e.message });
      throw e;
    }
  };

  app.get('/api/meta', async () => ({
    attrs: ATTRS.map((a) => ({ id: a, name: ATTR_DEFS[a].name, desc: ATTR_DEFS[a].desc })),
    base: BALANCE.start.attrBase,
    points: BALANCE.start.attrPoints,
    max: BALANCE.start.attrCreationMax,
  }));

  app.post('/api/runs', async (req, reply) => {
    const body = z
      .object({ name: z.string().max(40).default(''), attrs: z.record(attrSchema, z.number().int()) })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Dữ liệu không hợp lệ' });
    try {
      const s = newGame(body.data.name, body.data.attrs as Record<AttrId, number>, newSeed());
      const id = randomUUID();
      await store.create(id, s);
      return { view: buildView(id, s) };
    } catch (e) {
      if (e instanceof GameError) return reply.code(422).send({ error: e.message });
      throw e;
    }
  });

  app.get('/api/runs', async (req) => {
    const ids = String((req.query as Record<string, string>).ids ?? '')
      .split(',')
      .filter((x) => ID.safeParse(x).success)
      .slice(0, 50);
    return { runs: await store.summaries(ids) };
  });

  app.get('/api/runs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const s = await load(id, reply);
    if (!s) return;
    return { view: buildView(id, s) };
  });

  app.delete('/api/runs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!ID.safeParse(id).success) return reply.code(400).send({ error: 'Mã ván chơi không hợp lệ' });
    await store.delete(id);
    return { ok: true };
  });

  const v = z.number().int().nonnegative();
  const routes: [string, z.ZodTypeAny, (s: GameState, b: any) => { state: GameState; result: TurnResult }][] = [
    ['action', z.object({ version: v, key: z.string().max(80) }), (s, b) => performAction(s, b.key)],
    ['choice', z.object({ version: v, choiceId: z.string().max(40) }), (s, b) => chooseEvent(s, b.choiceId)],
    ['escape', z.object({ version: v, decision: z.enum(['roll', 'return']) }), (s, b) => escapeStep(s, b.decision)],
    ['consume', z.object({ version: v, itemId: z.string().max(40), from: z.enum(['inv', 'storage']) }), (s, b) => consume(s, b.itemId, b.from)],
    [
      'transfer',
      z.object({ version: v, itemId: z.string().max(40), qty: z.number().int().min(1).max(999), dir: z.enum(['store', 'take']) }),
      (s, b) => transfer(s, b.itemId, b.qty, b.dir),
    ],
    ['drop', z.object({ version: v, itemId: z.string().max(40), qty: z.number().int().min(1).max(999) }), (s, b) => dropItem(s, b.itemId, b.qty)],
    ['attr', z.object({ version: v, attr: attrSchema }), (s, b) => allocateAttr(s, b.attr)],
  ];
  for (const [name, schema, fn] of routes) {
    app.post(`/api/runs/:id/${name}`, async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = schema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'Dữ liệu không hợp lệ' });
      return mutate(id, body.data.version, reply, (s) => fn(s, body.data));
    });
  }

  const dist = resolve(import.meta.dirname, '../../client/dist');
  if (existsSync(dist)) {
    app.register(fastifyStatic, { root: dist });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) return reply.code(404).send({ error: 'Không tìm thấy' });
      return reply.sendFile('index.html');
    });
  }

  return app;
}
