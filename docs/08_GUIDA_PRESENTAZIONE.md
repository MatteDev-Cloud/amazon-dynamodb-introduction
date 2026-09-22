# DynamoLive - guida di presentazione e consegna agente B

## Consegna

SPA Vite + Svelte 5 (TypeScript) con tre viste: `/stage` per la LIM, `/regia` per il secondo schermo del presentatore, `/play` per i telefoni; API sul contratto v1 e tipi importati da `shared/types.ts`. Sono inclusi giochi, regia, QR generati nel browser, X-Ray, tassametro, mock esplicito, fallback statico, font locali con licenze, diagrammi SVG, copione e approfondimento Markdown/PDF.

File comuni, backend, bot, infrastruttura e documenti originali non sono stati modificati. Le dipendenze sono esclusivamente in `frontend/`: Vite/TypeScript/Svelte per la build, GSAP per le animazioni, qrcode per il QR, il font Fraunces via `@fontsource-variable` (impacchettato nella build, nessun CDN). Nessuna installazione globale, nessun DynamoDB/Java/Docker installato o avviato su questa macchina. Per verifiche browser e PDF sono stati usati Chrome e strumenti già presenti. La cartella node_modules non va trasferita: usare il lockfile sulla macchina di destinazione.

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

## Direzione visiva

Direzione «editoriale chiara»: fondo carta `#F3EEE4`, inchiostro blu notte `#1A2238`, accento vermiglio `#D9531E` (PK), blu `#4148C8` (SK e indici), squadre arancione `#E0662A` e viola `#6C4AD6`. Titoli in Fraunces (serif, corsivo per le parole chiave), testo in IBM Plex Sans, dati in JetBrains Mono. L'unico oggetto nero è il Pixel Wall, una matrice di pallini LED. Tutti i colori sono variabili CSS in `frontend/src/styles/app.css`.

La LIM è una scena fissa 1920×1080 scalata a tutto schermo (bande laterali su proiettori 4:3 o 16:10): impaginazione identica su qualsiasi schermo. Ogni scena entra dalla direzione di viaggio e si costruisce a passi (il telecomando fa avanzare prima i passi, poi la scena). Sulla LIM non compaiono pulsanti di comando: solo la barra di avanzamento e il tassametro.

## Tre viste e il pannello di regia

- **LIM** `/stage?s=SID`: il contenuto per il pubblico. Senza chiave admin mostra un riquadro «Collega il pannello di regia»; premere **R** per aprire la regia in una finestra popup, da trascinare sul secondo schermo.
- **Regia** `/regia?s=SID` (stessi parametri): chiave admin, Avanti/Indietro, elenco scene (salto solo visuale), note per chi parla, Pixel Wall con mini-tela e sagoma del logo (visibile solo qui), sciame «Completa il logo», moderazione, «Avvia 3 · 2 · 1», strumenti (X-Ray, tassametro, bot runner, video, ricarica LIM, crea sessione, locale), registro errori. La regia comunica con la LIM via BroadcastChannel: stesso browser, stesso profilo, stessa origine. La chiave inserita in regia arriva alla LIM e resta in sessionStorage.
- **Telefono** `/play?s=SID`.

I tasti freccia e il telecomando funzionano sia sulla LIM sia sulla regia (quella con il focus). Un «avanti» premuto mentre la LIM attende l'API resta in coda e viene eseguito subito dopo; non fa però mai partire da solo il round HOT KEY.

## Tre modalità distinte

- **API reali**: modalità predefinita. Nessuna sostituzione automatica dei dati in caso di rete assente. Lo stato di connessione compare in alto a destra sulla LIM; gli errori vanno nel registro della regia (sulla LIM compaiono solo se la regia non è collegata).
- **Mock**: `/stage?mode=mock&s=prova-ui`, `/regia?mode=mock&s=prova-ui` e `/play?mode=mock&s=prova-ui`, nella stessa origine e nello stesso profilo browser. Il database dimostrativo usa localStorage: non sincronizza dispositivi diversi e ospita un solo telefono per profilo. Simula logo, conflitti `PIXEL_TAKEN` e sciame; non simula throttling e latenze del servizio; l'X-Ray non inventa capacità misurate. La dicitura DEMO resta visibile.
- **Statico**: `/stage?mode=static`. Dieci scene senza chiamate API, con dati esemplificativi dichiarati (logo completo, item, tabella, squadre, podio, scontrino). Il QR della lobby resta un link alla destinazione configurata.

Nessuna modalità riproduce uno storico dei pixel: ByTime contiene gli ultimi stati, non una cronologia.

## Sequenza e scorciatoie

| # | Scena | Passi | Effetto in avanti |
| --- | --- | --- | --- |
| 1 | Tirate fuori il telefono | QR e nomi | lobby |
| 2 | Accendete il logo (Pixel Wall) | tela live → zoom su un pixel → chi l'ha acceso → una tabella | pixel (90 s); dal 2° passo pixel_frozen |
| 3 | Natale 2004 | traffico → crollo → linea del tempo | rimane pixel_frozen |
| 4 | La chiave decide dove vivi | hash nei cassetti → sort key → squadre | talk al 3° passo: squadre rivelate insieme ai telefoni |
| 5 | Prima le domande | due mondi → access pattern/GSI → Query contro Scan | rimane talk |
| 6 | Zero server (nostri) | richieste reali che scorrono | hotkey_ready |
| 7 | HOT KEY | regole → 3·2·1 → round → podio | il round parte solo con Invio o «Avvia 3 · 2 · 1» |
| 8 | Cosa è appena successo | scontrino → ×1.000 → ×1.000.000 | hotkey_end |
| 9 | Non è più semplice | sì → no | rimane hotkey_end |
| 10 | Il ricordo | TTL e QR | end, solo dopo la grace finale |

«Questo sei tu» non è più una slide separata: si raggiunge toccando un pixel sulla LIM (la tela si ingrandisce sul pallino e mostra il suo item con PK/SK spiegate), poi toccando l'autore (compare l'item del giocatore accanto a quello del pixel), poi la tabella con tutte le entità. Con il telecomando gli stessi passi arrivano con Avanti: la LIM sceglie un pixel acceso da una persona (non da un bot). Toccare un pixel durante il gioco non congela la tela; Esc o «Torna alla tela» tornano indietro.

Le fasi sono monotone. Indietro e i salti non modificano META. Una richiesta rifiutata non fa avanzare il deck; dopo 409 il client rilegge META e l'errore compare nella regia.

| Tasto (sulla LIM) | Azione |
| --- | --- |
| → · PagGiù · Spazio | Passo o scena successiva |
| ← · PagSu | Passo o scena precedente (solo visuale) |
| Invio | Avvia 3·2·1 nella scena HOT KEY |
| Esc | Chiude lo zoom sul pixel |
| 1-9, 0 | Salto visuale alla scena 1-10 |
| R | Apre la regia in popup |
| I | X-Ray |
| M | Mostra/nasconde il tassametro |
| F | Congela Pixel Wall |
| H | Nasconde/mostra la tela |
| P | Video di backup |

## Pixel Wall

La tela (32×18) parte tutta nera e nasconde la reinterpretazione pixel-art dell'icona DynamoDB: 252 celle. Sul telefono c'è un solo grande pulsante «Accendi un pixel» (si può tenere premuto): il telefono sceglie a caso una cella ancora spenta del logo e la scrive. Il cooldown è di 500 ms. Dopo ogni scrittura il telefono mostra la SK scritta (es. `PX#012#005`) e cerchia di bianco i propri pixel sulla mini-tela. Se qualcuno ha acceso la stessa cella un istante prima, il server risponde 409 `PIXEL_TAKEN` e il telefono prova subito un'altra cella: il cooldown non viene consumato.

Sulla LIM i pallini compaiono con un'animazione nell'ordine temporale delle scritture; accanto: pixel accesi su 252, scritture al secondo con grafico, conflitti gestiti (dal contatore STATS), giocatori. I conflitti dello sciame compaiono anche come anelli rossi sulla cella contesa. A logo completo il titolo diventa «Logo completato.» e la tela fa un riflesso.

**Completa il logo (sciame).** I partecipanti reali non bastano a finire: verso la fine, in regia, «Completa il logo». La regia fa entrare N giocatori virtuali (`bot.01`…, regolabili 4–40, predefinito 16) che scrivono in parallelo le celle mancanti attraverso la stessa API dei telefoni; scegliendo a caso, a fine corsa si contendono le stesse celle e i conflitti diventano visibili. Serve la fase `pixel` (la tela non deve essere già congelata). Con DynamoDB Local le transazioni sono lente (circa 8 scritture/s con 16 scrittori su questa macchina); su AWS la latenza è molto più bassa. Da provare in DEV prima del talk per scegliere il numero di scrittori.

Moderazione dalla regia: «Nascondi tela» subito, «Congela ora» se la tela è attiva; sulla mini-tela clic sul primo angolo e Shift+clic sull'ultimo, poi «Cancella rettangolo» (richiede tela congelata). «Escludi autore» banna l'autore del pixel selezionato. Le celle cancellate tornano accendibili. Un ban impedisce nuove scritture; i totali storici non vengono sottratti.

## HOT KEY e riconnessione

Il timer usa serverTime compensato sul punto medio della richiesta. I tap vengono accodati fino a dodici per batch. Un solo batch viaggia per volta; roundId, seq e delta sono persistiti prima dell'invio. Dopo reload un batch con risposta persa viene ritentato invariato, anche se PLAYER ha già il suo punteggio.

429 rispetta retryInMs; rete/503 usano backoff. Errori permanenti interrompono i retry. Allo zero il bottone si blocca e i batch possono essere scaricati entro la grace del backend. Il punteggio mostrato distingue confermati e in coda; il risultato ufficiale è quello di rank/leaderboard.

Sulla LIM: barra tiro alla fune arancione/viola, classifica con animazione dei sorpassi, e l'item `STATS` («l'item più conteso della sala») che si scalda in proporzione ai tap al secondo. Il podio resta provvisorio fino alla fine della grace.

## X-Ray e costi

Il pannello (I, o regia) scorre da destra: ultima richiesta dello stage, operazioni DynamoDB con espressioni, unità consumate per tabella e GSI, tempo DB rispetto al totale. Non è il servizio AWS X-Ray.

Il costo è espresso in USD e arriva da estimatedCost, con prezzi del backend. Null significa «n/d». Lo scontrino distingue scritture su tabella e su GSI; storage, hosting, log e altri costi esclusi sono dichiarati. In Local/DEV il valore è una proiezione a listino on-demand, non una fattura. I moltiplicatori sono soltanto grafici.

## Bot runner, locale e backup

Il runner esterno resta disponibile: `npm run bot:runner -- --sid SID --n 20`, poi «Bot runner» in regia in lobby/pixel. I bot del runner ora accendono le celle del logo. Lo sciame della regia non richiede il runner.

Prima della prova preparare VITE_LOCAL_API e VITE_LOCAL_SESSION e creare la sessione locale. «Passa al locale» in regia ricarica la regia su quell'ambiente: aprire la LIM con gli stessi parametri. Credenziali e giocatori della sessione cloud non vengono trasferiti.

«Video di backup» (regia) o P (LIM) apre `public/backup.mp4` o VITE_BACKUP_URL. Il video non è stato registrato: richiede una prova integrata.

## Materiali

- `docs/contenuti/SCRIPT_PARLATO.md`: copione P1/P2, durata obiettivo 14:15 comprensiva di giochi e pause.
- `docs/contenuti/APPROFONDIMENTO.md`: sorgente del documento.
- `docs/contenuti/DynamoLive-approfondimento.pdf`: dieci pagine, copia distribuita in `frontend/public/`.
- `docs/contenuti/build_pdf.py`: rigenerazione facoltativa con Python e reportlab; non serve per avviare o distribuire l'app. Riusa i font locali e gli SVG.
- `docs/contenuti/REVISIONE_CONTRATTO_B.md`: revisione del contratto e richiesta di revisione tecnica all'agente A.

Il PDF di ricerca iniziale non era nel checkout; il testo è una stesura autonoma. Il link al repository pubblico e il video sono da completare con il team. La cornice «Natale 2004» è indicata come narrativa, senza spacciare il grafico illustrativo per misura storica.

## Verifiche e prove ancora necessarie

Eseguite su questa macchina (restyle Svelte): svelte-check senza errori né warning; build; test unitari frontend; `tests/network.mjs` (fetch reale su fixture: `PIXEL_TAKEN` con nuovo tentativo su un'altra cella, 429, recupero rete, giocatore assente dopo reload, header proprietario/admin); `tests/browser.mjs` in mock (join/reload, pixel dal telefono, sciame che completa il logo, zoom pixel → item → giocatore → tabella, rivelazione squadre, HOT KEY con reload e podio, costi, fine, giro statico). Percorso completo anche contro il backend locale su DynamoDB Local con LIM 1920×1080, regia e quattro telefoni 390×844: sciame con conflitti reali, HOT KEY end-to-end. Backend: test unitari e di integrazione su DynamoDB Local, incluso «vince il primo».

Test browser riproducibili, se Playwright e Chrome sono già disponibili:

```sh
# Dentro frontend, con dev server attivo:
node tests/browser.mjs
node tests/network.mjs
```

Se Playwright è fornito da un runtime esterno, impostare PLAYWRIGHT_MODULE al percorso del suo pacchetto. Non è una dipendenza necessaria della demo e non vengono scaricati browser dagli script. `network.mjs` usa risposte HTTP simulate sul contratto: verifica il client fetch e il recupero, non il database.

Ancora da eseguire: integrazione frontend/API contro DynamoDB Local sulla macchina di destinazione; deploy DEV/LIVE; iOS/Android reali; quindici o più telefoni; proiettore e QR dall'ultima fila; rete della sala; prova cronometrata a due voci; video; confronto Cost Explorer; revisione tecnica dei contenuti da parte dell'agente A. Le prove riportate nella guida A non sono state ripetute né attribuite a questa sessione.
