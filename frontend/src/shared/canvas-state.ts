import type { CanvasResponse, Pixel } from '../../../shared/types.ts';
export class CanvasState {
  pixels = new Map<string, Pixel>(); cursor = 0; revision = -1; hidden = false;
  apply(data: CanvasResponse) {
    if (data.full) this.pixels.clear();
    this.hidden = data.hidden;
    if (data.hidden) this.pixels.clear();
    else for (const pixel of data.pixels) {
      const key = `${pixel.x},${pixel.y}`, old = this.pixels.get(key);
      if (!old || pixel.t > old.t) this.pixels.set(key, pixel);
    }
    this.cursor = data.cursor; this.revision = data.canvasRevision;
  }
}
