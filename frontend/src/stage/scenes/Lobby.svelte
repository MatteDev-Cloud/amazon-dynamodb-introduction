<script lang="ts">
  import { scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { playUrl } from '../../shared/config';
  import type { Session } from '../../shared/session.svelte';
  import Title from '../parts/Title.svelte';
  import Count from '../parts/Count.svelte';
  import Qr from '../parts/Qr.svelte';
  import { reveal } from '../motion';
  let { session }: { session: Session } = $props();
  const url = playUrl();
  const short = url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
  const players = $derived(session.players);
</script>

<div class="lobby">
  <div class="left">
    <Title text="Tirate fuori il *telefono.*" size={132} />
    <p class="lead" use:reveal={{ delay: .3 }}>Inquadrate il QR e sceglietevi un nome.<br />Vi spieghiamo dopo cosa avete fatto.</p>
    <div class="count" use:reveal={{ delay: .5 }}>
      <strong class="display"><Count value={players.length} /></strong>
      <div>
        <p>{players.length === 1 ? 'persona è' : 'persone sono'} già nel database</p>
        <p class="mono muted">= {players.length} item <b>PLAYER#</b> nella stessa tabella</p>
      </div>
    </div>
  </div>
  <div class="qr-card" use:reveal={{ delay: .15, y: 60 }}>
    <Qr {url} size={440} />
    <p class="mono url">{short}</p>
  </div>
  <div class="names">
    {#each players.slice(-42) as p (p.pid)}
      <span class="name" in:scale={{ start: .4, duration: 600, easing: backOut }}>{p.nickname}</span>
    {/each}
  </div>
</div>

<style>
  .lobby { position: absolute; inset: 150px 88px 120px; display: grid; grid-template-columns: 1fr 560px; grid-template-rows: 1fr auto; gap: 40px 80px; }
  .left { align-self: center; }
  .lead { font-size: 34px; line-height: 1.35; color: var(--ink-2); margin: 36px 0 48px; max-width: 900px; }
  .count { display: flex; align-items: center; gap: 28px; }
  .count strong { font-size: 150px; line-height: .9; font-weight: 400; color: var(--accent); min-width: 1.2ch; }
  .count p { margin: 4px 0; font-size: 30px; }
  .count .mono { font-size: 20px; }
  .qr-card { align-self: center; background: var(--card); border: 1.5px solid var(--ink); border-radius: 36px; padding: 44px 44px 30px; display: grid; justify-items: center; gap: 18px; box-shadow: 14px 14px 0 var(--ink); transform: rotate(1.2deg); }
  .url { font-size: 22px; margin: 0; color: var(--ink-2); }
  .names { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 12px; align-content: flex-end; min-height: 120px; max-height: 190px; overflow: hidden; }
  .name { font-size: 24px; padding: 8px 20px; border-radius: 999px; background: var(--card); border: 1.5px solid var(--line-2); }
  .name:last-child { border-color: var(--accent); color: var(--accent); }
</style>
