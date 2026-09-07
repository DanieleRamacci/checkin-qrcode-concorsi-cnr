# Tasks: Stabilizzazione collaudo e correzione flussi

**Input**: Design documents from `specs/010-collaudo-bugfix-flow/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/regression-contract.md`

## Phase 1: Setup

- [x] T001 Create feature spec and checklist in `specs/010-collaudo-bugfix-flow/spec.md` and `specs/010-collaudo-bugfix-flow/checklists/requirements.md`
- [x] T002 Create implementation plan and design artifacts in `specs/010-collaudo-bugfix-flow/`

## Phase 2: Foundational

- [x] T003 Add `.tokensave/` exclusion in `.gitignore`
- [x] T004 Verify TokenSave availability and document MCP mismatch in final report

## Phase 3: User Story 1 - Sessione scaduta gestita come nuovo login (P1)

**Independent Test**: `/me` and API calls that return auth/reauth 401 trigger login; non-auth operational errors do not.

- [x] T005 [US1] Add backend `/me` reauthentication check in `routes/api_v1/auth.py`
- [x] T006 [US1] Add Angular reauth interceptor in `frontend/src/app/core/reauth.interceptor.ts`
- [x] T007 [US1] Register reauth interceptor in `frontend/src/app/app.config.ts`
- [x] T008 [US1] Add backend auth tests in `tests/api/test_auth_api.py`
- [x] T009 [US1] Add frontend interceptor tests in `frontend/src/app/core/reauth.interceptor.spec.ts`

## Phase 4: User Story 2 - Profili operativi proposti solo agli utenti corretti (P1)

**Independent Test**: Home hides "Informatico in sede" for non-assigned users and shows it for assigned/admin users.

- [x] T010 [US2] Add `sede_workflow` capability definition in `utils/permissions.py`
- [x] T011 [US2] Add sede assignment lookup in `utils/authorization.py`
- [x] T012 [US2] Expose sede workflow capability from `routes/api_v1/auth.py`
- [x] T013 [US2] Hide/show Home sede card in `frontend/src/app/features/home/home.component.ts`
- [x] T014 [US2] Add Home visibility tests in `frontend/src/app/features/home/home.component.spec.ts`

## Phase 5: User Story 3 - Accesso amministrativo di supporto coerente (P1)

**Independent Test**: admin technical access is allowed as support; non-admin assignment checks remain active.

- [x] T015 [US3] Allow admin support in technical authorization paths in `utils/authorization.py`
- [x] T016 [US3] Use admin support scope for technical bando lists in `routes/api_v1/bandi.py`
- [x] T017 [US3] Use admin support scope for technical session lists in `routes/api_v1/sessioni.py`
- [x] T018 [US3] Update authorization/API tests in `tests/test_authorization.py` and `tests/api/test_bandi_sessioni_api.py`

## Phase 6: User Story 4 - Link e artefatti tecnici preservano il contesto (P2)

**Independent Test**: legacy redirects preserve mode and QR PDF produces a complete device link.

- [x] T019 [US4] Preserve `mode` in legacy `/sessioni` redirect in `frontend/nginx.conf`
- [x] T020 [US4] Generate QR PDF with token and isolated temporary file in `server_pg.py`
- [x] T021 [US4] Add legacy redirect and QR/PDF regression checks in `tests/test_legacy_cutover_routes.py`

## Phase 7: User Story 5 - Chiusura collaudo formalizzata prima degli utenti reali (P2)

**Independent Test**: documentation identifies fixed bugs, remaining manual checks and readiness gate for real users.

- [x] T022 [US5] Update `specs/009-collaudo-chiusura-spec/collaudo-2026-07-20.md` with bugfix results
- [x] T023 [US5] Update `specs/009-collaudo-chiusura-spec/piano-collaudo-stampabile-2026-07-27.md` with manual retest checklist
- [ ] T024 [US5] Execute manual internal validation from `specs/010-collaudo-bugfix-flow/quickstart.md`
- [x] T025 [US5] Record readiness decision for real-user testing in `specs/010-collaudo-bugfix-flow/tasks.md`

### Readiness decision - 2026-09-07

- **Produzione generale**: NON PRONTA.
- **Server test dopo push/pull/deploy**: PRONTO PER PRIMA PROVA CONTROLLATA.
- **Motivo**: bug applicativi bloccanti corretti e suite automatiche verdi; manca
  ritest manuale sul server test con versione deployata, utenti U0-U6, verifica
  Nginx/container, scanner/QR reale, liste e separazione test/produzione.
- **Gate successivo**: completare T024 e registrare esiti nel verbale 009 prima
  di dichiarare `PRONTA PRODUZIONE`.

## Final Phase: Polish & Cross-Cutting

- [x] T026 Run backend suite with `PYTHONPATH=. .venv/bin/pytest -q`
- [x] T027 Run frontend tests with `npm run test:ci`
- [x] T028 Run frontend production build with `npm run build:production`
- [x] T029 Run whitespace check with `git diff --check`

## Dependencies

- US1, US2 and US3 are P1 and can be validated independently.
- US4 depends only on route/legacy artifacts.
- US5 depends on completion of implemented bugfixes and internal manual checks.

## Parallel Execution Examples

- T008 and T009 can run in parallel after T005-T007.
- T014 and T018 can run in parallel after their implementation tasks.
- T022 and T023 can run in parallel after automated validation.

## Implementation Strategy

MVP completed with US1, US2 and US3. US4 completed as compatibility hardening.
US5 remains the gate before test with utenti reali.
