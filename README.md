# amazon-dynamodb-introduction

Valutazione finale Corso ITS di NoSQL Database - Progetto informativo su Amazon DynamoDB.

Esplorazione pratica di Amazon DynamoDB (in locale, via Docker) applicata a un
dominio "scuola" semplificato (studenti, iscrizioni ai corsi, voti), con
l'obiettivo di toccare con mano potenzialità e limiti del modello NoSQL a
chiave/valore rispetto a un classico database relazionale.

## Setup ambiente

Avviare DynamoDB Local in un container Docker:

```bash
docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb -dbPath .
```

Note sui flag:

- `-p 8000:8000` espone la porta su cui DynamoDB Local ascolta di default.
- `-sharedDb` è il flag importante: senza di esso, DynamoDB Local isola i
  dati per ogni combinazione di *access key + region* usata per connettersi,
  creando file di storage separati. Questo causa un problema molto comune:
  lo script Python e NoSQL Workbench, se configurati con credenziali/region
  diverse, finiscono per "vedere" due database locali distinti anche se il
  container è lo stesso. Con `-sharedDb`, tutte le connessioni condividono
  lo stesso storage, indipendentemente dalle credenziali usate.
- `-dbPath .` salva i dati nella working directory del container (senza un
  volume montato, i dati si perdono se il container viene rimosso).

Per resettare da zero (es. se il container era stato avviato senza
`-sharedDb`):

```bash
docker stop dynamodb-local && docker rm dynamodb-local
```

## Esecuzione

```bash
pip install boto3
python DDL.py
```

Lo script si connette a `http://localhost:8000` con credenziali fittizie
(DynamoDB Local non fa autenticazione reale, ma boto3 le richiede comunque).

## Concetti chiave esplorati

- **Partition Key / Sort Key**: la chiave primaria in DynamoDB è
  PK (opzionale + SK), mai più di due attributi. La PK determina la
  distribuzione fisica dei dati; la SK ordina gli item all'interno della
  stessa partizione e abilita range query.
- **Design "query-first"**: a differenza di SQL, in DynamoDB si parte dagli
  access pattern (le query che si faranno) e si disegnano tabelle/chiavi/GSI
  attorno a quelli — non il contrario.
- **`put_item` è un upsert**: scrivere su una chiave già esistente sovrascrive
  l'intero item, senza avviso. Per evitarlo, vedi sotto (`ConditionExpression`).
- **`get_item` vs `query` vs `scan`**: `get_item` recupera un singolo item per
  chiave completa; `query` recupera uno o più item che condividono la stessa
  PK (con condizioni opzionali sulla SK); `scan` legge l'intera tabella ed è
  da evitare se non per debug/dataset piccoli.
- **`KeyConditionExpression` vs `FilterExpression`**: la prima lavora solo su
  PK/SK e determina cosa viene effettivamente letto; la seconda filtra un
  attributo qualsiasi ma solo *dopo* la lettura — non riduce il costo della
  query, solo il risultato restituito.
- **Global Secondary Index (GSI/GASI)**: indice con PK (ed eventuale SK)
  diverse da quelle della tabella base, mantenuto sincronizzato
  automaticamente da DynamoDB, usato per supportare access pattern non
  coperti dalla chiave primaria originale (es. cercare le iscrizioni per
  voto invece che per corso).

### Evitare la sovrascrittura silenziosa su `put_item`

```python
studenti_table.put_item(
    Item={...},
    ConditionExpression="attribute_not_exists(id)"
)
```

Per design, `put_item` sovrascrive senza avvisare se la chiave esiste già
(non c'è un concetto di "vincolo di unicità" separato dalla chiave primaria
stessa). La `ConditionExpression` permette di condizionare la scrittura:
qui, l'insert va a buon fine solo se **non** esiste già un item con quell'`id`;
se esiste, l'operazione fallisce sollevando `ConditionalCheckFailedException`,
senza toccare l'item esistente. La condizione è valutata atomicamente lato
server (niente check-then-write lato client, quindi niente race condition).
Lo stesso meccanismo si applica anche a `update_item` e `delete_item`.

## Conclusione didattica

Il dominio "scuola" è deliberatamente scomodo per NoSQL: gli access pattern
reali di un gestionale scolastico (report, filtri incrociati su attributi
arbitrari, aggregazioni) sono tipicamente decisi a runtime e non noti in
anticipo — l'opposto di ciò per cui DynamoDB è ottimizzato (poche query note
in anticipo, ad altissimo volume). In un contesto reale la scelta corretta
per questo dominio sarebbe un database relazionale; usarlo qui come banco di
prova ha permesso di toccare con mano *perché*.
