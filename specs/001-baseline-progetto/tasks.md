# Tasks: Baseline Ufficiale Progetto Esistente

**Input**: Design documents from `specs/001-baseline-progetto/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`, `quickstart.md`

**Tests**: Questa feature e documentale. I test sono controlli di validazione
documentale e coerenza con il codice.

**Organization**: Tasks grouped by user story to keep the baseline independently
verifiable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure official Spec Kit structure is present and points to the
baseline feature.

- [ ] T001 Verify `.specify/memory/constitution.md` exists and contains no template placeholders
- [ ] T002 Verify `.specify/feature.json` points to `specs/001-baseline-progetto`
- [ ] T003 [P] Verify `specs/001-baseline-progetto/checklists/requirements.md` is complete
- [ ] T004 [P] Update `AGENTS.md` to reference `specs/001-baseline-progetto/plan.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the baseline is based on the existing repository, not on a
future rewrite.

- [ ] T005 Review `server_pg.py`, `routes/__init__.py`, and `requirements.txt` against `specs/001-baseline-progetto/plan.md`
- [ ] T006 Review `init_db.py` against `specs/001-baseline-progetto/data-model.md`
- [ ] T007 Review `utils/stato.py` against state lists in `specs/001-baseline-progetto/spec.md` and `data-model.md`
- [ ] T008 Review route inventory from `routes/` and `server_pg.py` against `specs/001-baseline-progetto/contracts/current-http-map.md`
- [ ] T009 Review bando/sessione configuration changes in `routes/azioni.py`, `utils/sessioni.py`, `utils/jconon_referenti.py`, `templates/bando_config.html`, and `templates/bando_dettaglio.html`

**Checkpoint**: baseline source mapping is ready.

---

## Phase 3: User Story 1 - Comprendere il prodotto esistente (Priority: P1) MVP

**Goal**: A stakeholder can understand the current product behavior from the
official Spec Kit baseline.

**Independent Test**: Read `spec.md` and confirm it explains actors, flows,
states, current scope and assumptions without requiring code inspection.

- [ ] T010 [US1] Validate actors and flow descriptions in `specs/001-baseline-progetto/spec.md`
- [ ] T011 [US1] Validate state workflow in `specs/001-baseline-progetto/spec.md` against `utils/stato.py`
- [ ] T012 [US1] Validate assumptions distinguish as-is baseline from future work in `specs/001-baseline-progetto/spec.md`

**Checkpoint**: User Story 1 is independently usable as the baseline narrative.

---

## Phase 4: User Story 2 - Validare architettura, dati e contratti attuali (Priority: P2)

**Goal**: A maintainer can locate architecture, data model and current HTTP
contracts.

**Independent Test**: Use `quickstart.md` commands to cross-check entry points,
routes, states and schema.

- [ ] T013 [US2] Validate technical stack and project structure in `specs/001-baseline-progetto/plan.md`
- [ ] T014 [US2] Validate table coverage in `specs/001-baseline-progetto/data-model.md` against `init_db.py`
- [ ] T015 [US2] Validate route coverage in `specs/001-baseline-progetto/contracts/current-http-map.md`
- [ ] T016 [US2] Validate quickstart commands in `specs/001-baseline-progetto/quickstart.md`
- [ ] T017 [US2] Validate bando/sessione split coverage in `specs/001-baseline-progetto/spec.md`, `data-model.md`, and `contracts/current-http-map.md`

**Checkpoint**: User Story 2 provides a maintainable technical map.

---

## Phase 5: User Story 3 - Preparare evoluzione e migrazione senza mischiare fasi (Priority: P3)

**Goal**: The team can separate current baseline, technical gaps and future
Angular/API migration work.

**Independent Test**: Read `research.md`, `contracts/angular-readiness.md`, and
this `tasks.md`; confirm Angular is framed as a future feature.

- [ ] T018 [US3] Validate decisions in `specs/001-baseline-progetto/research.md`
- [ ] T019 [US3] Validate Angular prerequisites in `specs/001-baseline-progetto/contracts/angular-readiness.md`
- [ ] T020 [US3] Confirm no Angular implementation files are introduced by the baseline feature
- [ ] T021 [US3] Create future Spec Kit feature proposal for security hardening after baseline approval
- [ ] T022 [US3] Create future Spec Kit feature proposal for `/api/v1` Angular-ready JSON contracts after baseline approval

**Checkpoint**: future work is staged without changing application behavior.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Make the official baseline discoverable and remove ambiguity with
preparatory notes.

- [ ] T023 Update `readme.md` to link the official baseline at `specs/001-baseline-progetto/spec.md`
- [ ] T024 Confirm preparatory `docs/spec-kit/` remains removed so the official source is `specs/001-baseline-progetto/`
- [ ] T025 Run placeholder scan from `specs/001-baseline-progetto/quickstart.md`
- [ ] T026 Run `git status --short` and confirm only intended documentation/Spec Kit files were added or changed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup
- **User Story 1 (Phase 3)**: depends on Foundational
- **User Story 2 (Phase 4)**: depends on Foundational
- **User Story 3 (Phase 5)**: depends on User Story 1 and User Story 2
- **Polish**: depends on desired user stories being complete

### User Story Dependencies

- **US1**: required MVP for baseline acceptance
- **US2**: can proceed after Foundational and can be reviewed in parallel with US1
- **US3**: should be reviewed after US1/US2 so future work is grounded in the baseline

### Parallel Opportunities

- T003 and T004 can run in parallel.
- T005, T006, T007 and T008 can be reviewed in parallel.
- T012, T013, T014 and T015 can be reviewed in parallel.
- T016 and T017 can be reviewed in parallel.

## Implementation Strategy

### MVP First

1. Complete Phase 1.
2. Complete Phase 2.
3. Validate US1.
4. Stop and approve baseline narrative before planning code changes.

### Incremental Delivery

1. Approve baseline narrative.
2. Approve architecture/data/contracts.
3. Convert gap areas into separate Spec Kit features.
4. Plan Angular only after API readiness is specified.

## Notes

- Tasks T019 and T020 are intentionally future proposal tasks, not implementation
  work inside this baseline.
- No source code changes are required for this baseline feature.
