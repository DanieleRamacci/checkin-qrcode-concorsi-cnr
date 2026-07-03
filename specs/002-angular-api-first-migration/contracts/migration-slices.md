# Contract: Migration Slices

Le slice si eseguono nell'ordine seguente. Una slice può iniziare solo dopo il
checkpoint della precedente; il fallback legacy viene rimosso esclusivamente
in Slice 6.

## Slice 0 - Hardening Preconditions

Scope:

- protect `/log`
- protect or remove debug endpoints
- add ownership decorators for `session_id` and `commission_id`
- formalize device registration and device token behavior
- update `.env.example`

Acceptance:

- no public/debug endpoint exposes sensitive data
- all session/commission API actions pass a shared authorization check
- foundation test suite verde

## Slice 1 - API Core

Scope:

- `/api/v1/me`
- `/api/v1/bandi`
- `/api/v1/bandi/{id}/sessioni`
- JSON error format
- backend capability model

Acceptance:

- Angular can render home/dashboard/sessioni without HTML endpoints
- contratti JSON, ownership, CSRF e request ID coperti da pytest

## Slice 2 - Angular Shell

Scope:

- workspace standalone Angular 21 in `frontend/`
- `design-angular-kit` 21.x configurato tramite schematico
- Bootstrap Italia SCSS, icone/assets e traduzioni
- routing
- layout accessibile con header, navigazione, breadcrumb e area messaggi
- auth state
- role-aware profile cards

Acceptance:

- user sees Segretario and, if authorized, Esperto Informatico entry points
- build e test frontend passano senza dipendenze da markup Jinja/HTMX
- navigazione da tastiera, focus e label dei componenti principali sono
  verificati

## Slice 3 - Configurazioni

Scope:

- bando config
- sessione config
- JConon/OpenAPI metadata refresh

Acceptance:

- Angular can configure bando and sessione with same semantics as current UI

## Slice 4 - Gestione Sessione

Scope:

- candidates table
- workflow actions
- notifications/timeline
- list generation/send

Acceptance:

- primary segretario flow reaches `liste_inviate`

## Slice 5 - Dispositivi and Scanner

Scope:

- device list
- registration QR
- scanner page Angular con accesso iniziale SSO
- registrazione e operazioni successive tramite device token
- candidate verify/check-in

Acceptance:

- support operator logs in with SSO, registers device, scans candidates, and
  backend records check-in with auditable device/operator context
- token scaduti o revocati non possono eseguire heartbeat o check-in

## Slice 6 - Cutover

Scope:

- fallback plan
- remove or hide migrated legacy views
- production config
- smoke tests

Acceptance:

- Angular can be enabled as primary UI with rollback to legacy path
