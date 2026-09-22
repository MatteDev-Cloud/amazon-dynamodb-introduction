import { PALETTE, type Pixel } from '../../../shared/types.js';
import { LOGO_H, LOGO_W } from '../../../shared/logo.js';

/**
 * LED-matrix renderer for the Pixel Wall. Pure drawing: data comes from CanvasSync.
 * Unlit cells are faint dots on black; lit cells pop in as colored dots.
 */
export interface BoardOptions { glow?: boolean; padding?: number }
type Anim = { start: number; delay: number };
const POP_MS = 560, FLASH_MS = 900, SHIMMER_MS = 1600;

export class Board {
  w = LOGO_W; h = LOGO_H;
  pixels = new Map<string, Pixel>();
  private pops = new Map<string, Anim>();
  private flashes = new Map<string, { start: number; color: string }>();
  marked = new Set<string>();
  selected?: { x: number; y: number };
  rect?: { x1: number; y1: number; x2: number; y2: number };
  hidden = false;
  /** 0..1: faint preview of the target picture (regia, never on the LIM). */
  ghost = 0;
  ghostCells: { x: number; y: number; c: number }[] = [];
  private shimmerAt = 0;
  private frame = 0;
  private dpr = 1;
  private observer: ResizeObserver;

  constructor(public canvas: HTMLCanvasElement, private options: BoardOptions = {}) {
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }
  destroy() { this.observer.disconnect(); cancelAnimationFrame(this.frame); }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(r.width * this.dpr)), height = Math.max(1, Math.round(r.height * this.dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.draw();
  }

  /** Board geometry in canvas pixels. */
  private geometry() {
    const pad = (this.options.padding ?? 0.03) * Math.min(this.canvas.width, this.canvas.height);
    const cell = Math.min((this.canvas.width - pad * 2) / this.w, (this.canvas.height - pad * 2) / this.h);
    return { cell, ox: (this.canvas.width - cell * this.w) / 2, oy: (this.canvas.height - cell * this.h) / 2 };
  }

  setSize(w: number, h: number) { if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.draw(); } }

  /** Replace pixels; `fresh` ones animate in, staggered by their server timestamps over `spreadMs`. */
  update(pixels: Map<string, Pixel>, fresh: Pixel[] = [], spreadMs = 450) {
    this.pixels = pixels;
    if (fresh.length) {
      const sorted = [...fresh].sort((a, b) => a.t - b.t), min = sorted[0]!.t, span = Math.max(1, sorted.at(-1)!.t - min);
      const now = performance.now();
      for (const p of sorted) this.pops.set(`${p.x},${p.y}`, { start: now, delay: fresh.length === 1 ? 0 : (p.t - min) / span * spreadMs });
    }
    this.kick();
  }
  flash(x: number, y: number, color = '#FF5A4E') { this.flashes.set(`${x},${y}`, { start: performance.now(), color }); this.kick(); }
  shimmer() { this.shimmerAt = performance.now(); this.kick(); }

  cellAt(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect(), g = this.geometry();
    const px = (clientX - r.left) / r.width * this.canvas.width, py = (clientY - r.top) / r.height * this.canvas.height;
    const x = Math.floor((px - g.ox) / g.cell), y = Math.floor((py - g.oy) / g.cell);
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? { x, y } : null;
  }
  /** Center and size of a cell in client (CSS) coordinates. */
  cellClient(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect(), g = this.geometry(), sx = r.width / this.canvas.width, sy = r.height / this.canvas.height;
    return { x: r.left + (g.ox + (x + .5) * g.cell) * sx, y: r.top + (g.oy + (y + .5) * g.cell) * sy, size: g.cell * sx };
  }

  private kick() { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); }); }

  draw() {
    const ctx = this.canvas.getContext('2d'); if (!ctx) return;
    const { cell, ox, oy } = this.geometry(), now = performance.now();
    let animating = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.hidden) {
      ctx.fillStyle = '#6E7282'; ctx.font = `${Math.round(cell * 1.1)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Tela temporaneamente nascosta', this.canvas.width / 2, this.canvas.height / 2); return;
    }
    const cx = (x: number) => ox + (x + .5) * cell, cy = (y: number) => oy + (y + .5) * cell;
    // Unlit grid: faint dots.
    ctx.fillStyle = '#1D2029';
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const p = this.pixels.get(`${x},${y}`);
      if (p && !p.deleted) continue;
      ctx.beginPath(); ctx.arc(cx(x), cy(y), cell * .13, 0, Math.PI * 2); ctx.fill();
    }
    if (this.ghost > 0) {
      ctx.globalAlpha = this.ghost;
      for (const g of this.ghostCells) if (!this.pixels.get(`${g.x},${g.y}`) || this.pixels.get(`${g.x},${g.y}`)!.deleted) {
        ctx.strokeStyle = PALETTE[g.c]!; ctx.lineWidth = Math.max(1, cell * .06);
        ctx.beginPath(); ctx.arc(cx(g.x), cy(g.y), cell * .32, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const shimmer = this.shimmerAt ? (now - this.shimmerAt) / SHIMMER_MS : -1;
    if (shimmer >= 0 && shimmer <= 1) animating = true; else this.shimmerAt = 0;
    for (const p of this.pixels.values()) {
      if (p.deleted) continue;
      const key = `${p.x},${p.y}`, pop = this.pops.get(key);
      let scale = 1, ring = -1;
      if (pop) {
        const t = (now - pop.start - pop.delay) / POP_MS;
        if (t < 0) { animating = true; continue; }
        if (t >= 1) this.pops.delete(key);
        else { animating = true; scale = backOut(Math.min(1, t * 1.6)); ring = t; }
      }
      const color = PALETTE[p.c] ?? '#FFFFFF', r = cell * .42 * scale;
      if (this.options.glow) { ctx.shadowColor = color; ctx.shadowBlur = cell * .45; }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx(p.x), cy(p.y), Math.max(0, r), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (shimmer >= 0 && shimmer <= 1) {
        const d = Math.abs((p.x + p.y) / (this.w + this.h) * 1.4 - (shimmer * 1.8 - .2));
        if (d < .12) { ctx.globalAlpha = (1 - d / .12) * .75; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(cx(p.x), cy(p.y), r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      }
      if (ring >= 0) {
        ctx.globalAlpha = (1 - ring) * .55; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, cell * .07);
        ctx.beginPath(); ctx.arc(cx(p.x), cy(p.y), cell * (.45 + ring * 1.1), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (this.marked.has(key)) {
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(1.5, cell * .09);
        ctx.beginPath(); ctx.arc(cx(p.x), cy(p.y), cell * .47, 0, Math.PI * 2); ctx.stroke();
      }
    }
    for (const [key, f] of this.flashes) {
      const t = (now - f.start) / FLASH_MS;
      if (t >= 1) { this.flashes.delete(key); continue; }
      animating = true;
      const [x, y] = key.split(',').map(Number) as [number, number];
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = f.color; ctx.lineWidth = Math.max(2, cell * .12);
      ctx.beginPath(); ctx.arc(cx(x), cy(y), cell * (.5 + Math.sin(t * Math.PI) * .45), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (this.selected) {
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(2, cell * .1);
      ctx.strokeRect(ox + this.selected.x * cell, oy + this.selected.y * cell, cell, cell);
    }
    if (this.rect) {
      const a = this.rect; ctx.strokeStyle = '#FF5A4E'; ctx.lineWidth = Math.max(2, cell * .12); ctx.setLineDash([cell * .3, cell * .2]);
      ctx.strokeRect(ox + a.x1 * cell, oy + a.y1 * cell, (a.x2 - a.x1 + 1) * cell, (a.y2 - a.y1 + 1) * cell); ctx.setLineDash([]);
    }
    if (animating) this.kick();
  }
}
function backOut(t: number) { const s = 1.9; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); }
