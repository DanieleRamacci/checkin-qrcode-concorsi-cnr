# Deploy Baltig + Coolify

Aggiornato al 2026-07-15.

## Flusso operativo attuale

La modalita scelta per test e produzione e:

```text
BaLTIG repo -> Coolify private repository deploy key -> Docker Compose build -> deploy
```

Coolify clona il repository tramite deploy key SSH read-only, builda i servizi
sulla VM e avvia lo stack Docker Compose. In questa modalita non serve un
runner GitLab/BaLTIG per pubblicare immagini nel registry.

## Branch e ambienti

| Branch | Ambiente | Dominio | Note |
|---|---|---|---|
| `migration/angular-api-first` | sviluppo | nessuno | branch di lavoro della migrazione |
| `test` | test/collaudo | `https://test-checkin.concorsi.cnr.it` | branch deployato da Coolify per provare la migrazione |
| `checkin-dev` | produzione corrente/stabile | `https://checkin.concorsi.cnr.it` | baseline pre-migrazione, da usare per la produzione finche Angular non e validato |
| `main` | non operativo per ora | nessuno | non usarlo per produzione finche non viene riallineato consapevolmente |

Flusso di lavoro:

```bash
git switch migration/angular-api-first
# sviluppo e commit

git switch test
git merge migration/angular-api-first
git push origin test
```

Il push su `test` rende il nuovo stato visibile a Coolify. Il deploy puo essere
automatico tramite webhook oppure manuale dalla UI Coolify.

## Risorse Coolify

Creare due risorse/app separate, anche se usano lo stesso repository:

- test: branch `test`, dominio `https://test-checkin.concorsi.cnr.it`
- produzione: branch `checkin-dev`, dominio `https://checkin.concorsi.cnr.it`

Per la risorsa test:

- sorgente: `Private Repository`
- private key: chiave ED25519 creata in Coolify
- deploy key su BaLTIG: public key corrispondente, read-only, senza write
  permissions
- repository SSH: `git@baltig.cnr.it:daniele.ramacci/checkin-cnr-concorsi.git`
- build pack: `Docker Compose`
- base directory: `/`
- compose location: `/docker-compose.coolify.yml`
- dominio/FQDN sul servizio `frontend`: `https://test-checkin.concorsi.cnr.it`
- porta servizio frontend: `8080`

Non assegnare domini pubblici a `backend`, `db` o `redis`.

## Variabili ambiente

Le variabili runtime sono configurate in Coolify, non nel repository. Per
l'ambiente test:

- `OIDC_REDIRECT_URI=https://test-checkin.concorsi.cnr.it/oidc-callback`
- `COOKIE_SECURE=1`
- `BASE_URL=https://cool-jconon.test.si.cnr.it`
- credenziali OIDC, JConon, PostgreSQL, Redis e SMTP gestite come secret
  Coolify

`BASE_URL` non e il dominio dell'applicazione: indica l'endpoint esterno
Selezioni Online/JConon. Non va sostituito con `test-checkin.concorsi.cnr.it`
o `checkin.concorsi.cnr.it`.

`APP_ENV=production`, `FLASK_ENV=production` e `DEBUG=0` sono corretti anche
per l'ambiente test pubblico: significano runtime non-debug.

## Compose

Il file usato da Coolify e:

```text
docker-compose.coolify.yml
```

Contiene:

- `frontend`: build da `frontend/Dockerfile`, Nginx su porta interna `8080`
- `backend`: build da `Dockerfile`, Gunicorn su porta interna `5050`
- `db`: PostgreSQL con volume dedicato
- `redis`: Redis con volume dedicato

Il frontend e il punto di ingresso pubblico. Nginx serve la SPA Angular e
inoltra al backend solo:

- `/api/*`
- `/login`
- `/logout`
- `/oidc-callback`
- `/qr-code/*`
- `/qr-pdf/*`

Le vecchie route HTML utente non sono piu proxate al backend nel percorso
pubblico; vengono reindirizzate alla rotta Angular equivalente:

| Vecchia route | Nuova route |
|---|---|
| `/dashboard/segretario` | `/bandi` |
| `/sessioni?commission_id=...` | `/bandi/{commission_id}/sessioni` |
| `/gestione-concorso/{session_id}` | `/sessioni/{session_id}` |
| `/dispositivi/{session_id}` | `/sessioni/{session_id}/dispositivi` |
| `/device-link?session_id=...&token=...` | `/scanner?sessionId=...&token=...` |
| `/bando/{commission_id}/configura` | `/bandi/{commission_id}/config` |
| `/bando/{commission_id}/dettaglio` | `/bandi/{commission_id}/detail` |
| `/user` | `/` |

Durante la transizione le pagine HTML legacy ancora renderizzabili dal backend
mostrano un badge `LEGACY HTML`, utile per intercettare percorsi rimasti fuori
dal cutover.

## Runner e registry

La pipeline `.gitlab-ci.yml` resta nel repository come opzione futura per un
flusso piu pulito:

```text
runner esterno -> build immagini -> registry -> Coolify pull/deploy
```

Al momento non e il flusso operativo scelto, per evitare di installare un
runner privilegiato sulla VM di produzione/test. Se in futuro BaLTIG/CNR mette
a disposizione runner condivisi di istanza, si puo rivalutare questa strada.

## Rollback

Con il flusso attuale, il rollback si fa da Coolify scegliendo un deployment
precedente oppure riportando il branch `test`/`checkin-dev` a un commit noto e
rilanciando il deploy.

Prima di modifiche schema incompatibili serve un backup verificato del database:
il rollback applicativo non implica automaticamente rollback dei dati.
