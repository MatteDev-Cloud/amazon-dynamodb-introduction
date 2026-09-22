<script lang="ts">
  import Title from '../parts/Title.svelte';
  import { reveal } from '../motion';
  let { step }: { step: number } = $props();
  const drawers = Array.from({ length: 6 }, (_, i) => i);
</script>

<div class="patterns">
  <Title text="Prima le *domande.*" size={120} />
  {#key step}
    {#if step === 0}
      <div class="split">
        <section use:reveal={{ stagger: .15 }}>
          <p class="eyebrow">Relazionale</p>
          <div class="box">I dati</div><span class="arrow">↓</span>
          <div class="box">Li normalizzi in tabelle</div><span class="arrow">↓</span>
          <div class="box soft">Poi fai le domande <b class="mono">JOIN</b></div>
        </section>
        <section class="ddb" use:reveal={{ stagger: .15, delay: .5 }}>
          <p class="eyebrow">DynamoDB</p>
          <div class="box">Le domande</div><span class="arrow">↓</span>
          <div class="box">Le chiavi che le rendono veloci</div><span class="arrow">↓</span>
          <div class="box soft">Poi i dati, già al posto giusto</div>
        </section>
      </div>
      <p class="quote display" use:reveal={{ delay: 1.2 }}>«Nel relazionale progetti i dati e poi fai le domande. In DynamoDB progetti le domande e poi i dati.»</p>
    {:else if step === 1}
      <p class="lead" use:reveal={{ delay: .1 }}>Ogni domanda dei due giochi è diventata una chiave. Quando serve un altro ordine, un indice secondario (GSI).</p>
      <div class="cards">
        {#each [{ q: 'Cosa è cambiato sulla tela?', idx: 'ByTime', pk: 'cv', sk: 'updatedAt', use: 'Pixel Wall · /canvas/changes' }, { q: 'Chi è in testa?', idx: 'ByScore', pk: 'lb', sk: 'score', use: 'HOT KEY · classifica' }] as c, i (c.idx)}
          <div class="pattern" use:reveal={{ delay: .3 + i * .35, y: 40 }}>
            <p class="q display">«{c.q}»</p>
            <span class="flow" aria-hidden="true"></span>
            <div class="gsi">
              <p class="eyebrow">GSI</p><p class="name mono">{c.idx}</p>
              <p class="mono keys"><b class="pk">PK</b> {c.pk} · <b class="sk">SK</b> {c.sk}</p>
              <p class="use">{c.use}</p>
            </div>
          </div>
        {/each}
      </div>
      <p class="note" use:reveal={{ delay: 1.2 }}>Un GSI è un secondo archivio ordinato diversamente: ogni scrittura lo aggiorna, e si paga.</p>
    {:else}
      <div class="qs">
        <div class="side" use:reveal>
          <p class="eyebrow">Query</p>
          <div class="archive query">{#each drawers as d (d)}<div class="drw" class:hit={d === 2}>{#each Array.from({ length: 24 }) as _, k (k)}<i></i>{/each}</div>{/each}</div>
          <p class="verdict"><b class="display">1 cassetto</b> · leggi solo ciò che chiedi</p>
        </div>
        <div class="side" use:reveal={{ delay: .4 }}>
          <p class="eyebrow">Scan</p>
          <div class="archive scan">{#each drawers as d (d)}<div class="drw">{#each Array.from({ length: 24 }) as _, k (k)}<i></i>{/each}</div>{/each}<span class="beam"></span></div>
          <p class="verdict"><b class="display">tutto l’archivio</b> · paghi ogni item letto</p>
        </div>
      </div>
      <p class="note" use:reveal={{ delay: .9 }}>Niente JOIN, niente aggregazioni al volo: il cassetto giusto contro rovesciare l’archivio.</p>
    {/if}
  {/key}
</div>

<style>
  .patterns { position: absolute; inset: 150px 88px 120px; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 90px; margin-top: 50px; }
  .split section { display: grid; justify-items: start; gap: 6px; }
  .box { font-size: 36px; padding: 18px 30px; border: 2px solid var(--ink); border-radius: 20px; background: var(--card); }
  .box.soft { background: var(--paper-2); }
  .ddb .box { border-color: var(--blue); } .ddb .box.soft { background: var(--blue-soft); }
  .arrow { font-size: 34px; margin-left: 34px; color: var(--muted); }
  .eyebrow { font-size: 18px; margin: 0 0 12px; }
  .quote { font-size: 42px; font-style: italic; line-height: 1.25; margin: 50px 0 0; max-width: 1500px; color: var(--ink-2); font-weight: 400; }
  .lead { font-size: 34px; color: var(--ink-2); margin: 26px 0 40px; max-width: 1400px; }
  .cards { display: grid; gap: 30px; }
  .pattern { display: grid; grid-template-columns: 640px 200px 1fr; align-items: center; }
  .q { font-size: 52px; margin: 0; font-style: italic; font-weight: 400; }
  .flow { height: 3px; background: var(--accent); position: relative; transform-origin: left; animation: grow-x .8s .9s var(--ease-out) both; }
  .flow::after { content: ''; position: absolute; right: -2px; top: -8px; border: 9px solid transparent; border-left: 14px solid var(--accent); border-right: 0; }
  @keyframes grow-x { from { transform: scaleX(0); } }
  .gsi { border: 2px solid var(--blue); border-radius: 22px; padding: 18px 28px; background: var(--card); display: grid; grid-template-columns: auto 1fr; column-gap: 20px; align-items: baseline; }
  .gsi .eyebrow { margin: 0; } .gsi p { margin: 2px 0; }
  .name { font-size: 40px; color: var(--blue); font-weight: 700; }
  .keys, .use { grid-column: 1 / -1; font-size: 22px; }
  .use { color: var(--muted); }
  .pk { color: var(--accent); } .sk { color: var(--blue); }
  .note { font-size: 28px; color: var(--muted); margin-top: 40px; }
  .qs { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; margin-top: 50px; }
  .archive { position: relative; display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; padding: 18px; border: 2px solid var(--ink); border-radius: 24px; background: var(--card); overflow: hidden; }
  .drw { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; padding: 12px 10px; border: 1.5px solid var(--line-2); border-radius: 12px; }
  .drw i { aspect-ratio: 1; border-radius: 50%; background: var(--line); }
  .query .drw:not(.hit) { opacity: .35; }
  .query .hit { border-color: var(--accent); background: var(--accent-soft); animation: hit 2.4s infinite; }
  .query .hit i { background: var(--accent); }
  @keyframes hit { 0%, 100% { transform: none; } 20% { transform: translateY(-8px); } 40% { transform: none; } }
  .scan .drw i { animation: read 2.8s infinite; }
  .scan .drw:nth-child(1) i { animation-delay: .0s; } .scan .drw:nth-child(2) i { animation-delay: .35s; } .scan .drw:nth-child(3) i { animation-delay: .7s; }
  .scan .drw:nth-child(4) i { animation-delay: 1.05s; } .scan .drw:nth-child(5) i { animation-delay: 1.4s; } .scan .drw:nth-child(6) i { animation-delay: 1.75s; }
  @keyframes read { 0%, 30% { background: var(--line); } 10% { background: var(--red); } }
  .beam { position: absolute; top: 0; bottom: 0; width: 6px; background: var(--red); box-shadow: 0 0 30px 8px #c23b3240; animation: beam 2.8s linear infinite; }
  @keyframes beam { from { left: 0; } to { left: 100%; } }
  .verdict { font-size: 26px; margin: 22px 0 0; color: var(--ink-2); }
  .verdict b { font-size: 44px; font-weight: 500; color: var(--ink); margin-right: 6px; }
</style>
