import { randomUUID } from 'node:crypto';
import { GetCommand, PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Meta, Player, RawPixel, Stats, TapRequest } from '../../shared/types.js';
import { PRICES, estimateCost } from '../../shared/pricing.js';
import type { Configuration } from './lib/config.js';
import { HttpError, fail, integer, makeMeta, nextPhase, nickname, pidValue, pixelKey, secretMatches, sessionKey, sidValue, teamFor } from './lib/domain.js';
import { Meter, newClient, RequestDb } from './lib/ddb.js';

export interface Request { method: string; path: string; headers: Record<string,string|undefined>; query: Record<string,string|undefined>; body?: unknown }
export interface Response { statusCode: number; headers: Record<string,string>; body: string }
const conditional = (error: any) => error?.name === 'ConditionalCheckFailedException' || (error?.name === 'TransactionCanceledException' && error.CancellationReasons?.some((r:any)=>r.Code==='ConditionalCheckFailed'));
const plainMeta = (item: any): Meta => { const {PK,SK,...meta}=item; return meta; };
export function createApp(config: Configuration, options: {client?: DynamoDBDocumentClient; now?:()=>number} = {}) {
  const client = options.client ?? newClient(config), clock=options.now ?? Date.now, meter=new Meter();
  const table=config.tableName;
  async function get(db: RequestDb, key: {PK:string;SK:string}) { return (await db.run(new GetCommand({TableName:table,Key:key,ConsistentRead:true}))).Item; }
  const checkMeta = (meta:Meta, now:number) => ({ConditionCheck:{TableName:table,Key:sessionKey(meta.sid,'META'),
    ConditionExpression:'#v = :v AND expiresAt > :now',ExpressionAttributeNames:{'#v':'version'},ExpressionAttributeValues:{':v':meta.version,':now':Math.floor(now/1000)}}});
  async function saveMeta(db: RequestDb, previous: Meta, updated: Meta) {
    try { await db.run(new PutCommand({TableName:table,Item:{...sessionKey(updated.sid,'META'),...updated},ConditionExpression:'#v = :v',ExpressionAttributeNames:{'#v':'version'},ExpressionAttributeValues:{':v':previous.version}})); }
    catch (e) { if(conditional(e)) fail(409,'VERSION_CONFLICT','Reload META and retry'); throw e; }
    return updated;
  }
  async function readMeta(db:RequestDb,sid:string,now:number):Promise<Meta> {
    let item=await get(db,sessionKey(sid,'META'));
    if (!item || item.expiresAt<=now/1000) fail(404,'SESSION_NOT_FOUND','Session not found or expired');
    let meta=plainMeta(item);
    if ((meta.phase==='pixel'||meta.phase==='hotkey_running') && meta.phaseEndsAt!==null && now>=meta.phaseEndsAt) {
      const next:Meta={...meta,phase:meta.phase==='pixel'?'pixel_frozen':'hotkey_end',phaseStartedAt:meta.phaseEndsAt,phaseEndsAt:null,version:meta.version+1};
      try { meta=await saveMeta(db,meta,next); }
      catch(e) { if(e instanceof HttpError && e.status===409) { item=await get(db,sessionKey(sid,'META')); meta=plainMeta(item); } else throw e; }
    }
    return meta;
  }
  async function player(db:RequestDb,sid:string,pid:string,now:number):Promise<Player> {
    const item=await get(db,sessionKey(sid,`PLAYER#${pid}`));
    if(!item || item.expiresAt<=now/1000) fail(404,'PLAYER_NOT_FOUND','Player not found or expired');
    if(item.banned) fail(403,'BANNED','Player banned');
    return item;
  }
  async function transaction(db:RequestDb,items:any[]) { return db.run(new TransactWriteCommand({TransactItems:items})); }
  const statAdd=(sid:string,values:Record<string,number>)=>({Update:{TableName:table,Key:sessionKey(sid,'STATS'),
    ConditionExpression:'attribute_exists(PK)',UpdateExpression:`ADD ${Object.keys(values).map(k=>`#${k} :${k}`).join(', ')}`,
    ExpressionAttributeNames:Object.fromEntries(Object.keys(values).map(k=>[`#${k}`,k])),ExpressionAttributeValues:Object.fromEntries(Object.entries(values).map(([k,v])=>[`:${k}`,v]))}});
  async function allPlayers(db:RequestDb,sid:string,now:number) {
    return (await db.query({KeyConditionExpression:'PK = :pk AND begins_with(SK, :sk)',ExpressionAttributeValues:{':pk':`SESSION#${sid}`,':sk':'PLAYER#'},ConsistentRead:true})).filter(p=>p.expiresAt>now/1000 && !p.banned) as Player[];
  }
  async function ranking(db:RequestDb,meta:Meta,now:number) {
    const provisional=meta.roundEndsAt===null || now<meta.roundEndsAt+meta.tapGraceMs;
    const finalPhase=meta.phase==='hotkey_end'||meta.phase==='end';
    const items:Player[]=!meta.roundId?[]:finalPhase ? (await allPlayers(db,meta.sid,now)).filter(p=>p.roundId===meta.roundId && p.score!==undefined)
      : await db.query({IndexName:'ByScore',KeyConditionExpression:'lb = :s',ExpressionAttributeValues:{':s':`${meta.sid}#${meta.roundId}`},ScanIndexForward:false});
    items.sort((a,b)=>(b.score??0)-(a.score??0)||a.joinedAt-b.joinedAt||a.pid.localeCompare(b.pid));
    return {items,provisional};
  }
  return async function handle(req:Request):Promise<Response> {
    const start=performance.now(), now=clock(), db=new RequestDb(client,table);
    const headers=Object.fromEntries(Object.entries(req.headers).map(([k,v])=>[k.toLowerCase(),v]));
    const origin=headers.origin;
    const responseHeaders:Record<string,string>={'content-type':'application/json; charset=utf-8','cache-control':'no-store','vary':'Origin','x-content-type-options':'nosniff'};
    if(origin && config.origins.includes(origin)) Object.assign(responseHeaders,{'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,x-admin-key,x-inspect,x-player-id'});
    const admin=secretMatches(headers['x-admin-key'],config.adminKey);
    const requireAdmin=()=>{if(!admin) fail(401,'UNAUTHORIZED','Admin key required');};
    const requireOwner=(pid:string)=>{if(!admin&&!secretMatches(headers['x-player-id'],pid)) fail(401,'UNAUTHORIZED','Player credential required');};
    let sid:string|undefined, sessionExists=false;
    const finish=(statusCode:number,data:Record<string,unknown>)=>({statusCode,headers:responseHeaders,body:JSON.stringify({...data,serverTime:clock(),...(admin&&headers['x-inspect']==='1'?{_inspect:db.inspect()}:{})})});
    try {
      if(origin&&!config.origins.includes(origin)) fail(403,'ORIGIN_DENIED','Origin not allowed');
      if(req.method==='OPTIONS') return {statusCode:204,headers:responseHeaders,body:''};
      const match=/^\/s\/([^/]+)(\/.*)$/.exec(req.path);
      if(!match) fail(404,'NOT_FOUND','Route not found');
      sid=sidValue(match[1]); const path=match[2]!;
      const body=(req.body ?? {}) as Record<string,any>;
      if(typeof body!=='object'||Array.isArray(body)||body===null) fail(400,'INVALID_BODY','JSON object required');
      if(req.method==='POST'&&path==='/admin/reset') {
        requireAdmin();
        const meta=makeMeta(sid,body,now);
        const stats:Stats={playersJoined:0,pixelsPlaced:0,taps:0,teamOrange:0,teamPurple:0,apiCalls:0,wruTable:0,wruGsi:0,rruTable:0,rruGsi:0,lambdaMs:0,estimated:true,expiresAt:meta.expiresAt};
        try { await transaction(db,[{Put:{TableName:table,Item:{...sessionKey(sid,'META'),...meta},ConditionExpression:'attribute_not_exists(PK)'}},{Put:{TableName:table,Item:{...sessionKey(sid,'STATS'),...stats},ConditionExpression:'attribute_not_exists(PK)'}}]); }
        catch(e) { if(conditional(e)) fail(409,'SESSION_EXISTS','Use a new sid; existing sessions are never overwritten'); throw e; }
        sessionExists=true; return finish(201,{...meta});
      }
      if(path.startsWith('/admin/')) requireAdmin();
      const meta=await readMeta(db,sid,now); sessionExists=true;
      if(req.method==='GET'&&path==='/meta') return finish(200,{...meta});
      if(req.method==='POST'&&path==='/admin/phase') {
        const phase=nextPhase(meta.phase,body.phase);
        if(phase===meta.phase) return finish(200,{...meta});
        if(integer(body.expectedVersion,1,Number.MAX_SAFE_INTEGER,'expectedVersion')!==meta.version) fail(409,'VERSION_CONFLICT','Reload META');
        if(phase==='end' && meta.roundEndsAt!==null && now<meta.roundEndsAt+meta.tapGraceMs) fail(409,'ROUND_SETTLING','Wait until tap grace expires');
        let duration:number|null=null;
        if(phase==='pixel'||phase==='hotkey_running') duration=integer(body.durationMs??(phase==='pixel'?meta.pixelMs:meta.roundMs),1000,phase==='pixel'?300000:60000,'durationMs');
        else if(body.durationMs!==undefined) fail(400,'INVALID_INPUT','durationMs applies only to timed games');
        const updated:Meta={...meta,phase,version:meta.version+1,phaseStartedAt:now,phaseEndsAt:duration===null?null:now+duration,teamsRevealed:meta.teamsRevealed||phase==='talk'};
        if(phase==='hotkey_running') Object.assign(updated,{roundId:randomUUID(),roundStartedAt:now,roundEndsAt:now+duration!});
        if(phase==='hotkey_end'&&meta.roundEndsAt!==null) updated.roundEndsAt=Math.min(meta.roundEndsAt,now);
        return finish(200,{...await saveMeta(db,meta,updated)});
      }
      if(req.method==='POST'&&(path==='/admin/hide'||path==='/admin/bots')) {
        const field=path.endsWith('hide')?'hidden':'enabled';
        if(typeof body[field]!=='boolean') fail(400,'INVALID_INPUT',`${field} must be boolean`);
        return finish(200,{...await saveMeta(db,meta,{...meta,[field==='hidden'?'canvasHidden':'botsEnabled']:body[field],version:meta.version+1})});
      }
      if(req.method==='POST'&&path==='/join') {
        if(!['lobby','pixel'].includes(meta.phase)) fail(409,'WRONG_PHASE','Join is closed');
        const name=nickname(body.nickname), pid=randomUUID(), team=teamFor(pid);
        const item:Player={...sessionKey(sid,`PLAYER#${pid}`),pid,nickname:name,team,joinedAt:now,expiresAt:meta.expiresAt};
        try { await transaction(db,[checkMeta(meta,now),{Put:{TableName:table,Item:item,ConditionExpression:'attribute_not_exists(PK)'}},statAdd(sid,{playersJoined:1})]); }
        catch(e) { if(conditional(e)) fail(409,'STATE_CHANGED','Reload META and retry'); throw e; }
        return finish(201,{pid,team,nickname:name});
      }
      if(req.method==='GET'&&path==='/players') { requireAdmin(); const list=await allPlayers(db,sid,now); return finish(200,{players:list.map(p=>({pid:p.pid,nickname:p.nickname,team:p.team,joinedAt:p.joinedAt})),total:list.length}); }
      const playerPath=/^\/player\/([^/]+)$/.exec(path);
      if(req.method==='GET'&&playerPath) { const pid=pidValue(playerPath[1]); requireOwner(pid); return finish(200,{...await player(db,sid,pid,now)}); }
      if(req.method==='POST'&&path==='/admin/ban') {
        const pid=pidValue(body.pid); await player(db,sid,pid,now);
        await db.run(new UpdateCommand({TableName:table,Key:sessionKey(sid,`PLAYER#${pid}`),UpdateExpression:'SET banned = :yes REMOVE lb',ConditionExpression:'attribute_exists(PK)',ExpressionAttributeValues:{':yes':true}}));
        return finish(200,{ok:true});
      }
      if(req.method==='GET'&&(path==='/canvas'||path==='/canvas/changes')) {
        const since=path.endsWith('changes')?integer(Number(req.query.since),0,Number.MAX_SAFE_INTEGER,'since'):0;
        const revision=req.query.revision===undefined?-1:integer(Number(req.query.revision),0,Number.MAX_SAFE_INTEGER,'revision');
        const full=path==='/canvas'||revision!==meta.canvasRevision||since>now||now-since>30000;
        let pixels:RawPixel[]=[];
        if(!meta.canvasHidden||admin) pixels=await db.query(full ? {KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':`CANVAS#${sid}`},ConsistentRead:true} : {IndexName:'ByTime',KeyConditionExpression:'cv = :cv AND updatedAt >= :since',ExpressionAttributeValues:{':cv':sid,':since':Math.max(0,since-2000)}});
        return finish(200,{pixels:pixels.filter(p=>p.expiresAt>now/1000).map(p=>({x:p.x,y:p.y,c:p.color,by:p.by,t:p.updatedAt,...(p.deleted?{deleted:true}:{})})),cursor:now,canvasRevision:meta.canvasRevision,hidden:meta.canvasHidden,full});
      }
      const pixelPath=/^\/pixel\/(\d+)\/(\d+)$/.exec(path);
      if(req.method==='GET'&&pixelPath) { requireAdmin(); const x=integer(Number(pixelPath[1]),0,meta.canvasW-1,'x'),y=integer(Number(pixelPath[2]),0,meta.canvasH-1,'y'); const item=await get(db,pixelKey(sid,x,y)); if(!item||item.deleted||item.expiresAt<=now/1000) fail(404,'PIXEL_NOT_FOUND','Pixel not found'); return finish(200,item); }
      if(req.method==='POST'&&path==='/pixel') {
        if(meta.phase!=='pixel'||meta.phaseEndsAt===null||now>=meta.phaseEndsAt) fail(409,'WRONG_PHASE','Canvas is frozen');
        const pid=pidValue(body.pid), x=integer(body.x,0,meta.canvasW-1,'x'),y=integer(body.y,0,meta.canvasH-1,'y'),color=integer(body.c,0,7,'c');
        const p=await player(db,sid,pid,now);
        if(p.lastPixelAt!==undefined && now-p.lastPixelAt<meta.cooldownMs) fail(429,'COOLDOWN','Wait before placing another pixel',meta.cooldownMs-(now-p.lastPixelAt));
        const pixel:RawPixel={...pixelKey(sid,x,y),x,y,color,by:p.nickname,byId:pid,cv:sid,updatedAt:now,expiresAt:meta.expiresAt};
        try { await transaction(db,[checkMeta(meta,now),{Update:{TableName:table,Key:sessionKey(sid,`PLAYER#${pid}`),UpdateExpression:'SET lastPixelAt = :now ADD pixelsPlaced :one',ConditionExpression:'attribute_exists(PK) AND attribute_not_exists(banned) AND (attribute_not_exists(lastPixelAt) OR lastPixelAt <= :cut)',ExpressionAttributeValues:{':now':now,':one':1,':cut':now-meta.cooldownMs}}},{Put:{TableName:table,Item:pixel,ConditionExpression:'attribute_not_exists(updatedAt) OR updatedAt < :now',ExpressionAttributeValues:{':now':now}}},statAdd(sid,{pixelsPlaced:1})]); }
        catch(e) { if(conditional(e)) { const latest=await player(db,sid,pid,now); if(latest.lastPixelAt!==undefined && now-latest.lastPixelAt<meta.cooldownMs) fail(429,'COOLDOWN','Wait before placing another pixel',meta.cooldownMs-(now-latest.lastPixelAt)); fail(409,'STATE_CHANGED','Canvas or phase changed; refresh before retry'); } throw e; }
        return finish(200,{ok:true,nextAllowedAt:now+meta.cooldownMs});
      }
      if(req.method==='POST'&&path==='/admin/clear') {
        if(meta.phase==='pixel') fail(409,'FREEZE_REQUIRED','Freeze canvas before clearing');
        const x1=integer(body.x1,0,meta.canvasW-1,'x1'),x2=integer(body.x2,x1,meta.canvasW-1,'x2'),y1=integer(body.y1,0,meta.canvasH-1,'y1'),y2=integer(body.y2,y1,meta.canvasH-1,'y2');
        const updated=await saveMeta(db,meta,{...meta,version:meta.version+1,canvasRevision:meta.canvasRevision+1});
        const cells=(await db.query({KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':`CANVAS#${sid}`},ConsistentRead:true})).filter(p=>!p.deleted&&p.x>=x1&&p.x<=x2&&p.y>=y1&&p.y<=y2);
        for(let i=0;i<cells.length;i+=99) await transaction(db,[checkMeta(updated,now),...cells.slice(i,i+99).map(p=>({Put:{TableName:table,Item:{...p,deleted:true,color:0,by:'',byId:'',updatedAt:Math.max(now,p.updatedAt+1)}}}))]);
        return finish(200,{deleted:cells.length,canvasRevision:updated.canvasRevision});
      }
      if(req.method==='POST'&&path==='/tap') {
        const pid=pidValue(body.pid), delta=integer(body.delta,1,12,'delta'),seq=integer(body.seq,1,10000,'seq');
        const p=await player(db,sid,pid,now);
        if(typeof body.roundId!=='string'||body.roundId!==meta.roundId) fail(409,'WRONG_ROUND','Refresh META');
        const duplicate=(latest:Player)=>{
          if(latest.roundId===meta.roundId && latest.lastSeq===seq) { if(latest.lastDelta!==delta) fail(409,'SEQ_PAYLOAD_MISMATCH','Retry must use identical delta'); return {score:latest.score??0,acceptedSeq:seq,duplicate:true}; }
        };
        const prior=duplicate(p); if(prior) return finish(200,prior);
        if(!['hotkey_running','hotkey_end'].includes(meta.phase)||meta.roundEndsAt===null||meta.roundStartedAt===null||now>=meta.roundEndsAt+meta.tapGraceMs) fail(409,'ROUND_CLOSED','Round is closed');
        if(seq!==(p.lastSeq??0)+1) fail(409,'INVALID_SEQ','Send lastSeq + 1 and retry the same payload');
        const bucket=Math.floor(Math.min(now,meta.roundEndsAt-1)/500), elapsed=Math.min(now,meta.roundEndsAt)-meta.roundStartedAt;
        const maxTotal=Math.min(Math.ceil((meta.roundEndsAt-meta.roundStartedAt)/500)*12,Math.floor(elapsed/500)*12+12);
        const oldBucket=(p as any).tapBucket, bucketCount=oldBucket===bucket ? (p as any).bucketCount??0 : 0;
        if(bucketCount+delta>12 || (p.score??0)+delta>maxTotal) fail(429,'TAP_LIMIT','Too many taps',Math.max(1,(bucket+1)*500-now));
        try { await transaction(db,[checkMeta(meta,now),{Update:{TableName:table,Key:sessionKey(sid,`PLAYER#${pid}`),
          UpdateExpression:'SET lb = :lb, roundId = :round, lastSeq = :seq, lastDelta = :delta, tapBucket = :bucket, bucketCount = :count ADD score :delta',
          ConditionExpression:'attribute_exists(PK) AND attribute_not_exists(banned) AND (attribute_not_exists(lastSeq) OR lastSeq = :previous)',
          ExpressionAttributeValues:{':lb':`${sid}#${meta.roundId}`,':round':meta.roundId,':seq':seq,':delta':delta,':bucket':bucket,':count':bucketCount+delta,':previous':seq-1}}},statAdd(sid,{taps:delta,[p.team==='orange'?'teamOrange':'teamPurple']:delta})]); }
        catch(e) { if(conditional(e)) { const latest=await player(db,sid,pid,now), ack=duplicate(latest); if(ack) return finish(200,ack); fail(409,'STATE_CHANGED','Reload player and META before retry'); } throw e; }
        return finish(200,{score:(p.score??0)+delta,acceptedSeq:seq,duplicate:false});
      }
      if(req.method==='GET'&&path==='/leaderboard') {
        const limit=integer(Number(req.query.limit??10),1,100,'limit'), {items,provisional}=await ranking(db,meta,now);
        return finish(200,{top:items.slice(0,limit).map((p,i)=>({nickname:p.nickname,team:p.team,score:p.score??0,rank:i+1})),provisional,roundId:meta.roundId});
      }
      const rankPath=/^\/rank\/([^/]+)$/.exec(path);
      if(req.method==='GET'&&rankPath) {
        const pid=pidValue(rankPath[1]); requireOwner(pid); const p=await player(db,sid,pid,now), {items,provisional}=await ranking(db,meta,now),index=items.findIndex(p=>p.pid===pid);
        return finish(200,{rank:index<0?null:index+1,total:items.length,score:p.score??0,provisional});
      }
      if(req.method==='GET'&&path==='/stats') { requireAdmin(); const item=await get(db,sessionKey(sid,'STATS')); const {PK,SK,...stats}=item; return finish(200,{...stats,prices:PRICES,costBasis:'on-demand-list-price',estimatedCost:estimateCost(stats as Stats)}); }
      fail(404,'NOT_FOUND','Route not found');
    } catch(error) {
      if(error instanceof HttpError) return finish(error.status,{error:error.code,message:error.message,...(error.retryInMs!==undefined?{retryInMs:error.retryInMs}:{})});
      // No request body, credentials or raw AWS errors in logs/responses.
      console.error(JSON.stringify({event:'backend_error',type:error instanceof Error?error.name:'UnknownError'}));
      return finish(503,{error:'BACKEND_UNAVAILABLE',message:'Temporary backend failure; retry with backoff',retryInMs:100+Math.floor(Math.random()*200)});
    } finally { if(sid&&sessionExists) await meter.record(sid,db,performance.now()-start,clock()); }
  };
}
