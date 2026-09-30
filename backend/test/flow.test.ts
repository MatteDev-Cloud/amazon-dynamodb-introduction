import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import type { Configuration } from '../src/lib/config.js';
import { FakeDdb } from './fake-ddb.js';
import { PHASES, type AwsUsageResponse, type CanvasResponse, type Meta } from '../../shared/types.js';

const KEY = 'admin-key-long-enough-1';
const config: Configuration = { adminKey: KEY, tableName: 'test', region: 'eu-central-1', endpoint: undefined, origins: [], functionName: 'fn', apiId: 'api' };

/** Drives the app like the LIM does: one clock we control, admin credentials, JSON in and out. */
function harness(options: { usage?: { read: (from: number, to: number) => Promise<any> } } = {}) {
  const db = new FakeDdb();
  let now = 1_700_000_000_000;
  const app = createApp(config, { client: { send: db.send } as any, now: () => now, usage: options.usage as any });
  const call = async <T>(method: string, path: string, body?: unknown, admin = true) => {
    const response = await app({ method, path: `/s/talk${path}`, headers: admin ? { 'x-admin-key': KEY } : {}, query: Object.fromEntries(new URLSearchParams(path.split('?')[1] ?? '')), body });
    return { status: response.statusCode, data: JSON.parse(response.body) as T };
  };
  return { db, call, advance: (ms: number) => { now += ms; }, at: () => now, set: (ms: number) => { now = ms; } };
}

/** Walks META from the lobby to `target`, which is the only way phases are allowed to move. */
async function reach(h: ReturnType<typeof harness>, target: string, body: Record<string, unknown> = {}) {
  let meta = (await h.call<Meta>('GET', '/meta')).data;
  for (const phase of PHASES.slice(1, PHASES.indexOf(target as any) + 1)) {
    const response = await h.call<Meta>('POST', '/admin/phase', { phase, expectedVersion: meta.version, ...(phase === 'pixel' || phase === 'hotkey_running' ? body : {}) });
    assert.equal(response.status, 200, `${phase}: ${JSON.stringify(response.data)}`);
    meta = response.data;
    if (phase === 'hotkey_running') h.advance(meta.roundMs + meta.tapGraceMs + 1);
  }
  return meta;
}

test('a session runs lobby → pixel → closing, and the canvas is written through conditional writes', async () => {
  const h = harness();
  const created = await h.call<Meta>('POST', '/admin/reset', {});
  assert.equal(created.status, 201);
  assert.equal(created.data.canvasExpiresAt, created.data.expiresAt, 'the canvas starts with the session TTL');

  assert.equal((await h.call('POST', '/admin/reset', {})).status, 409, 'sessions are never overwritten');
  const player = await h.call<{ pid: string }>('POST', '/join', { nickname: 'giulia' }, false);
  assert.equal(player.status, 201);

  const meta = await h.call<Meta>('POST', '/admin/phase', { phase: 'pixel', expectedVersion: created.data.version });
  assert.equal(meta.status, 200);
  const lit = await h.call('POST', '/pixel', { pid: player.data.pid, x: 10, y: 3 }, false);
  assert.equal(lit.status, 200);
  // Same cell, another player: first writer wins and the loser is told so, with no lock anywhere.
  const other = await h.call<{ pid: string }>('POST', '/join', { nickname: 'marco' }, false);
  h.advance(600);
  const taken = await h.call<{ error: string }>('POST', '/pixel', { pid: other.data.pid, x: 10, y: 3 }, false);
  assert.equal(taken.status, 409);
  assert.equal(taken.data.error, 'PIXEL_TAKEN');
  const canvas = await h.call<CanvasResponse>('GET', '/canvas');
  assert.equal(canvas.data.pixels.length, 1);
  assert.equal(canvas.data.pixels[0]!.e, created.data.canvasExpiresAt, 'each item carries its own TTL to the client');
});

test('entering the closing phase gives every canvas item its own short TTL, spread over endTtlMs', async () => {
  const h = harness();
  const created = await h.call<Meta>('POST', '/admin/reset', { endTtlMs: 40000 });
  await h.call<Meta>('POST', '/admin/phase', { phase: 'pixel', expectedVersion: created.data.version });
  const player = await h.call<{ pid: string }>('POST', '/join', { nickname: 'ada' }, false);
  const cells = [[10, 2], [11, 2], [12, 2], [13, 2], [10, 3], [11, 3]];
  for (const [x, y] of cells) { await h.call('POST', '/pixel', { pid: player.data.pid, x, y }, false); h.advance(600); }
  assert.equal((await h.call<CanvasResponse>('GET', '/canvas')).data.pixels.length, cells.length);

  const closing = await reach(h, 'end', { durationMs: 1000 });
  const start = h.at();
  assert.equal(closing.canvasExpiresAt, Math.floor((start + 40000) / 1000), 'META advertises the new deadline');
  assert.ok(closing.canvasExpiresAt < closing.expiresAt, 'the session itself still lives for 24 h');

  const deadlines = (await h.call<CanvasResponse>('GET', '/canvas')).data.pixels.map(p => p.e!).sort((a, b) => a - b);
  assert.equal(deadlines.length, cells.length);
  assert.ok(deadlines[0]! > Math.floor(start / 1000), 'nothing expires instantly: the dissolve is visible');
  assert.equal(deadlines.at(-1), closing.canvasExpiresAt, 'the last item goes exactly when the clock hits zero');
  assert.ok(new Set(deadlines).size >= 5, 'the deadlines are spread out, not all the same instant');

  // Halfway through the window the backend already refuses to serve the first half: no delete needed.
  h.advance(21000);
  const half = await h.call<CanvasResponse>('GET', '/canvas');
  assert.ok(half.data.pixels.length > 0 && half.data.pixels.length < cells.length, `expected a partial canvas, got ${half.data.pixels.length}`);
  h.advance(25000);
  assert.equal((await h.call<CanvasResponse>('GET', '/canvas')).data.pixels.length, 0, 'the logo is gone while the session is still alive');
  assert.equal((await h.call<Meta>('GET', '/meta')).status, 200);
});

test('the closing does not look like a fresh write: updatedAt is untouched so nothing pops back in', async () => {
  const h = harness();
  const created = await h.call<Meta>('POST', '/admin/reset', { endTtlMs: 60000 });
  await h.call<Meta>('POST', '/admin/phase', { phase: 'pixel', expectedVersion: created.data.version });
  const player = await h.call<{ pid: string }>('POST', '/join', { nickname: 'grace' }, false);
  await h.call('POST', '/pixel', { pid: player.data.pid, x: 10, y: 2 }, false);
  const before = (await h.call<CanvasResponse>('GET', '/canvas')).data.pixels[0]!;

  const closing = await reach(h, 'end', { durationMs: 1000 });
  const after = (await h.call<CanvasResponse>('GET', '/canvas')).data.pixels[0]!;
  assert.equal(after.t, before.t, 'the lighting timestamp is history and stays history');
  assert.notEqual(after.e, before.e);
  assert.ok(closing.canvasRevision > created.data.canvasRevision, 'the revision bump makes clients take a fresh snapshot');
});

test('the AWS cross-check is admin-only and degrades to "not available" instead of breaking the slide', async () => {
  const measured = { from: 0, to: 1, staleMs: 90000, period: 60, wruTable: 1200, wruGsi: { ByTime: 400 }, rruTable: 900, rruGsi: {}, apiRequests: 5000, lambdaInvocations: 5000, lambdaMs: 120000, lambdaErrors: 0, throttled: 0 };
  const ok = harness({ usage: { read: async () => measured } });
  await ok.call('POST', '/admin/reset', {});
  assert.equal((await ok.call('GET', '/admin/aws', undefined, false)).status, 401, 'never exposed without the admin key');
  const good = await ok.call<AwsUsageResponse>('GET', '/admin/aws');
  assert.equal(good.status, 200);
  assert.equal(good.data.available, true);
  assert.equal(good.data.usage!.wruTable, 1200);
  assert.ok(good.data.estimatedCost! > 0);

  const broken = harness({ usage: { read: async () => { throw new Error('AccessDenied'); } } });
  await broken.call('POST', '/admin/reset', {});
  const soft = await broken.call<AwsUsageResponse>('GET', '/admin/aws');
  assert.equal(soft.status, 200, 'a CloudWatch failure must never reach the projector as an error');
  assert.equal(soft.data.available, false);
  assert.equal(soft.data.reason, 'CLOUDWATCH_UNAVAILABLE');
});

test('taps are idempotent per sequence number and the leaderboard reads the index', async () => {
  const h = harness();
  const created = await h.call<Meta>('POST', '/admin/reset', {});
  const player = await h.call<{ pid: string }>('POST', '/join', { nickname: 'linus' }, false);
  let meta = created.data;
  for (const phase of ['pixel', 'pixel_frozen', 'talk', 'hotkey_ready', 'hotkey_running'] as const) {
    meta = (await h.call<Meta>('POST', '/admin/phase', { phase, expectedVersion: meta.version, ...(phase === 'hotkey_running' ? { durationMs: 15000 } : {}) })).data;
  }
  const body = { pid: player.data.pid, roundId: meta.roundId, seq: 1, delta: 5 };
  const first = await h.call<{ score: number; duplicate: boolean }>('POST', '/tap', body, false);
  assert.equal(first.data.score, 5);
  const replay = await h.call<{ score: number; duplicate: boolean }>('POST', '/tap', body, false);
  assert.equal(replay.data.duplicate, true);
  assert.equal(replay.data.score, 5, 'a retried batch is acknowledged, never counted twice');
  const board = await h.call<{ top: { nickname: string; score: number }[] }>('GET', '/leaderboard');
  assert.deepEqual(board.data.top.map(p => [p.nickname, p.score]), [['linus', 5]]);
});

test('the closing can be re-armed: /admin/dissolve restarts the TTL and only works at the end', async () => {
  const h = harness();
  const created = await h.call<Meta>('POST', '/admin/reset', { endTtlMs: 30000 });
  assert.equal((await h.call('POST', '/admin/dissolve', {})).status, 409, 'not before the closing scene');
  await h.call<Meta>('POST', '/admin/phase', { phase: 'pixel', expectedVersion: created.data.version });
  const player = await h.call<{ pid: string }>('POST', '/join', { nickname: 'radia' }, false);
  for (const [x, y] of [[10, 2], [11, 2], [12, 2]]) { await h.call('POST', '/pixel', { pid: player.data.pid, x, y }, false); h.advance(600); }
  await reach(h, 'end', { durationMs: 1000 });

  h.advance(31000);
  assert.equal((await h.call<CanvasResponse>('GET', '/canvas')).data.pixels.length, 0, 'the first dissolve has run its course');
  // Reached the end early, or the rewrite half failed: one call puts the logo back on a fresh countdown.
  const again = await h.call<Meta & { dissolving: number }>('POST', '/admin/dissolve', { endTtlMs: 90000 });
  assert.equal(again.status, 200);
  assert.equal(again.data.endTtlMs, 90000);
  assert.equal(again.data.dissolving, 0, 'items already expired are not resurrected');
  assert.ok(again.data.canvasExpiresAt > Math.floor(h.at() / 1000));
});
