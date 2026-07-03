# Ambiente di test su Coolify

Fonte: [`specs/003-coolify-test-environment/`](../../specs/003-coolify-test-environment/)
(spec, piano, task, log operativo). Aggiornato al 2026-07-03.

## Obiettivo

Validare, con rischio crescente per passi, che la catena
**Baltig (build/registry) → Coolify (deploy) → dominio pubblico** funzioni
davvero, prima con un'immagine nota e stabile (legacy) e poi con lo stack
completo a due immagini della migrazione (backend + frontend Angular).

## Stato attuale

### Fatto

- Repository migrato da GitHub a Baltig (`origin` punta ora a
  `baltig.cnr.it/daniele.ramacci/checkin-cnr-concorsi`; GitHub resta mirror
  secondario).
- Macchina virtuale di test configurata con **Coolify** (reverse proxy
  Traefik, gestione domini/certificati TLS).
- Primo deploy di test eseguito con successo: stack Docker Compose a due
  immagini (`frontend`, `backend`) avviato, healthcheck passanti, login
  OIDC completato sul dominio reale `checkin.concorsi.cnr.it`. Questo primo
  giro ha usato immagini pubblicate su **GHCR** (percorso alternativo, vedi
  sotto), non ancora la pipeline Baltig.

### Percorso alternativo via GHCR

La pipeline Baltig richiede un runner (vedi sotto), non ancora disponibile
in modo definitivo. Per non bloccare la verifica, si e' usato in parallelo
il workflow GitHub Actions gia' esistente per pubblicare immagini di prova
su GHCR (`ghcr.io/danieleramacci/...`), sia per l'immagine legacy sia per
uno snapshot del branch di migrazione. Utile per iterare rapidamente, ma
**non sostituisce** la validazione della pipeline Baltig definitiva.

### Problemi reali incontrati e risolti

Utile per chi ripete il deploy altrove:

1. **Container Postgres senza healthcheck**: il servizio `backend` usa
   `depends_on: db: condition: service_healthy`, che richiede un healthcheck
   esplicito su `db` (`pg_isready`) — va sempre incluso quando si adatta un
   compose file da uno schema a container singolo a uno multi-servizio.
2. **Routing Coolify verso la porta sbagliata**: passando da un solo
   servizio (`web`, porta 5050) a due (`frontend` 8080 + `backend` 5050),
   il dominio pubblico va riassociato esplicitamente al servizio
   `frontend`, sulla porta 8080 — altrimenti Traefik risponde `Bad Gateway`.
3. **Variabile `OIDC_REDIRECT_URI` non aggiornata**: un dominio gia'
   configurato in Coolify aveva ancora il valore di un vecchio tunnel ngrok
   usato in sviluppo locale — va sempre aggiornato al dominio pubblico reale
   quando si promuove un ambiente.
4. **Variabili di validazione OIDC mancanti**: `OIDC_ISSUER`,
   `OIDC_AUDIENCE`, `OIDC_JWKS_URL` (richieste dall'hardening OIDC) mancavano
   nel file `.env` copiato da un ambiente precedente — senza di esse il
   login fallisce con "Configurazione validazione OIDC incompleta".
5. **Attenzione a `BASE_URL`**: nel codice questa variabile rappresenta
   l'endpoint dell'API esterna Selezioni Online/JConon, **non** il dominio
   dell'applicazione — non va mai puntata al dominio dove gira l'app.

## Decisioni operative aperte

Punti di coordinamento/decisione, non blocchi tecnici immediati:

| # | Tema | Stato |
|---|---|---|
| 1 | **Domini**: oggi un solo dominio (`checkin.concorsi.cnr.it`), usato di fatto per il test | Da creare un dominio dedicato `test-checkin.concorsi.cnr.it` |
| 2 | **Stessa VM per test e produzione?** | Da decidere |
| 3 | **Runner CI/CD Baltig**: nessun runner condiviso di istanza disponibile | Serve un runner di progetto (richiede accesso SSH a una VM) oppure un amministratore Baltig che abiliti runner condivisi di istanza (preferibile) |
| 4 | **Separazione immagini test/produzione** | Da impostare una volta scelta la modalita' di build (gia' predisposta nella pipeline con i tag `:test`/`:production`) |
| 5 | **Utenza di servizio per le API Selezioni Online** | Oggi si usa l'utenza personale; da definire un'utenza dedicata |
| 6 | **Keycloak produzione** | Servono i dati del client di produzione (o conferma di riuso di quello attuale) e la registrazione del redirect URI di produzione lato IdP |

## Runner Baltig: come procedere

Baltig non fornisce runner condivisi di istanza al momento. Per registrarne
uno di progetto: **Settings → CI/CD → Runners → New project runner**,
scegliere tag `docker` con "Run untagged jobs" attivo (i job della pipeline
non usano tag), poi sulla macchina scelta installare `gitlab-runner`,
eseguire il comando di registrazione mostrato da Baltig, scegliere executor
`docker` e **abilitare `privileged = true`** in
`/etc/gitlab-runner/config.toml` (necessario per il job che builda le
immagini con Docker-in-Docker). Dettaglio completo in
[`docs/deployment/baltig-ci-cd.md`](../deployment/baltig-ci-cd.md).
