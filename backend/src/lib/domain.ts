import { createHash, timingSafeEqual } from 'node:crypto';
import { PHASES, type Meta, type Phase, type SessionConfig, type Team } from '../../../shared/types.js';
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public retryInMs?: number) { super(message); }
}
export function fail(status: number, code: string, message: string, retryInMs?: number): never { throw new HttpError(status, code, message, retryInMs); }
export function integer(value: unknown, min: number, max: number, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail(400, 'INVALID_INPUT', `${name}: integer ${min}..${max} required`);
  return value;
}
export function text(value: unknown, pattern: RegExp, name: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) fail(400, 'INVALID_INPUT', `${name} is invalid`);
  return value;
}
export function nickname(value: unknown): string {
  const name = text(typeof value === 'string' ? value.normalize('NFKC') : value, /^[\p{L}\p{N}_.-]{2,12}$/u, 'nickname');
  const normalized = name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[013457]/g, c => ({0:'o',1:'i',3:'e',4:'a',5:'s',7:'t'}[c]!)).replace(/[_.-]/g, '');
  if (['cazzo','merda','stronzo','puttana','vaffanculo','fuck','shit','bitch','nigger','faggot'].some(word => normalized.includes(word))) fail(400, 'INVALID_NICKNAME', 'Choose another nickname');
  return name;
}
export const pidValue = (value: unknown) => text(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'pid');
export const sidValue = (value: unknown) => text(value, /^[A-Za-z0-9_-]{1,48}$/, 'sid');
export const teamFor = (pid: string): Team => createHash('sha256').update(pid).digest()[0]! % 2 ? 'purple' : 'orange';
export function secretMatches(a: string | undefined, b: string): boolean {
  return !!a && timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
export function makeMeta(sid: string, input: SessionConfig, now: number): Meta {
  const config = (name: keyof SessionConfig, fallback: number, min: number, max: number) => integer(input[name] ?? fallback, min, max, name);
  return {
    sid, phase: 'lobby', version: 1, phaseStartedAt: now, phaseEndsAt: null,
    canvasW: config('canvasW',48,1,48), canvasH: config('canvasH',27,1,27),
    cooldownMs: config('cooldownMs',1500,100,60000), roundMs: config('roundMs',15000,1000,60000), pixelMs: config('pixelMs',90000,1000,300000),
    canvasHidden: false, canvasRevision: 0, teamsRevealed: false, roundId: null, roundStartedAt: null, roundEndsAt: null,
    tapGraceMs: 2000, expiresAt: Math.floor(now/1000)+86400,
    prompt: input.prompt === undefined ? 'Scrivete DDB' : text(input.prompt, /^.{1,120}$/u, 'prompt'), botsEnabled: false,
  };
}
export function nextPhase(current: Phase, target: unknown): Phase {
  if (!PHASES.includes(target as Phase)) fail(400, 'INVALID_PHASE', 'Unknown phase');
  if (target !== current && PHASES.indexOf(target as Phase) !== PHASES.indexOf(current)+1) fail(409, 'INVALID_TRANSITION', 'Only the next phase is allowed; use a new sid to restart');
  return target as Phase;
}
export const sessionKey = (sid: string, SK: string) => ({PK:`SESSION#${sid}`, SK});
export const pixelKey = (sid: string, x: number, y: number) => ({PK:`CANVAS#${sid}`, SK:`PX#${String(x).padStart(3,'0')}#${String(y).padStart(3,'0')}`});
