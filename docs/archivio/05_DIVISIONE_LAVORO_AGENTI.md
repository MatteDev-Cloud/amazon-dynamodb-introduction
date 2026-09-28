# DynamoLive — Divisione del lavoro tra due agenti

Questo documento divide la realizzazione in due incarichi da affidare a due agenti distinti. Integra i documenti `00_`–`04_`, mantenendo le decisioni già approvate. Non indica che le attività della roadmap siano già completate.

## Divisione proposta

| | Agente A — Backend e infrastruttura | Agente B — Frontend e presentazione |
|---|---|---|
| Obiettivo | Rendere disponibili dati, API e ambiente di esecuzione affidabili | Realizzare l'esperienza completa del pubblico e dei presentatori |
| Responsabilità | DynamoDB, Lambda, API, SAM, strumenti locali, bot | SPA, telefoni, stage, slide, X-Ray, tassametro, contenuti |
| Cartelle di proprietà | `backend/`, `infra/`, `scripts/`, `bots/`, `shared/` | `frontend/`, `docs/contenuti/` |
| Documenti nuovi | `docs/06_CONTRATTO_CONDIVISO.md`, `docs/07_GUIDA_TECNICA.md` | `docs/08_GUIDA_PRESENTAZIONE.md`, documento di approfondimento e script in `docs/contenuti/` |
| Verifica finale | API e backend funzionanti contro DynamoDB Local | Percorso completo da lobby a chiusura su stage e telefono |

**Regola di proprietà:** ciascun agente modifica solo i propri file. Per una modifica nell'area dell'altro, descrive la richiesta e lascia al proprietario l'applicazione. I documenti di contesto originali restano il riferimento; eventuali correzioni concordate vanno registrate nel contratto condiviso.

L'agente A gestisce anche i file comuni alla radice: configurazione del workspace, dipendenze comuni, comandi di avvio, `.gitignore`, Docker e README principale. L'agente B gestisce la configurazione e le dipendenze interne a `frontend/`. Questo evita modifiche simultanee ai manifest e ai lockfile comuni.

## Prima di lavorare in parallelo: fissare l'interfaccia

La prima consegna dell'agente A è il contratto condiviso, accompagnato da `shared/types.ts`. L'agente B lo revisiona dal punto di vista delle schermate e dei flussi. Dopo questa breve verifica, entrambi lo usano come riferimento: una modifica incompatibile va concordata prima di essere implementata.

Il contratto deve fissare:

- Endpoint di `01_GIOCHI_SPEC.md`, payload, risposte, errori e formato comune di `serverTime`.
- Fasi META, transizioni consentite, timer, rivelazione delle squadre e comportamento dei salti avanti/indietro nel deck.
- Ripristino di un giocatore dopo reload, credenziali admin e dati visibili alle diverse schermate.
- Formato di `_inspect`, statistiche, unità di capacità e parametri del costo stimato.
- Cursore dei delta della tela, deduplicazione, retry dei tap e comportamento degli ultimi batch alla fine del round.
- Avvio/arresto dei bot e modalità locale: definire un meccanismo realizzabile, distinguendo server locale e Lambda.
- Valori configurabili e valori iniziali: tela 48×27, cooldown 1,5 s, Pixel Wall 90 s, HOT KEY 15 s, palette prevista.

Le scelte ancora aperte nei documenti vanno riportate come tali. Per quelle non bloccanti, usare un valore provvisorio configurabile e dichiararlo: non presentarlo come una decisione già approvata.

### Punti tecnici da risolvere nel contratto

La specifica è una bozza: prima di tradurla in codice, i due agenti devono allineare implementazione e spiegazioni su questi punti.

- Distinguere item diversi e partition key diverse: nel modello proposto i pixel condividono `CANVAS#sid` e i giocatori `SESSION#sid`. La narrazione non deve promettere distribuzione fisica solo perché cambiano le sort key.
- Definire l'affidabilità dei totali di squadra: il buffer in memoria di una Lambda può non essere scaricato. Separare i conteggi di gioco da una stima economica che ammette approssimazione.
- Definire il recupero della tela dopo ritardi prolungati o riconnessioni, senza affidarsi esclusivamente alla finestra di sovrapposizione di 2 s.
- Calcolare il costo dai consumi misurati e dal listino verificato, evitando di assumere che ogni GSI raddoppi sempre il costo.
- Descrivere il TTL come scadenza logica con cancellazione asincrona. Un replay storico della tela richiede una storia delle modifiche: il solo indice sugli ultimi pixel non basta.

Questa verifica non deve ampliare lo stack: restano una SPA, una Lambda, una tabella e polling, salvo diversa decisione esplicita del team.

## Incarico dell'agente A — Backend e infrastruttura

### Attività

1. Leggere i cinque documenti di contesto, produrre il contratto condiviso e i tipi TypeScript; recepire la revisione dell'agente B.
2. Preparare struttura del workspace, DynamoDB Local, seed della tabella/sessione e server HTTP locale che riusa l'handler Lambda.
3. Implementare join, validazione nickname, assegnazione squadra, META e comandi admin.
4. Implementare Pixel Wall: scritture, cooldown, letture complete e incrementali, moderazione e controllo dei giocatori bannati.
5. Implementare HOT KEY: contatori, sequenze idempotenti, limiti, classifica, posizione e totali di squadra secondo il contratto.
6. Esporre `_inspect` e STATS; verificare e documentare prezzi regionali, unità e limiti della stima per il tassametro.
7. Preparare SAM per DEV/LIVE, configurazione CORS, accesso admin, permessi necessari e istruzioni di deploy. Eseguire i deploy quando accessi e autorizzazioni sono disponibili.
8. Implementare bot, reset delle sessioni e meccanismo di controllo concordato con il frontend.
9. Scrivere la guida tecnica: avvio locale, configurazione, deploy, reset, diagnostica e limitazioni conosciute.
10. Verificare gli aspetti tecnici del documento di approfondimento prodotto dall'agente B, consegnando osservazioni senza modificarne i file.

### Consegne verificabili

- Contratto e tipi condivisi utilizzabili dal frontend.
- Ambiente locale avviabile con comandi documentati.
- API reali dei due giochi, regia e moderazione complete.
- Infrastruttura versionata e procedura DEV/LIVE riproducibile.
- Bot e reset utilizzabili durante le prove.
- Test mirati su cooldown, retry/idempotenza, fine round, autorizzazioni admin e correttezza dei conteggi.

## Incarico dell'agente B — Frontend e presentazione

### Attività

1. Leggere i cinque documenti di contesto e revisionare il contratto proposto dall'agente A, segnalando i dati mancanti per le schermate.
2. Preparare la SPA Vite + TypeScript con `/play` e `/stage`, token CSS, font locali e client API. Usare mock aderenti al contratto mentre il backend viene completato.
3. Implementare join e schermate del telefono, persistenza del giocatore, polling META e sincronizzazione dei timer.
4. Implementare Pixel Wall su telefono e stage: canvas, zoom/pan, palette, cooldown, feedback ottimistico, selezione del pixel e comandi di moderazione.
5. Implementare HOT KEY: bottone, batching e retry, countdown, classifica animata, tiro alla fune e podio.
6. Realizzare il deck con otto slide e tre scene, scorciatoie e cambi fase. Collegare i JSON e gli esempi ai dati reali della sessione.
7. Realizzare X-Ray e tassametro, usando le misure e i parametri forniti dall'agente A. Rendere esplicita la natura simulata delle proiezioni.
8. Integrare controlli dei bot, modalità locale, slide statiche e apertura del video di backup. La registrazione del video completo avviene dopo l'integrazione.
9. Scrivere script parlato e documento di approfondimento in Markdown, verificare le fonti e produrre il PDF con lo stile previsto. Richiedere all'agente A la revisione tecnica.
10. Scrivere la guida di presentazione: sequenza del talk, scorciatoie, prove, moderazione e procedure di fallback.

### Consegne verificabili

- Percorso telefono completo, dal QR alla schermata finale.
- Stage completo con slide, giochi, X-Ray e tassametro.
- Mock separati dall'uso delle API reali e riconoscibili durante lo sviluppo.
- Asset locali e fallback statico disponibili.
- Script con obiettivo di durata 14:15, documento Markdown/PDF e guida del presentatore.
- Verifica dei flussi critici: cambio fase, reload, perdita di rete, retry, fine round e uso delle scorciatoie.

## Sequenza di integrazione

| Tappa | Agente A | Agente B | Criterio di completamento |
|---|---|---|---|
| 1. Contratto | Scrive API, tipi e decisioni tecniche | Revisiona e prepara struttura visuale | Entrambi lavorano sulla stessa interfaccia |
| 2. Primo percorso | Espone join, META e admin/phase | Collega join e deck alle fasi | Un telefono segue il cambio fase dello stage |
| 3. Pixel Wall | Completa API e moderazione | Collega tela e controlli | Si colora, si congela e si modera usando dati reali |
| 4. HOT KEY | Completa punteggi e classifica | Collega tap, timer e podio | Un round termina con conteggi coerenti, anche con retry |
| 5. Esperienza completa | Completa misure, bot e infrastruttura | Completa slide, widget e contenuti | Il talk gira dall'inizio alla fine in locale |
| 6. Prova su AWS | Supporta deploy e diagnostica | Verifica dispositivi, visualizzazione e regia | Prova integrata su DEV/LIVE con limiti registrati |

Il primo collegamento frontend/backend avviene alla tappa 2: non aspettare che entrambi i giochi siano finiti. Dopo ogni tappa, ciascun agente consegna comandi di verifica, risultato e problemi ancora aperti.

## Attività che richiedono il team umano

I due incarichi coprono la preparazione tecnica e dei materiali. Restano da svolgere o confermare con le due persone che presenteranno:

- Data del talk, account AWS disponibili, crediti/scadenze e accessi per i deploy.
- Prompt definitivo della tela, divisione delle battute e approvazione dei contenuti.
- Prove con telefoni reali, proiettore e rete della sala.
- Prova cronometrata a due voci e registrazione del video di backup dopo una prova completa.

Gli agenti devono completare il lavoro indipendente da questi elementi e segnalare con precisione solo ciò che resta in attesa. Nessuna checkbox relativa a prove reali o deploy va marcata come completata senza averli eseguiti.

## Prompt da affidare all'agente A

> Realizza l'incarico «Agente A — Backend e infrastruttura» descritto in `docs/05_DIVISIONE_LAVORO_AGENTI.md`. Leggi prima tutti i documenti di contesto `docs/00_`–`04_`. La specifica è ancora una bozza: la tua prima consegna è `docs/06_CONTRATTO_CONDIVISO.md` con `shared/types.ts`, risolvendo i punti tecnici indicati nel documento di divisione. Mantieni lo stack approvato e rispetta la proprietà dei file. L'altro agente realizza frontend e contenuti: forniscigli un contratto stabile e API integrabili fin dal flusso join/META. Completa implementazione, strumenti locali, infrastruttura, test pertinenti e guida tecnica; dichiara verifiche effettuate, limiti e dipendenze esterne. Non modificare i file dell'agente B e non dichiarare eseguiti deploy o prove non svolti.

## Prompt da affidare all'agente B

> Realizza l'incarico «Agente B — Frontend e presentazione» descritto in `docs/05_DIVISIONE_LAVORO_AGENTI.md`. Leggi prima tutti i documenti di contesto `docs/00_`–`04_`. L'altro agente realizza backend e infrastruttura e pubblica `docs/06_CONTRATTO_CONDIVISO.md` con `shared/types.ts`: revisiona questa interfaccia e usala per il client API e i mock, senza inventare un contratto parallelo. Puoi iniziare subito struttura visuale, deck e contenuti; collega join/META reali appena disponibili. Completa `/play`, `/stage`, giochi, X-Ray, tassametro, fallback, script e documento di approfondimento con PDF. Rispetta la proprietà dei file e l'identità visiva approvata. Dichiara verifiche effettuate e prove fisiche ancora necessarie; richiedi al proprietario eventuali modifiche ai file comuni.
