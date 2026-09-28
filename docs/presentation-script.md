# Copione della presentazione (15 minuti, due voci)

**Durata prevista 14:15** con giochi e pause, più 45 secondi di margine. **Speaker 1 ≈ 7:30, Speaker 2 ≈ 6:45.**

Il testo è scritto per essere detto, non letto: non serve impararlo a memoria parola per parola. Le frasi tra «» sono quelle da dire più o meno così; il resto sono indicazioni di scena.

## Come ci organizziamo

- **LIM** sul proiettore, **regia** sul portatile (o secondo schermo) davanti a noi.
- **Chi non parla guida la regia.** Chi parla guarda il pubblico. Il portatile sta tra i due: al cambio di voce ci si scambia solo il posto davanti alla tastiera.
- La regia dice sempre **chi parla adesso** e, nella scheda *Dopo*, **cosa farà Avanti** e quando tocca all'altro («Passa a Speaker 2»).
- «Slide» = numero di scena sulla LIM (1–10) e passo della scena, per esempio *2.3*.
- Se qualcosa va storto: **Esc** in regia (stato sicuro) e si continua a parlare. Vedi [troubleshooting](troubleshooting.md).

| Tempo | Slide | Chi parla | Regia | Contenuto |
| --- | --- | --- | --- | --- |
| 00:00 | 1 | Speaker 1 | Speaker 2 | Apertura, QR, nomi |
| 01:00 | 2.1 | Speaker 1 | Speaker 2 | Pixel Wall (90 s di gioco) |
| 02:30 | 2.2–2.4 | Speaker 1 | Speaker 2 | Un pixel è un item, «questo sei tu» |
| 03:30 | 3 | Speaker 2 | Speaker 1 | Perché esiste DynamoDB |
| 04:30 | 4 | Speaker 2 | Speaker 1 | Partition key, sort key, squadre |
| 06:00 | 5 | Speaker 1 | Speaker 2 | Access pattern, GSI, Query vs Scan |
| 07:00 | 6 | Speaker 2 | Speaker 1 | Architettura serverless |
| 07:30 | 7 | Speaker 1 + 2 | Speaker 2 | HOT KEY |
| 10:00 | 8 | Speaker 2 | Speaker 1 | Costi |
| 11:30 | 9 | Speaker 1 | Speaker 2 | Quando sì, quando no |
| 13:00 | 10 | Speaker 2 → 1 | Speaker 1 | TTL, saluti |

---

## 00:00 – 01:00 · Slide 1 «Tirate fuori il telefono» · Speaker 1

*Prima di iniziare: LIM già sulla slide 1 con il QR, regia collegata e in verde, fase «Lobby».*

**Speaker 1:**
«Buongiorno a tutti. Prima di cominciare vi chiediamo una cosa sola: tirate fuori il telefono.
Inquadrate il QR, scegliete un nome, anche inventato. Tra poco vi spieghiamo cosa avete appena fatto.»

*Lasciare 20–30 secondi. I nomi compaiono sulla LIM.* Speaker 2 in regia controlla che il numero di giocatori cresca.

**Speaker 1** (quando i nomi iniziano a comparire):
«Questi nomi non sono un'animazione preparata. Ognuno di voi, in questo momento, è una riga in un database su AWS. Oggi non vi mostriamo DynamoDB: ci entrate dentro.»

**Transizione** – Speaker 1: «Cominciamo con qualcosa da costruire insieme.»
▶ **Speaker 2 preme Avanti** → *slide 2.1, la fase diventa «Pixel Wall in corso» e partono 90 secondi.*

## 01:00 – 02:30 · Slide 2.1 «Accendete il logo» · Speaker 1 (gioco)

**Speaker 1:**
«La tela è nera, ma dentro c'è un'immagine nascosta. Sul telefono avete un pulsante: premetelo, o tenetelo premuto. Ogni mezzo secondo accendete un pixel. Avete novanta secondi.»

*Lasciar giocare 20 secondi, poi:*

«Ogni pallino che si accende è una scrittura nel database. Il telefono vi mostra anche la chiave che ha scritto, tipo PX#012#005: colonna 12, riga 5.
E se in due puntate la stessa cella nello stesso istante? Vince il primo. L'altro riceve un rifiuto e il telefono prova subito un'altra cella. Nessuno aspetta, nessun lucchetto.»

*Verso i 60 secondi (timer in regia a ~0:30):*

**Speaker 1:** «Siamo pochi per finire in tempo. Chiamiamo rinforzi.»
▶ **Speaker 2 in regia: «Completa il logo».**
**Speaker 1:** «Adesso stanno scrivendo in parallelo sedici giocatori virtuali, dichiaratamente dei bot, sulla stessa API dei vostri telefoni. Gli anelli rossi sono scritture sulla stessa cella nello stesso momento: il database accetta la prima e rifiuta le altre con una condizione.»

*Se compare qualcosa di inappropriato:* Speaker 2 preme **H** (nasconde la tela), senza commentare.

*A 0:00 la tela si congela da sola. Oppure Speaker 2 preme Avanti prima, se il logo è completo.*

**Transizione** – Speaker 1: «Questo logo è fatto di duecentocinquantadue righe di database. Apriamone una.»
▶ **Speaker 2: Avanti** → *2.2, zoom su un pixel acceso da una persona (la LIM lo sceglie da sola).*

## 02:30 – 03:30 · Slide 2.2 – 2.4 «Questo sei tu» · Speaker 1

**Speaker 1** (2.2, zoom sul pixel):
«Un pixel è un item. Guardate le due chiavi. La partition key, CANVAS più il nome della sessione, tiene insieme tutti i pixel di questa tela. La sort key è la posizione, PX colonna riga, e li tiene già in ordine.»

▶ **Speaker 2: Avanti** → *2.3, compare l'item del giocatore.*

**Speaker 1:**
«E questo… sei tu.» *(leggere il nickname, guardare la sala)* «A sinistra la cella, a destra il giocatore che l'ha accesa: nome, quanti pixel ha piazzato. Due cose diverse, nella stessa tabella, con attributi diversi.»

▶ **Speaker 2: Avanti** → *2.4, la tabella.*

**Speaker 1:**
«Ecco la tabella intera: pixel, giocatori, lo stato della partita e i contatori vivono insieme. La partition key raggruppa, la sort key ordina. Lo schema è flessibile, ma non è anarchia: le regole le decide l'applicazione.»

**Passaggio di voce** – Speaker 1: «Ma perché qualcuno ha avuto bisogno di un database fatto così? Ce lo racconta [nome Speaker 2].»
*Ci si scambia il posto al portatile.* ▶ **Speaker 1: Avanti** → *slide 3.1.*

## 03:30 – 04:30 · Slide 3 «Natale 2004» · Speaker 2

**Speaker 2** (3.1, il traffico):
«Pensate a quello che avete appena fatto — tante persone che scrivono nello stesso momento — e moltiplicatelo per milioni, durante le feste di Natale, su Amazon.»

▶ **Speaker 1: Avanti** → *3.2, la soglia e il 503.*

«Il grafico è illustrativo, non una misura storica. Ma il problema era reale: servizi che crescono, e un database che diventa il collo di bottiglia. Quando cade il database, cade il negozio.»

▶ **Speaker 1: Avanti** → *3.3, la linea del tempo.*

«Nel 2007 Amazon pubblica il paper su Dynamo, un sistema interno. Nel 2012 nasce DynamoDB, il servizio gestito che chiunque può usare. Parenti stretti, ma non la stessa cosa: una è un'idea, l'altro è un prodotto.»

**Transizione** – Speaker 2: «La domanda più importante è sempre la stessa: come ritrovo proprio quell'item?»
▶ **Speaker 1: Avanti** → *4.1.*

## 04:30 – 06:00 · Slide 4 «La chiave decide dove vivi» · Speaker 2

**Speaker 2** (4.1, hash nei cassetti):
«La partition key passa in una funzione di hash, e il risultato decide in quale partizione finisce l'item. Pensate ai cassetti di un archivio: sono una metafora, AWS non ci mostra le partizioni vere. Ma il principio è questo, ed è per questo che la partition key si sceglie con cura e non si cambia più.»

▶ **Speaker 1: Avanti** → *4.2.*

«Dentro al cassetto, la sort key tiene tutto in ordine. È per questo che le coordinate le scriviamo con gli zeri davanti: sono stringhe, e l'ordine delle stringhe deve essere quello che vogliamo.»

▶ **Speaker 1: Avanti** → *4.3. Attenzione: questo Avanti cambia la fase (squadre rivelate). I telefoni si colorano.*

«E adesso guardate il vostro telefono.» *(pausa, reazioni)* «Arancione o viola: le squadre le ha già decise un hash del vostro identificativo. È un calcolo nostro, non l'hash interno di DynamoDB, ma l'idea è la stessa: un numero decide dove stai, e nessuno può sceglierlo.»

**Passaggio di voce** – Speaker 2: «Ma quale chiave è quella giusta? Dipende da cosa vogliamo chiedere. [Nome Speaker 1]?»
*Scambio al portatile.* ▶ **Speaker 2: Avanti** → *5.1.*

## 06:00 – 07:00 · Slide 5 «Prima le domande» · Speaker 1

**Speaker 1** (5.1, due mondi):
«Nel mondo relazionale progetti i dati e poi fai le domande. In DynamoDB fai il contrario: prima scrivi le domande, poi progetti i dati per rispondere a quelle.»

▶ **Speaker 2: Avanti** → *5.2.*

«Noi avevamo due domande. "Cosa è cambiato sulla tela?" e "Chi è in testa?". Per ognuna c'è un indice secondario globale: ByTime, ordinato per tempo, e ByScore, ordinato per punteggio. La classifica che vedrete tra poco è già ordinata, nessuno la calcola.»

▶ **Speaker 2: Avanti** → *5.3.*

«Una Query va dritta nel cassetto giusto. Uno Scan rovescia tutto l'archivio sul tavolo e poi cerca. Il filtro non lo rende economico: paghi quello che leggi, non quello che tieni. E niente JOIN: se una domanda non l'avevi prevista, spesso devi cambiare il modello.»

**Transizione** – Speaker 1: «Tutto questo passa da pochi blocchi. [Nome Speaker 2]?»
*Scambio.* ▶ **Speaker 1: Avanti** → *slide 6. Cambia fase: «HOT KEY pronto».*

## 07:00 – 07:30 · Slide 6 «Zero server (nostri)» · Speaker 2

**Speaker 2:**
«Telefono, API Gateway, una Lambda, DynamoDB. I pallini che vedete scorrere sono le vostre richieste vere. Zero server nostri da gestire, non zero responsabilità: chiavi, permessi e correttezza sono ancora compito nostro.
Finora avete collaborato. Adesso si gioca uno contro l'altro, tutti sugli stessi contatori.»

▶ **Speaker 1: Avanti** → *slide 7. La regia ora dice «Avvia HOT KEY».*
*Scambio: per HOT KEY la regia la tiene Speaker 2, Speaker 1 va davanti.*

## 07:30 – 10:00 · Slide 7 «HOT KEY» · Speaker 1 + Speaker 2

**Speaker 1** (regole, 10 secondi):
«Arancione contro viola. Quindici secondi. Toccate il pulsante più veloce che potete: conta il vostro punteggio e quello della squadra. Pronti?»

▶ **Speaker 2: «Avvia 3·2·1»** (o Invio). *Il round parte solo così: non si ripete.*

*Durante il round (15 s)* Speaker 1 fa il tifo, senza parlare sopra ogni numero: «Viola sta recuperando!»

*Finito il round, podio sulla LIM. Lasciarlo 15–20 secondi.*

**Speaker 2** (dalla regia, preme **I** per l'X-Ray):
«Vediamo cosa è successo davvero. Il vostro telefono non manda un messaggio per ogni tocco: raccoglie i tap e li manda a piccoli gruppi, numerati. Se una risposta si perde, rimanda lo stesso numero: il database lo riconosce e non conta i punti due volte.
Punteggio personale e totale di squadra si aggiornano insieme, in una transazione. La classifica arriva dall'indice ByScore: durante il round può restare un attimo indietro, perché gli indici sono aggiornati in modo asincrono.»

**Speaker 1:**
«E perché si chiama HOT KEY? Perché tutti voi avete scritto sullo stesso item, quello dei contatori di squadra. Per noi, cinquanta persone, va benissimo. Con un milione di persone diventerebbe un collo di bottiglia: lo divideremmo in più pezzi, o sommeremmo i punti in modo asincrono.»

▶ **Speaker 2: I** (chiude X-Ray).

**Transizione** – Speaker 1: «Bello. Ma quanto ci è costato?» **Speaker 2** risponde: «Ve lo dico io.»
▶ **Speaker 1** (ora in regia): **Avanti** → *8.1.*

## 10:00 – 11:30 · Slide 8 «Cosa è appena successo» · Speaker 2

**Speaker 2** (8.1, lo scontrino):
«Questo è lo scontrino di tutto quello che avete fatto finora.» *(leggere il valore vero sulla LIM)* «È una stima a listino, calcolata dalla capacità che DynamoDB ci restituisce a ogni chiamata; esclude hosting, log e crediti gratuiti.
Guardate la riga degli indici: ogni scrittura che tocca un attributo indicizzato scrive anche nell'indice. Gli indici non sono gratis.»

▶ **Speaker 1: Avanti** → *8.2, ×1.000.*

«Se foste mille volte di più…»

▶ **Speaker 1: Avanti** → *8.3, ×1.000.000.*

«…o un milione di volte. È solo una moltiplicazione, non un test di carico. Ma la API che avete usato è la stessa che Amazon usa durante il Prime Day, con centinaia di milioni di richieste al secondo al picco.»

**Passaggio di voce** – Speaker 2: «Quindi dovremmo usarlo sempre? [Nome Speaker 1]…»
*Scambio.* ▶ **Speaker 2: Avanti** → *9.1.*

## 11:30 – 13:00 · Slide 9 «Non è più semplice. È complesso in un momento diverso» · Speaker 1

**Speaker 1** (9.1, quando sì):
«DynamoDB è una scelta ottima quando conosci le domande in anticipo e il traffico va su e giù: sessioni, carrelli, classifiche, dispositivi IoT. Paghi quello che usi, e nessuno deve svegliarsi di notte per il database.»

▶ **Speaker 2: Avanti** → *9.2.*

«Ma se le domande cambiano ogni settimana, se servono analisi, report, relazioni che non avevi previsto, un database relazionale ti perdona. DynamoDB no.
E poi: indici da mantenere, dati duplicati da tenere coerenti, chiavi da distribuire bene, ed è un servizio solo AWS. La complessità non sparisce: si sposta tutta all'inizio, nella progettazione.»

**Passaggio di voce** – Speaker 1: «Ultima cosa: cosa succede ai vostri dati adesso?»
*Scambio.* ▶ **Speaker 1: Avanti** → *slide 10. Cambia fase: «Chiusura». Se la regia dice «Attendere», aspettare 2 secondi e ripremere.*

## 13:00 – 14:15 · Slide 10 «Il ricordo resta. I dati scadono» · Speaker 2, chiusura Speaker 1

**Speaker 2:**
«Questa tela è anche vostra. Il conto alla rovescia indica quando i dati scadono: ventiquattro ore dalla creazione della sessione. Non scriveremo una riga di codice per cancellarli: ci pensa il TTL di DynamoDB.
Onestà tecnica: la cancellazione vera è asincrona, di solito entro qualche giorno. Per questo l'app ignora già gli item scaduti.»

*Indicare il QR del documento, lasciare 15–20 secondi.*

«Con questo QR trovate il documento di approfondimento: scelte, compromessi e fonti.»

**Speaker 1** (chiusura):
«La cosa da portarsi a casa è una sola: decidete prima quali domande farete ai vostri dati, poi progettate il modo per rispondere.
Grazie. Eravate già nel database.»

---

## Speaker notes (versione breve)

**Speaker 1**
- **1** QR → nomi → «siete una riga in un database».
- **2.1** 90 s, pulsante tenuto premuto, PX#012#005, vince il primo → «rinforzi» (S2: Completa il logo).
- **2.2–2.4** item = pixel · PK raggruppa, SK ordina · «questo sei tu» · stessa tabella, attributi diversi → passa a S2.
- **5** prima le domande · ByTime, ByScore · Query = cassetto giusto, Scan = rovesciare l'archivio · niente JOIN → passa a S2.
- **7** regole in 10 s → tifo → «perché HOT KEY: stesso item per tutti; a grande scala lo dividerei».
- **9** sì: domande note, traffico variabile · no: domande che cambiano, analisi · complessità spostata all'inizio → passa a S2.
- **Chiusura** «prima le domande, poi i dati. Eravate già nel database.»

**Speaker 2**
- **3** Natale × milioni · grafico illustrativo · Dynamo 2007 (paper) ≠ DynamoDB 2012 (servizio).
- **4** hash → partizione (metafora) · SK ordina, zeri davanti · squadre = hash del vostro id (nostro, non di AWS) → passa a S1.
- **6** telefono → API Gateway → Lambda → DynamoDB · zero server nostri ≠ zero responsabilità.
- **7** (regia) Avvia 3·2·1 · I = X-Ray · batch numerati, nessun punto doppio · transazione · GSI asincrono.
- **8** scontrino = stima a listino · gli indici costano · ×1000 è una moltiplicazione, non un test → passa a S1.
- **10** TTL 24 h · cancellazione asincrona (giorni) · QR documento → passa a S1.

## Domande probabili del docente

| Domanda | Risposta breve |
| --- | --- |
| Perché DynamoDB e non un database relazionale? | Per questa demo le domande sono poche e note (stato, tela, classifica), il traffico è a picchi e ci serviva zero gestione: sono i casi in cui DynamoDB rende di più. Per report o query impreviste avremmo scelto un relazionale. |
| Come avete scelto partition key e sort key? | Dagli access pattern: tutto quello che leggiamo insieme ha la stessa PK (`SESSION#sid`, `CANVAS#sid`), la SK distingue e ordina (`PLAYER#pid`, `PX#xxx#yyy`). Una Query per PK risponde a ogni domanda principale. |
| Cos'è una hot partition / hot key? Come la risolvereste? | Una chiave che riceve molto più traffico delle altre e satura la sua partizione (limiti per partizione: circa 3.000 RCU e 1.000 WCU al secondo). `STATS` lo è apposta. Soluzioni: *write sharding* (N contatori `STATS#0..N` sommati in lettura) o aggregazione asincrona con DynamoDB Streams. |
| Differenza tra GSI e LSI? | Il GSI ha una partition key diversa, si crea anche dopo, ha capacità propria ed è solo eventualmente consistente. L'LSI condivide la PK della tabella, va creato con la tabella e permette letture consistenti. Noi usiamo due GSI. |
| Letture consistenti o eventuali? | Lettura forte su `META` e sulla classifica finale, dove serve lo stato esatto; il GSI durante il round è eventuale e lo accettiamo (lo diciamo in scena). La lettura forte costa il doppio. |
| Come evitate che due persone accendano lo stesso pixel? | Scrittura condizionale `attribute_not_exists(PK)` dentro una `TransactWriteItems`: la prima vince, la seconda riceve `409 PIXEL_TAKEN`. Nessun lock, nessuna lettura preventiva. |
| E se una richiesta viene ripetuta? | I tap hanno un numero di sequenza: stesso `seq` e stesso `delta` → riconosciuto come duplicato. È idempotenza lato applicazione. |
| Quanto costano le transazioni? | Il doppio di una scrittura normale (2 WCU per KB per item) e possono fallire per conflitti: le usiamo solo dove servono (pixel, tap, join). |
| On-demand o provisioned? | On-demand per il talk: nessuna capacità da stimare, paghi per richiesta. Provisioned 5/5 nello stack di prova, dentro il free tier. |
| Come funziona il TTL? | Attributo `expiresAt` in secondi epoch; DynamoDB cancella gli item scaduti in background, di solito entro pochi giorni, senza consumare capacità. L'app filtra gli scaduti nel frattempo. |
| Come proteggete l'API? | Chiave admin in SSM Parameter Store (SecureString) letta dalla Lambda, mai nel frontend; CORS limitato al dominio CloudFront; throttling su API Gateway; ruolo Lambda con i soli permessi sulla tabella; input validati. |
| Perché polling e non WebSocket? | Semplicità e robustezza su reti sconosciute: richieste HTTP normali, niente connessioni da mantenere, costi facili da stimare. Con migliaia di utenti passeremmo a WebSocket (API Gateway) o AppSync. |
| Quanto scala? | DynamoDB scala orizzontalmente se le chiavi sono distribuite; nel nostro caso i limiti sono il throttling che abbiamo impostato (300 rps), la concorrenza Lambda dell'account e la hot key `STATS`. |
| Cold start della Lambda? | Il primo invocazione di un container impiega qualche centinaio di ms in più (e legge la chiave da SSM). Prima del talk facciamo qualche chiamata per scaldarla. |
| Come calcolate il costo in tempo reale? | Ogni chiamata chiede `ReturnConsumedCapacity`; sommiamo le unità di tabella e indici e moltiplichiamo per il listino di Francoforte. È una stima, non la fattura. |
| Single-table design: pro e contro? | Pro: una Query restituisce entità correlate, una sola tabella da gestire. Contro: modello meno leggibile, difficile da cambiare, richiede di conoscere gli access pattern. |
| E se AWS non funziona durante il talk? | Piano B: backend locale su DynamoDB Local (stesso codice), poi LIM in modalità statica, poi video. Vedi [troubleshooting](troubleshooting.md). |
| Backup e disaster recovery? | Non attivati per dati che vivono 24 ore. In produzione si abilita il Point-in-Time Recovery (ripristino fino a 35 giorni). |

## Punti tecnici da non sbagliare

1. **Dynamo (paper 2007) ≠ DynamoDB (servizio 2012).**
2. I cassetti delle partizioni sono una **metafora**: DynamoDB non espone le partizioni.
3. L'hash delle squadre è **nostro**, non quello interno di DynamoDB.
4. I GSI sono **eventualmente consistenti**; la classifica finale la leggiamo dalla tabella.
5. Il costo è una **stima a listino**, non una fattura; ×1000 e ×1.000.000 sono **moltiplicazioni**, non test di carico.
6. Il TTL cancella **in modo asincrono** (giorni), non allo scadere del secondo.
7. «Serverless» = nessun server **nostro** da gestire, non zero infrastruttura.
8. Scrittura condizionale ≠ lock: nessuno aspetta, la seconda scrittura viene rifiutata.
9. Se citate il picco del Prime Day, dite «secondo AWS» e verificate il numero dell'ultimo anno sul blog AWS prima del talk.

## Se siamo in ritardo

- Slide 5 e 9 si comprimono a 30 secondi ciascuna (solo la prima frase e l'ultima).
- In HOT KEY si salta la spiegazione con X-Ray: basta la frase sulla hot key.
- **Non** saltare scene con i tasti numerici per recuperare: le fasi del database avanzano solo con Avanti (la regia avvisa se Avanti verrebbe rifiutato).

## Materiale spostato nella documentazione

Troppo lungo per 15 minuti, disponibile per chi chiede: dettagli delle transazioni e del cooldown ([architecture.md](architecture.md)), formula del tassametro e prezzi ([riferimento/giochi-spec.md](riferimento/giochi-spec.md)), limiti e servizi AWS ([aws-setup.md](aws-setup.md)), approfondimento completo ([contenuti/APPROFONDIMENTO.md](contenuti/APPROFONDIMENTO.md)).
