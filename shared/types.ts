/** Contract v1. All dates are epoch milliseconds, except expiresAt (epoch seconds). */
export const PHASES = ['lobby', 'pixel', 'pixel_frozen', 'talk', 'hotkey_ready', 'hotkey_running', 'hotkey_end', 'end'] as const;
export type Phase = typeof PHASES[number];
export type Team = 'orange' | 'purple';
/** Pixel colors come from the target picture (see logo.ts). */
export { LOGO_PALETTE as PALETTE } from './logo.js';
export interface Meta {
  sid: string; phase: Phase; version: number; createdAt: number; phaseStartedAt: number; phaseEndsAt: number | null;
  canvasW: number; canvasH: number; cooldownMs: number; roundMs: number; pixelMs: number;
  canvasHidden: boolean; canvasRevision: number; teamsRevealed: boolean;
  roundId: string | null; roundStartedAt: number | null; roundEndsAt: number | null;
  tapGraceMs: number; expiresAt: number; prompt: string; botsEnabled: boolean;
  /** TTL of the canvas items (epoch seconds): 24 h during the talk, a few dozen seconds once the closing starts. */
  canvasExpiresAt: number;
  /** How long the closing dissolve lasts: entering the `end` phase spreads the pixel TTLs over this window. */
  endTtlMs: number;
}
export interface Player {
  PK: string; SK: string; pid: string; nickname: string; team: Team; joinedAt: number;
  pixelsPlaced?: number; lastPixelAt?: number; score?: number; lastSeq?: number; lastDelta?: number;
  roundId?: string; lb?: string; banned?: boolean; expiresAt: number;
}
/** `e` is the item's own TTL attribute (epoch seconds): the closing dissolve is driven by it. */
export interface Pixel { x: number; y: number; c: number; by: string; t: number; deleted?: boolean; e?: number }
export interface RawPixel {
  PK: string; SK: string; x: number; y: number; color: number; by: string; byId: string;
  cv: string; updatedAt: number; deleted?: boolean; expiresAt: number;
}
export interface CapacityUnits { table: number; gsi: Record<string, number> }
export interface Capacity extends CapacityUnits { read?: CapacityUnits; write?: CapacityUnits }
export interface InspectOperation {
  op: string; params: Record<string, unknown>; consumed: Capacity; ddbMs: number; items: number;
}
export interface Inspect extends InspectOperation { operations: InspectOperation[] }
export interface Envelope { serverTime: number; _inspect?: Inspect }
export type ApiResponse<T> = T & Envelope;
export interface ApiError extends Envelope { error: string; message: string; retryInMs?: number }
export interface JoinRequest { nickname: string }
export interface JoinResponse { pid: string; team: Team; nickname: string }
export interface PlayersResponse { players: {pid: string; nickname: string; team: Team; joinedAt: number}[]; total: number }
/** c is optional: the server derives it from the picture and rejects a mismatch. */
export interface PixelRequest { pid: string; x: number; y: number; c?: number }
export interface PixelResponse { ok: true; nextAllowedAt: number }
export interface TapRequest { pid: string; delta: number; seq: number; roundId: string }
export interface TapResponse { score: number; acceptedSeq: number; duplicate: boolean }
export interface CanvasResponse { pixels: Pixel[]; cursor: number; canvasRevision: number; hidden: boolean; full: boolean }
export interface Leader { nickname: string; team: Team; score: number; rank: number }
export interface LeaderboardResponse { top: Leader[]; provisional: boolean; roundId: string | null }
export interface RankResponse { rank: number | null; total: number; score: number; provisional: boolean }
export interface PhaseRequest { phase: Phase; expectedVersion: number; durationMs?: number }
export interface SessionConfig { canvasW?: number; canvasH?: number; cooldownMs?: number; roundMs?: number; pixelMs?: number; prompt?: string; endTtlMs?: number }
export interface ClearRequest { x1: number; y1: number; x2: number; y2: number }
export interface ClearResponse { deleted: number; canvasRevision: number }
/** The metered quantities behind the receipt. */
export interface Counters { apiCalls: number; wruTable: number; wruGsi: number; rruTable: number; rruGsi: number; lambdaMs: number }
export interface CostShare extends Counters { estimatedCost: number | null }
/**
 * `audience` is the part of the totals that came without the admin key: phones and virtual players.
 * The rest (LIM, regia, the meter's own writes) does not grow with the room, so projections leave it ×1.
 * Absent on sessions created before the split existed.
 */
export interface StatsResponse extends Stats { prices: PriceConfig; estimatedCost: number | null; costBasis: 'on-demand-list-price'; audience?: CostShare }
/**
 * What AWS itself reports for the resources behind this session (CloudWatch, not the app's own counters).
 * `window` is the measured interval; CloudWatch publishes with a delay, so `staleMs` says how old the last point is.
 */
export interface AwsUsage {
  from: number; to: number; staleMs: number | null; period: number;
  wruTable: number; wruGsi: Record<string, number>; rruTable: number; rruGsi: Record<string, number>;
  apiRequests: number; lambdaInvocations: number; lambdaMs: number; lambdaErrors: number; throttled: number;
}
export interface AwsUsageResponse {
  available: boolean; reason?: string; usage?: AwsUsage; estimatedCost?: number | null;
  prices: PriceConfig; scope: 'table-and-functions-in-region';
}
export interface Stats extends Counters {
  playersJoined: number; pixelsPlaced: number; pixelConflicts?: number; taps: number; teamOrange: number; teamPurple: number;
  estimated: true; expiresAt: number;
}
export interface PriceConfig {
  region: string; currency: 'USD'; verifiedAt: string | null; source: string;
  wruMillion: number | null; rruMillion: number | null; httpApiMillion: number | null;
  lambdaRequestsMillion: number | null; lambdaGbSecond: number | null; lambdaMemoryGb: number;
}
