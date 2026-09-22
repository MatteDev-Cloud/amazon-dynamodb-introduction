# 01 — Giochi e specifica tecnica

> Stato: **bozza da validare in Fase 1** (vedi `04_TASKS_ROADMAP.md`).
> Tutto ciò che è marcato `[L2]` è opzionale, da fare se avanza tempo.

---

## 1. Flusso comune

### 1.1 Join (uno solo per entrambi i giochi)

1. Il pubblico scansiona il QR e si apre `/play?s=<sid>`.
2. L'utente inserisce un nickname: 2–12 caratteri, filtro parolacce lato server.
3. Il server crea l'item giocatore e restituisce `pid`, `team` e `nickname`. Il `pid` resta in `localStorage`: se il telefono ricarica la pagina, il giocatore non rientra da capo.
4. Il telefono mostra "Sei dentro. Guarda lo schermo 👀".

La squadra si calcola come `team = hash(pid) % 2` (🟠 `orange` / 🟣 `purple`). **Non viene mostrata subito**: la si rivela sulla slide 4 ("le vostre squadre le ha decise un hash").

**Idea didattica:** l'item giocatore **cresce** durante il talk. Al join ha solo `nickname` e `team`; dopo Pixel Wall compaiono `pixelsPlaced` e `lastPixelAt`; dopo HOT KEY `score`. È lo schema flessibile, mostrato dal vivo.

### 1.2 Regia: le fasi

Le fasi vivono nell'item `META`. Lo stage le cambia (endpoint admin) quando si avanza di slide. I telefoni fanno polling su `GET /meta` ogni **1,5s** e cambiano schermata da soli.

| Fase | Stage | Telefono |
|---|---|---|
| `lobby` | QR + nomi che compaiono | "Sei dentro, aspetta" |
| `pixel` | Tela live + timer 90s | **Tela attiva** |
| `pixel_frozen` | Tela congelata (usata in slide 3–4) | "Guarda lo schermo 👀" |
| `talk` | Slide teoriche | "Guarda lo schermo" + squadra (dopo la slide 4) |
| `hotkey_ready` | Regole + 3-2-1 | "Preparati!" + colore squadra |
| `hotkey_running` | Barre live + tiro alla fune + X-Ray | **Bottone TAP** + countdown |
| `hotkey_end` | Podio | "Sei 7° su 43" + top 3 |
| `end` | Tela finale + countdown TTL + QR documento | Tela finale + link al documento |

Il campo `META.version` si incrementa a ogni cambio: il telefono ridisegna la schermata solo se la versione cambia.

---

## 2. PIXEL WALL

### 2.1 Regole (come le spiegate al pubblico)

> "Avete una tela in comune. Toccate un quadratino e scegliete un colore. Dopo ogni pixel dovete aspettare 3 secondi. Avete 90 secondi: provate a disegnare insieme [prompt]."

- **Tela:** 48×27 pixel (16:9, 1.296 celle).
- **Palette:** 8 colori (vedi `02_` §Identità visiva).
- **Cooldown:** 1,5 secondi per giocatore, **fatto rispettare dal database** (condition expression), non solo dal client.
- **Conflitti:** se due persone colorano lo stesso pixel, **vince l'ultimo**.
- **Durata:** 90 secondi, poi la tela si congela.
- **Prompt:** da decidere. Opzioni: "scrivete DDB", "un cuore al centro", "il logo della scuola", tela libera.

### 2.2 Telefono

- Tela resa con `<canvas>` (non 1.296 elementi DOM), con pinch-zoom e pan.
- Tap su una cella → palette a comparsa → tap sul colore → invio.
- Mentre la richiesta viaggia, il pixel appare **subito** in versione ottimistica, semitrasparente; se il server rifiuta, torna com'era.
- Anello di cooldown attorno alla palette e contatore "pixel piazzati: 12".
- Delta polling ogni **1s**.

### 2.3 Stage

- Tela a tutto schermo, con i pixel nuovi che "pulsano" per 300 ms.
- Al passaggio del mouse (usato dal presentatore) compare `nickname` e l'ora del pixel. Il clic su un pixel apre il suo JSON: serve per la slide 3.
- Timer, contatore "pixel piazzati" e tassametro nell'angolo.
- Delta polling ogni **500 ms**.

### 2.4 Cosa insegna

- Item come documento.
- **Chiave naturale** `PX#012#007`, zero-padded perché l'ordinamento è lessicografico.
- **Condition expression** (cooldown).
- **Upsert / last writer wins.**
- **GSI per query temporali** (delta).
- **Tante chiavi diverse, traffico distribuito:** è il contrasto con HOT KEY.

### 2.5 Moderazione (obbligatoria)

Su una tela proiettata, prima o poi qualcuno disegna qualcosa di inappropriato. Servono:
- filtro sui nickname lato server (lista di parole IT + EN);
- scorciatoie admin sullo stage: **F** congela, **H** nasconde la tela (mostra un pattern neutro), **Shift+C** cancella un rettangolo selezionato;
- possibilità di bannare un `pid` (i suoi pixel non vengono più accettati).

---

## 3. HOT KEY

### 3.1 Regole (come le spiegate al pubblico)

> "Squadra arancione contro squadra viola. Avete 15 secondi. Tappate il più velocemente possibile. Conta il punteggio personale, ma anche quello della squadra."

- **Round:** 15 secondi, uno solo (più un eventuale secondo round se avanza tempo in prova).
- **Punteggio:** 1 punto per tap, con un **limite di 24 tap al secondo** (anti-autoclicker).
- **Classifica:** top 10 individuale più tiro alla fune tra le squadre.
- **Fine round:** podio sullo stage; ogni telefono mostra la propria posizione.

### 3.2 Telefono

- Bottone enorme del colore della squadra, con feedback visivo a ogni tap (vibrazione solo su Android: `navigator.vibrate` non funziona su iOS).
- Countdown sincronizzato su `META.phaseEndsAt` (con compensazione del clock tramite `serverTime`).
- **Batching:** i tap si accumulano e ogni **500 ms** parte `POST /tap {delta, seq}`. Se la chiamata fallisce, il delta resta in coda e viene rimandato.
- A fine round: `GET /rank/{pid}` → "Sei 7° su 43".

### 3.3 Stage

- 3-2-1 grande, poi il round.
- Top 10 come barre orizzontali animate (FLIP animation sui sorpassi).
- Barra delle squadre in alto (tiro alla fune da `STATS`).
- X-Ray aperto di default a lato.
- Leaderboard in polling ogni **1s**, `STATS` ogni 1s.
- A fine round, il podio con i top 3.

### 3.4 Il momento "Hot Key"

I punteggi individuali stanno su item diversi: il traffico è distribuito. I totali di squadra stanno invece **tutti nello stesso item `STATS`**: è una **hot key**.

A questa scala regge, ma il messaggio da dire è: *"se foste un milione, quell'item sarebbe il nostro collo di bottiglia → write sharding o aggregazione via Streams"*. Lo si approfondisce nel documento (cap. 3.5).

Mitigazione nel codice (e da raccontare come scelta di design): la Lambda aggrega i delta di squadra in memoria e li scrive su `STATS` ogni ~2s.

### 3.5 Il glitch onesto

Il telefono può mostrare 312 mentre la classifica dice 309 per un istante. Non è un bug: il GSI è **eventually consistent**. Se succede, indicatelo. Se non succede, mostratelo nell'X-Ray (timestamp dell'item contro timestamp della lettura).

### 3.6 Cosa insegna

- **Contatore atomico** (`ADD`): 50 persone scrivono in parallelo senza lock e senza perdere conteggi.
- **GSI già ordinato**: la classifica è una domanda progettata prima.
- **Sparse index**: nel GSI entra solo chi ha tappato.
- **Hot key.**
- **Eventual consistency.**
- **Idempotenza** tramite `seq`.

---

## 4. Modello dati

### 4.1 Tabella `DynamoLive`

- Chiave primaria: `PK` (S) + `SK` (S).
- Modalità: **on-demand** su LIVE; provisioned 25/25 o Local su DEV.
- TTL: attributo `expiresAt` (epoch in **secondi**), impostato alla fine della sessione + 24h.

| Entità | PK | SK | Attributi |
|---|---|---|---|
| Meta sessione | `SESSION#<sid>` | `META` | `phase`, `version` (N), `phaseStartedAt`, `phaseEndsAt` (ms), `canvasW`, `canvasH`, `cooldownMs`, `roundMs`, `canvasHidden` (BOOL), `expiresAt` |
| Statistiche | `SESSION#<sid>` | `STATS` | `playersJoined`, `pixelsPlaced`, `taps`, `teamOrange`, `teamPurple`, `apiCalls`, `wruTable`, `wruGsi`, `rruTable`, `rruGsi`, `expiresAt` |
| Giocatore | `SESSION#<sid>` | `PLAYER#<pid>` | `nickname`, `team`, `joinedAt`, `lastPixelAt`?, `pixelsPlaced`?, `score`?, `lastSeq`?, `lb`?, `banned`?, `expiresAt` |
| Pixel | `CANVAS#<sid>` | `PX#<xxx>#<yyy>` | `color` (N, 0–7), `by` (nickname), `byId` (pid), `cv` (= sid), `updatedAt` (N, ms), `expiresAt` |

Gli attributi con `?` vengono aggiunti solo quando servono: è lo schema flessibile.

### 4.2 GSI

| GSI | PK | SK | Proiezione | Uso |
|---|---|---|---|---|
| `ByTime` | `cv` (S) | `updatedAt` (N) | INCLUDE `color`, `by` | Pixel cambiati dopo t |
| `ByScore` | `lb` (S) | `score` (N) | INCLUDE `nickname`, `team` | Classifica |

Entrambi sono **sparse**: `cv` esiste solo sui pixel, `lb` solo sui giocatori che hanno tappato. META, STATS e i giocatori non finiscono nei GSI sbagliati.

**Nota economica** (da mostrare nel tassametro): **ogni scrittura che tocca un attributo indicizzato genera anche una scrittura nel GSI.** Pixel e tap costano quindi il doppio in WRU.

### 4.3 Access pattern

| # | Domanda | Operazione |
|---|---|---|
| AP1 | Crea giocatore | `PutItem PLAYER` + `attribute_not_exists(PK)` |
| AP2 | Stato sessione | `GetItem META` (in Lambda con cache 1s) |
| AP3 | Lobby: chi c'è | `Query PK=SESSION#sid, begins_with(SK,"PLAYER#")` (solo lo stage, ogni 2s, `ProjectionExpression nickname`) |
| AP4 | Piazza pixel (cooldown) | `UpdateItem PLAYER SET lastPixelAt=:now ADD pixelsPlaced :1` con `ConditionExpression: (attribute_not_exists(lastPixelAt) OR lastPixelAt <= :now - :cd) AND attribute_not_exists(banned)` → poi `PutItem PIXEL` |
| AP5 | Tela intera | `Query PK=CANVAS#sid` (≈1.296 item, ≈100 KB, una pagina) |
| AP6 | Pixel cambiati | `Query ByTime cv=:sid AND updatedAt > :since - 2000` |
| AP7 | Tap | `UpdateItem PLAYER ADD score :d SET lb=:sid, lastSeq=:seq` con `ConditionExpression: attribute_not_exists(lastSeq) OR lastSeq < :seq` |
| AP8 | Top 10 | `Query ByScore lb=:sid`, `ScanIndexForward=false`, `Limit=10` |
| AP9 | Posizione del giocatore | `Query ByScore` completa (≤ qualche centinaio di item), calcolo in Lambda, cache 2s |
| AP10 | Tassametro / squadre | `GetItem STATS` |
| AP11 | "Questo sei tu" | `GetItem PLAYER` / `GetItem PIXEL` |

Il "-2000 ms" di AP6 compensa il ritardo del GSI, e i duplicati si scartano lato client confrontando `updatedAt`.

**`[L2]` Transazioni:**
- AP4 come `TransactWriteItems` (cooldown + pixel insieme o niente). È un esempio ACID reale, ma costa il doppio e può fallire per conflitti → serve un retry.
- Nickname univoci: `TransactWriteItems` tra `PLAYER` e un item di prenotazione `SK=NICK#<lowercase>`, con `attribute_not_exists`.

### 4.4 Esempi di item

```json
{ "PK": "SESSION#talk-01", "SK": "PLAYER#7f3a9c", "nickname": "giulia", "team": "orange",
  "joinedAt": 1791150000000, "pixelsPlaced": 14, "lastPixelAt": 1791150131000,
  "score": 312, "lb": "talk-01", "lastSeq": 30, "expiresAt": 1791237600 }

{ "PK": "CANVAS#talk-01", "SK": "PX#012#007", "color": 3, "by": "giulia", "byId": "7f3a9c",
  "cv": "talk-01", "updatedAt": 1791150131000, "expiresAt": 1791237600 }
```

---

## 5. Contratto API (bozza)

Base: `https://<api-id>.execute-api.eu-central-1.amazonaws.com`. Tutte le risposte includono `serverTime` (ms).

| Metodo | Path | Body / query | Risposta | Chi |
|---|---|---|---|---|
| POST | `/s/{sid}/join` | `{nickname}` | `{pid, team, nickname}` · `400` nickname non valido · `409` fase ≠ lobby/pixel | Telefono |
| GET | `/s/{sid}/meta` | – | `{phase, version, phaseEndsAt, canvasW, canvasH, cooldownMs, canvasHidden}` | Tutti |
| GET | `/s/{sid}/canvas` | – | `{pixels:[{x,y,c,by,t}]}` | Tutti |
| GET | `/s/{sid}/canvas/changes` | `?since=<ms>` | `{pixels:[…]}` | Tutti |
| POST | `/s/{sid}/pixel` | `{pid,x,y,c}` | `{ok, nextAllowedAt}` · `429 {retryInMs}` · `409` fase errata · `403` bannato | Telefono |
| POST | `/s/{sid}/tap` | `{pid, delta, seq}` | `{score}` · `409` fase errata | Telefono |
| GET | `/s/{sid}/leaderboard` | `?limit=10` | `{top:[{nickname,team,score}]}` | Stage |
| GET | `/s/{sid}/rank/{pid}` | – | `{rank, total, score}` | Telefono |
| GET | `/s/{sid}/player/{pid}` | – | Item grezzo | Stage |
| GET | `/s/{sid}/pixel/{x}/{y}` | – | Item grezzo | Stage |
| GET | `/s/{sid}/stats` | – | Item STATS | Stage |
| POST | `/s/{sid}/admin/phase` | `{phase, durationMs?}` | META aggiornato | Stage (admin) |
| POST | `/s/{sid}/admin/clear` | `{x1,y1,x2,y2}` | `{deleted}` | Stage (admin) |
| POST | `/s/{sid}/admin/ban` | `{pid}` | `{ok}` | Stage (admin) |
| POST | `/s/{sid}/admin/hide` | `{hidden}` | `{ok}` | Stage (admin) |
| POST | `/s/{sid}/admin/reset` | – | Ricrea META/STATS | Script / stage |

**Admin:** header `x-admin-key`, confrontato con un parametro SAM `NoEcho` passato come variabile d'ambiente.

**Validazioni lato server:**
- `x`/`y` dentro la tela, `c` tra 0 e 7;
- `delta` tra 1 e 12;
- `seq` intero crescente;
- nickname con regex `^[\p{L}\p{N}_.-]{2,12}$` + filtro parole.

**CORS:** consentito solo il dominio CloudFront (più `localhost` su DEV).

---

## 6. X-Ray

Pannello laterale dello stage, attivato con il tasto **I**. **Non è AWS X-Ray**: è puro frontend.

**Funzionamento:**
- Lo stage invia l'header `x-inspect: 1`.
- La Lambda risponde con in più:

```json
"_inspect": {
  "op": "Query",
  "params": { "TableName": "DynamoLive", "IndexName": "ByScore",
              "KeyConditionExpression": "lb = :s", "ScanIndexForward": false, "Limit": 10 },
  "consumed": { "table": 0, "gsi": { "ByScore": 0.5 } },
  "ddbMs": 4.2,
  "items": 10
}
```

- `consumed` arriva da `ReturnConsumedCapacity: "INDEXES"`.
- `ddbMs` si misura con `performance.now()` attorno alla chiamata SDK.
- Lo stage calcola `totalMs` (round-trip completo) e mostra **"DynamoDB 4 ms · rete + Lambda 70 ms"**.

**Sezioni del pannello:**
1. **Richiesta:** l'ultima Query dello stage, con syntax highlighting.
2. **Risposta:** i primi 3 item grezzi, troncati.
3. **Costo:** RRU/WRU della chiamata, separati tra tabella e GSI.
4. **Latenza:** barra DB contro totale.
5. **Feed scritture** (etichetta "ricostruito dalle letture"): pixel nuovi da AP6 e punteggi cambiati tra due letture della classifica.

**Costo:** nessun servizio aggiuntivo, qualche centinaio di byte per risposta, solo sulle chiamate dello stage.

---

## 7. Tassametro

Widget fisso in un angolo dello stage dal minuto 0. Può espandersi a tutto schermo nella slide 7.

```
🟢 LIVE
Richieste         12.418
Scritture DB       4.203
  di cui GSI       1.870
Letture DB         9.550 RRU
Server gestiti         0
────────────────────────
Costo stimato   € 0,0041
```

### Dati reali

- Ogni invocazione Lambda accumula in variabili di modulo: `apiCalls`, `wruTable`, `wruGsi`, `rruTable`, `rruGsi` (dai `ConsumedCapacity`) più i contatori di gioco.
- **Flush:** alla prima invocazione dopo 2s dall'ultimo flush, parte un solo `UpdateItem STATS ADD …`. Il consumo del flush stesso finisce nel flush successivo. Niente scrittura per richiesta: sarebbe una hot key costosa.
- I container Lambda in pausa possono trattenere pochi secondi di dati: il valore è una **stima**, e l'etichetta lo dice.

### Formula

```
costo = wru * P_WRU + rru * P_RRU + apiCalls * (P_APIGW + P_LAMBDA_REQ) + apiCalls * durata_media_s * 0.25GB * P_GBs
```

I prezzi vanno in `shared/config.ts`. **⚠️ DA VERIFICARE sul listino ufficiale per `eu-central-1`.** Ordini di grandezza (us-east-1): WRU on-demand ≈ 0,625 $/milione, RRU ≈ 0,125 $/milione, HTTP API ≈ 1 $/milione, Lambda ≈ 0,20 $/milione richieste. Se si mostra in euro, dichiarare il cambio usato.

### Proiezione "Ora siamo mille" (simulata)

- Selettore **×1 · ×1.000 · ×1.000.000**: moltiplica richieste, scritture e costo.
- Sulla tela o sulle barre compaiono puntini simulati, **solo visivi, nessuna scrittura**.
- Didascalia fissa: **"Proiezione a listino, non un test di carico."**
- Punto di confronto: "Prime Day 2025: picco di 151M richieste/s su DynamoDB".

---

## 8. Scorciatoie dello stage

| Tasto | Azione |
|---|---|
| → / ← | Slide successiva / precedente (e cambio fase dove previsto) |
| I | X-Ray on/off |
| M | Tassametro: angolo ↔ a tutto schermo |
| F | Congela la tela |
| H | Nascondi la tela (moderazione) |
| Shift+C | Cancella il rettangolo selezionato |
| B | Bot on/off (piano B) |
| L | Passa alla modalità locale (API su localhost) |
| P | Panico: apre il video di backup |
| 1–9 | Salta alla slide N (solo in prova) |

---

## 9. Bot (piano B e prove)

Script Node che usano **la stessa API** dei telefoni (quindi scrivono davvero su DynamoDB):

- `pixel-bot.ts --sid talk-01 --n 30`: disegna gradualmente un pattern predefinito (per esempio la scritta "DDB"), rispettando il cooldown.
- `hotkey-bot.ts --sid talk-01 --n 40`: tap casuali tra 4 e 10 al secondo, nickname credibili.

Si avviano con il tasto **B** (lo stage fa partire un endpoint admin) o da terminale. **Il pubblico non deve notare la differenza.**

---

## 10. Stretch goal `[L2]`

- `TransactWriteItems` per cooldown + pixel e per i nickname univoci.
- **Streams → Lambda aggregatore** per i totali di squadra: risolve la hot key "come si fa davvero".
- Secondo round di HOT KEY con squadre scelte dal pubblico, per confronto.
- Replay time-lapse della tela in chiusura, via `Query ByTime` dall'inizio.
