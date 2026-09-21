import type { TapRequest, TapResponse } from '../../../shared/types.ts';
export interface QueueState { pending: TapRequest | null; queued: number; seq: number; roundId: string }
export class TapQueue {
  busy=false; retryAt=0; attempts=0; score=0; error=''; stopped=false;
  constructor(public pid:string,public state:QueueState,private send:(batch:TapRequest)=>Promise<TapResponse>,private persist:(state:QueueState)=>void,private now:()=>number){}
  tap(){if(!this.stopped && this.state.queued<12){this.state.queued++;this.persist(this.state);return true;}return false;}
  async flush(deadline:number){
    if(this.busy || this.stopped || this.now()<this.retryAt)return;
    if(this.now()>deadline){if(this.state.pending||this.state.queued)this.error='Batch non confermati entro la grace: controlla il risultato finale.';this.state.pending=null;this.state.queued=0;this.persist(this.state);this.stopped=true;return;}
    if(!this.state.pending && this.state.queued){this.state.pending={pid:this.pid,roundId:this.state.roundId,seq:this.state.seq+1,delta:Math.min(12,this.state.queued)};this.state.queued-=this.state.pending.delta;this.persist(this.state);}
    if(!this.state.pending)return;
    this.busy=true;
    try {
      const result=await this.send({...this.state.pending});
      this.state.seq=result.acceptedSeq;this.score=result.score;this.state.pending=null;this.attempts=0;this.error='';this.persist(this.state);
    }catch(e){
      const failure=e as {status?:number;retryInMs?:number;message?:string};
      this.error=failure.message||'Rete assente: batch conservato';
      if([400,401,403,404,409].includes(failure.status||0)){this.stopped=true;}
      else {this.attempts++;this.retryAt=this.now()+Math.max(failure.retryInMs||0,Math.min(2000,250*2**Math.min(this.attempts,3))+Math.random()*150);}
    }finally{this.busy=false;}
  }
}
