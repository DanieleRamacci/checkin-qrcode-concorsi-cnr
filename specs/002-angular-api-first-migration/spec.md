# Feature Specification: Migrazione API-first e Angular

**Feature Branch**: `migration/angular-api-first`

**Created**: 2026-06-24

**Status**: Implementation in progress — convergence required for legacy parity

**Input**: User description: "Migrare il sistema Check-in CNR Concorsi verso un'architettura API-first con backend Flask stabilizzato, API JSON versionate e frontend Angular separato, senza includere la piattaforma esami futura e senza modificare il branch checkin-dev"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Definire architettura target API-first (Priority: P1)

Il responsabile tecnico deve poter leggere la spec e capire come il sistema
attuale verra trasformato in una piattaforma integrabile senza perdere il
comportamento gia sviluppato.

**Why this priority**: prima di scrivere codice Angular serve una direzione
architetturale chiara, con confini tra backend, API e frontend.

**Independent Test**: leggendo `spec.md`, `plan.md` e `research.md`, un tecnico
deve poter spiegare cosa resta Flask, cosa diventa API, cosa diventa Angular e
cosa resta fuori scope.

**Acceptance Scenarios**:

1. **Given** il branch `checkin-dev` funzionante, **When** si legge la spec,
   **Then** e chiaro che quel branch non viene modificato dalla migrazione.
2. **Given** la richiesta di integrazione futura con altri servizi, **When** si
   legge la spec, **Then** sono identificati API JSON, contratti e service layer.
3. **Given** l'idea futura di piattaforma esami, **When** si legge la spec,
   **Then** risulta esplicitamente fuori scope per questa migrazione.

---

### User Story 2 - Esporre API JSON versionate (Priority: P1)

Un frontend Angular e altri servizi futuri devono poter consumare dati e azioni
del check-in tramite API stabili, senza dipendere da HTML Jinja o frammenti HTMX.

**Why this priority**: Angular deve consumare contratti JSON; senza API stabili
la migrazione sarebbe solo una UI nuova sopra endpoint non pensati per
integrazione.

**Independent Test**: per ogni area core esiste un contratto API: auth/me,
bandi, sessioni, configurazioni, candidati, dispositivi, azioni workflow e
notifiche.

**Acceptance Scenarios**:

1. **Given** un utente autenticato, **When** Angular chiama `/api/v1/me`, **Then**
   riceve identita, ruoli e capability.
2. **Given** un segretario autorizzato, **When** Angular chiama le API sessioni,
   **Then** riceve bandi/sessioni coerenti con la dashboard attuale.
3. **Given** un'azione workflow, **When** Angular invia una richiesta API, **Then**
   il backend valida stato, autorizzazione e ritorna errore JSON uniforme se non
   consentito.

---

### User Story 3 - Migrare UI corrente in Angular per incrementi (Priority: P2)

Gli utenti devono poter usare una UI Angular equivalente ai flussi correnti senza
perdere funzionalita gia disponibili in Jinja/HTMX. L'equivalenza comprende
anche struttura della pagina, gerarchia delle informazioni, testi operativi,
controlli, tabelle, card, sidebar, timeline e feedback visivi: l'introduzione di
Angular non autorizza un redesign non concordato.

**Why this priority**: il valore visibile della migrazione e una UI piu
organizzata e manutenibile, ma deve arrivare dopo i contratti API.

**Independent Test**: ogni schermata migrata e validabile da sola contro gli
stessi dati e stati della versione corrente e viene confrontata con i template
di riferimento elencati in `contracts/legacy-ui-flow-matrix.md`.

**Acceptance Scenarios**:

1. **Given** API auth/bandi/sessioni pronte, **When** si apre Angular, **Then**
   l'utente vede home e dashboard coerenti con i propri ruoli.
2. **Given** una sessione configurabile, **When** si usa Angular, **Then** bando e
   sessione si configurano con la stessa semantica della versione corrente.
3. **Given** una sessione in check-in, **When** si usa Angular, **Then** candidati,
   dispositivi e azioni workflow riflettono lo stato reale del backend.
4. **Given** una pagina o un frammento legacy, **When** la relativa vista Angular
   viene dichiarata migrata, **Then** conserva layout, contenuti, controlli,
   stati visivi e comportamento responsive rilevanti della baseline.
5. **Given** un flusso dipendente dal ruolo o dallo stato, **When** cambia ruolo,
   stato o disponibilita dei dati, **Then** Angular mostra le stesse azioni,
   avvisi e alternative previste dal legacy.

---

### User Story 4 - Governare coesistenza e cutover (Priority: P2)

Il team deve poter far convivere temporaneamente Jinja/HTMX e Angular, scegliendo
quando spostare il traffico senza interrompere il servizio.

**Why this priority**: una migrazione completa in un unico passaggio e rischiosa.
La coesistenza riduce rischio operativo.

**Independent Test**: esiste una strategia documentata per proxy/dev, build,
deploy, fallback e rimozione progressiva delle viste legacy.

**Acceptance Scenarios**:

1. **Given** Angular parziale, **When** una vista non e ancora migrata, **Then** la
   versione Jinja resta disponibile.
2. **Given** un problema in Angular, **When** si disabilita il frontend nuovo,
   **Then** il flusso legacy resta utilizzabile.

---

### User Story 5 - Tracciare fix necessari sul ramo attuale (Priority: P3)

Il team deve sapere quali criticita del branch `checkin-dev` vanno sistemate per
rendere il sistema sicuro e uniforme, anche se saranno implementate in una fase o
spec separata.

**Why this priority**: Angular non risolve problemi backend come autorizzazioni,
debug endpoint, token device e workflow stato.

**Independent Test**: i fix di hardening sono elencati come prerequisiti di
produzione o task separati, non nascosti dentro la sola migrazione UI.

**Acceptance Scenarios**:

1. **Given** la lista criticita attuali, **When** si legge `tasks.md`, **Then**
   sono presenti task per classificarle o risolverle prima del cutover.
2. **Given** la migrazione Angular, **When** una criticita riguarda il backend,
   **Then** e trattata come hardening backend/API e non come problema di UI.

### Edge Cases

- Il branch `checkin-dev` resta intatto e funzionante durante la migrazione.
- Alcuni endpoint attuali restituiscono HTML o frammenti HTMX: Angular non deve
  dipendere da quei formati.
- Il flusso scanner richiede SSO per aprire la pagina e poi usa un device token:
  la migrazione deve preservare questa separazione.
- Il flusso esperto informatico usa il ruolo locale `esperto_informatico` (o
  admin) per autorizzare l'accesso; `email_esperto_remoto` resta configurazione
  operativa/destinatario e non concede permessi.
- Le route debug/log e l'ownership non uniforme del backend sono rischi noti da
  correggere prima di produzione.
- I template e i frammenti in `templates/` sono la baseline di accettazione
  grafica e funzionale. Design Angular Kit puo sostituire l'implementazione dei
  componenti, ma non la struttura o il flusso senza una decisione esplicita.
- Stati di caricamento, vuoto, errore, conferma, polling e blocco durante le
  operazioni fanno parte del comportamento da migrare.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La migrazione MUST avvenire su branch dedicato e non modificare il
  branch `checkin-dev`.
- **FR-002**: La piattaforma esami/Moodle futura MUST restare fuori scope della
  migrazione check-in.
- **FR-003**: Il backend MUST esporre API JSON versionate sotto `/api/v1`.
- **FR-004**: Le API MUST coprire auth/me, ruoli, bandi, sessioni,
  configurazione bando, configurazione sessione, candidati, dispositivi,
  notifiche e azioni workflow.
- **FR-005**: Le API MUST restituire errori JSON uniformi con codice, messaggio e
  dettagli opzionali.
- **FR-006**: Le API MUST applicare autorizzazione uniforme su `session_id` e
  `commission_id`.
- **FR-007**: Le regole di workflow MUST restare nel backend.
- **FR-008**: Angular MUST consumare solo API JSON o asset statici, non frammenti
  HTML HTMX.
- **FR-009**: Angular MUST supportare i flussi correnti: home profili, dashboard,
  bandi/sessioni, configurazione bando, configurazione sessione, gestione
  candidati, dispositivi, scanner e invio liste.
- **FR-010**: La migrazione MUST definire coesistenza temporanea con Jinja/HTMX.
- **FR-011**: La migrazione MUST documentare fix del branch attuale necessari per
  produzione: debug/log, ownership, device token, workflow stato e `.env.example`.
- **FR-012**: La migrazione MUST includere test o checklist per ogni milestone.
- **FR-013**: Le mutazioni API autenticate tramite cookie MUST validare un token
  CSRF associato alla sessione.
- **FR-014**: Il callback OIDC MUST validare state, firma, issuer, audience e
  scadenza del token prima di autorizzare l'utente.
- **FR-015**: La UI Angular MUST mostrare il profilo esperto soltanto a utenti
  con ruolo `esperto_informatico` o `admin_globale`, preservando le
  autorizzazioni backend correnti.
- **FR-016**: Ogni pagina, frammento, route, ruolo e interazione legacy MUST
  essere tracciato in `contracts/legacy-ui-flow-matrix.md` verso API, componente
  Angular e stato di migrazione.
- **FR-017**: Una vista Angular MUST essere dichiarata migrata solo se conserva
  la struttura visiva e informativa rilevante della baseline: header/footer,
  eventuale sidebar, titoli e testi, card, tabelle, filtri, timeline, badge,
  azioni, avvisi e comportamento responsive.
- **FR-018**: Angular MUST preservare la visibilita condizionale e la semantica
  delle azioni per ruolo, modalita operativa e stato della sessione, incluse le
  viste segretario, informatico in sede ed esperto remoto.
- **FR-019**: Angular MUST preservare le interazioni operative legacy, incluse
  sincronizzazione/aggiornamento, polling, overlay di attesa, messaggi di errore
  e conferma, QR di sessione e candidato, scanner tramite fotocamera, reset
  password e download/invio liste.
- **FR-020**: Il dettaglio e la configurazione bando MUST includere i dati e i
  flussi presenti nel legacy, inclusi RDP, componenti commissione, selezione
  esperto, referente e invio della richiesta di configurazione.
- **FR-021**: Le viste amministrative per permessi e log MUST avere una
  controparte Angular protetta oppure essere esplicitamente mantenute come
  fallback legacy al cutover; non possono risultare implicitamente migrate.
- **FR-022**: Ogni vista candidata al cutover MUST superare un confronto
  documentato desktop e mobile e uno scenario end-to-end sul ruolo/stato
  pertinente prima di rimuovere il fallback legacy.

### Key Entities *(include if feature involves data)*

- **API User Context**: identita, email, ruoli e capability dell'utente loggato.
- **Bando DTO**: rappresentazione API di commissione/bando e configurazione
  comune.
- **Sessione DTO**: rappresentazione API di sessione, stato e capability.
- **Candidato DTO**: dati candidato e stato check-in/reset.
- **Dispositivo DTO**: scanner registrato, stato heartbeat, operatore e token
  non esposto.
- **Workflow Action**: comando backend che cambia stato o produce output.
- **Angular Route**: vista frontend mappata a un flusso utente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Esiste una lista task completa e stimabile per migrazione API-first
  e Angular.
- **SC-002**: Ogni area funzionale corrente ha un contratto API target.
- **SC-003**: La migrazione e divisa in milestone indipendenti e validabili.
- **SC-004**: La prima milestone Angular mostra home, profili, bandi e sessioni
  usando API JSON.
- **SC-005**: La parita funzionale check-in e raggiunta senza rimuovere il
  fallback legacy prima del cutover.
- **SC-006**: I fix di sicurezza/uniformita del branch attuale sono tracciati
  come prerequisiti o fase dedicata.
- **SC-007**: Il 100% delle pagine e dei frammenti operativi legacy e mappato
  nella matrice con stato `parziale`, `migrato`, `fallback` o `fuori scope`
  motivato; nessuna riga resta non classificata.
- **SC-008**: Il 100% delle viste dichiarate migrate supera la checklist di
  parita grafica desktop/mobile e non presenta controlli o stati legacy mancanti.
- **SC-009**: I flussi end-to-end di segretario, informatico in sede, esperto e
  scanner completano le transizioni previste senza ricorrere a una pagina legacy,
  salvo fallback esplicitamente approvati.

## Assumptions

- `checkin-dev` e la baseline funzionale corrente.
- Il backend iniziale resta Flask; una riscrittura FastAPI non e inclusa in
  questa migrazione.
- Angular viene introdotto in cartella `frontend/`.
- OIDC resta gestito inizialmente dal backend Flask con session cookie.
- La migrazione completa richiede piu sessioni operative, ma resta interamente
  tracciata da questa spec fino alla parita e al cutover.
- I task completati prima dell'audit di convergenza del 2026-07-03 attestano la
  presenza della struttura o della prima implementazione; non attestano da soli
  la parita grafica e funzionale.
