import type { JoinResponse, PixelResponse } from '../../../shared/types.js';
import { Api, ApiFailure } from '../shared/api';
import type { Message } from '../shared/channel';
import type { Session } from '../shared/session.svelte';

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>(resolve => {
  const id = setTimeout(resolve, Math.max(0, ms));
  signal.addEventListener('abort', () => { clearTimeout(id); resolve(); }, { once: true });
});

/**
 * "Our command": N virtual players join and light the missing cells in parallel against the real API.
 * Workers pick cells at random without coordinating, so near the end they collide on the same cell:
 * the conditional write lets the first one win and rejects the others (409 PIXEL_TAKEN). No locks.
 */
export class Swarm {
  running = $state(false);
  workers = $state(16);
  ok = $state(0);
  conflicts = $state(0);
  throttled = $state(0);
  retries = $state(0);
  status = $state('');
  private abort?: AbortController;
  private taken = new Set<string>();

  constructor(private session: Session, private send: (message: Message) => void) {}

  stop() { this.abort?.abort(); }

  async start() {
    const meta = this.session.meta;
    if (this.running) return;
    if (meta?.phase !== 'pixel') { this.status = 'Lo sciame parte solo con la tela attiva (fase pixel).'; return; }
    this.running = true; this.ok = this.conflicts = this.throttled = this.retries = 0; this.taken.clear();
    const abort = this.abort = new AbortController();
    // Bots never carry the admin key: they are ordinary players.
    const api = new Api(); api.admin = ''; api.transport = this.session.api.transport;
    try {
      this.status = `Entrano ${this.workers} giocatori virtuali…`;
      const joined = await Promise.all(Array.from({ length: this.workers }, (_, i) =>
        api.call<JoinResponse>('/join', { nickname: `bot.${String(i + 1).padStart(2, '0')}` }).catch(() => null)));
      const bots = joined.filter((b): b is NonNullable<typeof b> => !!b);
      if (!bots.length) throw Error('Nessun giocatore virtuale è riuscito a entrare (ingresso chiuso?).');
      this.status = `${bots.length} scrittori in parallelo`;
      await Promise.all(bots.map(bot => this.worker(api, bot, meta.cooldownMs, abort.signal)));
      this.status = abort.signal.aborted ? 'Sciame fermato.' : this.remaining().length ? 'Tela chiusa prima del completamento.' : 'Logo completato.';
    } catch (e) {
      this.status = e instanceof Error ? e.message : 'Sciame interrotto';
    } finally { this.running = false; }
  }

  private remaining() { return this.session.sync.remaining().filter(c => !this.taken.has(`${c.x},${c.y}`)); }

  private async worker(api: Api, bot: JoinResponse, cooldownMs: number, signal: AbortSignal) {
    let backoff = 150;
    while (!signal.aborted) {
      const free = this.remaining();
      if (!free.length) return;
      const cell = free[Math.floor(Math.random() * free.length)]!;
      try {
        const result = await api.call<PixelResponse>('/pixel', { pid: bot.pid, x: cell.x, y: cell.y, c: cell.c });
        this.ok++; backoff = 150;
        const at = result.nextAllowedAt - cooldownMs;
        this.session.sync.add({ ...cell, by: bot.nickname, t: at });
        this.send({ t: 'lit', ...cell, by: bot.nickname, at });
        await sleep(result.nextAllowedAt - api.now(), signal);
      } catch (e) {
        if (e instanceof ApiFailure && e.code === 'PIXEL_TAKEN') {
          this.conflicts++; this.taken.add(`${cell.x},${cell.y}`);
          this.send({ t: 'conflict', x: cell.x, y: cell.y });
        } else if (e instanceof ApiFailure && e.status === 429) {
          this.throttled++; await sleep(e.retryInMs || cooldownMs, signal);
        } else if (e instanceof ApiFailure && (e.code === 'WRONG_PHASE' || e.status === 403 || e.status === 404)) {
          return;
        } else {
          // 503 (transaction conflict on shared items) or network: back off with jitter and retry.
          this.retries++; await sleep(backoff + Math.random() * backoff, signal); backoff = Math.min(2000, backoff * 2);
        }
      }
    }
  }
}
