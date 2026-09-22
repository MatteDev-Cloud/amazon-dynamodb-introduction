# DynamoLive - copione a due voci

Obiettivo: chiudere a 14:15, lasciando 45 secondi di margine. Le voci P1 e P2 sono una proposta da assegnare alle persone. I tempi includono azioni sullo schermo, gioco e pause: non sono quattordici minuti di monologo. Provare il testo ad alta voce; la durata non è stata misurata con i presentatori.

## 00:00-01:00 · Slide 1 · P1

**Apertura:** «Tirate fuori il telefono. Entrate dal QR e scegliete un nome. Vi spieghiamo tra poco cosa avete appena fatto.»

Lasciare circa venti secondi al pubblico. P2 controlla la comparsa dei nickname. Se il QR non si legge, indicare il link e l'alternativa operativa già preparata. Non leggere una URL lunga dal palco.

«Questi nomi non sono una grafica preparata prima. Sono i dati della vostra sessione. Oggi non vi mostriamo soltanto un database: ci entrate voi.»

**Ponte:** «Partiamo da una cosa che possiamo costruire insieme.» P2 avanza a Pixel Wall. Il timer inizia soltanto dopo il successo del comando di fase.

## 01:00-02:30 · Scena A · P1, regia P2

**Apertura:** «La tela è nera. Dentro c'è un'immagine nascosta: accendetela. Premete il pulsante, o tenetelo premuto: ogni mezzo secondo accendete un pixel. Avete novanta secondi.»

«Ogni pallino che si accende è una scrittura nel database. Il telefono vi dice la chiave che ha scritto, per esempio PX#012#005: colonna 12, riga 5. Se due persone puntano la stessa cella, vince la prima: l'altra riceve un rifiuto e il telefono ne prova subito un'altra.»

Lasciare giocare. Dopo circa trenta secondi: «Guardate il contatore dei conflitti e lo scontrino nell'angolo. Torneremo su quei numeri.» Non anticipare un costo specifico.

**Completamento (P2, verso i 60 secondi):** «Siamo pochi per finire in tempo. Chiamiamo rinforzi.» Regia → «Completa il logo». «Adesso scrivono in parallelo decine di giocatori simulati, dichiaratamente bot. Guardate gli anelli rossi: sono scritture sulla stessa cella nello stesso momento. Il database non blocca nessuno: accetta la prima, rifiuta le altre con una condizione.»

P2 osserva la tela sulla regia. Se necessario «Nascondi tela», «Congela ora», poi selezione sulla mini-tela e «Cancella rettangolo».

**Ponte, a logo completato:** «Questo logo è fatto di duecentocinquantadue item. Apriamone uno.»

## 02:30-03:30 · Questo sei tu · P1

**Apertura:** toccare un pixel sulla LIM (o Avanti: la LIM ne sceglie uno umano). La tela si ingrandisce sul pallino. «Un pixel è un item.»

«La partition key, CANVAS più la sessione, tiene insieme tutti i pixel di questa tela. La sort key è la posizione: PX, colonna, riga. Già in ordine.»

Toccare l'autore (o Avanti). «Questo sei tu.» «A sinistra la cella, a destra il giocatore che l'ha accesa: nome, pixel piazzati. La squadra c'è già, ma ve la sveliamo tra poco. Due entità diverse, stessa tabella, attributi diversi.»

Avanti: la tabella. «Pixel, giocatori, stato e contatori convivono. La partition key raggruppa, la sort key ordina.» «Gli attributi possono essere diversi, ma le regole esistono: sono nel contratto dell'applicazione.»

**Ponte:** «Perché qualcuno ha avuto bisogno di un database così?»

## 03:30-04:30 · Natale 2004 · P2

**Apertura:** «Immaginate la stessa esigenza durante il traffico delle feste: molti utenti, servizi diversi, dati che devono restare disponibili.»

«Natale 2004 è la cornice narrativa di questa slide. La curva è illustrativa, non un grafico storico misurato.» Avanti: la soglia e il 503. «Il problema tecnico è reale: come far crescere i servizi senza trasformare ogni operazione sui dati in un collo di bottiglia?»

Avanti: la linea del tempo. «Il paper Dynamo del 2007 racconta una risposta interna ad Amazon. DynamoDB, annunciato nel 2012, è il servizio gestito. Sono collegati nella storia, ma non sono lo stesso prodotto e non hanno automaticamente le stesse garanzie.»

**Ponte:** «La parte più importante è una: come troviamo proprio quell'item?»

## 04:30-06:00 · Slide 4 · P2

**Apertura:** «La chiave decide dove cercare.»

«La partition key identifica un gruppo logico e partecipa al collocamento gestito da DynamoDB. La sort key ordina gli item nel gruppo. Per questo scriviamo le coordinate con gli zeri: l'ordine delle stringhe deve rappresentare quello che vogliamo.»

«I cassetti sono una metafora. Qui non stiamo vedendo le partizioni fisiche di AWS. Tutti i nostri pixel condividono CANVAS e la sessione; i giocatori condividono SESSION. Cambiare soltanto sort key non prova che il traffico sia distribuito su macchine diverse.»

P1 indica la rivelazione delle squadre sui telefoni.

«Il server vi ha assegnati ad arancione o viola usando un hash del vostro identificativo. Questo è un calcolo della nostra applicazione: non è l'hash interno con cui DynamoDB distribuisce i dati.»

Lasciare una breve reazione alle squadre. **Ponte:** «La chiave giusta dipende però da quale domanda dobbiamo fare.»

## 06:00-07:00 · Slide 5 · P1

**Apertura:** «Prima le domande.»

«Per la tela chiediamo che cosa è cambiato. Per la classifica chiediamo chi è in testa. Sono due accessi diversi: abbiamo preparato ByTime e ByScore, due indici con ordinamenti diversi.»

«Una Query sa quale gruppo cercare. Uno Scan visita un insieme più ampio e poi eventualmente filtra. Il filtro non trasforma la scansione in una lettura economica.»

«Anche SQL richiede progettazione. Qui, però, una domanda nuova può richiedere di cambiare il modo in cui rappresentiamo i dati. Il costo della flessibilità si vede prima.»

**Ponte:** «Tutto questo, nella nostra applicazione, passa da quattro blocchi.»

## 07:00-07:30 · Slide 6 · P2

**Apertura:** «Zero server nostri da amministrare.»

Indicare telefono, HTTP API, Lambda, DynamoDB.

«Non significa zero infrastruttura o zero responsabilità. Significa che il database è gestito. Noi progettiamo API, autorizzazioni, chiavi e correttezza. Finora abbiamo collaborato sulla tela. Adesso tutti contribuiremo agli stessi totali di squadra.»

**Ponte:** avanzare alla scena HOT KEY. I telefoni sono ancora in preparazione; l'ingresso nella scena non deve consumare secondi del round.

## 07:30-10:00 · Scena B · P1 e P2

**Apertura P1, primi 10 secondi:** «Arancione contro viola. Quindici secondi. Conta il vostro punteggio personale e il totale della squadra. Toccate il più velocemente possibile.»

P2 preme «Avvia 3 · 2 · 1» nella regia (oppure Invio sulla LIM), lascia terminare il conto alla rovescia e verifica la comparsa del bottone. Durante il round P1 incoraggia senza parlare sopra ogni aggiornamento. Lasciare il podio visibile almeno venti secondi; attendere la fine della grace prima di chiamare definitivo il risultato.

**P2, commento con X-Ray:** «Gli incrementi individuali e il totale vengono salvati insieme. Il client manda piccoli batch. Se perde la risposta non inventa un altro evento: ritenta lo stesso numero di sequenza. Così una risposta persa non diventa un punto doppio.»

«La classifica durante il round usa un GSI. Se avete visto un piccolo ritardo, l'indice può non aver ancora ricevuto l'ultima modifica. Se non è successo, non fingiamo un glitch: è una proprietà possibile, non una scena da garantire.»

**P1:** «Si chiama HOT KEY perché tutti aggiornano anche STATS. Alla nostra scala è una scelta semplice. A una scala molto maggiore sarebbe un punto di contesa: potremmo dividere il contatore o costruire un'aggregazione. Non lo abbiamo fatto qui.»

Dedicare il tempo restante alla lettura di una richiesta nell'X-Ray. Spiegare che il residuo di latenza comprende rete e applicazione, non una misura isolata della rete. **Ponte:** «E quanto è costata questa scelta?»

## 10:00-11:30 · Slide 7 · P2

**Apertura:** «Questo è il nostro scontrino stimato.»

Leggere il valore realmente presente. «È una stima parziale a listino, prima di crediti e imposte. Hosting, storage e log sono esclusi. In locale è un equivalente teorico, non un addebito AWS.»

«Qui separiamo capacità della tabella e degli indici. Dire che un GSI raddoppia sempre il costo sarebbe troppo semplice: contano dimensioni e operazioni. I numeri qui derivano dalle capacità restituite alle chiamate, con i limiti della telemetria.»

Avanti due volte: ×1.000, poi ×1.000.000. «Questo moltiplica una stima. Non sta generando traffico: non è un test di carico. I puntini sono una rappresentazione simulata.»

«AWS riporta 151 milioni di richieste al secondo al picco di Prime Day 2025. È il dato di quell'evento, non la capacità dimostrata dalla nostra tabella.»

**Ponte:** «Quindi è sempre la scelta migliore? Dipende dalle domande.»

## 11:30-13:00 · Slide 8 · P1

**Apertura:** «Non è più semplice. È complesso in un momento diverso.»

«Con accessi conosciuti e traffico variabile, un servizio gestito può togliere molto lavoro operativo. Sessioni, carrelli e punteggi sono esempi facili da immaginare.»

«Ma se le domande cambiano continuamente, se servono analisi esplorative o molte relazioni impreviste, il modello può diventare scomodo. Un dato in formato JSON non è da solo una ragione per scegliere DynamoDB.»

«Ci sono indici da mantenere, duplicazioni da rendere coerenti, chiavi da distribuire e costi da conoscere. Il servizio è proprietario AWS. Non scegliamo una tecnologia soltanto perché elimina un server dalla lista delle cose da configurare.»

Lasciare qualche secondo per rileggere le due colonne. P2 può richiamare il contrasto fra tela e STATS. **Ponte:** «L'ultima scelta è quanto a lungo conservare ciò che abbiamo fatto.»

## 13:00-14:15 · Scena C · P2, chiusura P1

**Apertura:** «Questa tela è anche vostra.»

«Il countdown indica quando i dati scadono per la nostra applicazione. La scadenza è fissata ventiquattro ore dalla creazione della sessione. Non parte adesso.»

«DynamoDB usa TTL per eliminarli in modo asincrono, tipicamente entro alcuni giorni. Il contatore non promette una cancellazione fisica all'ultimo secondo: l'applicazione filtra già gli item scaduti.»

Indicare il QR del documento e lasciare almeno venti secondi per aprirlo. «Nella guida trovate le scelte della demo, i compromessi e le fonti. Il punto da ricordare è questo: decidete quali risposte vi servono, poi progettate come raggiungerle.»

**P1:** «Grazie. Eravate già nel database.» Fine a 14:15.

## Tagli e recupero

Se siamo in ritardo, comprimere slide 5 e 8 a trenta secondi ciascuna; non saltare fasi dei giochi con scorciatoie numeriche. Se la rete fallisce, annunciare il fallback impiegato. Statico e video devono restare distinguibili dalla sessione live. Nessuna frase «nessun punto perso» se un telefono è rimasto offline oltre la grace.
