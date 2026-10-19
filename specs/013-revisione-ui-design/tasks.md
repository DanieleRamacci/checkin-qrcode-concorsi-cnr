---

description: "Task list for feature 013 – Revisione dell'interfaccia guidata dal prossimo passo"
---

# Tasks: Revisione dell'interfaccia guidata dal "prossimo passo"

**Input**: Design documents from `specs/013-revisione-ui-design/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Riferimento visivo**: [docs/design-revisione/](../../docs/design-revisione/README.md), aggiornato al 19/10/2026: schede in `04-schermate.md` (P01–P22, P09a–P09e), prototipo in `prototipo/`, immagini in `screenshot/`, componenti in `03-componenti.md`, requisiti API in `05-backend.md`, aree escluse in `06-da-completare.md`.

**Tests**: inclusi, perché il piano li prevede (research R16): pytest per backend, Vitest (`ng test`) per frontend.

**Organization**: task raggruppati per user story; ogni fase è consegnabile da sola.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo (file diversi, nessuna dipendenza aperta)
- **[Story]**: user story di riferimento (US1…US8)
- Backend nella radice del repository (`routes/`, `utils/`, `tests/`); frontend in `frontend/src/`
- Regola per le aree non ancora disegnate (`06-da-completare.md`, "Altre schermate"): solo stili e linguaggio comuni, nessun cambio di flusso e testi

---

## Phase 1: Setup

**Purpose**: stili condivisi e scelte di base

- [x] T001 Copia `docs/design-revisione/stili/proposta.css` (versione del 19/10/2026, sha256 `8c8bbb28…`) senza modifiche in `frontend/src/styles/_app.scss` e importalo in `frontend/src/styles.scss` dopo `bootstrap-italia.scss`; togli da `frontend/src/styles.scss` la regola `body { color: #17324d; background: #fff; }` sostituita dal foglio, mantieni `:focus-visible` e `scroll-behavior`
- [x] T002 [P] Verifica se `it-header` di design-angular-kit 21.2 permette la sola fascia slim con navigazione e zona destra (prova in `frontend/src/app/layout/app-layout.component.ts`) e registra la scelta (kit o componente proprio con le classi del prototipo) nella riga "Header a una fascia" di R3 in `specs/013-revisione-ui-design/research.md`
- [x] T003 [P] Esegui `npm run build:production` in `frontend/` e verifica che il bundle iniziale resti entro i budget di `frontend/angular.json` (avviso 2.25 MB, errore 2.5 MB)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: elementi condivisi da tutte le schermate

**⚠️ CRITICAL**: nessuna user story inizia prima della fine di questa fase

- [x] T004 Crea `frontend/src/app/shared/session-states.ts`: per i 12 codici di `utils/stato.py` etichetta e fase (1 Preparazione, 2 Check-in, 3 Liste, 4 Esame) e, per i profili `segretario`, `sede`, `esperto`, titolo del pannello e azione principale come in `specs/013-revisione-ui-design/contracts/ui-session-states.md`; codice sconosciuto → "Stato non riconosciuto" senza azioni; esporta le etichette leggibili dei ruoli (Segretario, Referente, Informatico in sede, Esperto remoto, Amministratore) e la traduzione dei codici di ruolo (`esperto_informatico` → "Esperto remoto", `admin_globale` → "Amministratore")
- [x] T005 [P] Test in `frontend/src/app/shared/session-states.spec.ts`: 12 stati su 4 fasi, nessuna etichetta uguale al codice tecnico, al più un'azione principale per stato e profilo, fallback per codice sconosciuto, traduzione dei ruoli
- [x] T006 Estendi `frontend/src/app/core/models/api.models.ts` secondo `specs/013-revisione-ui-design/contracts/api-changes.md`: `next_session` (oppure `null`) negli elementi di `/bandi`; `checkin_at: string | null` e `checkin_source: 'scanner' | 'tabella' | null` sul candidato e sulla verifica scanner; `profiles` sul contesto utente; `history: { state, at, actor_role }[]` su `WorkflowState`; tipi di `/scanner/session-summary`, `/scanner/search-candidates`, `/scanner/candidate-note`, `/sessioni/assegnate`; `details.current_state` nel rifiuto `checkin_not_active`
- [x] T007 Servizio del profilo attivo in `frontend/src/app/core/profile.service.ts`: profilo attivo (`segretario` | `referente` | `sede` | `esperto` | `admin`) come signal, derivato dalla rotta (`mode`) o dalla scelta profilo, ultimo profilo usato salvato nel browser dentro `try/catch`, etichetta per "Profilo: …"
- [x] T008 Header a una fascia in `frontend/src/app/layout/app-layout.component.ts` secondo l'esito di T002: "CNR · Check-in Concorsi"; navigazione del profilo attivo da T007 (segretario: Home, I miei concorsi, Scanner; informatico in sede: Home, Le mie sessioni, Scanner; esperto remoto: Home, Le mie sessioni; referente: Home, I bandi di cui sei referente; amministratore: Home, Amministrazione); destinazioni definite in un solo punto di `frontend/src/app/core/profile.service.ts` con `/le-mie-sessioni` e `/admin`; pulsante profilo verso `/`; menu utente, voce Menu sotto 992px, footer scuro e classi `app-header`, `app-brand`, `app-profile-switch`
- [x] T009 [P] Componente `app-actions-panel` in `frontend/src/app/shared/actions-panel.component.ts` come in `docs/design-revisione/03-componenti.md`: input `etichetta`, `titolo`, `nota`, `inCorso`, `messaggioInCorso`; `ng-content` per contenuto e `[azione]` per il pulsante; con `inCorso` mostra `it-progress-bar` indeterminata e "Non chiudere la pagina" con `role="status"`; classi `app-actions-card`, `app-actions-head`, `app-actions-sub`, `app-next-footer`, `app-longop`
- [x] T010 [P] Componente `app-pager` in `frontend/src/app/shared/pager.component.ts`: testo "[Etichetta] 1–10 di N", `it-pagination`, selettore 10/25/50, paginazione lato client, output di pagina e dimensione
- [x] T011 [P] Componente filtri a chip in `frontend/src/app/shared/filter-chips.component.ts`: pulsanti `rounded-pill` con `aria-pressed`, etichetta "Nome · N", un solo filtro attivo alla volta, filtro predefinito configurabile
- [x] T012 [P] Test in `frontend/src/app/shared/actions-panel.component.spec.ts`, `frontend/src/app/shared/pager.component.spec.ts`, `frontend/src/app/shared/filter-chips.component.spec.ts`, `frontend/src/app/core/profile.service.spec.ts` (anche con archiviazione del browser non disponibile)

**Checkpoint**: stili, header e componenti condivisi pronti

---

## Phase 3: User Story 1 - Il segretario sa sempre cosa fare adesso nella sessione (Priority: P1)

**Goal**: pagina sessione con testata, timeline a 4 fasi con ora e ruolo, pannello "Azioni · cosa fare adesso" per i 12 stati, dispositivi dentro la sessione, candidati sempre nello stesso posto, file sempre scaricabili (P05–P07, P10, P10b, P11)

**Independent Test**: portare una sessione di prova da "Sessione creata" a "Liste inviate" con un segretario alla prima esperienza (quickstart scenari 1–4)

### Tests for User Story 1

- [x] T013 [P] [US1] Test in `tests/api/test_candidati_liste_api.py`: toggle verso presente imposta `checkin_at` e `checkin_source = "tabella"`; l'annullamento li azzera; l'elenco candidati li espone come ISO 8601 o `null`
- [x] T014 [P] [US1] Test in `tests/api/test_devices_scanner_api.py`: `/scanner/checkin-candidate` imposta `checkin_source = "scanner"` e non sovrascrive ora e origine se il candidato era già presente; `POST /sessioni/<id>/devices/<device_id>/disconnect` scollega un dispositivo della sessione e risponde 404 per un dispositivo di un'altra sessione o già scollegato
- [x] T015 [P] [US1] Test in `tests/api/test_workflow_api.py`: `/sessioni/<id>/state` include `history` ordinato dal più vecchio con `state`, `at`, `actor_role` tra Segretario, Informatico in sede, Esperto remoto, Amministratore, Sistema; nessuna email nella risposta

### Implementation for User Story 1

- [x] T016 [US1] Aggiungi `("checkin_at", "TIMESTAMP")` e `("checkin_source", "TEXT")` a `CANDIDATI_COLUMNS` in `utils/schema.py` e alla `CREATE TABLE candidati` in `init_db.py`; valori ammessi di `checkin_source`: `scanner`, `tabella`, null
- [x] T017 [US1] In `utils/candidati_service.py`: `toggle_candidate_checkin` imposta `checkin_at = NOW()` e `checkin_source = 'tabella'` quando la presenza diventa vera e li azzera quando torna falsa (resta valido solo in `checkin_avviato`); `list_candidates` e `_get_candidate` selezionano e serializzano i due campi
- [x] T018 [US1] In `utils/scanner_service.py::checkin_candidate` imposta `checkin_at = NOW()` e `checkin_source = 'scanner'` solo se il candidato non era già presente
- [x] T019 [US1] In `utils/workflow_service.py::describe_workflow` aggiungi `history` da `utils/stato.py::get_storia_stati` con `actor_role` calcolato con la regola di `utils/notifications.py::_author_role` e tradotto in etichetta completa ("Inf. sede" → "Informatico in sede", "Inf. remoto" → "Esperto remoto", "Admin" → "Amministratore", "Segretario", "Sistema"); non esporre l'utente
- [x] T020 [US1] Aggiungi `disconnect_device_by_id(session_id, device_id)` in `utils/devices_service.py` e la rotta `POST /sessioni/<session_id>/devices/<device_id>/disconnect` con `session_access_required()` in `routes/api_v1/devices.py` (contracts/api-changes.md §9)
- [x] T021 [P] [US1] Componente `app-session-header` in `frontend/src/app/features/gestione-sessione/session-header.component.ts`: breadcrumb I miei concorsi / Concorso / Sessione, titolo, data, ora, luogo, concorso, badge "Stato: [etichetta]", badge "Stai lavorando come …" per profili diversi dal segretario, avviso vista di supporto per l'admin; classi `app-session-head`, `app-state-pill`, `app-state-pill--role`
- [x] T022 [P] [US1] Componente `app-state-timeline` in `frontend/src/app/features/gestione-sessione/state-timeline.component.ts` al posto di `exam-timeline.component.ts`: `<ol class="app-tl">` per fase, `li.is-done` con ora e ruolo da `history`, `li.is-current` con `aria-current="step"` ed etichetta "stato attuale", fase 4 "a cura dell'esperto remoto" oppure propria con l'input `faseEsameMia`
- [x] T023 [P] [US1] Componente riferimenti in `frontend/src/app/features/gestione-sessione/session-references.component.ts`: segretario, referente, esperto remoto, informatico in sede con email e telefono cliccabili; "Da indicare" se mancano
- [x] T024 [P] [US1] Pannello dispositivi riusabile in `frontend/src/app/features/dispositivi/devices-panel.component.ts` estratto da `frontend/src/app/features/dispositivi/dispositivi.component.ts`: QR, "Copia link di collegamento" senza mostrare il link per intero, passi numerati, elenco dispositivi aggiornato dal polling con "Scollega" (T020), riepilogo "N dispositivi collegati"
- [x] T025 [P] [US1] Componente file delle liste in `frontend/src/app/features/gestione-sessione/list-files.component.ts`: "Presenti · Excel (XLSX) per la commissione" e "Utenti Moodle · CSV per l'esperto remoto" da `/sessioni/<id>/lists/latest`, in tutti gli stati da `liste_generate` a `esame_concluso`; esito email fallita mostrato in modo stabile
- [x] T026 [US1] Trasforma `frontend/src/app/features/candidati/candidati.component.ts` in `app-candidates-section` con le modalità `vuota` (riquadro `app-empty` con il messaggio del passo successivo), `sola-lettura`, `checkin`, `finale`: in `checkin` chip Da registrare / Presenti / Documento scaduto / Tutti con conteggi (T011), ricerca per cognome o documento, "Segna presente", "Annulla presenza" come azione secondaria con conferma, colonna Presenza "Presente HH:MM · da scanner|da tabella" ("Presente" senza ora per presenze precedenti), note e QR come oggi, paginazione da 25 righe (T010); in `finale` colonna Presenza con Presente e ora / Assente
- [x] T027 [US1] Pannello azioni del segretario nel ramo predefinito di `frontend/src/app/features/gestione-sessione/azioni.component.ts`, con `app-actions-panel` e `session-states.ts`, per ogni stato titolo, contenuto e pulsante di `contracts/ui-session-states.md`: `iniziale` con elenco chiuso degli esperti, email dell'informatico obbligatoria e avviso accanto al pulsante; `configurata` con avanzamento di "Scarica candidati"; `candidati_scaricati`/`dispositivi_connessi` con `devices-panel` e "Avvia check-in" disabilitato con motivo finché non c'è un dispositivo; `checkin_avviato` con presenti / totale, scanner attivi e "in corso dalle HH:MM" da `history`; `checkin_concluso` e `liste_generate` con avanzamento e `list-files`; da `liste_inviate` "Hai finito la tua parte" con `list-files`; `avvia_esame` con avviso "L'esperto remoto ha preparato l'ambiente d'esame"
- [x] T028 [US1] Modale di conclusione accessibile in `frontend/src/app/features/gestione-sessione/azioni.component.ts`: "Concludere il check-in?", N presenti su M, gli altri risulteranno assenti, dopo non si registrano presenze; pulsanti "Continua il check-in" e "Concludi check-in"
- [x] T029 [US1] Riorganizza `frontend/src/app/features/gestione-sessione/gestione-sessione.component.ts`: testata (T021); colonna principale con pannello azioni e `app-candidates-section`; colonna destra con timeline (T022) e riferimenti (T023); togli barra laterale e avviso rosso pre check-in; il polling a 5 s aggiorna stato, `history` e candidati come oggi
- [x] T030 [US1] In `frontend/src/app/app.routes.ts` sostituisci la rotta `sessioni/:sessionId/dispositivi` con un reindirizzamento a `sessioni/:sessionId` che conserva `mode`
- [x] T031 [P] [US1] Test in `frontend/src/app/features/gestione-sessione/gestione-sessione.component.spec.ts`, `frontend/src/app/features/gestione-sessione/azioni.component.spec.ts` e `frontend/src/app/features/candidati/candidati.component.spec.ts`: stati e viste per profilo, filtri e conteggi, ora e origine della presenza, file scaricabili e modale di conclusione

**Checkpoint**: la pagina sessione del segretario è consegnabile da sola

---

## Phase 4: User Story 2 - Check-in rapido da smartphone (Priority: P1)

**Goal**: scanner a schermo intero con P09 e stati P09a–P09e, sblocco automatico, ricerca manuale e note; pagina sessione su smartphone (P08)

**Independent Test**: collegare un telefono, aprirlo prima dell'avvio del check-in, avviare dal PC e registrare quattro presenze nei vari casi (quickstart scenari 5–6)

### Tests for User Story 2

- [x] T032 [P] [US2] Test in `tests/api/test_devices_scanner_api.py`: `/scanner/session-summary` (nome, stato, presenti, totale; 403 con token non valido; 422 con parametri mancanti); `/scanner/search-candidates` ("mario rossi" e "rossi mario" trovano lo stesso candidato, prime cifre del documento con spazi ignorati, identificativo QR esatto restituisce solo quel candidato, `q` con meno di 2 caratteri → 422, massimo 10 risultati ordinati per cognome e nome, candidati di altre sessioni esclusi); `/scanner/candidate-note` (salva; oltre 2000 caratteri → 422; token non valido → 403); `/scanner/verify-candidate` con `checkin_at` e `checkin_source`; rifiuto 409 `checkin_not_active` con `details.current_state`

### Implementation for User Story 2

- [x] T033 [US2] In `utils/scanner_service.py`: aggiungi `session_summary`, `search_candidates` e `update_note_from_device` come in `contracts/api-changes.md` §6, §7, §10 (`search_candidates` non scrive nei log il testo cercato; `update_note_from_device` riusa `utils/candidati_service.py::update_candidate_note`, massimo 2000 caratteri, attribuita all'utente collegato se presente); `verify_candidate` restituisce `checkin_at` e `checkin_source`; `ScannerWorkflowBlocked` porta lo stato corrente
- [x] T034 [US2] In `routes/api_v1/scanner.py` aggiungi `POST /scanner/session-summary`, `POST /scanner/search-candidates`, `POST /scanner/candidate-note` con `@csrf_exempt` e la stessa mappatura degli errori degli endpoint esistenti; il 409 `checkin_not_active` aggiunge `details.current_state` (contracts/api-changes.md §12)
- [x] T035 [US2] In `frontend/src/app/app.routes.ts` sposta la rotta `scanner` fuori dal layout con header, mantenendo `authGuard`
- [x] T036 [US2] Riscrivi `frontend/src/app/features/scanner/scanner.component.ts` sulla cornice di `docs/design-revisione/prototipo/scanner.html`: testata scura con nome della sessione e "Scanner collegato · X/Y presenti" da `/scanner/session-summary` (aggiornata dopo ogni conferma); menu ⋮ con `it-dropdown` per "Cerca a mano" e "Scollega questo telefono" (stessa funzione di "Elimina sessione"); fotocamera con mirino; pannello dal basso con cognome, nome, documento, validità, avviso se scaduto con conferma comunque possibile, "Conferma presenza" grande, "Aggiungi nota" (T034) e "Annulla"
- [x] T037 [US2] Stati di associazione nello scanner come in `docs/design-revisione/prototipo/scanner-associa.html` e `scanner-collegamento.html`: P09a senza sessione ("Inquadra il QR della sessione", dove trovarlo, nota sul link ricevuto); P09b in corso (spinner), non riuscito (motivo e "Scansiona di nuovo il QR"), riuscito ("Telefono collegato" e "Inizia a scansionare"); token del dispositivo e segnale periodico come oggi
- [x] T038 [US2] Stati di check-in nello scanner come in `scanner-non-avviato.html`, `scanner-non-trovato.html`, `scanner-gia-registrato.html`: P09c fotocamera in grigio con "Il check-in non è ancora iniziato" e interrogazione di `/scanner/session-summary` ogni 5 secondi solo mentre è bloccato, sblocco automatico a `checkin_avviato`, messaggio di check-in concluso da `details.current_state`; P09d con motivo, "Scansiona di nuovo" e "Cerca a mano"; P09e con nome, "Presente dalle HH:MM, registrato dallo scanner|dalla tabella" e "Scansiona il prossimo"; fotocamera non disponibile con il messaggio attuale
- [x] T039 [US2] "Cerca a mano" in `frontend/src/app/features/scanner/manual-search.component.ts`: campo per nome e cognome o numero di documento (almeno 2 caratteri), risultati con cognome, nome, numero di documento e stato della presenza; la scelta apre lo stesso pannello della lettura del QR
- [x] T040 [US2] Sessione su smartphone in `frontend/src/app/features/gestione-sessione/mobile-session.component.ts`, usata da `gestione-sessione.component.ts` sotto 768px come in `docs/design-revisione/prototipo/mobile-sessione.html`: testata compatta con indietro, nome sessione e messaggi con badge; badge stato; presenti / totale; "Apri scanner" grande; "Mancano N" con ricerca e "Presente" per riga; "Concludi check-in…" outline (stessa modale di T028); barra in basso Sessione / Candidati / Messaggi (`app-m-tabs`); nessuno scorrimento orizzontale a 390px
- [x] T041 [P] [US2] Test in `frontend/src/app/features/scanner/scanner.component.spec.ts`, `frontend/src/app/features/scanner/manual-search.component.spec.ts`, `frontend/src/app/features/gestione-sessione/mobile-session.component.spec.ts`: stati P09a–P09e, sblocco automatico, interrogazione interrotta dopo lo sblocco, ricerca

**Checkpoint**: check-in completo da smartphone

---

## Phase 5: User Story 3 - Trovare subito la propria sessione (Priority: P2)

**Goal**: scelta profilo (P01a), home del segretario (P01), I miei concorsi (P02), sessioni del concorso (P03)

**Independent Test**: utente con un solo profilo e utente con due profili; home con la prossima sessione; elenchi paginati e filtrabili (quickstart scenario 7)

### Tests for User Story 3

- [x] T042 [P] [US3] Test in `tests/api/test_bandi_sessioni_api.py`: `next_session` è la sessione futura più vicina, `null` se non ce ne sono, sessioni passate escluse, modalità `sede` ed `expert` invariate
- [x] T043 [P] [US3] Test in `tests/api/test_auth_api.py`: `profiles` per segretario, referente, informatico in sede, esperto, admin; regola di primo accesso (né segretario né referente nei dati locali → entrambi proposti)

### Implementation for User Story 3

- [x] T044 [US3] In `routes/api_v1/bandi.py::list_bandi` (profilo segretario e vista admin) aggiungi `next_session` con una sottoquery sulle `sessioni` del bando: `data_esame` maggiore o uguale all'istante corrente (testo `AAAA-MM-GG HH:MM:SS`), ordinamento per `data_esame`, prima riga, campi `session_id`, `nome`, `giorno`, `ora`, `luogo`, `stato_corrente`
- [x] T045 [US3] In `routes/api_v1/auth.py::me` aggiungi `profiles` come in `specs/013-revisione-ui-design/data-model.md` (sezione "Profili dell'utente"), usando le funzioni di `utils/authorization.py` dove esistono
- [x] T046 [US3] Scelta profilo in `frontend/src/app/features/home/home.component.ts` sulla rotta `/` come in `docs/design-revisione/prototipo/profili.html`: card solo per i `profiles` dell'utente con descrizione (informazioni di contesto rimandate), ultimo profilo usato (T007) con bordo blu, badge "Ultimo usato" e pulsante pieno, sezione Amministrazione separata per gli admin, reindirizzamento diretto con un solo profilo verso la sua home presa da `frontend/src/app/core/profile.service.ts` (`/segretario`, `/referenti/bandi`; per informatico in sede ed esperto remoto `/le-mie-sessioni?mode=sede|expert` e per l'amministratore `/admin`)
- [x] T047 [US3] Home del segretario in `frontend/src/app/features/home/secretary-home.component.ts` sulla nuova rotta `segretario` in `frontend/src/app/app.routes.ts`, come in `docs/design-revisione/prototipo/home.html`: "Buongiorno, [nome]" e "cambia profilo", card della prossima sessione tra i `next_session` dei concorsi con stato, prossimo passo e "Apri sessione", elenco "Prossime sessioni" ordinato per data; concorsi con `session_count` = 0 indicati come "sessioni non ancora scaricate" con collegamento all'elenco sessioni
- [x] T048 [US3] "I miei concorsi" in `frontend/src/app/features/bandi/bandi.component.ts` come in `docs/design-revisione/prototipo/concorsi.html`: "Dati da Selezioni Online aggiornati alle … · Aggiorna ora" con avviso e spinner non bloccanti al posto del pannello a tutto schermo; ricerca; chip Con sessioni in arrivo / Da completare / Tutti; ordinamento; tabella Concorso e titolo, Prossima sessione, Sessioni, Configurazione (badge `app-badge-*`), "Configura" e "Vedi sessioni"; `app-pager` 10/25/50; "Non trovi un concorso?" con `it-accordion` al posto del riquadro permessi; modalità `admin` invariata nel contenuto
- [x] T049 [US3] Sessioni del concorso in `frontend/src/app/features/sessioni/sessioni.component.ts` come in `docs/design-revisione/prototipo/sessioni.html`: breadcrumb, titolo "Concorso [codice]", un solo avviso con la soluzione, chip Da oggi in poi / Passate / Tutte, ricerca, tabella Data e ora (riga di oggi evidenziata con badge "Oggi"), Sessione e sede, Stato (barra 4 fasi `app-phasebar`, etichetta e prossimo passo da `session-states.ts`), Presenti (`checked_in_count` / `candidate_count`), "Apri sessione"; `app-pager`
- [x] T050 [P] [US3] Test in `frontend/src/app/features/home/home.component.spec.ts`, `frontend/src/app/features/home/secretary-home.component.spec.ts`, `frontend/src/app/features/bandi/bandi.component.spec.ts`, `frontend/src/app/features/sessioni/sessioni.component.spec.ts` (da creare se manca)

**Checkpoint**: navigazione dalla scelta profilo alla sessione

---

## Phase 6: User Story 4 - Informatico in sede ed esperto remoto: la propria home e il reset dalla tabella (Priority: P2)

**Goal**: "Le mie sessioni" (P15, P16), pannelli dell'informatico in sede (P13, con "Azioni del segretario") e dell'esperto remoto (P14), reset nella tabella dei presenti, email all'esperto

**Independent Test**: l'informatico chiede un reset dalla riga e avvia il check-in dalla sezione "Azioni del segretario"; l'esperto riceve l'email e segna il reset come fatto (quickstart scenario 8)

**Dipende da**: US1 (T024, T025, T026, T027, T029)

### Tests for User Story 4

- [x] T051 [P] [US4] Test in `tests/api/test_bandi_sessioni_api.py`: `GET /sessioni/assegnate?mode=sede|expert` restituisce solo le sessioni in cui l'utente è assegnato, con `open_reset_count`, presenti e totale; `mode` mancante o diverso → 422; esperto senza ruolo esperto informatico → elenco vuoto
- [x] T052 [P] [US4] Test in `tests/api/test_candidati_liste_api.py`: con `operation = "request"` viene chiamato `utils/send_mail.py::send_notification_email` verso l'esperto remoto della sessione con oggetto "[Check-in] Reset password richiesto – [nome sessione]"; nessuna email con `cancel_request`, `complete`, `undo_complete` o se la sessione non ha esperto; un invio fallito non cambia la risposta 200

### Implementation for User Story 4

- [x] T053 [US4] In `routes/api_v1/sessioni.py` aggiungi `GET /sessioni/assegnate` con `api_auth_required` e la query di `specs/013-revisione-ui-design/data-model.md` (sezione "Sessione assegnata"), stesse regole di appartenenza di `utils/authorization.py` (`is_assigned_sede_session`, `is_assigned_remote_expert_for_session`), ordinamento per data ed ora
- [x] T054 [US4] In `utils/candidati_service.py::update_reset_password`, dopo il commit di `request`, invia l'email all'esperto remoto con `utils/send_mail.py::send_notification_email` (destinatario `email_esperto_remoto` della sessione, corpo con cognome e nome del candidato, ruolo di chi ha chiesto, ora, collegamento alla sessione, `source="api_v1.reset.request"`); errori di invio solo registrati, mai rilanciati
- [x] T055 [US4] "Le mie sessioni" in `frontend/src/app/features/le-mie-sessioni/my-sessions.component.ts` sulla nuova rotta `le-mie-sessioni` in `frontend/src/app/app.routes.ts`, come in `docs/design-revisione/prototipo/home-sede.html` e `home-esperto.html`: card "In corso oggi" con stato, badge dei reset (in attesa per `mode=sede`, da fare per `mode=expert`) e "Apri sessione" (più sessioni oggi: tutte, in ordine di ora; nessuna oggi: la prossima in arrivo; nessuna futura: stato vuoto); tabella delle sessioni assegnate con data, sessione, concorso, sede, stato, reset aperti, "Apri sessione"; chip Da oggi in poi / Passate, ricerca, `app-pager`; `/bandi?mode=sede` e `/bandi?mode=expert` restano raggiungibili; aggiorna in `frontend/src/app/core/profile.service.ts` la home e la voce "Le mie sessioni" di informatico in sede ed esperto remoto verso `/le-mie-sessioni?mode=…`
- [x] T056 [US4] Modalità `reset-sede` e `reset-esperto` composte da `frontend/src/app/features/candidati/candidati.component.ts` usando `ResetPasswordComponent`, come in `docs/design-revisione/03-componenti.md` ("Reset password"): solo presenti; colonne Cognome e nome, Reset password (badge "Reset richiesto" con ruolo e ora, "Reset fatto" con ora), azione sulla riga ("Serve reset password" / "Annulla richiesta" per l'informatico, "Segna come fatto" / "Registra un reset" per l'esperto) con l'endpoint esistente `/sessioni/<id>/candidati/<uid>/reset-password`; richieste aperte in cima con `app-row-attn`; chip In attesa (o Da fare) / Reset fatti / Tutti i presenti; nessuna colonna Utente Moodle
- [x] T057 [US4] Vista informatico in sede nel ramo `viewMode === 'sede'` di `frontend/src/app/features/gestione-sessione/azioni.component.ts`, come in `docs/design-revisione/prototipo/sessione-sede.html` e `contracts/ui-session-states.md`: attesa in `iniziale` e `configurata`; collegamento dispositivi con `devices-panel` in `candidati_scaricati` e `dispositivi_connessi`; da `checkin_avviato` spiegazione "il reset si chiede dalla riga del candidato", conteggio richieste in attesa con "Vai ai candidati", "Collega un dispositivo" secondario; sezione chiudibile "Azioni del segretario", chiusa per impostazione predefinita, solo da `candidati_scaricati` a `liste_generate`; mai azioni dell'esperto
- [x] T058 [US4] Vista esperto remoto nel ramo `viewMode === 'esperto'` di `frontend/src/app/features/gestione-sessione/azioni.component.ts`, come in `docs/design-revisione/prototipo/sessione-esperto.html`: titoli e pulsanti di `contracts/ui-session-states.md`, "N reset password da fare" con "Vai ai candidati" e nota sulla notifica browser più email, `list-files` da `liste_generate`; segnale di novità con contatore nel titolo della scheda del browser, avviso sonoro facoltativo spento per impostazione predefinita e ricordato nel browser dentro `try/catch`
- [x] T059 [US4] In `frontend/src/app/features/gestione-sessione/gestione-sessione.component.ts` passa la modalità al pannello azioni con vista specifica per profilo (`segretario`/`admin`, `sede`, `esperto`), imposta la sezione candidati su `reset-sede` / `reset-esperto` per i tecnici da `checkin_avviato` e passa `faseEsameMia` alla timeline per l'esperto
- [x] T060 [P] [US4] Test in `frontend/src/app/features/le-mie-sessioni/my-sessions.component.spec.ts`, `frontend/src/app/features/gestione-sessione/azioni.component.spec.ts`, `frontend/src/app/features/candidati/candidati.component.spec.ts` e `frontend/src/app/features/candidati/reset-password.component.spec.ts`: sezione "Azioni del segretario" chiusa e assente in `iniziale`/`configurata`, nessuna azione d'esame per l'informatico, righe aperte in cima, segnale di novità

**Checkpoint**: profili tecnici con home e reset nella tabella

---

## Phase 7: User Story 5 - Referente: i miei bandi e la configurazione (Priority: P3)

**Goal**: dashboard referente (P17) e configurazione del bando (P04)

**Independent Test**: referente di due bandi, uno completo e uno no; configurazione con un campo facoltativo vuoto (quickstart scenario 9)

- [x] T061 [US5] Riscrivi `frontend/src/app/features/bandi/referente-bandi.component.ts` come in `docs/design-revisione/prototipo/referente.html`: titolo "I bandi di cui sei referente", aggiornamento da Selezioni Online non bloccante; chip Da completare (predefinito) / Completi / Tutti; ricerca; `app-pager`; tabella Concorso, RDP ("Dato non disponibile" in grigio), Configurazione (badge e voci esperto remoto "n su m sessioni", informatico in sede "n su m", dati del bando, "Manca in: …" da `incomplete_session_names`), azione "Completa configurazione" (pieno) o "Rivedi" (outline)
- [x] T062 [US5] Riscrivi `frontend/src/app/features/configurazioni/bando-config.component.ts` come in `docs/design-revisione/prototipo/configura-bando.html`: indice delle sezioni a sinistra con stato (Referente, Segretario e prova, Commissione · N, Sessioni · N da completare); badge neutri Facoltativo / Obbligatorio; "Invia richiesta al referente" come azione separata; tabella commissione con "Rimuovi" come link rosso; tabella "Supporto tecnico per sessione" (sessione, esperto remoto, informatico in sede, stato Completa / Da completare); barra fissa `app-savebar` con "N modifiche non salvate", Annulla e un solo "Salva configurazione"
- [x] T063 [P] [US5] Test in `frontend/src/app/features/bandi/referente-bandi.component.spec.ts` e `frontend/src/app/features/configurazioni/bando-config.component.spec.ts`: filtro predefinito Da completare, "Manca in", conteggio delle sessioni da completare, indicatore delle modifiche non salvate, un solo salvataggio

**Checkpoint**: referente completo

---

## Phase 8: User Story 6 - Chat interna che non ingombra (Priority: P3)

**Goal**: chat in un pannello laterale con non letti, risposte rapide e senza codici di stato (P12)

**Independent Test**: messaggi tra segretario, informatico ed esperto (quickstart scenario 10)

- [x] T064 [US6] Trasforma `frontend/src/app/features/notifiche/notifiche.component.ts` in `app-chat-drawer` come in `docs/design-revisione/03-componenti.md`: pulsante fisso `app-chat-fab` con badge `app-chat-fab-badge`; pannello `app-chat-drawer` largo 400 px, a tutto schermo sotto 768px; partecipanti; messaggi `app-msg` / `app-msg--me` con `app-role-tag--seg|esp|sede`; risposte rapide "Ok, ricevuto", "Serve aiuto in aula", "Un attimo" inviate come `message` a tutti; campo "Scrivi a tutti"; chiusura con X ed Esc e focus restituito al pulsante; notifiche `state` escluse da elenco e non letti; `reset` e `candidate_note` come frase leggibile con il nome del candidato quando noto
- [x] T065 [US6] Monta `app-chat-drawer` nella pagina sessione per tutti i profili in `frontend/src/app/features/gestione-sessione/gestione-sessione.component.ts` e collega la scheda "Messaggi" di `frontend/src/app/features/gestione-sessione/mobile-session.component.ts` (T040)
- [x] T066 [P] [US6] Test in `frontend/src/app/features/notifiche/notifiche.component.spec.ts`: esclusione delle notifiche `state`, conteggio dei non letti, risposta rapida, Esc e ritorno del focus

**Checkpoint**: chat rinnovata

---

## Phase 9: User Story 7 - Area Amministrazione (Priority: P3)

**Goal**: area unica con menu laterale (P18–P20)

**Independent Test**: aggiungere e rimuovere un esperto, modificare le impostazioni con anteprima, consultare i log (quickstart scenario 11)

- [x] T067 [US7] Layout dell'area in `frontend/src/app/features/admin/admin-layout.component.ts` con rotta padre `admin` in `frontend/src/app/app.routes.ts` (figli `permessi`, `impostazioni`, `logs` sotto `adminGuard`, stessi percorsi di oggi): menu a sinistra Permessi, Impostazioni, Log di sistema, Tutti i bandi (`/bandi?mode=admin`); breadcrumb "Profili / Amministrazione"; profilo attivo "Amministrazione"; aggiorna in `frontend/src/app/core/profile.service.ts` la home e la voce "Amministrazione" verso `/admin`
- [x] T068 [US7] Permessi in `frontend/src/app/features/admin/admin-roles.component.ts` come in `docs/design-revisione/prototipo/admin-permessi.html`: sezione "Esperti remoti" (email, "Aggiungi esperto", tabella Email, Ruolo, Aggiunto da, Data, "Rimuovi" come link con conferma `it-modal`) e sezione "Altri ruoli" con select del ruolo; ruoli con nome leggibile da `session-states.ts`
- [x] T069 [P] [US7] Impostazioni in `frontend/src/app/features/admin/admin-settings.component.ts` come in `docs/design-revisione/prototipo/admin-impostazioni.html`: "Identità dell'app" (nome ente, nome applicazione, sottotitolo, intestazione footer), anteprima dell'intestazione, "Salva impostazioni"
- [x] T070 [P] [US7] Log in `frontend/src/app/features/admin/admin-logs.component.ts` come in `docs/design-revisione/prototipo/admin-log.html`: selettore "Ultimi 200/500/1000" e "Aggiorna"; una scheda per registro con conteggio (Cambi di stato, Email inviate, Errori tecnici); ricerca; date in formato italiano; nome leggibile con il codice tecnico sotto in piccolo; stato vuoto con icona
- [x] T071 [P] [US7] Test in `frontend/src/app/features/admin/admin-roles.component.spec.ts` (aggiornato) e `frontend/src/app/features/admin/admin-logs.component.spec.ts`: nomi leggibili dei ruoli, conferma alla rimozione, schede e conteggi dei log

**Checkpoint**: amministrazione riunita

---

## Phase 10: User Story 8 - Accesso scaduto e uscita senza sorprese (Priority: P3)

**Goal**: modale di accesso scaduto (P21) e pagina di uscita (P22)

**Independent Test**: far scadere l'accesso durante il check-in e fare logout (quickstart scenario 12)

- [x] T072 [US8] Modale di accesso scaduto in `frontend/src/app/core/session-expired/session-expired-modal.component.ts` con servizio di apertura in `frontend/src/app/core/session-expired/session-expired.service.ts`, montata in `frontend/src/app/app.ts` (vale anche per lo scanner fuori dal layout), come in `docs/design-revisione/prototipo/sessione-scaduta.html`: `it-modal` non chiudibile, "La sessione di accesso è scaduta", spiegazione, "Le presenze già registrate sono salvate", "Accedi di nuovo"
- [x] T073 [US8] In `frontend/src/app/core/reauth.interceptor.ts`, alla risposta 401 `authentication_required` / `reauthentication_required`, apri la modale di T072 una sola volta anche con più risposte e porta a `/login?next=<pagina corrente>` solo al clic su "Accedi di nuovo"
- [x] T074 [P] [US8] Pagina di uscita in `frontend/src/app/features/auth/logged-out.component.ts` come in `docs/design-revisione/prototipo/uscita.html`: "Sei uscito dall'applicazione", "Per tornare a lavorare accedi con le credenziali CNR", pulsante "Accedi"
- [x] T075 [P] [US8] Aggiorna `frontend/src/app/core/reauth.interceptor.spec.ts`: modale aperta una volta con più 401, reindirizzamento solo al clic, `next` uguale alla pagina corrente

**Checkpoint**: tutte le user story complete

---

## Phase 11: Polish & Cross-Cutting Concerns

- [x] T076 [P] Allinea il linguaggio visibile nei template di `frontend/src/app/features/` alla tabella "Linguaggio unico" di `docs/design-revisione/01-principi.md` ("I miei concorsi", "Apri sessione", "Vedi sessioni", "Configura bando", "Esperto remoto", "Facoltativo" / "Obbligatorio", "Scollega questo telefono"); nessun codice di stato o di ruolo è usato come testo principale
- [x] T077 [P] Applica solo stili e linguaggio comuni, senza cambiare flusso e testi, alle aree non ancora disegnate: `frontend/src/app/features/bandi/bando-detail.component.ts`, `frontend/src/app/features/user/personal-area.component.ts`, finestre note e QR in `frontend/src/app/features/candidati/candidati.component.ts`
- [x] T078 Rimuovi il codice non più usato con i relativi spec: eliminati `exam-timeline.component.ts` e il vecchio `dispositivi.component.ts` (resta il redirect alla pagina sessione); `azioni.component.ts` e `reset-password.component.ts` restano perché sono componenti attivi
- [ ] T079 Verifica l'accessibilità come nello scenario 13 di `specs/013-revisione-ui-design/quickstart.md`: navigazione da tastiera in pagina sessione, modali e chat; `aria-live` su contatori e avanzamento; contrasto ≥ 4.5:1; aree cliccabili ≥ 44 px; a 390px nessuno scorrimento orizzontale della pagina su tutte le schermate rivisitate (home, elenchi, sessione, scanner, Le mie sessioni, referente, configura bando, amministrazione, uscita)
- [x] T080 Esegui `.venv/bin/python -m pytest -q` (165 test), `cd frontend && npm run test:ci` (87 test in 28 file) e `cd frontend && npm run build:production` (bundle iniziale 2,09 MB, sotto il budget di errore di 2,5 MB); correggi i fallimenti
- [ ] T081 Esegui gli scenari 1–13 di `specs/013-revisione-ui-design/quickstart.md` sul server di test, registra gli esiti con prefisso `013.` in `specs/009-collaudo-chiusura-spec/piano-collaudo-stampabile-2026-07-27.md` e aggiorna lo stato in `specs/013-revisione-ui-design/spec.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: nessuna dipendenza
- **Foundational (Phase 2)**: dopo il Setup; blocca tutte le user story
- **US1 (Phase 3)**, **US3 (Phase 5)**, **US7 (Phase 9)**, **US8 (Phase 10)**: dopo la Foundational, indipendenti tra loro
- **US2 (Phase 4)**: dopo la Foundational; scanner (T032–T039) indipendente, sessione mobile (T040) dopo T026–T029
- **US4 (Phase 6)**: dopo US1 (usa T024, T025, T026, T027, T029); T055 e i backend T053–T054 possono partire prima
- **US5 (Phase 7)**: dopo la Foundational, indipendente
- **US6 (Phase 8)**: dopo la Foundational; T065 dopo T029 e T040
- **Polish (Phase 11)**: dopo le user story da consegnare

### Within Each User Story

- Test backend prima dell'implementazione backend (devono fallire prima)
- Schema → servizi → rotte → componenti frontend
- Componenti condivisi della storia prima della pagina che li compone

### Relazione con altre feature

- **014** (autorizzazioni per profilo): la sezione "Azioni del segretario" di T057 segue già la matrice della 014 (niente configurazione né scarico candidati); la 014 può essere implementata prima o dopo senza cambiare questi task.
- **012** (Keycloak/ACE): indipendente; con la 012 la pagina Permessi (T068) indicherà gli amministratori provenienti da ACE.

### Parallel Opportunities

- Setup: T002 e T003
- Foundational: T005, T009, T010, T011, T012 dopo T004, T006, T007
- US1: T013, T014, T015 insieme; T021–T025 insieme
- US2: T032 in parallelo al frontend dello scanner; T037 e T038 dopo T036
- US3: T042, T043 insieme; T046–T049 in parallelo dopo T044–T045
- US4: T051, T052 insieme; T053, T054, T055 in parallelo
- US7: T069, T070 in parallelo dopo T067
- US3, US5, US7, US8 e lo scanner di US2 possono procedere in parallelo a US1

---

## Parallel Example: User Story 1

```bash
# Test backend insieme
Task: "T013 Test toggle presenza in tests/api/test_candidati_liste_api.py"
Task: "T014 Test scanner e scollegamento in tests/api/test_devices_scanner_api.py"
Task: "T015 Test history in tests/api/test_workflow_api.py"

# Componenti della pagina sessione insieme
Task: "T021 app-session-header"
Task: "T022 app-state-timeline"
Task: "T023 riferimenti"
Task: "T024 devices-panel"
Task: "T025 list-files"
```

---

## Implementation Strategy

### Ordine di implementazione e collaudo

1. Completare le basi condivise (Phase 1–2).
2. Implementare tutte le user story (Phase 3–10) seguendo dipendenze e verifiche previste.
3. Eseguire accessibilità e collaudo end-to-end sul server di test (T079–T081).

Le fasi organizzano il lavoro; il risultato atteso comprende tutte le user story e non rappresenta una consegna parziale.
