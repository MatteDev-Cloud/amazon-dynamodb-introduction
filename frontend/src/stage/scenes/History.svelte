<script lang="ts">
  import Title from '../parts/Title.svelte';
  import { reveal } from '../motion';
  let { step }: { step: number } = $props();
  const W = 1500, H = 470, CEIL = 150;
  // Illustrative traffic curve: slow growth, weekly ripple, a holiday spike. Not a historical measurement.
  const points = Array.from({ length: 301 }, (_, i) => {
    const x = i / 300 * W, t = x / W;
    const y = 420 - 120 * t ** 1.6 - 14 * Math.sin(t * 52) - 360 * Math.exp(-(((x - 1250) / 55) ** 2));
    return [x, Math.max(20, y)] as const;
  });
  const path = 'M' + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');
  const events = [
    { year: '2004', text: 'Natale: il picco manda in crisi i database relazionali di Amazon' },
    { year: '2007', text: 'Paper «Dynamo»: un key-value store interno, distribuito' },
    { year: '2012', text: 'Nasce DynamoDB: lo stesso modello, come servizio gestito' },
    { year: '2025', text: 'Prime Day: picco di 151 milioni di richieste al secondo (dato AWS)' },
  ];
</script>

<div class="history">
  <div class="title"><Title text="Natale *2004.*" size={128} /></div>
  <p class="lead" use:reveal={{ delay: .3 }}>
    {#if step === 0}Quello che avete appena fatto, moltiplicato per milioni di persone.
    {:else if step === 1}Il database regge fino a un certo punto. Poi no.
    {:else}Da un problema interno a un servizio per tutti.{/if}
  </p>
  <div class="chart" class:shrunk={step >= 2}>
    <svg viewBox="0 0 {W} {H}" aria-label="Curva di traffico illustrativa con un picco a Natale">
      <defs><clipPath id="over"><rect x="0" y="0" width={W} height={CEIL} /></clipPath></defs>
      {#each [0, 1, 2, 3] as g (g)}<line class="grid" x1="0" x2={W} y1={40 + g * 120} y2={40 + g * 120} />{/each}
      <path class="line" d={path} />
      {#if step >= 1}
        <line class="ceil" x1="0" x2={W} y1={CEIL} y2={CEIL} />
        <text class="ceil-label" x="12" y={CEIL - 14}>capacità del database relazionale</text>
        <path class="over" d={path} clip-path="url(#over)" />
        <g class="boom" transform="translate(1250 60)"><circle r="46" /><text y="10">503</text></g>
      {/if}
      <text class="axis" x="0" y={H - 4}>gennaio</text><text class="axis" x={W} y={H - 4} text-anchor="end">dicembre</text>
    </svg>
    <p class="note mono">curva illustrativa · non è una misura storica</p>
  </div>
  {#if step >= 2}
    <ol class="timeline" use:reveal={{ stagger: .14, y: 30 }}>
      {#each events as e (e.year)}<li><strong class="display">{e.year}</strong><span>{e.text}</span></li>{/each}
    </ol>
  {/if}
</div>

<style>
  .history { position: absolute; inset: 150px 88px 120px; }
  .lead { font-size: 36px; color: var(--ink-2); margin: 20px 0 0; min-height: 50px; }
  .chart { position: absolute; left: 0; width: 1420px; top: 250px; transition: transform 1s var(--ease-in-out), opacity .6s; transform-origin: 50% 0; }
  .chart.shrunk { transform: translateY(-40px) scale(.72); opacity: .55; }
  svg { width: 100%; height: auto; overflow: visible; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .line { fill: none; stroke: var(--ink); stroke-width: 5; stroke-linejoin: round; stroke-dasharray: 5000; stroke-dashoffset: 5000; animation: draw 2.6s .5s var(--ease-in-out) forwards; }
  .over { fill: none; stroke: var(--red); stroke-width: 8; stroke-linejoin: round; animation: fade-up .5s both; }
  .ceil { stroke: var(--red); stroke-width: 2.5; stroke-dasharray: 12 10; animation: fade-up .6s both; }
  .ceil-label { font: 500 22px var(--mono); fill: var(--red); }
  .boom circle { fill: var(--red); animation: boom .8s .3s var(--ease-out) both; }
  .boom text { font: 700 30px var(--mono); fill: #fff; text-anchor: middle; animation: fade-up .4s .6s both; }
  @keyframes boom { from { transform: scale(0); } 60% { transform: scale(1.25); } }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .axis { font: 18px var(--mono); fill: var(--muted); }
  .note { font-size: 16px; color: var(--muted); text-align: right; margin: 6px 0 0; }
  .timeline { position: absolute; left: 0; right: 0; bottom: 0; list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
  .timeline li { border-top: 3px solid var(--ink); padding-top: 18px; display: grid; gap: 10px; }
  .timeline li:first-child { border-color: var(--red); }
  .timeline li:nth-child(3) { border-color: var(--accent); }
  .timeline strong { font-size: 64px; font-weight: 500; line-height: 1; }
  .timeline span { font-size: 24px; line-height: 1.35; color: var(--ink-2); }
</style>
