# Tasks: Ambiente test e produzione con Coolify branch-based

**Input**: `specs/003-coolify-test-environment/spec.md`

Aggiornato al 2026-07-08.

## Phase 1: Decisione architetturale e setup sorgente

- [x] T001 Decidere di non installare per ora un runner GitLab/BaLTIG sulla VM e usare Coolify collegato direttamente al repository.
- [x] T002 Creare in Coolify una private key ED25519 per il deploy.
- [x] T003 Aggiungere la public key in BaLTIG come deploy key read-only, senza write permissions.
- [x] T004 Creare la risorsa Coolify test come Private Repository.
- [x] T005 Configurare repository SSH `git@baltig.cnr.it:daniele.ramacci/checkin-cnr-concorsi.git`.
- [x] T006 Configurare branch `test` per l'ambiente di test.
- [x] T007 Configurare build pack Docker Compose e compose location `/docker-compose.coolify.yml`.

## Phase 2: Ambiente test

- [x] T008 Configurare `docker-compose.coolify.yml` con servizi `frontend`, `backend`, `db` e `redis`.
- [x] T009 Passare al backend anche le variabili JConon (`JCONON_USERNAME`, `JCONON_PASSWORD`, `AUTH_B64`, `JCONON_BEARER_TOKEN`).
- [x] T010 Configurare variabili ambiente test in Coolify, incluso `OIDC_REDIRECT_URI=https://test-checkin.concorsi.cnr.it/oidc-callback`.
- [x] T011 Associare il dominio `https://test-checkin.concorsi.cnr.it` al servizio `frontend`, porta interna `8080`, senza `:8080` nel FQDN.
- [x] T012 Eseguire deploy Coolify del branch `test` e risolvere il Bad Gateway dovuto a porta/servizio errati.
- [x] T013 Verificare da browser che `https://test-checkin.concorsi.cnr.it` risponda.
- [x] T014 Eseguire `scripts/smoke-deployment.sh https://test-checkin.concorsi.cnr.it` e registrare l'esito in `quickstart.md`.
- [ ] T015 Completare login OIDC reale su `test-checkin.concorsi.cnr.it` e registrare l'esito in `quickstart.md`.

## Phase 3: Flusso branch

- [x] T016 Documentare che `migration/angular-api-first` e il branch di sviluppo.
- [x] T017 Documentare che `test` e il branch pubblicato da Coolify per collaudo.
- [x] T018 Mergiare `migration/angular-api-first` in `test` e pushare su BaLTIG per pubblicare la versione test.
- [x] T019 Documentare che la produzione corrente deve restare su `checkin-dev`, non su `main`, finche la migrazione non viene promossa.

## Phase 4: Produzione futura

- [ ] T020 Creare/configurare la risorsa Coolify produzione puntata a `checkin-dev`.
- [ ] T021 Associare `https://checkin.concorsi.cnr.it` alla risorsa produzione.
- [ ] T022 Configurare variabili ambiente produzione, con segreti distinti da test.
- [ ] T023 Verificare o registrare il redirect OIDC di produzione.
- [ ] T024 Eseguire smoke test produzione.
- [ ] T025 Definire il piano di promozione futura da migrazione Angular a produzione.

## Phase 5: Decisioni non bloccanti

- [ ] T026 Definire un'utenza di servizio dedicata per le chiamate a Selezioni Online/JConon, sostituendo l'utenza personale.
- [ ] T027 Valutare in futuro runner condivisi BaLTIG/CNR o una VM CI separata per spostare la build fuori dalla VM Coolify.

## Note

Le task del vecchio piano runner/registry sono state chiuse come superate dalla
decisione operativa del 2026-07-08: Coolify builda direttamente dal repository.
