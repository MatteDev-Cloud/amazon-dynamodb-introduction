import { PHASES, type Meta, type Player, type RawPixel, type TapRequest } from '../../../shared/types.js';
import { PRICES, estimateCost } from '../../../shared/pricing.js';
import { config, read, save } from './config';
import { ApiFailure } from './api';
interface MockDB {meta:Meta;players:Player[];pixels:RawPixel[];taps:number;orange:number;purple:number;pixelCount:number}
const key=`dynamolive:mockdb:${config.sid}`;
function initial():MockDB {const now=Date.now();return {meta:{sid:config.sid,phase:'lobby',version:1,phaseStartedAt:now,phaseEndsAt:null,canvasW:48,canvasH:27,cooldownMs:1500,roundMs:15000,pixelMs:90000,canvasHidden:false,canvasRevision:0,teamsRevealed:false,roundId:null,roundStartedAt:null,roundEndsAt:null,tapGraceMs:2000,expiresAt:Math.floor(now/1000)+86400,prompt:'Scrivete DDB',botsEnabled:false},players:[],pixels:[],taps:0,orange:0,purple:0,pixelCount:0};}
export async function mockTransport(path:string, body?:any):Promise<any>{
  const db=read<MockDB>(key,initial()),m=db.meta,now=Date.now();path=path.split('?')[0];
  const fail=(status:number,message:string,retry=0):never=>{throw new ApiFailure(status,message,retry);};
  if(m.phaseEndsAt&&now>=m.phaseEndsAt){m.phase=m.phase==='pixel'?'pixel_frozen':'hotkey_end';m.phaseEndsAt=null;m.version++;}
  const player=(pid:string)=>db.players.find(p=>p.pid===pid)||fail(404,'Giocatore assente');
  let result:any;
  if(path==='/meta')result=m;
  else if(path==='/join'){
    if(!['lobby','pixel'].includes(m.phase))fail(409,'Ingresso chiuso');
    if(!/^[\p{L}\p{N}_.-]{2,12}$/u.test(body.nickname))fail(400,'Usa da 2 a 12 lettere, numeri, _ . -');
    const pid=crypto.randomUUID(),p:Player={PK:`SESSION#${m.sid}`,SK:`PLAYER#${pid}`,pid,nickname:body.nickname,team:db.players.length%2?'purple':'orange',joinedAt:now,expiresAt:m.expiresAt};db.players.push(p);result={pid,team:p.team,nickname:p.nickname};
  }else if(path.startsWith('/player/'))result=player(path.split('/')[2]);
  else if(path==='/players')result={players:db.players,total:db.players.length};
  else if(path==='/admin/phase'){
    const index=PHASES.indexOf(m.phase);if(body.expectedVersion!==m.version)fail(409,'Versione cambiata');
    if(body.phase!==m.phase&&body.phase!==PHASES[index+1])fail(409,'Transizione non sequenziale');
    if(body.phase==='end'&&now<(m.roundEndsAt||0)+m.tapGraceMs)fail(409,'Attendere i batch finali');
    if(body.phase!==m.phase){m.phase=body.phase;m.version++;m.phaseStartedAt=now;m.phaseEndsAt=m.phase==='pixel'?now+m.pixelMs:m.phase==='hotkey_running'?now+m.roundMs:null;
      if(m.phase==='talk')m.teamsRevealed=true;
      if(m.phase==='hotkey_running'){m.roundId=crypto.randomUUID();m.roundStartedAt=now;m.roundEndsAt=m.phaseEndsAt;}
      if(m.phase==='hotkey_end')m.roundEndsAt=Math.min(m.roundEndsAt||now,now);}
    result=m;
  }else if(path==='/admin/hide'){m.canvasHidden=body.hidden;m.version++;result=m;}
  else if(path==='/admin/bots'){m.botsEnabled=body.enabled;m.version++;result=m;}
  else if(path==='/admin/ban'){player(body.pid).banned=true;result={ok:true};}
  else if(path==='/admin/clear'){
    if(m.phase==='pixel')fail(409,'Congelare prima la tela');
    const before=db.pixels.length;db.pixels=db.pixels.filter(p=>!(p.x>=body.x1&&p.x<=body.x2&&p.y>=body.y1&&p.y<=body.y2));m.canvasRevision++;result={deleted:before-db.pixels.length,canvasRevision:m.canvasRevision};
  }else if(path==='/canvas'||path==='/canvas/changes')result={pixels:m.canvasHidden?[]:db.pixels.map(p=>({x:p.x,y:p.y,c:p.color,by:p.by,t:p.updatedAt})),cursor:now,canvasRevision:m.canvasRevision,hidden:m.canvasHidden,full:true};
  else if(path==='/pixel'){
    const p=player(body.pid);if(p.banned)fail(403,'Giocatore escluso');if(m.phase!=='pixel')fail(409,'Tela congelata');if(now<(p.lastPixelAt||0)+m.cooldownMs)fail(429,'Attendi il cooldown',(p.lastPixelAt||0)+m.cooldownMs-now);
    p.lastPixelAt=now;p.pixelsPlaced=(p.pixelsPlaced||0)+1;db.pixelCount++;
    const raw:RawPixel={PK:`CANVAS#${m.sid}`,SK:`PX#${String(body.x).padStart(3,'0')}#${String(body.y).padStart(3,'0')}`,x:body.x,y:body.y,color:body.c,by:p.nickname,byId:p.pid,cv:m.sid,updatedAt:now,expiresAt:m.expiresAt};db.pixels=db.pixels.filter(v=>v.x!==body.x||v.y!==body.y);db.pixels.push(raw);result={ok:true,nextAllowedAt:now+m.cooldownMs};
  }else if(path.startsWith('/pixel/')){const [, ,x,y]=path.split('/');result=db.pixels.find(p=>p.x===+x&&p.y===+y)||fail(404,'Pixel vuoto');}
  else if(path==='/tap'){
    const b=body as TapRequest,p=player(b.pid);if(p.banned)fail(403,'Giocatore escluso');
    if(b.roundId!==m.roundId||!['hotkey_running','hotkey_end'].includes(m.phase)||now>(m.roundEndsAt||0)+m.tapGraceMs)fail(409,'Round terminato');
    const duplicate=b.seq===p.lastSeq&&b.delta===p.lastDelta;
    if(!duplicate){if(b.seq!==(p.lastSeq||0)+1)fail(409,'Sequenza non valida');if(b.delta<1||b.delta>12)fail(400,'Delta non valido');p.lastSeq=b.seq;p.lastDelta=b.delta;p.score=(p.score||0)+b.delta;p.roundId=b.roundId;db.taps+=b.delta;if(p.team==='orange')db.orange+=b.delta;else db.purple+=b.delta;}
    result={score:p.score,acceptedSeq:p.lastSeq,duplicate};
  }else if(path==='/leaderboard'||path.startsWith('/rank/')){
    const ranking=db.players.filter(p=>p.roundId===m.roundId&&!p.banned).sort((a,b)=>(b.score||0)-(a.score||0)||a.joinedAt-b.joinedAt||a.pid.localeCompare(b.pid));
    const provisional=now<(m.roundEndsAt||Infinity)+m.tapGraceMs;
    if(path==='/leaderboard')result={top:ranking.slice(0,10).map((p,i)=>({nickname:p.nickname,team:p.team,score:p.score||0,rank:i+1})),provisional,roundId:m.roundId};
    else {const p=player(path.split('/')[2]),i=ranking.indexOf(p);result={rank:i<0?null:i+1,total:ranking.length,score:p.score||0,provisional};}
  }else if(path==='/stats'){
    const stats={playersJoined:db.players.length,pixelsPlaced:db.pixelCount,taps:db.taps,teamOrange:db.orange,teamPurple:db.purple,apiCalls:0,wruTable:0,wruGsi:0,rruTable:0,rruGsi:0,lambdaMs:0,estimated:true as const,expiresAt:m.expiresAt};result={...stats,prices:PRICES,estimatedCost:estimateCost(stats),costBasis:'on-demand-list-price'};
  }else fail(404,'Endpoint mock non implementato');
  save(key,db);return {...result,serverTime:now};
}
