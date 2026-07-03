# Architettura della migrazione

Fonte: [`specs/002-angular-api-first-migration/plan.md`](../../specs/002-angular-api-first-migration/plan.md),
[`data-model.md`](../../specs/002-angular-api-first-migration/data-model.md),
[`contracts/api-v1-target.md`](../../specs/002-angular-api-first-migration/contracts/api-v1-target.md).

## Da monolite a API-first

**Prima (legacy)**: un unico container Flask serve sia le pagine HTML
(Jinja/HTMX) sia la logica applicativa. Backend e frontend non sono
separabili.

**Dopo (migrazione)**: due processi/immagini distinti:

- **Backend** (`server_pg.py`, invariato come entry point): espone
  esclusivamente API JSON versionate sotto `/api/v1`. Le route Jinja/HTMX
  legacy restano attive in parallelo come fallback, finche' non e' superata
  la relativa validazione di parita'.
- **Frontend** (`frontend/`): applicazione Angular 21 standalone, costruita
  con Angular CLI e **Design Angular Kit** (Bootstrap Italia) per componenti,
  struttura visiva e accessibilita' AgID. Servita da Nginx, che fa anche da
  reverse proxy verso il backend per le rotte API/login/callback OIDC, cosi'
  browser e backend condividono lo stesso *origin* (nessun problema CORS,
  cookie di sessione validi su entrambi i lati).

Il dev proxy locale (`frontend/proxy.conf.json`) replica lo stesso
instradamento in sviluppo, inoltrando `/api`, `/login`, `/logout` e il
callback OIDC al backend Flask.

## Perche' due immagini Docker

In produzione/test, Coolify avvia entrambi i container sulla stessa rete
interna. Solo il **frontend** e' esposto pubblicamente (porta 8080); il
backend (porta 5050) e' raggiungibile solo dalla rete interna, mai
direttamente da internet. Questo mantiene lo stesso modello di sicurezza del
legacy (nessuna porta dati o applicativa esposta oltre il necessario) pur
avendo due processi separati.

## Contratto API `/api/v1`

Tutte le risposte sono JSON. Gli errori seguono un formato uniforme:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {},
    "request_id": "string"
  }
}
```

Le mutazioni (`POST`/`PUT`/`PATCH`/`DELETE`) su sessione cookie richiedono un
token CSRF ottenuto da `/api/v1/me` nell'header `X-CSRF-Token`.

Aree principali esposte: autenticazione e contesto utente, bandi e relativa
configurazione, sessioni e workflow a stati, candidati (import/filtri/
check-in/reset password), dispositivi e scanner, liste (generazione/
download/invio), notifiche, amministrazione ruoli/log. Il dettaglio
endpoint-per-endpoint e' nel contratto
[`api-v1-target.md`](../../specs/002-angular-api-first-migration/contracts/api-v1-target.md).

## Frontend Angular

Struttura standalone (nessun `NgModule` applicativo), routing lazy per
feature, layout condiviso con header/footer/navigazione **Design Angular
Kit**. Aree funzionali: home/selezione profilo, bandi, dettaglio e
configurazione bando, elenco sessioni, gestione sessione (azioni a stato,
timeline, notifiche/chat, candidati, dispositivi), scanner con fotocamera,
amministrazione permessi/log.

Un client API condiviso (`core/api-client.ts`) centralizza autenticazione
cookie, header CSRF e gestione errori uniforme; un `AuthGuard` protegge le
rotte autenticate e reindirizza al login OIDC del backend.

## Cosa NON cambia

- Il modello dati PostgreSQL e la macchina a stati sessione restano
  identici e sono l'unica fonte di verita' (il frontend non duplica regole
  di business).
- L'autenticazione resta OIDC lato backend (authorization code flow); il
  frontend non gestisce credenziali, si appoggia al redirect Flask.
- Le integrazioni esterne (Selezioni Online/JConon, SMTP) restano isolate
  in moduli backend dedicati (`utils/*_service.py`), non replicate lato
  client.
- La futura piattaforma esami resta esplicitamente fuori scope.

## Vincoli espliciti della migrazione

- Non toccare il branch `checkin-dev`.
- Nessuna riscrittura simultanea di backend, autenticazione, workflow e UI:
  si procede per milestone verificabili con fallback legacy attivo.
- Angular e Design Angular Kit devono restare sulla stessa major supportata
  (attualmente Angular 21 LTS).
