# Ambiente di test su Coolify

Fonte: `specs/003-coolify-test-environment/`. Aggiornato al 2026-07-08.

## Stato attuale

L'ambiente di test e operativo con questo flusso:

```text
branch test su BaLTIG -> Coolify private repo -> docker-compose.coolify.yml -> test-checkin.concorsi.cnr.it
```

Coolify clona il repository tramite deploy key SSH read-only, builda i servizi
direttamente sulla VM e pubblica il servizio `frontend` sul dominio di test.

## Branch

| Branch | Uso |
|---|---|
| `migration/angular-api-first` | sviluppo della migrazione Angular |
| `test` | branch pubblicato su `https://test-checkin.concorsi.cnr.it` |
| `checkin-dev` | baseline stabile pre-migrazione, candidata alla produzione corrente |
| `main` | non usare per produzione finche non viene riallineato consapevolmente |

Per pubblicare una nuova versione test:

```bash
git switch migration/angular-api-first
# sviluppo e commit

git switch test
git merge migration/angular-api-first
git push origin test
```

Poi Coolify puo fare deploy automatico via webhook oppure manuale dalla UI.

## Configurazione Coolify test

- sorgente: Private Repository
- repository: `git@baltig.cnr.it:daniele.ramacci/checkin-cnr-concorsi.git`
- branch: `test`
- build pack: Docker Compose
- compose location: `/docker-compose.coolify.yml`
- dominio/FQDN sul servizio `frontend`: `https://test-checkin.concorsi.cnr.it`
- porta frontend: `8080`

Nessun dominio pubblico va assegnato a `backend`, `db` o `redis`.

## Variabili ambiente

Le variabili sono gestite nella UI Coolify. Per test:

- `APP_ENV=production`
- `FLASK_ENV=production`
- `DEBUG=0`
- `OIDC_REDIRECT_URI=https://test-checkin.concorsi.cnr.it/oidc-callback`
- `COOKIE_SECURE=1`
- `BASE_URL=https://cool-jconon.test.si.cnr.it`

`BASE_URL` resta l'endpoint esterno Selezioni Online/JConon; non e il dominio
dell'applicazione.

Le credenziali OIDC, PostgreSQL, Redis e SMTP restano secret Coolify e non
devono essere salvate nel repository. JConon/Selezioni Online deve essere
chiamato con token OIDC dell'utente loggato; non sono previste credenziali
JConon fisse nel deploy.

## Problemi incontrati e risolti

1. **Deploy key non selezionabile**: e' stata creata una nuova chiave ED25519
   in Coolify; la public key e' stata aggiunta in BaLTIG come deploy key
   read-only, senza write permissions.
2. **Compose non trovato**: Coolify cercava il default
   `/docker-compose.yaml`; il percorso corretto e `/docker-compose.coolify.yml`
   e va salvato prima di premere "Load Compose File".
3. **Bad Gateway**: il dominio era associato alla porta/servizio sbagliato. Il
   dominio pubblico deve puntare al servizio `frontend`, porta interna `8080`,
   senza aggiungere `:8080` nel FQDN.
4. **Variabili JConon legacy rimosse**: `docker-compose.coolify.yml` passa al
   backend solo `BASE_URL`; username/password, `AUTH_B64`, bearer tecnici
   JConon e `JCONON_BASE_URL` non devono essere configurati.

## Flussi non piu operativi

La prima ipotesi prevedeva:

```text
GitLab runner -> build immagini -> registry BaLTIG -> Coolify pull
```

Per ora e stata accantonata. Resta una possibile evoluzione futura se CNR/BaLTIG
mette a disposizione runner condivisi o una VM CI separata.

Il percorso GHCR usato nei primi esperimenti resta storico e non e il flusso
operativo corrente.

## Prossime verifiche

- eseguire smoke test sul dominio reale
- completare login OIDC reale su `test-checkin.concorsi.cnr.it`
- ripetere i flussi manuali ancora aperti della spec 002
- dopo collaudo, creare/configurare la risorsa produzione su branch
  `checkin-dev` e dominio `https://checkin.concorsi.cnr.it`
