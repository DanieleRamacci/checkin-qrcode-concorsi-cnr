# Implementation Plan: Revisione dell'interfaccia guidata dal "prossimo passo"

**Branch**: `013-revisione-ui-design` (lavoro sul branch `test`) | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-revisione-ui-design/spec.md`

## Summary

Riprogettare il frontend Angular secondo il pacchetto di consegna di Claude
Design ([docs/design-revisione/](../../docs/design-revisione/README.md),
schermate P01–P22 e P09a–P09e, aggiornato al 19/10/2026): header a una fascia,
scelta profilo, home per ogni profilo (segretario, "Le mie sessioni" per
informatico in sede ed esperto remoto, dashboard referente), elenchi paginati,
pagina sessione con pannello "Azioni · cosa fare adesso" e timeline a quattro
fasi, dispositivi dentro la sessione, scanner a schermo intero con i suoi stati,
reset password gestito nella tabella dei presenti con email all'esperto,
configurazione bando con salvataggio unico, chat in un pannello laterale, area
Amministrazione, avviso di accesso scaduto e pagina di uscita. Si resta su
`design-angular-kit` e Bootstrap Italia, aggiungendo il foglio condiviso
`proposta.css`. L'informatico in sede ha, come riserva, la sezione "Azioni del
segretario" chiusa per impostazione predefinita. Il backend riceve solo
aggiunte: ora e origine della presenza, storico degli stati con il ruolo,
prossima sessione nell'elenco concorsi, profili dell'utente, sessioni
assegnate, endpoint per lo scanner e per scollegare dispositivi, email di reset.
Macchina a stati, autorizzazioni e generazione liste non cambiano. Decisioni in
[research.md](research.md).

## Technical Context

**Language/Version**: Python 3.11 (backend Flask); TypeScript con Angular 21.2
(frontend)

**Primary Dependencies**: Flask, psycopg2, PyJWT; `design-angular-kit` 21.2,
`bootstrap-italia` 2.18.1, RxJS

**Storage**: PostgreSQL; due colonne aggiunte a `candidati` tramite la
migrazione runtime esistente (`utils/schema.py`)

**Testing**: pytest (suite backend, 163 test oggi); Vitest via `ng test` per il
frontend; verifica visiva e di accessibilità sul server di test
([quickstart.md](quickstart.md))

**Target Platform**: container su Coolify; browser desktop recenti (PC in aula,
1280–1440px) e smartphone iOS/Android (Safari, Chrome, 390px)

**Project Type**: applicazione web (backend API Flask + SPA Angular)

**Performance Goals**: nessun polling in più rispetto a oggi (stato e candidati
5 s, chat 10 s), salvo il riepilogo dello scanner ogni 5 s solo mentre è
bloccato in attesa del check-in; home e "I miei concorsi" con una sola chiamata
all'elenco concorsi; esito della conferma presenza visibile entro 1 s

**Constraints**: WCAG 2.1 AA / AgID; budget del bundle iniziale di
`angular.json` (avviso 2.25 MB, errore 2.5 MB); nessuna pagina con scorrimento
orizzontale a 390px; componenti del design system della PA

**Scale/Scope**: circa 30 schermate; sessioni fino a qualche centinaio di
candidati; decine di concorsi per utente; 5 profili

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Esito | Motivazione |
| --- | --- | --- |
| I. Stato applicativo esplicito | PASS | Nessuna modifica a stati e transizioni; le fasi sono solo presentazione ([contracts/ui-session-states.md](contracts/ui-session-states.md)) |
| II. Autorizzazione prima della logica | PASS | Campi nuovi dentro rotte già autorizzate; gli endpoint scanner nuovi usano lo stesso controllo del token dispositivo degli esistenti; scollegamento dispositivi con l'accesso alla sessione; `/sessioni/assegnate` restituisce solo le sessioni in cui l'utente è assegnato; `/me` e lo storico restituiscono solo dati già visibili, senza email. L'informatico in sede vede le azioni del segretario che il backend gli permette già (R12); le restrizioni sono nella feature 014 |
| III. Backend come fonte di verità | PASS | Azioni disponibili sempre da `/sessioni/<id>/state`; ora e origine della presenza e stato del reset salvati nel backend; il frontend non introduce regole di business |
| IV. Integrazioni isolate e tracciabili | PASS | Nessuna integrazione nuova: l'email di reset riusa `utils/send_mail.py` con i suoi log; Selezioni Online e Moodle non cambiano |
| V. Migrazione incrementale e verificabile | PASS | Consegna per user story, ognuna pubblicabile e annullabile da sola (R15) |

Impatti da dichiarare (vincoli tecnici della constitution):

- macchina a stati sessione: **no**;
- schema DB: **sì**, due colonne su `candidati` con `ADD COLUMN IF NOT EXISTS`;
- autenticazione/sessione: **sì, solo interfaccia**: avviso prima del
  reindirizzamento al login (R22); flusso OIDC e sessione invariati;
- autorizzazioni: **no** (nuovi endpoint con il controllo esistente);
- contratti API: **sì**, solo aggiunte ([contracts/api-changes.md](contracts/api-changes.md));
- integrazioni esterne: **sì, riuso**: email all'esperto per ogni richiesta di
  reset tramite il servizio email esistente;
- generazione o invio liste: **no** (cambia solo la visibilità dei download).

Quality gate su dati personali: la ricerca dallo scanner restituisce al massimo
10 candidati della sola sessione del dispositivo e non registra nei log il testo
cercato; l'email di reset contiene solo nome e cognome del candidato e il
collegamento alla sessione.

**Ricontrollo dopo la Phase 1**: PASS, nessuna violazione; la sezione
Complexity Tracking non serve.

## Project Structure

### Documentation (this feature)

```text
specs/013-revisione-ui-design/
├── spec.md
├── plan.md                      # questo file
├── research.md                  # decisioni R1–R23
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-changes.md
│   ├── ui-session-states.md
│   └── ui-screens.md
├── checklists/requirements.md
└── tasks.md                     # creato da /speckit-tasks

docs/design-revisione/           # riferimento visivo (pacchetto di Claude Design)
├── 01-principi.md … 06-da-completare.md
├── stili/proposta.css           # foglio app-*
├── prototipo/                   # pagine HTML navigabili (P01–P22, P09a–P09e)
└── screenshot/                  # 30 immagini, desktop 1280 px e smartphone 390 px
```

### Source Code (repository root)

```text
# Backend (solo aggiunte)
init_db.py                               # colonne checkin_at, checkin_source
utils/schema.py                          # migrazione runtime delle due colonne
utils/candidati_service.py               # toggle: ora e origine; elenco con i campi; email alla richiesta di reset
utils/scanner_service.py                 # checkin con origine; verifica con ora/origine; riepilogo; ricerca; nota
routes/api_v1/scanner.py                 # session-summary, search-candidates, candidate-note; 409 con current_state
utils/devices_service.py                 # scollegamento dalla pagina sessione
routes/api_v1/devices.py                 # POST /sessioni/<id>/devices/<device_id>/disconnect
routes/api_v1/bandi.py                   # list_bandi: next_session
routes/api_v1/sessioni.py                # GET /sessioni/assegnate
routes/api_v1/auth.py                    # /me: profiles
utils/workflow_service.py                # describe_workflow: history con ruolo di chi ha agito
tests/api/                               # test di campi, endpoint ed email nuovi

# Frontend
frontend/src/styles.scss                 # importa styles/_app.scss dopo Bootstrap Italia
frontend/src/styles/_app.scss            # da docs/design-revisione/stili/proposta.css
frontend/src/app/app.routes.ts           # '/', '/segretario', '/le-mie-sessioni', '/admin', scanner fuori layout, redirect dispositivi
frontend/src/app/layout/                 # header a una fascia con profilo attivo e menu per profilo
frontend/src/app/core/reauth.interceptor.ts  # modale di accesso scaduto prima del login
frontend/src/app/shared/                 # mappa stati/fasi/ruoli, pannello azioni, contatori-filtro, paginazione
frontend/src/app/core/models/api.models.ts  # campi nuovi
frontend/src/app/features/home/          # scelta profilo (P01a), home segretario (P01)
frontend/src/app/features/le-mie-sessioni/  # home di informatico in sede ed esperto remoto (P15, P16)
frontend/src/app/features/bandi/         # I miei concorsi (P02), dashboard referente (P17)
frontend/src/app/features/sessioni/      # sessioni del concorso (P03)
frontend/src/app/features/configurazioni/  # configura bando (P04)
frontend/src/app/features/gestione-sessione/  # pagina sessione e pannelli per profilo (P05–P14)
frontend/src/app/features/candidati/     # sezione candidati con colonna reset
frontend/src/app/features/dispositivi/   # pannello dispositivi riusabile
frontend/src/app/features/scanner/       # scanner a schermo intero e suoi stati (P09–P09e)
frontend/src/app/features/notifiche/     # chat: pulsante fisso e pannello laterale (P12)
frontend/src/app/features/admin/         # area Amministrazione con menu laterale (P18–P20)
frontend/src/app/features/auth/          # pagina di uscita (P22)
```

**Structure Decision**: applicazione web con backend Flask nella radice
(`routes/`, `utils/`, `tests/`) e SPA Angular in `frontend/`. La feature lavora
sulle cartelle `features/` esistenti, aggiunge `features/le-mie-sessioni/`,
componenti condivisi in `shared/` e il foglio `styles/_app.scss`; nessun nuovo
progetto o pacchetto.

## Fasi di consegna (input per /speckit-tasks)

1. **Fondazioni**: foglio `_app.scss`, header a una fascia, mappa stati/fasi/ruoli,
   pannello azioni, contatori-filtro, paginazione.
2. **US1 – Pagina sessione** (P1): testata, timeline con ora e ruolo, pannello
   azioni segretario per i 12 stati, dispositivi nella sessione, modale di
   conclusione, file sempre scaricabili; backend: ora e origine della presenza,
   storico degli stati, scollegamento dispositivi.
3. **US2 – Smartphone e scanner** (P1): sessione mobile con schede, scanner a
   schermo intero con P09a–P09e e sblocco automatico; backend: riepilogo,
   ricerca, nota, verifica con ora e origine, 409 con stato.
4. **US3 – Navigazione** (P2): scelta profilo, home segretario, I miei concorsi,
   sessioni; backend: `profiles` in `/me`, prossima sessione in `/bandi`.
5. **US4 – Profili tecnici** (P2): "Le mie sessioni", pannelli informatico in
   sede (con "Azioni del segretario") ed esperto remoto, reset nella tabella dei
   presenti; backend: sessioni assegnate, email di reset.
6. **US5 – Referente** (P3), **US6 – Chat** (P3), **US7 – Amministrazione** (P3),
   **US8 – Accesso scaduto e uscita** (P3).

Ogni fase si chiude con test verdi, build di produzione e verifica sul server di
test secondo [quickstart.md](quickstart.md).

## Complexity Tracking

Nessuna violazione della constitution da giustificare.
