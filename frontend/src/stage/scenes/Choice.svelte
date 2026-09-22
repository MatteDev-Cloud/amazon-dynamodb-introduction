<script lang="ts">
  import Title from '../parts/Title.svelte';
  import { reveal } from '../motion';
  let { step }: { step: number } = $props();
  const yes = ['Traffico imprevedibile, a picchi', 'Domande note fin dall’inizio', 'Architetture serverless ed event-driven', 'Latenza costante a qualsiasi scala'];
  const no = ['Domande ancora da scoprire', 'Query ad hoc e report', 'Analytics e aggregazioni', 'Relazioni ricche tra molte entità'];
</script>

<div class="choice">
  <Title text="Non è più semplice. È complesso *in un momento diverso.*" size={84} />
  <div class="cols">
    <section class="yes" use:reveal={{ delay: .4 }}>
      <h3 class="display">Sì, quando…</h3>
      <ul>{#each yes as item, i (item)}<li style:animation-delay="{.6 + i * .15}s">{item}</li>{/each}</ul>
    </section>
    {#if step >= 1}
      <section class="no" use:reveal={{ x: 60, y: 0 }}>
        <h3 class="display">No, quando…</h3>
        <ul>{#each no as item, i (item)}<li style:animation-delay="{.3 + i * .15}s">{item}</li>{/each}</ul>
      </section>
    {/if}
  </div>
  {#if step >= 1}<p class="quote display" use:reveal={{ delay: 1 }}>«Un relazionale ti perdona una query non prevista. DynamoDB no.»</p>{/if}
</div>

<style>
  .choice { position: absolute; inset: 150px 88px 120px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 56px; }
  section { border-top: 4px solid var(--green); padding-top: 22px; }
  .no { border-color: var(--red); }
  h3 { font-size: 56px; margin: 0 0 20px; font-weight: 500; font-style: italic; }
  .yes h3 { color: var(--green); } .no h3 { color: var(--red); }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }
  li { font-size: 36px; padding: 14px 0; border-bottom: 1px solid var(--line); animation: fade-up .6s var(--ease-out) both; display: flex; gap: 18px; }
  .yes li::before { content: '✓'; color: var(--green); font-weight: 700; }
  .no li::before { content: '✕'; color: var(--red); font-weight: 700; }
  .quote { position: absolute; bottom: 0; left: 0; font-size: 40px; font-style: italic; margin: 0; color: var(--ink-2); font-weight: 400; }
</style>
