// Contract fixture for exercising the real fetch client; this is not DynamoDB integration.
import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();const page=await context.newPage({viewport:{width:390,height:844}});
let requests=[],broken=false,missing=false,nextAt=0;const now=Date.now();const meta={sid:'network',phase:'pixel',version:2,phaseStartedAt:now,phaseEndsAt:now+90000,canvasW:48,canvasH:27,cooldownMs:3000,roundMs:15000,pixelMs:90000,canvasHidden:false,canvasRevision:0,teamsRevealed:false,roundId:null,roundStartedAt:null,roundEndsAt:null,tapGraceMs:2000,expiresAt:Math.floor(now/1000)+86400,prompt:'Scrivete DDB',botsEnabled:false};
await context.route('http://api.test/**',async route=>{
 const request=route.request();requests.push({url:request.url(),headers:request.headers(),body:request.postDataJSON()});if(broken)return route.abort('internetdisconnected');
 let data={},status=200;const path=new URL(request.url()).pathname;
 if(path.endsWith('/meta'))data=meta;
 else if(path.endsWith('/join'))data={pid:'person',nickname:'Marta',team:'orange'};
 else if(path.includes('/player/')){if(missing){status=404;data={error:'PLAYER_NOT_FOUND',message:'Player not found'};}else data={PK:'SESSION#network',SK:'PLAYER#person',pid:'person',nickname:'Marta',team:'orange',joinedAt:now,expiresAt:meta.expiresAt};}
 else if(path.includes('/canvas'))data={pixels:[],cursor:Date.now(),canvasRevision:0,hidden:false,full:true};
 else if(path.endsWith('/pixel')){status=429;nextAt=Date.now()+3000;data={error:'COOLDOWN',message:'Attendere',retryInMs:3000};}
 await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body:JSON.stringify({...data,serverTime:Date.now()+1500})});
});
try{
 await page.goto(`${process.env.FRONTEND_URL||'http://localhost:5173'}/play?s=network&api=http%3A%2F%2Fapi.test`);
 await page.getByRole('textbox',{name:'Nickname'}).fill('Marta');await page.getByRole('button',{name:'Entra',exact:true}).click();await page.getByRole('heading',{name:'Scrivete DDB'}).waitFor();
 await page.locator('canvas.wall').click({position:{x:100,y:60}});await page.getByRole('button',{name:'Colore lime'}).click();await page.getByText('Attendere',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('[aria-label="Colore lime"]').disabled);assert(nextAt>0);
 broken=true;await page.getByText('Rete assente · riconnessione automatica',{exact:true}).waitFor();broken=false;await page.getByText('● Connesso',{exact:true}).waitFor();
 missing=true;await page.reload();await page.getByRole('textbox',{name:'Nickname'}).waitFor();
 assert(requests.some(r=>r.url.includes('/player/person')&&r.headers['x-player-id']==='person'));assert(requests.every(r=>!r.headers['x-admin-key']));
 console.log('PASS: fetch HTTP, 429 cooldown/rollback, network recovery, missing player reload, owner header, no admin credential on phone.');
}finally{await browser.close();}
