import type { LeaderboardResponse, Meta, Pixel, Player, PlayersResponse, RawPixel, StatsResponse } from '../../../shared/types.js';
import { PRICES, estimateCost } from '../../../shared/pricing.js';
import { LOGO_CELLS, LOGO_H, LOGO_W } from '../../../shared/logo.js';

/** Fallback statico: dati dichiaratamente simulati, nessuna chiamata API. */
const names = ['ada', 'grace', 'linus', 'alan', 'margaret', 'dennis', 'barbara', 'ken', 'radia', 'tim', 'frances', 'guido', 'hedy', 'edsger', 'katherine', 'donald', 'anita', 'john', 'sophie', 'vint'];
const pid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
export const examplePlayers: PlayersResponse['players'] = names.map((nickname, i) => ({ pid: pid(i), nickname, team: i % 3 === 1 ? 'purple' : i % 2 ? 'orange' : 'purple', joinedAt: i }));
export const examplePixels: Pixel[] = LOGO_CELLS.map((c, i) => ({ ...c, by: names[(i * 7) % names.length]!, t: 1_000 + i * 40 }));
export const examplePlayer: Player = { PK: 'SESSION#esempio', SK: `PLAYER#${pid(0)}`, pid: pid(0), nickname: 'ada', team: 'purple', joinedAt: 1_700_000_000_000, pixelsPlaced: 14, lastPixelAt: 1_700_000_090_000, score: 87, expiresAt: 1_700_086_400 };
export const examplePixel = (x: number, y: number): RawPixel => {
  const p = examplePixels.find(v => v.x === x && v.y === y) ?? examplePixels[0]!;
  return { PK: 'CANVAS#esempio', SK: `PX#${String(p.x).padStart(3, '0')}#${String(p.y).padStart(3, '0')}`, x: p.x, y: p.y, color: p.c, by: 'ada', byId: pid(0), cv: 'esempio', updatedAt: 1_700_000_090_000, expiresAt: 1_700_086_400 };
};
export const exampleMeta: Meta = { sid: 'esempio', phase: 'end', version: 1, phaseStartedAt: 0, phaseEndsAt: null, canvasW: LOGO_W, canvasH: LOGO_H, cooldownMs: 500, roundMs: 15000, pixelMs: 90000, canvasHidden: false, canvasRevision: 0, teamsRevealed: true, roundId: 'esempio', roundStartedAt: null, roundEndsAt: null, tapGraceMs: 2000, expiresAt: 0, prompt: 'Accendete il logo', botsEnabled: false };
const measurements = { playersJoined: 40, pixelsPlaced: 380, pixelConflicts: 23, taps: 3800, teamOrange: 2000, teamPurple: 1800, apiCalls: 8400, wruTable: 16000, wruGsi: 7000, rruTable: 13000, rruGsi: 4200, lambdaMs: 210000, estimated: true as const, expiresAt: 0 };
export const exampleStats: StatsResponse = { ...measurements, prices: PRICES, estimatedCost: estimateCost(measurements), costBasis: 'on-demand-list-price' };
export const exampleLeaderboard: LeaderboardResponse = { top: examplePlayers.slice(0, 8).map((p, i) => ({ nickname: p.nickname, team: p.team, score: 140 - i * 11, rank: i + 1 })), provisional: false, roundId: 'esempio' };
