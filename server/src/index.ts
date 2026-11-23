import { buildApp } from './app.ts';

// In dev the Vite client proxies /api to 3001 (PORT may be set for the client by tooling).
const port = Number(process.env.RTS_PORT ?? (process.env.NODE_ENV === 'production' ? (process.env.PORT ?? 3001) : 3001));
const app = buildApp();

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`Roll To Survive server: http://localhost:${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
