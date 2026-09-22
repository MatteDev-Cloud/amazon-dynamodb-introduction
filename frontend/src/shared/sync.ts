import type { CanvasResponse, Pixel } from '../../../shared/types.js';
import { LOGO_CELLS } from '../../../shared/logo.js';
import type { Api } from './api';
import { CanvasState } from './canvas-state';

/** Polls the canvas (full snapshot every 15 s, deltas via ByTime otherwise) and reports newly lit cells. */
export class CanvasSync {
  state = new CanvasState();
  private lastFull = 0;
  private busy = false;
  private listeners = new Set<(fresh: Pixel[], full: boolean) => void>();
  /** Returns an unsubscribe function. */
  subscribe(listener: (fresh: Pixel[], full: boolean) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit(fresh: Pixel[], full: boolean) { for (const l of this.listeners) l(fresh, full); }
  constructor(private api: Api) {}

  async refresh(force = false) {
    if (this.busy) return;
    this.busy = true;
    try {
      const full = force || !this.api.online || Date.now() - this.lastFull >= 15000 || this.state.revision < 0;
      const data = await this.api.call<CanvasResponse>(full ? '/canvas' : `/canvas/changes?since=${this.state.cursor}&revision=${this.state.revision}`);
      const before = new Map(this.state.pixels);
      this.state.apply(data);
      if (data.full) this.lastFull = Date.now();
      const fresh = [...this.state.pixels.values()].filter(p => {
        if (p.deleted) return false;
        const old = before.get(`${p.x},${p.y}`);
        return !old || old.deleted || p.t > old.t;
      });
      // A first snapshot is not "new": nothing pops in when a screen opens mid-game.
      this.emit(this.primed ? fresh : [], data.full);
      this.primed = true;
    } finally { this.busy = false; }
  }
  private primed = false;

  /** Local optimistic insert (swarm, phone) before the next poll confirms it. */
  add(pixel: Pixel) {
    const key = `${pixel.x},${pixel.y}`, old = this.state.pixels.get(key);
    if (!old || old.deleted || pixel.t > old.t) { this.state.pixels.set(key, pixel); this.emit([pixel], false); }
  }

  get lit() { let n = 0; for (const p of this.state.pixels.values()) if (!p.deleted) n++; return n; }
  get total() { return LOGO_CELLS.length; }
  remaining() { return LOGO_CELLS.filter(c => { const p = this.state.pixels.get(`${c.x},${c.y}`); return !p || p.deleted; }); }
}
