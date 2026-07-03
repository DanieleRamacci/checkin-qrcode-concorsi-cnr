# Quickstart: Ambiente di test su Coolify

Questo file registra gli esiti man mano che i task di
`specs/003-coolify-test-environment/tasks.md` vengono completati.

## Setup runner (T000a-T000c)

- **T000a — fatto (2026-07-03)**: Baltig non fornisce runner condivisi di
  istanza (nessuna opzione automatica tipo GHCR/GitHub Actions al momento).
- **T000b — in corso (2026-07-03)**: runner di progetto "docker runner
  concorsi" creato lato Baltig; registrazione fisica in corso sulla VM di
  Coolify (install `gitlab-runner`, `register` con executor `docker`,
  `privileged = true` in `config.toml`, verifica stato online).
- **T000c — dubbio aperto, non urgente**: se in futuro l'IT CNR attiva
  runner condivisi di istanza, valutare la migrazione dal runner di
  progetto (sulla VM Coolify) a quelli condivisi. Vantaggio: zero
  manutenzione locale. Incognita: se i runner condivisi CNR permetteranno
  `privileged`/`docker:dind`, necessario per il job `build-images`.
  Decisione rimandata a quando/se l'opzione sara' disponibile.

**Decisione presa**: il runner gira sulla stessa VM di Coolify (non sul Mac
locale, non su una VM CI dedicata separata). Motivazione: test e produzione
condividono gia' quella VM tramite Coolify, quindi l'isolamento perfetto non
e' comunque la situazione attuale; unico sviluppatore che pusha codice
(nessun contributo esterno non fidato) rende il rischio aggiuntivo del
Docker privileged accettabile nel contesto. Vedi `tasks.md` T000b per il
dettaglio.

## Percorso alternativo GHCR (mentre il runner Baltig e' in setup)

Il workflow GitHub Actions legacy (`Build and Push to GHCR`) non era mai stato
toccato su `main`/`checkin-dev` (solo ristretto su
`migration/angular-api-first`, T079). Per ottenere un'immagine legacy subito,
senza aspettare il runner Baltig:

- **2026-07-03**: commit vuoto pushato su `main` (solo remote `github`, non
  Baltig) per innescare il workflow esistente. Immagine attesa:
  `ghcr.io/danieleramacci/checkin-qrcode-concorsi-cnr:latest`.
- **Problema trovato**: aprendo il dominio gia' collegato in Coolify
  (`checkin.concorsi.cnr.it`), il login OIDC reindirizza ancora a un vecchio
  tunnel ngrok (`OIDC_REDIRECT_URI` non aggiornato per quella risorsa
  Coolify esistente). Fix da applicare nelle variabili d'ambiente di quella
  risorsa: `OIDC_REDIRECT_URI=https://checkin.concorsi.cnr.it/oidc-callback`,
  `COOKIE_SECURE=1`. **Correzione (2026-07-03)**: `BASE_URL` non va toccato,
  non rappresenta il dominio dell'app — resta l'endpoint dell'API esterna
  Selezioni Online/JConon (vedi `spec.md`, FR-003); cambiarlo romperebbe
  import candidati e sync bando. Verificare anche che il `redirect_uri`
  esatto sia registrato lato IdP (`traefik.test.si.cnr.it`, client
  `selezioni`). Se si vuole usare la nuova immagine GHCR, aggiornare anche
  il riferimento immagine nella risorsa.
  _Esito della correzione: da confermare._

## Fase 1 — Validazione pipeline con immagine legacy (US1)

### Prerequisiti (T001)

- Deploy token Baltig (`read_registry`): _da confermare_
- Dominio di test assegnato in Coolify: _da confermare_

### Esito deploy legacy (T002-T008)

_Non ancora eseguito. Bloccato da T000b (runner in fase di registrazione).
Percorso alternativo via GHCR in corso, vedi sopra._

## Fase 2 — Deploy completo migrazione (US2)

### Esito deploy backend+frontend (T009-T017)

_Non ancora eseguito._
