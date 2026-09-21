# DynamoLive — Guida tecnica e consegna agente A

## Stato della consegna

Backend, strumenti locali, bot e template SAM implementati. Contratto: `docs/06_CONTRATTO_CONDIVISO.md`; tipi e prezzi: `shared/`. Nessun file del frontend o dei contenuti dell'agente B è stato modificato.

La revisione del contratto con l'agente B, la prova con il frontend completo e la revisione tecnica del documento di approfondimento restano da svolgere quando quei materiali saranno disponibili. Non è stato eseguito un deploy AWS: AWS CLI/SAM non risultano nel PATH e nei file AWS è presente soltanto il profilo `default`, senza i profili `dev`/`live` previsti. Non è stato usato il profilo default né letto/stampato il contenuto delle credenziali. Le verifiche locali non sostituiscono una prova su AWS o con telefoni reali.

Verifiche eseguite il 21 settembre 2026: TypeScript e build Lambda senza errori; 5 test unitari; 6 scenari di integrazione sul database (7 test contando il contenitore); smoke HTTP con 3 bot, 3 pixel e 10 tap, totali coerenti; cfn-lint senza segnalazioni. API locale e DynamoDB sono stati avviati per le prove; la sessione `prova-01` è stata lasciata in lobby per l'integrazione.

## Avvio locale

Requisiti: Node.js 22.9+ e npm; Docker oppure Java 17+. Le dipendenze npm sono fissate dal lockfile di radice. Il frontend può avere il proprio package.json e lockfile, senza convertire la radice in workspace npm durante il lavoro parallelo.

```powershell
npm ci
Copy-Item .env.example .env
```

Non sovrascrivere `.env` se già configurato. La chiave di esempio è solo per il server locale, che ascolta su 127.0.0.1. Non usare tale valore su AWS.

**Opzione Docker:**

```powershell
docker compose up -d
```

**Opzione Windows senza installazioni di sistema:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local-windows.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-db.ps1
```

Il primo script scarica DynamoDB Local e Amazon Corretto 21 dalle fonti AWS, verifica gli SHA256 pubblicati e li estrae in `.local/` (ignorata da Git). Il secondo resta in esecuzione e salva i dati in `.local/dynamodb/data`. È stata verificata la versione scaricata DynamoDB Local 3.3.1. Compose fissa l'immagine 3.3.0; il percorso Docker non è stato eseguito su questo PC.

Lo script Windows imposta `jdk.net.unixdomain.tmpdir` alla radice del progetto per evitare il problema dei socket Java con directory temporanee virtualizzate dall'app. Se il percorso del progetto è molto lungo, usare un percorso di checkout più corto. Interrompere il processo con Ctrl+C quando non serve.

In un secondo terminale:

```powershell
npm run seed -- --sid prova-01
npm run dev:api
```

API su `http://127.0.0.1:3001`; `GET /s/prova-01/meta` deve mostrare lobby. Seed crea tabella, GSI, TTL e sessione; non elimina né sovrascrive sessioni esistenti. Non è necessario un account AWS per DynamoDB Local.

Per una nuova prova, con API avviata:

```powershell
npm run reset -- --sid prova-02
```

Il comando reset crea una nuova sessione; 409 su sid già presente è intenzionale. Usare sempre sid nuovi evita confusione fra pid in localStorage e sessioni ricreate. Il vecchio stato scade dopo 24h.

### Collegamento di telefoni in LAN

Impostare `HOST=0.0.0.0` e aggiungere ad `ALLOWED_ORIGINS` l'origine effettiva del frontend, per esempio `http://192.168.1.20:5173`. Il frontend deve usare come base API l'IP del portatile, non localhost del telefono. Il database resta esposto solo sul loopback nel percorso Docker. Verificare eventuali regole firewall Windows e la disponibilità del frontend sulla LAN. Non è stato eseguito un test con telefoni reali.

## Comandi di verifica

```powershell
npm run typecheck
npm test
npm run test:integration
npm run build:backend
npm run test:smoke
```

- Unit test: validazione, autorizzazione prima dell'accesso al DB, prezzi e capacità.
- Integration: richiede DynamoDB Local; crea una tabella `DynamoLive-test-<timestamp>` e cancella solo quella al termine. Usa orologio controllato per cooldown, grace e TTL. Non accetta endpoint cloud.
- Smoke: richiede API e DB avviati; crea una sessione `smoke-<timestamp>` con tre bot, attraversa i due giochi e verifica i totali usando HTTP. La sessione resta disponibile fino a scadenza.
- Build: produce `backend/dist/handler.cjs` con AWS SDK incluso, pronto per Lambda Node.js 22 arm64.

Su questo host Codex, tsx/esbuild e i server possono richiedere esecuzione fuori dal sandbox Windows: non è una dipendenza dell'app distribuita.

Validazione infrastruttura:

```powershell
cfn-lint -t infra/template.yaml -r eu-central-1
```

È stata eseguita con cfn-lint 1.57.0. Se si usa il pacchetto portatile preparato durante questa sessione, aggiungere `.local/python-tools` a PYTHONPATH e invocare `cfnlint.runner.main` con il proprio Python. Non è necessario usare questo Python per sviluppare il backend.

## Bot e fallback

```powershell
npm run bot:runner -- --sid prova-01 --n 20
npm run bot:pixel -- --sid prova-01 --n 20
npm run bot:hotkey -- --sid prova-01 --n 20
```

Usare un solo comando per volta sulla stessa prova. Aggiungere `--api URL` per un ambiente diverso. Il runner combinato segue `botsEnabled` in META; gli altri due eseguono direttamente il gioco corrispondente. Avviare il runner e abilitare B mentre il join è ancora aperto (lobby/pixel), così i bot si registrano prima di HOT KEY. Avviarlo soltanto a HOT KEY non può creare nuovi giocatori perché il join è già chiuso.

I nickname `bot001` ecc. rendono riconoscibili i partecipanti simulati. I pixel compongono un pattern a colori; i tap usano 2–5 punti per batch e retry con sequenza invariata. I bot scrivono realmente via API. Il controllo B non crea processi in Lambda: il runner deve essere acceso sul portatile. La modalità locale non replica automaticamente dati o pid della sessione cloud.

## Implementazione e compromessi

- `backend/src/app.ts`: router e operazioni applicative; `handler.ts`: adattatore HTTP API v2; `local-server.ts`: adattatore Node HTTP.
- `lib/domain.ts`: validazioni e stato iniziale; `lib/ddb.ts`: SDK, paginazione, misure e flush economico.
- META viene letto con consistenza forte e senza cache per evitare di ritardare la regia. Le scritture dei giochi controllano la versione META nella transazione.
- Join e pixel incrementano STATS nella stessa transazione dei dati; tap aggiorna PLAYER e STATS insieme. Questo privilegia conteggi corretti alla piccola scala del talk e rende STATS una hot key esplicita. Non è un progetto per milioni di giocatori.
- Il buffer Lambda contiene solo telemetria economica. Flush atteso, senza lavoro in background dopo il ritorno dell'handler. Può perdere dati se il container sparisce; include nel flush successivo la capacità del flush precedente. Sono esclusi consumi non restituiti dagli errori SDK, cold start, overhead e richieste respinte prima di identificare la sessione.
- L'Inspector espone parametri strutturali e capacità, mai i valori delle credenziali. `consumed.read` e `consumed.write` distinguono letture e scritture anche nelle transazioni; `table`/`gsi` mantengono il riepilogo compatto.
- Classifica durante il round: GSI e ordinamento deterministico dei pareggi nell'app. Alla fine: Query forte PLAYER, senza attendere la convergenza del GSI. Nessuna cache della classifica finale.
- Ban impedisce nuove scritture e rimuove il giocatore dall'indice; i punti già guadagnati restano nei totali storici di squadra. Il filtro nickname è una lista IT/EN di base: il controllo umano resta necessario.
- Clear richiede la tela congelata. Le tombstone vengono scritte in blocchi di massimo 99 celle più controllo META: un rettangolo grande non è una singola transazione. Non cambiare fase durante la cancellazione; in caso di errore ricaricare la tela e ripetere il clear. Gli snapshot periodici recuperano anche un clear parziale.
- Limite tap: 12 per bucket server di 500 ms e limite cumulativo. È una misura anti-abuso semplice, non una prova che ogni tap sia umano. La grace finale di 2 s consente lo scarico dei batch pendenti.
- Scadenza TTL a 24h dalla creazione; scadenza logica immediata nell'app, cancellazione fisica asincrona AWS. DynamoDB Local non dimostra i tempi di cancellazione del servizio.

## Prezzi e tassametro

Verifica effettuata il 21 settembre 2026 dal catalogo pubblico AWS per `eu-central-1`. `shared/pricing-sources.json` conserva URL, data di pubblicazione e SKU. `scripts/fetch-prices.mjs` scarica estratti aggiornati in `.local/prices/`; non modifica automaticamente i prezzi applicativi.

| Voce | Prezzo USD |
|---|---:|
| DynamoDB Standard on-demand, un milione di WRU | 0,7625 |
| DynamoDB Standard on-demand, un milione di RRU | 0,1525 |
| HTTP API, un milione di richieste nel primo scaglione | 1,20 |
| Lambda arm64, un milione di richieste | 0,20 |
| Lambda arm64, GB-secondo nel primo scaglione | 0,0000133334 |

La stima è a listino on-demand, prima di crediti, free tier e imposte; in DEV provisioned o Local è una proiezione equivalente, non il conto effettivo. Il payload dichiara `costBasis: on-demand-list-price`. Storage, CloudFront/S3, log, trasferimenti e costi di eventuali altri servizi non sono inclusi. Le proiezioni grandi sono lineari al primo scaglione e non simulano sconti o prestazioni. Non dichiarare «meno di un centesimo» prima di leggere i dati effettivi.

Fonti: [catalogo DynamoDB Francoforte](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonDynamoDB/current/eu-central-1/index.json), [catalogo API Gateway Francoforte](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonApiGateway/current/eu-central-1/index.json), [catalogo Lambda Francoforte](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/eu-central-1/index.json).

## Deploy DEV e LIVE

Preparare AWS CLI e SAM CLI, profili `dev`/`live`, account corretti e budget. Verificare con `aws sts get-caller-identity --profile dev` prima di distribuire. L'agente non ha creato account, ruoli personali, MFA o modificato impostazioni AWS.

```powershell
npm run build:backend
sam validate --lint --template-file infra/template.yaml --region eu-central-1
Set-Location infra
sam deploy --guided --config-env dev
```

SAM usa il bundle già generato da esbuild, senza bisogno di un'ulteriore build Docker. Inserire `Environment=dev`, una chiave admin casuale di almeno 24 caratteri e facoltativamente BudgetEmail. AdminKey è NoEcho; non salvare il suo valore nel repository, nei comandi condivisi o nel frontend. Controllare il file samconfig dopo il flusso guidato ed eliminare eventuali segreti salvati. Ripetere con `--config-env live` e `Environment=live` sul profilo live.

DEV usa 5 RCU/5 WCU sulla tabella e su ciascun GSI (totale 15/15, non 25/25 per ogni risorsa). È adatto a pochi dispositivi; una prova con il pubblico può saturarlo. LIVE usa on-demand. HTTP API limita a 300 richieste/s con burst 500; validare le quote Lambda dell'account prima delle prove. Il budget opzionale è mensile e a livello account: 1 USD DEV, 2 USD LIVE, avviso al superamento del 100%; non interrompe le risorse.

Output stack: ApiUrl, SiteUrl, SiteBucketName, DistributionId, TableName. Configurare la base API del frontend con ApiUrl. S3 è privato; CloudFront usa OAC e HTTPS. Il rewrite tratta `/`, `/play` e `/stage` come entry point della SPA, senza trasformare asset mancanti in pagine HTML.

Dopo la build del frontend da parte dell'agente B, caricare gli asset nello specifico bucket restituito dallo stack. Esempio da adattare con valori verificati:

```powershell
aws s3 sync frontend/dist s3://NOME_BUCKET --profile dev
aws cloudfront create-invalidation --distribution-id ID_DISTRIBUZIONE --paths /index.html --profile dev
```

Non usare `--delete` automaticamente. Creare poi la sessione con `npm run reset -- --sid prova-cloud-01 --api URL_API`, impostando ADMIN_KEY nell'ambiente del terminale senza stamparla. Il bootstrap non passa per `seed`, che è volutamente limitato al loopback.

Tabella e bucket hanno Retain: eliminare lo stack non li cancella. Log Lambda conservati per 7 giorni. Nessun endpoint pubblico permette di cancellare tabelle o sovrascrivere sessioni esistenti.

## Consegna all'agente B

1. Importare i tipi da `shared/types.ts`, usando il suffisso `.js` negli import TypeScript compatibili NodeNext/Vite.
2. Partire da `.env` e dalla sessione locale `prova-01`, oppure crearne una nuova; implementare client e mock sul contratto v1.
3. Nel deck separare navigazione visuale da transizioni META: niente ritorni di fase né replay sullo stesso sid.
4. Aggiungere header admin alle richieste stage, incluso `/players` per scegliere il giocatore da mostrare; non diffondere i pid ai telefoni degli altri giocatori.
5. Usare roundId, seq e batch seriali; snapshot completo della tela ogni 15s e alla riconnessione; rivelare la squadra solo con teamsRevealed.
6. Mostrare costo stimato e proiezioni con le etichette del contratto; trattare il countdown TTL come scadenza logica.
7. Segnalare richieste di modifica al contratto all'agente A, senza modificare backend/shared autonomamente.

## Verifiche ancora esterne

- Deploy e invocazioni su AWS, IAM/CORS effettivi, comportamento di throttling e GSI nel servizio.
- Confronto della stima con Cost Explorer dopo 24–48 ore.
- Integrazione con frontend dell'agente B e revisione dei contenuti finali.
- Telefoni iOS/Android, rete della sala, proiettore, prove a due voci e registrazione backup.

Riferimenti tecnici: [transazioni DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html), [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html), [CORS SAM HTTP API](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-httpapi-httpapicorsconfiguration.html).
