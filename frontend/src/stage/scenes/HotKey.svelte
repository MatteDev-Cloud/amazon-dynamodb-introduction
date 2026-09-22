<script lang="ts">
  import { untrack } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { config } from '../../shared/config';
  import type { Session } from '../../shared/session.svelte';
  import { time } from '../../shared/ui';
  import Title from '../parts/Title.svelte';
  import Count from '../parts/Count.svelte';
  import { reveal } from '../motion';
  let { session }: { session: Session } = $props();

  const meta = $derived(session.meta);
  const phase = $derived(config.static ? 'hotkey_end' : meta?.phase);
  const orange = $derived(session.stats?.teamOrange ?? 0);
  const purple = $derived(session.stats?.teamPurple ?? 0);
  const share = $derived(orange + purple ? orange / (orange + purple) * 100 : 50);
  const rows = $derived.by(() => {
    const seen = new Map<string, number>();
    return (session.leaderboard?.top ?? []).slice(0, 7).map(p => { const base = `${p.nickname}:${p.team}`, n = seen.get(base) ?? 0; seen.set(base, n + 1); return { ...p, key: `${base}:${n}` }; });
  });
  const max = $derived(Math.max(1, ...rows.map(r => r.score)));
  // Heat of the shared STATS item: taps per second, smoothed.
  let heat = $state(0);
  let last: { taps: number; at: number } | undefined;
  $effect(() => {
    const taps = session.stats?.taps ?? 0;
    untrack(() => {
      const now = performance.now();
      if (last && now - last.at > 400) heat = heat * .4 + Math.max(0, (taps - last.taps) / ((now - last.at) / 1000)) * .6;
      if (!last || now - last.at > 400) last = { taps, at: now };
    });
  });
  const glow = $derived(Math.min(1, heat / 60));
</script>

<div class="hk" data-phase={phase}>
  {#if phase === 'hotkey_ready' || phase === 'talk' || phase === 'pixel_frozen'}
    <div class="ready">
      <Title text="HOT *KEY*" size={260} />
      <ol class="rules" use:reveal={{ delay: .5, stagger: .18 }}>
        <li><b class="display">1</b>Tappate il più veloce possibile.</li>
        <li><b class="display">2</b>15 secondi. Arancioni contro viola.</li>
        <li><b class="display">3</b>Ogni tap è un <span class="mono">ADD</span> atomico sullo stesso item.</li>
      </ol>
      <p class="wait mono" use:reveal={{ delay: 1.3 }}>In attesa del via…</p>
    </div>
  {:else}
    <header class="bar-head">
      <h2 class="display">HOT <em>KEY</em></h2>
      <p class="timer mono">{phase === 'hotkey_running' && meta?.roundEndsAt ? time(meta.roundEndsAt - session.now) : session.leaderboard?.provisional ? 'consolido…' : 'podio'}</p>
    </header>
    <div class="tug" style:--share="{share}%">
      <div class="side o"><b class="display"><Count value={orange} /></b><span>arancioni</span></div>
      <div class="side p"><span>viola</span><b class="display"><Count value={purple} /></b></div>
    </div>
    <div class="grid">
      <ol class="board">
        {#each rows as r (r.key)}
          <li class={r.team} animate:flip={{ duration: 450 }} in:fly={{ y: 20, duration: 400 }} style:--score="{r.score / max * 100}%">
            <span class="rank mono">{r.rank}</span><span class="nick">{r.nickname}</span><b class="mono">{r.score}</b>
          </li>
        {/each}
        {#if !rows.length}<li class="empty muted">I primi tap appariranno qui.</li>{/if}
      </ol>
      <article class="hot" style:--glow={glow}>
        <p class="eyebrow">L’item più conteso della sala</p>
        <dl class="mono">
          <div><dt class="pk">PK</dt><dd>SESSION#{meta?.sid ?? config.sid}</dd></div>
          <div><dt class="sk">SK</dt><dd>STATS</dd></div>
          <div><dt>teamOrange</dt><dd><Count value={orange} /></dd></div>
          <div><dt>teamPurple</dt><dd><Count value={purple} /></dd></div>
          <div><dt>taps</dt><dd><Count value={session.stats?.taps ?? 0} /></dd></div>
        </dl>
        <p class="why">Tutti i tap aggiornano <b>questo</b> item con <span class="mono">ADD</span>: nessun lock, nessun punto perso. Ecco perché si chiama <em>hot key</em>.</p>
      </article>
    </div>
    {#if phase !== 'hotkey_running' && session.leaderboard}
      <p class="final mono">{session.leaderboard.provisional ? 'Classifica provvisoria · attendo i batch finali' : 'Risultato consolidato · letto con Query sul GSI ByScore'}</p>
    {/if}
  {/if}
</div>

<style>
  .hk { position: absolute; inset: 150px 88px 120px; }
  .ready { display: grid; grid-template-columns: auto 1fr; gap: 80px; align-items: center; height: 100%; }
  .rules { list-style: none; padding: 0; margin: 0; display: grid; gap: 28px; font-size: 38px; }
  .rules li { display: flex; gap: 24px; align-items: baseline; border-top: 1.5px solid var(--ink); padding-top: 18px; }
  .rules b { font-size: 56px; color: var(--accent); font-weight: 500; width: 50px; }
  .wait { position: absolute; bottom: 0; left: 0; font-size: 22px; color: var(--muted); animation: blink 1.6s infinite; }
  @keyframes blink { 50% { opacity: .35; } }
  .bar-head { display: flex; justify-content: space-between; align-items: baseline; }
  h2 { font-size: 84px; margin: 0; font-weight: 600; letter-spacing: -.03em; }
  h2 em { color: var(--accent); font-weight: 400; }
  .timer { font-size: 88px; margin: 0; letter-spacing: -.04em; }
  .tug { position: relative; height: 130px; border-radius: 30px; overflow: hidden; margin-top: 18px; display: flex; justify-content: space-between; align-items: center; padding: 0 40px; color: #fff;
    background: linear-gradient(90deg, var(--orange) 0 var(--share), var(--purple) var(--share) 100%); transition: --share .5s; }
  .side { display: flex; align-items: baseline; gap: 16px; font-size: 28px; z-index: 1; }
  .side b { font-size: 84px; font-weight: 500; }
  .grid { display: grid; grid-template-columns: 1fr 640px; gap: 50px; margin-top: 30px; }
  .board { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; align-content: start; }
  .board li { display: grid; grid-template-columns: 50px 1fr auto; align-items: center; gap: 16px; padding: 10px 22px; border-radius: 16px; font-size: 28px; border: 1.5px solid var(--line-2);
    background: linear-gradient(90deg, color-mix(in srgb, var(--team) 22%, var(--card)) var(--score), var(--card) var(--score)); }
  .board li.orange { --team: var(--orange); } .board li.purple { --team: var(--purple); }
  .rank { color: var(--muted); font-size: 22px; } .board b { font-size: 30px; }
  .empty { border-style: dashed !important; }
  .hot { background: var(--card); border: 2px solid var(--ink); border-radius: 28px; padding: 26px 32px; align-self: start;
    box-shadow: 0 0 calc(var(--glow) * 90px) calc(var(--glow) * 10px) color-mix(in srgb, var(--accent) calc(var(--glow) * 70%), transparent), 10px 10px 0 var(--ink); transition: box-shadow .5s; }
  .hot dl { margin: 12px 0; font-size: 24px; }
  .hot dl div { display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid var(--line); }
  .hot dt { color: var(--muted); } .hot dd { margin: 0; }
  .pk { color: var(--accent) !important; font-weight: 800; } .sk { color: var(--blue) !important; font-weight: 800; }
  .why { font-size: 22px; line-height: 1.4; margin: 12px 0 0; color: var(--ink-2); }
  .why em { color: var(--accent); }
  .final { position: absolute; bottom: 10px; right: 0; width: 640px; font-size: 18px; color: var(--muted); margin: 0; }
</style>
