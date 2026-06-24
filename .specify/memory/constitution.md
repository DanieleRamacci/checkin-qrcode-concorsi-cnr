<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- [PRINCIPLE_1_NAME] -> I. Stato Applicativo Esplicito
- [PRINCIPLE_2_NAME] -> II. Autorizzazione Prima della Logica
- [PRINCIPLE_3_NAME] -> III. Backend Come Fonte di Verita
- [PRINCIPLE_4_NAME] -> IV. Integrazioni Isolate e Tracciabili
- [PRINCIPLE_5_NAME] -> V. Migrazione Incrementale e Verificabile
Added sections:
- Vincoli Tecnici Correnti
- Workflow e Quality Gates
Removed sections:
- Placeholder template sections
Templates requiring updates:
- .specify/templates/plan-template.md: reviewed, no change required
- .specify/templates/spec-template.md: reviewed, no change required
- .specify/templates/tasks-template.md: reviewed, no change required
- .specify/templates/checklist-template.md: reviewed, no change required
Follow-up TODOs: none
-->

# Check-in CNR Concorsi Constitution

## Core Principles

### I. Stato Applicativo Esplicito

Ogni sessione di concorso MUST avanzare tramite stati dichiarati, validati e
tracciati. Le transizioni di stato devono essere definite nel dominio
applicativo, avere precondizioni esplicite e produrre audit persistente. Non sono
ammessi bypass impliciti per saltare passaggi critici del workflow operativo.

Rationale: il check-in concorsi e un processo sequenziale con impatto operativo;
stati non tracciati rendono difficile ricostruire responsabilita, errori e
blocchi.

### II. Autorizzazione Prima della Logica

Ogni operazione su sessioni, candidati, dispositivi, liste, ruoli, log o
configurazioni MUST verificare autenticazione, ruolo applicativo e relazione con
la risorsa prima di leggere o modificare dati. Gli endpoint debug o
amministrativi MUST essere disabilitati o protetti in produzione.

Rationale: il sistema tratta dati personali e informazioni operative di concorsi
CNR; la correttezza del workflow dipende dal fatto che ogni attore possa operare
solo sulle risorse autorizzate.

### III. Backend Come Fonte di Verita

Il backend e il database persistente MUST restare la fonte di verita per stato
sessione, candidati, dispositivi, liste, notifiche, ruoli e configurazioni. Il
frontend puo migliorare l'esperienza utente, ma non deve duplicare o sostituire
regole di business critiche.

Rationale: il progetto oggi usa Flask/PostgreSQL per orchestrare workflow,
integrazioni e audit; eventuali frontend futuri devono consumare contratti
backend stabili.

### IV. Integrazioni Isolate e Tracciabili

Le integrazioni esterne MUST essere isolate in moduli o servizi dedicati, con
errori gestiti, loggati e comprensibili. OIDC, API Selezioni Online, SMTP,
Moodle/file liste e servizi esterni usati dallo scanner non devono contaminare la
logica delle viste oltre il necessario.

Rationale: i sistemi esterni possono non essere disponibili o cambiare contratto;
isolarli riduce regressioni e rende verificabili i fallimenti.

### V. Migrazione Incrementale e Verificabile

Ogni migrazione tecnologica, inclusa una futura migrazione Angular, MUST essere
incrementale, reversibile e coperta da specifiche, piani e task separati. Non e
ammessa una riscrittura simultanea di backend, autenticazione, workflow e UI senza
API intermedie e criteri di validazione.

Rationale: il sistema contiene flussi gia sviluppati e operativi; una migrazione
frontale aumenterebbe il rischio di regressioni nei passaggi piu critici.

## Vincoli Tecnici Correnti

Il runtime principale e `server_pg.py`. Il backend usa Flask, blueprint, sessioni
server-side e PostgreSQL. Il frontend corrente usa template Jinja, frammenti HTMX
e JavaScript vanilla. L'autenticazione e basata su OIDC authorization code flow.
La containerizzazione usa Docker e docker-compose; Redis puo essere usato come
session store.

Le specifiche future devono indicare esplicitamente se modificano:

- macchina a stati sessione
- schema DB o migrazioni
- autenticazione/sessione
- autorizzazioni
- contratti API o risposte HTML/HTMX
- integrazioni esterne
- generazione o invio liste

## Workflow e Quality Gates

Ogni feature significativa MUST seguire il flusso Spec Kit:

1. aggiornare o consultare questa constitution
2. creare una spec in `specs/`
3. produrre un piano tecnico
4. derivare task verificabili
5. implementare solo dopo che scope, rischi e validazione sono espliciti

Prima di modifiche applicative critiche devono essere verificati:

- controlli auth/ruolo/ownership sulle route coinvolte
- impatto su stati e transizioni
- impatto su dati personali o log
- comportamento in errore
- scenario di validazione manuale o automatico

## Governance

Questa constitution prevale su documentazione informale, note locali e decisioni
ad hoc quando si lavora con Spec Kit. Gli emendamenti richiedono:

- motivazione documentata
- aggiornamento della versione semantica
- revisione degli artefatti Spec Kit impattati
- indicazione dei task di adeguamento, se necessari

Versioning:

- MAJOR: principi rimossi o ridefiniti in modo incompatibile
- MINOR: nuovi principi o nuove sezioni normative
- PATCH: chiarimenti, correzioni e miglioramenti non semantici

Ogni plan deve includere un Constitution Check. Ogni tasks.md deve contenere task
di verifica per sicurezza, workflow e documentazione quando la feature li tocca.

**Version**: 1.0.0 | **Ratified**: 2026-06-24 | **Last Amended**: 2026-06-24
