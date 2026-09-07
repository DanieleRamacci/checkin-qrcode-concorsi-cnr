# Feature Specification: Stabilizzazione collaudo e correzione flussi

**Feature Branch**: `010-collaudo-bugfix-flow`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "Registrare i problemi trovati durante la verifica del progetto, correggere i bug e i problemi di flusso rispetto alla documentazione, quindi preparare il passaggio al test con utenti veri."

## Analisi osservata

La verifica di collaudo ha confermato che i test automatici e la build sono
verdi, ma restano incoerenze funzionali che impediscono di chiudere il collaudo
con utenti reali. I problemi riguardano soprattutto: sessione scaduta e
riautenticazione, visibilita dei profili operativi, accesso amministrativo di
supporto, preservazione del contesto nei redirect legacy, QR/PDF tecnici e
formalizzazione della feature di chiusura collaudo.

Questa feature raccoglie tali problemi in un perimetro unico di stabilizzazione:
prima si correggono i flussi bloccanti, poi si aggiorna la documentazione di
collaudo e solo dopo si passa a prove manuali con utenti reali o equivalenti.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sessione scaduta gestita come nuovo login (Priority: P1)

Un operatore lascia aperta l'applicazione o torna su un link salvato dopo la
scadenza della sessione. Quando apre una pagina protetta o avvia un'azione che
richiede autenticazione valida, viene guidato al login invece di ricevere errori
operativi fuorvianti.

**Why this priority**: una sessione scaduta mostrata come errore operativo puo
bloccare il collaudo e far diagnosticare in modo errato problemi di bando,
permessi o servizi esterni.

**Independent Test**: simulare una sessione applicativa non piu utilizzabile,
aprire pagine e azioni protette, e verificare che il comportamento sia sempre
una richiesta coerente di nuovo login con ritorno sicuro alla destinazione.

**Acceptance Scenarios**:

1. **Given** un utente con sessione non piu valida, **When** apre una pagina
   protetta, **Then** il sistema richiede nuovo login prima di mostrare dati
   operativi.
2. **Given** un'azione fallisce per necessita di riautenticazione, **When**
   l'utente riceve la risposta, **Then** non vede un errore generico di servizio
   esterno e viene portato al login.
3. **Given** piu richieste scadute arrivano insieme, **When** il login viene
   avviato, **Then** l'utente percepisce un unico flusso di riautenticazione.

---

### User Story 2 - Profili operativi proposti solo agli utenti corretti (Priority: P1)

Un utente autenticato accede alla Home e vede solo i profili operativi coerenti
con i propri incarichi o con un accesso amministrativo esplicito.

**Why this priority**: proporre un profilo non utilizzabile crea confusione e
contraddice la separazione dei ruoli richiesta per il collaudo.

**Independent Test**: usare utenti assegnati e non assegnati ai profili
informatici, verificando che la Home proponga solo ingressi legittimi e che i
link diretti non mostrino dati non autorizzati.

**Acceptance Scenarios**:

1. **Given** un utente senza sessioni assegnate come informatico in sede,
   **When** apre la Home, **Then** non vede l'ingresso operativo "Informatico in
   sede".
2. **Given** un utente assegnato come informatico in sede, **When** apre la
   Home, **Then** vede l'ingresso dedicato e puo raggiungere le proprie sessioni.
3. **Given** un amministratore globale, **When** apre profili tecnici per
   supporto, **Then** l'accesso e' distinguibile da un incarico ordinario.

---

### User Story 3 - Accesso amministrativo di supporto coerente (Priority: P1)

Il team decide e applica una sola regola per l'accesso amministrativo nei profili
tecnici: se consentito, deve essere visibile e tracciabile; se non consentito,
la documentazione di collaudo deve indicare il canale corretto.

**Why this priority**: oggi documentazione e comportamento atteso non sono
allineati; senza una decisione unica il test manuale puo produrre risultati
contraddittori.

**Independent Test**: autenticarsi come amministratore globale non assegnato,
aprire le viste tecniche documentate e verificare che il risultato corrisponda
alla regola approvata.

**Acceptance Scenarios**:

1. **Given** la regola approvata consente supporto amministrativo nei profili
   tecnici, **When** un admin apre una vista non assegnata, **Then** la pagina si
   apre con indicazione chiara di accesso amministrativo.
2. **Given** la regola approvata non consente supporto amministrativo nei
   profili tecnici, **When** un admin apre una vista non assegnata, **Then** la
   documentazione e i test non si aspettano tale accesso.

---

### User Story 4 - Link e artefatti tecnici preservano il contesto (Priority: P2)

Un utente o un operatore usa un link storico, un QR o un PDF tecnico ancora
previsto dalla transizione. Il sistema deve mantenere il contesto operativo e
non generare link incompleti.

**Why this priority**: redirect o QR parziali possono portare l'utente nel
profilo sbagliato o produrre errori al momento del test reale.

**Independent Test**: aprire link storici con contesto operativo, scaricare o
scansionare QR/PDF tecnici e verificare che la destinazione finale sia valida e
coerente.

**Acceptance Scenarios**:

1. **Given** un link storico contiene il profilo operativo, **When** viene
   normalizzato verso la nuova interfaccia, **Then** conserva il profilo atteso.
2. **Given** un PDF tecnico contiene un QR per collegare un dispositivo,
   **When** il QR viene scansionato, **Then** apre un link completo e valido.

---

### User Story 5 - Chiusura collaudo formalizzata prima degli utenti reali (Priority: P2)

Il responsabile del collaudo consulta una checklist aggiornata e sa quali prove
automatiche e manuali sono state superate prima di coinvolgere utenti reali.

**Why this priority**: il passaggio a utenti reali deve avvenire con evidenza
documentata e senza bug gia noti aperti nei flussi principali.

**Independent Test**: rivedere la spec di collaudo, la matrice manuale e i
risultati automatici; confermare che ogni difetto bloccante sia chiuso o
esplicitamente escluso dal test reale.

**Acceptance Scenarios**:

1. **Given** le correzioni bloccanti sono completate, **When** si aggiorna la
   documentazione di collaudo, **Then** ogni flusso ha stato, esito e prossima
   azione chiari.
2. **Given** una correzione non e' completata, **When** si valuta il passaggio a
   utenti reali, **Then** il rischio resta visibile e non viene segnato come
   chiuso.

### Edge Cases

- Sessione applicativa presente ma credenziali non piu rinnovabili.
- Link diretto aperto dopo scadenza sessione.
- Richieste simultanee che richiedono nuovo login.
- Utente autenticato ma non assegnato ad alcun profilo tecnico.
- Utente assegnato a un solo profilo che prova ad aprirne un altro.
- Amministratore globale non assegnato che opera per supporto.
- Link storico con parametri di profilo operativo.
- QR o PDF tecnico generato prima o durante il cutover.
- Prova manuale interrotta a meta da un errore di servizio esterno.
- Documentazione di collaudo incompleta rispetto al comportamento reale.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il sistema DEVE gestire ogni richiesta di riautenticazione come
  ritorno coerente al login, senza presentarla come errore generico di servizio
  esterno.
- **FR-002**: Le pagine protette NON DEVONO mostrare dati operativi quando la
  sessione e' gia nota come non piu valida per proseguire.
- **FR-003**: Il sistema DEVE conservare una destinazione di ritorno locale e
  sicura dopo nuovo login.
- **FR-004**: L'ingresso "Informatico in sede" DEVE essere proposto solo agli
  utenti con incarichi coerenti o agli amministratori globali in supporto
  esplicito.
- **FR-005**: I profili segretario, referente, esperto remoto e informatico in
  sede DEVONO restare separati nelle proposte di accesso e nei link diretti.
- **FR-006**: La regola per l'accesso amministrativo di supporto nei profili
  tecnici DEVE essere unica e allineata tra comportamento, test e documentazione.
- **FR-007**: Ogni accesso amministrativo di supporto consentito DEVE essere
  chiaramente distinguibile dall'assegnazione ordinaria.
- **FR-008**: I link storici ancora supportati DEVONO preservare il profilo
  operativo quando tale profilo e' presente nella richiesta originale.
- **FR-009**: I QR e PDF tecnici mantenuti durante la transizione DEVONO
  produrre destinazioni complete, valide e utilizzabili.
- **FR-010**: La documentazione di collaudo DEVE riportare i difetti corretti,
  le prove automatiche eseguite e le prove manuali ancora richieste.
- **FR-011**: Il passaggio a utenti reali DEVE avvenire solo dopo chiusura o
  accettazione esplicita dei difetti bloccanti documentati in questa feature.
- **FR-012**: Le prove automatiche devono coprire almeno un caso positivo e uno
  negativo per ogni flusso corretto quando il comportamento e' verificabile senza
  servizi esterni reali.

### Key Entities

- **Utente di collaudo**: persona o identita di test con ruoli e incarichi
  noti, usata per validare i flussi prima del test reale.
- **Profilo operativo**: modalita applicativa scelta dall'utente, ad esempio
  segretario, referente, esperto remoto o informatico in sede.
- **Richiesta di riautenticazione**: evento che richiede nuovo login per
  continuare in modo autorizzato.
- **Link storico o tecnico**: destinazione legacy, QR o PDF ancora supportata
  durante il cutover.
- **Evidenza di collaudo**: risultato automatico o manuale che dimostra la
  correttezza del flusso o documenta un rischio residuo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nel 100% dei casi simulati di sessione non piu valida, l'utente
  viene portato al login invece di vedere errori operativi generici.
- **SC-002**: Nel 100% dei test Home con utenti non assegnati, i profili tecnici
  non applicabili non vengono proposti.
- **SC-003**: Nel 100% dei test con amministratore globale, il comportamento
  osservato corrisponde alla regola documentata per il supporto.
- **SC-004**: Nel 100% dei link storici testati con profilo operativo, il
  profilo viene preservato nella destinazione finale.
- **SC-005**: Nel 100% dei QR/PDF tecnici testati, la destinazione generata e'
  completa e utilizzabile.
- **SC-006**: Prima del test con utenti reali, tutti i difetti bloccanti di
  questa feature risultano chiusi o accettati esplicitamente nella
  documentazione di collaudo.
- **SC-007**: Le suite automatiche principali restano verdi dopo le correzioni.

## Assumptions

- Il test con utenti reali viene pianificato solo dopo una nuova esecuzione dei
  test automatici e una verifica manuale interna sui flussi corretti.
- La correzione della riautenticazione segue la spec 008 gia esistente.
- La correzione dei profili operativi segue le spec 006 e 007 gia esistenti.
- I servizi esterni possono essere simulati o esclusi dalle prove automatiche,
  pur restando obbligatori nella checklist manuale finale.
- La regola desiderata per l'amministratore globale resta quella gia descritta
  nelle spec: accesso di supporto consentito, visibile e distinguibile.
