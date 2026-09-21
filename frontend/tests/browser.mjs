// Uses an existing Playwright installation and Chrome. Does not download browsers.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext();const stage=await context.newPage();const phone=await context.newPage();
await stage.setViewportSize({width:1440,height:1000});await phone.setViewportSize({width:390,height:844});
const errors=[];for(const p of [stage,phone])p.on('pageerror',e=>errors.push(e.message));
const sid=`browser-${Date.now()}`,base=process.env.FRONTEND_URL||'http://localhost:5173';
const heading=async(p,text)=>p.getByRole('heading',{name:text,exact:true}).waitFor();
try{
 await stage.goto(`${base}/stage?mode=mock&s=${sid}`);await phone.goto(`${base}/play?mode=mock&s=${sid}`);
 await phone.getByRole('textbox',{name:'Nickname'}).fill('Giulia');await phone.getByRole('button',{name:'Entra',exact:true}).click();await heading(phone,'Sei dentro.');
 assert.equal(await phone.locator('.team').count(),0);
 await phone.reload();await heading(phone,'Sei dentro.');
 await stage.keyboard.press('ArrowRight');await heading(phone,'Scrivete DDB');
 await phone.locator('canvas.wall').click({position:{x:120,y:70}});await phone.getByRole('button',{name:'Colore lime',exact:true}).click();await phone.getByText('Pixel salvato',{exact:true}).waitFor();
 await phone.waitForFunction(()=>document.querySelector('[aria-label="Colore lime"]').disabled);
 await stage.keyboard.press('h');await stage.waitForFunction(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('dynamolive:mockdb:')))).meta.canvasHidden);
 await stage.keyboard.press('h');await stage.keyboard.press('f');await heading(phone,'Sei dentro.');
 await stage.keyboard.press('ArrowRight');await stage.keyboard.press('ArrowRight');await heading(stage,'Questo sei tu.');
 await stage.getByRole('combobox').selectOption({label:'Giulia'});await stage.getByText('"pixelsPlaced":',{exact:true}).waitFor();
 await stage.keyboard.press('ArrowRight');await phone.getByText('Squadra arancione',{exact:true}).waitFor();
 await stage.keyboard.press('ArrowRight');await stage.keyboard.press('ArrowRight');await heading(phone,'Preparati.');
 await stage.keyboard.press('ArrowRight');await stage.getByRole('button',{name:'Avvia 3 · 2 · 1'}).click();await phone.getByRole('button',{name:'TAP',exact:true}).waitFor();
 for(let i=0;i<4;i++)await phone.getByRole('button',{name:'TAP',exact:true}).click();
 await phone.waitForFunction(()=>document.querySelector('.phone-content>.mono')?.textContent?.startsWith('4 punti'));
 await phone.reload();await phone.getByRole('button',{name:'TAP',exact:true}).waitFor();
 await phone.getByRole('button',{name:'TAP',exact:true}).click();
 await phone.screenshot({path:'test-results/phone-hotkey.png',fullPage:true});
 await heading(phone,'Il tuo risultato');await phone.getByText('5 punti',{exact:true}).waitFor({timeout:10000});
 await stage.keyboard.press('ArrowRight');await heading(stage,'Cosa è appena successo.');await stage.getByRole('button',{name:'×1000',exact:true}).click();await stage.getByText('Proiezione a listino, non un test di carico.',{exact:true}).waitFor();
 await stage.keyboard.press('ArrowRight');await stage.keyboard.press('ArrowRight');await heading(phone,'Questa tela è anche tua.');
 await stage.screenshot({path:'test-results/stage-end.png',fullPage:true});
 await stage.goto(`${base}/stage?mode=static&s=fallback`);for(let i=0;i<11;i++){await stage.screenshot({path:`test-results/static-${i}.png`,fullPage:true});if(i<10)await stage.keyboard.press('ArrowRight');}
 assert.deepEqual(errors,[]);console.log('PASS: join, reload, team secrecy, pixel/cooldown, hide/freeze, real-shaped JSON, phase sync, tap/reload, podium, projection, end, 11 static scenes.');
}finally{await browser.close();}
