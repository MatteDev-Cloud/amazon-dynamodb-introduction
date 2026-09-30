# Configurazione AWS da zero

Guida per preparare l'ambiente AWS di DynamoLive partendo da un account vuoto. Gli script citati (`deploy-aws.ps1`, `new-session-aws.ps1`) sono sul branch **`prod`**.

> **Account singolo con piano Free (settembre 2026):** non creare AWS Organizations solo per ottenere IAM Identity Center. AWS avverte che la creazione dell'Organization può convertire il piano in pay-as-you-go e far scadere subito i crediti Free. Per un singolo account usa un utente IAM amministrativo dedicato con MFA e `aws login --profile live`, che fornisce credenziali temporanee tramite browser. La sezione Identity Center qui sotto si applica se hai già un'Organization o hai scelto consapevolmente il piano a pagamento. Un'istanza *account* di Identity Center non supporta permission set né accesso all'account AWS.

> Regola d'oro: nel repository non finiscono **mai** chiavi di accesso, la chiave admin, file `.env`, file `~/.aws/*`, output con segreti. Le variabili `VITE_*` del frontend sono pubbliche per definizione: non metterci segreti.

## 1. Cosa creiamo

| Servizio | Risorsa | Perché | Sostituisce in locale | Come si crea |
| --- | --- | --- | --- | --- |
| **DynamoDB** | Tabella `dynamolive-<env>-DynamoLive`, 2 GSI, TTL | Il database della demo | DynamoDB Local in Docker | SAM (automatico) |
| **Lambda** | Funzione Node.js 22 arm64 | Esegue l'API senza server da gestire | `npm run dev:api` (server Node) | SAM |
| **API Gateway** | HTTP API con CORS e throttling | Endpoint HTTPS pubblico per telefoni e LIM | `http://localhost:3001` | SAM |
| **S3** | Bucket privato cifrato | Ospita il frontend compilato | Vite dev server | SAM + `aws s3 sync` |
| **CloudFront** | Distribuzione HTTPS con OAC | HTTPS obbligatorio per i telefoni, cache, dominio pubblico | `http://localhost:5173` | SAM |
| **SSM Parameter Store** | `SecureString /dynamolive/<env>/admin-key` | Segreto admin fuori da codice e variabili | `ADMIN_KEY` in `.env` | Script (o console) **prima** del deploy |
| **IAM** | Ruolo della Lambda (automatico) + accesso umano | Minimo privilegio | nessuno | SAM + console (utente IAM con MFA, o Identity Center) |
| **CloudWatch Logs** | Log group della Lambda, 7 giorni | Errori e diagnosi | terminale | SAM |
| **AWS Budgets** | Budget mensile con email | Allarme costi | nessuno | SAM (se passi l'email) |
| **CloudFormation** | Stack `dynamolive-dev` / `dynamolive-live` | Tutto quanto sopra come codice, ripetibile | nessuno | `sam deploy` |

Non servono VPC, NAT, database relazionali, certificati o domini: tutti i servizi sono gestiti e pubblici via HTTPS. Nessun networking da configurare.

## 2. Regione

**`eu-central-1` (Francoforte)** per tutto lo stack.

- Tutti i servizi usati sono disponibili e maturi; latenza bassa dall'Italia.
- Milano (`eu-south-1`) è una regione *opt-in*: va abilitata a mano e alcuni prezzi sono più alti. Non porta vantaggi per 15 minuti di demo.
- CloudFront, IAM e Budgets sono globali: non dipendono dalla regione.
- Prezzi del tassametro (`shared/pricing.ts`) sono quelli di Francoforte: se cambi regione, aggiornali.

## 3. Ordine delle operazioni

1. Account e sicurezza di base (console) — §4
2. Accesso per le persone: utente IAM con MFA per account Free singolo; Identity Center se hai già un'Organization — §5
3. AWS CLI, SAM CLI e profili locali (terminale) — §6
4. Verifica quote e crediti (console) — §7
5. Segreto admin in SSM (script o console) — §8
6. Deploy dello stack e del frontend (script) — §9
7. Creazione della sessione del talk (script) — §10
8. Monitoraggio e costi — §11, §12

## 4. Account e sicurezza di base (manuale, console)

1. Accedi come **root** solo per queste operazioni.
2. *IAM → Security recommendations*: attiva **MFA sul root**.
3. Verifica che il root **non abbia access key**. Se ci sono, eliminale.
4. *Billing → Billing preferences*: attiva "Receive Free Tier usage alerts" e le fatture via email.
5. Account nuovo (free plan): controlla in *Billing → Free Tier / Credits* **la data di scadenza dei crediti** rispetto alla data della presentazione.

Opzionale ma consigliato: due account separati (DEV per le prove, LIVE per il talk) sotto la stessa organizzazione. Con un solo account basta usare due stack (`dev` e `live`) e due profili che puntano allo stesso account.

## 5. Accesso per le persone (manuale, console)

Per un account Free singolo, crea in *IAM → Users* un utente dedicato al deploy con accesso alla console, policy `AdministratorAccess` e `SignInLocalDevelopmentAccess`, password da cambiare al primo accesso e MFA. Usa `aws login --profile live` per ottenere credenziali temporanee via browser, senza creare access key per l'utente. Usa l'utente root solo per la configurazione iniziale; dopo che il profilo dedicato funziona, elimina eventuali access key root.

Se hai già un'**istanza organizzativa** di IAM Identity Center, puoi usare invece i passaggi SSO seguenti. Non usare un'istanza *account* per questo scopo: non può assegnare permission set per l'accesso AWS.

1. *IAM Identity Center → Enable* (nella regione `eu-central-1`).
2. *Users → Add user*: una persona per membro del gruppo, con MFA obbligatoria (*Settings → Authentication → MFA: every time they sign in*).
3. *Permission sets*:
   - **`DynamoLiveDeploy`**: policy gestita `AdministratorAccess`, durata sessione 1 h. Serve solo a chi esegue `sam deploy` (CloudFormation crea ruoli IAM, bucket, distribuzioni: un set minimo sarebbe lungo e fragile). Assegnala a una sola persona.
   - **`DynamoLiveOperator`**: policy inline di minimo privilegio per il giorno del talk (crea sessioni, legge la chiave, controlla lo stack):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "cloudformation:DescribeStacks",
      "Resource": "arn:aws:cloudformation:eu-central-1:*:stack/dynamolive-*/*" },
    { "Effect": "Allow", "Action": "ssm:GetParameter",
      "Resource": "arn:aws:ssm:eu-central-1:*:parameter/dynamolive/*" },
    { "Effect": "Allow", "Action": ["logs:FilterLogEvents", "logs:GetLogEvents", "logs:DescribeLogStreams"],
      "Resource": "arn:aws:logs:eu-central-1:*:log-group:/aws/lambda/dynamolive-*" },
    { "Effect": "Allow", "Action": ["cloudwatch:GetMetricData", "dynamodb:DescribeTable"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["ce:GetCostAndUsage"], "Resource": "*" }
  ]
}
```

4. *AWS accounts → assegna* utenti e permission set all'account (o agli account DEV/LIVE).

**Principio del minimo privilegio, in pratica:** la Lambda può solo leggere/scrivere la sua tabella e leggere un parametro; chi presenta può solo leggere; solo chi fa deploy ha poteri ampi, per un'ora, con MFA.

Se non hai un'Organization, segui il percorso dell'utente IAM descritto sopra. `aws login` evita di creare access key permanenti per il deploy.

## 6. Strumenti e profili locali (terminale)

Installa (Windows): AWS CLI v2, AWS SAM CLI, Node.js 22+, PowerShell 7 consigliato.

```powershell
aws --version; sam --version; node --version
aws configure set region eu-central-1 --profile live
aws login --profile live              # login tramite browser con l'utente IAM dedicato
aws sts get-caller-identity --profile live   # deve mostrare l'account giusto
```

Se usi Identity Center, configura invece `aws configure sso --profile live` e poi `aws sso login --profile live`. I nomi dei profili `dev` e `live` sono quelli usati da `infra/samconfig.toml` e dagli script. Il file `~/.aws/config` è personale: non va copiato nel progetto.

Variabili d'ambiente utili nel terminale (non in file versionati):

| Variabile | Uso |
| --- | --- |
| `AWS_PROFILE` | Profilo predefinito per i comandi (in alternativa a `--profile`) |
| `AWS_REGION` | `eu-central-1` |

## 7. Quote e crediti (manuale, console)

- *Lambda → Dashboard → Account-level concurrency*: gli account nuovi a volte hanno **10** esecuzioni concorrenti. Con 60 telefoni servono ~10–20: se il valore è basso chiedi l'aumento a 100+ da *Service Quotas → AWS Lambda → Concurrent executions* **con giorni di anticipo**.
- *API Gateway*: il template limita a 1000 richieste/s (burst 2000). Ogni telefono fa ~3 richieste/s al picco, LIM e regia ~6 ciascuna: con 60 persone si sta intorno alle 250/s. Il limite non si paga (si paga per richiesta), ed è tenuto largo apposta: una richiesta throttlata dal gateway sul proiettore sembra un guasto.
- DynamoDB on-demand in `live`: nessuna capacità da prenotare.

## 8. Segreto admin in SSM Parameter Store

La Lambda legge `/dynamolive/<env>/admin-key` all'avvio del container. Il parametro **deve esistere prima del primo deploy**. `deploy-aws.ps1` lo crea da solo se manca, con 32 byte casuali, senza stamparlo.

A mano (console): *Systems Manager → Parameter Store → Create parameter* → nome `/dynamolive/live/admin-key`, tier Standard, tipo **SecureString**, chiave KMS `alias/aws/ssm`, valore casuale di almeno 24 caratteri.

Perché SSM e non Secrets Manager: parametro standard gratuito, nessuna rotazione automatica necessaria per una chiave di sessione, una sola chiamata al cold start. Secrets Manager (a pagamento per segreto) serve quando c'è rotazione automatica o credenziali di database.

Leggere la chiave per la regia (non incollarla in chat, email o file del progetto):

```powershell
./scripts/new-session-aws.ps1 -Environment live -Sid talk-01 -CopyKey   # la mette negli appunti
```

Cambiare la chiave: aggiorna il parametro, poi forza nuovi container (ridistribuisci o cambia una variabile della funzione). I container già caldi tengono la vecchia chiave fino al riciclo.

## 9. Deploy (automatico, branch `prod`)

```powershell
git checkout prod
npm ci; npm --prefix frontend ci
aws login --profile live               # oppure aws sso login se il profilo usa Identity Center
./scripts/deploy-aws.ps1 -Environment live -Profile live -BudgetEmail "nome@esempio.it" -BudgetAmount 5
```

Cosa fa lo script, in ordine:

1. Controlla CLI e identità (`sts get-caller-identity`).
2. Crea il parametro SSM se manca.
3. Esegue typecheck e test di backend e frontend, poi compila il backend (`npm run build:backend` → `backend/dist/handler.js`). Se una verifica fallisce il deploy si ferma prima di toccare AWS.
4. `sam deploy --config-env <env>`: mostra il change set e chiede conferma.
5. Legge gli output dello stack (`ApiUrl`, `SiteUrl`, `SiteBucketName`, `DistributionId`).
6. Scrive `frontend/.env.<env>` (ignorato da git) con `VITE_API_BASE` e `VITE_PUBLIC_ORIGIN`.
7. Compila il frontend (`build:<env>`), lo carica su S3 con `--delete` e invalida la cache di CloudFront.

La build del frontend **fallisce apposta** se `VITE_API_BASE` o `VITE_PUBLIC_ORIGIN` mancano, contengono ancora un segnaposto o non sono HTTPS: senza questo controllo una build distratta produce un bundle che punta a `localhost:3001` e lo si scopre dal proiettore.

Il primo deploy di CloudFront richiede 5–15 minuti. Stack `dev` = tabella provisioned 5/5 (nel free tier), CORS anche da `localhost:5173`; stack `live` = on-demand, CORS solo dal dominio CloudFront.

**Cosa resta nel repository**: `infra/template.yaml`, `infra/samconfig.toml` (nomi di stack, regione, profili: nessun segreto), gli esempi `frontend/.env.*.example`.
**Cosa non deve entrare**: `frontend/.env.dev`, `frontend/.env.live`, `.aws-sam/`, eventuali `samconfig` con parametri sensibili, output di `sam deploy --guided` se chiede la chiave (con SSM non la chiede più).

## 10. Sessione del talk

Ogni sessione ha un `sid` e non si sovrascrive mai. Crea quella del talk il giorno prima e una di scorta:

```powershell
./scripts/new-session-aws.ps1 -Environment live -Sid talk-01
./scripts/new-session-aws.ps1 -Environment live -Sid talk-02    # di riserva
./scripts/new-session-aws.ps1 -Environment live -Sid talk-01 -EndTtlSeconds 90   # chiusura più lenta
```

`-EndTtlSeconds` (default 60) è la durata della **dissolvenza finale**: entrando nella scena di chiusura il backend accorcia il TTL di ogni pixel distribuendolo su quella finestra, e la tela si cancella da sola sullo schermo. Si può cambiare anche dal vivo, dalla regia (pannello «Chiusura»).

URL per la LIM: `https://<SiteUrl>/stage?s=talk-01` (poi **R** per la regia). Il QR per i telefoni lo genera la LIM.

## 11. CORS, logging, monitoraggio, errori

- **CORS** doppio e coerente: API Gateway (`CorsConfiguration`) e l'app (`ALLOWED_ORIGINS`) accettano solo il dominio CloudFront (più `localhost` nello stack `dev`). Un'origine diversa riceve `403 ORIGIN_DENIED`.
- **Log**: `/aws/lambda/<nome funzione>`, 7 giorni. Il backend registra solo eventi strutturati senza dati personali (`backend_error`, `config_error`). Consultazione rapida:
  ```powershell
  aws logs tail /aws/lambda/<funzione> --since 15m --profile live --follow
  ```
- **Monitoraggio**: *CloudWatch → Metrics*: Lambda `Errors`, `Throttles`, `Duration`; API Gateway `5xx`, `Count`; DynamoDB `ThrottledRequests`. Per il talk basta la regia (latenza e stato API in alto) più `logs tail` su un portatile. Le stesse metriche si leggono dall'app con `GET /admin/aws` (pulsante «Verifica il costo su AWS» in regia) e da terminale con `./scripts/aws-cost.ps1`.
- **Errori gestiti**: timeout client 5 s con retry e backoff; `503 BACKEND_UNAVAILABLE` con `retryInMs` per errori AWS temporanei; `503 CONFIG_UNAVAILABLE` se SSM non risponde al cold start (ritenta alla richiesta successiva); `429` rispettato dai client; `409` per conflitti attesi (pixel preso, fase cambiata). Lambda timeout 5 s, SSM timeout 3 s, SDK DynamoDB 3 tentativi.

## 12. Costi

### Le tre cifre, e perché non coincidono

| Cifra | Dove si vede | Cosa è davvero | Ritardo |
| --- | --- | --- | --- |
| **Scontrino della LIM** | scena «Il conto» | capacità che il backend ha *osservato* (`ReturnConsumedCapacity`) × listino pubblicato. Quantità misurate, prezzi di listino. Leggermente per difetto: il contatore è bufferizzato per container Lambda. | nessuno |
| **Verifica AWS** | stessa scena, riquadro blu · regia · `./scripts/aws-cost.ps1` | le stesse grandezze **secondo CloudWatch**: è AWS a dichiararle. Riferite alla tabella e alla funzione, non alla singola sessione: durante un talk ne gira una sola. | 1–3 minuti |
| **Fattura** | Cost Explorer · `./scripts/aws-cost.ps1 -Billed` | quello che AWS addebita davvero, **dopo** free tier, crediti e imposte. Spesso è zero, e zero è il risultato giusto. | 24–48 ore |

Lo scontrino è quindi onesto come stima e verificabile come misura. La riga che vale la pena dire ad alta voce è: «le quantità non ce le siamo inventate, e se non ci credete ecco gli stessi numeri letti da AWS».

```powershell
./scripts/aws-cost.ps1 -Environment live -AwsProfile live            # quantità, subito dopo il talk
./scripts/aws-cost.ps1 -Environment live -AwsProfile live -Billed    # + fattura reale (0,01 USD di chiamata)
```

Attenzione: **ogni chiamata a Cost Explorer costa 0,01 USD** e va abilitato una volta dalla console (*Billing → Cost Explorer*); `GetMetricData` costa 0,01 USD ogni 1.000 metriche richieste, cioè nulla a questi volumi.

### Stima a priori

| Voce | Stima per un talk (60 persone, 15 min) | Note |
| --- | --- | --- |
| API Gateway HTTP API | ~0,15–0,40 USD | 1,20 USD per milione di richieste, dominato dal polling |
| Lambda arm64 | < 0,05 USD | Il free tier mensile di solito copre tutto |
| DynamoDB on-demand | < 0,05 USD | Poche migliaia di WRU/RRU; GSI e transazioni inclusi |
| CloudFront + S3 | ~0 | Nel free tier |
| SSM Standard, CloudWatch Logs (7 giorni) | ~0 | |

Totale atteso: **sotto 1 USD per talk**. Le prove su `dev` (provisioned 5/5) restano nel free tier. Se fornisci `-BudgetEmail`, il budget del template avvisa al 50 % e al 100 % del consuntivo e sulla **previsione** del mese, oltre la soglia impostata con `-BudgetAmount` (2 USD predefiniti); **avvisa soltanto, non blocca**. Su un account con 20–50 USD di credito l'avviso sulla previsione è l'unico che arriva in tempo per fare qualcosa. Dopo il talk: `./scripts/aws-cost.ps1` subito per le quantità, Cost Explorer dopo 24–48 h per la fattura.

Tabella e bucket hanno `DeletionPolicy: Retain`: eliminare lo stack non li cancella. Per azzerare i costi dopo il progetto: `sam delete`, poi svuota ed elimina il bucket, elimina la tabella e il parametro SSM.

## 13. Riepilogo: manuale, automatico, codice, da non committare

| Area | Manuale (console) | Automatico | Nel codice/configurazione versionata | Mai nel repository |
| --- | --- | --- | --- | --- |
| Account | MFA root, alert free tier, verifica crediti | — | — | Credenziali root |
| IAM | Identity Center, utenti, permission set | Ruolo Lambda (SAM) | Policy Lambda nel template | Access key, `~/.aws/*` |
| CLI | `aws login` (o `aws configure sso`) | — | Nomi profili in `samconfig.toml` | File di configurazione personali |
| SSM | (opzionale) creare il parametro | `deploy-aws.ps1` lo crea | Nome del parametro nel template | Valore della chiave |
| DynamoDB / Lambda / API / S3 / CloudFront / Logs / Budget | — | `sam deploy` | `infra/template.yaml` | — |
| Frontend | — | `deploy-aws.ps1` (build, sync, invalidazione) | `frontend/.env.*.example` | `frontend/.env.dev`, `.env.live` |
| Quote | Lambda concurrency | — | Throttling nel template | — |
