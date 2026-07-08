# Implementation Plan: Accesso referente/RDP alla configurazione bando

**Branch**: `004-referente-rdp-configurazione` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-referente-rdp-configurazione/spec.md`

## Summary

Introdurre un accesso dedicato per i referenti/RDP che devono compilare o
confermare la configurazione di un bando senza essere componenti della
commissione. L'identita dell'utente resta quella OIDC istituzionale; la
relazione con il bando viene acquisita da Selezioni Online/JConon, normalizzata
e salvata in una tabella interna di assegnazioni. Le autorizzazioni alla
configurazione bando useranno questa relazione interna, non un ruolo globale.

La feature include anche il censimento e la rimozione dai flussi di test stabile
e produzione di credenziali personali usate per integrazioni esterne.

## Technical Context

**Language/Version**: Python 3.11, Flask backend esistente; TypeScript 5.9.x e
Angular 21.2.x per la UI migrata.

**Primary Dependencies**: Flask, Flask-Session, psycopg2, requests, PyJWT,
Gunicorn; Angular, RxJS, design-angular-kit/Bootstrap Italia.

**Storage**: PostgreSQL. Richiede nuove strutture persistenti per assegnazioni
referente-bando, stato richiesta e audit configurazione.

**Testing**: pytest per autorizzazioni, service layer e API; test Angular per
servizi/componenti; validazione manuale OIDC in ambiente test Coolify.

**Target Platform**: web app containerizzata su Coolify, con backend Flask e
frontend Angular serviti sotto lo stesso origin.

**Project Type**: applicazione web gestionale API-first in migrazione.

**Performance Goals**: elenco bandi referente consultabile in meno di 3
passaggi dopo login; salvataggio configurazione senza regressioni percepibili
rispetto alla pagina attuale; nessuna scansione estesa non indicizzata sui bandi
per autorizzare una singola richiesta.

**Constraints**: non concedere permessi tramite ruolo generico "referente"; non
aggiungere il referente alla commissione solo per autorizzarlo; conservare audit
di richiesta/accesso/modifica/completamento; nessun flusso production-critical
deve dipendere da credenziali personali; mantenere fallback legacy fino a
validazione.

**Scale/Scope**: configurazione bando e accesso referente/RDP. Non include una
revisione completa di tutti i ruoli applicativi, ne la migrazione finale in
produzione dell'intera app.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Stato Applicativo Esplicito**: PASS. La richiesta configurazione usa
  stati dichiarati (`suggested`, `requested`, `in_progress`, `completed`,
  `verification_required`, `revoked`, `stale`) e audit.
- **II. Autorizzazione Prima della Logica**: PASS. Il piano introduce un check
  dedicato bando-config prima di leggere o modificare dati.
- **III. Backend Come Fonte di Verita**: PASS. Relazioni RDP, stato richiesta e
  audit vivono nel backend/PostgreSQL; il frontend consuma capability.
- **IV. Integrazioni Isolate e Tracciabili**: PASS. Selezioni Online/JConon
  resta nel service layer e viene censito l'uso di credenziali personali.
- **V. Migrazione Incrementale e Verificabile**: PASS. La feature e isolata,
  testabile e non richiede cutover completo della migrazione Angular.

**Post-design re-check**: PASS. Il modello dati e i contratti mantengono
autorizzazione, stato e audit nel backend; la UI referente e una slice
incrementale con fallback operativo.

## Project Structure

### Documentation (this feature)

```text
specs/004-referente-rdp-configurazione/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
routes/
├── api_v1/
│   ├── auth.py
│   ├── bandi.py
│   └── configurazioni.py
utils/
├── authorization.py
├── bando_service.py
├── jconon_service.py
├── sessioni.py
└── permissions.py
frontend/
├── src/
│   └── app/
│       ├── core/
│       └── features/
│           └── configurazioni/
tests/
└── pytest backend/API coverage
```

**Structure Decision**: mantenere la feature nei moduli esistenti della
migrazione API-first. Aggiungere service/helper dedicati solo dove riducono
duplicazione reale: autorizzazione bando-config, gestione assegnazioni
referente/RDP e audit configurazione.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Nessuna violazione costituzionale rilevata.
