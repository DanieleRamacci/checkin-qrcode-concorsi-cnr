# Implementation Plan: Ambiente test e produzione con Coolify branch-based

**Branch**: `003-coolify-test-environment` | **Date**: 2026-07-03 | **Updated**: 2026-07-08 | **Spec**: `specs/003-coolify-test-environment/spec.md`

## Summary

Configurare e documentare il deploy tramite Coolify collegato direttamente al
repository BaLTIG. Coolify usa deploy key SSH read-only, clona il branch
configurato, builda `docker-compose.coolify.yml` e pubblica il servizio
`frontend` dietro reverse proxy HTTPS.

Il flusso runner/registry BaLTIG e stato accantonato per ora: resta una
possibile evoluzione futura, ma non e necessario per pubblicare l'ambiente test.

## Technical Context

**Primary Dependencies**: BaLTIG repository, Coolify, Docker Compose, Traefik,
Nginx frontend, backend Flask/Gunicorn, PostgreSQL, Redis, IdP OIDC test.

**Testing**: smoke test contro `https://test-checkin.concorsi.cnr.it`, login
OIDC reale, ripetizione dei flussi manuali tracciati nella spec 002.

**Target Platform**: VM Coolify con reverse proxy HTTPS.

**Constraints**:

- segreti solo in Coolify, non nel repository;
- deploy key BaLTIG read-only, senza write permissions;
- frontend come unico servizio pubblico;
- `BASE_URL` resta l'endpoint Selezioni Online/JConon;
- produzione corrente separata su `checkin-dev`.

## Constitution Check

- **I. Stato Applicativo Esplicito**: non impattato.
- **II. Autorizzazione Prima della Logica**: rispettato tramite deploy key
  read-only e segreti fuori repository.
- **III. Backend Come Fonte di Verita**: non impattato.
- **IV. Integrazioni Isolate e Tracciabili**: OIDC e JConon restano configurati
  via variabili ambiente.
- **V. Migrazione Incrementale e Verificabile**: rispettato tramite branch
  separati `test` e `checkin-dev`.

Gate superato.

## Project Structure

```text
docker-compose.coolify.yml             # compose usato dalla risorsa Coolify
docs/deployment/baltig-ci-cd.md        # runbook deploy aggiornato
docs/migrazione/ambiente-test-coolify.md
scripts/smoke-deployment.sh            # validazione HTTP
specs/003-coolify-test-environment/
├── spec.md
├── plan.md
├── quickstart.md
└── tasks.md
```

## Deployment Decision

| Decisione | Esito |
|---|---|
| Build immagini via runner GitLab | Rinviata |
| Coolify collegato al repo | Scelta operativa |
| Test | branch `test`, dominio `test-checkin.concorsi.cnr.it` |
| Produzione corrente | branch `checkin-dev`, dominio `checkin.concorsi.cnr.it` |
| `main` | non operativo finche non riallineato |

## Validation Strategy

1. Deploy branch `test` su Coolify.
2. Verificare frontend pubblico su `https://test-checkin.concorsi.cnr.it`.
3. Eseguire smoke test.
4. Completare login OIDC reale.
5. Ripetere i flussi manuali rimasti aperti nella spec 002.
6. Solo dopo collaudo: configurare produzione su `checkin-dev`.

## Complexity Tracking

Nessuna violazione della Constitution Check.
