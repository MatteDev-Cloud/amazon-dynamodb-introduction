<script lang="ts">
  import { onMount } from 'svelte';
  import type { AwsUsageResponse, StatsResponse } from '../../../../shared/types.js';
  import { audienceShare, presenterShare } from '../../../../shared/pricing.js';
  import { config } from '../../shared/config';
  import type { Session } from '../../shared/session.svelte';
  import { clock, isBot, number, usd } from '../../shared/ui';
  import Title from '../parts/Title.svelte';
  import Count from '../parts/Count.svelte';
  import { reveal } from '../motion';
  let { session, step }: { session: Session; step: number } = $props();
  /**
   * A receipt is printed once. LIM, regia and phones keep polling while it is on screen, so live numbers
   * would keep climbing under the speaker — by millions per second at ×1.000.000. Leaving the scene and
   * coming back prints a new one.
   */
  let s = $state<StatsResponse>();
  $effect(() => { if (!s && session.stats) s = session.stats; });
  /**
   * Two payers. What the phones did grows with the room and is what the projection multiplies; one LIM
   * and one regia stay one LIM and one regia, so their share is added once, whatever the multiplier.
   * `crew` is null for a session without the split: the receipt then falls back to a single block.
   */
  const room = $derived(s && audienceShare(s));
  const crew = $derived(s ? presenterShare(s) : null);
  const k = $derived([1, 1000, 1_000_000][step] ?? 1);
  const grandTotal = $derived(!room || room.estimatedCost === null || crew?.estimatedCost === null ? null : room.estimatedCost * k + (crew?.estimatedCost ?? 0));
  // The swarm joined as ordinary players: it is not «persone in sala».
  const inRoom = $derived(session.players.filter(p => !isBot(p.nickname)).length);
  const people = $derived(Math.max(1, inRoom) * k);

  /**
   * The same quantities read back from AWS (CloudWatch) instead of from our own counters: the receipt is
   * measured capacity × published price, and this is the audit of the first half of that multiplication.
   * Deliberately soft: one fetch when the scene opens, a refresh every 20 s, and nothing on screen if AWS
   * does not answer. It is a check, never a dependency of the slide.
   */
  let aws = $state<AwsUsageResponse>();
  const total = (units: Record<string, number> | undefined) => Object.values(units ?? {}).reduce((sum, v) => sum + v, 0);
  const awsLines = $derived.by(() => {
    const u = aws?.usage; if (!u) return [];
    return [
      { label: 'Scritture tabella · WRU', value: u.wruTable, digits: 0 },
      ...Object.entries(u.wruGsi).map(([name, value]) => ({ label: `Scritture GSI ${name}`, value, digits: 0 })),
      { label: 'Letture · RRU', value: u.rruTable + total(u.rruGsi), digits: 0 },
      { label: 'Richieste HTTP API', value: u.apiRequests, digits: 0 },
      { label: 'Calcolo Lambda · s', value: u.lambdaMs / 1000, digits: 1 },
    ];
  });
  async function checkAws() {
    if (config.mock || config.static || !session.admin) return;
    try { aws = await session.api.call<AwsUsageResponse>('/admin/aws'); } catch { /* the slide stands on its own */ }
  }
  onMount(() => { void checkAws(); const id = setInterval(checkAws, 20000); return () => clearInterval(id); });
  const lines = $derived(room ? [
    { label: 'Richieste API', value: room.apiCalls },
    { label: 'Scritture tabella · WRU', value: room.wruTable, digits: 1 },
    { label: 'Scritture GSI · WRU', value: room.wruGsi, digits: 1, hot: true },
    { label: 'Letture · RRU', value: room.rruTable + room.rruGsi, digits: 1 },
    { label: 'Calcolo Lambda · s', value: room.lambdaMs / 1000, digits: 1 },
  ] : []);
  const printedAt = clock(Date.now());
</script>

<div class="cost">
  <div class="copy">
    <Title text="Cosa è appena *successo.*" size={104} />
    {#key step}
      <p class="lead" use:reveal={{ delay: .15 }}>
        {#if step === 0}Tutto quello che avete fatto finora, a prezzo di listino.
        {:else if step === 1}E se fossimo <b>mille</b> volte tanti?
        {:else}Un <b>milione</b> di volte. Stessa tabella, stessa API.{/if}
      </p>
    {/key}
    <div class="people">
      <p class="big display"><Count value={people} /></p>
      <p class="muted">{k === 1 ? 'persone in sala' : 'persone simulate'}</p>
      {#if step === 0}
        <div class="dots small">{#each Array.from({ length: Math.min(200, inRoom) }) as _, i (i)}<i style:animation-delay="{i * 12}ms"></i>{/each}</div>
      {:else if step === 1}
        <div class="dots">{#each Array.from({ length: 1000 }) as _, i (i)}<i style:animation-delay="{(i % 50) * 14 + Math.floor(i / 50) * 20}ms"></i>{/each}</div>
      {:else}
        <!-- Fonte: blog AWS, APPROFONDIMENTO.md nota [19]. Da riverificare prima di ogni talk (checklist). -->
        <p class="prime display" use:reveal={{ delay: .4 }}>Prime Day 2025: <b>151 milioni</b> di richieste al secondo.</p>
        <p class="muted small-note" use:reveal={{ delay: .6 }}>Dato pubblicato da AWS per quell’evento, non la capacità dimostrata dalla nostra tabella. E a quella scala il nostro contatore unico non reggerebbe: è l’<b>hot key</b> di poco fa.</p>
      {/if}
    </div>
    <!-- Beside the receipt, not under it: with two payers the receipt fills the column. -->
    {#if step === 0 && aws?.available && aws.usage}
      <div class="verify mono" use:reveal={{ delay: .6, y: 30 }}>
        <p class="vhead">Il totale, letto da AWS</p>
        {#each awsLines as line (line.label)}
          <p class="vline"><span>{line.label}</span><b>{number(line.value, line.digits)}</b></p>
        {/each}
        <p class="vline vtotal"><span>TOTALE SECONDO AWS</span><b>{aws.estimatedCost == null ? 'n/d' : usd(aws.estimatedCost)}</b></p>
        <p class="vfine">
          CloudWatch · ritardo {aws.usage.staleMs === null ? 'n/d' : `~${Math.round(aws.usage.staleMs / 1000)} s`}.
          Misura la tabella e la funzione, non la singola sessione: telefoni, LIM e regia insieme.
        </p>
      </div>
    {/if}
  </div>

  <div class="receipt-wrap" use:reveal={{ delay: .2, y: -120 }}>
    <div class="receipt mono">
      <p class="center strong">DYNAMOLIVE</p>
      <p class="center">scontrino · sessione {session.meta?.sid ?? config.sid}</p>
      <p class="center">{printedAt}{k > 1 ? ` · proiezione ×${number(k)}` : ''}</p>
      <hr />
      {#if !s}
        <p>Misure non disponibili.</p>
      {:else}
        {#if crew}<p class="payer">Voi · i telefoni{k > 1 ? ` · ×${number(k)}` : ''}</p>{/if}
        {#each lines as line, i (line.label)}
          <p class="line" class:hot={line.hot && step === 0} style:animation-delay="{.6 + i * .18}s"><span>{line.label}</span><b><Count value={line.value * k} digits={line.digits ?? 0} /></b></p>
        {/each}
        {#if crew && room}
          <p class="line sub" style:animation-delay="{.6 + lines.length * .18}s"><span>Subtotale</span><b>{#if room.estimatedCost === null}n/d{:else}<Count value={room.estimatedCost * k} format={v => usd(v, k >= 1000 ? 2 : 4)} />{/if}</b></p>
          <hr />
          <p class="payer">LIM e regia · sempre una{k > 1 ? ' · ×1' : ''}</p>
          <p class="line" style:animation-delay="{.6 + (lines.length + 1) * .18}s"><span>{number(crew.apiCalls)} richieste</span><b>{crew.estimatedCost === null ? 'n/d' : usd(crew.estimatedCost)}</b></p>
        {/if}
        <hr />
        <p class="total" style:animation-delay="{.6 + (lines.length + 2) * .18}s">
          <span>TOTALE STIMATO</span>
          <b>{#if grandTotal === null}n/d{:else}<Count value={grandTotal} format={v => usd(v, k >= 1000 ? 2 : 4)} />{/if}</b>
        </p>
        {#if step === 0}<p class="gsi-note">↑ ogni GSI moltiplica le scritture</p>{/if}
        <hr />
        <p class="fine">{config.mock || config.static ? 'DATI SIMULATI' : 'Capacità misurata dall’app × listino on-demand'} · {s.prices.region}. Prima di crediti e imposte; hosting, storage e log esclusi. {k > 1 ? `Proiezione a listino, non un test di carico${crew ? ': si moltiplica la sala, non la regia' : ''}.` : ''}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .cost { position: absolute; inset: 150px 88px 120px; display: grid; grid-template-columns: 1fr 620px; gap: 80px; }
  .lead { font-size: 36px; color: var(--ink-2); margin: 24px 0 0; }
  .lead b { color: var(--accent); }
  .people { margin-top: 40px; }
  .big { font-size: 150px; line-height: 1; margin: 0; font-weight: 400; color: var(--ink); letter-spacing: -.03em; }
  .people > .muted { font-size: 26px; margin: 6px 0 24px; }
  .dots { display: grid; grid-template-columns: repeat(50, 1fr); gap: 5px; max-width: 900px; }
  .dots.small { grid-template-columns: repeat(25, 1fr); max-width: 560px; gap: 8px; }
  .dots i { aspect-ratio: 1; border-radius: 50%; background: var(--accent); animation: pop .4s var(--ease-out) both; }
  @keyframes pop { from { transform: scale(0); opacity: 0; } }
  .prime { font-size: 50px; line-height: 1.2; margin: 10px 0 0; font-weight: 400; max-width: 1000px; }
  .prime b { color: var(--accent); font-weight: 500; }
  .small-note { font-size: 22px; }
  .receipt-wrap { align-self: start; filter: drop-shadow(0 30px 40px #1a223830); }
  .receipt { background: #FFFEFA; padding: 36px 36px 50px; font-size: 20px; transform: rotate(-1.5deg);
    -webkit-mask: radial-gradient(12px at 50% 100%, #0000 98%, #000) 50% 100% / 24px 100% repeat-x; mask: radial-gradient(12px at 50% 100%, #0000 98%, #000) 50% 100% / 24px 100% repeat-x; }
  .receipt p { margin: 6px 0; }
  .center { text-align: center; color: var(--muted); font-size: 18px; }
  .strong { color: var(--ink); font-weight: 800; font-size: 28px; letter-spacing: .2em; }
  hr { border: 0; border-top: 2px dashed var(--line-2); margin: 18px 0; }
  .line, .total { display: flex; justify-content: space-between; gap: 20px; animation: fade-up .5s var(--ease-out) both; }
  .line span { color: var(--ink-2); }
  .line.sub { font-weight: 800; margin-top: 10px; }
  .payer { font-size: 15px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .line.hot { background: var(--accent-soft); margin: 0 -14px; padding: 4px 14px; border-radius: 6px; }
  .total { font-size: 30px; font-weight: 800; }
  .total b { color: var(--accent); }
  .gsi-note { font-size: 18px; color: var(--accent); margin-top: 10px !important; }
  .verify { margin-top: 40px; max-width: 620px;background: var(--card); border: 1.5px solid var(--blue); border-radius: 18px; padding: 18px 22px; font-size: 17px; }
  .vhead { margin: 0 0 10px; color: var(--blue); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; font-size: 14px; }
  .vline { display: flex; justify-content: space-between; gap: 18px; margin: 5px 0; }
  .vline span { color: var(--ink-2); }
  .vtotal { margin-top: 10px; padding-top: 10px; border-top: 2px dashed var(--line-2); font-weight: 800; font-size: 21px; }
  .vtotal b { color: var(--blue); }
  .vfine { font-size: 13px; color: var(--muted); margin: 10px 0 0; line-height: 1.45; }
  .fine { font-size: 15px; color: var(--muted); line-height: 1.5; }
</style>
