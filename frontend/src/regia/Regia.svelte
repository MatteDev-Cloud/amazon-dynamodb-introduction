<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import type { Meta, RawPixel } from '../../../shared/types.js';
  import { LOGO_CELLS } from '../../../shared/logo.js';
  import { ApiFailure } from '../shared/api';
  import { api } from '../shared/runtime';
  import { adminKey, config } from '../shared/config';
  import { openChannel, type Message, type StageState } from '../shared/channel';
  import { Session } from '../shared/session.svelte';
  import BoardView from '../shared/BoardView.svelte';
  import type { Board } from '../shared/board';
  import { message, number, time } from '../shared/ui';
  import { scenes } from '../stage/slides';
  import { Swarm } from './swarm.svelte';

  const session = new Session(api);
  let stage = $state<StageState>();
  let stageSeen = $state(0);
  let key = $state(api.admin);
  let log = $state<{ at: string; text: string; bad?: boolean }[]>([]);
  let board = $state<Board>();
  let selected = $state<{ x: number; y: number }>();
  let rect = $state<{ x1: number; y1: number; x2: number; y2: number }>();

  const channel = openChannel(onMessage);
  const swarm = new Swarm(session, m => channel.send(m));
  const meta = $derived(session.meta);
  const linked = $derived(session.now - stageSeen < 5000);
  const scene = $derived(stage ? scenes[stage.scene] : undefined);
  const next = $derived.by(() => {
    if (!stage || !scene) return '';
    if (scene.id === 'hotkey' && meta?.phase === 'hotkey_ready') return 'Avvia il round 3·2·1';
    if (stage.step < scene.steps.length - 1) return scene.steps[stage.step + 1]!;
    return scenes[stage.scene + 1]?.title ?? 'Fine';
  });
  const lit = $derived(session.lit);

  function note(text: string, bad = false) { untrack(() => { log = [{ at: new Date().toLocaleTimeString('it-IT'), text, bad }, ...log].slice(0, 30); }); }
  $effect(() => { if (session.notice) note(session.notice, true); });
  $effect(() => { if (stage?.notice) note(`LIM: ${stage.notice}`, true); });
  $effect(() => { if (swarm.status) note(`Sciame: ${swarm.status}`); });

  function onMessage(m: Message) {
    if (m.t === 'state') { stage = m.state; stageSeen = Date.now(); }
    else if (m.t === 'need-key' && api.admin) channel.send({ t: 'key', key: api.admin });
  }
  function applyKey(e: SubmitEvent) {
    e.preventDefault();
    api.admin = key; sessionStorage.setItem(adminKey, key); channel.send({ t: 'key', key }); note('Chiave admin applicata e inviata alla LIM.');
  }
  async function action(path: string, body: unknown, done: string) {
    if (config.static) { note('Fallback statico: comandi API disabilitati.', true); return; }
    try { const r = await api.call<Meta>(path, body); if ((r as Partial<Meta>).phase) session.meta = r; await session.sync.refresh(true); note(done); }
    catch (e) { if (e instanceof ApiFailure && e.status === 409) session.meta = await api.call<Meta>('/meta').catch(() => session.meta); note(message(e), true); }
  }
  const freeze = () => action('/admin/phase', { phase: 'pixel_frozen', expectedVersion: meta?.version }, 'Tela congelata.');
  const hide = () => action('/admin/hide', { hidden: !meta?.canvasHidden }, meta?.canvasHidden ? 'Tela di nuovo visibile.' : 'Tela nascosta.');
  const bots = () => action('/admin/bots', { enabled: !meta?.botsEnabled }, 'Flag bot aggiornato (serve il runner esterno).');
  const create = () => action('/admin/reset', {}, 'Sessione creata.');
  async function clear() {
    if (!rect) { note('Seleziona un rettangolo: clic sul primo angolo, Shift+clic sull’ultimo.', true); return; }
    if (meta?.phase === 'pixel') { note('Prima congela la tela.', true); return; }
    await action('/admin/clear', rect, 'Rettangolo cancellato.'); rect = undefined; syncMarks();
  }
  async function ban() {
    if (!selected) return;
    try { const p = await api.call<RawPixel>(`/pixel/${selected.x}/${selected.y}`); await action('/admin/ban', { pid: p.byId }, `Autore «${p.by}» escluso.`); }
    catch (e) { note(message(e), true); }
  }
  function pick(x: number, y: number, e: PointerEvent) {
    if (e.shiftKey && selected) rect = { x1: Math.min(selected.x, x), y1: Math.min(selected.y, y), x2: Math.max(selected.x, x), y2: Math.max(selected.y, y) };
    else { selected = { x, y }; rect = undefined; }
    syncMarks();
  }
  function syncMarks() { if (!board) return; board.selected = selected; board.rect = rect; board.draw(); }
  function local() { const url = new URL(location.href); url.searchParams.set('api', import.meta.env.VITE_LOCAL_API || 'local'); url.searchParams.set('s', import.meta.env.VITE_LOCAL_SESSION || 'prova-01'); url.searchParams.delete('mode'); note('Apri la LIM con gli stessi parametri: ' + url.search); location.assign(url.href); }

  onMount(() => {
    session.start({ canvasMs: 500 });
    channel.send({ t: 'hello' });
    if (api.admin) channel.send({ t: 'key', key: api.admin });
  });
  $effect(() => { if (board) { board.ghost = .35; board.ghostCells = [...LOGO_CELLS]; board.draw(); } });
  onDestroy(() => { session.stop(); swarm.stop(); channel.close(); });
  const send = (m: Message) => channel.send(m);
  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLElement && e.target.matches('input,textarea,select')) return;
    if (['ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); send({ t: 'next' }); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); send({ t: 'prev' }); }
  }
</script>

<svelte:window onkeydown={onKey} />

<main class="regia">
  <header>
    <div>
      <p class="eyebrow">Regia · {config.static ? 'statico' : config.mock ? 'demo simulata' : 'live'}</p>
      <h1 class="display">{config.sid}</h1>
    </div>
    <div class="badges">
      <span class="badge" class:ok={linked} class:bad={!linked}>{linked ? 'LIM collegata' : 'LIM non trovata'}</span>
      <span class="badge mono">{meta?.phase ?? '…'}</span>
      {#if meta?.phaseEndsAt}<span class="badge mono strong">{time(meta.phaseEndsAt - session.now)}</span>{/if}
      <span class="badge" class:bad={!session.online}>{session.online ? 'API ok' : 'rete assente'}</span>
    </div>
  </header>

  {#if !linked}
    <p class="hint">Apri la LIM su <b class="mono">/stage</b> con gli stessi parametri, nello stesso browser. Dalla LIM premi <kbd>R</kbd> per riaprire questa finestra.</p>
  {/if}

  <form class="card key" onsubmit={applyKey}>
    <label for="k" class="eyebrow">Chiave admin {api.admin ? '· attiva' : '· richiesta'}</label>
    <div class="row"><input id="k" type="password" autocomplete="off" bind:value={key} placeholder="chiave admin della sessione" /><button class="btn solid" type="submit">Applica</button></div>
  </form>

  <section class="card nav">
    <p class="eyebrow">Scena {stage ? stage.scene + 1 : '–'} di {scenes.length}{scene && scene.steps.length > 1 ? ` · passo ${stage!.step + 1}/${scene.steps.length}` : ''}</p>
    <h2 class="display">{scene?.title ?? 'In attesa della LIM…'}</h2>
    {#if scene && scene.steps.length > 1}<p class="step">{scene.steps[stage!.step]}</p>{/if}
    <div class="buttons">
      <button class="btn big" onclick={() => send({ t: 'prev' })} disabled={!linked}>← Indietro</button>
      <button class="btn big accent" onclick={() => send({ t: 'next' })} disabled={!linked || stage?.busy}>Avanti →</button>
    </div>
    <p class="next muted">Poi: <b>{next}</b></p>
    <ol class="scenes">
      {#each scenes as s, i (s.id)}
        <li><button class:now={stage?.scene === i} onclick={() => send({ t: 'go', scene: i })} disabled={!linked}><span class="mono">{String(i + 1).padStart(2, '0')}</span> {s.title}</button></li>
      {/each}
    </ol>
    <p class="fine muted">Indietro e i salti dalla lista sono solo visuali: la fase del database avanza solo con «Avanti».</p>
  </section>

  {#if scene}
    <section class="card notes">
      <p class="eyebrow">Note per chi parla</p>
      <ul>{#each scene.notes as n (n)}<li>{n}</li>{/each}</ul>
    </section>
  {/if}

  <section class="card pixel">
    <div class="split">
      <div>
        <p class="eyebrow">Pixel Wall</p>
        <p class="big-num display">{number(lit)}<span class="muted"> / {LOGO_CELLS.length}</span></p>
        <p class="muted">{number(session.stats?.pixelConflicts ?? 0)} conflitti gestiti · {number(session.players.length)} giocatori</p>
      </div>
      <div class="swarm">
        <label class="eyebrow" for="w">Sciame · {swarm.workers} scrittori</label>
        <input id="w" type="range" min="4" max="40" step="2" bind:value={swarm.workers} disabled={swarm.running} />
        {#if swarm.running}
          <button class="btn danger" onclick={() => swarm.stop()}>Ferma lo sciame</button>
        {:else}
          <button class="btn accent" onclick={() => swarm.start()} disabled={meta?.phase !== 'pixel' || lit >= LOGO_CELLS.length}>Completa il logo</button>
        {/if}
        <p class="mono small">{swarm.ok} ok · {swarm.conflicts} conflitti · {swarm.throttled} cooldown · {swarm.retries} retry</p>
      </div>
    </div>
    <div class="mini"><BoardView sync={session.sync} hidden={!!meta?.canvasHidden} bind:board onpick={pick} label="Anteprima tela con sagoma del logo" /></div>
    <p class="fine muted">Sagoma tratteggiata visibile solo qui. Clic = seleziona pixel · Shift+clic = rettangolo.</p>
    <div class="row wrap">
      <button class="btn small" onclick={() => selected && send({ t: 'pixel', x: selected.x, y: selected.y })} disabled={!selected || !linked}>Apri il pixel sulla LIM</button>
      <button class="btn small" onclick={freeze} disabled={meta?.phase !== 'pixel'}>Congela ora</button>
      <button class="btn small" onclick={hide}>{meta?.canvasHidden ? 'Mostra tela' : 'Nascondi tela'}</button>
      <button class="btn small danger" onclick={clear} disabled={!rect}>Cancella rettangolo</button>
      <button class="btn small danger" onclick={ban} disabled={!selected}>Escludi autore</button>
    </div>
  </section>

  <section class="card">
    <p class="eyebrow">HOT KEY</p>
    <button class="btn accent big" onclick={() => send({ t: 'countdown' })} disabled={meta?.phase !== 'hotkey_ready' || !linked}>Avvia 3 · 2 · 1</button>
    <p class="fine muted">Attivo in fase hotkey_ready (scena «Zero server» già passata).</p>
  </section>

  <section class="card tools">
    <p class="eyebrow">Strumenti</p>
    <div class="row wrap">
      <button class="btn small" class:on={stage?.xray} onclick={() => send({ t: 'toggle', what: 'xray' })}>X-Ray sulla LIM</button>
      <button class="btn small" class:on={stage?.meter} onclick={() => send({ t: 'toggle', what: 'meter' })}>Tassametro</button>
      <button class="btn small" onclick={bots}>Bot runner: {meta?.botsEnabled ? 'on' : 'off'}</button>
      <button class="btn small" onclick={() => send({ t: 'video' })}>Video di backup</button>
      <button class="btn small" onclick={() => send({ t: 'reload' })}>Ricarica LIM</button>
      <button class="btn small" onclick={create}>Crea sessione (sid nuovo)</button>
      <button class="btn small" onclick={local}>Passa al locale</button>
    </div>
  </section>

  <section class="card log">
    <p class="eyebrow">Registro</p>
    {#each log as l, i (i)}<p class:bad={l.bad}><span class="mono muted">{l.at}</span> {l.text}</p>{:else}<p class="muted">Nessun evento.</p>{/each}
  </section>
</main>

<style>
  :global(html[data-view='regia']) { background: var(--paper); }
  .regia { max-width: 1200px; margin: 0 auto; padding: 22px 18px 60px; display: grid; gap: 14px; font-size: 16px; }
  @media (min-width: 1000px) { .regia { grid-template-columns: 1fr 1fr; align-items: start; } header, .hint, .key { grid-column: 1 / -1; } }
  header { display: flex; justify-content: space-between; align-items: end; gap: 12px; flex-wrap: wrap; }
  h1 { font-size: 40px; margin: 2px 0 0; font-weight: 500; letter-spacing: -.02em; }
  .badges { display: flex; gap: 6px; flex-wrap: wrap; }
  .badge { font-size: 13px; padding: 4px 10px; border-radius: 999px; border: 1.5px solid var(--line-2); background: var(--card); }
  .badge.ok { border-color: var(--green); color: var(--green); } .badge.bad { border-color: var(--red); color: var(--red); }
  .badge.strong { font-weight: 800; }
  .hint { margin: 0; padding: 12px 16px; background: var(--accent-soft); border-radius: 14px; }
  kbd { font-family: var(--mono); border: 1.5px solid var(--line-2); border-radius: 6px; padding: 0 6px; background: var(--card); }
  .card { background: var(--card); border: 1.5px solid var(--line-2); border-radius: 20px; padding: 16px 18px; }
  .row { display: flex; gap: 8px; align-items: center; }
  .row input { flex: 1; }
  .wrap { flex-wrap: wrap; }
  .eyebrow { font-size: 12px; margin: 0 0 6px; display: block; }
  .nav h2 { font-size: 30px; margin: 0; font-weight: 500; line-height: 1.1; }
  .step { margin: 6px 0 0; color: var(--accent); font-weight: 600; }
  .buttons { display: grid; grid-template-columns: 1fr 2fr; gap: 10px; margin: 16px 0 8px; }
  .big { min-height: 64px; font-size: 20px; }
  .next { margin: 0 0 10px; }
  .scenes { list-style: none; padding: 0; margin: 0; display: grid; gap: 2px; }
  .scenes button { all: unset; cursor: pointer; display: block; width: 100%; padding: 6px 10px; border-radius: 10px; font-size: 14px; box-sizing: border-box; }
  .scenes button:hover:not(:disabled) { background: var(--paper); }
  .scenes button.now { background: var(--ink); color: var(--paper); }
  .scenes .mono { opacity: .6; margin-right: 6px; }
  .fine { font-size: 13px; margin: 8px 0 0; }
  .notes ul { margin: 0; padding-left: 18px; display: grid; gap: 8px; line-height: 1.4; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .big-num { font-size: 48px; margin: 0; line-height: 1; }
  .big-num .muted { font-size: 22px; }
  .swarm { display: grid; gap: 6px; align-content: start; }
  .swarm input { padding: 0; }
  .small { font-size: 12px; margin: 0; }
  .mini { aspect-ratio: 16 / 9; background: var(--board); border-radius: 14px; padding: 6px; margin-top: 12px; }
  .btn.on { background: var(--ink); color: var(--paper); }
  .log { max-height: 260px; overflow: auto; }
  .log p { margin: 4px 0; font-size: 14px; }
  .log .bad { color: var(--red); }
</style>
