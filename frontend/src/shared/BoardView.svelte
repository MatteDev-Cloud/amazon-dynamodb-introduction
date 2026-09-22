<script lang="ts">
  import { onMount } from 'svelte';
  import { Board } from './board';
  import type { CanvasSync } from './sync';
  let { sync, hidden = false, glow = false, marked, onpick, board = $bindable(), label = 'Pixel Wall' }: {
    sync: CanvasSync; hidden?: boolean; glow?: boolean; marked?: Set<string>;
    onpick?: (x: number, y: number, event: PointerEvent) => void; board?: Board; label?: string;
  } = $props();
  let canvas: HTMLCanvasElement;
  onMount(() => {
    const b = new Board(canvas, { glow });
    board = b;
    b.update(sync.state.pixels);
    const off = sync.subscribe(fresh => b.update(sync.state.pixels, fresh));
    return () => { off(); b.destroy(); };
  });
  $effect(() => { if (board) { board.hidden = hidden; board.draw(); } });
  $effect(() => { if (board && marked) { board.marked = marked; board.draw(); } });
  function up(e: PointerEvent) {
    if (!onpick || !board) return;
    const cell = board.cellAt(e.clientX, e.clientY);
    if (cell) onpick(cell.x, cell.y, e);
  }
</script>

<canvas bind:this={canvas} class="board" class:pick={!!onpick} aria-label={label} onpointerup={up}></canvas>

<style>
  .board { display: block; width: 100%; height: 100%; touch-action: manipulation; }
  .pick { cursor: pointer; }
</style>
