# Troubleshooting e piano B

La presentazione deve continuare **qualunque cosa succeda**. Regola: chi parla continua a parlare, chi è in regia risolve. Al pubblico si dice al massimo una frase («Passiamo alla versione registrata»), mai un'imprecazione.

## Piano B a livelli

| Livello | Sintomo | Azione in regia / portatile | Il pubblico se ne accorge? |
| --- | --- | --- | --- |
| 0 | Qualcosa di strano sulla LIM (overlay aperto, zoom bloccato, sciame impazzito) | **Esc** = stato sicuro | No |
| 1 | Wi-Fi della sala lento o assente | Il pubblico usa i dati mobili; il portatile va in hotspot dal telefono. AWS resta raggiungibile | Poco |
| 2 | Pochi giocatori, join lenti | «Completa il logo» (sciame) prima del previsto; bot runner | Praticamente no |
| 3 | AWS irraggiungibile, credenziali o servizio in errore | Backend locale (**branch `develop`**) + LIM sul locale: si gioca solo dalla LIM e dalla regia | Sì, ma la demo continua |
| 4 | Niente rete e niente Docker | **LIM statica** dalla regia (nessuna chiamata di rete, dati d'esempio dichiarati) | Sì |
| 5 | Portatile o browser bloccati | **Video di backup** (regia o P sulla LIM), oppure dalla chiavetta su un altro PC | Sì |
| — | Contenuto inappropriato sulla tela | **H** nasconde subito; poi congela, seleziona, «Cancella rettangolo», «Escludi autore» | 2–3 secondi |

### Livello 3 nel dettaglio: passare al locale

Preparazione (giorno prima): branch `develop` sul portatile, `npm ci`, Docker Desktop che parte offline.

1. Terminale: `./scripts/demo-local.ps1 -Sid talk-local` (DynamoDB Local, API e frontend).
2. Aprire **dallo stesso browser** `http://localhost:5173/stage?s=talk-local` sulla LIM, poi **R** per la regia.
3. Chiave admin: quella di `.env` locale.
4. Si riparte dalla scena in cui si era (tasti numerici sulla LIM per il salto visivo; le fasi si riavanzano con Avanti).

Non si passa al locale dalla pagina HTTPS di CloudFront: il browser blocca le chiamate da un sito HTTPS pubblico verso `http://localhost`. Si apre sempre il frontend locale su `localhost:5173`.

I telefoni del pubblico non possono raggiungere il portatile via HTTPS: al livello 3 si gioca con lo sciame e i bot, e si spiega sulla LIM.

### Livello 4: LIM statica

Regia → Emergenza → «LIM statica (senza rete)» → conferma. La LIM si ricarica con `?mode=static`: le 10 scene funzionano con dati d'esempio (logo completo, item, tabella, podio, scontrino). La regia resta collegata e continua a comandare Avanti/Indietro. Per tornare: «LIM di nuovo live».

Senza regia: aggiungere `&mode=static` all'URL della LIM.

## Problemi frequenti

| Problema | Causa probabile | Soluzione |
| --- | --- | --- |
| Regia: «LIM non trovata» | LIM e regia in browser/profili/origini diversi, o LIM chiusa | Aprire la regia con **R** dalla LIM; stessi parametri `s` e `api` |
| Regia: «Chiave admin mancante» / errore 401 | Chiave non incollata o sbagliata | Incollare la chiave (`new-session-aws.ps1 -CopyKey`); la LIM la riceve dalla regia |
| Regia: backend rosso «non raggiungibile» | Rete, API URL sbagliato, stack non distribuito | Aprire `<ApiUrl>/s/<sid>/meta` nel browser; controllare la rete; piano B |
| Errore `403 ORIGIN_DENIED` | Pagina aperta da un'origine non in CORS (es. IP in LAN, altro dominio) | Usare il dominio CloudFront; in locale aggiungere l'origine ad `ALLOWED_ORIGINS` |
| `404 SESSION_NOT_FOUND` | Sid sbagliato o sessione scaduta (24 h) | Creare una sessione nuova con un sid nuovo |
| `409 SESSION_EXISTS` | Il sid esiste già | Le sessioni non si sovrascrivono: usare un sid diverso |
| Avanti «Verrà rifiutato…» / `INVALID_TRANSITION` | Dopo un salto visivo la LIM è più avanti della fase | Tornare con ← alla scena indicata dalla regia e riprendere da lì |
| «Attendere i batch finali» (`ROUND_SETTLING`) | Si chiude la presentazione entro 2 s dalla fine del round | Aspettare 2 secondi e ripremere Avanti |
| `503 CONFIG_UNAVAILABLE` | La Lambda non riesce a leggere la chiave da SSM | Il parametro `/dynamolive/<env>/admin-key` esiste? È nella stessa regione? Ritentare: il caricamento riparte |
| `503 BACKEND_UNAVAILABLE` ripetuti | Errore DynamoDB temporaneo o throttling | Si riprova da soli; se persiste: `aws logs tail` e piano B |
| `429` frequenti | Throttling API Gateway (pubblico numeroso) o cooldown | Normale sul cooldown; oltre ~80 persone alzare `ThrottlingRateLimit` e ridistribuire (non durante il talk) |
| Telefoni lenti a entrare | Cold start o concorrenza Lambda bassa | Scaldare prima; verificare la quota di concorrenza |
| QR non leggibile | Proiettore scuro, distanza | Leggere a voce l'URL corto (dominio CloudFront) o ingrandire la LIM |
| Lo sciame non parte | Fase diversa da «Pixel Wall in corso» o tela già completa | Lo sciame funziona solo durante il gioco |
| DynamoDB Local non parte | Docker Desktop spento | Avviare Docker Desktop; in alternativa `scripts/setup-local-windows.ps1 -Start` (Java portatile) |
| `aws` / `sam`: token scaduto | Sessione SSO scaduta | `aws sso login --profile live` |
| `sam deploy`: il parametro SSM non esiste | Primo deploy senza segreto | Usare `deploy-aws.ps1` (lo crea) o crearlo a mano ([aws-setup.md §8](aws-setup.md#8-segreto-admin-in-ssm-parameter-store)) |
| Frontend su CloudFront vecchio dopo il deploy | Cache | `deploy-aws.ps1` invalida `/*`; attendere 1–2 minuti o ricaricare con Ctrl+F5 |
| Pagina bianca su `/stage` diretto | Rewrite SPA non attivo | Verificare la CloudFront Function `…-spa` associata alla distribuzione |

## Diagnosi rapida

```powershell
# Il backend risponde? (sostituire URL e sid)
curl.exe -s https://<api-id>.execute-api.eu-central-1.amazonaws.com/s/talk-01/meta

# Ultimi errori della Lambda
aws logs tail /aws/lambda/<nome-funzione> --since 15m --profile live

# Output dello stack (URL, bucket, distribuzione)
aws cloudformation describe-stacks --stack-name dynamolive-live --query "Stacks[0].Outputs" --profile live

# Locale: backend e database
curl.exe -s http://127.0.0.1:3001/s/demo-01/meta
docker compose ps
```
