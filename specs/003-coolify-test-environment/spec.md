# Feature Specification: Ambiente test e produzione con Coolify branch-based

**Feature Branch**: `003-coolify-test-environment`

**Created**: 2026-07-03

**Updated**: 2026-07-08

**Status**: Ready for validation

## Contesto

Coolify e BaLTIG sono stati scelti per pubblicare ambienti separati senza
installare, per ora, un runner GitLab sulla VM. Il flusso operativo attuale e:

```text
BaLTIG repository -> Coolify private repository deploy key -> Docker Compose build -> deploy
```

Coolify clona il branch configurato, builda `docker-compose.coolify.yml` e
pubblica il servizio `frontend` dietro reverse proxy HTTPS.

Il flusso runner/registry BaLTIG (`runner -> immagini :test/:production ->
Coolify pull`) resta una possibile evoluzione futura, ma non e il percorso
operativo scelto per sbloccare il test.

## Branch e ambienti

| Branch | Ambiente | Dominio |
|---|---|---|
| `migration/angular-api-first` | sviluppo migrazione | nessun deploy diretto |
| `test` | test/collaudo migrazione | `https://test-checkin.concorsi.cnr.it` |
| `checkin-dev` | produzione stabile pre-migrazione | `https://checkin.concorsi.cnr.it` |
| `main` | non operativo per ora | nessuno |

Le modifiche vengono sviluppate su `migration/angular-api-first`. Quando una
versione deve essere provata, viene mergiata su `test` e pushata a BaLTIG.

## User Scenarios & Testing

### User Story 1 - Pubblicare la migrazione su ambiente test (Priority: P1)

Un operatore pubblica il branch `test` su Coolify, con dominio dedicato
`test-checkin.concorsi.cnr.it`, per provare la migrazione Angular su un dominio
reale e non tramite ngrok.

**Independent Test**: aprire `https://test-checkin.concorsi.cnr.it`, vedere la
UI Angular servita dal container `frontend`, completare login OIDC e verificare
gli endpoint health.

**Acceptance Scenarios**:

1. **Given** la risorsa Coolify usa il branch `test`, **When** viene avviato un
   deploy, **Then** Coolify clona il repository tramite deploy key e carica
   `/docker-compose.coolify.yml`.
2. **Given** il dominio di test e configurato sul servizio `frontend`,
   **When** un utente apre `https://test-checkin.concorsi.cnr.it`, **Then** non
   riceve Bad Gateway e la UI viene servita sulla porta interna `8080`.
3. **Given** le variabili ambiente sono configurate in Coolify, **When** parte
   il login, **Then** `OIDC_REDIRECT_URI` usa
   `https://test-checkin.concorsi.cnr.it/oidc-callback`.

### User Story 2 - Tenere produzione separata dalla migrazione (Priority: P1)

Un operatore mantiene la produzione corrente sul branch stabile `checkin-dev`,
senza usare `test` o `migration/angular-api-first` finche la migrazione Angular
non supera il collaudo.

**Independent Test**: la risorsa Coolify produzione punta a `checkin-dev` e al
dominio `https://checkin.concorsi.cnr.it`; la risorsa test resta separata su
branch `test` e dominio `https://test-checkin.concorsi.cnr.it`.

**Acceptance Scenarios**:

1. **Given** produzione e test sono due risorse Coolify distinte, **When** si
   deploya test, **Then** la produzione non viene modificata.
2. **Given** la migrazione non e ancora validata, **When** serve aggiornare la
   produzione corrente, **Then** si lavora su `checkin-dev`, non su `main`.

## Edge Cases

- Se `Docker Compose Location` resta `/docker-compose.yaml`, Coolify non trova
  il file: il valore corretto e `/docker-compose.coolify.yml`.
- Se il dominio e associato al servizio o alla porta sbagliata, Traefik
  restituisce Bad Gateway: il dominio deve puntare al servizio `frontend`,
  porta interna `8080`, senza `:8080` nel FQDN.
- Se `OIDC_REDIRECT_URI` non e registrato lato IdP, il login fallisce anche se
  l'app e deployata correttamente.
- `BASE_URL` non e il dominio dell'app: resta l'endpoint esterno
  Selezioni Online/JConon.

## Requirements

- **FR-001**: Coolify DEVE accedere al repository BaLTIG tramite deploy key SSH
  read-only, senza permessi di scrittura.
- **FR-002**: L'ambiente test DEVE usare il branch `test` e il dominio
  `https://test-checkin.concorsi.cnr.it`.
- **FR-003**: L'ambiente produzione corrente DEVE restare separato e puntare a
  `checkin-dev` finche la migrazione non viene promossa.
- **FR-004**: `docker-compose.coolify.yml` DEVE esporre pubblicamente solo il
  frontend; backend, database e redis restano interni.
- **FR-005**: Le variabili ambiente e i segreti DEVONO essere gestiti in
  Coolify, non nel repository.
- **FR-006**: `BASE_URL` DEVE restare puntato a Selezioni Online/JConon e non al
  dominio dell'applicazione.
- **FR-007**: Il deploy test DEVE essere verificato con smoke test e login OIDC
  reale prima di considerare l'ambiente pronto per collaudo funzionale.

## Success Criteria

- **SC-001**: `https://test-checkin.concorsi.cnr.it` serve la UI Angular senza
  Bad Gateway.
- **SC-002**: backend, frontend, database e redis risultano avviati in Coolify.
- **SC-003**: gli endpoint `/healthz` e `/api/v1/health` rispondono sul dominio
  test.
- **SC-004**: il login OIDC completa usando il redirect URI del dominio test.
- **SC-005**: produzione resta non impattata dal deploy del branch `test`.

## Assumptions

- DNS e certificati del dominio test sono gestiti tramite Coolify/Traefik.
- L'operatore gestisce manualmente segreti, variabili Coolify e configurazione
  IdP.
- Il branch `main` non e fonte di verita per la produzione finche non viene
  riallineato intenzionalmente.
