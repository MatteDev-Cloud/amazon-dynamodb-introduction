import test from 'node:test';
import assert from 'node:assert/strict';
import { DynamoDBClient, DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createApp } from '../src/app.js';
import { ensureTable } from '../../scripts/table.js';

test('real DynamoDB Local: lifecycle, transactions, retries, moderation, recovery and expiry',async t=>{
  const endpoint=process.env.DDB_ENDPOINT??'http://127.0.0.1:8000';
  if(!['127.0.0.1','localhost','[::1]'].includes(new URL(endpoint).hostname)) throw Error('Integration tests require loopback DynamoDB Local');
  const tableName=`DynamoLive-test-${Date.now()}`, adminKey='integration-test-secret';
  const raw=new DynamoDBClient({region:'eu-central-1',endpoint,credentials:{accessKeyId:'local',secretAccessKey:'local'},maxAttempts:1});
  const client=DynamoDBDocumentClient.from(raw);
  await ensureTable(raw,tableName);
  t.after(async()=>{await raw.send(new DeleteTableCommand({TableName:tableName}));raw.destroy();});
  let now=1800000000000;
  const app=createApp({region:'eu-central-1',endpoint,tableName,adminKey,origins:['http://localhost:5173']},{client,now:()=>now});
  const sid='integration';
  const call=async(method:string,path:string,body?:unknown,admin=false,query:Record<string,string>={},extra:Record<string,string>={})=>{
    const response=await app({method,path:`/s/${sid}${path}`,body,query,headers:{...(admin?{'x-admin-key':adminKey}:{}),...extra}});
    return {status:response.statusCode,data:JSON.parse(response.body)};
  };
  const ok=(result:{status:number;data:any},status=200)=>{assert.equal(result.status,status,JSON.stringify(result.data));return result.data;};
  const phase=async(target:string,durationMs?:number)=>{const meta=ok(await call('GET','/meta'));return ok(await call('POST','/admin/phase',{phase:target,expectedVersion:meta.version,...(durationMs===undefined?{}:{durationMs})},true));};
  const retry=async(run:()=>Promise<{status:number;data:any}>)=>{for(let i=0;i<10;i++){const r=await run();if(r.status!==503)return r;await new Promise(resolve=>setTimeout(resolve,20*(i+1)));}throw Error('Too many transaction conflicts');};

  await t.test('create, join, no credential leakage, admin authorization and version checks',async()=>{
    assert.equal((await call('POST','/admin/reset',{})).status,401);
    ok(await call('POST','/admin/reset',{},true),201);
    assert.equal((await call('POST','/admin/reset',{},true)).status,409);
    assert.equal((await call('POST','/join',{nickname:'bad name'})).status,400);
    assert.equal((await call('POST','/admin/phase',{phase:'pixel',expectedVersion:999},true)).status,409);
    assert.equal((await call('GET','/players')).status,401);
  });
  const alice=ok(await call('POST','/join',{nickname:'alice'}),201);
  const bob=ok(await call('POST','/join',{nickname:'bob'}),201);
  const banned=ok(await call('POST','/join',{nickname:'blocked'}),201);
  const owned=(pid:string)=>({'x-player-id':pid});
  await t.test('pixel cooldown is atomic under concurrency and invalid writes cannot consume it',async()=>{
    await phase('pixel',5000);
    assert.equal((await call('POST','/pixel',{pid:alice.pid,x:99,y:0,c:0})).status,400);
    const results=await Promise.all([0,1].map(x=>retry(()=>call('POST','/pixel',{pid:alice.pid,x,y:0,c:3}))));
    assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===429).length,1);
    const item=ok(await call('GET',`/player/${alice.pid}`,undefined,false,{},owned(alice.pid)));assert.equal(item.pixelsPlaced,1);
    assert.equal((await call('GET',`/player/${alice.pid}`)).status,401);
    const canvas=ok(await call('GET','/canvas'));assert.equal(canvas.pixels.length,1);assert.ok(!JSON.stringify(canvas).includes(alice.pid));
    const stats=ok(await call('GET','/stats',undefined,true));assert.equal(stats.pixelsPlaced,1);
    ok(await call('POST','/admin/ban',{pid:banned.pid},true));
    assert.equal((await call('POST','/pixel',{pid:banned.pid,x:2,y:0,c:1})).status,403);
    assert.equal((await call('POST','/admin/clear',{x1:0,y1:0,x2:1,y2:0},true)).status,409);
  });
  await t.test('delta fallback, hidden canvas, moderation tombstones and automatic phase expiry',async()=>{
    now+=3100;ok(await call('POST','/pixel',{pid:alice.pid,x:3,y:0,c:2}));
    const delta=ok(await call('GET','/canvas/changes',undefined,false,{since:String(now-100),revision:'0'}));assert.equal(delta.full,false);assert.ok(delta.pixels.length>=1);
    assert.equal(ok(await call('GET','/canvas/changes',undefined,false,{since:'0',revision:'0'})).full,true);
    ok(await call('POST','/admin/hide',{hidden:true},true));assert.equal(ok(await call('GET','/canvas')).pixels.length,0);
    assert.equal(ok(await call('GET','/canvas',undefined,true)).pixels.length,2);
    ok(await call('POST','/admin/hide',{hidden:false},true));
    now+=2000;assert.equal(ok(await call('GET','/meta')).phase,'pixel_frozen');
    assert.equal((await call('POST','/pixel',{pid:alice.pid,x:4,y:0,c:2})).status,409);
    ok(await call('POST','/admin/clear',{x1:0,y1:0,x2:5,y2:1},true));
    const snapshot=ok(await call('GET','/canvas/changes',undefined,false,{since:String(now),revision:'0'}));assert.equal(snapshot.full,true);assert.ok(snapshot.pixels.every((p:any)=>p.deleted));
    const inspection=ok(await call('GET','/canvas',undefined,true,{}, {'x-inspect':'1'}));assert.ok(inspection._inspect.operations.length>=2);
    assert.equal(ok(await call('GET','/canvas',undefined,false,{}, {'x-inspect':'1'}))._inspect,undefined);
  });
  let roundId:string;
  await t.test('tap idempotency, payload mismatch, sequenced batches, rate limit and exact team totals',async()=>{
    await phase('talk');await phase('hotkey_ready');roundId=(await phase('hotkey_running',2000)).roundId;
    const batch={pid:alice.pid,delta:7,seq:1,roundId};
    const responses=await Promise.all([1,2].map(()=>retry(()=>call('POST','/tap',batch))));responses.forEach(r=>ok(r));
    assert.equal(responses.filter(r=>r.data.duplicate).length,1);
    assert.equal((await call('POST','/tap',{...batch,delta:8})).status,409);
    assert.equal((await call('POST','/tap',{...batch,seq:3})).status,409);
    assert.equal((await call('POST','/tap',{...batch,seq:2,delta:6})).status,429);
    now+=500;ok(await call('POST','/tap',{...batch,seq:2,delta:5}));
    ok(await call('POST','/tap',{pid:bob.pid,delta:4,seq:1,roundId}));
    assert.equal((await call('POST','/tap',{pid:banned.pid,delta:1,seq:1,roundId})).status,403);
    const stats=ok(await call('GET','/stats',undefined,true));assert.equal(stats.taps,16);assert.equal(stats.teamOrange+stats.teamPurple,16);
    const leaderboard=ok(await call('GET','/leaderboard'));assert.ok(!JSON.stringify(leaderboard).includes(alice.pid));assert.equal(leaderboard.top[0].score,12);
  });
  await t.test('grace period accepts pending batch, settles strong leaderboard, rejects late writes',async()=>{
    now+=1600;assert.equal(ok(await call('GET','/meta')).phase,'hotkey_end');
    ok(await call('POST','/tap',{pid:alice.pid,seq:3,delta:2,roundId}));
    assert.equal(ok(await call('GET',`/rank/${alice.pid}`,undefined,false,{},owned(alice.pid))).provisional,true);
    const meta=ok(await call('GET','/meta'));assert.equal((await call('POST','/admin/phase',{phase:'end',expectedVersion:meta.version},true)).status,409);
    now+=2000;
    assert.equal((await call('POST','/tap',{pid:alice.pid,seq:4,delta:1,roundId})).status,409);
    const duplicate=ok(await call('POST','/tap',{pid:alice.pid,seq:3,delta:2,roundId}));assert.equal(duplicate.duplicate,true);
    const rank=ok(await call('GET',`/rank/${alice.pid}`,undefined,false,{},owned(alice.pid)));assert.equal(rank.rank,1);assert.equal(rank.score,14);assert.equal(rank.provisional,false);
    await phase('end');assert.equal(ok(await call('GET','/stats',undefined,true)).taps,18);
  });
  await t.test('logical TTL rejects expired session without relying on physical deletion',async()=>{
    await client.send(new UpdateCommand({TableName:tableName,Key:{PK:`SESSION#${sid}`,SK:'META'},UpdateExpression:'SET expiresAt = :t',ExpressionAttributeValues:{':t':Math.floor(now/1000)-1}}));
    assert.equal((await call('GET','/meta')).status,404);
    assert.equal((await call('POST','/join',{nickname:'late'})).status,404);
  });
});
