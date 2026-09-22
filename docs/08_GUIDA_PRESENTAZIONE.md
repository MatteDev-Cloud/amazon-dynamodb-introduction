# DynamoLive - guida di presentazione e consegna agente B

## Consegna

SPA Vite + TypeScript vanilla con `/play` e `/stage`; API sul contratto v1 e tipi importati da `shared/types.ts`. Sono inclusi giochi, regia, QR generati nel browser, X-Ray, tassametro, mock esplicito, fallback statico, font locali con licenze, diagrammi SVG, copione e approfondimento Markdown/PDF.

File comuni, backend, bot, infrastruttura e documenti originali non sono stati modificati. Le dipendenze aggiunte sono esclusivamente in `frontend/`: Vite/TypeScript per la build e qrcode per il QR. Nessuna installazione globale, nessun DynamoDB/Java/Docker installato o avviato su questa macchina. Per verifiche browser e PDF sono stati usati Chrome e strumenti già presenti. La cartella node_modules non va trasferita: usare il lockfile sulla macchina di destinazione.

## Avvio sulla macchina di destinazione

Node.js 22.12+ e npm. Per backend e database seguire `07_GUIDA_TECNICA.md`. Da questa guida non vengono sostituite le istruzioni del proprietario del backend.

Da radice del repository:

```sh
npm --prefix frontend ci
```

Tre file di esempio, uno per ciascun ambiente, non uno solo ambiguo: copiare quello giusto in base a cosa si sta facendo, senza sovrascrivere una configurazione già presente.

| File di esempio | Uso | Comando che lo legge |
| --- | --- | --- |
| `frontend/.env.development.example` → `.env.development` | Iterazione locale, backend locale | `npm run dev` |
| `frontend/.env.dev.example` → `.env.dev` | Build per lo stack AWS `dynamolive-dev` | `npm run build:dev` |
| `frontend/.env.live.example` → `.env.live` | Build per lo stack AWS `dynamolive-live` (il talk) | `npm run build:live` |

Esempio PowerShell per lo sviluppo locale:

```powershell
Copy-Item frontend/.env.development.example frontend/.env.development
```

Per i build di deploy, copiare `.env.dev.example`/`.env.live.example` nell'equivalente senza `.example` e compilare gli URL reali (API Gateway e CloudFront) dopo il deploy SAM descritto in `07_GUIDA_TECNICA.md`.

Impostazioni:

| Variabile | Significato |
| --- | --- |
| VITE_API_BASE | URL del backend raggiungibile dal browser |
| VITE_SESSION | sid predefinito; iniziale prova-01 (talk-01 in `.env.live`) |
| VITE_PUBLIC_ORIGIN | Origine pubblica/LAN della SPA per i QR (solo dev/live, non serve in locale) |
| VITE_DOCUMENT_URL | Link al PDF; predefinito /dynamolive-approfondimento.pdf |
| VITE_BACKUP_URL | Video locale; predefinito /backup.mp4 |
| VITE_LOCAL_API | API da usare con L (solo dev/live: fallback verso il backend locale) |
| VITE_LOCAL_SESSION | Sessione già preparata per L (solo dev/live) |

Le variabili VITE sono pubbliche e incorporate alla build. Non inserirvi credenziali. La chiave admin si inserisce nel pannello Regia e resta in sessionStorage, distinta per API e sid. Il telefono invia soltanto la propria credenziale pid.

```sh
npm --prefix frontend run dev
```

Aprire `http://localhost:5173/stage?s=prova-01` e `http://localhost:5173/play?s=prova-01`. Le API e la sessione devono già esistere. Se il sid è nuovo, Regia offre «Crea questa sessione»: chiama admin/reset, che rifiuta sessioni già esistenti. Per una nuova prova scegliere sempre un nuovo sid.

In LAN, impostare VITE_PUBLIC_ORIGIN con l'IP del portatile, per esempio `http://192.168.1.20:5173`, e VITE_API_BASE con `http://192.168.1.20:3001`. Aggiungere quell'origine a ALLOWED_ORIGINS nel backend e impostare HOST come indicato dalla guida A. `localhost` sul telefono indica il telefono stesso. Per il talk usare HTTPS CloudFront.

## Build e distribuzione

```sh
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build:dev   # oppure build:live per lo stack del talk
npm --prefix frontend run preview
```

La build produce `frontend/dist`, pronta per l'hosting già definito dall'agente A. Il PDF viene copiato fra gli asset pubblici; font e QR non dipendono da CDN durante il talk. Distribuire tramite la procedura SAM/S3/CloudFront della guida tecnica. Nessun deploy è stato eseguito in questa consegna.

La build include il mock in un chunk separato, caricato soltanto con `mode=mock`. La SPA richiede un browser moderno con supporto a ES2022; validare in particolare i telefoni meno recenti prima della presentazione.

## Tre modalità distinte

- **API reali**: modalità predefinita. Nessuna sostituzione automatica dei dati in caso di rete assente. Lo stato di connessione e gli errori restano visibili.
- **Mock**: `/stage?mode=mock&s=prova-ui` e `/play?mode=mock&s=prova-ui`, nella stessa origine e nello stesso profilo browser. Il database dimostrativo usa localStorage; non sincronizza dispositivi diversi. La dicitura DEMO/SIMULATO resta visibile. Nuova prova = nuovo sid. Non simula integralmente conflitti, throttling e latenze del servizio; l'X-Ray non inventa capacità misurate. Il comando bot modifica il flag, ma non esiste un runner mock.
- **Statico**: `/stage?mode=static`. Undici scene senza chiamate API, con dati esemplificativi dichiarati, tela congelata, JSON, podio e costo dimostrativo. Frecce e salti navigano senza cambiare una sessione. Il QR della lobby rimane un link alla destinazione configurata: non abilita una partita offline sui telefoni.

Nessuna modalità riproduce uno storico dei pixel: ByTime contiene gli ultimi stati, non una cronologia.

## Sequenza e scorciatoie

| Posizione | Scena | Effetto in avanti |
| --- | --- | --- |
| 1 | Tirate fuori il telefono | Lobby |
| 2 | PIXEL WALL | Avvia pixel, 90 secondi di default |
| 3 | Natale 2004 | Congela pixel se ancora attivo |
| 4 | Questo sei tu | Rimane pixel_frozen |
| 5 | La chiave decide dove vivi | Talk e rivelazione squadre |
| 6 | Prima le domande | Rimane talk |
| 7 | Zero server (nostri) | hotkey_ready |
| 8 | HOT KEY | Attende il pulsante 3-2-1, poi avvia round |
| 9 | Cosa è appena successo | hotkey_end |
| 10 | Non è più semplice | Rimane hotkey_end |
| 11 | Il ricordo | end, solo dopo grace finale |

Le fasi sono monotone. Indietro non modifica META; i tasti 1-8 saltano alle slide numerate soltanto visivamente. Non usare i salti per preparare un round: per le transizioni seguire la sequenza, oppure tornare alla scena corrispondente alla fase corrente e avanzare. Una richiesta rifiutata non fa avanzare il deck. Dopo 409 il client rilegge META; controllare lo stato e ripetere il comando appropriato.

| Tasto | Azione |
| --- | --- |
| Frecce | Scena precedente/successiva |
| 1-8 | Slide numerata, salto solo visuale |
| I | X-Ray |
| M | Tassametro espanso/compatto |
| F | Congela Pixel Wall |
| H | Nasconde/mostra la tela |
| Shift+C | Cancella rettangolo selezionato |
| B | Abilita/disabilita flag bot |
| L | Cambia API e sid alla configurazione locale |
| P | Apre video backup |

Le scorciatoie sono sospese mentre si scrive in un campo o un dialogo è aperto. Il pulsante Tema cambia tra Dark tech e carta, con IBM Plex locale. Il mock e lo statico non devono essere presentati come live.

## Pixel, moderazione e dati reali

Sul telefono: tap su cella, scelta colore, anteprima semitrasparente; cooldown sia visivo sia applicato dal backend. Pinch per zoom, trascinamento per pan, «Centra tela» per ripristinare. La scrittura fallita rimuove l'anteprima. Lo snapshot periodico ripara i delta mancanti.

Sul palco: hover per autore/orario, clic per JSON. Nella slide «Questo sei tu» scegliere un giocatore dal menu e un pixel dalla tela. Gli item provengono dagli endpoint admin; i pid non compaiono nella classifica pubblica.

Per contenuti inappropriati: H immediato, F se la tela è attiva. Clic sul primo angolo, Shift+clic sull'ultimo, poi Shift+C. Il backend richiede la tela congelata; la selezione è evidenziata in rosso. Il dialogo del pixel offre «Escludi autore». Dopo la cancellazione controllare lo snapshot, poi H per mostrare. Un ban impedisce nuove scritture; i totali storici non vengono sottratti automaticamente.

## HOT KEY e riconnessione

Il timer usa serverTime compensato sul punto medio della richiesta. I tap vengono accodati fino a dodici per batch. Un solo batch viaggia per volta; roundId, seq e delta sono persistiti prima dell'invio. Dopo reload un batch con risposta persa viene ritentato invariato, anche se PLAYER ha già il suo punteggio.

429 rispetta retryInMs; rete/503 usano backoff. Errori permanenti interrompono i retry. Allo zero il bottone si blocca e i batch possono essere scaricati entro la grace del backend. Una connessione persa oltre questa finestra può perdere tap non confermati. Il punteggio mostrato distingue confermati e in coda; il risultato ufficiale è quello di rank/leaderboard. Non promettere recupero illimitato.

Il GSI può ritardare durante il round. Il podio resta provvisorio fino alla fine della grace; non annunciare vincitori prima del consolidamento. La classifica anima i cambi di posizione: nickname identici nella stessa squadra non permettono identità visuali certe senza un identificativo pubblico aggiuntivo, quindi i dati restano corretti ma l'animazione può essere ambigua.

## X-Ray e costi

Il pannello mostra operazioni, parametri strutturali, capacità, estratto della risposta e tempo DB rispetto al totale. Il residuo non è una misura isolata della rete. Il feed indica esplicitamente che è ricostruito dalle letture, sia per pixel sia per punteggi.

Il costo è espresso in USD e arriva da estimatedCost, con prezzi del backend. Null significa «Non verificato». Il conteggio delle unità distingue tabella e GSI. La telemetria economica è approssimata; storage, hosting, log e altri costi esclusi sono dichiarati. In Local/DEV il valore è una proiezione equivalente a listino on-demand, non una fattura. I moltiplicatori sono soltanto grafici.

## Bot, locale e backup

Avviare `npm run bot:runner -- --sid SID --n 20` sulla macchina che esegue il runner, con l'API corretta. Abilitare B in lobby/pixel, prima della chiusura del join. Il tasto B non lancia processi nella Lambda. I nomi bot rimangono riconoscibili.

Prima della prova preparare VITE_LOCAL_API e VITE_LOCAL_SESSION e creare la sessione locale. L ricarica lo stage su quell'ambiente; credenziali e giocatori della sessione cloud non vengono trasferiti. Reimmettere la chiave locale in Regia.

P apre `public/backup.mp4` o VITE_BACKUP_URL. Il video completo non è stato registrato: richiede una prova integrata. Se manca, il dialogo lo segnala e resta disponibile il fallback statico. Dopo la registrazione copiare il file nella cartella pubblica e rifare la build. Provare la riproduzione offline prima del talk.

## Materiali

- `docs/contenuti/SCRIPT_PARLATO.md`: copione P1/P2, durata obiettivo 14:15 comprensiva di giochi e pause.
- `docs/contenuti/APPROFONDIMENTO.md`: sorgente del documento.
- `docs/contenuti/DynamoLive-approfondimento.pdf`: dieci pagine, copia distribuita in `frontend/public/`.
- `docs/contenuti/build_pdf.py`: rigenerazione facoltativa con Python e reportlab; non serve per avviare o distribuire l'app. Riusa i font locali e gli SVG.
- `docs/contenuti/REVISIONE_CONTRATTO_B.md`: revisione del contratto e richiesta di revisione tecnica all'agente A.

Il PDF di ricerca iniziale non era nel checkout; il testo è una stesura autonoma. Il link al repository pubblico e il video sono da completare con il team. La cornice «Natale 2004» è indicata come narrativa, senza spacciare il grafico illustrativo per misura storica.

## Verifiche e prove ancora necessarie

Eseguite su questa macchina: typecheck/build frontend; cinque test su delta/tombstone, batch persistiti, ack perso, serializzazione, 429/grace e 403; percorso browser mock da join a end, reload durante HOT KEY, moderazione hide/freeze, proiezioni e navigazione delle undici scene statiche. Chrome già installato, viewport desktop 1440×1000 e telefono 390×844. Verificato anche il client HTTP con fixture: 429, recupero rete, giocatore assente dopo reload e separazione header proprietario/admin. PDF renderizzato e controllato, dieci pagine senza pagine orfane.

Test browser riproducibili, se Playwright e Chrome sono già disponibili:

```sh
# Dentro frontend, con dev server attivo:
node tests/browser.mjs
node tests/network.mjs
```

Se Playwright è fornito da un runtime esterno, impostare PLAYWRIGHT_MODULE al percorso del suo pacchetto. Non è una dipendenza necessaria della demo e non vengono scaricati browser dagli script. `network.mjs` usa risposte HTTP simulate sul contratto: verifica il client fetch e il recupero, non il database.

Ancora da eseguire: integrazione frontend/API contro DynamoDB Local sulla macchina di destinazione; deploy DEV/LIVE; iOS/Android reali; quindici o più telefoni; proiettore e QR dall'ultima fila; rete della sala; prova cronometrata a due voci; video; confronto Cost Explorer; revisione tecnica dei contenuti da parte dell'agente A. Le prove riportate nella guida A non sono state ripetute né attribuite a questa sessione.
