# Contratto condiviso DynamoLive — v1

Stato: interfaccia implementativa proposta dall'agente A; pronta per la revisione dell'agente B. I tipi canonici sono in `shared/types.ts`. Gli adattamenti qui descritti precisano la bozza `01_` senza modificare i documenti originali.

## Trasporto e credenziali

Base locale `http://localhost:3001`, prefisso `/s/{sid}`; sid 1–48 caratteri ASCII alfanumerici, `_` o `-`. JSON UTF-8; ogni risposta include `serverTime` in millisecondi. Errori `{error,message,serverTime,retryInMs?}`. Header admin `x-admin-key`, mai nell'URL. Il frontend deve chiedere la chiave al presentatore e conservarla solo nella sessione; non inserirla nella build.

Il pid è una credenziale bearer: join, il proprietario e lo stage autenticato lo ricevono. `GET /player/{pid}` richiede `x-player-id` uguale al pid oppure la chiave admin. Le API di gioco accettano pid nel body. Lobby, item grezzi dei pixel, STATS e Inspector richiedono admin; la classifica pubblica non espone pid. Non loggare body o chiavi. CORS limita browser consentiti, non sostituisce l'autorizzazione.

| Metodo e suffisso | Input | Risposta oltre a serverTime |
|---|---|---|
| POST `/join` | `{nickname}` | `{pid,team,nickname}`; ammesso lobby/pixel |
| GET `/meta` | — | `Meta` (campi in shared/types.ts) |
| GET `/players` | admin | `{players:[{pid,nickname,team,joinedAt}],total}`; pid serve per selezionare il JSON sullo stage |
| GET `/player/{pid}` | proprietario/admin | item PLAYER grezzo |
| GET `/canvas` | — | `CanvasResponse`, snapshot completo, lettura forte |
| GET `/canvas/changes` | `since=<cursor>&revision=<canvasRevision>` | `CanvasResponse` |
| GET `/pixel/{x}/{y}` | admin | item pixel grezzo |
| POST `/pixel` | `{pid,x,y,c}` | `{ok:true,nextAllowedAt}` |
| POST `/tap` | `{pid,delta,seq,roundId}` | `{score,acceptedSeq,duplicate}` |
| GET `/leaderboard` | `limit=1..100`, default 10 | `{top:[{nickname,team,score,rank}],provisional,roundId}` |
| GET `/rank/{pid}` | proprietario/admin | `{rank,total,score,provisional}` |
| GET `/stats` | admin | `StatsResponse`: campi Stats, prices, estimatedCost, costBasis |
| POST `/admin/phase` | `{phase,expectedVersion,durationMs?}` | META aggiornato |
| POST `/admin/hide` | `{hidden:boolean}` | META aggiornato |
| POST `/admin/clear` | `{x1,y1,x2,y2}` inclusivi | `{deleted,canvasRevision}` |
| POST `/admin/ban` | `{pid}` | `{ok:true}` |
| POST `/admin/reset` | configurazione SessionConfig opzionale | META iniziale; solo sid nuovo, 409 se esiste |
| POST `/admin/bots` | `{enabled:boolean}` | META aggiornato |

Errori principali: 400 input, 401 admin/proprietario non autorizzato, 403 bannato, 404 sessione/item assente o scaduto, 409 fase/versione/sequenza non valida, 429 cooldown/rate limit, 503 conflitto transitorio o backend non disponibile. Per 429 usare retryInMs; per 503 backoff con jitter. Non riprovare automaticamente input 400/403.

## Regia, timer e reload

Transizioni sequenziali: lobby → pixel → pixel_frozen → talk → hotkey_ready → hotkey_running → hotkey_end → end. Una richiesta per la fase corrente è idempotente. I salti/ritorni del deck puramente visuali non devono riavviare giochi o retrocedere META: per una nuova prova creare un sid nuovo. `expectedVersion` impedisce due comandi admin concorrenti. Hide/bots aggiornano anch'essi version: ricaricare META dopo 409.

Pixel e HOT KEY scadono secondo il tempo server, anche senza stage connesso; la prima richiesta successiva materializza pixel_frozen/hotkey_end. Non è un timer in background. Passare a hotkey_end prima del termine tronca il round; end è ammesso solo dopo la finestra finale di tap. `teamsRevealed` diventa true entrando in talk. Il telefono non mostra team prima di allora, pur avendolo ricevuto al join.

Default: 48×27, cooldown 3000 ms, pixel 90000 ms, round 15000 ms, grace tap 2000 ms. Prompt provvisorio configurabile: «Scrivete DDB». Nickname non univoci. Una sola partita HOT KEY per sid. Date in ms, TTL in secondi. La scadenza sessione è fissata alla creazione a +24h (non ricalcolata alla fine per evitare un aggiornamento non atomico di tutti gli item); l'app filtra subito gli scaduti, AWS li elimina asincronamente.

Persistenza telefono: chiave localStorage per sid contenente pid; al reload GET player con x-player-id e GET meta. 404: eliminare il pid salvato e proporre join se ancora aperto. Compensare l'orologio dal punto medio richiesta/risposta e serverTime.

## Pixel e recupero tela

Cooldown e pixel vengono scritti in una transazione insieme al conteggio STATS e a un controllo META: niente cooldown consumato se il pixel fallisce. Questa scelta promuove la transazione da L2 per evitare errori parziali. Timestamp per cella monotono tramite condizione: un aggiornamento vecchio non può sovrascriverne uno più recente.

Conservare `cursor` restituito dal server, non l'ora del telefono. L'indice ByTime legge con overlap 2s; applicare un pixel solo se t è maggiore di quello già noto. `deleted:true` è una tombstone: rimuovere il colore e conservare t. I clear incrementano canvasRevision. Revision diversa, cursore troppo vecchio (>30s) o futuro producono uno snapshot `full:true`. Richiedere comunque `/canvas` ogni 15s e a ogni riconnessione: un GSI non garantisce un limite massimo di ritardo. Uno snapshot sostituisce l'intera tela. Evitare richieste canvas sovrapposte per non applicare snapshot fuori ordine. Quando hidden=true, svuotare la visualizzazione; le letture pubbliche restituiscono zero pixel, l'admin può ancora leggere per moderare.

## Tap, idempotenza e punteggi

Un solo batch in volo per telefono. Accumulare tap ogni 500ms, delta 1..12, seq da 1 e progressivo senza buchi. Conservare lo stesso `{roundId,seq,delta}` a ogni retry. L'ack duplicato restituisce 200 senza contare nuovamente. Il server accetta solo `lastSeq+1`; un vecchio seq diverso dall'ultimo restituisce 409. Dopo reload leggere lastSeq/score dal player; un batch persistito va ritentato prima del successivo.

Limite server: bucket temporali da 500ms, massimo 12 tap per bucket, più limite cumulativo rispetto al tempo trascorso del round. Client e server non si fidano del timestamp inviato dal telefono. Dopo roundEndsAt sono accettati entro 2s i batch pendenti con il medesimo roundId e nei limiti; il frontend congela il bottone alla scadenza e scarica la coda. Non è possibile provare che un tap remoto sia avvenuto prima della scadenza: la grace è un compromesso esplicito.

Update PLAYER e incremento STATS (squadra, taps) avvengono nella stessa transazione, con controllo META: i totali non dipendono dalla memoria Lambda. Il costo/contesa della hot key è intenzionale a questa scala. In hotkey_running la classifica usa ByScore eventualmente consistente; in hotkey_end/end deriva da Query forte dei giocatori e rimane `provisional:true` fino alla fine della grace. Parità: ordine score desc, joinedAt asc, pid asc; rank ordinale. Posizione nulla per chi non ha giocato; total conta i partecipanti al round.

## Inspector, misure e bot

`x-inspect: 1` funziona solo insieme ad admin. `_inspect` mantiene op/params/consumed/ddbMs/items per il riepilogo e aggiunge operations per tutte le chiamate. I parametri mostrati sono strutturali: nessuna credenziale/pid nei valori. Costi da ReturnConsumedCapacity INDEXES, con unità tabella/GSI separate; transazioni e aggiornamenti degli indici possono costare più di una semplice scrittura.

Solo la telemetria economica usa buffer per container con flush atteso nelle richieste dopo 2s; può perdere la coda se un container sparisce. STATS marca estimated=true; non è una fattura. Join/pixel/tap sono invece conteggi persistenti transazionali. Il costo include capacità misurata, richieste HTTP API/Lambda e durata osservata a 256MB; esclude storage, hosting, trasferimenti, log, crediti e imposte. Prezzi in USD in shared/pricing.ts, verificati per Francoforte il 21 settembre 2026; fonti e SKU in shared/pricing-sources.json. Null significa dato non verificato e vieta di mostrare un totale come verificato. costBasis è sempre on-demand-list-price: su DEV provisioned o Local mostra una proiezione equivalente. consumed.read/write separano le unità lette e scritte, anche nelle transazioni.

`/admin/bots` salva solo botsEnabled. Un runner Node esterno, avviato esplicitamente sul portatile, fa polling e usa la stessa API pubblica dei telefoni. La Lambda non avvia processi persistenti. Il tasto B funziona se questo runner è attivo; L cambia base URL e sid, non migra lo stato cloud. I bot devono essere riconoscibili come simulati (prefisso bot nei nickname).

## Correzioni didattiche da recepire dall'agente B

Sort key differenti non garantiscono partizioni fisiche differenti: pixel e giocatori condividono rispettivamente una partition key per sessione. Distinguere contesa sul singolo item e distribuzione fisica. TTL indica scadenza logica; non una cancellazione puntuale. ByTime rappresenta lo stato più recente di ogni cella, non una cronologia utilizzabile per un replay. Le proiezioni ×1000 sono esclusivamente visuali. Revisione tecnica dei contenuti finali ancora da effettuare quando saranno disponibili.
