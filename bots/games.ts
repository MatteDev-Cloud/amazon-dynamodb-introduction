import { BotClient, ApiFailure, sleep } from './client.js';
import type { JoinResponse, Meta } from '../shared/types.js';
export class BotGroup {
  private players:JoinResponse[]=[];
  private pixelAt=new Map<string,number>();
  private seq=new Map<string,number>();
  private lastTapAt=0;
  private counter=0;
  constructor(private client:BotClient,private count:number,private mode:'pixel'|'hotkey'|'both'='both'){}
  async step(meta:Meta) {
    if(['lobby','pixel'].includes(meta.phase)) while(this.players.length<this.count) {
      try {this.players.push(await this.client.join(`bot${String(this.players.length+1).padStart(3,'0')}`));}
      catch(e){if(e instanceof ApiFailure && e.status===409)return;throw e;}
    }
    if(meta.phase==='pixel' && this.mode!=='hotkey') {
      for(const p of this.players) if(Date.now()-(this.pixelAt.get(p.pid)??0)>=meta.cooldownMs) {
        const position=this.counter++%(meta.canvasW*meta.canvasH), x=position%meta.canvasW,y=Math.floor(position/meta.canvasW);
        try{await this.client.request('/pixel',{pid:p.pid,x,y,c:(Math.floor(x/4)+Math.floor(y/3))%8});this.pixelAt.set(p.pid,Date.now());}
        catch(e){if(!(e instanceof ApiFailure)||![409,429,503].includes(e.status))throw e;this.pixelAt.set(p.pid,Date.now());}
      }
    }
    if(meta.phase==='hotkey_running' && meta.roundId && this.mode!=='pixel' && Date.now()-this.lastTapAt>=500) {
      this.lastTapAt=Date.now();
      // Bounded workers avoid an artificial burst against the shared STATS item.
      for(let offset=0;offset<this.players.length;offset+=4) await Promise.all(this.players.slice(offset,offset+4).map(async p=>{
        const seq=(this.seq.get(p.pid)??0)+1;
        try{await this.client.tap({pid:p.pid,seq,delta:2+Math.floor(Math.random()*4),roundId:meta.roundId!});this.seq.set(p.pid,seq);}
        catch(e){if(e instanceof ApiFailure && e.status===409)return;throw e;}
      }));
    }
  }
}
export async function runBots(api:string,sid:string,count:number,mode:'pixel'|'hotkey'|'both',controlled=false,adminKey?:string,signal?:AbortSignal) {
  const client=new BotClient(api,sid,signal),group=new BotGroup(client,count,mode);
  console.log(`Simulated players: ${count}; session: ${sid}; mode: ${mode}${controlled?' (controlled by stage)':''}`);
  while(!signal?.aborted) {
    const meta=await client.meta();
    if(meta.phase==='end')break;
    if(!controlled||meta.botsEnabled)await group.step(meta);
    await sleep(500,signal);
  }
}
