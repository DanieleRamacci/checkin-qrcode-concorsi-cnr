# Feature Specification: Baseline Ufficiale Progetto Esistente

**Feature Branch**: `001-baseline-progetto`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "Documentare lo stato attuale del progetto Check-in CNR Concorsi come baseline ufficiale Spec Kit, includendo flussi, dati, API, rischi e piano di migrazione Angular. La baseline deve partire dal working tree corrente, incluse le modifiche locali non committate che rappresentano la versione attuale."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comprendere il prodotto esistente (Priority: P1)

Un responsabile tecnico o funzionale deve poter leggere la baseline e capire cosa
fa oggi il sistema Check-in CNR Concorsi senza ricostruire il comportamento solo
dal codice.

**Why this priority**: e il valore minimo della baseline. Prima di pianificare
migliorie o migrazioni serve una fotografia condivisa dello stato attuale.

**Independent Test**: una persona che non ha sviluppato il progetto deve poter
ricostruire attori, flussi principali, stati sessione e responsabilita dei
moduli leggendo solo gli artefatti in `specs/001-baseline-progetto/`.

**Acceptance Scenarios**:

1. **Given** il repository esistente, **When** un tecnico legge la spec, **Then**
   identifica attori, flussi segretario, scanner, esperto/sede e admin.
2. **Given** una sessione di concorso, **When** un tecnico consulta la baseline,
   **Then** trova gli stati ammessi e l'ordine attuale del workflow.
3. **Given** una domanda su cosa e gia sviluppato, **When** si consulta la
   baseline, **Then** si distingue lo stato as-is da proposte future.

---

### User Story 2 - Validare architettura, dati e contratti attuali (Priority: P2)

Un manutentore deve poter localizzare entry point, blueprint, route, tabelle,
integrazioni e file operativi per intervenire sul progetto senza introdurre
regressioni involontarie.

**Why this priority**: la manutenzione e la futura migrazione Angular richiedono
una mappa tecnica affidabile del sistema esistente.

**Independent Test**: partendo dagli artefatti di piano, data model e contratti,
un manutentore deve poter risalire ai file reali del repository e verificare che
le aree descritte esistano.

**Acceptance Scenarios**:

1. **Given** una route Flask, **When** si consulta il contratto della baseline,
   **Then** si capisce area funzionale, metodo, path e scopo.
2. **Given** una tabella PostgreSQL, **When** si consulta il data model, **Then**
   si capisce ruolo della tabella e relazioni principali.
3. **Given** una integrazione esterna, **When** si consulta il piano, **Then** si
   capisce dove e gestita e quale rischio introduce.

---

### User Story 3 - Preparare evoluzione e migrazione senza mischiare fasi (Priority: P3)

Il team deve poter separare baseline as-is, gap tecnici e future spec di
miglioramento o migrazione Angular.

**Why this priority**: il progetto e gia iniziato; trasformarlo in Spec Kit non
deve produrre una riscrittura implicita o una lista confusa di modifiche.

**Independent Test**: leggendo tasks e research, il team deve trovare quali
attivita sono solo documentali, quali sono gap da pianificare dopo e quale sara
il percorso consigliato per Angular.

**Acceptance Scenarios**:

1. **Given** un miglioramento tecnico individuato, **When** si consulta la
   baseline, **Then** e classificato come gap o lavoro successivo, non come parte
   della baseline.
2. **Given** la richiesta di migrazione Angular, **When** si consulta la
   baseline, **Then** emerge che la migrazione richiede una spec separata e API
   JSON intermedie.

### Edge Cases

- Il codice contiene modifiche locali non committate: la baseline deve dichiarare
  che fotografa il working tree al momento della ricognizione, non una release
  immutabile.
- Alcuni endpoint restituiscono HTML, frammenti HTMX o JSON: la baseline deve
  esplicitare questa coesistenza senza forzare un contratto unico inesistente.
- Il modulo prove/esami Moodle e presente in schema e documentazione, ma non va
  confuso con il workflow check-in principale.
- La configurazione e divisa tra dati comuni di bando e dati specifici di
  sessione: le future modifiche devono preservare questa distinzione.
- Alcuni dati di bando vengono popolati best-effort da JConon/OpenAPI e possono
  richiedere completamento manuale.
- Le route debug/log possono esistere o essere parzialmente registrate: la
  baseline deve segnalarle come rischio di sicurezza da verificare.
- La futura migrazione Angular non deve modificare automaticamente la baseline
  as-is.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La baseline MUST descrivere lo scopo corrente del sistema e il suo
  perimetro funzionale.
- **FR-002**: La baseline MUST identificare gli attori applicativi correnti:
  utente CNR, segretario, dispositivo scanner, esperto/sede e admin globale.
- **FR-003**: La baseline MUST descrivere i flussi principali: autenticazione,
  gestione commissioni/sessioni, configurazione, import candidati, collegamento
  dispositivi, check-in, generazione liste, invio liste, notifiche e fasi esame.
- **FR-003a**: La baseline MUST distinguere configurazione di bando
  (`bando_config`) e configurazione di sessione (`sessione_config`).
- **FR-003b**: La baseline MUST documentare che RDP, componenti commissione e
  metadati bando possono essere recuperati da JConon/OpenAPI in modalita
  best-effort.
- **FR-004**: La baseline MUST riportare la macchina a stati sessione definita
  dal codice corrente.
- **FR-005**: La baseline MUST mappare lo stack tecnico e gli entry point del
  progetto.
- **FR-006**: La baseline MUST inventariare le route principali Flask e
  distinguerle per area funzionale.
- **FR-007**: La baseline MUST documentare le entita dati principali e le
  relazioni definite nello schema PostgreSQL.
- **FR-008**: La baseline MUST identificare integrazioni esterne e punti di
  rischio operativo.
- **FR-009**: La baseline MUST includere una checklist di validazione manuale
  per confermare la coerenza tra documentazione e codice.
- **FR-010**: La baseline MUST separare esplicitamente lo stato as-is dai
  miglioramenti futuri.
- **FR-011**: La baseline MUST indicare che la migrazione Angular richiede una
  spec successiva e non fa parte dell'implementazione della baseline.
- **FR-012**: La baseline MUST essere collocata nella struttura ufficiale Spec Kit
  sotto `specs/001-baseline-progetto/`.

### Key Entities *(include if feature involves data)*

- **Commissione**: raggruppamento esterno sincronizzato e associato a un utente
  CNR; collega sessioni di concorso e configurazioni di bando.
- **Configurazione bando**: dati comuni a tutte le sessioni del bando, inclusi
  referente, esperto remoto, segretario, durata prova, RDP e componenti
  commissione.
- **Configurazione sessione**: dati specifici della singola sessione, inclusi
  informatico in sede e data accesso piattaforma.
- **Sessione**: unita operativa del check-in; contiene dati di data/luogo,
  stato corrente, candidati, dispositivi, notifiche e liste.
- **Candidato**: persona importata per una sessione; include dati anagrafici,
  documento, stato check-in e reset password.
- **Dispositivo**: client scanner registrato su una sessione, identificato da
  `device_token` e heartbeat.
- **Lista generata**: output XLSX/CSV prodotto dopo check-in e registrato per
  invio o uso Moodle.
- **Notifica**: evento o messaggio associato alla sessione.
- **Ruolo utente**: autorizzazione locale come `admin_globale` o
  `esperto_informatico`.
- **Prova**: entita del modulo prove/esami Moodle, distinta ma collegata al
  dominio operativo degli esami.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tutti gli artefatti ufficiali richiesti dalla baseline esistono in
  `specs/001-baseline-progetto/`: `spec.md`, `plan.md`, `research.md`,
  `data-model.md`, `quickstart.md`, `contracts/` e `tasks.md`.
- **SC-002**: La checklist requisiti della spec non contiene placeholder o
  marker di chiarimento irrisolti.
- **SC-003**: La mappa route copre le aree auth, dashboard/sessioni, azioni,
  candidati, dispositivi, notifiche, admin e debug.
- **SC-004**: Il data model documenta tutte le tabelle create in `init_db.py` al
  momento della ricognizione.
- **SC-005**: La documentazione distingue chiaramente baseline as-is, gap da
  correggere e futura migrazione Angular.

## Assumptions

- La baseline fotografa il working tree locale al 2026-06-24, incluse le
  modifiche applicative non committate considerate parte della versione attuale.
- Non viene eseguita validazione runtime contro OIDC, API CNR, SMTP o Moodle.
- Non viene implementata alcuna modifica applicativa nella feature baseline.
- La cartella `docs/spec-kit/`, se presente, e materiale preparatorio e non fonte
  canonica Spec Kit.
- Le future modifiche applicative saranno gestite con nuove feature directory in
  `specs/`.
