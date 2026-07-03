# Implementation Plan: Migrazione API-first e Angular

**Branch**: `migration/angular-api-first` | **Date**: 2026-07-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-angular-api-first-migration/spec.md`

## Summary

Migrare il sistema Check-in CNR Concorsi verso un'architettura API-first con
backend Flask stabilizzato, API JSON versionate e frontend Angular separato.
Il frontend usa il toolkit ufficiale `design-angular-kit`, basato su Bootstrap
Italia, per componenti, struttura visiva e accessibilita dei servizi web della
PA.

La migrazione non include la piattaforma esami futura. Il branch `checkin-dev`
resta la baseline funzionante; questo branch definisce e poi implementera la
migrazione senza interrompere la versione attuale.

## Technical Context

**Language/Version**: Python 3.11 + Flask per backend corrente; TypeScript
5.9.x, Angular 21.2.x LTS e Node.js 24.x per il frontend

**Primary Dependencies**: Flask, Flask-Session, psycopg2, Redis opzionale,
requests, PyJWT, Gunicorn; Angular CLI 21.x, RxJS 7.8.x, Angular HTTP client,
`design-angular-kit` 21.2.x, Bootstrap Italia 2.18.x e `ngx-translate`

**Storage**: PostgreSQL esistente; filesystem per liste; Redis per sessioni in
produzione

**Testing**: pytest per backend API/service; Vitest per componenti e servizi
Angular; build Angular production; controlli accessibilita e checklist
end-to-end per flussi critici

**Target Platform**: web app containerizzata; sviluppo con backend Flask e
frontend Angular separati tramite dev proxy; test e produzione gestiti da
Coolify con container statico Angular e container Flask instradati dallo stesso
reverse proxy/origin

**Project Type**: applicazione web gestionale con backend API e frontend SPA

**Performance Goals**: evitare regressioni nei flussi check-in; mantenere il
bundle iniziale sotto 2,5 MB raw nella baseline Design Angular Kit e ridurlo
progressivamente tramite route lazy e import selettivi

**Constraints**: non toccare `checkin-dev`; non includere piattaforma esami;
preservare OIDC backend iniziale; migrare per milestone; non far dipendere
Angular da HTML/HTMX; mantenere compatibilita tra major Angular e
`design-angular-kit`; non copiare il repository del kit dentro il progetto;
proteggere con token CSRF le mutazioni API autenticate tramite cookie

**Authentication Validation**: OIDC state monouso in sessione; firma JWT via
JWKS; issuer e audience configurati esplicitamente; nessun token viene
considerato valido sulla sola base dei claim decodificati

**Scale/Scope**: migrazione completa del dominio check-in corrente: profili,
bandi/sessioni, configurazioni, candidati, dispositivi, scanner, liste,
notifiche, amministrazione e ruolo locale `esperto_informatico`. I template e i
frammenti legacy costituiscono la baseline grafica e funzionale fino alla
validazione della relativa slice.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Stato Applicativo Esplicito**: PASS. Workflow resta backend e viene
  esposto come capability/API.
- **II. Autorizzazione Prima della Logica**: PASS con prerequisito. Ownership
  uniforme e debug hardening sono richiesti prima del cutover.
- **III. Backend Come Fonte di Verita**: PASS. Angular non duplica regole di
  dominio.
- **IV. Integrazioni Isolate e Tracciabili**: PASS. JConon/OpenAPI e mail
  restano in integration/service layer.
- **V. Migrazione Incrementale e Verificabile**: PASS. La migrazione e divisa in
  milestone con fallback legacy.

**Post-design re-check**: PASS. L'adozione di `design-angular-kit` riguarda il
presentation layer; stato, autorizzazioni, integrazioni e source of truth
restano nel backend. Il frontend viene introdotto dopo API e hardening minimi,
con build e smoke test indipendenti.

**Implementation re-check (2026-07-02)**: PASS. La foundation applica
ownership condivisa, protegge log/debug, formalizza scadenza e revoca dei
device token e limita il CSRF alle API v1 cookie-based. I 13 test foundation
passano; il fallback legacy resta disponibile.

**Convergence re-check (2026-07-03)**: PASS con blocco al cutover. L'audit ha
rilevato che build, test unitari e presenza dei componenti non dimostrano la
parita con i template. Il fallback legacy deve restare disponibile finche tutte
le righe operative di `contracts/legacy-ui-flow-matrix.md` non sono migrate o
classificate esplicitamente come fallback approvato.

## Project Structure

### Documentation (this feature)

```text
specs/002-angular-api-first-migration/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-v1-target.md
│   ├── migration-slices.md
│   ├── legacy-ui-flow-matrix.md
│   └── cutover-readiness.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (target structure)

```text
.
├── backend/
│   └── app/                 # target logical structure, can be introduced gradually
│       ├── api/v1/
│       ├── services/
│       ├── repositories/
│       ├── integrations/
│       ├── auth/
│       └── schemas/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   ├── features/
│   │   │   ├── layout/
│   │   │   └── shared/
│   │   ├── assets/i18n/
│   │   └── styles.scss
│   ├── angular.json
│   ├── package.json
│   └── proxy.conf.json
├── routes/                  # legacy Flask routes retained during migration
├── utils/                   # gradually migrated into services/integrations
├── templates/               # legacy fallback until cutover
└── specs/
```

**Structure Decision**: introdurre un'app Angular standalone in `frontend/` e
API `/api/v1` progressivamente. Il workspace viene creato con Angular CLI e il
kit viene aggiunto come dipendenza tramite il suo schematico `ng add`, usando
`provideDesignAngularKit` e import selettivi dei componenti. Gli stili
Bootstrap Italia, gli asset e le traduzioni vengono configurati nel workspace,
senza clonare o modificare il sorgente del kit.

Non e necessario spostare subito tutto il backend in `backend/app`; il target
puo essere raggiunto per fasi creando service layer e API accanto al codice
esistente.

### Metodo di convergenza UI e flussi

La migrazione riparte dalla matrice `contracts/legacy-ui-flow-matrix.md`, non
dalla sola presenza di un componente Angular. Per ogni riga:

1. inventariare route, template, frammenti, JavaScript e condizioni di ruolo o
   stato;
2. verificare che il contratto API esponga dati e azioni necessari;
3. implementare la vista Angular mantenendo struttura, gerarchia, testi e
   feedback operativi della baseline con Design Angular Kit/Bootstrap Italia;
4. coprire gli stati caricamento, vuoto, errore, successo e polling;
5. confrontare desktop/mobile ed eseguire lo scenario end-to-end;
6. aggiornare matrice e cutover checklist.

Le differenze intenzionali rispetto al legacy richiedono una decisione
documentata nella matrice. Nessuna pagina viene considerata migrata soltanto
perche compila o possiede una route.

In sviluppo `proxy.conf.json` inoltra `/api`, `/login`, `/logout` e callback
OIDC a Flask. In test e produzione reverse proxy e frontend mantengono un
singolo origin per evitare CORS e conservare la sessione cookie backend.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Coesistenza Jinja/HTMX + Angular | Riduce rischio di cutover | Riscrittura unica aumenterebbe rischio operativo |
| API layer parallelo alle route attuali | Serve a non rompere flussi esistenti | Convertire route esistenti in-place renderebbe difficile rollback |
| Hardening backend come prerequisito | Angular non corregge autorizzazioni/debug | Ignorarlo porterebbe bug backend nella nuova UI |
| Angular 21 invece dell'ultima major Angular | E la major LTS compatibile con la release 21.x corrente del kit AgID | Angular 22 non ha ancora una linea stabile dichiarata dal kit |

## Time Estimate

Stima per parita funzionale ragionevole: **8-12 sessioni operative con Codex**.

Stima calendario se si lavora con continuita: **2-4 settimane**.

Breakdown indicativo:

- Spec/piano/contratti: 1 sessione
- Hardening minimo backend/API: 2-3 sessioni
- API v1 core: 2-3 sessioni
- Angular shell + dashboard/sessioni: 2 sessioni
- Configurazioni/candidati/dispositivi/scanner/liste: 3-5 sessioni
- Convergenza grafica e funzionale su baseline legacy: 3-6 sessioni
- Test, documentazione e cutover: 1-2 sessioni
