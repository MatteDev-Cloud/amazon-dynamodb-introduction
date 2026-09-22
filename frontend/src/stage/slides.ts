import type { Phase } from '../../../shared/types.js';

/**
 * The talk as a sequence of scenes; each scene has steps (arrow/clicker advances the step first).
 * stepPhases[i] is the META phase required when reaching step i going forward.
 */
export interface Scene { id: string; kicker: string; title: string; time: string; stepPhases: Phase[]; steps: string[]; notes: string[] }

export const scenes: Scene[] = [
  { id: 'lobby', kicker: 'Benvenuti', title: 'Tirate fuori il telefono.', time: '00:00', stepPhases: ['lobby'], steps: ['QR e nomi'],
    notes: ['«Entrate e sceglietevi un nome. Vi spieghiamo dopo cosa avete fatto.»', 'Aprite la lobby prima del talk, mentre la gente si siede.'] },
  { id: 'pixel', kicker: 'Gioco 1 · Pixel Wall', title: 'Accendete il logo.', time: '01:00', stepPhases: ['pixel', 'pixel_frozen', 'pixel_frozen', 'pixel_frozen'],
    steps: ['Tela live', 'Zoom su un pixel', 'Chi l’ha acceso', 'Una tabella'],
    notes: ['«Ogni pixel che accendete è una scrittura nel database. Guardate il contatore.»', 'Verso la fine: regia → «Completa il logo». Lo sciame scrive in parallelo; i conflitti sono scritture condizionali rifiutate, nessun lock.', 'Tocca un pixel sulla LIM per entrare nel suo item. Poi tocca l’autore: «Questo sei tu».', 'Due entità diverse nella stessa tabella: schema flessibile. Key-value più documento.'] },
  { id: 'history', kicker: 'Perché esiste', title: 'Natale 2004.', time: '03:30', stepPhases: ['pixel_frozen', 'pixel_frozen', 'pixel_frozen'],
    steps: ['Il traffico', 'Il crollo', 'La storia'],
    notes: ['«Quello che avete appena fatto — tante persone che scrivono insieme — è il problema che Amazon aveva nel 2004, moltiplicato per milioni.»', 'Microservizi, ogni servizio con il suo data store.', 'Dynamo (paper interno, 2007) ≠ DynamoDB (servizio gestito, 2012). Curva illustrativa, non misura storica.'] },
  { id: 'keys', kicker: 'Modello dati', title: 'La chiave decide dove vivi.', time: '04:30', stepPhases: ['pixel_frozen', 'pixel_frozen', 'talk'],
    steps: ['Hash della partition key', 'La sort key ordina', 'Le vostre squadre'],
    notes: ['Partition key → hash → partizione. «La partition key non si cambia più.»', 'Sort key → ordine dentro la partizione: PX#x#y.', 'Rivelazione: «le vostre squadre le ha già decise un hash». I telefoni si colorano adesso.', 'Dire esplicitamente: i cassetti sono didattici, DynamoDB non espone le partizioni.'] },
  { id: 'patterns', kicker: 'Progettazione', title: 'Prima le domande.', time: '06:00', stepPhases: ['talk', 'talk', 'talk'],
    steps: ['Due mondi', 'Access pattern → indici', 'Query contro Scan'],
    notes: ['«Nel relazionale progetti i dati e poi fai le domande. In DynamoDB progetti le domande e poi i dati.»', '«Cosa è cambiato?» → GSI ByTime. «Chi è in testa?» → GSI ByScore.', 'Query = il cassetto giusto. Scan = rovesciare l’archivio. Niente JOIN.'] },
  { id: 'architecture', kicker: 'Serverless', title: 'Zero server (nostri).', time: '07:00', stepPhases: ['hotkey_ready'], steps: ['Il percorso di un tap'],
    notes: ['Serverless, pay per request: i pallini sono le vostre richieste reali.', 'Ponte: «La tela era collaborazione: tante chiavi diverse. Ora l’opposto: tutti contro tutti, sugli stessi contatori.»'] },
  { id: 'hotkey', kicker: 'Gioco 2', title: 'HOT KEY', time: '07:30', stepPhases: ['hotkey_ready'], steps: ['Round'],
    notes: ['Regole 10" → Invio o regia «Avvia 3·2·1» → round 15".', 'ADD atomico: «nessun lock, nessun punto perso». Classifica = GSI già ordinato.', '«Perché Hot Key»: i totali di squadra vivono in un solo item. Premi I per l’X-Ray.'] },
  { id: 'cost', kicker: 'Il conto', title: 'Cosa è appena successo.', time: '10:00', stepPhases: ['hotkey_end', 'hotkey_end', 'hotkey_end'],
    steps: ['Lo scontrino', '× 1.000', '× 1.000.000'],
    notes: ['«Tutto questo è costato meno di un centesimo.»', '«Ogni GSI raddoppia le scritture»: indica la riga GSI.', 'Proiezione a listino, non un test di carico. Stessa API di Prime Day.'] },
  { id: 'choice', kicker: 'Giudizio', title: 'Non è più semplice. È complesso in un momento diverso.', time: '11:30', stepPhases: ['hotkey_end', 'hotkey_end'],
    steps: ['Quando sì', 'Quando no'],
    notes: ['Vendor lock-in, costi di Scan e GSI, single-table design difficile.', '«Un relazionale ti perdona una query non prevista, DynamoDB no.»'] },
  { id: 'end', kicker: 'Congedo', title: 'Il ricordo resta. I dati scadono.', time: '13:00', stepPhases: ['end'], steps: ['TTL'],
    notes: ['TTL: «nessuno di noi scriverà una riga di codice per cancellarla».', 'Onestà: cancellazione asincrona, tipicamente entro qualche giorno; l’app filtra già gli scaduti.', 'Saluti e QR al documento.'] },
];
