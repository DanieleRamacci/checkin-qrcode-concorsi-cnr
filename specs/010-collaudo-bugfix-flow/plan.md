# Implementation Plan: Stabilizzazione collaudo e correzione flussi

**Branch**: `test` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-collaudo-bugfix-flow/spec.md`

## Summary

Stabilizzare i difetti bloccanti emersi dalla verifica di collaudo prima di
passare a test con utenti reali. L'approccio e' incrementale: correggere
reauth, visibilita profili, supporto admin tecnico, redirect legacy e QR/PDF;
aggiungere test automatici mirati; poi aggiornare la documentazione di collaudo
e preparare una sessione manuale con identita reali o equivalenti.

## Technical Context

**Language/Version**: Python 3.11, TypeScript 5.9

**Primary Dependencies**: Flask, PostgreSQL/psycopg2, Angular 21, RxJS, FPDF,
qrcode, Nginx

**Storage**: PostgreSQL per ruoli, bandi, sessioni e configurazioni; sessione
server-side Flask per autenticazione OIDC

**Testing**: pytest per backend e route legacy; Angular/Vitest tramite
`ng test --watch=false`; build produzione Angular

**Target Platform**: applicazione web containerizzata con backend Flask e
frontend Angular servito da Nginx

**Project Type**: web application con backend API, frontend Angular e route
legacy residue durante cutover

**Performance Goals**: nessuna nuova operazione pesante; i controlli aggiunti
devono restare nell'ordine dei lookup gia presenti sui flussi autenticati

**Constraints**: autorizzazione prima della logica; backend fonte di verita;
preservare compatibilita con route legacy tecniche ancora mantenute

**Scale/Scope**: correzione mirata su flussi di collaudo 006, 007, 008 e 009;
nessuna migrazione schema prevista

## Constitution Check

*GATE: Passed before implementation. Re-check after design: Passed.*

- **Stato Applicativo Esplicito**: nessuna nuova transizione di stato; i flussi
  corretti preservano stati esistenti.
- **Autorizzazione Prima della Logica**: i profili tecnici verificano ruolo o
  relazione prima di esporre dati; l'admin e' trattato come supporto esplicito.
- **Backend Come Fonte di Verita**: la Home riceve capability dal backend, non
  decide autonomamente assegnazioni operative.
- **Integrazioni Isolate e Tracciabili**: la reauth distingue problemi OIDC da
  errori di Selezioni Online o servizi esterni.
- **Migrazione Incrementale e Verificabile**: route legacy e QR/PDF vengono
  corretti senza riaprire il frontend legacy.

## Project Structure

### Documentation (this feature)

```text
specs/010-collaudo-bugfix-flow/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── regression-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
routes/api_v1/
├── auth.py
├── bandi.py
└── sessioni.py

utils/
├── authorization.py
└── permissions.py

frontend/
├── nginx.conf
└── src/app/
    ├── app.config.ts
    ├── core/
    │   ├── reauth.interceptor.ts
    │   └── reauth.interceptor.spec.ts
    └── features/home/
        ├── home.component.ts
        └── home.component.spec.ts

tests/
├── api/
│   ├── test_auth_api.py
│   └── test_bandi_sessioni_api.py
├── test_authorization.py
└── test_legacy_cutover_routes.py

server_pg.py
```

**Structure Decision**: mantenere modifiche dentro i moduli gia responsabili dei
flussi: auth/capability in API, autorizzazioni in `utils`, reauth in interceptor
Angular, redirect in Nginx, QR/PDF nella route legacy esistente.

## Complexity Tracking

Nessuna violazione costituzionale rilevata.
