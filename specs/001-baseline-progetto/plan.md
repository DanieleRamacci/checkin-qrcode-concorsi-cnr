# Implementation Plan: Baseline Ufficiale Progetto Esistente

**Branch**: `001-baseline-progetto` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-baseline-progetto/spec.md`

**Note**: Questa feature non implementa nuovo codice applicativo. Produce una
baseline ufficiale Spec Kit dello stato corrente del progetto gia sviluppato.

## Summary

Documentare lo stato as-is di Check-in CNR Concorsi dentro la struttura ufficiale
Spec Kit, usando come fonte il working tree corrente incluse le modifiche locali
non committate che rappresentano la versione attuale. La baseline deve rendere
verificabili flussi, architettura, dati, contratti HTTP, integrazioni, rischi e
lavoro successivo, senza introdurre la migrazione Angular dentro questa fase.

Approccio tecnico:

- usare il codice esistente come fonte primaria
- includere lo split corrente tra configurazione bando e configurazione sessione
- includere l'integrazione corrente JConon/OpenAPI per RDP e componenti
  commissione
- usare la documentazione manuale preparatoria come materiale di supporto
- generare artefatti canonici sotto `specs/001-baseline-progetto/`
- lasciare miglioramenti e Angular come future feature Spec Kit

## Technical Context

**Language/Version**: Python 3 con Flask 3.1.1; JavaScript vanilla per frontend
esistente

**Primary Dependencies**: Flask, Flask-Session, psycopg2, redis, requests,
PyJWT, qrcode, fpdf, Pillow, openpyxl, gunicorn

**Storage**: PostgreSQL primario; Redis opzionale per session store; filesystem
per sessioni in sviluppo, log e liste generate

**Testing**: nessuna suite applicativa rilevante presente; baseline validata con
controlli documentali e ricognizione file

**Target Platform**: web app containerizzata con Docker/Gunicorn, DB PostgreSQL e
servizi opzionali Redis/Adminer/RedisInsight

**Project Type**: web application backend-rendered con Flask, Jinja, HTMX e
JavaScript vanilla

**Performance Goals**: non definiti nel codice o nella richiesta; la baseline non
introduce obiettivi prestazionali nuovi

**Constraints**: non modificare logica applicativa; distinguere as-is da to-be;
preservare workflow esistente; includere le modifiche locali correnti come
baseline quando rappresentano comportamento della versione attuale; non
trasformare la migrazione Angular in lavoro implicito

**Scale/Scope**: repository monolitico Flask con blueprint, template, utility,
schema PostgreSQL, Docker e documentazione esistente

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Stato Applicativo Esplicito**: PASS. La baseline documenta stati e
  transizioni correnti senza modificarli.
- **II. Autorizzazione Prima della Logica**: PASS con gap registrati. La
  baseline identifica endpoint debug/log e ownership route come rischi da
  affrontare in future spec.
- **III. Backend Come Fonte di Verita**: PASS. La baseline mantiene Flask e
  PostgreSQL come fonte as-is.
- **IV. Integrazioni Isolate e Tracciabili**: PASS con gap registrati. Le
  integrazioni sono inventariate; eventuali refactor saranno feature successive.
- **V. Migrazione Incrementale e Verificabile**: PASS. Angular e API JSON sono
  descritti come percorso successivo, non come parte della baseline.

## Project Structure

### Documentation (this feature)

```text
specs/001-baseline-progetto/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── current-http-map.md
│   └── angular-readiness.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
.
├── server_pg.py
├── init_db.py
├── db.py
├── routes/
│   ├── azioni.py
│   ├── dashboard.py
│   └── ...
├── utils/
│   ├── sessioni.py
│   ├── jconon_referenti.py
│   └── ...
├── templates/
│   ├── bando_config.html
│   ├── bando_dettaglio.html
│   └── ...
├── static/
├── docs/
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

**Structure Decision**: mantenere il repository Flask esistente e considerare le
modifiche locali correnti come parte della baseline applicativa. La baseline non
sposta codice e non crea una cartella Angular. La futura migrazione dovra essere
una feature separata con struttura propria, probabilmente `frontend/`.

## Complexity Tracking

Nessuna violazione costituzionale richiesta dalla baseline. La complessita
rilevata e documentale: il sistema esistente mescola HTML server-side, frammenti
HTMX e JSON. La baseline la descrive senza introdurre astrazioni nuove.
