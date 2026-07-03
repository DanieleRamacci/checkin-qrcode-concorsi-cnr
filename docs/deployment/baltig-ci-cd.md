# Baltig, registry e Coolify

## Branch e ambienti

| Branch | Ambiente | Tag immagini | Deploy |
|---|---|---|---|
| `migration/angular-api-first` | sviluppo | commit SHA | nessuno |
| `test` | testing | `test` e commit SHA | Coolify testing |
| `main` | produzione | `production` e commit SHA | manuale |

`main` e `test` devono essere protetti in Baltig. Le modifiche arrivano tramite
Merge Request; la produzione non accetta push diretto.

## Registry

La pipeline pubblica:

- `$CI_REGISTRY_IMAGE/backend:$CI_COMMIT_SHA`
- `$CI_REGISTRY_IMAGE/frontend:$CI_COMMIT_SHA`
- alias `:test` dal branch `test`
- alias `:production` da `main`, con job manuale

Creare in Baltig un deploy token con solo `read_registry`. Inserire username e
token nel registry privato di Coolify; non salvarli nel repository.

## Risorse Coolify

Creare due environment separati nello stesso progetto:

- `testing`: compose base + `deploy/compose.test.yml`
- `production`: compose base + `deploy/compose.prod.yml`

Variabili minime:

- `BACKEND_IMAGE`
- `FRONTEND_IMAGE`
- tutte le variabili runtime elencate in `.env.example`

Database, Redis, volumi e segreti devono essere distinti fra testing e
produzione.

Il dominio temporaneo testing può essere
`https://checkin.concorsi.cnr.it`. Quando sarà disponibile il dominio di test:

1. registrare entrambi i redirect OIDC;
2. aggiungere il nuovo FQDN alla risorsa testing e verificarlo;
3. rimuovere il dominio produzione dalla risorsa testing;
4. assegnarlo alla risorsa production.

Coolify espone soltanto `frontend:8080`. Nginx inoltra API, login e callback al
backend sulla rete interna.

## Rollback

Non ricostruire l'immagine. Impostare in Coolify i due riferimenti immutabili al
precedente commit SHA e avviare Redeploy. Eseguire poi:

```bash
scripts/smoke-deployment.sh https://hostname
```

Il rollback dell'applicazione non implica automaticamente il rollback del
database: prima di modifiche schema incompatibili serve un backup verificato.
