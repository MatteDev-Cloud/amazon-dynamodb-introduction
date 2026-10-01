// Run against an existing dev server (mock) or a deployed site with QA_API and ADMIN_KEY.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const site=process.env.FRONTEND_URL||'http://127.0.0.1:5173';
const api=process.env.QA_API,key=process.env.ADMIN_KEY;
const initial=`repeatqa-${Date.now()}`;
if(api){const r=await fetch(`${api}/s/${initial}/admin/reset`,{method:'POST',headers:{'content-type':'application/json','x-admin-key':key},body:'{}'});assert.equal(r.status,201);}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext();
 if(api)await context.addInitScript(([api,sid,key])=>sessionStorage.setItem(`dynamolive:admin:${api}:${sid}`,key),[api,initial,key]);
 const stage=await context.newPage(),regia=await context.newPage();
 const query=`s=${initial}${api?'':'&mode=mock'}`;
 await stage.goto(`${site}/stage?${query}`);await regia.goto(`${site}/regia?${query}`);
 const ids=[initial];
 for(let i=0;i<5;i++){
  await regia.getByText('LIM collegata',{exact:true}).waitFor();
  await regia.getByText('Strumenti e sessione',{exact:true}).click();
  await regia.getByRole('button',{name:'Nuova sessione (riparte da zero)',exact:true}).click();
  await regia.getByRole('button',{name:'Conferma nuova sessione',exact:true}).click();
  await regia.waitForURL(url=>!ids.includes(url.searchParams.get('s')));
  const sid=new URL(regia.url()).searchParams.get('s');assert(sid.length<=48);assert.match(sid,/-run-[a-f0-9]{32}$/);
  ids.push(sid);await stage.waitForURL(url=>url.searchParams.get('s')===sid);
  await stage.getByRole('heading',{name:'Tirate fuori il telefono.'}).waitFor();
  const phone=await context.newPage();await phone.goto(`${site}/play?s=${sid}${api?'':'&mode=mock'}`);
  await phone.getByRole('textbox',{name:'Nickname'}).fill(`Player${i}`);
  await phone.getByRole('button',{name:'Entra',exact:true}).click();
  await phone.getByRole('heading',{name:'Sei dentro.'}).waitFor();await phone.reload();
  await phone.getByRole('heading',{name:'Sei dentro.'}).waitFor();await phone.close();
 }
 assert.equal(new Set(ids).size,6);
 console.log(JSON.stringify({result:'PASS',checks:['5 consecutive new sessions','stage follows regia','new player joins each session','phone reload'],sessions:ids}));
}finally{await browser.close();}
