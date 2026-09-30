import type { LeaderboardResponse, Meta, PlayersResponse, StatsResponse } from '../../../shared/types.js';
import { type Api, ApiFailure, poll } from './api';
import { config } from './config';
import { message } from './ui';
import { CanvasSync } from './sync';
import { exampleLeaderboard, exampleMeta, examplePixels, examplePlayers, exampleStats } from '../stage/static';

/** Reactive view of one session, shared by the LIM and the Regia. */
export class Session {
  meta = $state<Meta>();
  stats = $state<StatsResponse>();
  players = $state<PlayersResponse['players']>([]);
  leaderboard = $state<LeaderboardResponse>();
  notice = $state('');
  online = $state(true);
  /** Server-corrected clock: for anything the backend also timestamps (phase ends, round ends, TTL). */
  now = $state(Date.now());
  /**
   * Plain local clock. Anything measured inside this browser — how long ago the other window spoke — must
   * use this one. Mixing it with `now` makes a healthy link look dead as soon as the laptop clock differs
   * from the server's by more than the staleness threshold.
   */
  wall = $state(Date.now());
  /** Bumped at every canvas change so derived values (lit count) recompute. */
  canvasTick = $state(0);
  sync: CanvasSync;
  private stops: (() => void)[] = [];
  private noticeWhileOffline = false;

  constructor(public api: Api) {
    this.sync = new CanvasSync(api);
    this.sync.subscribe(() => { this.canvasTick++; });
  }

  get admin() { return !!this.api.admin || config.mock; }
  get lit() { void this.canvasTick; return this.sync.lit; }

  report = (error: unknown) => {
    if (error instanceof ApiFailure && error.status === 401) this.notice = 'Chiave admin mancante o errata: apri la regia.';
    else this.notice = message(error);
    this.online = this.api.online;
    this.noticeWhileOffline = !this.online;
  };

  /**
   * Reporter for the background polls. A 409 or a 429 is the protocol working as designed (someone else got
   * there first, cooldown, phase moved on): the poll retries on its own, so it must not leave a red line on
   * the projector for the rest of the talk.
   */
  quiet = (error: unknown) => {
    if (error instanceof ApiFailure && [409, 429].includes(error.status)) return;
    this.report(error);
  };

  start({ canvasMs = 500 } = {}) {
    const tick = setInterval(() => {
      this.now = this.api.now(); this.wall = Date.now();
      this.sync.expire(this.now);
      this.online = config.static || config.mock || this.api.online;
      // A notice about a dropped connection is stale once the connection is back.
      if (this.online && this.noticeWhileOffline) { this.notice = ''; this.noticeWhileOffline = false; }
    }, 100);
    this.stops.push(() => clearInterval(tick));
    if (config.static) { this.loadExamples(); return; }
    this.stops.push(
      poll(async () => { this.meta = await this.api.call<Meta>('/meta'); }, 1000, this.report),
      poll(async () => { if (!this.admin) return; const r = await this.api.call<PlayersResponse>('/players'); this.players = r.players; }, 2000, this.quiet),
      poll(async () => { if (!this.admin) return; this.stats = await this.api.call<StatsResponse>('/stats'); }, 1000, this.quiet),
      poll(async () => { if (this.meta?.roundId) this.leaderboard = await this.api.call<LeaderboardResponse>('/leaderboard'); }, 1000, this.quiet),
      poll(async () => { if (this.meta) await this.sync.refresh(); }, canvasMs, this.quiet),
    );
    const online = () => { void this.sync.refresh(true).catch(this.quiet); };
    window.addEventListener('online', online);
    this.stops.push(() => window.removeEventListener('online', online));
  }
  stop() { this.stops.forEach(s => s()); this.stops = []; }

  private loadExamples() {
    this.meta = exampleMeta; this.stats = exampleStats; this.players = examplePlayers; this.leaderboard = exampleLeaderboard;
    for (const p of examplePixels) this.sync.state.pixels.set(`${p.x},${p.y}`, p);
    this.sync.refresh = async () => {};
    this.canvasTick++;
  }
}
