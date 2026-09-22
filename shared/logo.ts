/**
 * Pixel Wall target picture: a pixel-art reinterpretation of the DynamoDB icon
 * (database cylinder + bolt on a blue tile). Not the official AWS artwork.
 * Only cells that belong to the picture can be written; every other cell stays black.
 */
export const LOGO_W = 32;
export const LOGO_H = 18;
const TILE = 16, OFFSET_X = 8, OFFSET_Y = 1;
// ' ' outside the tile, '.' tile background (gradient), W glyph, L glyph shade, Y bolt.
const ART = [
  ' .............. ',
  '................',
  '....WWWWWW......',
  '..WWLLLLLLWW....',
  '..WLLLLLLLLW....',
  '..WWLLLLLLWW....',
  '..W.WWWWWW.W....',
  '..W........W....',
  '..WW......WW..YY',
  '..W.WWWWWW.W.YY.',
  '..W........WYYYY',
  '..WW......WW.YY.',
  '..W.WWWWWW.WYY..',
  '...WW....WW.Y...',
  '.....WWWW.......',
  ' .............. ',
];
/** Colors by index: glyph, glyph shade, five tile shades (dark → light), bolt. */
export const LOGO_PALETTE = ['#FFFFFF', '#C9D3FF', '#2B1F8F', '#3A31BC', '#4A4FE0', '#5A70F4', '#6E92FF', '#FFB547'] as const;
function colorAt(x: number, y: number): number | null {
  const tx = x - OFFSET_X, ty = y - OFFSET_Y;
  if (tx < 0 || ty < 0 || tx >= TILE || ty >= TILE) return null;
  const ch = ART[ty]![tx]!;
  if (ch === ' ') return null;
  if (ch === 'W') return 0;
  if (ch === 'L') return 1;
  if (ch === 'Y') return 7;
  // Diagonal gradient, darker bottom-left, lighter top-right, like AWS service icons.
  return 2 + Math.min(4, Math.floor((tx + (TILE - 1 - ty)) / (2 * TILE - 1) * 5));
}
/** Expected color for a cell, or null when the cell is not part of the picture. */
export function logoColor(x: number, y: number): number | null {
  if (x < 0 || y < 0 || x >= LOGO_W || y >= LOGO_H) return null;
  return colorAt(x, y);
}
export const LOGO_CELLS: readonly { x: number; y: number; c: number }[] = (() => {
  const cells: { x: number; y: number; c: number }[] = [];
  for (let y = 0; y < LOGO_H; y++) for (let x = 0; x < LOGO_W; x++) { const c = colorAt(x, y); if (c !== null) cells.push({ x, y, c }); }
  return cells;
})();
