import type { GameView, NewGameInfo, RunSummary } from '../../shared/types.ts';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public view?: GameView,
  ) {
    super(message);
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Lỗi máy chủ (${res.status})`, res.status, data.view);
  return data as T;
}

export const api = {
  meta: () => req<NewGameInfo>('GET', '/api/meta'),
  create: (name: string, attrs: Record<string, number>) => req<{ view: GameView }>('POST', '/api/runs', { name, attrs }),
  list: (ids: string[]) => req<{ runs: RunSummary[] }>('GET', `/api/runs?ids=${ids.join(',')}`),
  get: (id: string) => req<{ view: GameView }>('GET', `/api/runs/${id}`),
  remove: (id: string) => req<{ ok: boolean }>('DELETE', `/api/runs/${id}`),
  act: (id: string, path: string, body: Record<string, unknown>) => req<{ view: GameView }>('POST', `/api/runs/${id}/${path}`, body),
};

// ---- saves are tracked per browser (no accounts)
const KEY = 'rts.runs';

export function savedRuns(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberRun(id: string) {
  try {
    const list = [id, ...savedRuns().filter((x) => x !== id)].slice(0, 20);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export function forgetRun(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(savedRuns().filter((x) => x !== id)));
  } catch {
    /* storage unavailable */
  }
}
