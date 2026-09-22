<script lang="ts">
  import QRCode from 'qrcode';
  let { url, size = 420 }: { url: string; size?: number } = $props();
  let canvas: HTMLCanvasElement;
  // The library writes its own inline size: render at 2× for sharpness, then restore the display size.
  $effect(() => { void QRCode.toCanvas(canvas, url, { width: size * 2, margin: 1, color: { dark: '#1A2238', light: '#FBF8F2' }, errorCorrectionLevel: 'M' }).then(() => { canvas.style.width = canvas.style.height = `${size}px`; }); });
</script>

<canvas bind:this={canvas} style:width="{size}px" style:height="{size}px" aria-label="QR: {url}"></canvas>
