# 02 — Presentazione: scene, timeline, narrativa, identità visiva

## 1. Principi

- **Chiarezza > quantità.** Massimo 12 parole per slide, esclusi JSON e numeri.
- **I dati del pubblico sono gli esempi.** Mai "immaginate un item": è il *tuo* item.
- **Le slide comandano i telefoni.** Avanzare di slide cambia la fase (vedi `01_` §1.2).
- **Onestà tecnica:** i cassetti sono una rappresentazione didattica, il "×1000" è una proiezione, il TTL non cancella all'istante.

**Il modello mentale da portare a casa:**
> *"Nel relazionale progetti i dati e poi fai le domande. In DynamoDB progetti le domande e poi i dati."*

---

## 2. Timeline (15:00)

8 slide + 3 scene di gioco.

| # | Tempo | Scena | Fase META |
|---|---|---|---|
| 1 | 0:00–1:00 | Tirate fuori il telefono | `lobby` |
| 🎮 A | 1:00–2:30 | PIXEL WALL | `pixel` |
| 2 | 2:30–3:30 | Natale 2004 | `pixel_frozen` |
| 3 | 3:30–4:30 | Questo sei tu | `pixel_frozen` |
| 4 | 4:30–6:00 | La chiave decide dove vivi | `talk` (rivela le squadre) |
| 5 | 6:00–7:00 | Prima le domande | `talk` |
| 6 | 7:00–7:30 | Zero server (nostri) | `hotkey_ready` |
| 🎮 B | 7:30–10:00 | HOT KEY | `hotkey_running` → `hotkey_end` |
| 7 | 10:00–11:30 | Cosa è appena successo | `hotkey_end` |
| 8 | 11:30–13:00 | Non è più semplice | `hotkey_end` |
| 🎮 C | 13:00–14:15 | Il ricordo (TTL) | `end` |
| – | 14:15–15:00 | Buffer | – |

---

## 3. Scene nel dettaglio

### Slide 1 — "Tirate fuori il telefono." (1')
- **Visivo:** QR enorme al centro, URL corto sotto, nomi che compaiono in lobby come una nuvola, **tassametro che appare nell'angolo** a 0,0000 €.
- **Orale:** solo "Entrate e sceglietevi un nome. Vi spieghiamo dopo cosa avete fatto."
- **Note:** fate partire la lobby già prima del talk, mentre la gente si siede.

### 🎮 A — PIXEL WALL (1'30")
- **Visivo:** tela a tutto schermo, prompt in alto, timer da 90s, tassametro che sale.
- **Orale (poche frasi):** "Ogni pixel che piazzate è una scrittura nel database. Guardate l'angolo in basso."
- **Uscita:** allo scadere la tela si congela (`pixel_frozen`) e i telefoni mostrano "Guarda lo schermo".

### Slide 2 — "Natale 2004." (1')
- **Visivo:** curva di traffico con un crollo sul picco; in basso, piccolo, "Dynamo paper 2007 → DynamoDB 2012".
- **Orale:**
  - "Quello che avete appena fatto — decine di persone che scrivono insieme — è il problema che Amazon aveva nel 2004, moltiplicato per milioni."
  - La migrazione a microservizi, ogni servizio con il suo data store.
  - Dynamo (sistema interno) contro DynamoDB (servizio gestito).

### Slide 3 — "Questo sei tu." (1')
- **Visivo:** due JSON reali affiancati: l'item giocatore di uno spettatore e un pixel cliccato sulla tela congelata. Le chiavi `PK`/`SK` si illuminano una dopo l'altra.
- **Orale:**
  - Tabella → item → attributi.
  - Key-value più documento.
  - **Due entità diverse nella stessa tabella** con attributi diversi: schema flessibile.
  - Serverless, fully managed, solo su AWS.

### Slide 4 — "La chiave decide dove vivi." (1'30")
- **Visivo:**
  - Una fila di cassetti.
  - I pixel `PX#…` ordinati nel cassetto `CANVAS#…`.
  - I nickname del pubblico cadono nei cassetti in base all'hash.
  - Poi la **rivelazione**: "le vostre squadre le ha già decise un hash", e sui telefoni compare 🟠/🟣.
- **Orale:**
  - Partition key → hash → partizione; sort key → ordine.
  - La metafora del magazziniere invisibile (split e rebalancing).
  - "La partition key non si cambia più."
  - **Dire esplicitamente** che è una rappresentazione didattica: DynamoDB non espone le partizioni.

### Slide 5 — "Prima le domande." (1')
- **Visivo:**
  - Split screen. SQL: dati → normalizza → domande (JOIN). DynamoDB: domande → chiavi → dati.
  - Sotto, le domande dei due giochi che portano ai GSI: "cosa è cambiato?" → `ByTime`; "chi è in testa?" → `ByScore`.
- **Orale:**
  - Access pattern.
  - Query contro Scan: "il cassetto giusto contro rovesciare l'archivio".
  - Niente JOIN né aggregazioni.
  - Il GSI come "secondo archivio ordinato diversamente".

### Slide 6 — "Zero server (nostri)." (30")
- **Visivo:** 4 blocchi (Telefono → API → Funzione → Tabella); il tassametro si evidenzia.
- **Orale:**
  - Serverless, pay per request.
  - Ponte: *"La tela era collaborazione: tante persone, tante chiavi diverse. Ora facciamo l'opposto: tutti contro tutti, sugli stessi contatori."*

### 🎮 B — HOT KEY (2'30")
- **Sequenza:** regole (10") → 3-2-1 → round da 15" → podio (20") → commento con l'X-Ray aperto (≈1').
- **Orale durante o dopo:**
  - `ADD` atomico: "43 persone, nessun lock, nessun punto perso".
  - Classifica = GSI già ordinato.
  - Il glitch di consistenza, se capita.
  - **"Perché si chiama Hot Key":** i totali di squadra sono tutti in un solo item.

### Slide 7 — "Cosa è appena successo." (1'30")
- **Visivo:**
  - Il tassametro si espande a tutto schermo con i numeri reali.
  - Poi il selettore **×1.000 → ×1.000.000** con la proiezione e i puntini simulati.
  - Didascalia: "Proiezione a listino, non un test di carico".
  - Confronto con Prime Day 2025 (151M req/s).
- **Orale:**
  - Lo scontrino: "tutto questo è costato meno di un centesimo".
  - **"Ogni GSI raddoppia le scritture"**, indicando la riga GSI.
  - "Stessa API di Prime Day."

### Slide 8 — "Non è più semplice. È complesso in un momento diverso." (1'30")
- **Visivo:** due colonne.
  - **Sì:** traffico imprevedibile, access pattern noti, serverless/event-driven.
  - **No:** pattern ancora ignoti, query ad hoc, analytics.
- **Orale:**
  - Vendor lock-in.
  - Costi di Scan e GSI.
  - Il single-table design è difficile.
  - "Un relazionale ti perdona una query non prevista, DynamoDB no."

### 🎮 C — Il ricordo (1'15")
- **Visivo:** la tela finale di Pixel Wall, con il countdown "si cancella da sola tra 24:00:00"; QR al documento di approfondimento.
- **Orale:**
  - TTL: "nessuno di noi scriverà una riga di codice per cancellarla".
  - Onestà: la cancellazione è asincrona e avviene tipicamente entro qualche giorno. L'app però non mostra più gli item scaduti.
  - Saluti.

---

## 4. Filo narrativo

1. **Semina (0–2:30):** entrano e disegnano senza spiegazioni. Il tassametro crea curiosità.
2. **Perché (2:30–3:30):** il loro gesto collettivo diventa il problema di Amazon nel 2004.
3. **Riconoscimento (3:30–7:00):** la teoria si spiega con la *loro* tela, le *loro* squadre, i *loro* item.
4. **Prova (7:30–10:00):** HOT KEY, l'opposto di Pixel Wall.
5. **Conto (10:00–11:30):** lo scontrino e la proiezione.
6. **Giudizio (11:30–13:00):** quando sì, quando no.
7. **Congedo (13:00–14:15):** la tela che scade.

## 5. Memorable moments

| Momento | Dove | Reale/simulato |
|---|---|---|
| "Questo sei tu" (JSON di uno spettatore) | Slide 3 | Reale |
| Squadre decise da un hash | Slide 4 | Reale |
| Tassametro sempre visibile | Tutto il talk | Reale (stima a listino) |
| Scontrino + "Ora siamo mille" | Slide 7 | Proiezione simulata, dichiarata |
| Tela che si autodistrugge (TTL) | Chiusura | Reale |

---

## 6. Identità visiva

> **Aggiornamento (restyle):** la direzione in uso è quella **editoriale chiara** (ex fallback B, rivista): carta `#F3EEE4`, inchiostro `#1A2238`, accento vermiglio `#D9531E` per la PK, blu `#4148C8` per SK e indici, squadre `#E0662A` / `#6C4AD6`; titoli Fraunces, testo IBM Plex Sans, dati JetBrains Mono, tutti locali. Il Pixel Wall è una matrice LED nera con la palette del logo (`LOGO_PALETTE` in `shared/logo.ts`). Animazioni: scene che entrano dalla direzione di viaggio, passi che si costruiscono, zoom dal pixel al suo item. Dettagli in `08_GUIDA_PRESENTAZIONE.md`. La tabella seguente è la proposta originale «Dark tech», non più usata.

### Direzione originale "Dark tech" (A)

| Token | Valore | Uso |
|---|---|---|
| `--bg` | `#0B0D10` | Sfondo |
| `--surface` | `#15181D` | Pannelli, pixel vuoto |
| `--text` | `#E8EAED` | Testo |
| `--muted` | `#8A9099` | Testo secondario |
| `--accent` | `#C6FF3D` | Accento (lime) |
| `--team-orange` | `#FF8A3D` | Squadra 🟠 |
| `--team-purple` | `#A78BFA` | Squadra 🟣 |

**Palette di Pixel Wall (8 colori, indice 0–7):**
`#E8EAED` bianco · `#0B0D10` nero · `#C6FF3D` lime · `#FF8A3D` arancio · `#A78BFA` viola · `#3DD6FF` ciano · `#FF4D6D` rosso · `#FFD93D` giallo

**Tipografia:**
- Titoli: **Space Grotesk**.
- Dati, JSON, numeri: **JetBrains Mono**.
- Caricate i font **in locale** (niente Google Fonts live: se la rete va giù, non devono sparire).

**Stile:**
- Una frase o un numero enorme per slide.
- JSON usato come elemento grafico.
- Diagrammi in line-art sottile, **niente icone AWS ufficiali**.

**Animazioni:** solo "reveal" (un elemento si accende) e FLIP sulla classifica. Nessuna transizione decorativa.

**Fallback:** se al test sul proiettore il nero risulta slavato, passare alla direzione B "Magazzino" (sfondo carta `#F4EFE6`, inchiostro `#1B2340`, accento `#E8622C`, IBM Plex). Per questo motivo **tutto deve passare da variabili CSS fin dal giorno 1.**

**Documento di approfondimento:** stessi font e accenti, su sfondo chiaro (stampabile).

---

## 7. Script parlato

Da scrivere in Fase 5 (vedi `04_`). Per ogni scena:
- frase d'apertura;
- 2–3 concetti;
- frase-ponte verso la scena successiva;
- chi parla.

Lunghezza target: circa 130 parole al minuto di parlato.
