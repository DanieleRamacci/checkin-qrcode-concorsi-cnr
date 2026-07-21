# Feature Specification: Collaudo manuale per chiusura spec

**Feature Branch**: `009-collaudo-chiusura-spec`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Creare una spec dedicata e collegata alla chiusura delle spec che richiedono test manuali, con una descrizione di test e domande a cui rispondere per decidere se chiudere le spec o aprire fix."

## Purpose

Questa spec definisce il protocollo di collaudo manuale necessario per chiudere
le spec che non possono essere validate solo con test automatici. L'obiettivo e'
avere una traccia ripetibile: ad ogni giro di test l'utente risponde alle
domande previste, allega eventuali evidenze e il team decide se la spec collegata
puo' essere chiusa o se serve un fix.

## Spec collegate

- **006 - Cutover Angular e rimozione flusso legacy**: richiede collaudo end-to-end
  su dominio test, verifica deep link, route legacy, scanner, liste e flussi
  operativi Angular.
- **007 - Accesso profili informatici assegnati**: richiede collaudo con utenti
  admin e non-admin per verificare che ogni profilo apra solo le pagine
  assegnate.
- **008 - Redirect coerente per sessione scaduta**: richiede collaudo del
  comportamento quando token/sessione scadono durante l'uso.
- **003 - Ambiente test/produzione Coolify**: richiede evidenze di login,
  versione deploy visibile e, piu' avanti, validazione produzione.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collaudare profili con utenti reali (Priority: P1)

Un collaudatore accede con utenti diversi, inclusi admin e non-admin, e verifica
che segretario, referente, esperto remoto e informatico in sede vedano solo i
flussi coerenti con il proprio incarico.

**Why this priority**: la separazione dei profili protegge dati e operazioni; i
test automatici coprono la logica, ma serve conferma su identita' reali e dati
di Selezioni Online/configurazioni locali.

**Independent Test**: usare almeno un utente admin, un segretario, un esperto
remoto assegnato, un informatico in sede assegnato e un utente non assegnato;
rispondere alle domande del questionario 007.

**Acceptance Scenarios**:

1. **Given** un utente non-admin non assegnato al profilo sede, **When** prova ad
   aprire la vista informatico in sede, **Then** non vede dati operativi.
2. **Given** un esperto remoto assegnato a un solo bando, **When** apre la
   dashboard esperto, **Then** vede solo quel bando.
3. **Given** un admin apre una vista tecnica non assegnata, **When** la pagina si
   carica, **Then** compare un avviso di accesso amministrativo di supporto.

---

### User Story 2 - Collaudare cutover Angular e assenza legacy (Priority: P1)

Un collaudatore percorre i flussi principali dall'interfaccia Angular e verifica
che non compaiano pagine legacy non previste, salvo endpoint tecnici consentiti.

**Why this priority**: la chiusura del cutover richiede evidenza manuale su
browser, refresh, link profondi, scanner reale e download/invio file.

**Independent Test**: seguire il questionario 006 su dominio test e registrare
per ogni route se il comportamento e' Angular, redirect consentito, endpoint
tecnico o legacy da correggere.

**Acceptance Scenarios**:

1. **Given** un utente autenticato apre Home e le dashboard principali, **When**
   naviga tra i profili, **Then** vede le pagine Angular attese.
2. **Given** un deep link Angular viene aperto o refreshato, **When** il browser
   ricarica la pagina, **Then** la stessa vista torna disponibile senza pagina
   legacy.
3. **Given** lo scanner usa camera reale e QR, **When** registra dispositivo e
   candidato, **Then** il workflow avanza senza ricorrere a pagine legacy.

---

### User Story 3 - Collaudare sessione scaduta e riautenticazione (Priority: P1)

Un collaudatore lascia una pagina aperta o forza una sessione/token non piu'
valida e verifica che il sistema chieda login quando il problema e'
autenticativo, distinguendolo dagli errori Selezioni Online o dai permessi.

**Why this priority**: errori di sessione scaduta possono falsare il collaudo dei
flussi operativi e portare a diagnosi errate su Selezioni Online.

**Independent Test**: eseguire i casi del questionario 008 e indicare se il
sistema fa redirect al login o mostra un messaggio operativo corretto.

**Acceptance Scenarios**:

1. **Given** la sessione non e' piu' valida, **When** l'utente avvia una nuova
   azione protetta, **Then** viene richiesto nuovo login.
2. **Given** Selezioni Online rifiuta un'operazione per permessi reali, **When**
   la sessione utente e' valida, **Then** il messaggio non viene confuso con
   sessione scaduta.

---

### User Story 4 - Decidere chiusura o fix da risposte tracciate (Priority: P2)

Al termine del collaudo, le risposte vengono raccolte in modo omogeneo e portano
a una decisione chiara per ogni spec collegata: chiudere, lasciare aperta o
aprire un fix specifico.

**Why this priority**: senza criteri espliciti, i test manuali restano
conversazioni non confrontabili tra una sessione e l'altra.

**Independent Test**: compilare la matrice di decisione del questionario e
verificare che ogni risposta negativa abbia una conseguenza chiara.

**Acceptance Scenarios**:

1. **Given** tutte le risposte critiche sono positive, **When** si rivede la
   matrice, **Then** la spec collegata puo' essere proposta per chiusura.
2. **Given** una risposta critica e' negativa, **When** si rivede la matrice,
   **Then** viene indicato il fix o il nuovo task da aprire.

### Edge Cases

- Utente reale ha piu' ruoli contemporaneamente, ad esempio admin e segretario.
- Utente non-admin e' membro commissione ma non esperto/sede.
- Bando configurato parzialmente, senza esperto remoto o senza informatico sede.
- Dati aggiornati in Selezioni Online ma non ancora sincronizzati localmente.
- Browser con cache o tab aperte prima del nuovo deploy.
- Versione nel footer non aggiornata rispetto al commit atteso.
- Test interrotto da errore esterno di Selezioni Online.
- Camera o permessi browser impediscono il collaudo scanner.
- Sessione scaduta durante una mutazione gia' iniziata.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il protocollo DEVE elencare per ogni spec collegata quali scenari
  manuali sono necessari per proporre la chiusura.
- **FR-002**: Il protocollo DEVE includere domande con risposta attesa per utenti
  admin e non-admin.
- **FR-003**: Il protocollo DEVE distinguere risultati `PASS`, `FAIL`,
  `BLOCCATO` e `NON TESTATO`.
- **FR-004**: Ogni `FAIL` DEVE richiedere descrizione del comportamento osservato,
  utente usato, URL e, se disponibile, screenshot o log.
- **FR-005**: Ogni `BLOCCATO` DEVE indicare la causa esterna o il dato mancante
  che impedisce la decisione.
- **FR-006**: La chiusura di una spec collegata DEVE richiedere esito positivo
  degli scenari critici indicati nel questionario.
- **FR-007**: Il protocollo DEVE registrare la versione applicativa visibile nel
  footer prima di iniziare il collaudo.
- **FR-008**: Il protocollo DEVE prevedere test con almeno un utente non-admin
  non assegnato, per verificare i blocchi di autorizzazione.
- **FR-009**: Il protocollo DEVE prevedere test con admin globale, per verificare
  che l'accesso di supporto sia distinguibile dall'assegnazione operativa.
- **FR-010**: Il protocollo DEVE produrre una decisione finale per ogni spec
  collegata: chiudere, mantenere aperta, o aprire fix.

### Key Entities

- **Sessione di collaudo**: insieme di prove manuali eseguite su una versione
  applicativa identificata.
- **Risposta di collaudo**: esito puntuale associato a domanda, utente, URL e
  comportamento osservato.
- **Spec collegata**: spec la cui chiusura dipende da una o piu' risposte di
  collaudo manuale.
- **Decisione di chiusura**: stato finale proposto dopo il collaudo per una spec
  collegata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Il 100% delle spec collegate ha almeno una sezione dedicata nel
  questionario manuale.
- **SC-002**: Il 100% degli scenari critici di autorizzazione include almeno un
  utente non-admin.
- **SC-003**: Ogni risposta negativa produce una classificazione chiara tra fix
  applicativo, problema dati/configurazione o blocco esterno.
- **SC-004**: La decisione di chiusura per 006, 007, 008 e 003 e' tracciabile
  dalle risposte raccolte.
- **SC-005**: Prima di iniziare i test, il collaudatore registra versione
  applicativa, ambiente e data del collaudo.

## Assumptions

- Il collaudo principale avviene sul dominio test prima della produzione.
- Gli utenti reali disponibili includono almeno admin globale, segretario,
  esperto remoto assegnato, informatico in sede assegnato e un utente non
  assegnato.
- Le risposte del questionario possono essere fornite in chat e poi riportate
  nella documentazione/spec pertinente.
- Se un test richiede modifica dati in Selezioni Online, il collaudatore segnala
  esattamente quando la modifica e' stata fatta e quando e' stato eseguito il
  nuovo test.
