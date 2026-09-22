<script lang="ts">
  import { config } from '../shared/config';
  import type { Session } from '../shared/session.svelte';
  import { number, usd } from '../shared/ui';
  import { scenes } from './slides';
  let { session, index, step, meterOn, regiaOnline }: { session: Session; index: number; step: number; meterOn: boolean; regiaOnline: boolean } = $props();
  const scene = $derived(scenes[index]!);
  const status = $derived(config.static ? 'Fallback statico · esempi simulati' : config.mock ? 'Demo · dati simulati' : !session.online ? 'Rete assente · riconnessione' : `Live · ${config.sid}`);
  const cost = $derived(session.stats?.estimatedCost);
</script>

<header class="top">
  <div class="brand"><span class="mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="display">Dynamo<em>Live</em></span></div>
  <div class="kicker mono">
    {#key index}<span class="num">{String(index + 1).padStart(2, '0')}</span><span class="sep">/</span><span class="k">{scene.kicker}</span>{/key}
  </div>
  <div class="status mono" class:bad={!session.online && !config.static}>
    <span class="dot"></span>{status}
  </div>
</header>

<footer class="bottom">
  <ol class="rail" aria-label="Avanzamento">
    {#each scenes as s, i (s.id)}
      <li class:done={i < index} class:now={i === index} title={s.title}>
        {#if i === index && s.steps.length > 1}
          <span class="steps">{#each s.steps as _, j (j)}<b class:on={j <= step}></b>{/each}</span>
        {/if}
      </li>
    {/each}
  </ol>
  {#if (!regiaOnline && session.notice && !config.static)}<p class="notice">{session.notice}</p>{/if}
  {#if meterOn && index !== 7}
    <div class="meter" title="Stima a listino on-demand">
      <span class="eyebrow">Costo finora</span>
      <strong class="mono">{cost === undefined ? '—' : cost === null ? 'n/d' : usd(cost)}</strong>
      <span class="mono small">{number(session.stats?.apiCalls ?? 0)} richieste</span>
    </div>
  {/if}
</footer>

<style>
  .top { position: absolute; left: 0; right: 0; top: 0; height: 110px; padding: 0 88px; display: flex; align-items: center; gap: 40px; z-index: 10; pointer-events: none; }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 600; letter-spacing: -.02em; }
  .brand em { font-style: italic; font-weight: 400; color: var(--accent); }
  .mark { display: grid; grid-template-columns: repeat(3, 9px); gap: 3px; }
  .mark i { width: 9px; height: 9px; border-radius: 50%; background: var(--ink); }
  .mark i:nth-child(2) { background: var(--accent); }
  .kicker { font-size: 17px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); display: flex; gap: 12px; animation: fade-up .7s var(--ease-out) both; }
  .num { color: var(--ink); font-weight: 700; }
  .status { margin-left: auto; font-size: 15px; color: var(--muted); display: flex; align-items: center; gap: 10px; letter-spacing: .06em; text-transform: uppercase; }
  .status .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 20%, transparent); }
  .status.bad { color: var(--red); } .status.bad .dot { background: var(--red); animation: blink 1s infinite; }
  @keyframes blink { 50% { opacity: .3; } }
  .bottom { position: absolute; left: 0; right: 0; bottom: 0; height: 100px; padding: 0 88px; display: flex; align-items: center; gap: 32px; z-index: 10; }
  .rail { display: flex; gap: 10px; list-style: none; margin: 0; padding: 0; align-items: center; }
  .rail li { height: 4px; width: 36px; border-radius: 4px; background: var(--line); transition: width .6s var(--ease-out), background .4s; position: relative; }
  .rail li.done { background: var(--ink-2); }
  .rail li.now { width: 120px; background: var(--line); }
  .steps { position: absolute; inset: 0; display: flex; gap: 4px; }
  .steps b { flex: 1; border-radius: 4px; background: transparent; transition: background .4s; }
  .steps b.on { background: var(--accent); }
  .rail li.now:not(:has(.steps)) { background: var(--accent); }
  .notice { font-size: 18px; color: var(--red); margin: 0; max-width: 900px; }
  .meter { margin-left: auto; display: flex; align-items: baseline; gap: 16px; padding: 12px 22px; border: 1.5px solid var(--line-2); border-radius: 999px; background: var(--card); }
  .meter strong { font-size: 24px; letter-spacing: -.02em; }
  .meter .eyebrow { font-size: 13px; }
  .small { font-size: 15px; color: var(--muted); }
</style>
