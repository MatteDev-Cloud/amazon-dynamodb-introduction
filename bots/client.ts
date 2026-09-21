import type { ApiResponse, JoinResponse, Meta, TapRequest, TapResponse } from '../shared/types.js';
export const sleep=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  const abort=()=>{clearTimeout(timer);reject(signal?.reason);};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
});
export class ApiFailure extends Error { constructor(public status:number,public data:any){super(`${status}: ${data.error}`);} }
export class BotClient {
  constructor(public api:string,public sid:string,public signal?:AbortSignal){}
  async request<T>(path:string,body?:unknown,headers:Record<string,string>={}):Promise<ApiResponse<T>> {
    const response=await fetch(`${this.api}/s/${encodeURIComponent(this.sid)}${path}`,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:this.signal?AbortSignal.any([this.signal,AbortSignal.timeout(5000)]):AbortSignal.timeout(5000)});
    const data=await response.json() as any;if(!response.ok)throw new ApiFailure(response.status,data);return data;
  }
  meta(){return this.request<Meta>('/meta');}
  join(nickname:string){return this.request<JoinResponse>('/join',{nickname});}
  async tap(batch:TapRequest):Promise<ApiResponse<TapResponse>> {
    for(let attempt=0;attempt<10;attempt++) {
      try{return await this.request<TapResponse>('/tap',batch);}
      catch(e){if(this.signal?.aborted)throw e;if(e instanceof ApiFailure && ![429,503].includes(e.status))throw e;await sleep(e instanceof ApiFailure ? (e.data.retryInMs??200)+Math.random()*100 : 200*(attempt+1),this.signal);}
    }
    throw Error('Tap retry limit exceeded');
  }
}
