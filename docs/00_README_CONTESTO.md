# DynamoLive — Contesto di progetto

> **Leggi questo file per primo.** Riassume il progetto, le decisioni prese e dove trovare il resto.
> Serve a riprendere il lavoro in una nuova sessione (umana o con un assistente AI) senza rileggere le chat.

## File del pacchetto

| File | Contenuto |
|---|---|
| `00_README_CONTESTO.md` | Questo file: obiettivo, vincoli, decisioni prese, stack, glossario |
| `01_GIOCHI_SPEC.md` | Regole dei giochi + specifica tecnica (tabella, GSI, API, fasi, Inspector, tassametro) |
| `02_PRESENTAZIONE.md` | Scene/slide, timeline dei 15', narrativa, memorable moments, identità visiva |
| `03_DOCUMENTO_APPROFONDIMENTO.md` | Struttura del documento di studio e cosa va dove |
| `04_TASKS_ROADMAP.md` | Backlog a fasi con checkbox, critical path, piano B, checklist, decisioni aperte |

---

## 1. Il progetto in 5 righe

Presentazione di **15 minuti**, in **2 persone**, su **Amazon DynamoDB**.
Tutta la presentazione gira **nel browser**: slide e giochi sono la stessa web app.
Il pubblico entra dal telefono tramite QR al minuto 0 e gioca a **due mini-giochi che usano DynamoDB davvero**: **PIXEL WALL** e **HOT KEY**.
Ogni concetto teorico viene spiegato usando **i dati che il pubblico ha appena scritto**.
Accanto alla presentazione c'è un **documento di approfondimento** da studiare.

**Concept:** *"Siete già nel database."*

**Obiettivo finale per il pubblico** (alla fine dei 15'):
- sapere cos'è DynamoDB e perché esiste;
- capire in quali problemi è utile;
- capire come differisce mentalmente da un relazionale ("prima le domande, poi i dati");
- averlo visto funzionare dentro qualcosa di interessante.

---

## 2. Decisioni prese (non ridiscutere senza motivo)

1. **Due demo:** PIXEL WALL (cooperativo, tante chiavi) e HOT KEY (competitivo, chiavi "calde"). Il contrasto tra i due spiega la hot partition senza spiegarla.
2. **Presentazione interamente nel browser:** il deck è costruito **dentro la stessa SPA** dei giochi (niente Slidev/PowerPoint), per avere continuità totale tra slide e demo.
3. **Struttura del documento di approfondimento:** approvata (vedi `03_`).
4. **Divisione dei compiti:** la gestiscono le due persone del team. I file non assegnano owner.
5. **Memorable moments scelti:**
   - **"Questo sei tu"**: il JSON reale di uno spettatore sulla slide.
   - **"Ora siamo mille"**: **simulato via codice**, come proiezione.
   - **"Lo scontrino"**: costo reale in tempo reale.
   - Il 2 e il 6 vivono in un **"tassametro" sempre visibile in un angolo**, con focus sull'aspetto **economico**.
   - Bonus: in chiusura la tela finale con il countdown del TTL.
6. **Inspector** (ex "X-Ray", rinominato perché **AWS X-Ray è un servizio esistente**): pannello frontend che mostra query reali, item grezzi, capacità consumata e latenza. Costo aggiuntivo ≈ 0. **Da confermare, ma consigliato.**
7. **Collegamento narrativo slide ↔ giochi:** approvato, con i giochi integrati (vedi `02_`).
8. **Tempo reale via polling**, non WebSocket: meno costo, meno codice, meno rischio.
9. **Una sola tabella DynamoDB, una sola Lambda, una sola SPA.**

## 3. Non-obiettivi

- Nessun test di carico reale: il "×1000" è una **proiezione dichiarata**.
- Nessuna autenticazione utente (Cognito ecc.). L'id giocatore generato dal server fa da bearer.
- Nessun WebSocket o Streams nell'MVP (Streams è uno stretch goal).
- Nessun servizio AWS aggiunto "per fare scena".

---

## 4. Vincoli

- **Tempo sul palco:** 15:00 netti, con circa 45" di buffer.
- **Budget:** 2 account AWS in Free Tier, da usare sia per le prove sia per il talk.
  - Account nuovi (dopo luglio 2025): circa 100 $ di crediti più fino a 100 $ con attività; il **Free plan dura 6 mesi o finché finiscono i crediti** → ⚠️ **verificare la data di scadenza rispetto alla data del talk**.
  - Always free: Lambda 1M richieste/mese; DynamoDB 25 GB + 25 RCU/WCU (**solo capacità provisioned**); CloudFront 1 TB + 10M richieste.
  - L'on-demand di DynamoDB e API Gateway scalano dai crediti: sono **centesimi** per talk.
- **Pubblico:** stima 20–60 persone, telefoni misti iOS e Android, rete della sala sconosciuta.

## 5. Strategia account

| | **DEV** | **LIVE** |
|---|---|---|
| Uso | Sviluppo + test di integrazione | Solo prove generali + talk |
| DynamoDB | Provisioned 25/25 (always free) oppure DynamoDB Local | **On-demand** (niente throttling a sorpresa) |
| Deploy | `sam deploy --config-env dev` | `sam deploy --config-env live` |
| Budget alarm | 1 $ | 2 $ |

Il 90% dello sviluppo si fa contro **DynamoDB Local (Docker)**, a costo zero.

---

## 6. Stack

- **Frontend:** Vite + TypeScript. Vanilla o Preact, niente di pesante. Una SPA con due route:
  - `/play` → telefoni del pubblico;
  - `/stage` → deck + giochi + Inspector + tassametro (maxischermo).
- **Hosting:** S3 + CloudFront (HTTPS, necessario per i telefoni).
- **API:** API Gateway **HTTP API** (CORS, throttling di default).
- **Backend:** **1 Lambda** Node.js 22 + TypeScript, arm64, 256 MB, timeout 5s, router interno. SDK v3 (`@aws-sdk/lib-dynamodb`).
- **DB:** 1 tabella `DynamoLive`, 2 GSI (`ByTime`, `ByScore`), TTL su `expiresAt`.
- **IaC:** AWS SAM (`template.yaml` + `samconfig.toml` con env `dev` e `live`).
- **Regione:** `eu-central-1` (Francoforte). Milano `eu-south-1` è opt-in.
- **Locale:** DynamoDB Local in Docker + un piccolo server Node che riusa l'handler della Lambda.

### Struttura repo proposta

```
dynamolive/
├─ infra/            template.yaml, samconfig.toml
├─ backend/
│  ├─ src/handler.ts         router
│  ├─ src/routes/            join, meta, pixel, canvas, tap, leaderboard, rank, stats, admin
│  ├─ src/lib/ddb.ts         client + helper
│  ├─ src/lib/inspect.ts     costruzione di _inspect
│  ├─ src/lib/meter.ts       aggregazione capacità → STATS
│  └─ local-server.ts        wrapper HTTP per sviluppo locale
├─ frontend/
│  ├─ src/play/              schermate telefono per fase
│  ├─ src/stage/deck/        motore slide (frecce, scorciatoie)
│  ├─ src/stage/slides/      1 componente per slide
│  ├─ src/stage/games/       PixelWallStage, HotKeyStage
│  ├─ src/stage/widgets/     Meter (tassametro), Inspector
│  └─ src/shared/            api.ts, config.ts, tokens.css, palette.ts
├─ bots/                     pixel-bot.ts, hotkey-bot.ts
├─ scripts/                  seed-local.ts, reset-session.ts
└─ docs/                     questi file .md
```

---

## 7. Glossario interno

| Termine | Significato |
|---|---|
| `sid` | Session id di un talk o prova (es. `talk-01`, `prova-03`). Tutto è scoped per sessione |
| `pid` | Player id, UUID generato dal server al join |
| **fase** | Stato globale della sessione nell'item `META`. **Le slide cambiano fase, i telefoni la seguono** |
| **stage** | Il maxischermo (`/stage`) |
| **Inspector** | Pannello "sotto il cofano" sullo stage |
| **tassametro** | Widget nell'angolo che mostra richieste, scritture e costo stimato |
| **regia** | Il meccanismo stage → META → telefoni |

---

## 8. Come ripartire in una nuova sessione

Prompt suggerito da incollare insieme ai 5 file:

> Stiamo preparando una presentazione di 15' su DynamoDB con due mini-giochi live (PIXEL WALL e HOT KEY) in una web app unica.
> Ti allego i file di contesto: il README riassume decisioni e vincoli, `01_` è la specifica tecnica, `02_` le slide, `03_` il documento di studio, `04_` il backlog.
> Rispetta le decisioni prese. Siamo alla fase **[X]** di `04_TASKS_ROADMAP.md`.
> Oggi vogliamo lavorare su: **[task]**.
