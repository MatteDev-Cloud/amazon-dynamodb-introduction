<script lang="ts">
  import type { Api } from '../shared/api';
  import type { Session } from '../shared/session.svelte';
  import { number } from '../shared/ui';
  let { api, session, onclose }: { api: Api; session: Session; onclose: () => void } = $props();
  // api.inspect is plain data refreshed by every admin call: re-read it on the session clock.
  const item = $derived((void session.now, api.inspect));
  const ops = $derived(item ? (item.details.operations.length ? item.details.operations : [item.details]) : []);
  const ddb = $derived(item ? item.details.ddbMs : 0);
</script>

<aside class="xray">
  <header>
    <div><p class="eyebrow">X-Ray · non è il servizio AWS X-Ray</p><h3 class="display">Dentro l’ultima richiesta</h3></div>
    <button class="btn small" onclick={onclose}>Chiudi · I</button>
  </header>
  {#if !item}
    <p class="muted">In attesa di misure API reali (servono la chiave admin e il backend).</p>
  {:else}
    <p class="path mono">{item.path.split('?')[0]}</p>
    <div class="lat">
      <div class="bar"><i style:width="{Math.min(100, ddb / Math.max(1, item.totalMs) * 100)}%"></i></div>
      <p class="mono"><b>{ddb.toFixed(1)} ms</b> DynamoDB · {Math.max(0, item.totalMs - ddb).toFixed(1)} ms resto (rete, Lambda, browser)</p>
    </div>
    <ol class="ops">
      {#each ops.slice(0, 5) as op, i (i)}
        <li>
          <strong class="mono">{op.op}</strong>
          <span class="mono muted">{String(op.params.IndexName ?? op.params.TableName ?? '')}</span>
          {#if op.params.KeyConditionExpression}<code>{String(op.params.KeyConditionExpression)}</code>{/if}
          {#if op.params.UpdateExpression}<code>{String(op.params.UpdateExpression)}</code>{/if}
          {#if op.params.ConditionExpression}<code>{String(op.params.ConditionExpression)}</code>{/if}
          <span class="cap mono">{number(op.consumed.table, 1)} unità tabella{#each Object.entries(op.consumed.gsi) as [name, v] (name)} · {number(v, 1)} {name}{/each} · {op.items} item · {op.ddbMs.toFixed(1)} ms</span>
        </li>
      {/each}
    </ol>
    <p class="muted foot">Misure dal backend (ReturnConsumedCapacity), non dal servizio AWS X-Ray.</p>
  {/if}
</aside>

<style>
  .xray { position: absolute; right: 48px; top: 120px; bottom: 120px; width: 620px; background: var(--card); border: 1.5px solid var(--ink); border-radius: 28px; padding: 32px; z-index: 30; overflow: hidden; box-shadow: 0 40px 90px -40px #1a223866; animation: slide .6s var(--ease-out) both; font-size: 18px; }
  @keyframes slide { from { transform: translateX(110%); } }
  header { display: flex; justify-content: space-between; align-items: start; gap: 16px; }
  h3 { font-size: 38px; margin: 6px 0 18px; font-weight: 500; }
  .path { font-size: 26px; color: var(--blue); margin: 0 0 14px; }
  .bar { height: 10px; background: var(--blue-soft); border-radius: 10px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--blue); transition: width .5s var(--ease-out); }
  .lat p { font-size: 16px; margin: 10px 0 20px; }
  .ops { list-style: none; padding: 0; margin: 0; display: grid; gap: 14px; }
  .ops li { border-top: 1px solid var(--line); padding-top: 14px; display: grid; gap: 6px; }
  code { font-family: var(--mono); font-size: 15px; background: var(--paper); padding: 4px 8px; border-radius: 6px; overflow-wrap: anywhere; }
  .cap { font-size: 14px; color: var(--muted); }
  .foot { font-size: 14px; position: absolute; bottom: 24px; }
</style>
