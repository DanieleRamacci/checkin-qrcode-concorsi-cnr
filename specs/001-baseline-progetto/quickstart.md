# Quickstart: Validazione Baseline

Questa guida valida la baseline documentale. Non richiede esecuzione completa di
OIDC, API CNR, SMTP o Moodle.

## Prerequisiti

- repository locale disponibile
- Spec Kit inizializzato con `.specify/`
- feature corrente registrata in `.specify/feature.json`

## Controlli Strutturali

1. Verificare che esista la constitution ufficiale:

   ```bash
   test -f .specify/memory/constitution.md
   ```

2. Verificare gli artefatti della feature:

   ```bash
   find specs/001-baseline-progetto -maxdepth 3 -type f | sort
   ```

   Output atteso:

   - `spec.md`
   - `plan.md`
   - `research.md`
   - `data-model.md`
   - `quickstart.md`
   - `contracts/current-http-map.md`
   - `contracts/angular-readiness.md`
   - `checklists/requirements.md`
   - `tasks.md`

3. Verificare assenza di placeholder Spec Kit irrisolti nei documenti
   principali:

   ```bash
   rg "\\[[A-Z][A-Z_ ]{2,}\\]|NEEDS.CLARIFICATION|\\$ARGUMENTS" \
     specs/001-baseline-progetto/spec.md \
     specs/001-baseline-progetto/plan.md \
     specs/001-baseline-progetto/research.md \
     specs/001-baseline-progetto/data-model.md \
     specs/001-baseline-progetto/contracts \
     .specify/memory/constitution.md
   ```

   Output atteso: nessuna riga.

## Controlli di Coerenza con il Codice

0. Verificare che la baseline parta dal working tree corrente:

   ```bash
   git status --short
   ```

   Output atteso: possono essere presenti modifiche applicative non committate;
   questa baseline le considera parte dello stato corrente da documentare.

1. Verificare entry point principali:

   ```bash
   test -f server_pg.py
   test -f init_db.py
   test -f db.py
   ```

2. Verificare blueprint registrati:

   ```bash
   sed -n '1,220p' routes/__init__.py
   ```

   Output atteso: blueprint per auth, dashboard, sessioni, gestione concorso,
   commissioni, candidati, dispositivi, user, scanner, azioni, admin permessi e
   notifiche.

3. Verificare route documentate:

   ```bash
   rg "@(.*route|[a-z_]+_bp\\.route|app\\.route)" routes server_pg.py -n
   ```

   Output atteso: route coerenti con `contracts/current-http-map.md`.

4. Verificare stati sessione:

   ```bash
   sed -n '1,180p' utils/stato.py
   ```

   Output atteso: stati coerenti con `spec.md` e `data-model.md`.

5. Verificare tabelle:

   ```bash
   rg "CREATE TABLE IF NOT EXISTS" init_db.py
   ```

   Output atteso: tabelle coerenti con `data-model.md`.

6. Verificare configurazione bando/sessione:

   ```bash
   rg "bando_config|sessione_config|get_merged_config|fetch_e_salva_bando_meta" init_db.py routes utils templates -n
   ```

   Output atteso: riferimenti coerenti con `spec.md`, `data-model.md` e
   `contracts/current-http-map.md`.

## Validazione di Scope

- La baseline non deve creare `frontend/`.
- La baseline non deve modificare route o template applicativi.
- La migrazione Angular deve comparire solo come readiness/fase successiva.
- I miglioramenti devono comparire in `tasks.md` come follow-up o task di
  classificazione, non come fix gia applicati.

## Esito Atteso

La baseline e valida quando:

- la structure Spec Kit ufficiale esiste
- gli artefatti sono completi
- non restano placeholder
- la mappa tecnica e coerente con il codice corrente
- i gap sono esplicitati senza essere implementati in questa fase
