import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CanvasState} from '../shared/canvas-state.ts';
import {TapQueue, type QueueState} from '../play/tap-queue.ts';
const initial=():QueueState=>({pending:null,queued:0,seq:0,roundId:'round'});
test('delta vecchi non resuscitano tombstone; snapshot e hide sostituiscono lo stato',()=>{
 const s=new CanvasState();const apply=(pixels:any[],full=false,hidden=false)=>s.apply({pixels,full,hidden,cursor:1,canvasRevision:0});
 apply([{x:0,y:0,c:1,by:'a',t:10}],true);apply([{x:0,y:0,c:1,by:'a',t:12,deleted:true}]);apply([{x:0,y:0,c:2,by:'b',t:11}]);assert.equal(s.pixels.get('0,0')?.deleted,true);
 apply([],true);assert.equal(s.pixels.size,0);apply([{x:1,y:1,c:3,by:'a',t:20}]);apply([],false,true);assert.equal(s.pixels.size,0);
});
test('ack perso e reload ritentano lo stesso batch senza sommare due volte',async()=>{
 let now=0,serverScore=0,lastSeq=0,calls:any[]=[];let stored=initial();
 const send=async(b:any)=>{calls.push(b);if(b.seq!==lastSeq){serverScore+=b.delta;lastSeq=b.seq;if(calls.length===1)throw Error('ack perso');}return {score:serverScore,acceptedSeq:lastSeq,duplicate:true};};
 let q=new TapQueue('p',stored,send,s=>{stored=structuredClone(s);},()=>now);q.tap();q.tap();await q.flush(10000);assert.equal(stored.pending?.delta,2);
 now=1000;q=new TapQueue('p',structuredClone(stored),send,s=>{stored=structuredClone(s);},()=>now);await q.flush(10000);assert.deepEqual(calls[0],calls[1]);assert.equal(serverScore,2);assert.equal(stored.pending,null);
 q.tap();await q.flush(10000);assert.equal(serverScore,3);assert.equal(calls[2].seq,2);
});
test('solo un batch in volo; nuovi tap restano nella coda successiva',async()=>{
 let resolve:any;let calls=0;const q=new TapQueue('p',initial(),async()=>{calls++;return new Promise(r=>{resolve=r;});},()=>{},()=>0);
 q.tap();const first=q.flush(1000);q.tap();await q.flush(1000);assert.equal(calls,1);assert.equal(q.state.queued,1);resolve({score:1,acceptedSeq:1,duplicate:false});await first;assert.equal(q.state.seq,1);
});
test('429 conserva batch e rispetta retryInMs; grace impedisce invii tardivi',async()=>{
 let now=0,calls=0;const q=new TapQueue('p',initial(),async()=>{calls++;throw {status:429,retryInMs:1000};},()=>{},()=>now);q.tap();await q.flush(2000);now=900;await q.flush(2000);assert.equal(calls,1);assert.equal(q.state.pending?.seq,1);now=2001;await q.flush(2000);assert.equal(calls,1);assert.equal(q.state.pending,null);assert.equal(q.stopped,true);
});
test('403 interrompe i retry automatici',async()=>{let calls=0;const q=new TapQueue('p',initial(),async()=>{calls++;throw {status:403};},()=>{},()=>0);q.tap();await q.flush(1000);await q.flush(1000);assert.equal(calls,1);assert.equal(q.stopped,true);});
