<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { PHASES, type Meta, type Phase } from '../../../shared/types.js';
  import { ApiFailure } from '../shared/api';
  import { api } from '../shared/runtime';
  import { adminKey, config, regiaUrl, scope } from '../shared/config';
  import { openChannel, type Message, type StageState } from '../shared/channel';
  import { Session } from '../shared/session.svelte';
  import { scenes } from './slides';
  import { sceneIn, sceneOut } from './motion';
  import Chrome from './Chrome.svelte';
  import XRay from './XRay.svelte';
  import Lobby from './scenes/Lobby.svelte';
  import PixelWall from './scenes/PixelWall.svelte';
  import History from './scenes/History.svelte';
  import Keys from './scenes/Keys.svelte';
  import Patterns from './scenes/Patterns.svelte';
  import Architecture from './scenes/Architecture.svelte';
  import HotKey from './scenes/HotKey.svelte';
  import Cost from './scenes/Cost.svelte';
  import Choice from './scenes/Choice.svelte';
  import End from './scenes/End.svelte';

  const session = new Session(api);
  const components = { lobby: Lobby, pixel: PixelWall, history: History, keys: Keys, patterns: Patterns, architecture: Architecture, hotkey: HotKey, cost: Cost, choice: Choice, end: End } as const;

  const stored = JSON.parse(sessionStorage.getItem(`scene:${scope}`) || '[0,0]') as [number, number];
  const startIndex = Math.max(0, Math.min(scenes.length - 1, stored[0] ?? 0));
  let index = $state(startIndex);
  let step = $state(Math.max(0, Math.min(scenes[startIndex]!.steps.length - 1, stored[1] ?? 0)));
  let dir = $state(1);
  let busy = $state(false);
  let xray = $state(false);
  let meterOn = $state(true);
  let keyed = $state(!!api.admin || config.mock || config.static);
  let detail = $state<{ x: number; y: number } | null>(null);
  let countdown = $state<string | null>(null);
  let video = $state(false);
  let regiaSeen = $state(0);
  let scale = $state(1);
  let keyInput = $state('');
  let conflicts = $state<{ x: number; y: number; id: number }[]>([]);

  const scene = $derived(scenes[index]!);
  const regiaOnline = $derived(session.now - regiaSeen < 6000);
  const Current = $derived(components[scene.id as keyof typeof components]);

  const channel = openChannel(onMessage);
  function snapshot(): StageState { return { scene: index, step, steps: scene.steps.length, busy, notice: session.notice, xray, meter: meterOn, detail: detail ? { x: detail.x, y: detail.y } : null, keyed }; }
  function broadcast() { channel.send({ t: 'state', state: snapshot() }); }
  $effect(() => { void [index, step, busy, session.notice, xray, meterOn, detail, keyed]; broadcast(); sessionStorage.setItem(`scene:${scope}`, JSON.stringify([index, step])); });

  function onMessage(m: Message) {
    regiaSeen = Date.now();
    if (m.t === 'hello') broadcast();
    else if (m.t === 'key') applyKey(m.key);
    else if (m.t === 'next') void forward();
    else if (m.t === 'prev') back();
    else if (m.t === 'go') jump(m.scene);
    else if (m.t === 'toggle') { if (m.what === 'xray') xray = !xray; else meterOn = !meterOn; }
    else if (m.t === 'countdown') void startRound();
    else if (m.t === 'pixel') openPixel(m.x, m.y);
    else if (m.t === 'close-detail') closeDetail();
    else if (m.t === 'lit') session.sync.add({ x: m.x, y: m.y, c: m.c, by: m.by, t: m.at });
    else if (m.t === 'conflict') conflicts = [...conflicts, { x: m.x, y: m.y, id: Math.random() }];
    else if (m.t === 'video') video = true;
    else if (m.t === 'reload') location.reload();
  }

  function applyKey(key: string) {
    api.admin = key; sessionStorage.setItem(adminKey, key); keyed = !!key; session.notice = '';
  }

  async function phase(target: Phase) {
    if (config.static) return;
    const meta = session.meta; if (!meta) throw Error('Attendere META prima di avanzare');
    const current = PHASES.indexOf(meta.phase), next = PHASES.indexOf(target);
    if (next <= current) return;
    if (next !== current + 1) throw Error(`Fase ${meta.phase}: segui le scene in ordine per arrivare a ${target}. I salti sono solo visuali.`);
    session.meta = await api.call<Meta>('/admin/phase', { phase: target, expectedVersion: meta.version });
  }
  async function goTo(nextIndex: number, nextStep: number) {
    if (busy || countdown) return;
    busy = true;
    try {
      await phase(scenes[nextIndex]!.stepPhases[nextStep]!);
      if (nextIndex === 1 && nextStep === 1 && !detail) detail = pickPixel();
      if (nextIndex !== index) dir = nextIndex > index ? 1 : -1;
      index = nextIndex; step = nextStep; session.notice = '';
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 409) session.meta = await api.call<Meta>('/meta').catch(() => session.meta);
      session.report(e);
    } finally { busy = false; }
  }
  // A clicker press during a slow API call is remembered (once) instead of being dropped.
  let queuedForward = false;
  async function forward(): Promise<void> {
    if (busy) { queuedForward = true; return; }
    await advance();
    // Never let a queued press start the HOT KEY round: the 3-2-1 must be a deliberate gesture.
    const roundGate = scene.id === 'hotkey' && session.meta?.phase === 'hotkey_ready';
    if (queuedForward && !countdown && !roundGate) { queuedForward = false; return forward(); }
    queuedForward = false;
  }
  async function advance() {
    if (scene.id === 'hotkey' && session.meta?.phase === 'hotkey_ready') return startRound();
    if (step < scene.steps.length - 1) return goTo(index, step + 1);
    if (index < scenes.length - 1) return goTo(index + 1, 0);
  }
  /** Backwards and jumps are visual only: META never goes back. */
  function back() {
    if (busy || countdown) return;
    if (step > 0) { step--; if (scene.id === 'pixel' && step === 0) detail = null; return; }
    if (index > 0) { dir = -1; index--; step = scenes[index]!.steps.length - 1; }
  }
  function jump(target: number) {
    if (busy || countdown || target < 0 || target >= scenes.length || target === index) return;
    dir = target > index ? 1 : -1; index = target; step = 0;
  }
  function pickPixel() {
    const pixels = [...session.sync.state.pixels.values()].filter(p => !p.deleted);
    const humans = pixels.filter(p => !/^bot[.\d]/i.test(p.by));
    const pool = humans.length ? humans : pixels;
    const p = pool.sort((a, b) => b.t - a.t)[0];
    return p ? { x: p.x, y: p.y } : null;
  }
  function openPixel(x: number, y: number) {
    const p = session.sync.state.pixels.get(`${x},${y}`); if (!p || p.deleted) return;
    if (index !== 1) { dir = 1; index = 1; }
    detail = { x, y }; step = 1;
  }
  function closeDetail() { if (index === 1) { step = 0; detail = null; } }

  async function startRound() {
    if (countdown || config.static || session.meta?.phase !== 'hotkey_ready') return;
    if (index !== scenes.findIndex(s => s.id === 'hotkey')) { dir = 1; index = scenes.findIndex(s => s.id === 'hotkey'); step = 0; }
    try {
      for (const n of ['3', '2', '1']) { countdown = n; await new Promise(r => setTimeout(r, 1000)); }
      await phase('hotkey_running'); countdown = 'VIA!';
      setTimeout(() => { countdown = null; }, 700);
    } catch (e) { countdown = null; session.report(e); }
  }

  async function action(path: string, body: unknown) {
    if (config.static) return;
    try { const r = await api.call<Meta & { phase?: Phase }>(path, body); if (r.phase) session.meta = r; await session.sync.refresh(true); }
    catch (e) { if (e instanceof ApiFailure && e.status === 409) session.meta = await api.call<Meta>('/meta').catch(() => session.meta); session.report(e); }
  }
  function openRegia() { window.open(regiaUrl(), 'dynamolive-regia', 'popup,width=560,height=940'); }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLElement && (e.target.matches('input,textarea,select') || e.target.isContentEditable)) return;
    if (video) { if (e.key === 'Escape') video = false; return; }
    const k = e.key.toLowerCase();
    if (['arrowright', 'pagedown', ' '].includes(k)) { e.preventDefault(); void forward(); }
    else if (['arrowleft', 'pageup'].includes(k)) { e.preventDefault(); back(); }
    else if (k === 'enter' && scene.id === 'hotkey') void startRound();
    else if (k === 'escape') closeDetail();
    else if (/^[0-9]$/.test(k)) jump(k === '0' ? 9 : Number(k) - 1);
    else if (k === 'i') xray = !xray;
    else if (k === 'm') meterOn = !meterOn;
    else if (k === 'r') openRegia();
    else if (k === 'f' && session.meta?.phase === 'pixel') void action('/admin/phase', { phase: 'pixel_frozen', expectedVersion: session.meta.version });
    else if (k === 'h') void action('/admin/hide', { hidden: !session.meta?.canvasHidden });
    else if (k === 'p') video = true;
  }

  function fit() { scale = Math.min(innerWidth / 1920, innerHeight / 1080); }
  onMount(() => {
    fit(); session.start({ canvasMs: 400 });
    if (!keyed) channel.send({ t: 'need-key' });
    const beat = setInterval(broadcast, 2000);
    return () => clearInterval(beat);
  });
  onDestroy(() => { session.stop(); channel.close(); });
</script>

<svelte:window onresize={fit} onkeydown={onKey} />

<div class="viewport">
  <div class="deck" style:transform="translate(-50%, -50%) scale({scale})" data-scene={scene.id}>
    {#key scene.id}
      <section class="scene" in:sceneIn={{ dir }} out:sceneOut={{ dir }}>
        <Current {session} {step} {detail} {conflicts} onpixel={openPixel} onclose={closeDetail} onnext={forward} />
      </section>
    {/key}
    <Chrome {session} {index} {step} {meterOn} {regiaOnline} />
    {#if xray}<XRay {api} {session} onclose={() => (xray = false)} />{/if}
    {#if countdown}
      {#key countdown}<div class="countdown" class:go={countdown === 'VIA!'}>{countdown}</div>{/key}
    {/if}
    {#if !keyed}
      <div class="connect">
        <p class="eyebrow">Regia non collegata</p>
        <h2 class="display">Collega il pannello di regia.</h2>
        <p class="muted">Premi <kbd>R</kbd> per aprirlo in una finestra da spostare sul secondo schermo. La chiave admin arriva da lì.</p>
        <div class="row">
          <button class="btn solid" onclick={openRegia}>Apri la regia</button>
          <form onsubmit={e => { e.preventDefault(); applyKey(keyInput); }}>
            <input type="password" placeholder="oppure chiave admin qui" autocomplete="off" aria-label="Chiave admin" bind:value={keyInput} />
          </form>
        </div>
      </div>
    {/if}
    {#if video}
      <div class="video">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video src={config.backup} controls autoplay onerror={() => (session.notice = 'Video di backup non disponibile: copialo in public/backup.mp4.')}></video>
        <button class="btn small" onclick={() => (video = false)}>Chiudi · Esc</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .viewport { position: fixed; inset: 0; overflow: hidden; background: var(--paper-2); }
  .deck { position: absolute; left: 50%; top: 50%; width: 1920px; height: 1080px; transform-origin: 50% 50%; background: var(--paper); overflow: hidden; }
  .scene { position: absolute; inset: 0; will-change: transform, opacity; }
  .countdown { position: absolute; inset: 0; display: grid; place-items: center; font: 600 460px/1 var(--display); color: var(--ink); background: color-mix(in srgb, var(--paper) 82%, transparent); z-index: 40; animation: count 1s var(--ease-out) both; }
  .countdown.go { color: var(--accent); font-size: 300px; font-style: italic; }
  @keyframes count { from { transform: scale(1.4); } 30% { transform: scale(1); } to { transform: scale(.92); } }
  .connect { position: absolute; left: 50%; bottom: 120px; transform: translateX(-50%); width: 980px; background: var(--card); border: 1.5px solid var(--ink); border-radius: 28px; padding: 40px 48px; z-index: 50; box-shadow: 0 30px 80px -30px #1a223855; font-size: 22px; animation: fade-up .8s var(--ease-out) both; }
  .connect h2 { font-size: 52px; margin: 8px 0 12px; font-weight: 500; letter-spacing: -.02em; }
  .connect .row { display: flex; gap: 20px; align-items: center; margin-top: 24px; }
  .connect form { flex: 1; } .connect input { width: 100%; }
  kbd { font-family: var(--mono); border: 1.5px solid var(--line-2); border-bottom-width: 3px; border-radius: 8px; padding: 2px 10px; background: var(--paper); }
  .video { position: absolute; inset: 0; background: #000e; z-index: 60; display: grid; place-items: center; gap: 20px; align-content: center; }
  .video video { max-width: 90%; max-height: 80%; }
</style>
