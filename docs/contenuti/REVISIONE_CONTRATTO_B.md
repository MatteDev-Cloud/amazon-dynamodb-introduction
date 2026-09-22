# Revisione agente B - contratto v1

Letti docs/00-07, shared/types.ts e i percorsi principali del backend. Il frontend usa i nomi canonici, senza modificare shared o definire endpoint alternativi. Revisione svolta sul codice e con fixture/mock; l'integrazione su DynamoDB Local non è stata eseguita su questa macchina.

## Punti recepiti

- serverTime in millisecondi, expiresAt in secondi; timeout e grace sincronizzati.
- Header admin soltanto nello stage; pid proprietario nel telefono. Credenziali separate per origine API e sid.
- Fasi monotone, expectedVersion; salti numerici soltanto visuali. HOT KEY parte dopo il countdown locale, con successo del comando server.
- Snapshot ogni quindici secondi e alla riconnessione, cursore del server, dedup per t, tombstone, canvasRevision e hide.
- Batch persistito, sequenza senza buchi, un solo invio in volo e retry invariato; classifica provvisoria fino a termine grace.
- Prezzi e totalizzazione forniti da shared/backend. Non sono state inserite tariffe alternative nel frontend.
- STATS transazionale per i punteggi; buffer solo economico. Corrette nel copione le frasi della bozza su hot partition, «GSI sempre doppio», TTL e replay.
- Bot tramite runner esterno, mai processo avviato dalla Lambda. In mock il flag bot non genera utenti simulati automaticamente.

## Nessuna modifica bloccante richiesta

Il contratto espone i dati necessari ai flussi. Tre precisazioni utili per un'evoluzione, senza cambiare questa consegna:

1. La classifica pubblica non ha identificatore stabile e i nickname non sono univoci. È corretto non esporre pid bearer. Per FLIP perfettamente identificabile fra omonimi servirebbe un id pubblico non utilizzabile come credenziale; oggi si usa nome, squadra e occorrenza, con ambiguità visuale dichiarata.
2. L'X-Ray non restituisce le prime tre immagini grezze degli item per ogni singola chiamata SDK. Mostriamo il payload API e gli item grezzi ottenuti dagli endpoint specifici, non inventiamo risposte SDK mancanti.
3. Aggiornare in futuro il README radice con i comandi `npm --prefix frontend ci` e `npm --prefix frontend run dev`, e il link alla guida 08. Lasciato al proprietario dei file comuni.

## Richiesta di revisione al proprietario backend

Per l'agente A: verificare `APPROFONDIMENTO.md` e `SCRIPT_PARLATO.md`, in particolare chiave lb=sid#roundId, transazioni pixel/tap, consistenza del podio, grace, telemetria economica e TTL. Riportare eventuali correzioni; non considerare già completata la cross-review. Questa è una consegna nel repository, non un messaggio esterno già inviato.

## Elementi del team

Confermare prompt «Scrivete DDB», persone P1/P2 e tempi; fornire URL pubblico del repository; eseguire le prove fisiche e registrare il video dopo integrazione. Nessun segnaposto viene presentato come risultato misurato.
