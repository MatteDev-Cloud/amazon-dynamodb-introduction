<script lang="ts" module>
  export interface Row { name: string; value: unknown; note?: string; onclick?: () => void; hint?: string }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  /** A DynamoDB item drawn attribute by attribute; PK and SK carry their role. */
  let { label, rows, compact = false, highlight = '', footer }: { label: string; rows: Row[]; compact?: boolean; highlight?: string; footer?: Snippet } = $props();
  const type = (v: unknown) => typeof v === 'number' ? 'N' : typeof v === 'boolean' ? 'BOOL' : 'S';
  const show = (v: unknown) => typeof v === 'string' ? `"${v}"` : String(v);
</script>

<article class="item" class:compact>
  <header><span class="eyebrow">{label}</span><span class="eyebrow">{rows.length} attributi</span></header>
  <dl>
    {#each rows as row (row.name)}
      <div class="row" class:pk={row.name === 'PK'} class:sk={row.name === 'SK'} class:hl={row.name === highlight}>
        <dt class="mono">{row.name}</dt>
        <dd class="mono">
          {#if row.onclick}
            <button class="link" onclick={row.onclick}><span class="t-s">{show(row.value)}</span><span class="hint">{row.hint ?? 'apri →'}</span></button>
          {:else}
            <span class={type(row.value) === 'N' ? 't-n' : type(row.value) === 'BOOL' ? 't-b' : 't-s'}>{show(row.value)}</span>
          {/if}
          <span class="type">{type(row.value)}</span>
        </dd>
        {#if row.note && !compact}<p class="note">{row.note}</p>{/if}
      </div>
    {/each}
  </dl>
  {#if footer}<footer>{@render footer()}</footer>{/if}
</article>

<style>
  .item { background: var(--card); border: 1.5px solid var(--ink); border-radius: 26px; padding: 26px 32px 22px; box-shadow: 10px 10px 0 var(--ink); font-size: 24px; }
  header { display: flex; justify-content: space-between; margin-bottom: 10px; }
  header .eyebrow { font-size: 15px; }
  dl { margin: 0; }
  .row { display: grid; grid-template-columns: 170px 1fr; align-items: baseline; padding: 11px 0; border-top: 1px solid var(--line); position: relative; }
  dt { color: var(--muted); font-size: .8em; }
  dd { margin: 0; display: flex; align-items: baseline; gap: 14px; min-width: 0; }
  dd > span:first-child, .link { overflow-wrap: anywhere; }
  .type { font-size: 13px; color: var(--muted); border: 1px solid var(--line-2); border-radius: 6px; padding: 1px 6px; margin-left: auto; flex: none; }
  .pk dt, .sk dt { font-weight: 800; }
  .pk dt { color: var(--accent); } .sk dt { color: var(--blue); }
  .pk { background: linear-gradient(90deg, var(--accent-soft), transparent 70%); margin: 0 -32px; padding-left: 32px; padding-right: 32px; }
  .sk { background: linear-gradient(90deg, var(--blue-soft), transparent 70%); margin: 0 -32px; padding-left: 32px; padding-right: 32px; }
  .hl { background: linear-gradient(90deg, #fff3b8, transparent 80%); margin: 0 -32px; padding-left: 32px; padding-right: 32px; }
  .note { grid-column: 2; margin: 6px 0 0; font: italic 400 20px/1.3 var(--display); color: var(--ink-2); }
  .pk .note { color: var(--accent); } .sk .note { color: var(--blue); }
  .link { all: unset; cursor: pointer; display: inline-flex; gap: 14px; align-items: baseline; border-bottom: 2px solid var(--accent); }
  .link .hint { font: 600 16px var(--sans); color: #fff; background: var(--accent); padding: 3px 12px; border-radius: 999px; animation: nudge 1.6s var(--ease-in-out) infinite; }
  @keyframes nudge { 50% { transform: translateX(6px); } }
  .compact { font-size: 19px; padding: 20px 26px 16px; box-shadow: 7px 7px 0 var(--ink); }
  .compact .row { grid-template-columns: 130px 1fr; padding: 7px 0; }
  .compact .pk, .compact .sk, .compact .hl { margin: 0 -26px; padding-left: 26px; padding-right: 26px; }
  footer { margin-top: 14px; }
</style>
