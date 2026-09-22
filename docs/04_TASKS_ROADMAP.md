# 04 — Tasks, roadmap, piano B, checklist

> Ogni task ha una checkbox. Gli owner li decidete voi (scrivete le iniziali accanto).
> ⛔ = **critical path**: se slitta, slitta tutto.
> `[L2]` = opzionale.

**Data del talk:** `____` · **Session id del talk:** `talk-01`

---

## Fase 0 — Verifiche bloccanti (½ giorno) ⛔

- [ ] Data di scadenza del Free plan dei 2 account **dopo** la data del talk
- [ ] Budget alarm: DEV 1 $, LIVE 2 $
- [ ] MFA sull'utente root di entrambi gli account
- [ ] Utente o ruolo IAM per il deploy (niente root), profili AWS CLI `dev` e `live`
- [ ] Quota di concorrenza Lambda in *Service Quotas* (se è molto bassa, richiedere un aumento subito)
- [ ] Regione confermata (`eu-central-1`)
- [ ] Repo Git creato con la struttura di `00_` §6

**Output:** account pronti, repo inizializzato.

## Fase 1 — Design dati e contratto (1–2 giorni) ⛔

- [ ] Rivedere insieme `01_GIOCHI_SPEC.md` §4 (tabella, GSI, access pattern) e congelarlo
- [ ] Congelare il contratto API (`01_` §5): nomi, payload, codici di errore
- [ ] Congelare le fasi di META e le transizioni (`01_` §1.2)
- [ ] Definire il formato di `_inspect` e dei campi di STATS
- [ ] Decidere i parametri: tela, cooldown, durata del round, prompt (vedi "Decisioni aperte")
- [ ] Tipi TypeScript condivisi (`shared/types.ts`) generati dal contratto

**Output:** spec congelata. Da qui si lavora in parallelo.

## Fase 2 — Scheletro (2 giorni)

- [ ] `template.yaml`: tabella + 2 GSI + TTL, Lambda, HTTP API con CORS, bucket S3 + CloudFront (OAC), parametro `AdminKey` NoEcho
- [ ] Primo deploy su DEV
- [ ] Docker con DynamoDB Local + `scripts/seed-local.ts` (crea tabella e sessione)
- [ ] `backend/local-server.ts` che riusa l'handler
- [ ] SPA Vite: route `/play` e `/stage`, `shared/api.ts` con base URL configurabile (`?api=local`)
- [ ] Motore deck minimale: frecce, slide come componenti, registry delle scorciatoie
- [ ] `tokens.css` con le variabili della direzione visuale

**Output:** "hello world" end-to-end aperto da un telefono reale su DEV.

## Fase 3 — Giochi (4–5 giorni)

### 3a. Join + regia ⛔ (per prima: regge tutto)
- [ ] `POST /join` con validazione del nickname e filtro parole
- [ ] Hash per la squadra
- [ ] `GET /meta` con cache di 1s nella Lambda
- [ ] `POST /admin/phase` + auth tramite `x-admin-key`
- [ ] Telefono: macchina a stati per fase, polling META 1,5s, `pid` in localStorage, ripristino dopo reload
- [ ] Stage: avanzare di slide chiama `admin/phase` dove previsto
- [ ] Compensazione del clock con `serverTime`

### 3b. PIXEL WALL
- [ ] `POST /pixel` con il cooldown condizionale (AP4) e la gestione di 429/409/403
- [ ] `GET /canvas` e `GET /canvas/changes` (GSI `ByTime`, finestra -2000 ms, dedup lato client)
- [ ] Telefono: `<canvas>`, zoom/pan, palette, pixel ottimistico, anello di cooldown
- [ ] Stage: tela grande, pulsazione dei pixel nuovi, hover con nickname, clic → JSON del pixel
- [ ] Moderazione: freeze, hide, clear rettangolo, ban `pid`

### 3c. HOT KEY
- [ ] `POST /tap` con `ADD`, `seq` idempotente, limite sul delta, controllo della fase
- [ ] Aggregazione dei totali di squadra in memoria → flush su STATS
- [ ] `GET /leaderboard` (GSI `ByScore`) e `GET /rank/{pid}` con cache di 2s
- [ ] Telefono: bottone, batching ogni 500 ms con coda di retry, countdown, schermata della posizione finale
- [ ] Stage: 3-2-1, barre con animazione FLIP, tiro alla fune, podio

**Output:** entrambi i giochi giocabili su DEV con 3–4 telefoni.

## Fase 4 — X-Ray e tassametro (1–2 giorni)

- [ ] `lib/inspect.ts`: `_inspect` solo con l'header `x-inspect: 1`, `ReturnConsumedCapacity: INDEXES`, misura di `ddbMs`
- [ ] `lib/meter.ts`: accumulo di modulo + flush ogni 2s su STATS
- [ ] Stage: pannello X-Ray (richiesta, risposta, costo, latenza, feed "ricostruito")
- [ ] Widget tassametro (angolo ↔ tutto schermo) con prezzi in `config.ts` **verificati**
- [ ] Proiezione ×1.000 / ×1.000.000 con puntini simulati e didascalia fissa

## Fase 5 — Slide e contenuti (3–4 giorni, in parallelo con 3–4)

- [ ] Slide 1–8 come componenti (`02_PRESENTAZIONE.md` §3)
- [ ] SVG dei cassetti (slide 4) e dell'architettura (slide 6)
- [ ] Slide 3 "Questo sei tu": selezione di un giocatore e di un pixel reali con JSON evidenziato
- [ ] Slide 4: animazione dei nickname che cadono nei cassetti + rivelazione delle squadre sui telefoni
- [ ] Scena C: tela finale con il countdown TTL + QR al documento
- [ ] Versione **statica** di tutte le slide (screenshot/dati congelati) per il fallback
- [ ] Script parlato per scena (apertura, concetti, ponte, chi parla)
- [ ] Documento di approfondimento: bozza dei capitoli (`03_`), cross-review, verifiche, export in PDF
- [ ] Capitolo 3.6 con le tabelle dei giochi aggiornate alla versione finale

## Fase 6 — Piano B (1–2 giorni)

- [ ] `bots/pixel-bot.ts` (disegna un pattern) e `bots/hotkey-bot.ts` (tap realistici)
- [ ] Tasto **B** sullo stage che avvia o ferma i bot
- [ ] Modalità locale completa: DynamoDB Local + local-server + stage con `?api=local`, tasto **L**
- [ ] Font e asset tutti in locale (niente CDN a runtime)
- [ ] Registrazione del **video di backup** di un talk completo su LIVE, tasto **P**
- [ ] `scripts/reset-session.ts` per creare una sessione pulita in un comando

## Fase 7 — Test (2 giorni)

- [ ] Deploy su LIVE
- [ ] Test con **15+ telefoni veri** (iOS Safari, Android Chrome, almeno un telefono vecchio)
- [ ] Test sul proiettore reale (leggibilità, contrasto, dimensione del QR dall'ultima fila)
- [ ] Test sulla **rete reale della sala** (o un hotspot equivalente)
- [ ] Prova di fallback forzato: staccare il Wi-Fi a metà demo
- [ ] Confronto tra il tassametro e i costi reali in Cost Explorer (dopo 24h)
- [ ] Prova di moderazione: qualcuno disegna "male", voi lo cancellate in meno di 5s

## Fase 8 — Prove (2–3 sessioni)

- [ ] Prova a tempo, da soli (obiettivo 14:15)
- [ ] Prova con un pubblico di test che gioca davvero
- [ ] Prova generale su LIVE il giorno prima, con una sessione nuova
- [ ] Ogni fallback eseguito almeno una volta in prova

---

## Critical path

```
F0 verifiche → F1 spec congelata → F3a join + regia → F3b/F3c giochi
   → integrazione nel deck (F5) → F7 test telefoni + sala → F8 prova generale
```

I due punti più rischiosi:
1. **La regia META:** se i telefoni non seguono le slide, crolla il concept "presentazione continua".
2. **Il test sulla rete della sala:** va fatto il prima possibile, non l'ultimo giorno.

---

## Piano B (livelli)

| Livello | Problema | Azione | Il pubblico se ne accorge? |
|---|---|---|---|
| 0 | Prevenzione | Deploy congelato 48h prima; `/meta` verificato 10' prima; Lambda pre-riscaldata | No |
| 1 | Wi-Fi della sala giù | Il pubblico usa i dati mobili; il portatile va in hotspot | No |
| 2 | Pochi giocatori / join lenti | **B** → bot sulla stessa API reale | Praticamente no |
| 3 | AWS irraggiungibile | **L** → modalità locale (DynamoDB Local) + bot locali | No, se si gioca solo sullo stage |
| 4 | Tutto giù | **P** → video di backup ("ecco com'è andata in prova") | Sì, ma gestito |
| – | Contenuto inappropriato | **H** / **F** / **Shift+C** / ban | Al massimo 2–3 secondi |

**Regola operativa:** se a 20" dall'apertura del gioco ci sono meno di 10 giocatori, si attivano i bot.

---

## Registro rischi

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| Free plan scaduto o crediti finiti | Bassa | Fatale | Fase 0, budget alarm |
| Rete della sala | Media | Alto | Dati mobili, hotspot, modalità locale |
| Disegni inappropriati | Alta | Medio | Moderazione + filtro nickname |
| Telefoni iOS con comportamenti diversi | Media | Medio | Test in Fase 7 |
| Sforamento dei tempi | Alta | Medio | Prove a tempo, scene tagliabili (5 e 8 comprimibili a 30") |
| Throttling / limiti Lambda | Bassa | Alto | On-demand su LIVE, quota verificata |
| Proiettore che slava i colori scuri | Media | Basso | Token CSS, direzione B pronta |

---

## Checklist

### Settimana prima
- [ ] Codice congelato e deployato su LIVE
- [ ] Test con 15+ telefoni superato
- [ ] Proiettore e rete della sala testati
- [ ] Tutti i fallback provati
- [ ] Documento finito, verificato, raggiungibile dal QR
- [ ] 3 prove a tempo fatte

### Giorno prima
- [ ] `reset-session.ts --sid talk-01` eseguito
- [ ] Docker + DynamoDB Local avviabili offline
- [ ] Video di backup su un secondo dispositivo
- [ ] Batterie cariche: portatile, 2 telefoni, powerbank

### 10 minuti prima
- [ ] `/meta` risponde e lo stage è in `lobby`
- [ ] Lambda pre-riscaldata (2–3 chiamate)
- [ ] Hotspot pronto
- [ ] QR testato dall'ultima fila
- [ ] Scorciatoie ripassate; X-Ray e tassametro visibili
- [ ] Notifiche del portatile disattivate

### Dopo
- [ ] Screenshot della tela finale e della classifica (per il documento)
- [ ] Fase `end` impostata; eventuale limitazione dell'API pubblica
- [ ] Controllo dei costi reali dopo 24–48h

---

## Decisioni aperte

- [x] ~~Nome del pannello~~ → confermato: **X-Ray** (nome interno; collide volutamente col nome del servizio AWS X-Ray, va chiarito a voce durante il talk)
- [x] ~~Tela 48×27 e cooldown 3s~~ → tela confermata 48×27 invariata; cooldown ridotto a **1,5 s** (con 20-25 giocatori concorrenti attesi, 3s rendeva il gioco troppo lento)
- [x] ~~Prompt di Pixel Wall~~ → confermato: «Scrivete DDB»
- [x] ~~Nickname univoci sì/no~~ → confermato: **no**, restano non univoci (evita la complessità di una transazione dedicata al join)
- [x] ~~Cooldown con `TransactWriteItems`~~ → già implementato: sì, cooldown e scrittura pixel condividono la stessa transazione (vedi `06_CONTRATTO_CONDIVISO.md`)
- [x] ~~Tassametro in € o $~~ → già implementato: **USD**, prezzi verificati per Francoforte (vedi `shared/pricing.ts`)
- [x] ~~Stile visivo~~ → abbandonato il «Dark tech» neon: direzione **editoriale chiara** (carta, inchiostro blu notte, accento vermiglio, Fraunces + IBM Plex + JetBrains Mono); il Pixel Wall resta l'unico oggetto nero. Frontend riscritto in **Svelte 5 + GSAP**
- [x] ~~Pixel Wall~~ → tela **32×18** che parte nera e nasconde il **logo DynamoDB** in pixel-art; «tap = rivela» (colore deciso dal logo); cooldown **500 ms**; conflitti **first-writer-wins** con 409 `PIXEL_TAKEN` e contatore `pixelConflicts`; prompt «Accendete il logo»
- [x] ~~Completamento della tela~~ → **sciame dal pannello di regia** («Completa il logo»): giocatori virtuali che scrivono in parallelo con la stessa API, per mostrare la concorrenza
- [x] ~~Comandi sulla LIM~~ → spostati in una finestra **regia** separata (`/regia`, popup da secondo schermo, collegata via BroadcastChannel); sulla LIM nessun pulsante
- [x] ~~Flusso delle slide~~ → scene a passi e navigazione per interazione: dal Pixel Wall si tocca un pixel per zoomare sul suo item, poi sull'autore («Questo sei tu»), poi sulla tabella. «Questo sei tu» viene prima di «Natale 2004»
- [ ] Chi parla in quale scena (script, Fase 5) — bozza P1/P2 pronta in `docs/contenuti/SCRIPT_PARLATO.md`, resta da assegnare alle due persone reali
