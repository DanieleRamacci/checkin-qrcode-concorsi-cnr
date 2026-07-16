# Feature Specification: Cutover Angular e rimozione flusso legacy

**Feature Branch**: `006-angular-cutover-legacy-removal`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Procedere all'eliminazione del flusso legacy: lavorare solo con Angular per il frontend, capire cosa manca da migrare, aggiungere un badge legacy nelle pagine HTML legacy per riconoscerle subito, e chiarire se la pagina gestione concorso/sessione specifica e' ancora legacy o Angular."

## Implementation Notes

### Session 2026-07-15

- Prima tranche implementata: gli ingressi legacy principali che servivano HTML
  utente vengono reindirizzati alla rotta della nuova interfaccia.
- Mapping applicato:
  - `/dashboard/segretario` -> `/bandi`
  - `/sessioni?commission_id=...` -> `/bandi/{commission_id}/sessioni`
  - `/gestione-concorso/{session_id}` -> `/sessioni/{session_id}`
  - `/dispositivi/{session_id}` -> `/sessioni/{session_id}/dispositivi`
  - `/device-link?session_id=...&token=...` -> `/scanner?sessionId=...&token=...`
  - `/bando/{commission_id}/configura` -> `/bandi/{commission_id}/config`
  - `/bando/{commission_id}/dettaglio` -> `/bandi/{commission_id}/detail`
  - `/user` -> `/`
- Il parametro post-login `next` ora normalizza questi URL storici verso la
  destinazione nuova, evitando che un bookmark legacy aperto da utente non
  autenticato rientri nella UI vecchia dopo OIDC.
- Il proxy pubblico del frontend non inoltra piu al backend i prefissi HTML
  legacy `dashboard`, `sessione`, `gestione-concorso`, `admin`, `static`,
  `frammenti`, `dispositivi` e `device-link`; restano proxati solo API,
  login/logout/callback e file tecnici QR/PDF.
- Le pagine HTML legacy ancora renderizzabili durante la transizione mostrano il
  badge `LEGACY HTML`, incluso `scanner.html`, `static/user.html` e
  `static/sessioni-temp.html`.
- Verifiche automatiche eseguite:
  - backend: `86 passed`
  - frontend: `30 passed`
  - build produzione frontend: superata
- Restano da validare dopo deploy: deep link autenticati sul dominio test,
  flusso scanner con camera reale, download/invio liste effettivi,
  reset password sede/esperto e assenza del badge legacy nei percorsi ordinari.

### Decisione 2026-07-16 - ingresso Informatico in sede

- L'informatico in sede non ha un login separato: accede con SSO CNR ordinario.
- La Home deve esporre una card dedicata "Informatico in sede" che apre
  `/bandi?mode=sede`, cosi il flusso e' collaudabile senza URL manuali.
- Il "reset password" citato nella checklist riguarda i candidati, non la
  password o l'autenticazione dell'informatico.
- Nella gestione sessione, la modalita `sede` deve mostrare la vista per
  segnare/rimuovere le richieste di reset password dei candidati; la modalita
  `esperto` resta quella che segna i reset eseguiti.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operatore usa solo la nuova interfaccia (Priority: P1)

Un segretario, referente, esperto informatico o informatico in sede accede
all'applicazione e completa i propri flussi operativi senza essere mai portato
su pagine HTML legacy.

**Why this priority**: il cutover ha valore solo se l'esperienza ordinaria non
dipende piu da pagine vecchie e non crea ambiguita tra due frontend.

**Independent Test**: da un browser autenticato aprire home, bandi, sessioni,
gestione sessione, dispositivi, scanner, amministrazione e referenti; ogni
pagina mostrata deve appartenere alla nuova interfaccia e nessun badge legacy
deve comparire.

**Acceptance Scenarios**:

1. **Given** un segretario autenticato, **When** entra come segretario e apre una
   sessione specifica, **Then** vede la gestione sessione nella nuova
   interfaccia.
2. **Given** un utente con un link storico a una pagina legacy, **When** apre il
   link o viene reindirizzato dopo login, **Then** arriva alla pagina
   equivalente nella nuova interfaccia oppure riceve un messaggio di percorso non
   piu disponibile.
3. **Given** un amministratore che ricarica una pagina admin della nuova
   interfaccia, **When** il browser richiede direttamente quell'URL, **Then** non
   viene servita la vecchia pagina amministrativa.

---

### User Story 2 - Validazione dei flussi rimasti prima dello spegnimento (Priority: P1)

Il responsabile del collaudo verifica i flussi ancora non chiusi nella checklist
di cutover e puo decidere con evidenza se le pagine legacy possono essere
spente.

**Why this priority**: alcune aree hanno una controparte nuova ma richiedono
ancora validazione manuale o confronto finale; spegnere il legacy senza questa
evidenza rischia regressioni operative.

**Independent Test**: completare la checklist di cutover su utenti reali o
sessioni di test, includendo gestione concorso/sessione specifica, candidati,
QR, liste, reset password sede/esperto, scanner e amministrazione.

**Acceptance Scenarios**:

1. **Given** una sessione di test in stato iniziale, **When** il segretario
   completa il flusso fino all'invio liste nella nuova interfaccia, **Then** non
   usa pagine legacy e gli stati avanzano correttamente.
2. **Given** un informatico in sede autenticato via SSO CNR, **When** entra
   dalla Home e gestisce le richieste di reset password dei candidati, **Then**
   la nuova interfaccia copre ricerca, filtri e mutazioni richieste senza
   richiedere una login separata.
3. **Given** un candidato con QR e una sessione attiva, **When** scanner e
   check-in vengono eseguiti, **Then** la nuova interfaccia copre associazione,
   scansione, conferma e disassociazione senza fallback legacy.

---

### User Story 3 - Pagine legacy evidenti durante la transizione (Priority: P2)

Durante il periodo prima dello spegnimento completo, ogni pagina HTML legacy
ancora raggiungibile mostra un badge visibile che indica chiaramente che non si
sta usando la nuova interfaccia.

**Why this priority**: il badge permette agli utenti e al team di intercettare
subito percorsi rimasti vecchi, riducendo falsi collaudi e segnalazioni ambigue.

**Independent Test**: aprire tutte le pagine HTML legacy ancora raggiungibili e
verificare che il badge sia visibile sopra il contenuto; aprire le pagine della
nuova interfaccia e verificare che il badge non compaia.

**Acceptance Scenarios**:

1. **Given** una pagina HTML legacy raggiunta direttamente, **When** viene
   renderizzata, **Then** mostra un badge "LEGACY HTML" ben visibile.
2. **Given** una pagina della nuova interfaccia, **When** viene renderizzata,
   **Then** non mostra alcun badge legacy.

---

### User Story 4 - Route legacy governate o rimosse (Priority: P2)

Il team tecnico puo consultare un inventario completo degli URL legacy e sapere
per ciascuno se viene reindirizzato, bloccato, mantenuto solo per sviluppo o
rimosso.

**Why this priority**: senza inventario e decisione per ogni URL, il legacy puo
restare raggiungibile per errore tramite bookmark, redirect post-login,
refresh, proxy o link esterni.

**Independent Test**: eseguire un controllo su tutti gli URL legacy noti e
verificare che ciascuno rispetti la disposizione approvata.

**Acceptance Scenarios**:

1. **Given** l'inventario degli URL legacy, **When** viene eseguita la verifica,
   **Then** ogni URL ha una destinazione nuova, un blocco esplicito o una
   motivazione di mantenimento limitata.
2. **Given** un URL legacy senza equivalente diretto, **When** un utente lo
   apre, **Then** riceve una risposta comprensibile e non una pagina vecchia
   non marcata.

### Edge Cases

- Un utente ha un bookmark a `/dashboard/segretario`.
- Un utente ha un bookmark a `/sessioni?commission_id=...`.
- Un utente ha un bookmark a `/gestione-concorso/<session_id>`.
- Un utente apre o ricarica `/admin/permessi` o `/admin/logs`.
- Il login conserva un parametro `next` che punta a un URL storico.
- Un link esterno o QR punta a un percorso storico necessario alla registrazione
  dispositivo.
- Un endpoint che restituisce file o PDF deve restare disponibile senza
  diventare una pagina HTML legacy.
- Una pagina di debug deve restare accessibile solo in sviluppo o ad
  amministratori autorizzati.
- Un percorso legacy non ha abbastanza dati nell'URL per costruire la
  destinazione nuova equivalente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il sistema DEVE avere un inventario completo delle pagine e route
  HTML legacy ancora raggiungibili dagli utenti.
- **FR-002**: Ogni pagina HTML legacy ancora renderizzata DEVE mostrare un badge
  visibile "LEGACY HTML".
- **FR-003**: Le pagine della nuova interfaccia NON DEVONO mostrare il badge
  legacy.
- **FR-004**: Gli utenti ordinari NON DEVONO poter completare flussi operativi
  tramite pagine HTML legacy dopo il cutover.
- **FR-005**: Gli URL storici con equivalente nella nuova interfaccia DEVONO
  reindirizzare alla pagina equivalente, conservando il contesto necessario.
- **FR-006**: Gli URL storici senza equivalente diretto DEVONO essere bloccati o
  sostituiti da un messaggio chiaro, senza mostrare UI legacy.
- **FR-007**: Il parametro post-login che punta a URL storici DEVE essere
  normalizzato verso la nuova destinazione o rifiutato se non sicuro.
- **FR-008**: La pagina storica di gestione concorso/sessione specifica DEVE
  essere sostituita dalla gestione sessione della nuova interfaccia.
- **FR-009**: Le aree amministrative raggiunte con refresh o link diretto DEVONO
  restare nella nuova interfaccia, salvo endpoint dati o file esplicitamente
  esclusi.
- **FR-010**: I flussi candidati, QR candidato, liste, download, invio liste,
  reset password sede/esperto, dispositivi, scanner, notifiche e log admin
  DEVONO essere verificati nella nuova interfaccia prima dello spegnimento.
- **FR-016**: La Home della nuova interfaccia DEVE esporre l'ingresso
  "Informatico in sede" verso `/bandi?mode=sede`, senza trattarlo come login
  diverso dall'SSO ordinario.
- **FR-017**: Il flusso reset password in modalita `sede` DEVE essere descritto
  come gestione delle richieste dei candidati, distinguendolo dal reset
  completato in modalita `esperto`.
- **FR-011**: Eventuali endpoint tecnici non visuali ancora necessari, come
  download, QR/PDF, login, callback, healthcheck e API, DEVONO restare
  disponibili senza esporre pagine HTML legacy agli utenti ordinari.
- **FR-012**: Le pagine debug o diagnostiche DEVONO essere rimosse dal percorso
  utente ordinario o limitate a sviluppo/amministratori autorizzati.
- **FR-013**: Ogni fallback legacy mantenuto temporaneamente DEVE avere una
  motivazione, un proprietario, una condizione di rimozione e una verifica di
  sicurezza.
- **FR-014**: La checklist di cutover DEVE indicare esplicitamente quali flussi
  sono validati, quali sono bloccanti e quali sono esclusi dal percorso utente.
- **FR-015**: Il sistema DEVE permettere di verificare automaticamente che le
  principali route utente non servano pagine HTML legacy.

### Key Entities

- **Legacy Entry Point**: URL o pagina storica che puo servire HTML legacy,
  inclusi link diretti, redirect post-login e percorsi proxati.
- **Cutover Decision**: disposizione associata a un entry point legacy:
  reindirizzare, bloccare, mantenere temporaneamente, limitare a sviluppo/admin o
  rimuovere.
- **Legacy Marker**: segnale visivo mostrato sulle pagine HTML legacy ancora
  renderizzate durante la transizione.
- **Validation Evidence**: prova manuale o automatica che un flusso e'
  utilizzabile nella nuova interfaccia senza fallback legacy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Il 100% degli URL utente principali apre la nuova interfaccia,
  reindirizza alla nuova interfaccia o risponde con un blocco esplicito.
- **SC-002**: Il 100% delle pagine HTML legacy ancora renderizzabili mostra il
  badge legacy.
- **SC-003**: Zero pagine HTML legacy non marcate sono raggiungibili durante il
  collaudo autenticato.
- **SC-004**: I flussi segretario, referente, informatico in sede, esperto,
  scanner e admin sono completati nella nuova interfaccia e documentati nella
  checklist di cutover.
- **SC-005**: Refresh e deep link delle pagine della nuova interfaccia non
  portano a pagine legacy.
- **SC-006**: Ogni fallback legacy rimasto dopo il cutover e' limitato a un uso
  tecnico o amministrativo documentato.

## Assumptions

- L'autenticazione esistente resta valida e il cutover non cambia il metodo di
  login.
- La nuova interfaccia e' gia disponibile per i flussi principali, ma richiede
  verifica finale e governo degli URL storici.
- Alcuni endpoint non visuali continueranno a essere serviti dal backend per API,
  login, file, QR, healthcheck e integrazioni.
- Il badge legacy e' una misura temporanea di transizione, non il risultato
  finale desiderato.
- La rimozione fisica dei template puo avvenire dopo che gli URL utente sono
  stati reindirizzati o bloccati e la checklist e' completa.
