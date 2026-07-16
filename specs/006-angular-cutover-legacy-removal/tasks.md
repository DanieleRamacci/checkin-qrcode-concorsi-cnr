# Tasks: Cutover Angular e rimozione flusso legacy

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

**Prerequisites**: spec 002 chiusa per implementazione; deploy test disponibile
su Coolify.

**Tests**: pytest, `npm run test:ci`, `npm run build:production`, smoke HTTP e
collaudo manuale autenticato.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo su file distinti
- **[Story]**: user story della specifica

## Phase 1: Setup

- [x] T001 Attivare la feature 006 in `.specify/feature.json`
- [x] T002 [P] Aggiornare `AGENTS.md` per puntare al plan 006
- [x] T003 [P] Aggiungere la card Home "Informatico in sede" in `frontend/src/app/features/home/home.component.ts`
- [x] T004 [P] Aggiornare il test Home per la card "Informatico in sede" in `frontend/src/app/features/home/home.component.spec.ts`

## Phase 2: Foundational

- [x] T005 Verificare e aggiornare l'inventario route legacy in `specs/006-angular-cutover-legacy-removal/contracts/cutover-route-inventory.md`
- [x] T006 Aggiungere o aggiornare test backend per redirect legacy e normalizzazione `next` in `tests/test_legacy_cutover_routes.py`
- [x] T007 Aggiungere o aggiornare test frontend per assenza badge legacy nella Home e presenza card sede in `frontend/src/app/features/home/home.component.spec.ts`
- [x] T008 Eseguire `PYTHONPATH=. .venv/bin/pytest -q`, `npm run test:ci` e `npm run build:production`, registrando l'esito in `specs/006-angular-cutover-legacy-removal/quickstart.md`

## Phase 3: User Story 1 - Operatore usa solo Angular (P1)

**Goal**: i profili ordinari entrano nelle route Angular e non vedono HTML legacy.

**Independent Test**: home -> profilo -> bando/sessione -> gestione non mostra
`LEGACY HTML`.

- [ ] T009 [US1] Verificare i link Home per Segretario, Referente, Informatico in sede, Esperto e Admin in `frontend/src/app/features/home/home.component.ts`
- [ ] T010 [US1] Verificare deep link Angular e refresh SPA in `frontend/nginx.conf`
- [ ] T011 [US1] Collaudare su dominio test Home, `/bandi`, `/referenti/bandi`, `/bandi?mode=sede`, `/bandi?mode=expert` e `/bandi?mode=admin`, aggiornando `specs/006-angular-cutover-legacy-removal/quickstart.md`

## Phase 4: User Story 2 - Validazione flussi rimasti (P1)

**Goal**: chiudere le ultime prove manuali prima dello spegnimento legacy.

**Independent Test**: i flussi critici completano senza fallback legacy.

- [ ] T012 [US2] Collaudare il flusso Informatico in sede: SSO, card Home, `/bandi?mode=sede`, sessione, ricerca/filtri e segna/rimuovi reset password candidati
- [ ] T013 [US2] Collaudare il flusso Esperto: visualizzazione reset richiesti, segna eseguito/annulla e prosecuzione workflow esame
- [ ] T014 [US2] Collaudare scanner con camera reale: associazione, scansione candidato, conferma, disassociazione e riassociazione
- [ ] T015 [US2] Collaudare liste: generazione, download XLSX/CSV e invio liste nella UI Angular
- [ ] T016 [US2] Aggiornare `specs/002-angular-api-first-migration/contracts/cutover-readiness.md` con le evidenze finali o migrare le evidenze definitive in un contratto 006

## Phase 5: User Story 3 - Badge legacy evidente (P2)

**Goal**: qualunque pagina HTML legacy ancora renderizzabile e' immediatamente
riconoscibile.

**Independent Test**: route legacy renderizzata mostra `LEGACY HTML`; Angular no.

- [ ] T017 [US3] Cercare tutti i render template HTML legacy in `routes/` e verificare badge o redirect
- [ ] T018 [US3] Verificare manualmente le pagine HTML legacy ancora raggiungibili e aggiornare `specs/006-angular-cutover-legacy-removal/contracts/cutover-route-inventory.md`
- [x] T019 [US3] Aggiungere test backend o smoke per intercettare pagine legacy non marcate in `tests/test_legacy_bando_config_visibility.py`

## Phase 6: User Story 4 - Route legacy governate o rimosse (P2)

**Goal**: ogni URL legacy ha una decisione applicata e verificata.

**Independent Test**: l'inventario route legacy e' completamente in stato
`validated`, `technical`, `admin_only` o `removed`.

- [ ] T020 [US4] Eseguire smoke su tutte le route in `contracts/cutover-route-inventory.md` contro il dominio test
- [ ] T021 [US4] Bloccare o reindirizzare eventuali route legacy non inventariate trovate durante lo smoke in `routes/` o `frontend/nginx.conf`
- [ ] T022 [US4] Verificare che gli endpoint tecnici consentiti (API, auth, healthcheck, QR/PDF/download) restino disponibili senza UI legacy

## Final Phase: Polish & Cutover Decision

- [ ] T023 Aggiornare `docs/migrazione/stato-avanzamento.md` con esito 006 e decisione cutover
- [ ] T024 Aggiornare `specs/006-angular-cutover-legacy-removal/spec.md` da `Draft` a stato finale appropriato
- [ ] T025 Rieseguire `git diff --check`, placeholder scan della 006 e test/build completi
- [ ] T026 Preparare commit con descrizione chiara della 006

## Dependencies and Execution Order

- Phase 1 e 2 sono prerequisiti.
- US1 e US2 sono P1 e bloccano il cutover.
- US3 e US4 possono avanzare in parallelo dopo l'inventario iniziale.
- La fase finale parte solo dopo test automatici, smoke e collaudo manuale.

## Parallel Example

```text
T012 collaudo Informatico in sede
T013 collaudo Esperto
T014 collaudo Scanner
T015 collaudo Liste
```

## Implementation Strategy

1. Chiudere test automatici e card sede.
2. Validare i profili ordinari su dominio test.
3. Completare collaudo manuale dei flussi rimasti.
4. Applicare redirect/blocchi mancanti.
5. Decidere rimozione definitiva dei fallback legacy pubblici.
