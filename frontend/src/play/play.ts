import { PALETTE, type Meta, type Player, type JoinResponse, type PixelResponse, type RankResponse, type LeaderboardResponse } from '../../../shared/types.js';
import { Api, ApiFailure, poll } from '../shared/api';
import { config, playerKey, read, save } from '../shared/config';
import { Wall } from '../shared/canvas';
import { button, el, message, time } from '../shared/ui';
import { TapQueue, type QueueState } from './tap-queue';
export function startPlay(root:HTMLElement,api:Api){
  api.admin=''; // The phone never sends a stage credential.
  let meta:Meta|undefined,player:Player|undefined,renderKey='',nextAllowed=0,placing=false,queue:TapQueue|undefined,recovering=false;
  const shell=el('main','phone'),header=el('header','phone-header'),brand=el('span','brand','DynamoLive'),badge=el('span','eyebrow',config.mock?'DEMO · DATI SIMULATI':'LIVE'),content=el('section','phone-content'),notice=el('p','notice'),timer=el('span','timer'),status=el('span','status');notice.setAttribute('role','status');
  header.append(brand,badge);shell.append(header,status,content,notice);root.append(shell);
  const wall=new Wall(api,()=>meta),palette=el('div','palette'),cooldown=el('p','mono'),tap=button('TAP',()=>{if(meta?.phase==='hotkey_running'&&api.now()<(meta.roundEndsAt||0)&&queue?.tap()){navigator.vibrate?.(8);tap.classList.remove('hit');void tap.offsetWidth;tap.classList.add('hit');}},'tap');
  const showError=(e:unknown)=>{if(e instanceof ApiFailure&&e.code==='SESSION_NOT_FOUND'){wall.state.pixels.clear();wall.draw();content.replaceChildren(el('h1','','Sessione assente o scaduta'));renderKey='expired';}notice.textContent=message(e);if(e instanceof ApiFailure&&e.status===403){if(player)player.banned=true;draw(true);}};
  wall.onselect=()=>{palette.hidden=false;};
  PALETTE.forEach((color,c)=>{const b=button('',async()=>{
    if(!player||!meta||!wall.selected||placing||api.now()<nextAllowed||meta.phase!=='pixel')return;
    placing=true;const {x,y}=wall.selected;wall.optimistic={x,y,c,by:player.nickname,t:api.now()};wall.draw();
    try{const result=await api.call<PixelResponse>('/pixel',{pid:player.pid,x,y,c});nextAllowed=result.nextAllowedAt;player.pixelsPlaced=(player.pixelsPlaced||0)+1;notice.textContent='Pixel salvato';await wall.refresh(true);}
    catch(e){if(e instanceof ApiFailure&&e.status===429)nextAllowed=api.now()+e.retryInMs;showError(e);}
    finally{placing=false;wall.optimistic=undefined;wall.draw();}
  });b.style.background=color;b.setAttribute('aria-label',`Colore ${['bianco','nero','lime','arancione','viola','ciano','rosso','giallo'][c]}`);palette.append(b);});
  async function recover(){if(recovering)return;const pid=read<string|null>(playerKey,null);if(!pid)return;recovering=true;api.pid=pid;
    try{player=await api.call<Player>(`/player/${encodeURIComponent(pid)}`);nextAllowed=(player.lastPixelAt||0)+(meta?.cooldownMs||3000);}
    catch(e){if(e instanceof ApiFailure&&e.status===404){localStorage.removeItem(playerKey);api.pid='';}else if(e instanceof ApiFailure&&e.status===403){content.replaceChildren(el('h1','','Partecipazione sospesa'));renderKey='banned';}else showError(e);}
    finally{recovering=false;}
  }
  function join(){
    const form=el('form'),input=el('input');input.name='nickname';input.placeholder='Il tuo nickname';input.minLength=2;input.maxLength=12;input.required=true;input.setAttribute('autocomplete','nickname');input.setAttribute('aria-label','Nickname');
    const submit=el('button','primary','Entra');submit.type='submit';form.append(input,submit);
    form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{const result=await api.call<JoinResponse>('/join',{nickname:input.value.trim()});save(playerKey,result.pid);api.pid=result.pid;await recover();draw(true);}catch(error){showError(error);}finally{submit.disabled=false;}};
    content.replaceChildren(el('p','eyebrow','SIETE GIÀ NEL DATABASE'),el('h1','','Un pixel alla volta.'),el('p','muted','Scegli un nome. Il resto lo facciamo insieme.'),form);
  }
  function ensureQueue(){if(!player||!meta?.roundId||queue?.state.roundId===meta.roundId)return;
    const key=`${playerKey}:queue:${meta.roundId}`;const initial:QueueState={pending:null,queued:0,seq:player.roundId===meta.roundId?player.lastSeq||0:0,roundId:meta.roundId};
    const persisted=read<QueueState>(key,initial);
    // A lost acknowledgement keeps the exact persisted batch, even when PLAYER already includes it.
    if(!persisted.pending)persisted.seq=Math.max(persisted.seq,initial.seq);
    queue=new TapQueue(player.pid,persisted,b=>api.call('/tap',b),s=>save(key,s),()=>api.now());queue.score=player.score||0;
  }
  function draw(force=false){
    if(!meta)return;if(renderKey==='banned')return;
    const key=`${meta.phase}:${!!player}:${meta.teamsRevealed}:${!!player?.banned}`;if(!force&&key===renderKey)return;renderKey=key;
    if(player?.banned){content.replaceChildren(el('h1','','Partecipazione sospesa'));return;}
    if(!player){if(read(playerKey,null)){content.replaceChildren(el('h1','','Riconnessione…'));return;}if(['lobby','pixel'].includes(meta.phase))join();else content.replaceChildren(el('h1','','Ingresso chiuso'),el('p','','Guarda lo schermo e segui la presentazione.'));return;}
    ensureQueue();content.replaceChildren(el('p','eyebrow',player.nickname));
    if(meta.teamsRevealed)content.append(el('p',`team ${player.team}`,`Squadra ${player.team==='orange'?'arancione':'viola'}`));
    if(meta.phase==='pixel'){palette.hidden=true;content.append(el('h1','',meta.prompt),timer,wall.canvas,button('Centra tela',()=>wall.resetView(),'quiet'),el('p','muted','Tocca una cella, poi scegli il colore. Due dita per zoom e spostamento.'),palette,cooldown);void wall.refresh(true).catch(showError);}
    else if(meta.phase==='hotkey_running'){content.append(el('h1','','Fai salire la tua squadra.'),timer,tap,cooldown);tap.className=`tap ${player.team}`;}
    else if(meta.phase==='hotkey_end'){content.append(el('h1','','Il tuo risultato'),el('div','results','Consolidamento punteggi…'));}
    else if(meta.phase==='end'){const link=el('a','primary','Porta con te DynamoDB');link.href=config.document;content.append(el('h1','','Questa tela è anche tua.'),wall.canvas,link);void wall.refresh(true).catch(showError);}
    else content.append(el('h1','',meta.phase==='hotkey_ready'?'Preparati.':'Sei dentro.'),el('p','muted','Guarda lo schermo. La prossima scena arriverà qui.'));
  }
  poll(async()=>{meta=await api.call<Meta>('/meta');if(!player)await recover();ensureQueue();draw();status.textContent=api.online?'● Connesso':'Riconnessione…';wall.draw();},1500,showError);
  poll(async()=>{if(meta&&['pixel','end'].includes(meta.phase))await wall.refresh();},1000,showError);
  poll(async()=>{if(queue&&meta?.roundEndsAt){await queue.flush(meta.roundEndsAt+meta.tapGraceMs);if(queue.error)notice.textContent=queue.error;}},500,showError);
  poll(async()=>{if(player&&meta?.phase==='hotkey_end'){const [rank,lb]=await Promise.all([api.call<RankResponse>(`/rank/${player.pid}`),api.call<LeaderboardResponse>('/leaderboard?limit=3')]);const result=content.querySelector('.results');result?.replaceChildren(el('p','big',rank.rank?`${rank.rank}° su ${rank.total}`:'Hai seguito il round'),el('p','mono',`${rank.score} punti${rank.provisional?' · provvisorio':''}`),...lb.top.slice(0,3).map(p=>el('p','',`${p.rank}. ${p.nickname} · ${p.score}`)));}},1000,showError);
  setInterval(()=>{if(!meta)return;timer.textContent=time((meta.phaseEndsAt||api.now())-api.now());tap.disabled=meta.phase!=='hotkey_running'||api.now()>=(meta.roundEndsAt||0)||!!queue?.stopped;
    const remaining=Math.max(0,nextAllowed-api.now());for(const b of palette.querySelectorAll('button'))b.disabled=placing||remaining>0;
    palette.style.setProperty('--cooldown',`${Math.min(100,remaining/meta.cooldownMs*100)}%`);
    cooldown.textContent=meta.phase==='pixel'?`${remaining>0?`Attendi ${(remaining/1000).toFixed(1)} s · `:''}${player?.pixelsPlaced||0} pixel piazzati`:`${queue?.score||0} punti confermati · ${(queue?.state.queued||0)+(queue?.state.pending?.delta||0)} in coda`;
    status.textContent=api.online?'● Connesso':'Rete assente · riconnessione automatica';},100);
  window.addEventListener('online',()=>{void wall.refresh(true).catch(showError);});
}
