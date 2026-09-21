import type { ApiResponse, Inspect } from '../../../shared/types.js';
import { config, adminKey } from './config';
export class ApiFailure extends Error {
  constructor(public status: number, message: string, public retryInMs = 0, public code = '') { super(message); }
}
export class Api {
  offset = 0; online = true; admin = sessionStorage.getItem(adminKey) || ''; pid = '';
  inspect?: { path: string; data: unknown; details: Inspect; totalMs: number };
  transport?: (path: string, body?: unknown) => Promise<unknown>;
  now() { return Date.now() + this.offset; }
  async call<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const start = Date.now();
    try {
      let data: ApiResponse<T>;
      if (this.transport) data = await this.transport(path, body) as ApiResponse<T>;
      else {
        const response = await fetch(`${config.api.replace(/\/$/, '')}/s/${encodeURIComponent(config.sid)}${path}`, {
          method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000),
          headers: { 'Content-Type': 'application/json', ...(this.admin ? {'x-admin-key': this.admin, 'x-inspect': '1'} : {}), ...(this.pid ? {'x-player-id': this.pid} : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        data = await response.json();
        if (!response.ok) { const e = data as any; throw new ApiFailure(response.status, e.message || 'Richiesta rifiutata', e.retryInMs, e.error); }
      }
      this.offset = data.serverTime - (start + Date.now()) / 2;
      this.online = true;
      if (data._inspect) { const { _inspect, ...payload } = data; this.inspect = {path, data: payload, details: _inspect, totalMs: Date.now() - start}; }
      return data;
    } catch (error) { if (!(error instanceof ApiFailure)) this.online = false; throw error; }
  }
}
export function poll(task: () => Promise<void>, ms: number, onError: (error: unknown) => void) {
  let stopped = false, timer: ReturnType<typeof setTimeout>;
  const run = async () => { try { await task(); } catch (e) { onError(e); } finally { if (!stopped) timer = setTimeout(run, ms); } };
  void run(); return () => { stopped = true; clearTimeout(timer); };
}
