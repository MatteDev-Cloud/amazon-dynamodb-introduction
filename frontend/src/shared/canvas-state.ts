import type { CanvasResponse, Pixel } from '../../../shared/types.ts';
export class CanvasState {
  pixels = new Map<string, Pixel>(); cursor = 0; revision = -1; hidden = false;
  apply(data: CanvasResponse) {
    if (data.full) this.pixels.clear();
    this.hidden = data.hidden;
    if (data.hidden) this.pixels.clear();
    else for (const pixel of data.pixels) {
      const key = `${pixel.x},${pixel.y}`, old = this.pixels.get(key);
      // `e` (the item's own TTL) can change without `t` changing: the closing dissolve rewrites only the TTL.
      if (!old || pixel.t > old.t) this.pixels.set(key, pixel);
      else if (pixel.e !== undefined && pixel.e !== old.e) this.pixels.set(key, { ...old, e: pixel.e });
    }
    this.cursor = data.cursor; this.revision = data.canvasRevision;
  }
  /**
   * Drops the items whose own `expiresAt` has passed. DynamoDB removes them physically later and for free;
   * every reader — this one and the backend — already ignores them, which is what the closing scene shows.
   */
  expire(now: number) {
    let removed = 0;
    for (const [key, pixel] of this.pixels) if (pixel.e !== undefined && pixel.e * 1000 <= now) { this.pixels.delete(key); removed++; }
    return removed;
  }
}
