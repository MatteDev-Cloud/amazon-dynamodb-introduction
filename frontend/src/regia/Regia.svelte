<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { PHASES, type Meta, type Phase, type RawPixel } from '../../../shared/types.js';
  import { LOGO_CELLS } from '../../../shared/logo.js';
  import { ApiFailure } from '../shared/api';
  import { api } from '../shared/runtime';
  import { adminKey, backend, config, navigate, scope } from '../shared/config';
  import { openChannel, type Message, type StageState } from '../shared/channel';
  import { Session } from '../shared/session.svelte';
  import BoardView from '../shared/BoardView.svelte';
  import type { Board } from '../shared/board';
  import { message, number, time } from '../shared/ui';
  import { plannedStart, plannedTotal, scenes, type Scene, type Speaker } from '../stage/slides';
  import { Swarm } from './swarm.svelte';

  const session = new Session(api);
  let stage = $state<StageState>();
  let stageSeen = $state(0);
  let key = $state(api.admin);
  let log = $state<{ at: string; text: string; bad?: boolean }[]>([]);
  let board = $state<Board>();
  let selected = $state<{ x: number; y: number }>();
  let rect = $state<{ x1: number; y1: number; x2: number; y2: number }>();
  let armed = $state('');
  let working = $state('');

  const channel = openChannel(onMessage);
  const swarm = new Swarm(session, m => channel.send(m));
  const meta = $derived(session.meta);
  const linked = $derived(session.now - stageSeen < 5000);
  const scene = $derived(stage ? scenes[stage.scene] : undefined);
  const lit = $derived(session.lit);
  // api.latency is plain data: re-read it on the session clock tick.
  const latency = $derived((void session.now, api.latency));

  const PHASE_LABEL: Record<Phase, string> = {
    lobby: 'Lobby · ingresso aperto', pixel: 'Pixel Wall in corso', pixel_frozen: 'Tela congelata', talk: 'Squadre rivelate',
    hotkey_ready: 'HOT KEY pronto', hotkey_running: 'Round in corso', hotkey_end: 'Round finito', end: 'Chiusura',
  };
  const SPEAKER_LABEL: Record<Speaker, string> = { P1: 'Speaker 1', P2: 'Speaker 2', 'P1+P2': 'Speaker 1 + 2' };

  /** What «Avanti» will do, computed exactly like the LIM does it. */
  const plan = $derived.by(() => {
    if (!stage || !scene) return undefined;
    if (scene.id === 'hotkey' && meta?.phase === 'hotkey_ready')
      return { scene, index: stage.scene, stepLabel: 'Conto alla rovescia e round di 15 s', phase: 'hotkey_running' as Phase, round: true, blocked: '' };
    let index = stage.scene, step = stage.step + 1;
    if (step >= scene.steps.length) { index++; step = 0; }
    const target = scenes[index];
    if (!target) return undefined;
    const want = target.stepPhases[step]!, current = meta ? PHASES.indexOf(meta.phase) : -1, next = PHASES.indexOf(want);
    // After a visual jump the deck can be ahead of META: the LIM would refuse, so say where to go back to.
    const fix = scenes.findIndex(s => s.stepPhases.includes(PHASES[current + 1]!));
    const blocked = meta && next > current + 1 ? `Verrà rifiutato: la fase del database è «${PHASE_LABEL[meta.phase]}». Torna con ← alla scena ${fix + 1} «${scenes[fix]?.title}» e riprendi da lì.` : '';
    return { scene: target, index, stepLabel: target.steps[step]!, phase: meta && next > current ? want : null, round: false, blocked };
  });

  // Talk timer: starts at the first «Avanti» after the lobby (or by hand) assuming the plan was on time until then,
  // so the drift reads 0 at that moment; survives a reload of this window.
  const TIMER = `dynamolive:talk-start:${config.sid}`;
  let talkStart = $state(Number(sessionStorage.getItem(TIMER)) || 0);
  let sceneStart = $state(Date.now());
  let sceneIndex = -1;
  const elapsed = $derived(talkStart ? session.now - talkStart : 0);
  const sceneElapsed = $derived(session.now - sceneStart);
  const drift = $derived(stage && talkStart ? Math.round((sceneStart - talkStart) / 1000) - plannedStart(stage.scene) : 0);
  function startTimer(index = stage?.scene ?? 0) { talkStart = Date.now() - plannedStart(index) * 1000; sceneStart = Date.now(); sessionStorage.setItem(TIMER, String(talkStart)); }
  function resetTimer() { talkStart = 0; sessionStorage.removeItem(TIMER); sceneStart = Date.now(); note('Cronometro azzerato.'); }
  $effect(() => {
    const index = stage?.scene;
    if (index === undefined || index === sceneIndex) return;
    untrack(() => { sceneStart = Date.now(); if (sceneIndex === 0 && index > 0 && !talkStart) startTimer(index); sceneIndex = index; });
  });
  const clockText = (ms: number) => `${ms < 0 ? '−' : ''}${time(Math.abs(ms))}`;

  function note(text: string, bad = false) { untrack(() => { log = [{ at: new Date().toLocaleTimeString('it-IT'), text, bad }, ...log].slice(0, 30); }); }
  $effect(() => { if (session.notice) note(session.notice, true); });
  $effect(() => { if (stage?.notice) note(`LIM: ${stage.notice}`, true); });
  $effect(() => { if (swarm.status) note(`Sciame: ${swarm.status}`); });

  function onMessage(m: Message) {
    if (m.t === 'state') { stage = m.state; stageSeen = Date.now(); }
    else if (m.t === 'need-key' && api.admin) channel.send({ t: 'key', key: api.admin });
  }
  const send = (m: Message) => channel.send(m);

  /** Destructive or irreversible buttons need a second press within 4 s; the button itself says «Conferma». */
  let disarm: ReturnType<typeof setTimeout>;
  function confirm(id: string, run: () => unknown) {
    clearTimeout(disarm);
    if (armed === id) { armed = ''; void run(); return; }
    armed = id; disarm = setTimeout(() => { armed = ''; }, 4000);
  }

  function applyKey(e: SubmitEvent) {
    e.preventDefault();
    api.admin = key.trim(); sessionStorage.setItem(adminKey, api.admin); channel.send({ t: 'key', key: api.admin });
    note('Chiave admin applicata e inviata alla LIM.');
  }
  async function action(path: string, body: unknown, done: string) {
    working = path;
    try { const r = await api.call<Meta>(path, body); if ((r as Partial<Meta>).phase) session.meta = r; await session.sync.refresh(true); note(done); }
    catch (e) { if (e instanceof ApiFailure && e.status === 409) session.meta = await api.call<Meta>('/meta').catch(() => session.meta); note(message(e), true); }
    finally { working = ''; }
  }
  const freeze = () => action('/admin/phase', { phase: 'pixel_frozen', expectedVersion: meta?.version }, 'Tela congelata.');
  const hide = () => action('/admin/hide', { hidden: !meta?.canvasHidden }, meta?.canvasHidden ? 'Tela di nuovo visibile.' : 'Tela nascosta al pubblico.');
  const bots = () => action('/admin/bots', { enabled: !meta?.botsEnabled }, 'Flag bot aggiornato (serve il runner esterno).');
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

  /** Emergency: everything the audience sees goes back to the plain slide; games and data are untouched. */
  function safe() { swarm.stop(); send({ t: 'safe' }); note('Stato sicuro: overlay chiusi sulla LIM, sciame fermato.'); }

  /** A fresh session (new sid) for a clean run: created on the same API, then LIM and Regia move to it together. */
  async function newSession() {
    const d = new Date(), pad = (n: number) => String(n).padStart(2, '0');
    const base = config.sid.replace(/-\d{4}-\d{4}$/, '').slice(0, 30) || 'demo';
    const sid = `${base}-${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    if (!config.mock) {
      try { await api.call<Meta>('/admin/reset', {}, sid); }
      catch (e) { note(`Nuova sessione non creata: ${message(e)}`, true); return; }
    }
    note(`Sessione ${sid} creata: LIM e regia si spostano lì.`);
    sessionStorage.removeItem(`dynamolive:talk-start:${sid}`);
    send({ t: 'navigate', params: { s: sid }, key: api.admin });
    setTimeout(() => navigate({ s: sid }, api.admin), 300);
  }
  function local() {
    const params = { api: import.meta.env.VITE_LOCAL_API || 'local', s: import.meta.env.VITE_LOCAL_SESSION || 'prova-01', mode: null };
    send({ t: 'navigate', params }); setTimeout(() => navigate(params), 300);
  }
  const toStatic = () => { send({ t: 'navigate', params: { mode: 'static' } }); note('LIM in modalità statica: nessuna chiamata di rete.'); };
  const toLive = () => { send({ t: 'navigate', params: { mode: null } }); note('LIM di nuovo sulla sessione live.'); };
  const fullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => note('Schermo intero non disponibile.', true)); };

  onMount(() => {
    session.start({ canvasMs: 500 });
    channel.send({ t: 'hello' });
    if (api.admin) channel.send({ t: 'key', key: api.admin });
  });
  $effect(() => { if (board) { board.ghost = .35; board.ghostCells = [...LOGO_CELLS]; board.draw(); } });
  onDestroy(() => { session.stop(); swarm.stop(); channel.close(); clearTimeout(disarm); });

  function onKey(e: KeyboardEvent) {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target?.matches('input,textarea,select')) return;
    const onButton = !!target?.closest('button');
    const k = e.key.toLowerCase();
    if (['arrowright', 'pagedown'].includes(k) || (k === ' ' && !onButton)) { e.preventDefault(); if (linked) send({ t: 'next' }); }
    else if (['arrowleft', 'pageup'].includes(k)) { e.preventDefault(); if (linked) send({ t: 'prev' }); }
    else if (k === 'enter' && !onButton && plan?.round) { e.preventDefault(); send({ t: 'countdown' }); }
    else if (k === 'escape') { e.preventDefault(); safe(); }
    else if (k === 'i') send({ t: 'toggle', what: 'xray' });
    else if (k === 'h' && !config.static) void hide();
  }
  const phaseTone = $derived(meta?.phase === 'pixel' || meta?.phase === 'hotkey_running' ? 'live' : '');
  const showPixel = $derived(scene?.id === 'pixel' || meta?.phase === 'pixel');
  const showHotkey = $derived(scene?.id === 'hotkey' || meta?.phase === 'hotkey_ready' || meta?.phase === 'hotkey_running');
  const nextLabel = (s: Scene | undefined, step: string) => s && s.steps.length > 1 ? `${s.title} — ${step}` : s?.title ?? '';
</script>

<svelte:window onkeydown={onKey} />

<main class="regia">
  <header class="top">
    <div class="id">
      <p class="eyebrow">Regia</p>
      <h1 class="display">{config.sid}</h1>
    </div>
    <ul class="status" aria-label="Stato dei collegamenti">
      <li class:ok={linked} class:bad={!linked}><span class="dot"></span>{linked ? `LIM collegata${stage?.mode === 'static' ? ' · statica' : ''}` : 'LIM non trovata'}</li>
      <li class:ok={session.online} class:bad={!session.online} title={config.api}><span class="dot"></span>{backend.label}{session.online ? ` · ${latency} ms` : ' · non raggiungibile'}</li>
      <li class:ok={!!api.admin || config.mock} class:bad={!api.admin && !config.mock}><span class="dot"></span>{api.admin || config.mock ? 'Chiave admin ok' : 'Chiave admin mancante'}</li>
    </ul>
  </header>

  {#if !linked}
    <p class="banner">Apri la LIM su <b class="mono">/stage</b> con gli stessi parametri, nello stesso browser. Dalla LIM premi <kbd>R</kbd> per riaprire questa finestra.</p>
  {/if}
  {#if !api.admin && !config.mock}
    <form class="card keyform" onsubmit={applyKey}>
      <label for="k" class="eyebrow">Chiave admin della sessione · richiesta per i comandi</label>
      <div class="row"><input id="k" type="password" autocomplete="off" bind:value={key} placeholder="incolla la chiave admin" /><button class="btn solid" type="submit">Applica</button></div>
    </form>
  {/if}

  <section class="timers" aria-label="Tempi">
    <div class="timer">
      <span class="eyebrow">Totale</span>
      <strong class="mono" class:over={elapsed > plannedTotal * 1000}>{talkStart ? time(elapsed) : '--:--'}</strong>
      <span class="muted mono">/ {time(plannedTotal * 1000)}</span>
    </div>
    <div class="timer">
      <span class="eyebrow">Sezione</span>
      <strong class="mono" class:over={!!scene && sceneElapsed > scene.seconds * 1000}>{time(sceneElapsed)}</strong>
      <span class="muted mono">/ {scene ? time(scene.seconds * 1000) : '--:--'}</span>
    </div>
    <div class="timer">
      <span class="eyebrow">Tabella di marcia</span>
      <strong class="mono" class:over={drift > 30} class:good={talkStart > 0 && drift <= 30}>{talkStart ? (drift > 0 ? `+${clockText(drift * 1000)}` : clockText(drift * 1000)) : '—'}</strong>
      <span class="muted">{talkStart ? (drift > 30 ? 'in ritardo' : drift < -30 ? 'in anticipo' : 'in orario') : ''}</span>
    </div>
    <div class="timer-actions">
      {#if talkStart}<button class="btn small" class:armed={armed === 'timer'} onclick={() => confirm('timer', resetTimer)}>{armed === 'timer' ? 'Conferma azzera' : 'Azzera'}</button>
      {:else}<button class="btn small" onclick={() => startTimer()}>Avvia cronometro</button>{/if}
    </div>
  </section>

  <section class="now-next">
    <article class="card now">
      <div class="meta-row">
        <span class="eyebrow">Ora · scena {stage ? stage.scene + 1 : '–'}/{scenes.length}{scene && scene.steps.length > 1 ? ` · passo ${stage!.step + 1}/${scene.steps.length}` : ''}</span>
        {#if scene}<span class="speaker s-{scene.speaker}">{SPEAKER_LABEL[scene.speaker]}</span>{/if}
      </div>
      <h2 class="display">{scene?.title ?? 'In attesa della LIM…'}</h2>
      {#if scene && scene.steps.length > 1}<p class="step">{scene.steps[stage!.step]}</p>{/if}
      <p class="phase" class:live={phaseTone === 'live'}>
        <span class="eyebrow">Fase database</span>
        <b>{meta ? PHASE_LABEL[meta.phase] : '…'}</b>
        {#if meta?.phaseEndsAt}<span class="mono countdown">{time(meta.phaseEndsAt - session.now)}</span>{/if}
      </p>
    </article>
    <article class="card next" class:warn={!!plan?.blocked}>
      <div class="meta-row">
        <span class="eyebrow">Dopo{plan && plan.index !== stage?.scene ? ` · scena ${plan.index + 1}` : ''}</span>
        {#if plan && plan.scene.speaker !== scene?.speaker}<span class="speaker s-{plan.scene.speaker}">Passa a {SPEAKER_LABEL[plan.scene.speaker]}</span>{/if}
      </div>
      <h3 class="display">{plan ? (plan.round ? 'Avvia HOT KEY' : nextLabel(plan.scene, plan.stepLabel)) : 'Fine della presentazione'}</h3>
      {#if plan?.blocked}<p class="effect bad">{plan.blocked}</p>
      {:else if plan?.round}<p class="effect">Avanti avvia 3·2·1 sulla LIM, poi il round di 15 s. <b>Non si ripete.</b></p>
      {:else if plan?.phase}<p class="effect">Avanti cambia la fase del database: <b>{PHASE_LABEL[plan.phase]}</b>. Non si torna indietro.</p>
      {:else if plan}<p class="effect muted">Avanti cambia solo la slide.</p>{/if}
    </article>
  </section>

  <section class="controls">
    <button class="btn nav prev" onclick={() => send({ t: 'prev' })} disabled={!linked || !!stage?.countdown}>← Indietro</button>
    <button class="btn nav go" class:round={plan?.round} class:blocked={!!plan?.blocked} onclick={() => send({ t: plan?.round ? 'countdown' : 'next' })} disabled={!linked || stage?.busy || !!stage?.countdown || !plan}>
      {stage?.busy ? 'Attendo il database…' : stage?.countdown ? `${stage.countdown}` : plan?.round ? 'Avvia 3 · 2 · 1' : 'Avanti →'}
    </button>
    <p class="keys muted"><kbd>→</kbd> avanti · <kbd>←</kbd> indietro (solo slide) · <kbd>Invio</kbd> avvia round · <kbd>Esc</kbd> stato sicuro · <kbd>I</kbd> X-Ray · <kbd>H</kbd> nascondi tela</p>
  </section>

  {#if scene}
    <section class="card notes">
      <p class="eyebrow">Cosa dire · {SPEAKER_LABEL[scene.speaker]}</p>
      <ul>{#each scene.notes as n (n)}<li>{n}</li>{/each}</ul>
    </section>
  {/if}

  {#if showPixel}
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
        <button class="btn small" class:armed={armed === 'freeze'} onclick={() => confirm('freeze', freeze)} disabled={meta?.phase !== 'pixel' || !!working}>{armed === 'freeze' ? 'Conferma: congela' : 'Congela ora'}</button>
        <button class="btn small danger" class:armed={armed === 'clear'} onclick={() => confirm('clear', clear)} disabled={!rect || !!working}>{armed === 'clear' ? 'Conferma cancellazione' : 'Cancella rettangolo'}</button>
        <button class="btn small danger" class:armed={armed === 'ban'} onclick={() => confirm('ban', ban)} disabled={!selected || !!working}>{armed === 'ban' ? 'Conferma esclusione' : 'Escludi autore'}</button>
      </div>
    </section>
  {/if}

  {#if showHotkey}
    <section class="card hotkey">
      <p class="eyebrow">HOT KEY</p>
      <button class="btn accent big" onclick={() => send({ t: 'countdown' })} disabled={meta?.phase !== 'hotkey_ready' || !linked || !!stage?.countdown}>Avvia 3 · 2 · 1</button>
      <p class="fine muted">{meta?.phase === 'hotkey_ready' ? 'Pronto: il round parte solo da qui, da Invio o da Avanti in questa scena.' : meta?.phase === 'hotkey_running' ? 'Round in corso.' : 'Si attiva dopo la scena «Zero server (nostri)».'}</p>
    </section>
  {/if}

  <section class="card emergency">
    <p class="eyebrow">Emergenza · sempre disponibile</p>
    <div class="grid">
      <button class="btn solid" onclick={safe}>Stato sicuro <kbd>Esc</kbd></button>
      <button class="btn" class:on={meta?.canvasHidden} onclick={hide} disabled={config.static || !!working}>{meta?.canvasHidden ? 'Mostra tela' : 'Nascondi tela'} <kbd>H</kbd></button>
      {#if stage?.mode === 'static'}
        <button class="btn" onclick={toLive} disabled={!linked}>LIM di nuovo live</button>
      {:else}
        <button class="btn" class:armed={armed === 'static'} onclick={() => confirm('static', toStatic)} disabled={!linked}>{armed === 'static' ? 'Conferma: LIM statica' : 'LIM statica (senza rete)'}</button>
      {/if}
      <button class="btn" class:on={stage?.video} onclick={() => send({ t: 'video' })} disabled={!linked}>Video di backup</button>
    </div>
    <p class="fine muted">Stato sicuro chiude X-Ray, zoom e video sulla LIM e ferma lo sciame: non tocca dati né fasi. Piano B completo: <span class="mono">docs/troubleshooting.md</span>.</p>
  </section>

  <details class="card tools">
    <summary class="eyebrow">Strumenti e sessione</summary>
    <div class="row wrap">
      <button class="btn small" class:on={stage?.xray} onclick={() => send({ t: 'toggle', what: 'xray' })}>X-Ray sulla LIM</button>
      <button class="btn small" class:on={stage?.meter} onclick={() => send({ t: 'toggle', what: 'meter' })}>Tassametro</button>
      <button class="btn small" onclick={bots} disabled={config.static}>Bot runner: {meta?.botsEnabled ? 'on' : 'off'}</button>
      <button class="btn small" onclick={fullscreen}>Regia a schermo intero</button>
    </div>
    <div class="row wrap">
      <button class="btn small danger" class:armed={armed === 'reload'} onclick={() => confirm('reload', () => send({ t: 'reload' }))} disabled={!linked}>{armed === 'reload' ? 'Conferma ricarica' : 'Ricarica LIM'}</button>
      <button class="btn small danger" class:armed={armed === 'new'} onclick={() => confirm('new', newSession)} disabled={!api.admin && !config.mock}>{armed === 'new' ? 'Conferma nuova sessione' : 'Nuova sessione (riparte da zero)'}</button>
      {#if backend.kind !== 'local' && !config.mock}
        <button class="btn small danger" class:armed={armed === 'local'} onclick={() => confirm('local', local)}>{armed === 'local' ? 'Conferma passaggio' : 'Passa al backend locale'}</button>
      {/if}
    </div>
    {#if api.admin}
      <form class="row" onsubmit={applyKey}>
        <input type="password" autocomplete="off" bind:value={key} aria-label="Chiave admin" /><button class="btn small" type="submit">Aggiorna chiave</button>
      </form>
    {/if}
    <p class="fine muted mono">API {config.api} · ambito {scope}</p>
  </details>

  <details class="card">
    <summary class="eyebrow">Tutte le scene · salto solo visivo</summary>
    <ol class="scenes">
      {#each scenes as s, i (s.id)}
        <li><button class:now={stage?.scene === i} onclick={() => send({ t: 'go', scene: i })} disabled={!linked}>
          <span class="mono">{String(i + 1).padStart(2, '0')}</span> {s.title} <span class="muted mono">{s.time} · {s.speaker}</span>
        </button></li>
      {/each}
    </ol>
    <p class="fine muted">I salti e «Indietro» non cambiano la fase del database: solo «Avanti» la fa avanzare.</p>
  </details>

  <section class="card log">
    <p class="eyebrow">Registro</p>
    {#each log as l, i (i)}<p class:bad={l.bad}><span class="mono muted">{l.at}</span> {l.text}</p>{:else}<p class="muted">Nessun evento.</p>{/each}
  </section>
</main>

<style>
  :global(html[data-view='regia']) { background: var(--paper); }
  .regia { max-width: 1280px; margin: 0 auto; padding: 18px 16px 60px; display: grid; gap: 12px; font-size: 16px; }
  @media (min-width: 1000px) {
    .regia { grid-template-columns: 1fr 1fr; align-items: start; }
    .top, .banner, .keyform, .timers, .now-next, .controls { grid-column: 1 / -1; }
  }
  .top { display: flex; justify-content: space-between; align-items: end; gap: 12px; flex-wrap: wrap; }
  h1 { font-size: 30px; margin: 0; font-weight: 500; letter-spacing: -.02em; }
  .status { list-style: none; margin: 0; padding: 0; display: flex; gap: 6px; flex-wrap: wrap; }
  .status li { font-size: 13px; padding: 4px 10px; border-radius: 999px; border: 1.5px solid var(--line-2); background: var(--card); display: flex; align-items: center; gap: 6px; }
  .status .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
  .status .ok { border-color: var(--green); color: var(--green); } .status .ok .dot { background: var(--green); }
  .status .bad { border-color: var(--red); color: var(--red); } .status .bad .dot { background: var(--red); animation: blink 1s infinite; }
  @keyframes blink { 50% { opacity: .3; } }
  .banner { margin: 0; padding: 12px 16px; background: var(--accent-soft); border-radius: 14px; }
  kbd { font-family: var(--mono); font-size: .85em; border: 1.5px solid var(--line-2); border-radius: 6px; padding: 0 5px; background: var(--card); color: var(--ink); }
  .card { background: var(--card); border: 1.5px solid var(--line-2); border-radius: 18px; padding: 14px 16px; }
  .row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
  .row input { flex: 1; }
  .wrap { flex-wrap: wrap; }
  .eyebrow { font-size: 12px; margin: 0 0 4px; display: block; }
  .keyform { border-color: var(--accent); }

  .timers { display: grid; grid-template-columns: repeat(3, 1fr) auto; gap: 8px; align-items: stretch; }
  .timer { background: var(--card); border: 1.5px solid var(--line-2); border-radius: 14px; padding: 8px 12px; display: grid; grid-template-columns: auto 1fr; column-gap: 8px; align-items: baseline; }
  .timer .eyebrow { grid-column: 1 / -1; }
  .timer strong { font-size: 26px; letter-spacing: -.02em; }
  .timer strong.over { color: var(--red); } .timer strong.good { color: var(--green); }
  .timer-actions { display: grid; align-content: center; }
  @media (max-width: 640px) { .timers { grid-template-columns: 1fr 1fr; } .timer-actions { grid-column: 1 / -1; } }

  .now-next { display: grid; grid-template-columns: 3fr 2fr; gap: 12px; }
  @media (max-width: 640px) { .now-next { grid-template-columns: 1fr; } }
  .meta-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
  .now { border-color: var(--ink); border-width: 2px; }
  .now h2 { font-size: 32px; margin: 6px 0 0; font-weight: 500; line-height: 1.1; letter-spacing: -.01em; }
  .next h3 { font-size: 22px; margin: 6px 0 0; font-weight: 500; line-height: 1.15; color: var(--ink-2); }
  .next.warn { border-color: var(--red); }
  .step { margin: 6px 0 0; color: var(--accent); font-weight: 600; font-size: 18px; }
  .speaker { font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: var(--ink); color: var(--paper); white-space: nowrap; }
  .speaker.s-P2 { background: var(--blue); } .speaker.s-P1\+P2 { background: linear-gradient(90deg, var(--ink) 50%, var(--blue) 50%); }
  .phase { margin: 12px 0 0; padding-top: 10px; border-top: 1.5px dashed var(--line-2); display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .phase .eyebrow { margin: 0; }
  .phase.live b { color: var(--accent); }
  .countdown { font-weight: 800; font-size: 20px; }
  .effect { margin: 10px 0 0; font-size: 15px; line-height: 1.35; }
  .effect.bad { color: var(--red); font-weight: 600; }

  .controls { display: grid; grid-template-columns: 1fr 3fr; gap: 10px; }
  .nav { min-height: 84px; font-size: 22px; border-radius: 18px; }
  .go { background: var(--accent); border-color: var(--accent); color: #fff; font-size: 28px; font-weight: 700; }
  .go:hover:not(:disabled) { background: #BF4414; border-color: #BF4414; color: #fff; }
  .go.round { background: var(--ink); border-color: var(--ink); }
  .go.blocked { background: var(--muted); border-color: var(--muted); }
  .keys { grid-column: 1 / -1; margin: 0; font-size: 13px; }

  .notes ul { margin: 0; padding-left: 18px; display: grid; gap: 8px; line-height: 1.4; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .big-num { font-size: 44px; margin: 0; line-height: 1; }
  .big-num .muted { font-size: 20px; }
  .swarm { display: grid; gap: 6px; align-content: start; }
  .swarm input { padding: 0; }
  .small { font-size: 12px; margin: 0; }
  .mini { aspect-ratio: 16 / 9; background: var(--board); border-radius: 14px; padding: 6px; margin-top: 12px; }
  .big { min-height: 64px; font-size: 20px; width: 100%; }
  .fine { font-size: 13px; margin: 8px 0 0; }
  .emergency { border-color: var(--red); }
  .emergency .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .btn.on { background: var(--ink); color: var(--paper); }
  .btn.armed { background: var(--red); border-color: var(--red); color: #fff; animation: pulse .8s infinite alternate; }
  @keyframes pulse { to { box-shadow: 0 0 0 4px color-mix(in srgb, var(--red) 25%, transparent); } }
  details summary { cursor: pointer; list-style: none; }
  details summary::before { content: '▸ '; } details[open] summary::before { content: '▾ '; }
  .scenes { list-style: none; padding: 0; margin: 8px 0 0; display: grid; gap: 2px; }
  .scenes button { all: unset; cursor: pointer; display: flex; gap: 6px; width: 100%; padding: 6px 10px; border-radius: 10px; font-size: 14px; box-sizing: border-box; }
  .scenes button .muted { margin-left: auto; }
  .scenes button:hover:not(:disabled) { background: var(--paper); }
  .scenes button.now { background: var(--ink); color: var(--paper); }
  .scenes .mono { opacity: .7; }
  .log { max-height: 240px; overflow: auto; }
  .log p { margin: 4px 0; font-size: 14px; }
  .log .bad { color: var(--red); }
</style>
