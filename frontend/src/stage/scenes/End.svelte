<script lang="ts">
  import BoardView from '../../shared/BoardView.svelte';
  import type { Board } from '../../shared/board';
  import { config } from '../../shared/config';
  import type { Session } from '../../shared/session.svelte';
  import { ttlTime } from '../../shared/ui';
  import Title from '../parts/Title.svelte';
  import Qr from '../parts/Qr.svelte';
  import { reveal } from '../motion';
  let { session }: { session: Session } = $props();
  let board = $state<Board>();
  const meta = $derived(session.meta);
  /**
   * The canvas has its own TTL, separate from the session's. Reaching this scene is what shortens it
   * (see the `end` transition in the backend), so the clock below really is counting the items out and
   * the dots really do stop coming back from the database, one second at a time.
   */
  const ttlMs = $derived(meta ? meta.canvasExpiresAt * 1000 - session.now : 0);
  const expired = $derived(!!meta && meta.canvasExpiresAt > 0 && ttlMs <= 0);
  const dissolving = $derived(!!meta && !expired && ttlMs < meta.endTtlMs + 5000);
  const left = $derived(session.lit);
  const docUrl = new URL(config.document, import.meta.env.VITE_PUBLIC_ORIGIN || location.origin).href;
  $effect(() => { if (board) { const id = setTimeout(() => board?.shimmer(), 1200); return () => clearTimeout(id); } });
</script>

<div class="end">
  <div class="left">
    <Title text="Il ricordo resta. *I dati scadono.*" size={96} />
    <div class="ttl" use:reveal={{ delay: .5 }}>
      <p class="eyebrow">{expired ? 'La tela è scaduta' : 'Questa tela si cancella da sola tra'}</p>
      <p class="clock mono" class:soon={dissolving}>{config.static ? '00:01:00' : expired ? '00:00:00' : meta ? ttlTime(ttlMs) : '—'}</p>
      {#if dissolving && !expired}
        <p class="alive mono">{left} item ancora vivi · ognuno ha il suo <b>expiresAt</b></p>
      {/if}
      <p class="muted">Attributo <b class="mono">expiresAt</b> · TTL. Nessuna riga di codice per cancellarla: ogni item porta la sua scadenza. La rimozione fisica da parte di AWS è asincrona e gratuita; chi legge — questa pagina e il backend — ignora già gli item scaduti. È quello che state vedendo.</p>
    </div>
    <div class="doc" use:reveal={{ delay: .8 }}>
      <Qr url={docUrl} size={170} />
      <div><p class="display">Portate a casa DynamoDB.</p><p class="muted mono">Documento di approfondimento</p></div>
    </div>
  </div>
  <div class="frame" use:reveal={{ delay: .2, y: 40 }}>
    <!--
      Never `hidden` because it expired: that would print «Tela temporaneamente nascosta» over the last
      slide. An expired canvas has no items left, so the board draws its own empty matrix — which is
      exactly the point being made.
    -->
    <BoardView sync={session.sync} hidden={!!meta?.canvasHidden} glow bind:board label={expired ? 'La tela, scaduta' : 'La tela finale'} />
    <p class="thanks display">Grazie.</p>
  </div>
</div>

<style>
  .end { position: absolute; inset: 150px 88px 120px; display: grid; grid-template-columns: 820px 1fr; gap: 70px; }
  .ttl { margin-top: 40px; }
  .ttl .eyebrow { font-size: 18px; }
  .clock { font-size: 120px; letter-spacing: -.04em; margin: 6px 0 10px; color: var(--accent); line-height: 1; transition: color .6s; }
  .clock.soon { color: var(--red); }
  .alive { font-size: 24px; margin: 0 0 10px; color: var(--ink-2); }
  .ttl .muted { font-size: 22px; line-height: 1.45; max-width: 760px; }
  .doc { display: flex; gap: 28px; align-items: center; margin-top: 36px; }
  .doc .display { font-size: 38px; margin: 0; font-weight: 500; }
  .doc .mono { font-size: 18px; margin: 6px 0 0; }
  .frame { align-self: center; aspect-ratio: 16 / 9; background: var(--board); border-radius: 30px; padding: 18px; position: relative; box-shadow: 0 40px 80px -40px #0e101699; }
  .thanks { position: absolute; right: 10px; bottom: -86px; margin: 0; font-size: 64px; font-style: italic; color: var(--ink); }
</style>
