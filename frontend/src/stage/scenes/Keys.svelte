<script lang="ts">
  import { onMount } from 'svelte';
  import type { Session } from '../../shared/session.svelte';
  import { pixelSK } from '../../shared/ui';
  import Title from '../parts/Title.svelte';
  import { reveal } from '../motion';
  let { session, step }: { session: Session; step: number } = $props();

  // FNV-1a: a stand-in for DynamoDB's internal hash, only to show the idea.
  const fnv = (s: string) => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  const DRAWERS = 4, SHOWN = 16;
  const chips = $derived.by(() => {
    const list = session.players.slice(0, SHOWN), fill = [0, 0, 0, 0];
    return list.map((p, i) => {
      const h = fnv(p.pid), d = h % DRAWERS, slot = fill[d]++;
      return { ...p, hex: h.toString(16).padStart(8, '0').slice(0, 4), d, slot, sx: (i % 2) * 200, sy: Math.floor(i / 2) * 60, tx: 880 + d * 216 + 8, ty: 118 + slot * 54 };
    });
  });
  const extra = $derived(Math.max(0, session.players.length - SHOWN));
  let placed = $state(false);
  onMount(() => { const id = setTimeout(() => { placed = true; }, step > 0 ? 0 : 1500); return () => clearTimeout(id); });
  const teams = $derived(step >= 2);
  const orange = $derived(session.players.filter(p => p.team === 'orange').length);
  const purple = $derived(session.players.length - orange);
  const sortKeys = $derived.by(() => {
    const cells = [...session.sync.state.pixels.values()].filter(p => !p.deleted).sort((a, b) => a.x - b.x || a.y - b.y);
    const every = Math.max(1, Math.floor(cells.length / 7));
    return cells.filter((_, i) => i % every === 0).slice(0, 7).map(p => pixelSK(p.x, p.y));
  });
</script>

<div class="keys">
  <Title text="La chiave decide *dove vivi.*" size={104} />
  <p class="lead" use:reveal={{ delay: .3 }}>
    {#if step === 0}La partition key passa in una funzione di hash: il risultato sceglie il cassetto.
    {:else if step === 1}Dentro il cassetto, la sort key tiene tutto in ordine.
    {:else}Le vostre squadre le ha già decise un hash.{/if}
  </p>

  <div class="stage-area" class:dim={step === 1}>
    <p class="col-label eyebrow" style:left="0px">partition key · i vostri nomi</p>
    <div class="hash" class:spin={placed && step === 0}><span class="mono">hash( )</span></div>
    {#each Array.from({ length: DRAWERS }) as _, d (d)}
      <div class="drawer" style:left="{880 + d * 216}px">
        <span class="eyebrow">cassetto {String.fromCharCode(65 + d)}</span>
      </div>
    {/each}
    {#each chips as c, i (c.pid)}
      <span class="chip {teams ? c.team : ''}" style:transform="translate({placed ? c.tx : c.sx}px, {placed ? c.ty : c.sy + 60}px)" style:transition-delay="{placed ? i * 90 : 0}ms, {teams ? c.slot * 60 + c.d * 40 : 0}ms, 0ms">
        <b>{c.nickname}</b><i class="mono">{c.hex}</i>
      </span>
    {/each}
    {#if extra}<p class="extra mono">+ {extra} altri</p>{/if}
  </div>

  {#if step === 1}
    <div class="inside" use:reveal={{ x: 80, y: 0 }}>
      <p class="eyebrow">Cassetto <b class="pk">CANVAS#{session.meta?.sid ?? 'sessione'}</b></p>
      <ol class="mono">
        {#each sortKeys as sk, i (sk)}<li style:animation-delay="{.4 + i * .08}s"><span class="sk">{sk}</span><span class="muted">item {i + 1}</span></li>{/each}
      </ol>
      <p class="legend"><b class="pk">PK</b> = in quale cassetto · <b class="sk">SK</b> = in che ordine dentro</p>
    </div>
  {/if}
  {#if teams}
    <div class="teams" use:reveal={{ y: 20 }}>
      <span class="t orange"><b class="display">{orange}</b> arancioni</span>
      <span class="t purple"><b class="display">{purple}</b> viola</span>
      <span class="mono muted">sha256(pid) → pari o dispari</span>
    </div>
  {/if}
  <p class="disclaimer mono">Rappresentazione didattica: DynamoDB non espone le partizioni.</p>
</div>

<style>
  .keys { position: absolute; inset: 150px 88px 120px; }
  .lead { font-size: 34px; color: var(--ink-2); margin: 18px 0 0; }
  .stage-area { position: absolute; left: 0; right: 0; top: 230px; height: 560px; transition: opacity .6s; }
  .stage-area.dim { opacity: .35; }
  .col-label { position: absolute; top: 0; font-size: 15px; }
  .hash { position: absolute; left: 560px; top: 200px; width: 220px; height: 150px; border: 2px solid var(--ink); border-radius: 26px; display: grid; place-items: center; background: var(--card); font-size: 32px; }
  .hash::before, .hash::after { content: ''; position: absolute; top: 50%; height: 2px; width: 70px; background: var(--ink); }
  .hash::before { right: 100%; } .hash::after { left: 100%; }
  .hash.spin { animation: hash .5s 3 var(--ease-in-out); }
  @keyframes hash { 50% { transform: scale(1.06); background: var(--accent-soft); } }
  .drawer { position: absolute; top: 40px; width: 200px; height: 520px; border: 2px solid var(--ink); border-radius: 18px 18px 22px 22px; background: linear-gradient(var(--card), var(--paper)); padding: 18px 16px; }
  .drawer::after { content: ''; position: absolute; left: 70px; right: 70px; bottom: 18px; height: 8px; border-radius: 8px; background: var(--ink); }
  .drawer .eyebrow { font-size: 15px; }
  .chip { position: absolute; left: 0; top: 0; width: 184px; height: 50px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 16px; border-radius: 999px; background: var(--card); border: 1.5px solid var(--ink); font-size: 20px; transition: transform 1.1s var(--ease-in-out), background .5s, color .5s, border-color .5s; }
  .chip { will-change: transform; }
  .chip b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip i { font-style: normal; font-size: 14px; color: var(--muted); }
  .chip.orange { background: var(--orange); border-color: var(--orange); color: #fff; }
  .chip.purple { background: var(--purple); border-color: var(--purple); color: #fff; }
  .chip.orange i, .chip.purple i { color: #ffffffb0; }
  .extra { position: absolute; left: 0; top: 560px; font-size: 18px; color: var(--muted); margin: 0; }
  .inside { position: absolute; right: 0; top: 250px; width: 780px; background: var(--card); border: 1.5px solid var(--ink); border-radius: 26px; padding: 28px 34px; box-shadow: 10px 10px 0 var(--ink); z-index: 2; }
  .inside ol { list-style: none; padding: 0; margin: 16px 0; font-size: 26px; }
  .inside li { display: flex; justify-content: space-between; padding: 9px 0; border-top: 1px solid var(--line); animation: fade-up .6s var(--ease-out) both; }
  .inside .eyebrow { font-size: 16px; }
  .pk { color: var(--accent); } .sk { color: var(--blue); }
  .legend { font-size: 22px; margin: 0; }
  .teams { position: absolute; left: 0; top: 330px; display: flex; flex-direction: column; gap: 6px; font-size: 30px; }
  .t b { font-size: 64px; font-weight: 500; margin-right: 8px; }
  .t.orange { color: var(--orange); } .t.purple { color: var(--purple); }
  .teams .mono { font-size: 18px; }
  .disclaimer { position: absolute; right: 0; bottom: -40px; font-size: 16px; color: var(--muted); margin: 0; }
</style>
