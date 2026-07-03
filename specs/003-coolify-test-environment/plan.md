# Implementation Plan: Ambiente di test su Coolify (Baltig registry)

**Branch**: `003-coolify-test-environment` | **Date**: 2026-07-03 | **Spec**: `specs/003-coolify-test-environment/spec.md`

**Input**: Feature specification from `specs/003-coolify-test-environment/spec.md`

## Summary

Validare, in due passi indipendenti, che la pipeline Baltig→Coolify gia
implementata (`.gitlab-ci.yml`, `deploy/compose*.yml`,
`docs/deployment/baltig-ci-cd.md`) funzioni davvero su un dominio reale: prima
con l'immagine legacy (rischio minimo, per isolare problemi di infrastruttura
da problemi applicativi), poi con lo stack a due immagini della migrazione
Angular. Nessuna riga di codice applicativo cambia per questa feature: e'
lavoro di configurazione ambiente (variabili, Coolify, deploy token) più
eventuali correzioni puntuali se qualcosa non si comporta come in locale.

## Technical Context

**Language/Version**: N/A — feature di configurazione infrastrutturale, non di
codice applicativo (Python 3.11 / Node 24 / Angular 21 restano invariati)

**Primary Dependencies**: GitLab CI (Baltig), registry Docker Baltig, Coolify,
Nginx (frontend), Gunicorn (backend), OIDC IdP di test (`traefik.test.si.cnr.it`)

**Storage**: PostgreSQL + Redis gia' gestiti da `deploy/compose.yml`; nessuno
schema nuovo

**Testing**: `scripts/smoke-deployment.sh` contro il dominio reale; ripetizione
manuale del flusso E2E segretario→esperto gia' documentato in
`specs/002-angular-api-first-migration/contracts/cutover-readiness.md`

**Target Platform**: Coolify (containerizzato, Linux), dominio pubblico HTTPS

**Project Type**: Deploy/infrastruttura (web application gia' esistente, due
immagini: backend Flask + frontend Angular/Nginx)

**Performance Goals**: nessuna richiesta > timeout Nginx/Gunicorn allineati
(120s), coerente con le chiamate lente a Selezioni Online gia' osservate in
locale (~54s)

**Constraints**: nessuna porta dati o backend diretta esposta pubblicamente;
credenziali/token mai salvati nel repository; `main`/`test` protetti su
Baltig, niente push diretto

**Scale/Scope**: singolo ambiente di test (poi produzione, fuori scope di
questa spec se non come estensione naturale dopo la validazione)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Stato Applicativo Esplicito**: non impattato — nessuna modifica alla
  macchina a stati sessione.
- **II. Autorizzazione Prima della Logica**: non impattato — nessuna modifica
  ad auth/ownership; il deploy token Baltig usa il minimo permesso
  (`read_registry`), coerente col principio applicato all'infrastruttura.
- **III. Backend Come Fonte di Verita**: non impattato — nessuna logica
  duplicata nel frontend.
- **IV. Integrazioni Isolate e Tracciabili**: rilevante solo indirettamente —
  si verifica che le integrazioni esterne (OIDC, Selezioni Online) continuino
  a funzionare isolate e con errori tracciabili anche fuori da localhost/ngrok.
- **V. Migrazione Incrementale e Verificabile**: applicato direttamente — la
  validazione e' volutamente incrementale (legacy prima, poi migrazione) e
  ogni passo ha criteri di successo verificabili prima di procedere al
  successivo.

Nessuna violazione. Gate superato senza eccezioni da giustificare.

## Project Structure

### Documentation (this feature)

```text
specs/003-coolify-test-environment/
├── spec.md               # Requisiti e user story (questo output)
├── plan.md               # Questo file
├── quickstart.md         # Passi operativi Coolify/Baltig, variabili richieste
└── tasks.md              # Task eseguibili in ordine (Fase 1: legacy, Fase 2: migrazione)
```

### Risorse coinvolte (repository esistente, nessuna nuova struttura di codice)

```text
.gitlab-ci.yml                         # pipeline gia' esistente (test/build/release)
deploy/
├── compose.yml                        # base condivisa test+prod
├── compose.test.yml                   # override ambiente test
├── compose.prod.yml                   # override ambiente produzione
└── compose.local.yml                  # riferimento per confronto con locale gia' validato
docs/deployment/baltig-ci-cd.md        # runbook da seguire ed eventualmente correggere
scripts/smoke-deployment.sh            # usato per validare ogni stadio
.env.example                           # base per le variabili da impostare in Coolify
```

**Structure Decision**: nessuna nuova struttura di codice. Il lavoro consiste
nell'eseguire ed eventualmente correggere quanto gia' pianificato in
`deploy/` e `.gitlab-ci.yml`, con evidenze e task tracciati in questa spec.

## Complexity Tracking

Nessuna violazione della Constitution Check: sezione non applicabile.
