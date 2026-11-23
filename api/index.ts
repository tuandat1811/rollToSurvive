// Vercel Function entry: every /api/* request is rewritten here (see vercel.json)
// and handed to the same Fastify app used locally.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../server/src/app.js';

const app = buildApp();
const ready = app.ready();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ready;
  app.server.emit('request', req, res);
}
