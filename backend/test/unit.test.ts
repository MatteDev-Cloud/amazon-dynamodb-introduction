import test from 'node:test';
import assert from 'node:assert/strict';
import { integer, makeMeta, nextPhase, nickname, secretMatches, teamFor } from '../src/lib/domain.js';
import { createApp } from '../src/app.js';
import { estimateCost, PRICES } from '../../shared/pricing.js';
import { RequestDb } from '../src/lib/ddb.js';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
test('nickname validation normalizes Unicode and rejects markup, profanity and oversized input',()=>{
  assert.equal(nickname('Giùlia'),'Giùlia'); assert.equal(nickname('ＡＢ'),'AB');
  for(const value of ['x','<script>','a'.repeat(13),'c4zz0','f.u.c.k',null]) assert.throws(()=>nickname(value));
});
test('config bounds, phases and credential comparisons',()=>{
  assert.throws(()=>integer(NaN,0,10,'n'));assert.throws(()=>integer(1.5,0,10,'n'));
  const meta=makeMeta('prova',{},100000); assert.equal(meta.canvasW,48);assert.equal(meta.expiresAt,86500);
  assert.throws(()=>makeMeta('prova',{canvasW:49},0));assert.equal(nextPhase('lobby','pixel'),'pixel');
  assert.throws(()=>nextPhase('lobby','hotkey_running'));assert.equal(secretMatches(undefined,'secret'),false);
  assert.equal(secretMatches('secret','secret'),true);assert.equal(secretMatches('wrong','secret'),false);
  assert.equal(teamFor('same'),teamFor('same'));
});
test('admin and malformed requests are rejected before any database access',async()=>{
  let calls=0;
  const app=createApp({adminKey:'test-secret-long-enough',tableName:'test',region:'eu-central-1',endpoint:'http://localhost:8000',origins:['http://localhost:5173']},{client:{send:async()=>{calls++;throw Error('Unexpected DB access');}} as any});
  const req={method:'POST',path:'/s/a/admin/reset',headers:{},query:{},body:{}};
  assert.equal((await app(req)).statusCode,401);
  assert.equal((await app({...req,path:'/s/a/admin/phase'})).statusCode,401);
  assert.equal((await app({...req,headers:{origin:'https://untrusted.example'}})).statusCode,403);
  assert.equal((await app({...req,body:[]})).statusCode,400);assert.equal(calls,0);
});
test('cost estimate never turns unavailable regional prices into zero',()=>{
  const stats={wruTable:1e6,wruGsi:1e6,rruTable:1e6,rruGsi:0,apiCalls:1e6,lambdaMs:1000} as any;
  assert.equal(estimateCost(stats,{...PRICES,wruMillion:null}),null);
  const cost=estimateCost(stats,{...PRICES,wruMillion:1,rruMillion:0.5,httpApiMillion:1,lambdaRequestsMillion:0.2,lambdaGbSecond:0.000016});
  assert.ok(cost!==null && Math.abs(cost-3.700004)<1e-12);
});
test('meter separates transaction condition reads from writes and GSI capacity',async()=>{
  const db=new RequestDb({send:async()=>({ConsumedCapacity:[{CapacityUnits:7,ReadCapacityUnits:2,WriteCapacityUnits:5,Table:{ReadCapacityUnits:2,WriteCapacityUnits:3},GlobalSecondaryIndexes:{ByScore:{WriteCapacityUnits:2}}}]})} as any,'test');
  await db.run(new TransactWriteCommand({TransactItems:[]}));
  assert.equal(db.counters.rruTable,2);assert.equal(db.counters.wruTable,3);assert.equal(db.counters.wruGsi,2);
});
