# Check-in CNR Concorsi

Documentazione tecnica aggiornata del progetto, pensata come **fotografia dello stato attuale del codice** e come base di handover per riprendere il lavoro (anche con altre AI).

## Documentazione Modulo Gestione Esami Moodle
Documentazione dedicata (solo modulo Prove/Esami): `docs/gestione-esami-moodle.md`

## Documentazione Spec Kit ufficiale
Baseline ufficiale dello stato attuale del progetto: `specs/001-baseline-progetto/spec.md`

## 1. Scopo del progetto
Applicazione web Flask per gestire il check-in candidati nelle sessioni di concorso CNR.

Obiettivi operativi:
- autenticazione utenti CNR via OIDC
- sincronizzazione commissioni e sessioni da sistema esterno "Selezioni Online"
- import candidati per sessione
- check-in candidati da dispositivi scanner (QR)
- workflow a stati (dalla preparazione sessione fino a esame concluso)
- generazione liste (XLSX + CSV Moodle)
- invio liste via email
- canale notifiche per sessione
- gestione ruoli locali (admin globale, esperto informatico)

## 2. Stack tecnico
- Backend: `Flask`
- Session management: `Flask-Session` (filesystem o Redis)
- DB: `PostgreSQL` (primario)
- Cache/session store opzionale: `Redis`
- Frontend: template Jinja + HTMX + JS vanilla
- Auth: OIDC (authorization code + refresh token)
- Server produzione: `gunicorn`
- Container: `Docker` + `docker-compose`

## 3. Entry points e varianti runtime
- Entrypoint principale attuale: `server_pg.py`
- Inizializzazione schema: `init_db.py`
- Connessione DB: `db.py`

File legacy/non primari:
- `server_sqlite.py`: versione più vecchia con SQLite e config hardcoded
- `server copy.py`: copia storica

## 4. Struttura ad alto livello
- `server_pg.py`: bootstrap app, sessioni, logging, registrazione blueprint, route globali (`/qr-code`, `/qr-pdf`, `/log`)
- `routes/`: blueprint HTTP (auth, dashboard, sessioni, candidati, azioni, dispositivi, scanner, ruoli, notifiche, debug)
- `utils/`: logica dominio/integrazione (stati, sync API esterne, token OIDC, liste, email, ruoli)
- `templates/`: viste HTML + frammenti HTMX
- `static/`: JS/asset frontend
- `files_liste/`: output file generati (xlsx/csv)
- `instance/logs/app.jsonl`: log applicativi JSON (rotazione)

## 5. Servizi messi in piedi (docker-compose)
Servizi definiti in `docker-compose.yml`:
- `web`: app Flask/Gunicorn su `:5050`
- `db`: PostgreSQL 15
- `redis`: Redis 7 (con password)
- `adminer`: GUI DB su `:8080`
- `redisinsight`: GUI Redis su `:5540`

Avvio reale container app:
1. attende disponibilità DB (`pg_isready`)
2. esegue `python init_db.py`
3. avvia Gunicorn su `server_pg:app`

## 6. Configurazione ambiente
Variabili rilevate in `.env` / codice:
- app/runtime: `APP_ENV`, `APP_VERSION`, `DEBUG`, `FLASK_ENV`, `SECRET_KEY`
- OIDC: `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, `OIDC_AUTH_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL`
- API esterna: `BASE_URL`
- DB: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- session store: `SESSION_TYPE`, `REDIS_URL`, `REDIS_PASSWORD`, `COOKIE_SECURE`
- mail: `SMTP_SERVER`, `SMTP_PORT`, `SMTP_STARTTLS`, `MAIL_SENDER`, `ESPERTO_EMAIL`
- bootstrap ruoli: `BOOTSTRAP_ADMIN_EMAILS`
- file output: `FILES_BASE_DIR`

Nota: `.env.example` al momento contiene solo subset OIDC; non copre tutte le variabili realmente usate.

## 7. Autenticazione (OIDC)
Implementata in `routes/auth.py`.

Flusso:
1. `GET /login`
- redirect verso IdP OIDC con `client_id`, `redirect_uri`, scope `openid profile email`
- usa `state` per memorizzare URL di ritorno

2. `GET /oidc-callback`
- scambio `code` -> token su `OIDC_TOKEN_URL`
- salva in sessione: `access_token`, `refresh_token`, `id_token`, `expires_at`, `refresh_expires_at`, `user_email`, `user`, `user_info`
- vincolo accesso: claim `is_cnr_user` deve essere true

3. `GET /logout`
- `session.clear()`
- redirect a endpoint logout OIDC con `id_token_hint` (se presente)

Decoratore usato quasi ovunque: `login_required` (controlla presenza `access_token` in sessione).

## 8. Gestione sessioni applicative
Configurazione in `server_pg.py`:
- default: `SESSION_TYPE=filesystem`
- produzione consigliata: `SESSION_TYPE=redis`

Se Redis:
- cookie `sid`
- lifetime 8 ore
- `SESSION_USE_SIGNER=True`
- `SESSION_COOKIE_HTTPONLY=True`
- `SESSION_COOKIE_SAMESITE=Lax`
- `SESSION_COOKIE_SECURE` da env

Refresh token:
- utilità in `utils/oidc.py`
- `ensure_fresh_access_token(skew_sec)` rinnova access token se vicino a scadenza
- endpoint utili per frontend: `/user/session/status`, `/user/session/refresh`

## 9. Modello ruoli/autorizzazioni
Ruoli locali (`utils/roles.py`):
- `admin_globale`
- `esperto_informatico`

Tabella: `user_roles`.

Pattern permessi:
- login base: `@login_required`
- ruoli: `@role_required(...)` o `@roles_required_any([...])`
- ownership risorsa: query `sessioni JOIN commissions` con `user_email` corrente

Bootstrap admin in `init_db.py` tramite `BOOTSTRAP_ADMIN_EMAILS`.

## 10. Macchina a stati sessione
Definita in `utils/stato.py`.

Stati ordinati:
1. `iniziale`
2. `candidati_scaricati`
3. `dispositivi_connessi`
4. `checkin_avviato`
5. `checkin_concluso`
6. `liste_generate`
7. `liste_inviate`
8. `lista_presenti_aggiornata_su_moodle`
9. `avvia_esame`
10. `esame_in_corso`
11. `esame_concluso`

Ogni transizione valida viene:
- salvata su `sessioni.stato_corrente`
- loggata in `session_state_log`
- notificata in `session_notifications` (best effort)

## 11. Flussi applicativi principali

### 11.1 Flusso segretario (preparazione e check-in)
1. login OIDC
2. dashboard segretario (`/dashboard/segretario`)
3. scelta commissione -> pagina sessioni
4. sync sessioni da API esterna (throttle 24h nel frammento sessioni)
5. apertura sessione `/gestione-concorso/<session_id>`
6. azione `scarica_candidati` (import da API)
7. collegamento almeno un dispositivo scanner (QR + token registrazione)
8. avvio check-in
9. check-in candidati da dispositivo scanner
10. conclusione check-in
11. generazione liste (XLSX + CSV Moodle) e avanzamento stato
12. invio liste via email (backup) e avanzamento stato

### 11.2 Flusso dispositivo scanner
1. utente autenticato apre `/device-link?session_id=...&token=...`
2. pagina `scanner.html` registra dispositivo via `/api/dispositivo/registrazione`
3. riceve `device_token` e avvia heartbeat (`/api/dispositivo/ping`)
4. per ogni QR candidato:
- `/verifica-candidato` (controlli: device autorizzato, stato check-in, duplicati)
- `/checkin-candidato` per conferma
5. su uscita pagina: `/api/dispositivo/disconnetti` (best effort)

### 11.3 Flusso esperto/sede
1. accesso dashboard `/esperto` o `/sede` (ruolo richiesto)
2. gestione sessione dedicata (`/esperto/sessione/<id>` o `/sede/sessione/<id>`)
3. aggiornamento stato lato esperto:
- lista presenti aggiornata su Moodle
- avvia esame
- inizia esame
- concludi esame
4. gestione richieste reset password candidati (vista sede/esperto)

### 11.4 Flusso notifiche
- `add_notification()` inserisce eventi/messaggi in `session_notifications`
- frammento `/sessione/<id>/notifiche-frammento` mostra feed cronologico
- endpoint POST permette messaggi manuali

## 12. Integrazioni esterne
- OIDC provider (login/refresh/logout)
- API Selezioni Online:
- `GET /openapi/v1/call/commissions`
- `GET /openapi/v1/call/exam-sessions/<commission_id>`
- SMTP relay interno per invio liste
- `api.ipify.org` (solo da scanner frontend per IP pubblico dispositivo)

## 13. Struttura database (PostgreSQL)
Schema creato in `init_db.py`.

### 13.1 `commissions`
- `commission_id` TEXT
- `titolo` TEXT
- `user_email` TEXT
- `data_sync` TEXT
- PK: (`commission_id`, `user_email`)

### 13.2 `user_roles`
- `user_email` TEXT
- `role` TEXT
- `created_by` TEXT
- `created_at` TIMESTAMP
- PK: (`user_email`, `role`)

### 13.3 `sessioni`
- `session_id` TEXT PK
- `commission_id` TEXT
- `user_email` TEXT
- `session_string` TEXT
- `nome` TEXT
- `giorno` TEXT (`dd/mm/yyyy`)
- `ora` TEXT (`HH:MM`)
- `luogo` TEXT
- `data_esame` TEXT/TIMESTAMP-like (dipende da inserimento)
- `attiva` BOOLEAN
- `candidati_importati` BOOLEAN
- `sync_user_email` TEXT
- `data_sync` TEXT
- `stato_corrente` TEXT default `iniziale`
- FK (`commission_id`,`user_email`) -> `commissions`

### 13.4 `session_notifications`
- `id` SERIAL PK
- `session_id` TEXT FK -> `sessioni`
- `author_email` TEXT
- `type` TEXT
- `payload` TEXT
- `created_at` TIMESTAMP
- indice: (`session_id`, `created_at DESC`)

### 13.5 `session_state_log`
- `id` SERIAL PK
- `session_id` TEXT FK -> `sessioni`
- `stato` TEXT
- `timestamp` TIMESTAMP
- `utente` TEXT

### 13.6 `candidati`
- `uid` TEXT
- `session_id` TEXT
- `first_name` TEXT
- `last_name` TEXT
- `birthdate` TEXT
- `fiscal_code` TEXT
- `document_type` TEXT
- `document_number` TEXT
- `document_date` TEXT (`dd/mm/yyyy`)
- `document_issued_by` TEXT
- `checkin_effettuato` BOOLEAN
- `documento_scaduto` BOOLEAN
- campi reset password: richiesto/effettuato + timestamp/by
- PK: (`uid`, `session_id`)
- FK `session_id` -> `sessioni`

### 13.7 `dispositivi`
- `id` SERIAL PK
- `ip_address` TEXT
- `user_agent` TEXT
- `session_id` TEXT
- `nome_dispositivo` TEXT
- `device_token` TEXT (unique index)
- `last_seen` TIMESTAMP
- `disconnected_at` TIMESTAMP
- `timestamp` TIMESTAMP

### 13.8 `liste_generate`
- `id` SERIAL PK
- `session_id` TEXT
- `file_xlsx` TEXT
- `file_csv_moodle` TEXT
- `num_presenti` INTEGER
- `generato_da` TEXT
- `timestamp_creazione` TIMESTAMP

## 14. Mappa endpoint (per area)

### 14.1 Auth e sessione utente
- `/login`, `/oidc-callback`, `/logout`
- `/api/userinfo`, `/me`, `/user/session/status`, `/user/session/refresh`, `/user/session/debug`

### 14.2 Dashboard/sessioni
- `/`, `/dashboard/segretario`
- `/sessioni`, `/sessioni/<commission_id>/frammento`
- `/sync-commissioni`, `/get-sessioni/<commission_id>`, `/sessione/<session_id>`

### 14.3 Gestione operativa sessione
- `/gestione-concorso/<session_id>`
- `/sessione/<session_id>/azioni-frammento`
- azioni stato: `scarica_candidati`, `verifica_dispositivi`, `avvia_checkin`, `concludi_checkin`, `genera_liste`, `invia-lista-esame`, stati esperto

### 14.4 Candidati/check-in/reset
- `/get-candidati`
- `/sessione/<session_id>/tabella_candidati`
- `/verifica-candidato`, `/checkin-candidato`
- `/sessione/<session_id>/candidato/<uid>/toggle_checkin`
- reset password fragment/toggle

### 14.5 Dispositivi scanner
- `/qr-code/<session_id>`
- `/device-link`
- `/api/dispositivo/registrazione`
- `/api/dispositivo/ping`
- `/api/dispositivo/disconnetti`
- `/dispositivi/<session_id>`

### 14.6 Esperto/admin/notifiche/debug
- `/esperto`, `/sede`, `/esperto/sessione/<id>`, `/sede/sessione/<id>`
- `/admin/permessi` (+ add/remove)
- `/sessione/<id>/notifiche-frammento`, `/sessione/<id>/notifiche`
- `/debug/sessioni`, `/log`

## 15. Output file e cartelle operative
- cartella output liste: `files_liste/` (configurabile via `FILES_BASE_DIR`)
- tipi generati:
- XLSX presenti
- CSV uid
- CSV Moodle arricchito (candidati + valutatori)

DB salva i **nomi file**; i path assoluti sono risolti lato app.

## 16. Logging e osservabilità
- setup in `utils/logging_setup.py`
- formato JSON line (`instance/logs/app.jsonl`)
- rotazione file (5MB x 5)
- redirect di `stdout/stderr` al logger
- endpoint `GET /log?n=<righe>` per tail runtime

## 17. Qualità del codice: stato attuale
Situazione attuale:
- architettura a blueprint già presente
- workflow stato sessione formalizzato
- refresh token OIDC implementato
- RBAC base operativo
- copertura test assente (in `tests/` c'è solo cache `.pyc`)

## 18. TODO e miglioramenti (priorità)

### P0 - Sicurezza/affidabilità
1. Uniformare i controlli autorizzazione per tutte le route session-based.
2. Rimuovere segreti hardcoded residui/legacy e debug sensibile (es. stampe token).
3. Correggere `session-check`:
- flag debug invertito (`debug=false` oggi abilita bypass)
- va resa modalità debug esplicita e protetta.
4. Aggiungere `CREATE TABLE IF NOT EXISTS` anche a `liste_generate` in `init_db.py`.
5. Proteggere endpoint debug (`/debug/sessioni`, `/log`) con auth+ruolo admin.

### P1 - Coerenza funzionale
1. Evitare doppioni logica import candidati (route + util).
2. Consolidare gestione stato tra vista segretario/esperto per evitare transizioni bloccanti.
3. Allineare tipi colonna data/ora (oggi mix testo/datetime).
4. Normalizzare response API (alcuni endpoint HTMX restituiscono HTML, altri JSON).

### P2 - DX/maintainability
1. Aggiornare `.env.example` con tutte le variabili reali.
2. Rimuovere o separare chiaramente i file legacy (`server_sqlite.py`, `server copy.py`).
3. Introdurre layer service/repository per ridurre SQL duplicato nelle route.
4. Scrivere test automatici minimi su:
- auth refresh
- transizioni stato
- import candidati/sessioni
- check-in gate e device authorization

### TODO già tracciati nel repo (`TODO.md`)
- chiarire avanzamento stato post `liste_generate` lato esperto
- gestire passaggio a `liste_inviate` anche senza invio email
- sincronizzare timeline/azioni segretario-esperto senza polling

## 19. Runbook rapido

### Avvio locale con Docker
1. compilare `.env`
2. `docker compose up --build`
3. app su `http://localhost:5050`
4. adminer su `http://localhost:8080`
5. redisinsight su `http://localhost:5540`

### Bootstrap DB
- automatico all'avvio container (`init_db.py`)
- in `APP_ENV=dev` vengono droppate e ricreate tabelle

## 20. Checklist handover per nuove feature
Quando riprendi sviluppo (umano o AI), partire da:
1. confermare variabili env mancanti o obsolete
2. definire se mantenere supporto legacy SQLite
3. scegliere priorità P0 (security) prima di nuove feature
4. aggiungere test su workflow critici
5. documentare ogni nuova transizione stato in `utils/stato.py` + UI frammenti

---
Documentazione aggiornata al codice corrente del branch locale.
