// Uses an existing Playwright installation and Chrome. Does not download browsers.
// Mock mode: LIM, regia and one phone share the same browser profile (the mock database lives in localStorage).
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext();
const errors=[];
const open=async(width,height)=>{const p=await context.newPage();await p.setViewportSize({width,height});p.on('pageerror',e=>errors.push(e.message));return p;};
const sid=`browser-${Date.now()}`,base=process.env.FRONTEND_URL||'http://localhost:5173',q=`mode=mock&s=${sid}`;
const heading=(p,name)=>p.getByRole('heading',{name,exact:true}).waitFor();
const next=async(p,n=1)=>{for(let i=0;i<n;i++){await p.bringToFront();await p.keyboard.press('ArrowRight');await p.waitForTimeout(400);}};
mkdirSync('test-results',{recursive:true});
try{
 const stage=await open(1920,1080),regia=await open(560,1400),phone=await open(390,844);
 await stage.goto(`${base}/stage?${q}`);await regia.goto(`${base}/regia?${q}`);await phone.goto(`${base}/play?${q}`);
 await phone.getByRole('textbox',{name:'Nickname'}).fill('Giulia');await phone.getByRole('button',{name:'Entra',exact:true}).click();await heading(phone,'Sei dentro.');
 await phone.reload();await heading(phone,'Sei dentro.');
 await regia.getByText('LIM collegata',{exact:true}).waitFor();
 await next(stage);await heading(phone,'Accendi il logo.');
 await phone.locator('button.light').dispatchEvent('pointerdown');await phone.locator('button.light').dispatchEvent('pointerup');
 await phone.getByText(/scritto PX#/).waitFor();
 // Our command: the swarm completes the picture through the same API, with conditional writes.
 await regia.getByRole('button',{name:'Completa il logo'}).click();
 await regia.waitForFunction(()=>document.querySelector('.big-num')?.textContent?.startsWith('252'),null,{timeout:60000});
 await stage.bringToFront();await heading(stage,'Logo completato.');
 await next(stage);await heading(stage,'Un pixel è un item.');
 await next(stage);await heading(stage,'Questo sei tu.');
 await next(stage);await heading(stage,'Una tabella, tante entità.');
 await stage.screenshot({path:'test-results/stage-table.png'});
 await next(stage,6);await phone.getByText(/squadra (arancione|viola)/).first().waitFor();
 await next(stage,5);await heading(stage,'HOT KEY');
 await stage.keyboard.press('Enter');await phone.getByRole('button',{name:'TAP',exact:true}).waitFor({timeout:10000});
 for(let i=0;i<4;i++)await phone.getByRole('button',{name:'TAP',exact:true}).dispatchEvent('pointerdown');
 await phone.getByText(/^4 punti confermati/).waitFor({timeout:10000});
 await phone.reload();await phone.getByRole('button',{name:'TAP',exact:true}).dispatchEvent('pointerdown');
 await heading(phone,'Il tuo risultato.');await phone.getByText(/^5 punti/).waitFor({timeout:20000});
 await next(stage);await heading(stage,'Cosa è appena successo.');
 await next(stage,4);await stage.waitForTimeout(2500);await next(stage);await heading(phone,'Questa tela è anche tua.');
 await stage.screenshot({path:'test-results/stage-end.png'});
 await stage.goto(`${base}/stage?mode=static&s=fallback`);
 for(let i=0;i<24;i++){await stage.waitForTimeout(1200);await stage.screenshot({path:`test-results/static-${String(i).padStart(2,'0')}.png`});await next(stage);}
 assert.deepEqual(errors,[]);
 console.log('PASS: join/reload, tap-to-reveal pixel, swarm completes the logo, pixel→item→player→table zoom, team reveal, HOT KEY tap/reload/podium, cost, end, static tour.');
}finally{await browser.close();}
