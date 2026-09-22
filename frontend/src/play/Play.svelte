<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import type { JoinResponse, LeaderboardResponse, Meta, PixelResponse, Player, RankResponse } from '../../../shared/types.js';
  import { ApiFailure, poll } from '../shared/api';
  import { api } from '../shared/runtime';
  import { config, playerKey, read, save } from '../shared/config';
  import { CanvasSync } from '../shared/sync';
  import BoardView from '../shared/BoardView.svelte';
  import { message, pixelSK, time } from '../shared/ui';
  import { TapQueue, type QueueState } from './tap-queue';

  api.admin = ''; // The phone never sends a stage credential.
  const sync = new CanvasSync(api);

  let meta = $state<Meta>();
  let player = $state<Player>();
  let gone = $state<'' | 'expired' | 'banned'>('');
  let notice = $state('');
  let online = $state(true);
  let now = $state(Date.now());
  let nickname = $state('');
  let joining = $state(false);
  let recovering = false;
  // Reactive mirror of the stored pid: localStorage itself is not tracked by the template.
  let stored = $state(!!read<string | null>(playerKey, null));
  // Pixel Wall
  let nextAllowed = $state(0);
  let placing = $state(false);
  let placed = $state(0);
  let mine = $state(new Set<string>());
  let last = $state<{ sk: string; ok: boolean; id: number }>();
  let holding = false;
  // HOT KEY
  let queue = $state<TapQueue>();
  let score = $state(0);
  let queued = $state(0);
  let hit = $state(0);
  let result = $state<{ rank: RankResponse; top: LeaderboardResponse['top'] }>();

  const phase = $derived(meta?.phase);
  const cooldown = $derived(meta ? Math.max(0, nextAllowed - now) / meta.cooldownMs : 0);
  const teamName = $derived(player?.team === 'orange' ? 'arancione' : 'viola');

  const report = (e: unknown) => {
    if (e instanceof ApiFailure && e.code === 'SESSION_NOT_FOUND') { gone = 'expired'; sync.state.pixels.clear(); }
    else if (e instanceof ApiFailure && e.status === 403) { gone = 'banned'; if (player) player.banned = true; }
    notice = message(e); online = api.online;
  };

  async function recover() {
    if (recovering || player) return;
    const pid = read<string | null>(playerKey, null); if (!pid) return;
    recovering = true; api.pid = pid;
    try { player = await api.call<Player>(`/player/${encodeURIComponent(pid)}`); nextAllowed = (player.lastPixelAt || 0) + (meta?.cooldownMs || 500); placed = player.pixelsPlaced || 0; }
    catch (e) { if (e instanceof ApiFailure && e.status === 404) { localStorage.removeItem(playerKey); api.pid = ''; stored = false; } else report(e); }
    finally { recovering = false; }
  }
  async function join(e: SubmitEvent) {
    e.preventDefault(); joining = true;
    try { const r = await api.call<JoinResponse>('/join', { nickname: nickname.trim() }); save(playerKey, r.pid); stored = true; api.pid = r.pid; await recover(); notice = ''; }
    catch (err) { report(err); } finally { joining = false; }
  }

  /** Tap = reveal: pick a random unlit cell of the logo; if someone beats us to it, try another one. */
  async function light() {
    if (!player || !meta || placing || api.now() < nextAllowed || meta.phase !== 'pixel') return;
    placing = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const free = sync.remaining();
        if (!free.length) { notice = 'Logo completo!'; return; }
        const cell = free[Math.floor(Math.random() * free.length)]!, sk = pixelSK(cell.x, cell.y);
        try {
          const r = await api.call<PixelResponse>('/pixel', { pid: player.pid, x: cell.x, y: cell.y, c: cell.c });
          nextAllowed = r.nextAllowedAt; placed++;
          mine = new Set(mine).add(`${cell.x},${cell.y}`);
          sync.add({ ...cell, by: player.nickname, t: r.nextAllowedAt - meta.cooldownMs });
          last = { sk, ok: true, id: Math.random() }; notice = ''; navigator.vibrate?.(10);
          return;
        } catch (e) {
          if (e instanceof ApiFailure && e.code === 'PIXEL_TAKEN') { last = { sk, ok: false, id: Math.random() }; await sync.refresh(true).catch(() => {}); continue; }
          if (e instanceof ApiFailure && e.status === 429) { nextAllowed = api.now() + e.retryInMs; return; }
          throw e;
        }
      }
    } catch (e) { report(e); } finally { placing = false; }
  }
  function hold() { holding = true; const loop = () => { if (!holding) return; void light(); setTimeout(loop, 90); }; loop(); }
  function release() { holding = false; }

  function ensureQueue() {
    if (!player || !meta?.roundId || queue?.state.roundId === meta.roundId) return;
    const key = `${playerKey}:queue:${meta.roundId}`;
    const initial: QueueState = { pending: null, queued: 0, seq: player.roundId === meta.roundId ? player.lastSeq || 0 : 0, roundId: meta.roundId };
    const persisted = read<QueueState>(key, initial);
    // A lost acknowledgement keeps the exact persisted batch, even when PLAYER already includes it.
    if (!persisted.pending) persisted.seq = Math.max(persisted.seq, initial.seq);
    const q = new TapQueue(player.pid, persisted, b => api.call('/tap', b), s => save(key, s), () => api.now());
    q.score = player.score || 0; queue = q;
  }
  function tap() {
    if (meta?.phase === 'hotkey_running' && api.now() < (meta.roundEndsAt || 0) && queue?.tap()) { navigator.vibrate?.(8); hit++; queued = queue.state.queued; }
  }

  const stops: (() => void)[] = [];
  onMount(() => {
    stops.push(
      poll(async () => { meta = await api.call<Meta>('/meta'); online = true; if (!player) await recover(); ensureQueue(); }, 1500, report),
      poll(async () => { if (meta && ['pixel', 'end'].includes(meta.phase)) await sync.refresh(); }, 1000, report),
      poll(async () => { if (queue && meta?.roundEndsAt) { await queue.flush(meta.roundEndsAt + meta.tapGraceMs); score = queue.score; queued = queue.state.queued + (queue.state.pending?.delta || 0); if (queue.error) notice = queue.error; } }, 500, report),
      poll(async () => {
        if (player && meta?.phase === 'hotkey_end') {
          const [rank, lb] = await Promise.all([api.call<RankResponse>(`/rank/${player.pid}`), api.call<LeaderboardResponse>('/leaderboard?limit=3')]);
          result = { rank, top: lb.top.slice(0, 3) };
        }
      }, 1000, report),
    );
    const tick = setInterval(() => { now = api.now(); online = api.online; }, 100);
    stops.push(() => clearInterval(tick));
  });
  onDestroy(() => stops.forEach(s => s()));
</script>

<main class="phone" data-team={meta?.teamsRevealed ? player?.team : undefined}>
  <header>
    <span class="brand display">Dynamo<em>Live</em></span>
    <span class="status mono" class:bad={!online}>{config.mock ? 'demo' : online ? '● connesso' : 'riconnessione…'}</span>
  </header>

  <section class="content">
    {#if gone === 'expired'}
      <h1 class="display">Sessione scaduta.</h1><p class="muted">Il TTL ha fatto il suo lavoro.</p>
    {:else if gone === 'banned' || player?.banned}
      <h1 class="display">Partecipazione sospesa.</h1>
    {:else if !meta}
      <h1 class="display">Connessione…</h1>
    {:else if !player}
      {#if stored}
        <h1 class="display">Riconnessione…</h1>
      {:else if ['lobby', 'pixel'].includes(meta.phase)}
        <p class="eyebrow">Siete già nel database</p>
        <h1 class="display">Scegli un <em>nome.</em></h1>
        <p class="muted">Il resto lo facciamo insieme, sullo schermo grande.</p>
        <form onsubmit={join}>
          <input bind:value={nickname} placeholder="Il tuo nickname" minlength="2" maxlength="12" required autocomplete="nickname" aria-label="Nickname" />
          <button class="btn solid big" type="submit" disabled={joining}>Entra</button>
        </form>
      {:else}
        <h1 class="display">Ingresso chiuso.</h1><p class="muted">Guarda lo schermo e segui la presentazione.</p>
      {/if}
    {:else}
      <p class="eyebrow">{player.nickname}{meta.teamsRevealed ? ` · squadra ${teamName}` : ''}</p>

      {#if phase === 'lobby'}
        <h1 class="display">Sei <em>dentro.</em></h1>
        <p class="muted">Hai appena scritto il tuo primo item. Guarda lo schermo.</p>
        <div class="keycard mono" in:fly={{ y: 20, duration: 600 }}><span class="pk">PK</span> SESSION#{meta.sid}<br /><span class="sk">SK</span> PLAYER#{player.pid.slice(0, 8)}…</div>

      {:else if phase === 'pixel'}
        <div class="pixel-head"><h1 class="display small">Accendi il <em>logo.</em></h1><span class="timer mono">{meta.phaseEndsAt ? time(meta.phaseEndsAt - now) : ''}</span></div>
        <div class="mini"><BoardView {sync} hidden={meta.canvasHidden} marked={mine} label="La tela: i cerchi bianchi sono i tuoi pixel" /></div>
        <button class="light" style:--cool="{cooldown * 100}%" disabled={placing || cooldown > 0}
          onpointerdown={hold} onpointerup={release} onpointerleave={release} onpointercancel={release} oncontextmenu={e => e.preventDefault()}>
          <span class="display">Accendi<br />un pixel</span>
        </button>
        <p class="hint muted">Tieni premuto per accenderne uno ogni {(meta.cooldownMs / 1000).toLocaleString('it-IT')} s.</p>
        {#key last?.id}
          {#if last}
            <p class="feedback mono" class:conflict={!last.ok} in:scale={{ start: .8, duration: 300, easing: backOut }}>
              {#if last.ok}✓ scritto <b>{last.sk}</b>{:else}✕ <b>{last.sk}</b> già preso: ne provo un altro{/if}
            </p>
          {/if}
        {/key}
        <p class="count"><b class="display">{placed}</b> pixel accesi da te</p>

      {:else if phase === 'hotkey_ready'}
        <h1 class="display">Preparati.</h1><p class="muted">Tra poco: tappa più veloce che puoi per la squadra {teamName}.</p>
      {:else if phase === 'hotkey_running'}
        <div class="pixel-head"><h1 class="display small">Tappa!</h1><span class="timer mono">{meta.roundEndsAt ? time(meta.roundEndsAt - now) : ''}</span></div>
        {#key hit}<span class="ripple" aria-hidden="true"></span>{/key}
        <button class="tap display" onpointerdown={tap} disabled={now >= (meta.roundEndsAt || 0) || !!queue?.stopped}>TAP</button>
        <p class="count mono">{score} punti confermati · {queued} in coda</p>
      {:else if phase === 'hotkey_end'}
        <h1 class="display">Il tuo <em>risultato.</em></h1>
        {#if result}
          <p class="rank display">{result.rank.rank ? `${result.rank.rank}° su ${result.rank.total}` : 'Hai seguito il round'}</p>
          <p class="mono">{result.rank.score} punti{result.rank.provisional ? ' · provvisorio' : ''}</p>
          <ol class="podium">{#each result.top as p (p.rank)}<li><span class="mono">{p.rank}</span> {p.nickname} <b class="mono">{p.score}</b></li>{/each}</ol>
        {:else}<p class="muted">Consolidamento punteggi…</p>{/if}
      {:else if phase === 'end'}
        <h1 class="display">Questa tela è anche <em>tua.</em></h1>
        <div class="mini"><BoardView {sync} hidden={meta.canvasHidden} marked={mine} label="La tela finale" /></div>
        <a class="btn solid big" href={config.document}>Porta con te DynamoDB</a>
      {:else}
        {#if meta.teamsRevealed}
          <div class="team" in:scale={{ start: .5, duration: 800, easing: backOut }}><p class="eyebrow">L’ha deciso un hash</p><p class="display">Squadra {teamName}</p></div>
        {:else}
          <h1 class="display">Guarda lo <em>schermo.</em></h1>
        {/if}
        <p class="muted">La prossima scena arriverà qui.</p>
      {/if}
    {/if}
    {#if notice}<p class="notice" role="status">{notice}</p>{/if}
  </section>
</main>

<style>
  :global(html[data-view='play']) { background: var(--paper); }
  .phone { max-width: 520px; margin: 0 auto; min-height: 100dvh; padding: 18px 20px 40px; display: flex; flex-direction: column; --team: var(--ink); }
  .phone[data-team='orange'] { --team: var(--orange); } .phone[data-team='purple'] { --team: var(--purple); }
  header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 1.5px solid var(--ink); }
  .brand { font-size: 22px; font-weight: 600; } .brand em { color: var(--accent); font-weight: 400; }
  .status { font-size: 12px; color: var(--green); } .status.bad { color: var(--red); }
  .content { padding-top: 22px; flex: 1; display: flex; flex-direction: column; gap: 14px; }
  h1 { font-size: clamp(44px, 13vw, 64px); line-height: 1; margin: 0; font-weight: 500; letter-spacing: -.03em; }
  h1.small { font-size: 36px; }
  h1 em { font-style: italic; color: var(--accent); font-weight: 400; }
  .eyebrow { margin: 0; }
  .muted { margin: 0; font-size: 17px; line-height: 1.4; }
  form { display: grid; gap: 12px; margin-top: 18px; }
  .big { min-height: 56px; font-size: 18px; }
  .keycard { margin-top: 10px; padding: 16px 18px; border: 1.5px solid var(--ink); border-radius: 16px; background: var(--card); font-size: 14px; line-height: 1.8; box-shadow: 6px 6px 0 var(--ink); }
  .pk { color: var(--accent); font-weight: 800; } .sk { color: var(--blue); font-weight: 800; }
  .pixel-head { display: flex; justify-content: space-between; align-items: baseline; }
  .timer { font-size: 22px; }
  .mini { aspect-ratio: 16 / 9; background: var(--board); border-radius: 16px; padding: 6px; }
  .light { position: relative; width: min(72vw, 280px); aspect-ratio: 1; margin: 6px auto 0; border-radius: 50%; border: 0; color: #fff; font-size: 30px; line-height: 1.05; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
    background: radial-gradient(circle, var(--accent) 60%, transparent 61%), conic-gradient(var(--line) var(--cool), var(--accent) 0); padding: 0; transition: transform .1s; }
  .light:active:not(:disabled) { transform: scale(.96); }
  .light:disabled { opacity: 1; filter: saturate(.6); }
  .light span { font-weight: 600; }
  .hint { text-align: center; font-size: 14px; }
  .feedback { text-align: center; margin: 0; font-size: 14px; color: var(--green); }
  .feedback.conflict { color: var(--red); }
  .count { text-align: center; margin: 0; font-size: 16px; }
  .count b { font-size: 34px; margin-right: 4px; }
  .tap { width: min(80vw, 320px); aspect-ratio: 1; margin: 20px auto; border-radius: 50%; border: 10px solid color-mix(in srgb, var(--team) 35%, var(--paper)); background: var(--team); color: #fff; font-size: 72px; font-weight: 600; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
  .tap:active:not(:disabled) { transform: scale(.95); }
  .tap:disabled { opacity: .4; }
  .ripple { position: fixed; left: 50%; top: 58%; width: 10px; height: 10px; border-radius: 50%; background: var(--team); opacity: 0; pointer-events: none; animation: ripple .5s ease-out; }
  @keyframes ripple { from { opacity: .35; transform: translate(-50%, -50%) scale(1); } to { opacity: 0; transform: translate(-50%, -50%) scale(40); } }
  .rank { font-size: 48px; margin: 10px 0 0; }
  .podium { padding: 0; list-style: none; display: grid; gap: 6px; }
  .podium li { display: flex; gap: 12px; padding: 10px 14px; border: 1.5px solid var(--line-2); border-radius: 12px; background: var(--card); }
  .podium b { margin-left: auto; }
  .team { background: var(--team); color: #fff; border-radius: 26px; padding: 30px 24px; }
  .team .eyebrow { color: #ffffffc0; }
  .team .display { font-size: 48px; margin: 8px 0 0; line-height: 1; }
  .notice { margin: auto 0 0; font-size: 14px; color: var(--red); }
</style>
