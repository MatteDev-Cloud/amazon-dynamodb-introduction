import type { ApiResponse, Inspect } from '../../../shared/types.js';
import { config, adminKey } from './config';
export class ApiFailure extends Error {
  constructor(public status: number, message: string, public retryInMs = 0, public code = '') { super(message); }
}
export interface Measured { path: string; data: unknown; details: Inspect; totalMs: number; at: number }
export class Api {
  offset = 0; latency = 0; admin = sessionStorage.getItem(adminKey) || ''; pid = '';
  /** Last measured request, plus the last one per endpoint so the X-Ray can show a meaningful operation. */
  inspect?: Measured;
  inspects: Record<string, Measured> = {};
  transport?: (path: string, body?: unknown) => Promise<unknown>;
  private failures = 0;
  private lastOkAt = Date.now();
  /**
   * Set once the backend has rejected the admin key. A pasted-wrong key is the likeliest operator mistake
   * of the day, and a green badge next to a red log entry is worse than no badge.
   */
  adminRejected = false;
  /**
   * A single blip must not put "Rete assente" on the projector. Five polls run in parallel against a
   * five-second timeout, so one slow answer is normal: it takes two failures in a row *and* four seconds
   * without a single success before we call the backend unreachable.
   */
  get online() { return this.failures < 2 || Date.now() - this.lastOkAt < 4000; }
  now() { return Date.now() + this.offset; }
  /** sid defaults to the page session; the Regia passes another one only to create a new session. */
  async call<T>(path: string, body?: unknown, sid = config.sid): Promise<ApiResponse<T>> {
    const start = Date.now();
    try {
      let data: ApiResponse<T>;
      if (this.transport) data = await this.transport(path, body) as ApiResponse<T>;
      else {
        const response = await fetch(`${config.api.replace(/\/$/, '')}/s/${encodeURIComponent(sid)}${path}`, {
          method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000),
          headers: { 'Content-Type': 'application/json', ...(this.admin ? {'x-admin-key': this.admin, 'x-inspect': '1'} : {}), ...(this.pid ? {'x-player-id': this.pid} : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        data = await response.json();
        if (!response.ok) { const e = data as any; throw new ApiFailure(response.status, e.message || 'Richiesta rifiutata', e.retryInMs, e.error); }
      }
      this.latency = Date.now() - start;
      this.offset = data.serverTime - (start + Date.now()) / 2;
      this.failures = 0; this.lastOkAt = Date.now();
      // Un 200 non basta come prova: /meta risponde a tutti, anche con una chiave sbagliata. Il backend
      // allega _inspect solo quando la chiave e stata accettata, quindi e quello il segnale affidabile.
      if (this.admin && !this.transport) this.adminRejected = !data._inspect;
      if (data._inspect) {
        const { _inspect, ...payload } = data;
        this.inspect = { path, data: payload, details: _inspect, totalMs: Date.now() - start, at: Date.now() };
        this.inspects[path.split('?')[0]!] = this.inspect;
      }
      return data;
    } catch (error) {
      // A rejection the backend chose (409, 429, 404…) proves it is answering: only transport errors count.
      if (error instanceof ApiFailure) {
        this.failures = 0; this.lastOkAt = Date.now();
        if (error.status === 401 && this.admin) this.adminRejected = true;
      } else this.failures++;
      throw error;
    }
  }
}
export function poll(task: () => Promise<void>, ms: number, onError: (error: unknown) => void) {
  let stopped = false, timer: ReturnType<typeof setTimeout>;
  const run = async () => { try { await task(); } catch (e) { onError(e); } finally { if (!stopped) timer = setTimeout(run, ms); } };
  void run(); return () => { stopped = true; clearTimeout(timer); };
}
