// Two things that can only be checked in a real browser, against a fake API:
//   1. The Regia must say «LIM collegata» even when the laptop clock is far from the server's. Mixing the
//      server-corrected clock with a local timestamp used to report a perfectly healthy LIM as missing.
//   2. The closing dissolve: the LIM drops each canvas item the moment its own expiresAt passes, without
//      waiting for a poll, and ends on «La tela è scaduta».
// Uses an existing Playwright installation and Chrome. Does not download browsers.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');

// The laptop runs 12 s behind AWS: more than any staleness threshold in the app, and entirely plausible
// on a machine that has just woken up. Nothing on screen may depend on this being zero.
const SKEW_MS=12_000;
// Long enough for the LIM to reach the closing scene and still show a gradual dissolve.
const WINDOW_S=14;
const sid='closing',api='http://api.test';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext();
const errors=[];
// The admin key normally travels from the Regia over BroadcastChannel; here both views start with it.
await context.addInitScript(([sid,api])=>sessionStorage.setItem(`dynamolive:admin:${api}:${sid}`,'test-admin-key'),[sid,api]);

const started=Date.now();
// expiresAt and `e` are SERVER epoch seconds, like everything the backend writes and the app compares
// against its corrected clock. Building them from the browser clock here would test the wrong thing.
const serverNow=()=>Date.now()+SKEW_MS;
let anchor=0;
const armed=()=>(anchor||=serverNow());
const deadline=()=>Math.floor((armed()+WINDOW_S*1000)/1000);
// Six items leaving one at a time, evenly spread, in the order they were lit: what dissolve() writes.
const pixels=()=>Array.from({length:6},(_,i)=>
 ({x:10+i,y:2,c:0,by:`p${i}`,t:started+i*100,e:Math.floor((armed()+(i+1)/6*WINDOW_S*1000)/1000)}));
const meta=()=>({
 sid,phase:'end',version:9,createdAt:started,phaseStartedAt:started,phaseEndsAt:null,
 canvasW:32,canvasH:18,cooldownMs:500,roundMs:15000,pixelMs:90000,canvasHidden:false,canvasRevision:3,
 teamsRevealed:true,roundId:'round',roundStartedAt:null,roundEndsAt:started-30000,tapGraceMs:2000,
 expiresAt:Math.floor(serverNow()/1000)+86400,canvasExpiresAt:deadline(),endTtlMs:WINDOW_S*1000,
 prompt:'Accendete il logo',botsEnabled:false,
});
const stats={playersJoined:12,pixelsPlaced:6,pixelConflicts:1,taps:400,teamOrange:210,teamPurple:190,
 apiCalls:900,wruTable:40,wruGsi:18,rruTable:60,rruGsi:12,lambdaMs:9000,estimated:true,
 expiresAt:Math.floor(serverNow()/1000)+86400};

await context.route(`${api}/**`,async route=>{
 const path=new URL(route.request().url()).pathname;
 let data={};
 if(path.endsWith('/meta'))data=meta();
 else if(path.includes('/canvas'))data={pixels:pixels(),cursor:Date.now(),canvasRevision:3,hidden:false,full:true};
 else if(path.endsWith('/players'))data={players:[{pid:'a',nickname:'ada',team:'orange',joinedAt:started}],total:1};
 else if(path.endsWith('/stats'))data={...stats,prices:{region:'eu-central-1',currency:'USD',verifiedAt:null,source:'test',wruMillion:0.7625,rruMillion:0.1525,httpApiMillion:1.2,lambdaRequestsMillion:0.2,lambdaGbSecond:0.0000133334,lambdaMemoryGb:0.25},costBasis:'on-demand-list-price',estimatedCost:0.0011};
 else if(path.endsWith('/leaderboard'))data={top:[{nickname:'ada',team:'orange',score:40,rank:1}],provisional:false,roundId:'round'};
 else if(path.endsWith('/admin/aws'))data={available:false,reason:'NO_CLOUDWATCH',prices:{},scope:'table-and-functions-in-region'};
 // The clock the app corrects to: the browser is SKEW_MS behind this.
 await route.fulfill({status:200,contentType:'application/json',
  headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},
  body:JSON.stringify({...data,serverTime:Date.now()+SKEW_MS})});
});

mkdirSync('test-results',{recursive:true});
const open=async(width,height)=>{const p=await context.newPage();await p.setViewportSize({width,height});p.on('pageerror',e=>errors.push(e.message));return p;};
const url=view=>`${process.env.FRONTEND_URL||'http://localhost:5173'}/${view}?s=${sid}&api=${encodeURIComponent(api)}`;
const aliveCount=async page=>Number((await page.locator('.alive').textContent()).match(/^(\d+)/)[1]);

try{
 const stage=await open(1920,1080),regia=await open(700,1400);
 await stage.goto(url('stage'));
 await regia.goto(url('regia'));

 // 1. The link indicator must not depend on the two clocks agreeing.
 await regia.getByText('LIM collegata',{exact:true}).waitFor({timeout:8000});
 await regia.getByText(/Orologio locale fuori di 1[12] s/).waitFor({timeout:8000});
 assert.equal(await regia.getByText('LIM non trovata').count(),0,'the LIM is right there');
 // Still connected after several heartbeat intervals, not just at startup.
 await regia.waitForTimeout(4000);
 await regia.getByText('LIM collegata',{exact:true}).waitFor({timeout:2000});
 await regia.screenshot({path:'test-results/closing-regia.png'});

 // 2. The closing scene: jump to it (visual only) and watch the items expire one by one.
 await stage.bringToFront();
 await stage.keyboard.press('0');
 await stage.getByRole('heading',{name:'Il ricordo resta. I dati scadono.'}).waitFor({timeout:8000});
 await stage.waitForTimeout(900); // let the scene crossfade finish, so the screenshots are usable
 const first=await aliveCount(stage);
 assert.ok(first >= 4 && first <= 6,`expected the logo still standing, got ${first}`);
 await stage.screenshot({path:'test-results/closing-start.png'});

 await stage.waitForFunction(()=>{const n=document.querySelector('.alive');return n && Number(n.textContent.match(/^(\d+)/)[1]) < 4;},null,{timeout:8000});
 const middle=await aliveCount(stage);
 assert.ok(middle < first,`the dissolve must be gradual: ${first} → ${middle}`);

 await stage.getByText('La tela è scaduta').waitFor({timeout:20000});
 await stage.getByText('00:00:00').waitFor({timeout:2000});
 assert.equal(await stage.locator('.alive').count(),0,'no live items are claimed once the TTL has passed');
 await stage.screenshot({path:'test-results/closing-end.png'});

 assert.deepEqual(errors,[]);
 console.log(`PASS: link indicator survives a ${SKEW_MS/1000}s clock skew; the canvas dissolves ${first} → ${middle} → 0 on each item's own TTL.`);
}finally{await browser.close();}
