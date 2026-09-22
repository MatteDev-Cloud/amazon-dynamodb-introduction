<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Session } from '../../shared/session.svelte';
  import { number } from '../../shared/ui';
  import Title from '../parts/Title.svelte';
  import Count from '../parts/Count.svelte';
  import { reveal } from '../motion';
  let { session }: { session: Session } = $props();

  const stats = $derived(session.stats);
  let rate = $state(0);
  let packets = $state<{ id: number }[]>([]);
  let last: { calls: number; at: number } | undefined;
  $effect(() => {
    const s = stats; if (!s) return;
    untrack(() => {
      const now = performance.now();
      if (last && now - last.at > 500) rate = rate * .5 + Math.max(0, (s.apiCalls - last.calls) / ((now - last.at) / 1000)) * .5;
      if (!last || now - last.at > 500) last = { calls: s.apiCalls, at: now };
    });
  });
  onMount(() => {
    let id = 0, timer: ReturnType<typeof setTimeout>;
    // Dots follow the real request rate (capped), with a slow idle heartbeat so the path stays readable.
    const spawn = () => { packets = [...packets.slice(-40), { id: id++ }]; timer = setTimeout(spawn, 1000 / Math.min(14, Math.max(.8, rate))); };
    timer = setTimeout(spawn, 900);
    return () => clearTimeout(timer);
  });
  const nodes = $derived([
    { name: 'Telefono', sub: 'il vostro browser', value: session.players.length, unit: 'giocatori' },
    { name: 'HTTP API', sub: 'API Gateway', value: stats?.apiCalls ?? 0, unit: 'richieste' },
    { name: 'Funzione', sub: 'AWS Lambda', value: (stats?.lambdaMs ?? 0) / 1000, unit: 's di calcolo', digits: 1 },
    { name: 'Tabella', sub: 'DynamoDB', value: (stats?.wruTable ?? 0) + (stats?.wruGsi ?? 0) + (stats?.rruTable ?? 0) + (stats?.rruGsi ?? 0), unit: 'unità lette/scritte', digits: 1 },
  ]);
</script>

<div class="arch">
  <Title text="Zero server *(nostri).*" size={120} />
  <p class="lead" use:reveal={{ delay: .3 }}>Nessuna macchina accesa ad aspettarvi. Ogni pallino è una vostra richiesta, pagata una per una.</p>
  <div class="flow">
    <div class="track" aria-hidden="true">
      {#each packets as p (p.id)}<i class="packet" onanimationend={() => { packets = packets.filter(v => v.id !== p.id); }}></i>{/each}
    </div>
    {#each nodes as n, i (n.name)}
      <div class="node" use:reveal={{ delay: .4 + i * .15, y: 40 }}>
        <div class="icon" class:db={i === 3}>{#if i === 0}<span class="phone"></span>{:else if i === 3}<span class="cyl"></span>{:else}<span class="mono">{i === 1 ? '/api' : 'λ'}</span>{/if}</div>
        <p class="name display">{n.name}</p>
        <p class="sub mono">{n.sub}</p>
        <p class="val"><b class="mono"><Count value={n.value} digits={n.digits ?? 0} /></b> {n.unit}</p>
      </div>
    {/each}
  </div>
  <div class="bottom" use:reveal={{ delay: 1 }}>
    <p class="rate mono"><b>{number(rate, 1)}</b> richieste/s adesso</p>
    <p class="bridge display">La tela era collaborazione: tante chiavi diverse. Ora l’opposto: <em>tutti contro tutti, sugli stessi contatori.</em></p>
  </div>
</div>

<style>
  .arch { position: absolute; inset: 150px 88px 120px; }
  .lead { font-size: 34px; color: var(--ink-2); margin: 20px 0 0; }
  .flow { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 40px; margin-top: 90px; }
  .track { position: absolute; left: 12.5%; right: 12.5%; top: 88px; height: 3px; background: var(--line-2); }
  .packet { position: absolute; top: -8px; left: 0; width: 19px; height: 19px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 25%, transparent); animation: travel 2.2s var(--ease-in-out) forwards; }
  @keyframes travel { from { left: 0; opacity: 0; } 8% { opacity: 1; } 92% { opacity: 1; } to { left: calc(100% - 19px); opacity: 0; } }
  .node { display: grid; justify-items: center; text-align: center; position: relative; }
  .icon { width: 180px; height: 180px; border-radius: 40px; border: 2px solid var(--ink); background: var(--card); display: grid; place-items: center; font-size: 48px; position: relative; z-index: 1; }
  .icon.db { border-color: var(--blue); background: var(--blue-soft); }
  .phone { width: 62px; height: 104px; border: 5px solid var(--ink); border-radius: 14px; }
  .cyl { width: 84px; height: 96px; border: 5px solid var(--blue); border-radius: 50% / 18%; background: repeating-linear-gradient(transparent 0 26px, var(--blue) 26px 31px); }
  .name { font-size: 48px; margin: 26px 0 0; font-weight: 500; }
  .sub { font-size: 20px; color: var(--muted); margin: 6px 0 16px; }
  .val { font-size: 22px; color: var(--ink-2); margin: 0; }
  .val b { font-size: 34px; color: var(--ink); display: block; }
  .bottom { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; align-items: end; gap: 60px; }
  .rate { font-size: 24px; margin: 0; } .rate b { font-size: 52px; color: var(--accent); }
  .bridge { font-size: 36px; line-height: 1.25; margin: 0; max-width: 1100px; font-weight: 400; text-align: right; }
  .bridge em { color: var(--accent); }
</style>
