# Tasks: Ambiente di test su Coolify (Baltig registry)

**Input**: Design documents from `specs/003-coolify-test-environment/`

**Prerequisites**: `plan.md`, `spec.md`

**Organization**: due fasi indipendenti e sequenziali per user story. La Fase 2
(migrazione) parte solo dopo il checkpoint della Fase 1 (legacy), per isolare
problemi di infrastruttura da problemi applicativi.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: eseguibile in parallelo su risorse/file distinti
- **[Story]**: user story della spec (US1 = legacy, US2 = migrazione)

## Note operative

- Nessuna azione qui modifica codice applicativo, salvo correzioni puntuali se
  qualcosa non si comporta come in locale (in tal caso: aggiornare anche
  `specs/002-angular-api-first-migration/tasks.md` con lo stesso stile usato
  per i gap trovati nella Phase 9).
- Le azioni su Coolify e sul pannello Baltig (deploy token, variabili,
  risorse) sono manuali, eseguite dall'operatore; l'assistente guida passo
  passo e verifica gli esiti da riga di comando (`smoke-deployment.sh`, `git`,
  `curl`) quando possibile.
- Nessuna credenziale o token va scritto nel repository o nella
  documentazione: solo riferimenti a dove sono configurati (Coolify).

---

## Phase 1: Setup

- [x] T000a Verificare in Baltig (Settings → CI/CD → Runners) se esistono runner condivisi dell'istanza

  **Esito (2026-07-03)**: confermato che Baltig **non fornisce runner
  condivisi di istanza** ("This GitLab instance does not provide any
  instance runners yet"). L'opzione "automatica come GHCR/GitHub Actions"
  non e' disponibile a meno che l'IT CNR non ne registri in futuro
  nell'admin area. Serve un runner di progetto.

- [ ] T000b Registrare un runner di progetto con executor Docker (`privileged = true` per supportare `docker:27-dind` nel job `build-images`)

  **In corso (2026-07-03)**: runner "docker runner concorsi" creato lato
  Baltig (token di registrazione ottenuto), da registrare fisicamente sulla
  **VM di Coolify** (decisione presa: vedi nota sotto). Procedura in corso:
  install `gitlab-runner` → `gitlab-runner register` (executor `docker`,
  immagine default `docker:27-cli`) → impostare `privileged = true` in
  `/etc/gitlab-runner/config.toml` → `gitlab-runner restart` → verificare
  stato "online" in Settings → CI/CD → Runners.

  **Decisione presa e motivazione**: registrare il runner sulla stessa VM
  che ospita Coolify (non sul Mac locale ne' su una VM CI separata).
  Motivazione dell'utente: test e produzione girano gia' sulla stessa VM
  tramite Coolify, quindi l'isolamento "perfetto" non e' comunque la
  situazione attuale; aggiungere il runner li' non introduce una categoria
  di rischio radicalmente nuova dato che e' l'unico sviluppatore a pushare
  codice (nessun contributo esterno non fidato). Rischio residuo accettato
  e documentato: il job `build-images` scarica dipendenze (`npm ci`,
  `pip install`) con permessi Docker privileged, a differenza dei container
  Coolify che eseguono solo immagini gia' pronte — superficie di rischio
  in piu' ma giudicata marginale nel contesto attuale.

- [ ] T000c **Dubbio aperto da verificare**: se in futuro l'IT CNR configura runner condivisi a livello di istanza Baltig, valutare se migrare da questo runner di progetto (sulla VM Coolify) a quelli condivisi — vantaggio: nessuna manutenzione locale del runner, aggiornamenti gestiti centralmente da IT; svantaggio: dipendenza da terzi per disponibilita'/capacita', e da verificare se i runner condivisi CNR permettono `privileged`/`docker:dind` (non scontato per policy di sicurezza condivisa). Decisione rimandata: per ora si procede con il runner di progetto sulla VM Coolify; da rivalutare solo se/quando IT CNR annuncia runner condivisi disponibili.
- [ ] T001 Verificare prerequisiti: deploy token Baltig con permesso `read_registry` creato, progetto/dominio test assegnato in Coolify, riferimenti aggiornati in `docs/deployment/baltig-ci-cd.md`

**Checkpoint**: pipeline in grado di eseguire job (runner attivo) e
prerequisiti Coolify confermati prima di procedere.

---

## Phase 2: User Story 1 - Validare la pipeline Baltig→Coolify con l'immagine legacy (Priority: P1)

**Goal**: dimostrare che build → push (`:test` poi `:production`) → pull →
avvio → raggiungibilita' pubblica → login OIDC funzionano end-to-end con
l'app legacy, usando il flusso branch definitivo (`test` → `main`) invece di
un branch usa-e-getta, cosi' la stessa procedura vale gia' anche per la
migrazione in Fase 3.

**Independent Test**: un operatore apre il dominio di test da browser, vede il
login legacy e completa un'autenticazione OIDC reale; poi ripete per il
dominio di produzione dopo la promozione.

- [ ] T002 [US1] Portare `.gitlab-ci.yml` (e solo quello) sul branch `checkin-dev` con un merge/cherry-pick mirato, senza toccare altro codice applicativo
- [ ] T002b [US1] Merge di `checkin-dev` nel branch `test` (gia' presente su Baltig): la pipeline builda il Dockerfile legacy e pubblica `$CI_REGISTRY_IMAGE/backend:test` (stage `release-test`, automatico)
- [ ] T003 [US1] Creare in Coolify la risorsa "testing" con il registry privato Baltig configurato (username + deploy token `read_registry`)
- [ ] T004 [US1] Impostare in Coolify le variabili d'ambiente runtime per il dominio reale (`OIDC_REDIRECT_URI`, `COOKIE_SECURE=1` e il resto da `.env.example`; **non** toccare `BASE_URL`, che punta all'API esterna Selezioni Online/JConon e non all'app) per l'immagine legacy
- [ ] T005 [US1] Registrare o verificare presso l'IdP OIDC di test (`traefik.test.si.cnr.it`) il `redirect_uri` del dominio di test
- [ ] T006 [US1] Avviare il deploy dell'immagine `:test` su Coolify (pull manuale o automatico) e verificare che il container risulti `healthy`
- [ ] T007 [US1] Eseguire `scripts/smoke-deployment.sh <dominio-test>` e verificare 200 sugli endpoint di health
- [ ] T008 [US1] Completare un login OIDC reale dal dominio di test e registrare l'esito in `specs/003-coolify-test-environment/quickstart.md`
- [ ] T008b [US1] Merge di `test` in `main` e avvio manuale del job `release-production`: verifica che l'immagine `:production` (stessa build, nessun rebuild) venga pubblicata e sia deployabile allo stesso modo sull'ambiente di produzione Coolify

**Checkpoint**: pipeline Baltig→Coolify validata end-to-end con un'immagine
nota e stabile, su entrambi gli ambienti (test e produzione). Solo ora si
procede alla Fase 3.

---

## Phase 3: User Story 2 - Deploy completo backend API-first + frontend Angular (Priority: P2)

**Goal**: pubblicare e far girare su Coolify lo stack a due immagini della
migrazione, verificando parita' di comportamento con quanto gia' validato in
locale (`specs/002-angular-api-first-migration/contracts/cutover-readiness.md`).

**Independent Test**: un operatore completa da browser, sul dominio di test
reale, il flusso segretario→esperto fino a `esame_concluso`, senza ngrok.

- [ ] T009 [US2] Aprire una Merge Request da `migration/angular-api-first` verso `test` (nessun push diretto, branch protetto) e completarla quando pronta
- [ ] T010 [US2] Verificare che il merge su `test` pubblichi automaticamente `$CI_REGISTRY_IMAGE/backend:test` e `$CI_REGISTRY_IMAGE/frontend:test`
- [ ] T011 [US2] Aggiornare la risorsa Coolify "testing" per usare `deploy/compose.yml` + `deploy/compose.test.yml` con le due immagini `:test`
- [ ] T012 [US2] Impostare in Coolify tutte le variabili d'ambiente richieste (sovrainsieme di `.env.example`), aggiornando `OIDC_REDIRECT_URI` al dominio reale (`BASE_URL` resta l'API esterna Selezioni Online/JConon, non va cambiato)
- [ ] T013 [US2] Verificare che Coolify esponga pubblicamente solo la porta del frontend, nessuna porta backend o dati, coerente con `deploy/compose.yml`
- [ ] T014 [US2] Avviare il deploy e verificare che backend e frontend risultino entrambi `healthy`
- [ ] T015 [US2] Eseguire `scripts/smoke-deployment.sh <dominio-test>` (frontend, `/healthz`, `/api/v1/health`)
- [ ] T016 [US2] Ripetere sul dominio reale il flusso E2E segretario→esperto (`iniziale` → `esame_concluso`) e confrontare l'esito con quello gia' registrato in `cutover-readiness.md`
- [ ] T017 [US2] Verificare che il timeout Nginx 120s (T117 in `specs/002-angular-api-first-migration/tasks.md`) sia presente nell'immagine frontend pubblicata, ripetendo lo scenario "Genera Liste"
- [ ] T018 [US2] Aggiornare `cutover-readiness.md` e `legacy-ui-flow-matrix.md` (spec 002) con l'esito della validazione su dominio reale
- [ ] T019 [US2] Solo dopo un periodo di collaudo adeguato su testing: Merge Request da `test` verso `main` e avvio manuale di `release-production` per promuovere le stesse immagini `:test` a `:production`

**Checkpoint**: stack di migrazione validato su Coolify con dominio reale,
su entrambi gli ambienti (test e produzione).

---

## Dependencies and Execution Order

- Phase 1 non ha dipendenze.
- Phase 2 (US1) dipende solo da Phase 1.
- Phase 3 (US2) dipende dal checkpoint di Phase 2: non iniziare T009+ prima
  che T002-T008 siano tutti completati con esito positivo.
- Se un task di Phase 3 fallisce per una causa non riconducibile
  all'infrastruttura (es. un bug applicativo mai visto in locale), registrare
  il gap in `specs/002-angular-api-first-migration/tasks.md` seguendo lo
  stesso stile usato nella Phase 9 (Convergence), prima di riprendere qui.
