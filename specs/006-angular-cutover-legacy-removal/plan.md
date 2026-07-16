# Implementation Plan: Cutover Angular e rimozione flusso legacy

**Branch**: `006-angular-cutover-legacy-removal` | **Date**: 2026-07-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-angular-cutover-legacy-removal/spec.md`

## Summary

Chiudere il passaggio operativo ad Angular come unico frontend utente. La spec
002 ha completato la migrazione implementativa API-first/Angular; questa spec
governa il cutover: inventario delle route legacy, redirect/blocchi, badge
`LEGACY HTML` durante la transizione, collaudo autenticato finale e rimozione
dei fallback pubblici non tecnici.

Il lavoro non cambia il metodo di login: segretario, referente, informatico in
sede, esperto e admin continuano ad accedere via SSO CNR. In particolare,
l'ingresso "Informatico in sede" e' una card Home verso `/bandi?mode=sede`; il
reset password riguarda i candidati, non l'autenticazione dell'informatico.

## Technical Context

**Language/Version**: Python 3.11 + Flask per backend; TypeScript 5.9.x,
Angular 21.2.x e Node.js 24.x per frontend.

**Primary Dependencies**: Flask, Flask-Session, psycopg2, Redis opzionale,
Gunicorn; Angular CLI, RxJS, Bootstrap Italia, `design-angular-kit`, Nginx static
frontend.

**Storage**: PostgreSQL esistente; filesystem per liste/QR/PDF; session store
server-side.

**Testing**: pytest per backend/API/redirect; Angular/Vitest tramite
`npm run test:ci`; `npm run build:production`; smoke HTTP; collaudo manuale
autenticato su dominio test.

**Target Platform**: web app containerizzata in Coolify, frontend Angular statico
e backend Flask instradati same-origin.

**Project Type**: applicazione web gestionale con backend API e frontend SPA.

**Performance Goals**: nessuna regressione nei flussi check-in; refresh/deep
link Angular devono essere serviti dalla SPA senza round trip a pagine HTML
legacy.

**Constraints**: non reintrodurre dipendenza Angular da HTML/HTMX; mantenere
disponibili solo endpoint tecnici necessari (API, login/logout/callback,
healthcheck, QR/PDF/download); proteggere debug/admin; non rimuovere fisicamente
template finche il collaudo 006 non e' completo.

**Scale/Scope**: tutte le route utente legacy note, tutti i profili operativi
gia migrati in Angular, badge transitorio sulle pagine HTML legacy ancora
renderizzabili.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Stato Applicativo Esplicito**: PASS. Il cutover non cambia gli stati di
  sessione; verifica che le transizioni restino backend/API.
- **II. Autorizzazione Prima della Logica**: PASS con attenzione a route legacy.
  Ogni fallback mantenuto deve restare protetto o limitato a sviluppo/admin.
- **III. Backend Come Fonte di Verita**: PASS. Angular resta consumer API; le
  regole reset/list/check-in rimangono nei servizi backend.
- **IV. Integrazioni Isolate e Tracciabili**: PASS. SOL, SMTP, liste e QR
  restano in moduli backend; il cutover valida solo esposizione frontend/route.
- **V. Migrazione Incrementale e Verificabile**: PASS. La 006 e' la fase
  successiva alla 002 e conserva rollback finche il collaudo non e' chiuso.

**Post-design re-check (2026-07-16)**: PASS. Gli artifact separano decisioni di
route, dati di validazione e task; nessuna rimozione fisica di legacy e' prevista
prima del completamento della checklist.

## Project Structure

### Documentation (this feature)

```text
specs/006-angular-cutover-legacy-removal/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cutover-route-inventory.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code

```text
routes/
├── auth.py              # normalizzazione next post-login
├── dashboard.py         # redirect ingressi legacy dashboard/sessioni
├── azioni.py            # redirect gestione sessione/config legacy
├── dispositivi.py       # redirect dispositivi/device-link legacy
└── api_v1/              # endpoint JSON da mantenere

templates/               # legacy HTML con badge transitorio
frontend/
├── nginx.conf           # proxy pubblico e fallback SPA
└── src/app/
    ├── app.routes.ts
    ├── features/home/
    ├── features/bandi/
    ├── features/gestione-sessione/
    ├── features/candidati/
    ├── features/dispositivi/
    ├── features/scanner/
    └── features/admin/

tests/
├── test_*.py
└── api/
frontend/src/app/**/*.spec.ts
```

**Structure Decision**: usare la struttura esistente Flask + Angular. La 006
deve ridurre l'esposizione HTML legacy tramite redirect/proxy/test, non creare
un nuovo frontend o un nuovo backend.

## Complexity Tracking

Nessuna violazione costituzionale prevista. La complessita principale e' di
collaudo: alcune verifiche richiedono browser autenticato, camera reale o
integrazioni esterne e non possono essere sostituite solo da unit test.
