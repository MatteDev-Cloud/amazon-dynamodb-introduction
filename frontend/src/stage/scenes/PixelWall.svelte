<script lang="ts">
  import { untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { Player, RawPixel } from '../../../../shared/types.js';
  import { PALETTE } from '../../../../shared/types.js';
  import BoardView from '../../shared/BoardView.svelte';
  import type { Board } from '../../shared/board';
  import { config } from '../../shared/config';
  import type { Session } from '../../shared/session.svelte';
  import { clock, number, pixelSK, time, ttlTime } from '../../shared/ui';
  import Title from '../parts/Title.svelte';
  import Count from '../parts/Count.svelte';
  import Item, { type Row } from '../parts/Item.svelte';
  import { examplePixel, examplePlayer } from '../static';
  import { reveal } from '../motion';

  let { session, step, detail, conflicts, onpixel, onclose, onnext }: {
    session: Session; step: number; detail: { x: number; y: number } | null; conflicts: { x: number; y: number; id: number }[];
    onpixel: (x: number, y: number) => void; onclose: () => void; onnext: () => void;
  } = $props();

  let board = $state<Board>();
  let root: HTMLElement, wrap: HTMLElement;
  let rawPixel = $state<RawPixel>();
  let rawPlayer = $state<Player>();
  let origin = $state({ x: 0, y: 0, wx: 0, wy: 0 });

  const meta = $derived(session.meta);
  const lit = $derived(session.lit);
  const total = $derived(session.sync.total);
  const complete = $derived(lit >= total);
  const zoomed = $derived(step >= 1 && !!detail);
  const live = $derived(meta?.phase === 'pixel');

  // Writes per second over the last 3 s, and a 30-sample sparkline.
  let history = $state<number[]>([]);
  const rate = $derived.by(() => { void session.canvasTick; const since = session.now - 3000; let n = 0; for (const p of session.sync.state.pixels.values()) if (p.t > since) n++; return n / 3; });
  $effect(() => { const id = setInterval(() => { history = [...history.slice(-29), rate]; }, 1000); return () => clearInterval(id); });
  const spark = $derived.by(() => { const max = Math.max(4, ...history); return history.map((v, i) => `${i * 10},${40 - v / max * 38}`).join(' '); });

  // Conflict rings from the swarm (same machine) and a pulse when the backend counter grows.
  const seen = new Set<number>();
  $effect(() => { for (const c of conflicts) if (!seen.has(c.id)) { seen.add(c.id); board?.flash(c.x, c.y); } });
  const conflictCount = $derived(session.stats?.pixelConflicts ?? 0);
  let pulse = $state(0);
  let lastConflicts = -1;
  $effect(() => { const n = conflictCount; untrack(() => { if (lastConflicts >= 0 && n > lastConflicts) pulse++; lastConflicts = n; }); });

  let shimmered = false;
  $effect(() => { if (complete && board && !shimmered) { shimmered = true; board.shimmer(); } });

  // Zoom origin: the selected cell, in unscaled deck coordinates.
  $effect(() => {
    if (!detail || !board || !root) return;
    const c = board.cellClient(detail.x, detail.y), r = root.getBoundingClientRect(), k = r.width / root.offsetWidth;
    origin = { x: (c.x - r.left) / k, y: (c.y - r.top) / k, wx: (c.x - r.left) / k - wrap.offsetLeft, wy: (c.y - r.top) / k - wrap.offsetTop };
  });

  // Item data for the zoom.
  $effect(() => {
    const d = detail; if (!d) return;
    rawPixel = undefined; rawPlayer = undefined;
    if (config.static) { rawPixel = examplePixel(d.x, d.y); rawPlayer = examplePlayer; return; }
    void (async () => {
      try {
        const { serverTime: _t, _inspect: _i, ...pixel } = await session.api.call<RawPixel>(`/pixel/${d.x}/${d.y}`);
        rawPixel = pixel;
        const { serverTime: _t2, _inspect: _i2, ...player } = await session.api.call<Player>(`/player/${encodeURIComponent(pixel.byId)}`);
        rawPlayer = player;
      } catch (e) { session.report(e); }
    })();
  });

  const pixelRows = $derived<Row[]>(rawPixel ? [
    { name: 'PK', value: rawPixel.PK, note: 'Partition key: tutti i pixel di questa tela vivono insieme.' },
    { name: 'SK', value: rawPixel.SK, note: `Sort key: la posizione. x=${rawPixel.x}, y=${rawPixel.y}, già in ordine.` },
    { name: 'color', value: rawPixel.color },
    { name: 'by', value: rawPixel.by, onclick: step === 1 ? onnext : undefined, hint: 'chi è? →' },
    { name: 'updatedAt', value: rawPixel.updatedAt, note: `Scritto alle ${clock(rawPixel.updatedAt)}` },
    { name: 'expiresAt', value: rawPixel.expiresAt, note: 'TTL: tra 24 ore sparisce da solo.' },
  ] : []);
  const playerRows = $derived<Row[]>(rawPlayer ? [
    { name: 'PK', value: rawPlayer.PK, note: 'Stessa tabella, un altro gruppo.' },
    { name: 'SK', value: `PLAYER#${rawPlayer.pid.slice(0, 8)}…` },
    { name: 'nickname', value: rawPlayer.nickname },
    { name: 'team', value: meta?.teamsRevealed || config.static ? rawPlayer.team : '•••••', note: meta?.teamsRevealed || config.static ? undefined : 'C’è già. Lo scoprirete tra poco.' },
    { name: 'pixelsPlaced', value: rawPlayer.pixelsPlaced ?? 0, note: 'Attributi diversi dal pixel: nessuno schema da migrare.' },
    { name: 'joinedAt', value: rawPlayer.joinedAt },
  ] : []);

  // Step 3: the whole table, grouped by PK and sorted by SK like DynamoDB stores it.
  const tableRows = $derived.by(() => {
    const sid = meta?.sid ?? config.sid, rows: { pk: string; sk: string; attrs: string; mine?: boolean }[] = [];
    const pixels = [...session.sync.state.pixels.values()].filter(p => !p.deleted).sort((a, b) => a.x - b.x || a.y - b.y);
    const pick = pixels.filter((_, i) => i % Math.max(1, Math.floor(pixels.length / 3)) === 0).slice(0, 3);
    if (rawPixel && !pick.some(p => p.x === rawPixel!.x && p.y === rawPixel!.y)) pick.push({ x: rawPixel.x, y: rawPixel.y, c: rawPixel.color, by: rawPixel.by, t: rawPixel.updatedAt });
    for (const p of pick.sort((a, b) => a.x - b.x || a.y - b.y)) rows.push({ pk: `CANVAS#${sid}`, sk: pixelSK(p.x, p.y), attrs: `color ${p.c} · by "${p.by}"`, mine: !!rawPixel && p.x === rawPixel.x && p.y === rawPixel.y });
    rows.push({ pk: `SESSION#${sid}`, sk: 'META', attrs: `phase "${meta?.phase ?? ''}" · version ${meta?.version ?? 0}` });
    const players = session.players.slice(0, 3).map(p => ({ pid: p.pid, nickname: p.nickname }));
    if (rawPlayer && !players.some(p => p.pid === rawPlayer!.pid)) players.push({ pid: rawPlayer.pid, nickname: rawPlayer.nickname });
    for (const p of players.sort((a, b) => a.pid.localeCompare(b.pid))) rows.push({ pk: `SESSION#${sid}`, sk: `PLAYER#${p.pid.slice(0, 8)}…`, attrs: `nickname "${p.nickname}"`, mine: rawPlayer?.pid === p.pid });
    rows.push({ pk: `SESSION#${sid}`, sk: 'STATS', attrs: `pixelsPlaced ${session.stats?.pixelsPlaced ?? lit} · taps ${session.stats?.taps ?? 0}` });
    return rows;
  });

  function zoomIn(_node: Element) {
    return { duration: 800, delay: 150, easing: cubicOut, css: (t: number) => `opacity:${Math.min(1, t * 2)};transform:scale(${.04 + .96 * t})` };
  }
  function pick(x: number, y: number) { if (step === 0) onpixel(x, y); }
</script>

<div class="pw" bind:this={root}>
  <div class="head" class:away={zoomed}>
    {#key complete}<Title text={complete ? 'Logo *completato.*' : 'Accendete il *logo.*'} size={92} />{/key}
    <div class="timer mono" class:live>
      {#if live && meta?.phaseEndsAt}{time(meta.phaseEndsAt - session.now)}{:else if meta?.phase === 'lobby'}pronti{:else}tela congelata{/if}
    </div>
  </div>

  <div class="board-wrap" class:zoomed bind:this={wrap} style:transform-origin="{origin.wx}px {origin.wy}px">
    <div class="frame">
      <BoardView sync={session.sync} hidden={!!meta?.canvasHidden} glow bind:board onpick={pick} label="Pixel Wall: tocca un pixel acceso per aprirne l’item" />
    </div>
    <p class="hint mono">{live ? 'Ogni pallino è una scrittura · tocca un pixel per aprirlo' : 'Tocca un pixel per aprirlo'}</p>
  </div>

  <aside class="side" class:away={zoomed} use:reveal={{ delay: .4, stagger: .08, x: 30, y: 0 }}>
    <div class="stat big">
      <span class="eyebrow">Pixel accesi</span>
      <p><strong class="display"><Count value={lit} /></strong><span class="of mono">/ {total}</span></p>
      <div class="bar"><i style:width="{lit / total * 100}%"></i></div>
    </div>
    <div class="stat">
      <span class="eyebrow">Scritture al secondo</span>
      <p><strong class="mono"><Count value={rate} digits={1} /></strong></p>
      <svg viewBox="0 0 290 42" class="spark" aria-hidden="true"><polyline points={spark} /></svg>
    </div>
    <div class="stat">
      <span class="eyebrow">Conflitti gestiti</span>
      {#key pulse}<p class="conf"><strong class="mono"><Count value={conflictCount} /></strong></p>{/key}
      <p class="small">Due scritture sulla stessa cella: vince la prima, l’altra riceve un rifiuto condizionale. Nessun lock.</p>
    </div>
    <div class="stat">
      <span class="eyebrow">Nel database</span>
      <p><strong class="mono"><Count value={session.players.length} /></strong> <span class="small">giocatori</span></p>
    </div>
  </aside>

  {#if zoomed && detail}
    <div class="detail" style:transform-origin="{origin.x}px {origin.y}px" in:zoomIn out:fade={{ duration: 300 }}>
      <button class="back btn small" onclick={onclose}>← Torna alla tela · Esc</button>
      {#if step === 1}
        <div class="s1">
          <div class="dotcol">
            <div class="dot" style:background={PALETTE[rawPixel?.color ?? session.sync.state.pixels.get(`${detail.x},${detail.y}`)?.c ?? 0]}></div>
            <p class="mono">x {detail.x} · y {detail.y}</p>
          </div>
          <div class="copy">
            <Title text="Un pixel è un *item*." size={96} />
            <div class="card" use:reveal={{ delay: .5, y: 40 }}>
              {#if rawPixel}<Item label="Item · tabella DynamoLive" rows={pixelRows} />{:else}<p class="muted loading">Leggo l’item con GetItem…</p>{/if}
            </div>
          </div>
        </div>
      {:else if step === 2}
        <div class="s2">
          <Title text="Questo sei *tu*." size={104} />
          <div class="pair">
            <div class="card" use:reveal={{ y: 30 }}>{#if rawPixel}<Item label="Il pixel" rows={pixelRows} compact highlight="by" />{/if}</div>
            <svg class="link" viewBox="0 0 120 60" aria-hidden="true"><path d="M4 30 C 40 30, 80 30, 112 30" /><path d="M100 20 L 114 30 L 100 40" /></svg>
            <div class="card" use:reveal={{ delay: .35, y: 30 }}>
              {#if rawPlayer}<Item label="Il giocatore" rows={playerRows} highlight="nickname" />{:else}<p class="muted loading">Leggo il giocatore…</p>{/if}
            </div>
          </div>
        </div>
      {:else}
        <div class="s3">
          <Title text="Una tabella, *tante entità.*" size={96} />
          <p class="lead" use:reveal={{ delay: .3 }}>La partition key raggruppa, la sort key ordina. Pixel, giocatori, stato e contatori convivono.</p>
          <div class="table" use:reveal={{ delay: .45, stagger: .06, y: 18 }}>
            <div class="tr th mono"><span>PK · partition key</span><span>SK · sort key</span><span>altri attributi</span></div>
            {#each tableRows as row, i (i)}
              <div class="tr mono" class:mine={row.mine} class:group={i > 0 && tableRows[i - 1]!.pk !== row.pk}>
                <span class="pk">{row.pk}</span><span class="sk">{row.sk}</span><span class="attrs">{row.attrs}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
  {#if meta && !config.static}<span class="ttl mono" hidden={zoomed}>TTL {ttlTime(meta.expiresAt * 1000 - session.now)} · {number(lit)} item CANVAS#</span>{/if}
</div>

<style>
  .pw { position: absolute; inset: 0; }
  .head { position: absolute; left: 88px; right: 88px; top: 132px; display: flex; align-items: flex-end; justify-content: space-between; transition: opacity .5s, transform .8s var(--ease-out); }
  .away { opacity: 0; transform: translateY(-20px); pointer-events: none; }
  .timer { font-size: 64px; letter-spacing: -.03em; color: var(--muted); }
  .timer.live { color: var(--ink); }
  .board-wrap { position: absolute; left: 88px; top: 262px; width: 1240px; height: 698px; transition: transform 1s var(--ease-in-out), opacity .45s .2s; }
  .board-wrap.zoomed { transform: scale(4); opacity: 0; pointer-events: none; }
  .frame { width: 100%; height: 100%; background: var(--board); border-radius: 30px; padding: 18px; box-shadow: 0 40px 80px -40px #0e101699, inset 0 0 0 1px #ffffff10; }
  .hint { position: absolute; left: 0; bottom: -40px; margin: 0; font-size: 16px; color: var(--muted); letter-spacing: .04em; }
  .side { position: absolute; left: 1392px; right: 88px; top: 262px; display: grid; gap: 22px; transition: opacity .5s; }
  .stat { border-top: 1.5px solid var(--ink); padding-top: 14px; }
  .stat p { margin: 6px 0 0; display: flex; align-items: baseline; gap: 10px; }
  .stat strong { font-size: 54px; line-height: 1; letter-spacing: -.02em; }
  .big strong { font-size: 118px; font-weight: 400; color: var(--accent); }
  .of { font-size: 30px; color: var(--muted); }
  .bar { height: 10px; margin-top: 14px; background: var(--paper-2); border-radius: 10px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); border-radius: 10px; transition: width .6s var(--ease-out); }
  .spark { width: 100%; height: 42px; margin-top: 6px; }
  .spark polyline { fill: none; stroke: var(--blue); stroke-width: 2.5; stroke-linejoin: round; }
  .conf { animation: pulse .7s var(--ease-out); }
  .conf strong { color: var(--red); }
  @keyframes pulse { 30% { transform: scale(1.18); } }
  .small { font-size: 18px; color: var(--muted); line-height: 1.35; margin-top: 8px !important; display: block; }
  .ttl { position: absolute; right: 88px; top: 190px; font-size: 16px; color: var(--muted); display: none; }

  .detail { position: absolute; inset: 0; background: var(--paper); z-index: 5; }
  .back { position: absolute; left: 88px; top: 124px; z-index: 2; }
  .s1 { position: absolute; inset: 200px 88px 130px; display: grid; grid-template-columns: 520px 1fr; gap: 80px; align-items: center; }
  .dotcol { display: grid; justify-items: center; gap: 26px; }
  .dot { width: 360px; height: 360px; border-radius: 50%; box-shadow: 0 0 0 26px var(--board), 0 0 0 27px #0003, 0 40px 80px -30px #0008; animation: grow 1.1s var(--ease-out) both; }
  @keyframes grow { from { transform: scale(.2); } }
  .dotcol p { font-size: 30px; margin: 20px 0 0; }
  .copy .card { margin-top: 30px; max-width: 1080px; }
  .loading { font-size: 26px; }
  .s2 { position: absolute; inset: 190px 88px 130px; }
  .pair { display: grid; grid-template-columns: 640px 120px 1fr; align-items: center; margin-top: 44px; gap: 10px; }
  .link path { fill: none; stroke: var(--accent); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 140; stroke-dashoffset: 140; animation: draw .8s .6s var(--ease-out) forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .s3 { position: absolute; inset: 190px 88px 130px; }
  .lead { font-size: 30px; color: var(--ink-2); margin: 20px 0 34px; }
  .table { border: 1.5px solid var(--ink); border-radius: 22px; overflow: hidden; background: var(--card); font-size: 22px; }
  .tr { display: grid; grid-template-columns: 420px 440px 1fr; padding: 12px 28px; border-top: 1px solid var(--line); }
  .tr.group { border-top: 2px solid var(--ink); }
  .th { border-top: 0; background: var(--ink); color: var(--paper); font-size: 16px; letter-spacing: .1em; text-transform: uppercase; }
  .tr .pk { color: var(--accent); } .tr .sk { color: var(--blue); } .tr .attrs { color: var(--muted); }
  .tr.mine { background: #fff3b8; }
  .th span { color: var(--paper); }
</style>
