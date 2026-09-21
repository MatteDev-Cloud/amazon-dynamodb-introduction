import type { LeaderboardResponse, StatsResponse } from '../../../shared/types.js';
import { Api } from '../shared/api';
import { config } from '../shared/config';
import { button, el, json } from '../shared/ui';
export class Meter {
  node=el('aside','meter'); expanded=false; multiplier=1;
  update(stats?:StatsResponse){
    if(!this.expanded)this.multiplier=1;
    this.node.classList.toggle('expanded',this.expanded);this.node.replaceChildren(el('p','eyebrow',config.mock||config.static?'DATI SIMULATI':'STIMA · LISTINO ON-DEMAND'));
    if(!stats){this.node.append(el('p','muted','Misure non disponibili'));return;}
    const cost=stats.estimatedCost===null?'Non verificato':new Intl.NumberFormat('it-IT',{style:'currency',currency:'USD',minimumFractionDigits:4,maximumFractionDigits:4}).format(stats.estimatedCost*this.multiplier);
    this.node.append(el('div','cost',cost));
    const rows=[['Richieste',stats.apiCalls],['Scritture · WRU',stats.wruTable+stats.wruGsi],['di cui GSI',stats.wruGsi],['Letture · RRU',stats.rruTable+stats.rruGsi]] as const;
    rows.forEach(([label,value])=>{const row=el('div','meter-row');row.append(el('span','',label),el('span','mono',(value*this.multiplier).toLocaleString('it-IT',{maximumFractionDigits:1})));this.node.append(row);});
    this.node.append(el('p','muted','Stima parziale, prima di crediti e imposte. Hosting, storage e log esclusi.'));
    if(this.expanded){const controls=el('div','controls');[1,1000,1000000].forEach(n=>controls.append(button(`×${n.toLocaleString('it-IT')}`,()=>{this.multiplier=n;this.update(stats);},n===this.multiplier?'active':'')));this.node.append(controls,el('p','projection-label','Proiezione a listino, non un test di carico.'));
      if(this.multiplier>1){const dots=el('div','projection-dots');dots.setAttribute('aria-label','Partecipanti simulati, nessuna scrittura aggiuntiva');for(let i=0;i<120;i++)dots.append(el('i'));this.node.append(dots);}
      this.node.append(el('p','muted',`${stats.prices.region} · listino verificato: ${stats.prices.verifiedAt||'non disponibile'} · Local/DEV: equivalente on-demand`));
    }
  }
}
export class Inspector {
  node=el('aside','inspector');visible=false;feed:string[]=[];
  update(api:Api){this.node.hidden=!this.visible;if(!this.visible)return;this.node.replaceChildren(el('p','eyebrow','INSPECTOR · NON È AWS X-RAY'));
    const item=api.inspect;if(!item){this.node.append(el('p','','In attesa di misure API reali.'));return;}
    const details=item.details;this.node.append(el('h3','',item.path),el('p','mono',`DynamoDB ${details.ddbMs.toFixed(1)} ms · resto ${Math.max(0,item.totalMs-details.ddbMs).toFixed(1)} ms`));
    const bar=el('div','latency');const part=el('i');part.style.width=`${Math.min(100,details.ddbMs/Math.max(1,item.totalMs)*100)}%`;bar.append(part);this.node.append(bar,el('h4','','Operazioni e capacità'),json(details.operations.length?details.operations:details),el('h4','','Risposta · estratto'),json(limit(item.data)),el('h4','','Feed ricostruito dalle letture'),...this.feed.slice(-5).map(v=>el('p','mono',v)));
  }
}
function limit(data:any){const copy={...data};for(const key of Object.keys(copy))if(Array.isArray(copy[key]))copy[key]=copy[key].slice(0,3);return copy;}
export class Leaderboard {
  node=el('div','leaderboard'); previousScores=new Map<string,number>(); onchanges?: (changes:string[])=>void;
  update(data:LeaderboardResponse){const old=new Map([...this.node.children].map(n=>[(n as HTMLElement).dataset.key,n.getBoundingClientRect()]));
    this.node.replaceChildren(el('p','eyebrow',data.provisional?'CLASSIFICA PROVVISORIA':'RISULTATO CONSOLIDATO'));
    const max=Math.max(1,...data.top.map(p=>p.score));const occurrences=new Map<string,number>(),changes:string[]=[];data.top.forEach((p)=>{const row=el('div',`leader ${p.team}`);const base=`${p.nickname}:${p.team}`,occurrence=occurrences.get(base)||0;occurrences.set(base,occurrence+1);row.dataset.key=`${base}:${occurrence}`;const previous=this.previousScores.get(row.dataset.key);if(previous!==undefined&&previous!==p.score)changes.push(`${p.nickname}: ${previous} → ${p.score}`);this.previousScores.set(row.dataset.key,p.score);row.style.setProperty('--score',`${p.score/max*100}%`);row.append(el('span','rank',String(p.rank)),el('span','',p.nickname),el('strong','mono',String(p.score)));this.node.append(row);
      const before=old.get(row.dataset.key);if(before&&!matchMedia('(prefers-reduced-motion: reduce)').matches)row.animate([{transform:`translateY(${before.top-row.getBoundingClientRect().top}px)`},{transform:'translateY(0)'}],{duration:300});});
    this.onchanges?.(changes);if(!data.top.length)this.node.append(el('p','muted','I primi tap appariranno qui.'));
  }
}
