<script lang="ts">
  import { config } from '../../shared/config';
  import type { Session } from '../../shared/session.svelte';
  import { clock, number, usd } from '../../shared/ui';
  import Title from '../parts/Title.svelte';
  import Count from '../parts/Count.svelte';
  import { reveal } from '../motion';
  let { session, step }: { session: Session; step: number } = $props();
  const s = $derived(session.stats);
  const k = $derived([1, 1000, 1_000_000][step] ?? 1);
  const people = $derived(Math.max(1, session.players.length) * k);
  const lines = $derived(s ? [
    { label: 'Richieste API', value: s.apiCalls },
    { label: 'Scritture tabella · WRU', value: s.wruTable, digits: 1 },
    { label: 'Scritture GSI · WRU', value: s.wruGsi, digits: 1, hot: true },
    { label: 'Letture · RRU', value: s.rruTable + s.rruGsi, digits: 1 },
    { label: 'Calcolo Lambda · s', value: s.lambdaMs / 1000, digits: 1 },
  ] : []);
  const printedAt = clock(Date.now());
</script>

<div class="cost">
  <div class="copy">
    <Title text="Cosa è appena *successo.*" size={104} />
    {#key step}
      <p class="lead" use:reveal={{ delay: .15 }}>
        {#if step === 0}Tutto quello che avete fatto finora, a prezzo di listino.
        {:else if step === 1}E se fossimo <b>mille</b> volte tanti?
        {:else}Un <b>milione</b> di volte. Stessa tabella, stessa API.{/if}
      </p>
    {/key}
    <div class="people">
      <p class="big display"><Count value={people} /></p>
      <p class="muted">{k === 1 ? 'persone in sala' : 'persone simulate'}</p>
      {#if step === 0}
        <div class="dots small">{#each Array.from({ length: Math.min(200, session.players.length) }) as _, i (i)}<i style:animation-delay="{i * 12}ms"></i>{/each}</div>
      {:else if step === 1}
        <div class="dots">{#each Array.from({ length: 1000 }) as _, i (i)}<i style:animation-delay="{(i % 50) * 14 + Math.floor(i / 50) * 20}ms"></i>{/each}</div>
      {:else}
        <p class="prime display" use:reveal={{ delay: .4 }}>Prime Day 2025: <b>151 milioni</b> di richieste al secondo.</p>
        <p class="muted small-note" use:reveal={{ delay: .6 }}>Dato pubblicato da AWS per quell’evento, non la capacità dimostrata dalla nostra tabella.</p>
      {/if}
    </div>
  </div>

  <div class="receipt-wrap" use:reveal={{ delay: .2, y: -120 }}>
    <div class="receipt mono">
      <p class="center strong">DYNAMOLIVE</p>
      <p class="center">scontrino · sessione {session.meta?.sid ?? config.sid}</p>
      <p class="center">{printedAt}{k > 1 ? ` · proiezione ×${number(k)}` : ''}</p>
      <hr />
      {#if !s}
        <p>Misure non disponibili.</p>
      {:else}
        {#each lines as line, i (line.label)}
          <p class="line" class:hot={line.hot && step === 0} style:animation-delay="{.6 + i * .18}s"><span>{line.label}</span><b><Count value={line.value * k} digits={line.digits ?? 0} /></b></p>
        {/each}
        <hr />
        <p class="total" style:animation-delay="{.6 + lines.length * .18}s">
          <span>TOTALE STIMATO</span>
          <b>{s.estimatedCost === null ? 'n/d' : ''}{#if s.estimatedCost !== null}<Count value={s.estimatedCost * k} format={v => usd(v, k >= 1000 ? 2 : 4)} />{/if}</b>
        </p>
        {#if step === 0}<p class="gsi-note">↑ ogni GSI moltiplica le scritture</p>{/if}
        <hr />
        <p class="fine">{config.mock || config.static ? 'DATI SIMULATI' : 'Stima a listino on-demand'} · {s.prices.region}. Prima di crediti e imposte; hosting, storage e log esclusi. {k > 1 ? 'Proiezione a listino, non un test di carico.' : ''}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .cost { position: absolute; inset: 150px 88px 120px; display: grid; grid-template-columns: 1fr 620px; gap: 80px; }
  .lead { font-size: 36px; color: var(--ink-2); margin: 24px 0 0; }
  .lead b { color: var(--accent); }
  .people { margin-top: 40px; }
  .big { font-size: 150px; line-height: 1; margin: 0; font-weight: 400; color: var(--ink); letter-spacing: -.03em; }
  .people > .muted { font-size: 26px; margin: 6px 0 24px; }
  .dots { display: grid; grid-template-columns: repeat(50, 1fr); gap: 5px; max-width: 900px; }
  .dots.small { grid-template-columns: repeat(25, 1fr); max-width: 560px; gap: 8px; }
  .dots i { aspect-ratio: 1; border-radius: 50%; background: var(--accent); animation: pop .4s var(--ease-out) both; }
  @keyframes pop { from { transform: scale(0); opacity: 0; } }
  .prime { font-size: 50px; line-height: 1.2; margin: 10px 0 0; font-weight: 400; max-width: 1000px; }
  .prime b { color: var(--accent); font-weight: 500; }
  .small-note { font-size: 22px; }
  .receipt-wrap { align-self: start; filter: drop-shadow(0 30px 40px #1a223830); }
  .receipt { background: #FFFEFA; padding: 36px 36px 50px; font-size: 20px; transform: rotate(-1.5deg);
    -webkit-mask: radial-gradient(12px at 50% 100%, #0000 98%, #000) 50% 100% / 24px 100% repeat-x; mask: radial-gradient(12px at 50% 100%, #0000 98%, #000) 50% 100% / 24px 100% repeat-x; }
  .receipt p { margin: 6px 0; }
  .center { text-align: center; color: var(--muted); font-size: 18px; }
  .strong { color: var(--ink); font-weight: 800; font-size: 28px; letter-spacing: .2em; }
  hr { border: 0; border-top: 2px dashed var(--line-2); margin: 18px 0; }
  .line, .total { display: flex; justify-content: space-between; gap: 20px; animation: fade-up .5s var(--ease-out) both; }
  .line span { color: var(--ink-2); }
  .line.hot { background: var(--accent-soft); margin: 0 -14px; padding: 4px 14px; border-radius: 6px; }
  .total { font-size: 30px; font-weight: 800; }
  .total b { color: var(--accent); }
  .gsi-note { font-size: 18px; color: var(--accent); margin-top: 10px !important; }
  .fine { font-size: 15px; color: var(--muted); line-height: 1.5; }
</style>
