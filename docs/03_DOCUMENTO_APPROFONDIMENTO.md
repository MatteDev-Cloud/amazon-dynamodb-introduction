# 03 — Documento di approfondimento (struttura)

> Documento di studio da lasciare al pubblico, collegato al QR finale.
> Base: il PDF di ricerca iniziale ("IntroduzioneDynamoDB"). La struttura è **approvata**.
> Obiettivo: permettere di studiare DynamoDB in modo più completo rispetto alle slide.

## Legenda

- **S** = compare nelle slide
- **O** = spiegato oralmente
- **D** = solo nel documento

---

## Capitoli

### 1. Perché esiste
| § | Argomento | Dove |
|---|---|---|
| 1.1 | Natale 2004, migrazione a microservizi, "ogni servizio il suo data store" | S O D |
| 1.2 | Paper *Dynamo* (SOSP 2007) contro il servizio DynamoDB (GA 18/01/2012) | O D |
| 1.3 | Cos'è: key-value + document, serverless, fully managed, proprietario, solo AWS (DynamoDB Local solo per sviluppo) | S O D |

### 2. Modello dati
| § | Argomento | Dove |
|---|---|---|
| 2.1 | Tabella → Item → Attributi; niente database/schema, tabelle per account+regione | S O D |
| 2.2 | Primary key simple contro composite (partition + sort) | O D |
| 2.3 | Tipi ammessi per le chiavi: S, N, B | D |
| 2.4 | Partizionamento: hash della partition key, consistent hashing | S O D |
| 2.5 | Sort key: ordinamento lessicografico UTF-8, ISO-8601 e zero-padding | O D |
| 2.6 | Limiti: item 400 KB, sort key 1024 byte, partizione 10 GB / 3000 RCU / 1000 WCU | D |

### 3. Progettare per access pattern
| § | Argomento | Dove |
|---|---|---|
| 3.1 | Relazionale contro DynamoDB: "prima i dati" / "prima le domande" | S O D |
| 3.2 | Single-table design (esempio e-commerce `USER#42` del PDF) | D |
| 3.3 | GSI e LSI: differenze, consistenza, vincoli | O D |
| 3.4 | Sparse index | D |
| 3.5 | Hot partition e hot key; write sharding; aggregazione via Streams | O D |
| 3.6 | **Case study: la tabella di DynamoLive** (Pixel Wall + HOT KEY: chiavi, GSI, access pattern, perché ogni scelta) | D |

### 4. API
| § | Argomento | Dove |
|---|---|---|
| 4.1 | Operazioni su item singolo: PutItem, GetItem, UpdateItem, DeleteItem | D |
| 4.2 | Query contro Scan (costo e perché lo Scan va evitato) | O D |
| 4.3 | Update expressions e contatori atomici (`ADD`) | O D |
| 4.4 | Condition expressions (esempio: il cooldown di Pixel Wall) | O D |
| 4.5 | Batch e transazioni ACID (limiti: 100 item / 4 MB) | O D |
| 4.6 | PartiQL: sintassi SQL-like, nessun JOIN o aggregazione, rischio Scan | D |
| 4.7 | DynamoDB Local (snippet Docker + boto3 del PDF) | D |

### 5. Scalabilità e affidabilità
| § | Argomento | Dove |
|---|---|---|
| 5.1 | On-demand contro provisioned; calcolo RCU/WCU | O D |
| 5.2 | Replica sincrona su 3 Availability Zone | D |
| 5.3 | Consistenza come parametro per operazione (eventual di default, strong su richiesta) | O D |
| 5.4 | Global Tables: MREC contro MRSC (giugno 2025), vincoli di MRSC | D |
| 5.5 | RPO / RTO | D |
| 5.6 | DAX | D |
| 5.7 | PITR (35 giorni) e backup on-demand | D |
| 5.8 | TTL (cancellazione asincrona) | O D |
| 5.9 | DynamoDB Streams e trigger Lambda | D |
| 5.10 | Numeri di scala: Prime Day 2025, 151M req/s | S O D |

### 6. Quando sì, quando no
| § | Argomento | Dove |
|---|---|---|
| 6.1 | Punti di forza | S O D |
| 6.2 | Limiti (lock-in, niente query ad hoc, hot partition, costi, limiti rigidi, curva di apprendimento) | S O D |
| 6.3 | Collocazione CAP e ACID contro BASE: la consistenza per operazione incrina la contrapposizione | D |
| 6.4 | Il costo nascosto: "non è più semplice, è complesso in un momento diverso" | S O D |

### 7. Casi d'uso reali
| § | Argomento | Dove |
|---|---|---|
| 7.1 | Aziende: Amazon, Disney+, Zoom, Duolingo, Netflix, Airbnb, Okta… | O (1–2 nomi) D |
| 7.2 | Tipologie di dati: sessioni, carrelli, IoT/time-series, gaming, event sourcing | D |

### Appendici
- **A. Glossario:** RCU, WCU, RRU, WRU, GSI, LSI, MREC, MRSC, RPO, RTO, DAX, TTL, PITR.
- **B. Sitografia:** fonti primarie AWS separate dalle fonti secondarie (riprendere quella del PDF).
- **C. Link al repository della demo** e istruzioni per farla girare in locale.

---

## Verifiche da fare prima di pubblicare

- [ ] **SLA 99,999%:** verificare se si applica alle Global Tables in generale o solo a MRSC (il PDF lo lega a MRSC).
- [ ] **TTL:** verificare la tempistica di cancellazione dichiarata oggi da AWS.
- [ ] **Prime Day 2025:** ricontrollare il dato dei 151M req/s sul post ufficiale.
- [ ] **Prezzi on-demand** della regione usata (servono anche al tassametro).
- [ ] Rimuovere il segnaposto "SCHEMA DA INSERIRE IN PRESENTAZIONE" rimasto nel PDF.
- [ ] Nel testo, distinguere sempre i fatti da fonti ufficiali da quelli di blog secondari.

## Formato

- Markdown come sorgente, esportato in PDF con lo stile chiaro della direzione visuale.
- Lunghezza indicativa: 8–12 pagine.
- Diagrammi: riusare gli SVG delle slide (cassetti, architettura).
