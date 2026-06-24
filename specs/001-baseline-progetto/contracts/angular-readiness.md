# Contract: Angular Readiness

Questo documento non autorizza la migrazione Angular. Definisce le condizioni
minime che una futura spec Angular dovra rispettare.

## Stato Corrente

- UI server-rendered con Jinja
- frammenti HTMX per aggiornamenti parziali
- JavaScript vanilla in `static/js/`
- Flask gestisce OIDC e sessioni server-side
- route miste: HTML, frammenti, JSON, file, redirect
- configurazione bando e sessione gia separate lato backend
- integrazione JConon/OpenAPI usata per precompilare dati di bando in modalita
  best-effort

## Condizioni Prima di Angular

Una futura feature Angular dovra introdurre:

- namespace API JSON, ad esempio `/api/v1`
- contratti per commissioni, sessioni, candidati, dispositivi, notifiche e azioni
- contratti separati per configurazione bando e configurazione sessione
- contratto per refresh/import dati bando da JConon/OpenAPI
- formato errori uniforme
- strategia auth esplicita
- strategia CSRF se si usano cookie sessione
- test o checklist per flussi critici
- fallback o piano di rollback per viste migrate

## Strategia Raccomandata

1. Stabilizzare auth, route debug e ownership.
2. Creare API JSON senza rimuovere Jinja/HTMX.
3. Migrare viste a basso rischio.
4. Migrare azioni workflow solo dopo test.
5. Migrare scanner per ultimo o con particolare validazione.

## Fuori Scope della Baseline

- creazione `frontend/`
- installazione Angular
- modifica deploy
- sostituzione Jinja/HTMX
- modifica auth OIDC
