# Guida alla demo

Come avviare DynamoLive, come sono fatte le tre viste e come si usa la regia durante la presentazione.

## Avvio locale (senza AWS)

Requisiti: Node.js 22+, npm, Docker Desktop avviato.

**Branch `develop`, un comando:**

```powershell
./scripts/demo-local.ps1                 # sessione nuova demo-MMDD-HHmm
./scripts/demo-local.ps1 -Sid prova-02   # sessione con nome scelto
```

Lo script avvia DynamoDB Local, crea `.env` e `frontend/.env.development` dagli esempi se mancano, crea la sessione e apre API e frontend in due finestre. Alla fine stampa gli URL.

**Sul branch `prod` non c'è nessun emulatore**: niente `compose.yaml`, niente `.env.example`, niente server Node locale. Per provare da lì senza AWS restano le modalità **mock** e **statica** (sotto), che bastano per il copione e per il piano B. Per un database vero in locale si passa a `develop`.

**A mano (qualsiasi branch tranne `prod`):**

```powershell
npm ci; npm --prefix frontend ci
Copy-Item .env.example .env                                            # solo se non esiste
Copy-Item frontend/.env.development.example frontend/.env.development  # solo se non esiste
docker compose up -d
npm run seed -- --sid demo-01
npm run dev:api                     # terminale 1 → http://127.0.0.1:3001
npm --prefix frontend run dev       # terminale 2 → http://localhost:5173
```

Senza Docker: `scripts/setup-local-windows.ps1 -Start` scarica Java portatile e DynamoDB Local (con verifica SHA-256) in `.local/`.

Una sessione non si riavvia: per ripartire da zero si crea un **sid nuovo** (`npm run seed -- --sid demo-02`, oppure dalla regia «Nuova sessione»).

La regia genera un identificativo casuale univoco: puoi creare più prove nello stesso minuto. LIM e regia si spostano insieme sulla nuova lobby; sui telefoni occorre **scansionare il nuovo QR**, perché i link precedenti restano associati alla vecchia sessione. I nuovi giocatori entrano durante lobby e Pixel Wall; dopo queste fasi l’ingresso è chiuso.

### Telefoni sulla stessa rete Wi-Fi (facoltativo)

Di default API e frontend rispondono solo al portatile. Per far entrare telefoni veri in LAN:

1. In `.env`: `HOST=0.0.0.0` e aggiungi a `ALLOWED_ORIGINS` l'origine del frontend vista dal telefono, per esempio `http://192.168.1.20:5173`.
2. In `frontend/.env.development`: `VITE_PUBLIC_ORIGIN=http://192.168.1.20:5173` (così il QR punta all'IP giusto).
3. Riavvia l'API. Windows chiederà di consentire Node.js nel firewall: consenti solo per le reti private.
4. Sul telefono: `http://192.168.1.20:5173/play?s=demo-01&api=local`.

Questo espone l'API alla rete locale: fallo solo su reti fidate e riporta `HOST` a `127.0.0.1` dopo. Per il talk vero si usa AWS (HTTPS).

## Le tre viste

| Vista | URL | Dove | Cosa fa |
| --- | --- | --- | --- |
| LIM | `/stage?s=SID` | Proiettore, schermo intero (F11) | Le 10 scene, i giochi, X-Ray e tassametro. Nessun pulsante visibile al pubblico |
| Regia | `/regia?s=SID` | Secondo schermo del portatile | Comandi, note, tempi, emergenza. Si apre dalla LIM con **R** |
| Telefono | `/play?s=SID` | Pubblico | Nome, Pixel Wall, HOT KEY, risultato |

LIM e regia comunicano con `BroadcastChannel`: **stesso browser, stesso profilo, stessa origine**. Aprile entrambe dallo stesso Chrome/Edge.

Parametri utili: `api=local` (backend sulla porta 3001 dello stesso host), `api=<url>` (backend specifico), `mode=mock` (database finto nel browser), `mode=static` (nessuna rete, dati d'esempio).

## La regia


Dall'alto verso il basso:

1. **Stato**: LIM collegata · backend (AWS/Locale/Simulato) con latenza · chiave admin. Verde = ok, rosso lampeggiante = problema.
2. **Tempi**: totale (su 14:15 previsti) · sezione corrente (sulla durata prevista) · tabella di marcia (in ritardo/in anticipo). Il cronometro parte da solo al primo Avanti dopo la lobby.
3. **Ora / Dopo**: scena e passo correnti, **chi parla** (Speaker 1 / 2), fase del database; la scheda *Dopo* dice cosa farà Avanti:
   - «cambia solo la slide»;
   - «cambia la fase del database: … Non si torna indietro»;
   - «avvia 3·2·1» (nella scena HOT KEY);
   - in rosso «Verrà rifiutato…» se dopo un salto la LIM è più avanti della fase: indica la scena da cui riprendere.
   - «Passa a Speaker N» quando al passo successivo cambia chi parla.
4. **Indietro / Avanti**: Avanti è il pulsante grande. Mentre il database risponde mostra «Attendo il database…»; un secondo Avanti premuto nel frattempo viene eseguito dopo, ma **non** fa mai partire da solo il round HOT KEY.
5. **Cosa dire**: note della scena.
6. **Pannelli di gioco** (compaiono quando servono): Pixel Wall con sciame «Completa il logo», mini-tela e moderazione; HOT KEY con «Avvia 3·2·1».
7. **Chiusura · TTL della tela** (solo nella scena finale): conto alla rovescia della dissolvenza, quanti item sono ancora vivi, e due pulsanti per **riavviare la dissolvenza** su 60 s o 3 minuti. Serve se si arriva alla chiusura in anticipo o se la riscrittura dei TTL è riuscita solo in parte.
8. **Emergenza** (sempre visibile): Stato sicuro, Nascondi tela, LIM statica / di nuovo live, Video di backup.
9. **Strumenti e sessione** (chiuso): X-Ray, tassametro, bot runner, schermo intero, **verifica del costo su AWS**, ricarica LIM, nuova sessione, cambio chiave (e, solo con il frontend in esecuzione locale, passaggio al backend locale).
10. **Tutte le scene**: salto visivo (non cambia la fase).
11. **Registro**: ultimi eventi ed errori.

**Stato «LIM collegata».** La regia interroga la LIM ogni 1,5 s e misura la risposta sull'orologio locale, non su quello corretto dal server. Due conseguenze volute: la LIM risulta collegata anche quando il sistema operativo la considera nascosta (schermo intero dietro la regia) e ne rallenta i timer, e un orologio di Windows disallineato non la fa più sembrare morta — al massimo compare l'avviso «Orologio locale fuori di N s», che non blocca niente.

**Verifica del costo su AWS.** Legge da CloudWatch le stesse grandezze dello scontrino (WRU, RRU, richieste, durata Lambda) e le scrive nel registro. Serve per controllare prima di mostrarle in sala. Gli stessi numeri compaiono da soli nella scena del costo, in un riquadro blu a sinistra, quando CloudWatch risponde: hanno 1–3 minuti di ritardo e si riferiscono alla tabella e alla funzione, non alla singola sessione. Vanno confrontati con il **totale** dello scontrino: AWS non distingue i telefoni da LIM e regia.

**Tassametro e scontrino.** Il tassametro nell'angolo («Il vostro conto») conta solo le richieste dei telefoni: a sala vuota resta fermo, anche se LIM e regia interrogano il backend. Lo scontrino mostra due voci, «Voi» e «LIM e regia», e viene fotografato quando si apre la scena; i passi ×1.000 e ×1.000.000 moltiplicano solo «Voi». Una sessione creata con un backend precedente a questa modifica mostra un'unica voce, come prima.

**Conferme.** Le azioni irreversibili o che interrompono la LIM (congela, cancella rettangolo, escludi autore, ricarica LIM, nuova sessione, backend locale, LIM statica, azzera cronometro) chiedono un secondo clic entro 4 secondi: il pulsante diventa rosso e dice «Conferma…». Le azioni di emergenza rapide (Stato sicuro, Nascondi tela) non chiedono conferma.

**Regola di squadra:** chi parla guarda il pubblico; **chi non parla guida la regia**.

### Scorciatoie

| Tasto | Regia | LIM |
| --- | --- | --- |
| → · PagGiù | Avanti | Avanti (anche Spazio) |
| ← · PagSu | Indietro (solo slide) | Indietro |
| Invio | Avvia 3·2·1 (scena HOT KEY) | Avvia 3·2·1 (scena HOT KEY) |
| Esc | **Stato sicuro** | Chiude lo zoom sul pixel |
| I | X-Ray | X-Ray |
| H | Nascondi/mostra tela | Nascondi/mostra tela |
| R | — | Apre la regia |
| M, F, P | — | Tassametro, congela tela, video |
| 1–9, 0 | — | Salto visivo alla scena 1–10 |

Un telecomando da presentazione (che invia PagGiù/PagSu) funziona su entrambe le finestre, quella che ha il focus.

## Sequenza delle scene

| # | Scena | Speaker | Durata | Fase database in avanti |
| --- | --- | --- | --- | --- |
| 1 | Tirate fuori il telefono | 1 | 1:00 | `lobby` |
| 2 | Accendete il logo (Pixel Wall → zoom → autore → tabella) | 1 | 2:30 | `pixel` (90 s), poi `pixel_frozen` |
| 3 | Natale 2004 | 2 | 1:00 | — |
| 4 | La chiave decide dove vivi | 2 | 1:30 | `talk` al 3° passo: squadre rivelate |
| 5 | Prima le domande | 1 | 1:00 | — |
| 6 | Zero server (nostri) | 2 | 0:30 | `hotkey_ready` |
| 7 | HOT KEY | 1 + 2 | 2:30 | `hotkey_running` solo con Avvia 3·2·1 |
| 8 | Cosa è appena successo | 2 | 1:30 | `hotkey_end` |
| 9 | Non è più semplice | 1 | 1:30 | — |
| 10 | Il ricordo (TTL) | 2 → 1 | 1:15 | `end` (dopo 2 s di grace) |

## Modalità senza backend

- **Mock** (`?mode=mock`, stessa origine e profilo per LIM, regia e un telefono): database finto in `localStorage`. Utile per provare l'interfaccia e il copione senza Docker. Dicitura «Simulato» sempre visibile. Non sincronizza dispositivi diversi.
- **Statico** (`?mode=static`, o «LIM statica» dalla regia): nessuna chiamata di rete; dieci scene con dati d'esempio dichiarati. È l'ultima rete di sicurezza se non funziona niente.

## Bot

- **Sciame** (regia, «Completa il logo»): 4–40 giocatori virtuali che accendono le celle mancanti attraverso la stessa API. Si chiamano `bot.01…`: dichiararlo al pubblico. Non vengono contati fra le «persone in sala» né in regia né sulla scena del costo; la regia li mostra a parte («12 in sala + 16 virtuali»).
- **Bot runner** (terminale, pochi giocatori reali): `npm run bot:runner -- --sid SID --n 20 --api URL`, poi «Bot runner: on» in regia.
