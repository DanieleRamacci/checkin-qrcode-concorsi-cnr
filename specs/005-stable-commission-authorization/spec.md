# Feature Specification: Autorizzazioni stabili bando e sync sicura

**Feature Branch**: `005-stable-commission-authorization`

**Created**: 2026-07-10

**Status**: Decisione SOL chiusa per il perimetro attuale (2026-07-16)

**Input**: User description: "Definire una correzione strutturale per separare il bando/commissione come dato operativo stabile dalle autorizzazioni dei singoli utenti sincronizzate da Selezioni Online. Se un utente non vede piu un bando dalla fonte remota, il sistema non deve cancellare dati operativi gia avviati; deve revocare o disattivare l'accesso di quell'utente, mantenendo bando, configurazione, sessioni, candidati, stati, liste e dispositivi disponibili agli altri utenti ancora autorizzati."

## Evidenze di collaudo Selezioni Online

- **2026-07-15**: prova reale su ambiente test. Con sync basata solo su
  `/openapi/v1/call/commissions`, un utente CNR inserito in un bando come
  `COMPONENTE` e non come `SEGRETARIO` vede comunque il bando nella dashboard
  `/bandi`. Quindi quell'endpoint conferma una relazione utente-bando, ma non
  basta per certificare il ruolo Segretario.
- Implicazione: la dashboard Segretario non puo usare soltanto
  `/call/commissions` come fonte di verita del ruolo. Serve una decisione
  successiva tra verifica dettaglio/bulk da `/openapi/v1/call` con
  `detailCommission=true`, verifica puntuale sulle azioni critiche, oppure
  accettazione temporanea del rischio UX per commissari interni CNR.
- **2026-07-16**: ulteriore prova reale su ambiente test. Lo stesso utente CNR
  inserito come `COMPONENTE` riesce anche a scaricare i candidati da Selezioni
  Online. Quindi l'API esterna di import candidati non distingue, almeno nel
  test osservato, tra segretario e componente della commissione.
- Implicazione aggiornata: il filtro "solo SEGRETARIO" non e' richiesto da un
  blocco tecnico osservato su Selezioni Online. La decisione applicativa del
  2026-07-16 e' accettare come operativo il perimetro "membro commissione
  abilitato da Selezioni Online", evitando una sync ruolo complessa.
- La vista amministratore resta utile per supporto, audit e visione globale dei
  bandi locali non collegati all'utente. Non serve piu come meccanismo per
  separare "segretario" da "componente" nel flusso ordinario.

## Decisione di chiusura SOL 2026-07-16

Per il perimetro corrente, Check-in CNR Concorsi accetta "membro commissione
abilitato da Selezioni Online" come criterio operativo. Non viene introdotta una
sync bloccante in background per certificare il solo ruolo `SEGRETARIO` prima di
mostrare o rendere operativo un bando. La regola documentata resta:

- il bando viene considerato operativo per l'utente quando Selezioni Online lo
  restituisce come collegato alla commissione e l'utente risulta abilitato dalla
  fonte esterna;
- la vista amministratore resta separata e serve per supporto, audit e visione
  globale dei bandi locali non collegati all'utente, non per confondere un
  accesso locale admin con una relazione operativa restituita da Selezioni
  Online;
- il filtro rigido "solo `SEGRETARIO`" e' rinviato a una decisione di processo:
  se verra richiesto, dovra essere implementato come regola applicativa
  esplicita usando dettaglio commissione o altra fonte attendibile del ruolo,
  preferibilmente senza bloccare la dashboard iniziale.

Di conseguenza, nelle user story storiche sotto, il termine "segretario" va
letto come "utente operativo collegato alla commissione da Selezioni Online"
finche non viene formalizzata una policy piu restrittiva.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Revoca accesso senza perdita operativa (Priority: P1)

Un segretario aveva accesso a un bando, ha gia sincronizzato sessioni o avviato
attivita operative, poi non risulta piu autorizzato nella fonte istituzionale.
Alla sync successiva il sistema deve rimuovere l'accesso di quel segretario senza
cancellare il bando e senza interrompere i dati operativi collegati.

**Why this priority**: e il caso che ha prodotto l'errore di integrita e puo
bloccare la dashboard. La correzione deve proteggere dati gia usati nel flusso
concorsuale.

**Independent Test**: predisporre un bando visibile a un segretario con almeno
una sessione operativa collegata; simulare una sync in cui quel segretario non
riceve piu il bando; verificare che il segretario non lo veda piu ma che bando e
sessioni restino presenti per gli altri utenti autorizzati.

**Acceptance Scenarios**:

1. **Given** un bando con sessioni operative collegate a un segretario, **When**
   la sync non restituisce piu quel bando per quel segretario, **Then** il
   segretario perde visibilita sul bando senza errori e senza cancellazione dei
   dati operativi.
2. **Given** un bando configurato e gia usato, **When** un utente perde
   autorizzazione, **Then** configurazione bando, sessioni, candidati, stati,
   liste e dispositivi restano disponibili agli utenti ancora autorizzati.
3. **Given** un vecchio segretario non piu autorizzato, **When** prova ad aprire
   il bando tramite link diretto, **Then** il sistema rifiuta l'accesso con un
   messaggio chiaro.

---

### User Story 2 - Nuovo segretario eredita il lavoro gia fatto (Priority: P1)

Un bando resta lo stesso, ma cambia il segretario autorizzato in Selezioni
Online. Il nuovo segretario deve vedere il bando e continuare dal punto in cui
il flusso operativo si trovava, senza dover riconfigurare o risincronizzare
tutto da zero.

**Why this priority**: il cambio di segretario non deve rendere fragile il
processo. La configurazione e lo stato del bando devono essere indipendenti
dall'utente che li aveva sincronizzati per primo.

**Independent Test**: configurare un bando con un primo segretario, poi simulare
la fonte remota che restituisce un secondo segretario per lo stesso bando.
Verificare che il nuovo segretario veda lo stesso bando con la configurazione e
le sessioni gia presenti.

**Acceptance Scenarios**:

1. **Given** un bando gia configurato da un segretario precedente, **When** la
   fonte istituzionale autorizza un nuovo segretario, **Then** il nuovo
   segretario vede il bando e la configurazione gia salvata.
2. **Given** un bando con check-in o liste gia generate, **When** cambia il
   segretario autorizzato, **Then** il nuovo segretario vede lo stato corrente
   del workflow e puo continuare secondo le regole ordinarie.
3. **Given** piu segretari autorizzati sullo stesso bando, **When** ciascuno
   apre il bando, **Then** tutti vedono la stessa configurazione operativa e gli
   stessi stati, non copie separate per utente.

---

### User Story 3 - Sync idempotente e non distruttiva (Priority: P1)

La sincronizzazione puo essere ripetuta piu volte, manualmente o automaticamente,
senza duplicare bandi/sessioni e senza cancellare dati operativi solo perche una
risposta remota non contiene piu un'associazione utente-bando.

**Why this priority**: la sync deve essere un'operazione sicura. Un utente deve
poter aggiornare i dati senza rischiare di perdere lavoro gia eseguito o
bloccare la dashboard.

**Independent Test**: eseguire sync ripetute con dati invariati, poi con dati
parziali, poi con un cambio di autorizzazione utente. Verificare che non si
creino duplicati, che gli accessi vengano aggiornati e che i dati operativi
restino stabili.

**Acceptance Scenarios**:

1. **Given** un bando gia presente localmente, **When** la sync lo restituisce
   di nuovo per lo stesso utente, **Then** il sistema aggiorna i dati disponibili
   senza creare duplicati.
2. **Given** un bando gia presente localmente, **When** la sync non lo
   restituisce piu per un utente, **Then** il sistema disattiva l'accesso di
   quell'utente e conserva il bando.
3. **Given** una sync remota fallita o incompleta, **When** il sistema mostra i
   dati locali, **Then** deve distinguere chiaramente tra dati in cache e accessi
   revocati dalla fonte.

---

### User Story 4 - Stato accessi visibile e verificabile (Priority: P2)

Un amministratore o operatore tecnico deve poter capire perche un utente vede o
non vede un bando: ultimo dato ricevuto dalla fonte, ruolo associato, stato
attivo o revocato, data dell'ultima conferma e motivo dell'eventuale blocco.

**Why this priority**: senza tracciabilita, ogni problema di visibilita diventa
difficile da diagnosticare e rischia di essere risolto con interventi manuali
non controllati.

**Independent Test**: simulare un bando con un utente attivo, uno revocato e uno
mai autorizzato; verificare che l'amministratore possa distinguere i tre casi.

**Acceptance Scenarios**:

1. **Given** un utente autorizzato su un bando, **When** un amministratore
   verifica lo stato accesso, **Then** vede ruolo, stato attivo e ultima
   conferma.
2. **Given** un utente revocato, **When** un amministratore verifica lo stato
   accesso, **Then** vede che l'accesso non e piu attivo e quando e stato visto
   per l'ultima volta.
3. **Given** un utente mai associato al bando, **When** prova ad accedere,
   **Then** il rifiuto e distinguibile da una revoca precedente.

### Edge Cases

- La fonte remota non restituisce un bando per un errore temporaneo, non per una
  revoca reale.
- La fonte remota restituisce lo stesso bando con titolo aggiornato.
- La fonte remota restituisce lo stesso utente con email in maiuscolo/minuscolo
  o alias equivalente.
- Due utenti sincronizzano lo stesso bando in momenti diversi.
- Un bando non ha ancora sessioni operative ma ha gia configurazione bando.
- Un bando non ha sessioni, configurazioni o altri dati operativi.
- Un utente e segretario di un bando e referente/RDP di un altro.
- Un utente perde il ruolo segretario ma resta autorizzato con altro ruolo.
- La sync viene interrotta a meta e poi rilanciata.
- Un vecchio link diretto punta a un bando per cui l'utente non e piu
  autorizzato.
- Il bando e realmente cancellato o ritirato nella fonte istituzionale.
- Un amministratore deve distinguere tra "non piu autorizzato" e "fonte remota
  non disponibile".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il sistema DEVE trattare il bando/commissione come entita
  operativa stabile identificata dal suo identificativo istituzionale, separata
  dalle autorizzazioni dei singoli utenti.
- **FR-002**: Il sistema DEVE rappresentare l'associazione tra utente e bando
  come autorizzazione sincronizzata dalla fonte istituzionale, con ruolo, stato
  attivo/non attivo e data dell'ultima conferma.
- **FR-003**: La sincronizzazione NON DEVE cancellare dati operativi di un bando
  solo perche quel bando non compare piu nella risposta remota di un singolo
  utente.
- **FR-004**: Quando un bando non e piu restituito per un utente, il sistema
  DEVE disattivare l'autorizzazione di quell'utente o marcarla come non
  confermata, senza cancellare bando, configurazione o sessioni.
- **FR-005**: Un utente con autorizzazione non attiva NON DEVE poter vedere,
  aprire o modificare il bando, le sessioni e le configurazioni collegate,
  salvo permessi amministrativi espliciti.
- **FR-006**: Un nuovo utente autorizzato dalla fonte istituzionale DEVE poter
  vedere lo stesso bando operativo gia presente, con configurazione, sessioni,
  candidati, stati, liste e dispositivi esistenti.
- **FR-007**: La configurazione del bando DEVE restare associata al bando, non
  al singolo utente che l'ha configurata o sincronizzata per primo.
- **FR-008**: Le sessioni operative DEVONO restare associate al bando e non
  diventare copie separate per ciascun utente autorizzato.
- **FR-009**: La sync DEVE essere idempotente: ripetere la stessa
  sincronizzazione non deve creare duplicati ne modificare stati operativi
  senza una nuova informazione effettiva.
- **FR-010**: La sync DEVE aggiornare dati generali del bando e autorizzazioni
  utente senza alterare lo stato del workflow di sessione, salvo regole di
  dominio esplicitamente previste.
- **FR-011**: Il sistema DEVE conservare traccia di quando una autorizzazione e
  stata vista attiva l'ultima volta dalla fonte istituzionale.
- **FR-012**: Il sistema DEVE distinguere un errore temporaneo della fonte
  remota da una revoca/non conferma dell'autorizzazione utente.
- **FR-013**: In caso di errore temporaneo della fonte, il sistema DEVE poter
  mostrare dati locali in cache senza revocare automaticamente accessi esistenti.
- **FR-014**: In caso di risposta remota valida che non contiene piu
  l'associazione utente-bando, il sistema DEVE impedire a quell'utente nuove
  operazioni sul bando.
- **FR-015**: Il sistema DEVE normalizzare le email usate per confrontare
  identita autenticata e autorizzazioni sincronizzate.
- **FR-016**: Ogni cambio di stato di una autorizzazione utente-bando DEVE essere
  tracciabile con utente, bando, ruolo, fonte e data.
- **FR-017**: Il sistema DEVE offrire un modo controllato per diagnosticare lo
  stato di autorizzazione di un utente su un bando.
- **FR-018**: La migrazione dei dati esistenti DEVE preservare i bandi, le
  sessioni e le configurazioni gia presenti.
- **FR-019**: La migrazione DEVE creare autorizzazioni iniziali coerenti a
  partire dagli utenti che oggi vedono bandi o sessioni.
- **FR-020**: La migrazione NON DEVE richiedere reinserimento manuale delle
  configurazioni gia salvate.
- **FR-021**: Il sistema DEVE continuare a supportare utenti con piu ruoli sullo
  stesso bando o su bandi diversi.
- **FR-022**: Il sistema DEVE definire una politica esplicita per bandi
  realmente cancellati o ritirati dalla fonte istituzionale, senza confonderli
  con una revoca di accesso del singolo utente.
- **FR-023**: Un bando senza dati operativi puo essere nascosto o archiviato
  quando non e piu confermato dalla fonte, ma questa azione DEVE essere
  distinguibile dalla cancellazione di dati operativi.
- **FR-024**: La documentazione operativa DEVE descrivere il significato degli
  stati di autorizzazione, della cache locale e delle revoche.
- **FR-025**: Il sistema DEVE distinguere chiaramente la visibilita
  amministrativa locale dalla relazione operativa restituita da Selezioni
  Online, usando testi e badge che non assumano automaticamente il ruolo
  `SEGRETARIO`.
- **FR-026**: Un eventuale blocco applicativo limitato al solo ruolo
  `SEGRETARIO` DEVE essere introdotto solo dopo decisione di processo esplicita
  e usando una fonte ruolo attendibile; non deve essere dedotto dalla sola
  presenza del bando in `/openapi/v1/call/commissions`.

### Key Entities *(include if feature involves data)*

- **Bando operativo**: rappresenta il concorso/commissione come oggetto stabile
  del sistema, indipendente dal singolo utente che lo vede.
- **Autorizzazione utente-bando**: relazione sincronizzata dalla fonte
  istituzionale che indica se un utente puo vedere e operare su un bando, con
  ruolo, stato e ultima conferma.
- **Ruolo sul bando**: funzione dell'utente rispetto al bando, ad esempio
  segretario, componente commissione, referente/RDP o ruolo amministrativo.
- **Sync istituzionale**: aggiornamento ricevuto dalla fonte remota che conferma
  bandi e autorizzazioni dell'utente.
- **Revoca/non conferma**: stato in cui un utente non risulta piu autorizzato
  dalla fonte valida per un bando gia noto.
- **Dato operativo del bando**: configurazione bando, sessioni, candidati,
  dispositivi, liste, notifiche e stati workflow collegati al bando.
- **Cache locale**: dati gia acquisiti e mostrabili in assenza temporanea della
  fonte remota, senza trasformare automaticamente l'errore in revoca.
- **Audit accessi**: registrazione dei cambiamenti di autorizzazione e dei
  tentativi consentiti o rifiutati.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nel 100% dei test di revoca, un utente non piu autorizzato perde
  accesso al bando senza cancellazione di configurazione, sessioni o stati
  operativi.
- **SC-002**: Nel 100% dei test di cambio segretario, il nuovo segretario vede
  lo stesso bando con i dati operativi gia presenti.
- **SC-003**: Nel 100% dei test di sync ripetuta con dati invariati, non vengono
  creati duplicati di bando o sessione.
- **SC-004**: Nel 100% dei test con fonte remota temporaneamente non
  disponibile, gli accessi non vengono revocati automaticamente.
- **SC-005**: Nel 100% dei test con risposta remota valida che non contiene piu
  l'utente, le nuove operazioni dell'utente sul bando vengono rifiutate.
- **SC-006**: La dashboard segretario non produce errori di integrita durante
  sync con bandi gia dotati di sessioni operative.
- **SC-007**: Un amministratore o operatore tecnico riesce a capire lo stato di
  autorizzazione di un utente su un bando in meno di 2 minuti.
- **SC-008**: Nessuna configurazione bando gia presente deve essere reinserita
  manualmente dopo la migrazione.
- **SC-009**: I test di autorizzazione coprono almeno i casi: utente attivo,
  utente revocato, nuovo utente autorizzato, utente mai autorizzato e fonte
  remota non disponibile.
- **SC-010**: La documentazione operativa descrive in modo verificabile la
  differenza tra bando operativo, autorizzazione utente, cache locale e revoca.

## Assumptions

- Se una fonte remota valida non restituisce piu un bando per un utente, il caso
  ordinario e che l'utente non sia piu autorizzato a vederlo; non che il bando
  operativo debba essere cancellato.
- Il bando puo continuare a esistere nel sistema se ha configurazioni, sessioni
  o altri dati operativi collegati.
- Le autorizzazioni ordinarie restano determinate dalla fonte istituzionale; non
  e previsto un flusso ordinario di abilitazione manuale da parte di Daniele o di
  altri operatori.
- Un intervento manuale amministrativo puo esistere solo come eccezione
  tracciata per supporto, correzione o emergenza.
- La fonte remota puo fallire o restituire dati parziali; un errore tecnico non
  deve essere trattato automaticamente come revoca.
- La configurazione del bando deve restare riutilizzabile da altri utenti
  autorizzati se cambia il segretario o referente.
- La migrazione puo essere eseguita in modo incrementale, mantenendo compatibile
  il flusso di test fino al completamento della nuova struttura.
