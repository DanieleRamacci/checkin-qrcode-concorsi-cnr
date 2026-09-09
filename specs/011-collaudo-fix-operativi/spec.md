# Feature Specification: Correzioni operative post collaudo utenti

**Feature Branch**: `011-collaudo-fix-operativi`

**Created**: 2026-09-09

**Status**: Implemented - pending manual validation on server

**Input**: User description: "Dopo le verifiche con quasi tutti i profili, salvo tecnici provati dall'admin al loro posto, registrare e correggere problemi operativi: spinner mancanti su generazione liste e dashboard referenti, gestione reload/chiusura/back durante caricamenti, stato informatico non assegnato dopo configurazione multi-sessione, componente torna indietro comune, avviso rosso prima di avviare check-in, note candidato con modal e inclusione nel PDF, widget notifiche/stati leggibile su mobile, aggiornamento affidabile in tempo reale di timeline stati e azioni tra dashboard."

## Analisi osservata

Le prove applicative hanno confermato che i flussi principali sono collaudabili,
ma hanno evidenziato problemi di esperienza utente, consistenza del workflow e
aggiornamento cross-dashboard che impediscono di dichiarare l'applicativo pronto
per produzione generale.

I problemi osservati sono:

- Durante `Genera liste` nella scheda segretario la schermata resta bloccata,
  ma manca un indicatore visivo chiaro che l'operazione e' ancora in corso.
- Durante l'apertura della dashboard referenti il sistema segnala che sta
  aggiornando, ma manca uno spinner con messaggio di sincronizzazione evidente.
- Non e' ancora definito e verificato cosa succede se l'utente ricarica la
  pagina, chiude la scheda, torna indietro o ripreme l'azione mentre una
  generazione/scaricamento liste e' in corso.
- Nella schermata referenti, anche dopo salvataggio degli informatici in sede,
  il sistema continua a indicare che l'informatico non e' assegnato; va
  verificata la gestione di bandi con piu sessioni e piu informatici.
- Serve un componente coerente di `Torna indietro` da usare nelle pagine
  operative.
- Nella schermata segretario, prima della scansione, serve un avviso rosso
  vicino allo stato che ricordi di avviare il check-in prima di scansionare le
  domande.
- Accanto ai candidati serve un pulsante `Note` che apra una modal, salvi una
  nota associata al candidato specifico e riporti la nota nell'export Excel
  delle liste generate.
- Il widget di messaggistica/stati in tempo reale non e' leggibile su schermi
  piccoli: troppe informazioni in una riga costringono allo scroll orizzontale.
- Dopo cambi di stato o azioni da altri profili, segretario e informatici devono
  ricaricare la pagina per vedere timeline e azioni aggiornate; serve un
  aggiornamento affidabile tra dashboard, non solo notifiche.

## Evidenze dai log allegati

I log backend e frontend del 2026-09-09 confermano alcune anomalie operative
da trasformare in criteri di correzione:

Nota diagnostica completa: [log-analysis-2026-09-09.md](log-analysis-2026-09-09.md).

- Alle 08:30:07 UTC, dopo un invio liste gia' completato alle 08:30:01 UTC,
  un nuovo `Invia liste` sulla stessa sessione ha generato un errore non gestito
  per transizione `liste_inviate -> liste_inviate`.
- Alle 09:23:40 UTC, una nuova richiesta di `Genera liste` su una sessione gia'
  arrivata a `liste_inviate` ha generato un errore non gestito per transizione
  `liste_inviate -> liste_generate`.
- Nel frontend compaiono richieste `Genera liste` terminate con 499 alle
  09:22:01 UTC e 09:22:57 UTC: questo indica richiesta abbandonata dal client,
  compatibile con chiusura pagina, refresh, back o timeout percepito.
- Il frontend mostra chiamate ripetute a `bandi/config` senza identificativo
  del bando, con risposte 403 o 404, seguite da chiamate corrette con ID bando.
  Queste risposte non devono tradursi in falsi stati di errore per l'utente.
- Durante la sincronizzazione sessioni compaiono risposte 409 e un caso in cui
  un errore di relazione su bando/commissione lascia la transazione in stato
  abortito, con parse fail successivo e `inserted=0`.
- I log mostrano polling frequente delle notifiche, mentre stato, timeline,
  configurazione e azioni vengono aggiornati molto meno spesso o solo dopo
  azioni locali. Questo conferma il disallineamento percepito tra notifiche e
  pannelli operativi.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operazioni lunghe con stato visibile e sicuro (Priority: P1)

Un segretario o referente avvia un'operazione lunga, come generazione liste o
sincronizzazione referenti. L'interfaccia deve mostrare chiaramente che il
sistema sta lavorando, impedire azioni duplicate pericolose e spiegare cosa
succede se l'utente ricarica, chiude o torna indietro.

**Why this priority**: quando l'utente non vede un avanzamento chiaro tende a
ripremere pulsanti o cambiare pagina, aumentando il rischio di doppie
generazioni, stati incoerenti o falsa percezione di blocco.

**Independent Test**: avviare generazione liste e sincronizzazione referenti,
osservare spinner/messaggio, provare doppio click, refresh, back e riapertura
pagina, verificando che il risultato sia comprensibile e non duplicato.

**Acceptance Scenarios**:

1. **Given** il segretario preme `Genera liste`, **When** l'operazione e' in
   corso, **Then** vede uno spinner con messaggio chiaro e non puo avviare una
   seconda generazione identica senza conferma.
2. **Given** il referente apre la dashboard, **When** e' in corso una
   sincronizzazione o aggiornamento, **Then** vede uno spinner con messaggio
   che indica che il sistema sta sincronizzando.
3. **Given** un'operazione lunga e' in corso, **When** l'utente ricarica,
   chiude, torna indietro o ripreme l'azione, **Then** il sistema recupera o
   comunica lo stato dell'operazione senza creare duplicati nascosti.

---

### User Story 2 - Configurazione tecnici coerente su bandi multi-sessione (Priority: P1)

Un referente configura informatici in sede su un bando con piu sessioni. Dopo il
salvataggio, la dashboard e gli stati devono indicare correttamente se gli
informatici risultano assegnati, distinguendo il caso di tutte le sessioni
complete dal caso di sessioni ancora incomplete.

**Why this priority**: se il sistema continua a dire che l'informatico non e'
assegnato dopo il salvataggio, il referente non sa se ha sbagliato dato o se il
sistema non interpreta correttamente la configurazione multi-sessione.

**Independent Test**: configurare un bando con due sessioni, assegnare
informatico in sede a una o a entrambe, salvare e verificare messaggi/stati in
dashboard referente, dashboard sede e dettaglio sessioni.

**Acceptance Scenarios**:

1. **Given** tutte le sessioni richieste hanno un informatico in sede valido,
   **When** il referente salva, **Then** il sistema non deve piu mostrare
   `informatico non assegnato`.
2. **Given** solo alcune sessioni hanno informatico in sede assegnato, **When**
   il referente salva, **Then** il sistema deve indicare chiaramente quali
   sessioni sono complete e quali no.
3. **Given** un informatico in sede apre il proprio profilo, **When** consulta
   il bando multi-sessione, **Then** vede solo le sessioni assegnate alla sua
   email.

---

### User Story 3 - Navigazione operativa coerente con torna indietro comune (Priority: P2)

Un utente operativo entra in pagine di dettaglio da dashboard diverse. Ogni
pagina deve offrire un comando coerente per tornare al contesto precedente,
senza costringerlo a usare il browser o a conoscere gli URL.

**Why this priority**: i profili segretario, referente, esperto remoto e sede
usano le stesse entita da punti di ingresso diversi; un ritorno non coerente fa
perdere contesto e rallenta il collaudo.

**Independent Test**: entrare in configurazione, sessioni, gestione sessione,
candidati, dispositivi e liste da profili diversi; usare `Torna indietro` e
verificare che l'utente torni al punto logico di partenza.

**Acceptance Scenarios**:

1. **Given** un utente arriva da dashboard segretario, **When** preme `Torna
   indietro` in una pagina di dettaglio, **Then** ritorna alla dashboard o lista
   coerente col profilo segretario.
2. **Given** un utente arriva da dashboard referente o tecnica, **When** preme
   `Torna indietro`, **Then** ritorna al contesto referente o tecnico senza
   perdere `mode`.

---

### User Story 4 - Avviso operativo prima della scansione (Priority: P1)

Il segretario deve vedere un avviso evidente quando la sessione non e' ancora in
stato di check-in avviato, per evitare che inizi a scansionare domande prima
della transizione corretta.

**Why this priority**: il check-in e' un passaggio operativo critico. Se gli
operatori scansionano prima dello stato corretto, il flusso puo diventare
ambiguo o non tracciabile.

**Independent Test**: aprire la gestione sessione prima di avviare check-in e
verificare la presenza dell'avviso; poi avviare check-in e verificare che
l'avviso sparisca o cambi in modo coerente.

**Acceptance Scenarios**:

1. **Given** la sessione e' prima dello stato `check-in avviato`, **When** il
   segretario apre la schermata, **Then** vede un avviso rosso vicino allo stato
   che dice di avviare il check-in prima di scansionare.
2. **Given** il check-in e' stato avviato, **When** la schermata si aggiorna,
   **Then** l'avviso non deve piu bloccare o confondere l'operatore.

---

### User Story 5 - Note candidato persistenti e riportate nell'export (Priority: P2)

Un operatore deve poter aggiungere note a un candidato specifico durante la
gestione della sessione. Le note devono essere salvate, modificabili, visibili
nella tabella candidati e incluse nell'Excel generato dove rilevanti.

**Why this priority**: durante il check-in possono emergere informazioni
operative sul candidato che devono restare associate alla persona corretta e
comparire nei documenti finali.

**Independent Test**: aprire la lista candidati, aggiungere una nota tramite
modal, salvare, ricaricare la pagina e generare liste; verificare che la nota
sia presente nella tabella e nell'Excel solo sul candidato corretto.

**Acceptance Scenarios**:

1. **Given** un candidato in lista, **When** l'operatore preme `Note`, **Then**
   si apre una modal con campo testo.
2. **Given** l'operatore salva una nota, **When** ricarica la pagina, **Then**
   la nota resta associata allo stesso candidato.
3. **Given** viene generato l'Excel che include candidati, **When** il candidato
   ha note salvate, **Then** l'Excel riporta le note in modo leggibile.

---

### User Story 6 - Widget notifiche e stati leggibile su mobile (Priority: P2)

Un utente su schermo piccolo deve leggere notifiche e cambi stato senza
scorrimento orizzontale. Il widget deve mostrare informazioni essenziali:
profilo sintetico, nome, data/ora breve, messaggio o stato in evidenza, e un
badge quando c'e' una nuova notifica o cambio stato.

**Why this priority**: la messaggistica in tempo reale deve aiutare gli
operatori, non costringerli a inseguire email lunghe e testi tagliati.

**Independent Test**: aprire il widget da mobile o viewport piccolo, generare
notifiche e cambi stato lunghi, e verificare che tutto sia leggibile senza
scroll orizzontale.

**Acceptance Scenarios**:

1. **Given** una notifica contiene email o testo lungo, **When** viene mostrata
   su mobile, **Then** non produce scroll orizzontale e mostra il ruolo in forma
   breve, ad esempio `Segretario`, `Inf. sede`, `Inf. remoto`.
2. **Given** arriva un nuovo cambio stato, **When** il widget lo riceve, **Then**
   mostra un badge o indicatore di novita distinguibile.
3. **Given** il messaggio e' importante, **When** viene visualizzato, **Then** il
   testo principale e' leggibile e piu evidente dei metadati.

---

### User Story 7 - Aggiornamento affidabile tra dashboard senza refresh manuale (Priority: P1)

Quando un profilo cambia stato o completa un'azione, gli altri profili collegati
alla stessa sessione devono vedere timeline, stato corrente e azioni disponibili
aggiornarsi senza dover ricaricare manualmente la pagina.

**Why this priority**: il collaudo ha mostrato che le notifiche arrivano, ma le
parti operative restano ferme. Questo puo portare operatori diversi a lavorare
su stati vecchi.

**Independent Test**: aprire due browser con profili diversi sulla stessa
sessione, eseguire azioni da uno, verificare sull'altro aggiornamento di stato,
timeline e pannello azioni senza refresh.

**Acceptance Scenarios**:

1. **Given** segretario e informatico guardano la stessa sessione, **When**
   l'informatico completa un'azione che cambia stato o dati operativi, **Then**
   il segretario vede timeline e azioni aggiornate senza refresh.
2. **Given** il segretario avanza lo stato, **When** l'informatico ha la pagina
   aperta, **Then** vede stato e azioni coerenti entro pochi secondi.
3. **Given** la connessione real-time non e' disponibile, **When** una dashboard
   resta aperta, **Then** il sistema deve avere un fallback affidabile o
   segnalare che i dati potrebbero non essere aggiornati.

### Edge Cases

- Doppio click su `Genera liste` mentre la prima richiesta e' ancora in corso.
- Refresh pagina durante generazione liste.
- Chiusura tab durante generazione liste e riapertura della sessione.
- Navigazione indietro durante import/sync/generazione.
- Nuovo click su `Invia liste` dopo che l'invio e' gia' stato completato.
- Nuovo click su `Genera liste` dopo che la sessione e' gia' avanzata a uno
  stato successivo.
- Richiesta abbandonata dal client mentre il backend continua, completa o
  annulla l'operazione.
- Sincronizzazione sessioni con dati remoti parziali, commissione non presente
  o record non importabile.
- Pagina aperta con contesto incompleto che tenta chiamate di configurazione
  prima di conoscere l'identificativo del bando.
- Bando con piu sessioni, alcune con informatico sede e altre senza.
- Stessa persona assegnata come tecnico su una sessione ma non su un'altra.
- Nota candidato vuota, molto lunga o modificata piu volte.
- Due operatori modificano note o stato quasi contemporaneamente.
- Widget notifiche con email molto lunga o messaggio multi-riga.
- Connessione real-time interrotta o browser in background.
- Operatore con pagina aperta su stato vecchio mentre un altro profilo avanza il
  workflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il sistema DEVE mostrare uno spinner e un messaggio chiaro durante
  generazione liste, import, sync e altre operazioni lunghe.
- **FR-002**: Il sistema DEVE impedire o gestire in modo esplicito il riavvio
  duplicato della stessa operazione lunga sulla stessa sessione.
- **FR-003**: Il sistema DEVE definire comportamento verificabile per refresh,
  chiusura tab, back browser e nuovo click durante operazioni lunghe.
- **FR-004**: La dashboard referenti DEVE mostrare uno spinner con messaggio
  durante aggiornamenti o sincronizzazioni.
- **FR-005**: Lo stato di assegnazione informatico in sede DEVE essere corretto
  per bandi con una o piu sessioni.
- **FR-006**: Quando un bando multi-sessione e' parzialmente configurato, il
  sistema DEVE indicare quali sessioni sono incomplete.
- **FR-007**: Ogni pagina operativa di dettaglio DEVE offrire un comando `Torna
  indietro` coerente col profilo e col punto di ingresso.
- **FR-008**: La schermata segretario DEVE mostrare un avviso evidente prima
  dell'avvio check-in quando l'operatore potrebbe iniziare scansioni fuori stato.
- **FR-009**: Gli operatori autorizzati DEVONO poter aggiungere, modificare e
  salvare note associate a uno specifico candidato.
- **FR-010**: Le note candidato DEVONO essere incluse nell'Excel generato che
  riporta i dati candidati, se presenti.
- **FR-011**: Il widget notifiche/stati DEVE essere leggibile su schermi piccoli
  senza scroll orizzontale.
- **FR-012**: Il widget notifiche/stati DEVE mostrare ruoli in forma sintetica,
  nome, data/ora breve e messaggio o stato in evidenza.
- **FR-013**: Il widget notifiche/stati DEVE indicare chiaramente nuove
  notifiche o nuovi cambi stato.
- **FR-014**: Stato corrente, timeline e azioni disponibili DEVONO aggiornarsi
  tra dashboard aperte su profili diversi senza refresh manuale.
- **FR-015**: Se l'aggiornamento real-time non e' disponibile, il sistema DEVE
  offrire fallback o avviso affidabile sul possibile disallineamento.
- **FR-016**: Le correzioni DEVONO essere coperte da test automatici quando
  possibile e da checklist manuale quando dipendono da piu browser o utenti.
- **FR-017**: Ripetere `Genera liste` o `Invia liste` dopo il completamento
  dell'azione NON DEVE produrre errori non gestiti; il sistema DEVE mostrare
  lo stato corrente, il risultato gia' disponibile o un messaggio operativo
  chiaro.
- **FR-018**: Quando una richiesta viene abbandonata dal client durante
  un'operazione lunga, alla riapertura della pagina il sistema DEVE recuperare
  lo stato reale dell'operazione e renderlo comprensibile all'utente.
- **FR-019**: Le pagine operative NON DEVONO mostrare errori utente causati da
  chiamate di configurazione eseguite senza il contesto minimo richiesto; devono
  attendere il contesto valido o ignorare gli esiti tecnici non rilevanti.
- **FR-020**: La sincronizzazione sessioni DEVE gestire record remoti non
  importabili o commissioni mancanti senza lasciare operazioni parziali in
  stato incoerente; il risultato deve distinguere chiaramente successo,
  nessun nuovo dato, conflitto e fallimento parziale.

### Key Entities

- **Operazione lunga**: azione avviata dall'utente che puo richiedere tempo,
  come generazione liste, import candidati o sincronizzazione.
- **Stato operazione**: informazione visibile su avanzamento, completamento,
  errore o recupero dopo reload.
- **Assegnazione tecnico-sessione**: relazione tra sessione e informatico in
  sede o esperto remoto.
- **Comando di ritorno**: azione di navigazione che riporta al contesto
  operativo precedente.
- **Nota candidato**: testo associato a un candidato specifico e visibile nei
  documenti prodotti.
- **Evento real-time**: notifica, cambio stato o aggiornamento operativo da
  propagare alle dashboard aperte.
- **Badge di novita**: indicatore visivo che segnala evento o cambio stato non
  ancora visto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nel 100% delle operazioni lunghe testate, l'utente vede entro 1
  secondo uno spinner o messaggio di avanzamento.
- **SC-002**: Nel 100% dei test di doppio click o refresh durante generazione
  liste, non vengono create duplicazioni nascoste o stati incoerenti.
- **SC-003**: Nel 100% dei bandi multi-sessione testati, lo stato informatico in
  sede riflette correttamente sessioni complete e incomplete.
- **SC-004**: Nel 100% delle pagine operative testate, `Torna indietro`
  mantiene il contesto del profilo.
- **SC-005**: Nel 100% dei candidati con note salvate, la nota resta associata
  dopo refresh ed e' presente nell'export Excel pertinente.
- **SC-006**: Su viewport mobile, il widget notifiche/stati non produce scroll
  orizzontale e il messaggio principale e' leggibile.
- **SC-007**: In test con due profili aperti sulla stessa sessione, stato,
  timeline e azioni si aggiornano su entrambi entro 5 secondi dal cambio.
- **SC-008**: Dopo deploy su test, la checklist 011 non contiene FAIL bloccanti
  prima di rivalutare la produzione.
- **SC-009**: Nei test di retry su `Genera liste` e `Invia liste`, il backend
  non produce errori non gestiti e l'utente riceve sempre un esito leggibile.
- **SC-010**: Durante la navigazione normale non compaiono messaggi di errore
  causati da chiamate di configurazione senza identificativo bando o sessione.

## Assumptions

- Le prove tecniche non ancora fatte dai tecnici reali sono state simulate
  dall'admin, ma dovranno essere ripetute almeno su server test prima della
  produzione.
- Le note candidato sono dati operativi della sessione e devono rispettare gli
  stessi controlli di autorizzazione delle altre modifiche sui candidati.
- La gestione affidabile delle operazioni lunghe puo richiedere persistenza o
  recupero dello stato operazione; il comportamento esatto verra definito nel
  piano tecnico.
- L'aggiornamento real-time puo usare il meccanismo notifiche esistente oppure
  un fallback di polling, purche' l'esperienza utente sia affidabile.
- La produzione generale resta bloccata finche' questi problemi P1 non sono
  corretti o accettati esplicitamente come rischio.

## Stato implementazione 2026-09-09

Correzioni applicate nel ramo corrente:

- Spinner e messaggi operativi aggiunti su import candidati, generazione liste,
  invio liste e sincronizzazioni principali.
- `Genera liste` e `Invia liste` resi idempotenti rispetto a richieste ripetute
  dopo completamento; gli esiti gia disponibili vengono mostrati senza errore
  non gestito.
- L'invio liste avanza comunque lo stato a `liste_inviate` anche se l'email di
  notifica fallisce: l'informatico remoto puo vedere e scaricare le liste dalla
  dashboard; il segretario vede un warning sull'email non inviata.
- Dashboard sessione aggiornata con polling di stato ogni 5 secondi e refresh
  automatico di azioni, timeline e lista candidati dopo azioni locali o remote.
- Chiamate di configurazione senza identificativo bando evitate nella UI
  operativa.
- Dashboard referente aggiornata con conteggi per sessione di esperto remoto e
  informatico in sede assegnati, piu elenco sessioni incomplete.
- Componente comune `Torna indietro` introdotto e collegato alle principali
  pagine operative Angular.
- Avviso rosso pre-check-in aggiunto nella gestione sessione per segretario e
  admin prima dello stato `checkin_avviato`.
- Note candidato persistenti aggiunte con colonna in tabella, modal, API
  dedicata, migrazione runtime e inclusione nelle liste Excel esportate.
- Widget notifiche rivisto per mobile: ruolo sintetico, nome breve, data/ora
  compatta, messaggio in evidenza e badge per nuovi eventi.
- Sync sessioni resa piu robusta con savepoint per record, evitando che un
  record remoto non importabile lasci la transazione in stato abortito.

Residui da verificare con collaudo reale:

- Confermare su due browser/profili reali che polling e refresh entro 5 secondi
  siano sufficienti per il lavoro operativo.
- L'export con le note candidato resta solo in Excel in questa fase (nessun
  verbale PDF candidati esiste nel sistema); se in futuro verra' introdotto,
  le stesse note dovranno essere riportate anche li. Vedi anche checklist
  post-deploy 011, item 011.12, aggiornato di conseguenza.
- Verificare su bando multi-sessione reale che i conteggi di assegnazione
  referente corrispondano ai dati Selezioni Online dopo sync.

## Code review 2026-09-09: bug trovati e correzioni

Prima del commit, una review multi-angolo (correttezza, duplicazioni,
semplificazione, efficienza) sull'implementazione sopra ha trovato le
seguenti lacune, tutte corrette nello stesso ramo prima del commit iniziale
della feature 011. Copertura: 154 test backend + 56 test frontend, build e
typecheck Angular puliti dopo le correzioni.

Corrette:

- **Invio liste, race condition con email duplicata**: `send_latest_list`
  leggeva lo stato e inviava l'email senza lock, cosi' due richieste
  concorrenti (doppia tab, doppio click) potevano superare entrambe il
  controllo e inviare due email. Corretto con una transizione di stato
  atomica (`utils/stato.py::claim_transition`, UPDATE condizionato sullo
  stato di partenza): solo la richiesta che vince la race invia davvero
  l'email, l'altra riceve la risposta idempotente.
- **Banner falso positivo su invio email fallito**: dopo l'invio, la UI
  mostrava sempre "Liste candidati inviate correttamente" anche quando
  l'email non era partita, perche' il warning era solo transitorio e
  spariva al reload. Il comportamento di non bloccare il flusso resta
  invariato (lo stato avanza comunque, l'informatico da remoto vede sempre
  le liste generate e scaricabili): ora pero' l'esito dell'invio email
  (`email_status`/`email_error`) e' persistito sul record della lista
  generata (`liste_generate`, nuove colonne) e la UI mostra un banner
  diverso, stabile anche dopo reload, quando l'email non e' partita.
- **Dashboard referente non rifletteva `expert_assigned` da sync remoto**:
  il rapporto sessioni (`N/M sessioni`) aveva sostituito il flag booleano
  del backend, che puo' risultare vero anche a `0/N` (dato sincronizzato a
  livello di bando prima che le sessioni fossero note). Corretto:
  `referente-bandi.component.ts` ora mostra il rapporto ma non lo contraddice
  quando il flag di bando e' gia' vero.
- **`expert_assigned` incoerente tra endpoint**: `get_bando` (dettaglio
  singolo bando) usava solo il flag grezzo di `bando_config`, ignorando le
  assegnazioni a livello di sessione usate invece da tutte le liste
  (referente, sede, esperto remoto). Allineato alla stessa definizione
  (flag grezzo OR almeno una sessione con esperto assegnato).
- **Aggiornamento cross-dashboard incompleto**: in gestione sessione, la
  lista candidati (incluse le note) si aggiornava solo sui cambi di stato
  della sessione, non su modifiche di dati candidato fatte da un altro
  profilo. Corretto: ogni tick di polling aggiorna anche i figli, non solo
  sulle transizioni di stato.
- **Polling non disiscritto correttamente**: il poll a 5s in gestione
  sessione usava `window.setInterval` con cleanup manuale, che non annullava
  una richiesta HTTP gia' in volo alla distruzione del componente. Riscritto
  con RxJS (`timer` + `switchMap` + `takeUntilDestroyed`), che annulla anche
  la richiesta in corso alla navigazione via dalla pagina.
- **Autore notifiche ricalcolato "live"**: il ruolo/nome mostrato per ogni
  messaggio in chat veniva ricalcolato ad ogni lettura dalla configurazione
  *attuale* della sessione, invece che da quella in vigore alla creazione:
  una riassegnazione (es. cambio informatico sede) riattribuiva
  retroattivamente i messaggi passati al ruolo sbagliato. Inoltre ogni
  notifica generava una query DB dedicata (fino a ~400 connessioni per una
  singola lettura con 200 notifiche). Corretto: ruolo e nome sono calcolati
  una sola volta e persistiti alla creazione (`session_notifications`, nuove
  colonne `author_display`/`author_role`); le righe storiche prive del dato
  usano il calcolo live solo come fallback.
- **Frammento SQL dei conteggi di assegnazione duplicato 4 volte** in
  `routes/api_v1/bandi.py` e `utils/jconon_service.py`, causa diretta
  dell'incoerenza `expert_assigned` sopra. Estratto in
  `utils/sql_fragments.py` come fonte unica.
- **Sessioni omonime ambigue nell'elenco "sessioni incomplete"**: due
  sessioni con lo stesso nome nello stesso bando comparivano come una sola
  voce. Il nome ora include la data della sessione quando disponibile.

Non corretti in questo passaggio (residui noti, non bloccanti per il
collaudo):

- Le operazioni lunghe diverse da genera/invia liste (import candidati,
  salvataggio configurazione sessione) non hanno un guard server-side
  equivalente contro richieste duplicate dopo reload: sono protette solo dal
  flag `busy` lato client, che si perde al reload. Da valutare se estendere
  lo stesso pattern di `claim_transition` quando servira'.
- Il poll a 5s di stato/timeline/azioni e il poll a 10s del widget notifiche
  restano due cicli indipendenti sulla stessa pagina, non coordinati tra
  loro. Non e' un difetto funzionale, ma un possibile consolidamento futuro
  per ridurre il traffico di polling.
