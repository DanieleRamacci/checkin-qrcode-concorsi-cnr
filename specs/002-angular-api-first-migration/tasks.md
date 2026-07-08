# Tasks: Migrazione API-first e Angular

**Input**: Design documents from
`specs/002-angular-api-first-migration/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`

**Tests**: Backend API, frontend unit test, build production, controlli
accessibilita e smoke test sono richiesti da FR-012.

**Organization**: I task sono raggruppati per user story e producono incrementi
verificabili. Il branch `checkin-dev` resta immutato.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo su file distinti
- **[Story]**: user story della specifica
- ogni task indica il file o la directory interessata

## Phase 1: Setup

**Purpose**: fissare baseline, toolchain e workspace senza cambiare i flussi
legacy.

- [x] T001 Verificare branch, working tree e test baseline seguendo `specs/002-angular-api-first-migration/quickstart.md`
- [x] T002 Creare il workspace standalone Angular 21 in `frontend/package.json`, `frontend/angular.json` e `frontend/src/`
- [x] T003 Integrare `design-angular-kit` 21.x tramite schematico e lockfile in `frontend/package.json` e `frontend/package-lock.json`
- [x] T004 [P] Fissare Node.js 24 e i comandi npm di test/build in `.nvmrc` e `frontend/package.json`
- [x] T005 [P] Configurare il dev proxy same-origin in `frontend/proxy.conf.json`
- [x] T006 [P] Completare variabili e default sicuri in `.env.example`

**Checkpoint**: workspace riproducibile con `npm ci`, applicazione legacy ancora
invariata.

---

## Phase 2: Foundational Security and API Infrastructure

**Purpose**: hardening e infrastruttura condivisa che bloccano le API e il
cutover.

**CRITICAL**: le user story applicative non iniziano prima di questo checkpoint.

- [x] T007 Salvare l'esito dei test Flask baseline in `specs/002-angular-api-first-migration/quickstart.md`
- [x] T008 Scrivere test fallenti per endpoint sensibili, ruolo e ownership in `tests/test_authorization.py`
- [x] T009 Creare autorizzazione condivisa per `session_id` e `commission_id` in `utils/authorization.py`
- [x] T010 Applicare gli helper di ownership alle mutazioni in `routes/azioni.py`
- [x] T011 Applicare gli helper di ownership a pagine e frammenti in `routes/dispositivi.py`
- [x] T012 Proteggere `/log` in `server_pg.py` e rimuovere o proteggere gli endpoint debug in `routes/azioni.py`
- [x] T013 Scrivere test fallenti per token dispositivo scaduto e revocato in `tests/test_device_tokens.py`
- [x] T014 Formalizzare scadenza, revoca e confronto token dispositivo in `utils/device_tokens.py`
- [x] T015 Scrivere test fallenti per request ID, 404 JSON e CSRF in `tests/api/test_api_foundation.py`
- [x] T016 Creare e registrare il blueprint `/api/v1` in `routes/api_v1/__init__.py` e `server_pg.py`
- [x] T017 Implementare errore JSON uniforme e request ID in `routes/api_v1/errors.py`
- [x] T018 Implementare token e validazione CSRF API-only in `routes/api_v1/csrf.py`
- [x] T019 Eseguire e correggere i test foundation in `tests/test_authorization.py`, `tests/test_device_tokens.py` e `tests/api/test_api_foundation.py`

**Checkpoint**: endpoint sensibili protetti, blueprint API attivo, mutazioni API
protette da CSRF.

---

## Phase 3: User Story 1 - Architettura target API-first (Priority: P1)

**Goal**: rendere verificabili confini, slice e dipendenze della migrazione.

**Independent Test**: un tecnico puo spiegare backend, API, Angular, kit AgID,
fallback e fuori-scope leggendo soltanto gli artifact Spec Kit.

- [x] T020 [P] [US1] Mappare ogni route legacy al contratto API in `specs/002-angular-api-first-migration/contracts/api-v1-target.md`
- [x] T021 [P] [US1] Verificare DTO e regole di validazione in `specs/002-angular-api-first-migration/data-model.md`
- [x] T022 [US1] Allineare ordine e criteri delle slice in `specs/002-angular-api-first-migration/contracts/migration-slices.md`
- [x] T023 [US1] Rieseguire il Constitution Check e registrare l'esito in `specs/002-angular-api-first-migration/plan.md`
- [x] T024 [US1] Verificare assenza di placeholder e chiarimenti aperti in `specs/002-angular-api-first-migration/`

**Checkpoint**: pianificazione approvabile e senza decisioni tecniche irrisolte.

---

## Phase 4: User Story 2 - API JSON versionate (Priority: P1)

**Goal**: offrire contratti JSON sicuri per tutti i flussi core senza dipendere
da HTML o HTMX.

**Independent Test**: `pytest -q tests/api` valida autenticazione, ownership,
CSRF, risposta DTO, transizioni e errori JSON.

### Tests for User Story 2

- [x] T025 [P] [US2] Scrivere test fallenti per `/api/v1/me` e CSRF in `tests/api/test_auth_api.py`
- [x] T026 [P] [US2] Scrivere test fallenti per bandi e sessioni in `tests/api/test_bandi_sessioni_api.py`
- [x] T027 [P] [US2] Scrivere test fallenti per configurazioni e workflow in `tests/api/test_workflow_api.py`
- [x] T028 [P] [US2] Scrivere test fallenti per candidati e liste in `tests/api/test_candidati_liste_api.py`
- [x] T029 [P] [US2] Scrivere test fallenti per dispositivi e scanner in `tests/api/test_devices_scanner_api.py`
- [x] T030 [P] [US2] Scrivere test fallenti per notifiche e ruoli admin in `tests/api/test_notifications_admin_api.py`

### Implementation for User Story 2

- [x] T031 [US2] Implementare `UserContext` e `/api/v1/me` in `routes/api_v1/auth.py`
- [x] T032 [US2] Estrarre ruoli e capability, incluso esperto role-only, in `utils/permissions.py`
- [x] T033 [US2] Implementare lettura bandi e dettaglio in `routes/api_v1/bandi.py`
- [x] T034 [US2] Isolare sync metadata JConon/OpenAPI in `utils/jconon_service.py`
- [x] T035 [US2] Implementare lista e dettaglio sessioni in `routes/api_v1/sessioni.py`
- [x] T036 [US2] Implementare configurazioni bando e sessione in `routes/api_v1/configurazioni.py`
- [x] T037 [US2] Estrarre validazione e capability delle transizioni in `utils/workflow_service.py`
- [x] T038 [US2] Implementare azioni workflow in `routes/api_v1/workflow.py`
- [x] T039 [US2] Implementare lista, filtri e azioni candidati in `routes/api_v1/candidati.py`
- [x] T040 [US2] Isolare import candidati dalle route legacy in `utils/candidati_service.py`
- [x] T041 [US2] Implementare lista dispositivi e token registrazione in `routes/api_v1/devices.py`
- [x] T042 [US2] Implementare register, ping e disconnect con rowcount verificato in `routes/api_v1/devices.py`
- [x] T043 [US2] Implementare verify e check-in scanner in `routes/api_v1/scanner.py`
- [x] T044 [US2] Estrarre generazione e invio liste in `utils/liste_service.py`
- [x] T045 [US2] Implementare generate, latest, download e send in `routes/api_v1/liste.py`
- [x] T046 [US2] Implementare feed e inserimento notifiche in `routes/api_v1/notifiche.py`
- [x] T047 [US2] Implementare gestione ruoli protetta in `routes/api_v1/admin.py`
- [x] T048 [US2] Eseguire e correggere l'intera suite API documentando il risultato in `specs/002-angular-api-first-migration/quickstart.md`

**Checkpoint**: tutte le aree core hanno API JSON testate; il legacy continua a
funzionare.

---

## Phase 5: User Story 3 - UI Angular incrementale (Priority: P2)

**Goal**: migrare schermate e flussi usando Angular 21 e Design Angular Kit,
senza duplicare regole backend.

**Independent Test**: l'app Angular completa login, home, bandi e sessioni via
API; `npm run test:ci` e `npm run build:production` passano.

### Tests for User Story 3

- [x] T049 [P] [US3] Scrivere test fallenti per API client, CSRF e auth in `frontend/src/app/core/api-client.spec.ts` e `frontend/src/app/core/auth.service.spec.ts`
- [x] T050 [P] [US3] Scrivere test fallenti per home, capability e visibilita esperto in `frontend/src/app/features/home/home.component.spec.ts`
- [x] T051 [P] [US3] Scrivere test fallenti per bandi e sessioni in `frontend/src/app/features/bandi/bandi.component.spec.ts` e `frontend/src/app/features/sessioni/sessioni.component.spec.ts`

### Implementation for User Story 3

- [x] T052 [US3] Configurare `provideDesignAngularKit` e provider applicativi in `frontend/src/app/app.config.ts`
- [x] T053 [US3] Configurare Bootstrap Italia SCSS, icone, asset e i18n in `frontend/src/styles.scss` e `frontend/angular.json`
- [x] T054 [P] [US3] Definire DTO TypeScript coerenti con i contratti in `frontend/src/app/core/models/api.models.ts`
- [x] T055 [US3] Implementare API client, credenziali cookie, request ID e interceptor CSRF in `frontend/src/app/core/api-client.ts`
- [x] T056 [US3] Implementare `AuthService`, guard e redirect login backend in `frontend/src/app/core/auth.service.ts` e `frontend/src/app/core/auth.guard.ts`
- [x] T057 [US3] Implementare layout accessibile con Design Angular Kit in `frontend/src/app/layout/app-layout.component.ts`
- [x] T058 [US3] Configurare route lazy e fallback in `frontend/src/app/app.routes.ts`
- [x] T059 [US3] Implementare home con profili e card esperto visibile solo per capability in `frontend/src/app/features/home/home.component.ts`
- [x] T060 [US3] Implementare service e pagina bandi in `frontend/src/app/features/bandi/bandi.service.ts` e `frontend/src/app/features/bandi/bandi.component.ts`
- [x] T061 [US3] Implementare service e pagina sessioni in `frontend/src/app/features/sessioni/sessioni.service.ts` e `frontend/src/app/features/sessioni/sessioni.component.ts`
- [x] T062 [US3] Implementare configurazioni bando e sessione in `frontend/src/app/features/configurazioni/`
- [x] T063 [US3] Implementare shell gestione sessione in `frontend/src/app/features/gestione-sessione/gestione-sessione.component.ts`
- [x] T064 [P] [US3] Implementare tabella e filtri candidati in `frontend/src/app/features/candidati/`
- [x] T065 [P] [US3] Implementare pannello azioni workflow in `frontend/src/app/features/workflow/`
- [x] T066 [P] [US3] Implementare notifiche e liste in `frontend/src/app/features/notifiche/` e `frontend/src/app/features/liste/`
- [x] T067 [P] [US3] Implementare lista e registrazione dispositivi in `frontend/src/app/features/dispositivi/`
- [x] T068 [US3] Implementare la pagina scanner preservando SSO, registrazione e device token in `frontend/src/app/features/scanner/`
- [x] T069 [US3] Verificare test, build, tastiera, focus e label aggiornando `specs/002-angular-api-first-migration/quickstart.md`

**Checkpoint**: prima milestone Angular funzionante e poi parita delle slice UI
selezionate, sempre con fallback legacy.

---

## Phase 6: User Story 4 - Coesistenza e cutover (Priority: P2)

**Goal**: pubblicare test e produzione in modo ripetibile, con rollback e
immagini nel registry Baltig.

**Aggiornamento operativo (2026-07-08)**: per sbloccare l'ambiente reale di
test e' stato scelto il flusso Coolify branch-based: Coolify clona il branch
`test` via deploy key read-only e builda `docker-compose.coolify.yml`
direttamente. Il flusso runner/registry Baltig resta implementato come
possibile evoluzione futura, ma non e il percorso operativo corrente.

**Independent Test**: lo stesso commit produce un'immagine immutabile, viene
usato in test e puo essere promosso in produzione senza rebuild.

### Tests for User Story 4

- [x] T070 [P] [US4] Documentare runner, registry, domini e credenziali di deploy confermati in `docs/deployment/baltig-ci-cd.md`
- [x] T071 [P] [US4] Creare smoke test HTTP per frontend e API in `scripts/smoke-deployment.sh`

### Implementation for User Story 4

- [x] T072 [US4] Creare build multi-stage e runtime statico frontend in `frontend/Dockerfile`
- [x] T073 [US4] Configurare fallback SPA e security header in `frontend/nginx.conf`
- [x] T074 [US4] Creare compose di deploy senza bind mount o porte dati pubbliche in `deploy/compose.yml`
- [x] T075 [P] [US4] Separare configurazioni test e produzione in `deploy/compose.test.yml` e `deploy/compose.prod.yml`
- [x] T076 [US4] Configurare in Coolify i due hostname e il routing same-origin definito in `deploy/compose.yml`
- [x] T077 [US4] Implementare test, build e push per commit SHA nel registry Baltig in `.gitlab-ci.yml`
- [x] T078 [US4] Implementare promozione manuale della stessa immagine in produzione in `.gitlab-ci.yml`
- [x] T079 [US4] Disabilitare la pubblicazione GHCR o limitarla ai soli test in `.github/workflows/build.yml`
- [x] T080 [US4] Documentare Coolify pull, rollback e deploy token `read_registry` in `docs/deployment/baltig-ci-cd.md`
- [x] T081 [US4] Eseguire smoke test e aggiornare la checklist in `specs/002-angular-api-first-migration/contracts/cutover-readiness.md`

**Checkpoint**: test e produzione separati, deploy ripetibile, rollback
documentato.

---

## Phase 7: User Story 5 - Hardening del ramo corrente (Priority: P3)

**Goal**: chiudere i rischi legacy rimasti prima del cutover.

**Independent Test**: audit route, test sicurezza e checklist cutover non
mostrano endpoint pubblici, ownership mancante o token non validati.

- [x] T082 [P] [US5] Scrivere test OIDC per state, redirect e token non valido in `tests/test_auth_security.py`
- [x] T083 [US5] Validare state OIDC e impedire open redirect in `routes/auth.py`
- [x] T084 [US5] Verificare firma, issuer, audience e scadenza usando `OIDC_ISSUER`, `OIDC_AUDIENCE` e `OIDC_JWKS_URL` in `routes/auth.py`, `utils/oidc.py` e `.env.example`
- [x] T085 [P] [US5] Verificare assenza di segreti e default insicuri in `.env.example` e `.gitignore`
- [x] T086 [US5] Auditare auth, ruolo e ownership di tutte le route in `specs/002-angular-api-first-migration/contracts/current-route-security-audit.md`
- [x] T087 [US5] Chiudere gli esiti dell'audit nella checklist `specs/002-angular-api-first-migration/contracts/cutover-readiness.md`

**Checkpoint**: prerequisiti di sicurezza chiusi o esplicitamente bloccanti per
la produzione.

---

## Phase 8: Polish and Cross-Cutting Validation

- [x] T088 [P] Eseguire suite backend completa e registrare esito in `specs/002-angular-api-first-migration/quickstart.md`
- [x] T089 [P] Eseguire test e build frontend completi e registrare esito in `specs/002-angular-api-first-migration/quickstart.md`
- [ ] T090 Eseguire il flusso end-to-end segretario fino a `liste_inviate` usando `specs/002-angular-api-first-migration/contracts/cutover-readiness.md` — **evidenza raccolta** (2026-07-03): flusso reale eseguito ed andato oltre, fino a `esame_concluso` (vedi `cutover-readiness.md`); rimane non spuntato perché bloccato da T111 come da regola di Phase 9
- [x] T091 [P] Aggiornare architettura, sviluppo e deploy in `readme.md`
- [ ] T092 Verificare placeholder, task completati e coerenza finale in `specs/002-angular-api-first-migration/`

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 non ha dipendenze.
- Phase 2 dipende dal setup e blocca API, Angular e cutover.
- US1 puo essere chiusa appena completati gli artifact di pianificazione.
- US2 dipende dalla foundation ed espone i contratti richiesti dal frontend.
- US3 dipende almeno dal sottoinsieme US2 `/me`, bandi e sessioni; le feature
  successive seguono le rispettive API.
- US4 dipende da build verificata e dai dati infrastrutturali forniti da ICT.
- US5 puo avanzare insieme a US2/US3 ma deve chiudersi prima della produzione.
- Phase 8 segue le user story incluse nel cutover.

### Parallel Opportunities

- T004-T006 possono procedere in parallelo dopo T002-T003.
- T008, T013 e T015 possono essere scritti su file distinti.
- T025-T030 sono test API indipendenti.
- T049-T051 sono test frontend indipendenti.
- T064-T067 sono slice UI indipendenti dopo core, auth e shell.
- T070-T071 e T075 possono procedere in parallelo.
- T088, T089 e T091 operano su aree distinte.

## Parallel Example: User Story 2

```text
Task T025: test auth/me e CSRF in tests/api/test_auth_api.py
Task T026: test bandi/sessioni in tests/api/test_bandi_sessioni_api.py
Task T028: test candidati/liste in tests/api/test_candidati_liste_api.py
Task T029: test dispositivi/scanner in tests/api/test_devices_scanner_api.py
```

## Parallel Example: User Story 3

```text
Task T064: candidati in frontend/src/app/features/candidati/
Task T065: workflow in frontend/src/app/features/workflow/
Task T066: notifiche/liste nelle rispettive feature frontend
Task T067: dispositivi in frontend/src/app/features/dispositivi/
```

## Implementation Strategy

### First Working Increment

1. Completare Setup e Foundation.
2. Chiudere US1 come gate documentale.
3. Implementare di US2: `/api/v1/me`, bandi e sessioni.
4. Implementare di US3: shell AgID, login/context, home, bandi e sessioni.
5. Fermarsi e validare test, build e navigazione end-to-end.

Questo e il primo MVP dimostrabile; non richiede ancora la migrazione di
candidati, scanner e liste.

### Incremental Delivery

1. API core + Angular shell.
2. Configurazioni bando/sessione.
3. Gestione sessione, candidati, workflow e liste.
4. Dispositivi e scanner.
5. CI/CD Baltig, ambiente test e promozione produzione.
6. Cutover solo dopo hardening e checklist completa.

## Notes

- Committare per task o gruppo logico piccolo.
- Non modificare direttamente `checkin-dev`.
- Non inserire segreti in repository, compose o variabili non protette.
- Ogni mutazione API deve avere ownership, CSRF e test di errore.
- L'uso di Design Angular Kit non sostituisce i test di accessibilita.

---

## Phase 9: Convergence — parita grafica e funzionale legacy (Priority: P1)

**Motivo dell'aggiunta**: l'audit del 2026-07-03 ha verificato che i task
T057-T069 attestano una prima implementazione Angular, ma non la parita completa
con pagine, frammenti, ruoli e stati legacy. Questa fase e bloccante per T090,
T092 e per il cutover.

**Goal**: portare tutte le righe operative di
`contracts/legacy-ui-flow-matrix.md` a `migrato` oppure a un fallback
esplicitamente approvato.

**Independent Test**: un operatore completa i flussi Segretario, Informatico in
sede, Esperto e Scanner nella UI Angular; il confronto desktop/mobile non mostra
contenuti, controlli o stati legacy mancanti.

- [x] T093 [US3] Diagnosticare l'abort con codice 134 e ripristinare la build production Angular come baseline verificabile in `frontend/` e `quickstart.md`
- [x] T094 [US3] Validare e mantenere aggiornata la mappatura pagina/frammento/route/ruolo/stato in `specs/002-angular-api-first-migration/contracts/legacy-ui-flow-matrix.md`
- [x] T095 [US2] Chiudere i gap dei contratti API rilevati dalla matrice, inclusi refresh/logout, richiesta configurazione bando, metadata/dettaglio commissione e contesto necessario alle modalita operative, in `routes/api_v1/` e `tests/api/`
- [x] T096 [US3] Allineare header, footer, navigazione comune e menu admin alla baseline `templates/header.html`, `templates/footer.html` e `templates/home.html` in `frontend/src/app/layout/` e `frontend/src/app/features/home/`
- [x] T097 [US3] Completare parita dashboard e sessioni per banner, sync/errori, titolo bando, stato configurazione, dettaglio e retry in `frontend/src/app/features/bandi/` e `frontend/src/app/features/sessioni/`
- [x] T098 [US3] Implementare dettaglio bando con RDP e componenti commissione e completare la configurazione con richiesta al referente in `frontend/src/app/features/configurazioni/`
- [x] T099 [US3] Completare sidebar, riferimenti operativi e composizione della gestione sessione secondo `templates/gestione-concorso.html` e `templates/sidebar.html` in `frontend/src/app/features/gestione-sessione/`
- [x] T100 [US3] Completare azioni, timeline, notifiche e liste per tutti gli stati e per le modalita segretario, sede ed esperto in `frontend/src/app/features/gestione-sessione/` e `frontend/src/app/features/notifiche/`
- [x] T101 [US3] Aggiungere QR candidato, stati loading/error e parita completa della tabella candidati in `frontend/src/app/features/candidati/`
- [x] T102 [US3] Implementare ricerca, filtri e mutazioni reset password per viste sede/esperto in `frontend/src/app/features/candidati/`
- [x] T103 [US3] Completare la pagina dispositivi con tutti i campi legacy, riferimenti sidebar e ciclo disconnect verificato in `frontend/src/app/features/dispositivi/`
- [x] T104 [US3] Sostituire l'inserimento manuale nello scanner con scansione fotocamera di QR sessione/candidato, stati documento, reset e disconnect in `frontend/src/app/features/scanner/`
- [x] T105 [US3] Implementare permessi e log admin in Angular oppure registrare e verificare il fallback legacy approvato in `frontend/src/app/features/admin/` e `contracts/cutover-readiness.md`
- [x] T106 [P] [US3] Aggiungere test componenti per layout, configurazione, gestione sessione, candidati/reset, dispositivi, scanner e admin in `frontend/src/app/`
- [x] T107 [P] [US3] Aggiungere fixture/scenari API per tutti gli stati workflow e ruoli necessari al confronto UI in `tests/api/`

**Gap emerso in preparazione di T108/T109 (2026-07-03)**: la verifica manuale
dello scenario Scanner ha rilevato che, dopo l'associazione di un dispositivo
via QR, lo stato macchina resta bloccato su `candidati_scaricati` e non
sblocca mai "Avvia check-in". Il legacy avanza lo stato a
`dispositivi_connessi` tramite `POST /sessione/<id>/verifica_dispositivi`
(`routes/azioni.py:958-984`), chiamato subito dopo la registrazione del
dispositivo in `templates/scanner.html:184`. Questo endpoint e la relativa
chiamata non sono mai stati portati nella migrazione. T108, T109 e T111 sono
bloccati finche questo gap non e chiuso.

- [x] T112 [US3] Scrivere test fallente per la transizione a `dispositivi_connessi` dopo la verifica dispositivi in `tests/api/test_devices_scanner_api.py`
- [x] T113 [US3] Implementare `verify_devices_connected` (conteggio dispositivi e avanzamento stato, mirror di `routes/azioni.py:958-984`) in `utils/devices_service.py`
- [x] T114 [US3] Esporre `POST /sessioni/<session_id>/devices/verify` in `routes/api_v1/devices.py`
- [x] T115 [US3] Chiamare la verifica dispositivi subito dopo la registrazione riuscita, mirror di `notifyDispositivi()` in `templates/scanner.html:184`, in `frontend/src/app/features/scanner/scanner.component.ts`
- [x] T116 [US3] Eseguire e correggere i test aggiornati e verificare a mano lo scenario scansione QR → stato `dispositivi_connessi` → sblocco "Avvia check-in", aggiornando `contracts/legacy-ui-flow-matrix.md`

Verifica manuale (2026-07-03): confermato dall'utente che, dopo la scansione
reale del QR, lo stato avanza correttamente fino a "Avvia il Check-in".

**Gap emerso verificando "Genera Liste" (2026-07-03)**: click su "Genera Liste"
mostra "Operazione non riuscita." e non la card successiva, ma il DB conferma
che lo stato avanza comunque a `liste_generate` e i file XLSX/CSV vengono
scritti correttamente su disco. Causa: `genera_moodle_csv_su_disco` chiama la
stessa API esterna JConon gia' osservata impiegare ~54s per l'import
candidati; `frontend/nginx.conf` non ha timeout di proxy espliciti e usa il
default Nginx di 60s per `proxy_read_timeout`, inferiore al timeout Gunicorn
di 120s gia' configurato in `Dockerfile`. Nginx chiude la connessione col
browser prima che il backend finisca, restituendo un errore non nel formato
JSON uniforme (da cui il messaggio generico), mentre il worker Gunicorn
completa comunque la richiesta in background.

- [x] T117 [US4] Allineare `proxy_read_timeout`/`proxy_connect_timeout`/`proxy_send_timeout` al timeout Gunicorn (120s) per le rotte proxy verso il backend in `frontend/nginx.conf`
- [x] T118 [US4] Verificare a mano che "Genera Liste" completi mostrando la card "Liste Generate" senza errori di timeout, aggiornando `contracts/legacy-ui-flow-matrix.md`

Verifica manuale (2026-07-03): confermato dall'utente che "Genera Liste"
completa correttamente e mostra la card "Liste Generate" successiva, senza
errori di timeout.

**Gap emerso verificando "Configura Bando" (2026-07-03)**: aprendo Configura
Bando per un bando non ancora sincronizzato, i componenti di commissione e
il referente/segretario suggeriti non risultano precompilati. Il legacy
(`routes/azioni.py:640-663`, `configura_bando` GET) richiama sempre
`fetch_e_salva_bando_meta`/`_fetch_bando_da_openapi` e poi
`update_bando_da_openapi` (`utils/sessioni.py:293`) ad ogni apertura pagina,
sovrascrivendo `commissione_members`/`rdp_nomi` con i dati freschi da
Selezioni Online e precompilando `email_referente`/`email_segretario` se
vuoti. Nella migrazione questa stessa logica **esiste gia'** come
`sync_bando_metadata` (`utils/jconon_service.py:63`, endpoint
`POST /api/v1/bandi/<id>/sync-meta`, gia' testata in
`tests/api/test_bandi_sessioni_api.py`) ed e' gia' collegata correttamente in
`bando-detail.component.ts` (per questo la pagina Dettaglio Bando mostra gli
RDP), ma **non e' mai richiamata da `bando-config.component.ts`**. Conferma
dati: gli RDP/commissari provengono da un endpoint dedicato
(`GET /openapi/v1/call?detailRdP=true&detailCommission=true`), non dal
download della lista candidati (`exam-sessions`).

Segnalato anche, ma **non e' un gap di parita'** (verificato: non esiste nel
legacy ne' in `templates/bando_config.html` ne' in `routes/azioni.py`): un
avviso esplicito "componenti di commissione da caricare su Selezioni Online"
quando l'elenco commissari risulta vuoto. Da valutare come funzionalita'
nuova, fuori scope della migrazione 1:1, se richiesta in futuro.

- [x] T119 [US3] Richiamare `syncMetadata` (gia' usata in `bando-detail.component.ts`) all'apertura di Configura Bando, mirror del refresh automatico di `routes/azioni.py:640-663`, in `frontend/src/app/features/configurazioni/bando-config.component.ts`

Implementato (2026-07-03): all'apertura di Configura Bando si richiama
`syncMetadata`, che aggiorna `bando_config` da Selezioni Online lato server
(`sync_bando_metadata`), poi si ricarica la configurazione (`loadConfig`) per
mostrare componenti commissione e referente/segretario precompilati.
Aggiunto indicatore di caricamento e avviso di fallback se il sync remoto
fallisce. Suite frontend: 15 file, 25 test superati. Build production
superata. Container ricostruiti.

**Limite noto, non un gap (2026-07-03)**: verificando T119, la sincronizzazione
risultava riuscita per alcuni bandi e fallita per altri in modo apparentemente
casuale. Causa confermata: 102 delle 106 commissioni nel DB di test
condividono lo stesso titolo placeholder `"999.999"` (duplicato
intenzionalmente dall'utente dentro Selezioni Online per testare il sistema
con molti concorsi). `fetch_bando_metadata` (`utils/jconon_service.py:10`)
filtra l'API esterna per `callCode` (il titolo) e poi cerca la corrispondenza
per `cmis:objectId`: con piu' bandi reali che condividono lo stesso codice
su Selezioni Online, il matching e' strutturalmente ambiguo lato API esterna,
non un difetto del codice migrato. La stessa funzione e' condivisa
identicamente dalla vecchia pagina "Dettaglio Bando" legacy, quindi
l'ambiguita' non e' introdotta dalla migrazione. Nessuna azione correttiva
necessaria; il comportamento e' atteso con dati di test che duplicano il
codice bando.

- [ ] T120 [US3] Verificare a mano che aprendo Configura Bando per un bando non ancora sincronizzato, componenti commissione ed email referente/segretario risultino precompilati come nel legacy, aggiornando `contracts/legacy-ui-flow-matrix.md`

**Richiesta utente (2026-07-03, non presente nel legacy, approvata esplicitamente)**:
nella pagina Sessioni di un bando, se i componenti di commissione risultano
vuoti (non ancora sincronizzati da Selezioni Online), mostrare un avviso
esplicito invece di lasciare la sezione silenziosamente vuota.

- [x] T121 [US3] Mostrare un avviso "Componenti di commissione non sincronizzati o non aggiornati" nella pagina Sessioni quando `bando().commissioners` risulta vuoto, in `frontend/src/app/features/sessioni/sessioni.component.ts`

Implementato (2026-07-03): avviso aggiunto in `sessioni.component.ts`, visibile
quando `bando()!.commissioners.length === 0` (dato letto da `bando_config`
via `GET /bandi/{id}`, non da un fetch live). Suite frontend: 15 file, 25
test superati. Build production superata. Container ricostruiti.

### Esito T112-T115 (2026-07-03)

- Suite backend completa: 62 test superati (6 in `test_devices_scanner_api.py`,
  incluso il nuovo scenario di transizione di stato e il rifiuto CSRF).
- Suite frontend: 15 file di test, 25 test superati.
- Build production: superata.
- Container backend/frontend ricostruiti su `deploy/compose.local.yml`.
- Resta da verificare **manualmente** con uno scan reale del QR (T116): il
  meccanismo e coperto da test automatici ma non ancora osservato end-to-end
  con fotocamera reale.

- [ ] T108 [US3] Eseguire confronto documentato desktop/mobile di ogni riga e aggiornare stato ed evidenze in `contracts/legacy-ui-flow-matrix.md`
- [ ] T109 Eseguire i flussi end-to-end Segretario, Informatico in sede, Esperto e Scanner e registrare gli esiti in `contracts/cutover-readiness.md` — **Segretario, Esperto e Scanner completati** (2026-07-03, vedi `cutover-readiness.md`); resta il flusso **Informatico in sede** (reset password)
- [x] T110 Eseguire suite backend, test frontend e build production e aggiornare `quickstart.md`
- [ ] T111 Rieseguire analisi di coerenza Spec Kit e sbloccare T090/T092 soltanto se non restano gap critici

**Checkpoint**: nessuna riga operativa e `mancante` o `parziale`; eventuali
fallback sono motivati, protetti e verificati. Solo allora si riprendono smoke,
E2E finale e cutover.
