# Checklist prima della presentazione

Stampatela o tenetela aperta sul telefono. Ogni voce è una cosa verificabile, non un'intenzione.

## Una settimana prima

- [ ] Stack `live` distribuito dal branch `prod` (`./scripts/deploy-aws.ps1 -Environment live`) e codice **congelato** da quel momento.
- [ ] `SiteUrl/stage?s=prova-xx` si apre in HTTPS; il QR porta al dominio CloudFront.
- [ ] Prova completa con **almeno 10–15 telefoni veri**, iOS e Android, sulla rete che userete (o dati mobili).
- [ ] Concorrenza Lambda dell'account ≥ 50 (*Lambda → Dashboard*); se è 10, richiesta di aumento già inviata.
- [ ] Crediti/free plan AWS validi alla data del talk; budget con email attivo.
- [ ] Almeno **due prove cronometrate a due voci** con la regia: totale entro 14:30.
- [ ] **Chiusura provata fino in fondo**: dopo l'ultimo «Avanti» i pallini spariscono uno per volta e il contatore arriva a `00:00:00` mentre si saluta. Se 60 s sono troppo pochi o troppi: `-EndTtlSeconds` alla creazione della sessione, oppure il pulsante in regia.
- [ ] Scena del costo: il riquadro «Gli stessi numeri, letti da AWS» compare (serve qualche minuto di traffico prima, perché CloudWatch ha 1–3 minuti di ritardo).
- [ ] Piano B provato una volta ciascuno: backend locale, LIM statica, video.
- [ ] Video di backup registrato (una prova completa) e copiato in `frontend/public/backup.mp4` **e** su una chiavetta.
- [ ] Numero del Prime Day verificato sul blog AWS (o frase senza numero).

## Il giorno prima

- [ ] Sessioni create: `./scripts/new-session-aws.ps1 -Environment live -Sid talk-01` e `talk-02` di riserva.
- [ ] Branch `develop` aggiornato sul portatile, `npm ci` fatto, **Docker Desktop avviabile offline**: `./scripts/demo-local.ps1` funziona con il Wi-Fi spento.
- [ ] `aws login --profile live` (o `aws sso login` con Identity Center) funziona: le credenziali temporanee scadono, rifarlo la mattina.
- [ ] Portatile, telefoni e powerbank carichi; adattatore HDMI/USB-C; telecomando con batterie.
- [ ] Browser: un profilo pulito solo per la presentazione (niente estensioni, niente password salvate in vista, zoom al 100%).

## 30 minuti prima

- [ ] Rete: provare l'URL del talk dal telefono con Wi-Fi della sala **e** con dati mobili.
- [ ] Hotspot del telefono pronto come alternativa.
- [ ] Proiettore collegato, schermo **esteso** (non duplicato): LIM sul proiettore, regia sul portatile.
- [ ] Notifiche disattivate (Windows *Non disturbare*, telefono in silenzioso), aggiornamenti di Windows in pausa, risparmio energetico disattivato.
- [ ] Orologio del portatile sincronizzato (*Impostazioni → Data e ora → Sincronizza ora*): non rompe niente, ma la regia lo segnala e i tempi a schermo restano quelli del server.
- [ ] Chiave admin negli appunti: `./scripts/new-session-aws.ps1 -Environment live -Sid talk-01 -CopyKey` (la sessione esiste già: lo script copia solo la chiave).

## 10 minuti prima

- [ ] LIM: `https://<SiteUrl>/stage?s=talk-01`, schermo intero (F11), slide 1 con il QR.
- [ ] Regia aperta con **R**, spostata sul portatile, chiave incollata.
- [ ] In regia tutto **verde**: «LIM collegata», «AWS · eu-central-1 · xx ms» (sotto 300 ms), «Chiave admin ok», e **nessun** avviso sull'orologio.
- [ ] Fase database = «Lobby · ingresso aperto», cronometro a `--:--`.
- [ ] Lambda scaldata: aprire `/play?s=talk-01` su un telefono ed entrare con un nome di prova (poi chiudere).
- [ ] QR letto dall'ultima fila.
- [ ] Scorciatoie ripassate: → Avanti, Esc stato sicuro, H nascondi tela, I X-Ray, Invio round.
- [ ] Acqua. Respirare.

## Durante

- [ ] Chi non parla guarda la regia: scheda *Dopo*, tempi, registro.
- [ ] Meno di 10 giocatori a 20 secondi dall'inizio del Pixel Wall → «Completa il logo» prima.
- [ ] Un errore rosso in regia non si commenta ad alta voce: si segue [troubleshooting](troubleshooting.md).

## Dopo

- [ ] Screenshot della tela finale e del podio.
- [ ] Fase `end` raggiunta (l'ingresso è chiuso da solo).
- [ ] Subito: `./scripts/aws-cost.ps1 -Environment live -AwsProfile live` — le quantità misurate da AWS, da confrontare con lo scontrino mostrato in sala.
- [ ] Dopo 24–48 h: costo davvero fatturato, `./scripts/aws-cost.ps1 -Environment live -AwsProfile live -Billed` (o *Cost Explorer*). Se è zero, il free tier ha coperto tutto: è il risultato giusto.
- [ ] A progetto concluso: `sam delete` e pulizia di bucket, tabella e parametro SSM (vedi [aws-setup.md](aws-setup.md#12-costi)).
