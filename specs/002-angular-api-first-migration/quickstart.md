# Quickstart: Migration Planning and Increment Validation

This quickstart validates the migration plan artifacts and defines the commands
used as each implementation slice becomes available.

## Verify Branch

```bash
git status --short --branch
```

Expected:

- branch is `migration/angular-api-first`
- working tree contains only spec/planning changes

### Baseline result (2026-07-02)

- Python development environment rebuilt with Python 3.11 from
  `requirements-dev.txt`
- `python -m pytest -q` discovers no source tests
- `tests/` contained only a stale ignored bytecode artifact, so API and
  security tests in `tasks.md` are a blocking migration deliverable

## Verify Spec Kit Feature

```bash
cat .specify/feature.json
find specs/002-angular-api-first-migration -maxdepth 3 -type f | sort
```

Expected files:

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `quickstart.md`
- `contracts/api-v1-target.md`
- `contracts/migration-slices.md`
- `contracts/legacy-ui-flow-matrix.md`
- `contracts/cutover-readiness.md`
- `checklists/requirements.md`
- `tasks.md`

## Verify No Placeholder Remains

```bash
rg "\\[[A-Z][A-Z_ ]{2,}\\]|NEEDS.CLARIFICATION|\\$ARGUMENTS" \
  specs/002-angular-api-first-migration/spec.md \
  specs/002-angular-api-first-migration/plan.md \
  specs/002-angular-api-first-migration/research.md \
  specs/002-angular-api-first-migration/data-model.md \
  specs/002-angular-api-first-migration/contracts \
  specs/002-angular-api-first-migration/tasks.md
```

Expected: no output.

## Validate Scope

```bash
rg "piattaforma esami|Moodle futura|fuori scope|checkin-dev|/api/v1|Angular" specs/002-angular-api-first-migration -n
```

Expected:

- future exam platform is out of scope
- `checkin-dev` remains baseline
- API-first and Angular are explicit

## Verify Frontend Toolchain Decision

```bash
node --version
rg "Angular 21|design-angular-kit|Bootstrap Italia|Node.js 24" \
  specs/002-angular-api-first-migration
```

Expected:

- local Node is version 24.x
- Angular 21 LTS and `design-angular-kit` 21.x are pinned in the plan
- the kit is installed as a dependency, not copied into the repository

### Frontend setup result (2026-07-02)

- Angular CLI 21.2.18 and Angular 21.2.17
- TypeScript 5.9.3, Vitest 4.1.9 and Node.js 24.4.1
- Design Angular Kit 21.2.0 and Bootstrap Italia 2.18.1
- `npm run test:ci`: 1 test file and 2 tests passed
- `npm run build:production`: passed, initial bundle 2.07 MB raw / 433.58 kB
  estimated transfer
- Sass deprecation and CommonJS warnings originate in the current Design
  Angular Kit/Bootstrap Italia dependency tree and remain visible

## Validate API Slice

When `/api/v1` is implemented:

```bash
pytest -q tests/api
```

Expected:

- authenticated and unauthenticated cases are covered
- ownership and role failures return the uniform JSON error format
- workflow state remains controlled by backend services

### API core result (2026-07-02)

- `/api/v1/me`, `/api/v1/bandi`, `/api/v1/bandi/{commission_id}`,
  `/api/v1/bandi/{commission_id}/sessioni` e `/api/v1/sessioni/{session_id}`
  implementati
- ownership, autenticazione, request ID, errori JSON e CSRF foundation coperti
  da 33 test backend
- configurazioni, workflow, candidati, liste, dispositivi, scanner, notifiche,
  ruoli e sincronizzazioni esterne esposti tramite API v1
- route Jinja/HTMX legacy mantenute come fallback

## Validate Angular Slice

When `frontend/` is implemented:

```bash
cd frontend
npm ci
npm run test:ci
npm run build:production
```

Expected:

- unit tests pass
- production build completes
- no component calls Jinja/HTMX endpoints
- Bootstrap Italia assets and Design Angular Kit translations are included

### Angular complete slice result (2026-07-02)

- 6 file di test frontend e 8 test superati
- build production superata: bundle iniziale 2,06 MB raw / 434,65 kB stimati
- route lazy per home, bandi, sessioni, configurazioni, gestione sessione e
  scanner
- shell con skip link, landmark, heading, label esplicite, focus visibile e
  layout responsive
- i warning Sass/CommonJS provengono dal grafo dipendenze corrente di
  Design Angular Kit/Bootstrap Italia

### Local container result (2026-07-02)

- immagini `checkin/backend:local` e `checkin/frontend:local` costruite
- PostgreSQL, Redis e backend healthy
- smoke test su `http://localhost:18080`: frontend, `/healthz` e
  `/api/v1/health` rispondono `200`

## Validate First End-to-End Increment

Run Flask and Angular with the development proxy, then verify:

1. unauthenticated navigation redirects to backend OIDC login
2. `/api/v1/me` renders the authenticated profile and capabilities
3. the bando list and session list use JSON API responses
4. keyboard navigation and visible focus work through header, cards and lists
5. the legacy UI remains reachable as the fallback documented for the slice

## Convergence audit result (2026-07-03)

- `PYTHONPATH=. .venv/bin/pytest -q`: 36 backend tests passed.
- `npm run test:ci`: 6 test files and 8 tests passed.
- `./node_modules/.bin/ngc -p tsconfig.app.json`: TypeScript/Angular compilation
  passed.
- `npm run build:production`: passed outside the restricted execution sandbox;
  initial bundle 2.06 MB raw / 435.04 kB estimated transfer. The exit code 134
  observed inside the sandbox was caused by denied system operations and is not
  a source or TypeScript failure.
- The legacy parity audit classifies 12 areas as partial, 4 as missing and 1
  debug-only fallback in `contracts/legacy-ui-flow-matrix.md`.

### Convergence implementation checkpoint (2026-07-03)

- T093-T107 completed.
- Backend suite: 60 tests passed.
- Frontend suite: 15 test files and 25 tests passed.
- Production build passed: initial bundle 2.06 MB raw / 435.12 kB estimated
  transfer.
- Implemented API gaps, legacy-aligned shared layout/home, dashboard/session
  synchronization states, bando detail/configuration and operational sidebar.
- Visual acceptance remains pending in T108; the matrix rows therefore remain
  `partial` until desktop/mobile comparison.
- Scanner camera flow implemented in T104 with session/candidate QR modes,
  association reset and 13 passing frontend tests.
- Session management now propagates secretary/site/expert modes, exposes the
  expert workflow and list downloads, marks the active timeline step and polls
  internal notifications every 10 seconds.
- Candidate parity now includes QR generation, loading/error states and
  reversible reset-password workflows for site/expert views.
- Device parity now includes operational sidebar references, the legacy device
  name field, status ordering and a verified disconnect endpoint.
- Admin role management and all four legacy log sections are available through
  guarded Angular routes and admin-only APIs.
- Workflow fixtures cover every state from `iniziale` to `esame_concluso` and
  the secretary/expert authorization contexts used by the UI.
- Latest production build passed with initial bundle 2.06 MB raw / 435.79 kB
  estimated transfer; the rebuilt backend/frontend stack passed `/healthz`,
  `/api/v1/health` and `/` smoke checks on `http://localhost:18080`.
