<script lang="ts">
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import { reducedMotion } from '../../shared/ui';
  /** Big serif title; words rise in one after another. Words wrapped in *asterisks* become italic accent. */
  let { text, size = 112, delay = 0 }: { text: string; size?: number; delay?: number } = $props();
  // *…* may span several words: track whether we are inside the emphasis.
  const words = $derived.by(() => {
    let inside = false;
    return text.split(' ').map(w => { const em = inside || w.startsWith('*'); inside = em && !w.endsWith('*'); return { w: w.replace(/\*/g, ''), em }; });
  });
  let node: HTMLElement;
  onMount(() => {
    if (reducedMotion()) return;
    const t = gsap.from(node.querySelectorAll('.w > span'), { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: .06, delay: .2 + delay });
    return () => t.kill();
  });
</script>

<h1 class="display" bind:this={node} style:font-size="{size}px">
  {#each words as word, i (i)}<span class="w"><span class:em={word.em}>{word.w}</span></span>{' '}{/each}
</h1>

<style>
  h1 { margin: 0; font-weight: 500; line-height: 1.02; letter-spacing: -.035em; font-variation-settings: 'SOFT' 30, 'WONK' 0; color: var(--ink); }
  .w { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: .08em; margin-bottom: -.08em; }
  .w > span { display: inline-block; }
  .em { font-style: italic; color: var(--accent); font-weight: 400; }
</style>
