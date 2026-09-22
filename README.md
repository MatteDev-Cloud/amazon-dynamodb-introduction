# DynamoLive

Presentazione interattiva su DynamoDB: Pixel Wall e HOT KEY in un'unica web app.

## Documenti

- [Contesto](docs/00_README_CONTESTO.md)
- [Divisione tra agenti](docs/05_DIVISIONE_LAVORO_AGENTI.md)
- [Contratto API e integrazione frontend](docs/06_CONTRATTO_CONDIVISO.md)
- [Guida tecnica: locale, test, bot e deploy](docs/07_GUIDA_TECNICA.md)
- [Guida di presentazione e frontend](docs/08_GUIDA_PRESENTAZIONE.md)

## Backend locale

Node.js 22.9+, npm e DynamoDB Local (Docker oppure Java):

```powershell
npm ci
Copy-Item .env.example .env
docker compose up -d
npm run seed -- --sid prova-01
npm run dev:api
```

Non sovrascrivere un `.env` esistente. Senza Docker, gli script `scripts/setup-local-windows.ps1` e `scripts/start-local-db.ps1` preparano ed eseguono DynamoDB Local con Java portatile; dettagli nella guida tecnica.

API: `http://127.0.0.1:3001/s/prova-01/meta`. I file frontend sono di competenza dell'agente B; il backend non serve la SPA.

```powershell
npm run typecheck
npm test
npm run test:integration
npm run build:backend
```

I test di integrazione usano esclusivamente DynamoDB Local e una tabella temporanea. `npm run test:smoke` verifica anche HTTP e bot con API avviata. Per una nuova sessione: `npm run reset -- --sid prova-02`.

## Frontend locale

Con il backend locale già avviato (`npm run dev:api`, vedi sopra):

```powershell
npm --prefix frontend ci
Copy-Item frontend/.env.development.example frontend/.env.development
npm --prefix frontend run dev
```

Aprire `http://localhost:5173/stage?s=prova-01` e `http://localhost:5173/play?s=prova-01`. Dettagli su variabili d'ambiente (locale/DEV/LIVE separate), build e deploy nella [guida di presentazione](docs/08_GUIDA_PRESENTAZIONE.md).

## Infrastruttura e deploy

Il template SAM in `infra/` prepara DEV/LIVE, HTTP API, Lambda, DynamoDB e hosting S3/CloudFront. Deploy AWS e prove con frontend/telefoni restano da eseguire.
