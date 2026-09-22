<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { number } from '../../shared/ui';
  /** Number that rolls to its new value. */
  let { value, digits = 0, format }: { value: number; digits?: number; format?: (n: number) => string } = $props();
  const tween = new Tween(0, { duration: 900, easing: cubicOut });
  $effect(() => { tween.target = value; });
</script>

<span class="count">{format ? format(tween.current) : number(tween.current, digits)}</span>

<style>.count { font-variant-numeric: tabular-nums; }</style>
