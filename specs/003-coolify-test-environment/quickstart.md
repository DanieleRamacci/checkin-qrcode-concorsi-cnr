# Quickstart: ambiente test Coolify

Aggiornato al 2026-07-08.

## Stato

Ambiente test pubblicato tramite Coolify:

```text
BaLTIG branch test -> Coolify private repo -> /docker-compose.coolify.yml -> https://test-checkin.concorsi.cnr.it
```

## Configurazione usata

- repository SSH: `git@baltig.cnr.it:daniele.ramacci/checkin-cnr-concorsi.git`
- branch: `test`
- build pack: Docker Compose
- compose location: `/docker-compose.coolify.yml`
- servizio pubblico: `frontend`
- porta servizio pubblico: `8080`
- FQDN: `https://test-checkin.concorsi.cnr.it`

## Branch workflow

```bash
git switch migration/angular-api-first
# sviluppo e commit

git switch test
git merge migration/angular-api-first
git push origin test
```

Coolify usa il branch `test` per pubblicare il dominio di collaudo.

## Variabili test principali

```env
APP_ENV=production
FLASK_ENV=production
DEBUG=0
OIDC_REDIRECT_URI=https://test-checkin.concorsi.cnr.it/oidc-callback
COOKIE_SECURE=1
BASE_URL=https://cool-jconon.test.si.cnr.it
```

Le altre credenziali OIDC, JConon, PostgreSQL, Redis e SMTP sono secret
Coolify. Non salvarle nel repository.

## Verifiche eseguite

- [x] deploy key BaLTIG configurata read-only
- [x] Coolify carica `/docker-compose.coolify.yml`
- [x] branch `test` importato da Coolify
- [x] servizi `frontend`, `backend`, `db`, `redis` avviati
- [x] Bad Gateway risolto associando il dominio al servizio `frontend:8080`
- [x] dominio test raggiungibile da browser
- [x] smoke test completato il 2026-07-08:

  ```text
  OK /healthz (200)
  OK /api/v1/health (200)
  OK / (200)
  ```

## Verifiche da completare

- [ ] login OIDC reale sul dominio test
- [ ] flussi manuali ancora aperti nella spec 002

## Produzione corrente

Per ora la produzione deve restare separata:

```text
branch: checkin-dev
dominio: https://checkin.concorsi.cnr.it
```

Non usare `main` per produzione finche non viene riallineato intenzionalmente.
