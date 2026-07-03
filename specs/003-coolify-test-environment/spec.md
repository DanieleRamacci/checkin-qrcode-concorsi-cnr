# Feature Specification: Ambiente di test su Coolify (Baltig registry)

**Feature Branch**: `003-coolify-test-environment`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Configurare l'ambiente di test su Coolify con
dominio reale, partendo da una pubblicazione di prova dell'immagine legacy
sul registry Baltig per validare la pipeline, poi estendendo al deploy
completo backend+frontend della migrazione Angular."

## Contesto

Coolify e un dominio reale sono ora disponibili. La pipeline GitLab CI
(`.gitlab-ci.yml`) e i compose file (`deploy/compose*.yml`) sono gia
implementati e documentati (`docs/deployment/baltig-ci-cd.md`), ma non sono
mai stati verificati contro un'istanza Coolify reale. In locale l'app viene
raggiunta tramite tunnel ngrok (per l'OIDC callback); su un server con dominio
pubblico questo meccanismo non si applica e va sostituito con la variabile
d'ambiente corretta (`OIDC_REDIRECT_URI`) che punta al dominio reale.
`BASE_URL` **non** rappresenta il dominio dell'app: e' l'endpoint dell'API
esterna Selezioni Online/JConon (vedi `utils/candidati.py`,
`utils/sessioni.py`, `utils/commissioni.py`, `routes/azioni.py`) e non va
mai puntato al dominio dove gira l'applicazione, ne' in locale ne' in test/
produzione.

Per ridurre il rischio, la verifica avviene in due passi:

1. Provare l'intera catena Baltig→Coolify con l'immagine **legacy** (singolo
   container Flask, gia' nota e stabile), pubblicandola sul registry Baltig
   e facendola girare su Coolify con il dominio reale.
2. Solo dopo aver validato che la meccanica di pubblicazione/pull/avvio
   funziona, passare al deploy completo della migrazione (due immagini,
   backend API-first + frontend Angular, secondo `deploy/compose.yml` +
   `deploy/compose.test.yml`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validare la pipeline Baltig→Coolify con l'immagine legacy (Priority: P1)

Un operatore pubblica l'immagine Docker legacy (applicazione Flask
monolitica corrente) sul registry Baltig e la fa girare su Coolify con il
dominio di test reale, per verificare che l'intera catena (build → push →
pull → avvio → raggiungibilita' pubblica → login OIDC) funzioni prima di
introdurre la complessita' aggiuntiva della migrazione a due immagini.

**Why this priority**: E' il prerequisito bloccante: se la pubblicazione sul
registry o l'avvio su Coolify non funzionano nemmeno con l'app piu' semplice
e gia' stabile, non ha senso investigare problemi nello stack a due immagini
della migrazione, che aggiunge ulteriori variabili (proxy Nginx, due
container, rete interna).

**Independent Test**: Un operatore osserva, sul dominio di test assegnato in
Coolify, la schermata di login dell'app legacy raggiungibile via HTTPS, e
completa un login OIDC reale.

**Acceptance Scenarios**:

1. **Given** un'immagine Docker legacy buildata dal branch corrente,
   **When** viene pubblicata su `$CI_REGISTRY_IMAGE` (Baltig) e Coolify la
   tira (`pull`) e la avvia con le variabili d'ambiente di test,
   **Then** il container risulta in esecuzione e risponde sulla porta
   configurata.
2. **Given** il dominio di test reale puntato su Coolify, **When** un
   utente apre il dominio da browser, **Then** vede la pagina di login e puo'
   completare l'autenticazione OIDC (redirect URI configurato sul dominio
   reale, non su ngrok).
3. **Given** l'app legacy in esecuzione su Coolify, **When** si esegue
   `scripts/smoke-deployment.sh <dominio>`, **Then** gli endpoint di health
   rispondono 200.

---

### User Story 2 - Deploy completo backend API-first + frontend Angular su Coolify (Priority: P2)

Un operatore pubblica le due immagini della migrazione (`backend`,
`frontend`) sul registry Baltig e configura Coolify con il compose di test
(`deploy/compose.yml` + `deploy/compose.test.yml`), verificando che il
proxy Nginx same-origin, l'OIDC e tutte le funzionalita' gia' validate in
locale (vedi `specs/002-angular-api-first-migration/contracts/
cutover-readiness.md`) si comportino allo stesso modo su un dominio reale.

**Why this priority**: E' l'obiettivo finale di questa spec, ma dipende dal
successo della User Story 1 — non ha senso diagnosticare problemi di rete/
dominio/OIDC sullo stack a due immagini se non si e' prima escluso che siano
problemi di Coolify/Baltig in generale.

**Independent Test**: Un operatore completa da browser, sul dominio di test
reale, lo stesso flusso segretario→esperto gia' verificato in locale (vedi
`cutover-readiness.md`), fino a `esame_concluso`, senza usare ngrok.

**Acceptance Scenarios**:

1. **Given** le immagini `backend` e `frontend` pubblicate su Baltig con tag
   `test`, **When** Coolify le tira e le avvia con
   `deploy/compose.yml` + `deploy/compose.test.yml`, **Then** entrambi i
   container risultano `healthy`.
2. **Given** lo stack in esecuzione, **When** un utente apre il dominio di
   test, **Then** vede l'app Angular (non la pagina legacy grezza) e il
   login OIDC funziona con `OIDC_REDIRECT_URI` puntato al dominio reale.
3. **Given** lo stack in esecuzione, **When** si esegue
   `scripts/smoke-deployment.sh <dominio>`, **Then** frontend, `/healthz` e
   `/api/v1/health` rispondono 200.
4. **Given** lo stack in esecuzione, **When** si ripete il flusso E2E
   segretario→esperto gia' provato in locale, **Then** si comporta in modo
   identico (nessuna differenza dovuta a proxy/dominio/timeout).

---

### Edge Cases

- Cosa succede se `OIDC_REDIRECT_URI` non e' registrato esattamente (schema/
  host/path) lato IdP per il nuovo dominio? → login fallisce con errore IdP,
  non un errore applicativo: va verificato PRIMA di incolpare il codice.
- Come si comporta `COOKIE_SECURE` quando il dominio reale e' servito in
  HTTPS (a differenza del default locale che lo forza a `0`)? Va impostato a
  `1` in test/produzione.
- Se Coolify espone solo la porta del frontend (per architettura same-origin
  Nginx, vedi `docs/deployment/baltig-ci-cd.md`), un tentativo di raggiungere
  direttamente la porta backend dall'esterno deve fallire (nessuna porta dati
  pubblica) — verificare che la config Coolify non esponga per errore la
  porta 5050.
- Se il deploy token Baltig ha permessi diversi da `read_registry` (troppo
  ampi o insufficienti), il pull da Coolify puo' fallire con 403/404 in modo
  poco chiaro.
- Se il timeout Nginx (allineato a 120s in T117) non viene incluso nella
  configurazione effettivamente pubblicata nell'immagine Coolify, le
  chiamate lente a Selezioni Online (import candidati, genera liste)
  falliranno di nuovo in test/produzione come gia' successo in locale.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pipeline Baltig DEVE pubblicare un'immagine legacy
  utilizzabile su Coolify, senza richiedere modifiche al codice applicativo
  legacy (solo eventuale branch/tag/pipeline dedicati alla prova).
- **FR-002**: Coolify DEVE poter tirare le immagini dal registry Baltig
  usando un deploy token con permesso `read_registry`, senza credenziali
  salvate nel repository.
- **FR-003**: Le variabili d'ambiente che rappresentano l'URL pubblico
  dell'app (`OIDC_REDIRECT_URI`, `COOKIE_SECURE`) DEVONO puntare al dominio
  reale di test, senza alcuna dipendenza da ngrok o da URL locali.
  `BASE_URL` NON va toccato per questo scopo: resta puntato all'API esterna
  Selezioni Online/JConon indipendentemente dal dominio dell'app.
- **FR-004**: Il proxy Nginx del frontend DEVE mantenere gli stessi timeout
  allineati a Gunicorn (120s, vedi Phase 9 T117 della spec 002) anche
  nell'immagine pubblicata su Coolify, non solo in locale.
- **FR-005**: Il deploy di test NON DEVE esporre pubblicamente porte dati
  (database, redis) ne' la porta diretta del backend, coerentemente con
  `deploy/compose.yml`.
- **FR-006**: Dopo il deploy, `scripts/smoke-deployment.sh` DEVE poter
  essere eseguito contro il dominio reale e restituire esito positivo per
  entrambi gli stadi (legacy e, successivamente, migrazione).
- **FR-007**: Il flusso E2E segretario→esperto gia' validato in locale
  (`specs/002-angular-api-first-migration/contracts/cutover-readiness.md`)
  DEVE essere ripetibile con esito equivalente sul dominio di test reale.

### Key Entities

- **Ambiente Coolify "testing"**: risorsa Coolify con il proprio dominio,
  variabili d'ambiente e registry privato configurato; ospita prima
  l'immagine legacy (prova pipeline), poi lo stack a due immagini della
  migrazione.
- **Deploy token Baltig**: credenziale con permesso `read_registry` usata
  da Coolify per tirare le immagini; non va salvata nel repository.
- **Variabili d'ambiente di test**: sovrainsieme di `.env.example` con i
  valori reali del dominio di test (OIDC, cookie, mail, ecc.), gestite
  esclusivamente nell'interfaccia Coolify.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: L'immagine legacy pubblicata su Baltig e avviata su Coolify
  risponde su HTTPS con lo stesso comportamento gia' noto in locale/
  produzione corrente.
- **SC-002**: Il login OIDC sul dominio di test completa con successo senza
  ngrok, usando solo le variabili d'ambiente configurate in Coolify.
- **SC-003**: Dopo l'estensione allo stack a due immagini, lo smoke test e
  il flusso E2E segretario→esperto completano con lo stesso esito osservato
  in locale (nessuna regressione dovuta all'ambiente reale).
- **SC-004**: Nessuna porta dati o backend diretta risulta raggiungibile
  dall'esterno del dominio di test.

## Assumptions

- Il dominio di test e le risorse Coolify sono gia' stati messi a
  disposizione dall'operatore (fuori dallo scope tecnico di questa spec:
  provisioning DNS/hosting).
- L'accesso all'interfaccia Coolify e al pannello Baltig (deploy token,
  variabili CI) e' gestito manualmente dall'operatore; l'assistente puo'
  guidare passo-passo ma non ha credenziali per operare direttamente su
  quei pannelli.
- L'IdP OIDC di test (`traefik.test.si.cnr.it`) accetta la registrazione di
  un nuovo `redirect_uri` per il dominio di test, o ne ha gia' uno valido.
- Il branch/pipeline per la prova legacy e' temporaneo e non sostituisce il
  branch `checkin-dev` gia' esistente come baseline legacy.
