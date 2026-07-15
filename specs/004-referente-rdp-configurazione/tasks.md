# Tasks: Accesso referente/RDP alla configurazione bando

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`

**Aggiornato**: 2026-07-08 — questo file registra cosa è stato costruito e
cosa resta, non è stato generato da zero con `/speckit-tasks` prima
dell'implementazione (l'ordine reale è stato: implementazione del punto più
urgente — l'autorizzazione senza trucchi — poi stesura di spec/tasks per
documentarlo).

## Fase 0: Setup/Foundational — ✅ Completata

- [x] T001 Tabella `bando_referenti` (commission_id, user_email normalizzata,
      nome, synced_at) in `init_db.py`, additiva (`CREATE TABLE IF NOT
      EXISTS`), aggiunta anche al blocco `DROP` di sviluppo.
- [x] T002 `utils/authorization.py`: flag `allow_referente` su
      `can_access_commission` e `commission_access_required`; quando attivo
      controlla anche `bando_referenti`, altrimenti comportamento invariato.
- [x] T003 `utils/jconon_service.py::_persist_referente_bandi` riscritta:
      upsert su `bando_referenti` + `DELETE` delle righe non più restituite
      per l'utente (revoca reale). Non scrive più su `commissions`.
- [x] T004 `allow_referente=True` cablato solo su `bando_detail`,
      `bando_sync_metadata` (`routes/api_v1/bandi.py`) e `bando_config_get`,
      `bando_config_put`, `bando_config_request`
      (`routes/api_v1/configurazioni.py`). Sessioni/candidati/dispositivi
      restano riservati a segretario/commissione (default invariato).
- [x] T005 `get_bando()` in `routes/api_v1/bandi.py` non dipende più
      esclusivamente da `commissions`: se manca una riga (nessun segretario
      ha ancora sincronizzato il bando), recupera titolo/stato da
      `bando_referenti` invece di rispondere 404 a un RDP autorizzato.
- [x] T006 Test: `tests/test_authorization.py` (casi `allow_referente`
      on/off), `tests/test_jconon_referente_sync.py` (upsert + revoca totale
      e parziale). `pytest` (69/69) e `npm run build` (frontend) verificati.

## User Story 1 — Referente vede i propri bandi da configurare (P1)

- [x] Lista filtrata via `POST /referenti/bandi/sync` →
      `frontend/.../referente-bandi.component.ts`, route `/referenti/bandi`.
- [x] Filtro lato server per email RDP normalizzata
      (`_is_current_user_rdp` in `utils/jconon_service.py`).
- [x] FR-008 stato minimo operativo: implementati `config_status`,
      `expert_assigned` e `required_data_complete` su `bando_config`.
      La pagina Referenti mostra se l'esperto informatico remoto e assegnato e
      se i dati principali sono compilati. Restano futuri gli stati completi
      di richiesta/audit (`requested`, `in_progress`, `completed`,
      `verification_required`).
- [x] FR-014 messaggio "nessun bando assegnato": presente lato UI
      (`referente-bandi.component.ts`) e coperto da test Angular.

## User Story 2 — Informatico richiede la compilazione (P1)

- [x] `POST /bandi/{id}/request-config` esiste ed è accessibile anche
      all'RDP stesso (per coerenza con FR-009, stessa pagina condivisa).
- [x] FR-006 "referente suggerito precompilato": gli RDP restituiti da
      Selezioni Online sono salvati come `rdp_members` e la pagina Configura
      Bando permette di scegliere `email_referente` da menu a tendina.
      Non esiste fallback manuale: se Selezioni Online non restituisce RDP
      con email, il referente non può essere impostato dall'app.
- [x] FR-007 inserimento manuale del referente: requisito ritirato. Decisione
      2026-07-15: i referenti configurabili sono solo quelli presenti nella
      lista RDP restituita da Selezioni Online; un referente assente dalla
      fonte istituzionale indica un problema da correggere su Selezioni Online,
      non un caso da sanare con inserimento manuale nell'app.
- [x] FR-011 audit di richiesta/accesso/modifica/completamento: requisito
      spostato fuori dalla chiusura di questa spec. Per il cut corrente resta
      lo stato operativo minimo (`config_status`, `configured_at`,
      `configured_by`); audit append-only e stati formali richiesta saranno
      una spec dedicata se richiesti.

## User Story 3 — Referente o segretario compila la configurazione (P2)

- [x] Stesso endpoint/pagina per segretario (via `commissions`) e RDP (via
      `bando_referenti`), nessuna duplicazione.
- [x] FR-012 più RDP sullo stesso bando: tutti quelli in `bando_referenti`
      passano `allow_referente`; lo stato minimo indica quando i dati sono
      compilati, ma non c'è ancora la logica formale "la prima compilazione
      completa chiude la richiesta" con audit/riapertura.
- [x] FR-019/FR-020 cambio RDP: il vecchio RDP perde l'accesso alla sync
      successiva (riga cancellata da `bando_referenti`); il bando già
      configurato resta intatto perché la configurazione vive in
      `bando_config`, non nella relazione di autorizzazione.
- [x] **FR-010**: `email_referente` non è più un campo libero. La UI mostra
      una select con i soli RDP disponibili da Selezioni Online; se la lista è
      vuota, mostra un avviso e non consente l'inserimento manuale. Il backend
      rifiuta qualunque email non presente tra gli RDP del bando e rifiuta
      anche l'impostazione di un referente quando non ci sono RDP istituzionali
      verificabili.
- [x] FR-013 normalizzazione email nel confronto: fatta lato
      `bando_referenti`/sync e verificata con test API case-insensitive su
      `email_referente`.

## User Story 4 — Credenziali personali eliminate dai flussi applicativi (P2)

- [x] Censimento preliminare in `research.md` (tabella "Current integration
      credential map").
- [x] FR-016 censimento formale esposto: creato
      `docs/migrazione/inventario-credenziali-integrazioni.md`.
- [x] FR-017/FR-022 rimozione credenziali personali da flussi stabili:
      `utils/jconon_referenti.py` rimosso; `routes/dashboard.py` e
      `routes/azioni.py` usano i metadati OpenAPI tramite token OIDC utente;
      `docker-compose.coolify.yml` non passa più `JCONON_USERNAME`,
      `JCONON_PASSWORD`, `AUTH_B64` o `JCONON_BEARER_TOKEN`.
- [x] FR-023 flusso primario RDP = token OIDC utente loggato: verificato,
      `referente_bandi_sync` usa `ensure_fresh_access_token()`, non
      credenziali di servizio.
- [x] FR-024 verifica esplicita con utenza referente/RDP non admin: test
      manuale confermato dall'utente, Selezioni Online restituisce i bandi per
      cui l'utente risulta RDP. Resta da ripetere/registrare in collaudo anche
      con utenza segretario non admin.

## Prossimi passi suggeriti (ordine indicativo)

1. Verifiche finali di cutover Angular (visivo desktop/mobile e ruolo
   informatico in sede/reset password), da lasciare come punto da chiudere.
2. Eventuale spec futura per audit append-only e stati formali richiesta
   (`requested`/`in_progress`/`completed`/`verification_required`) se serve
   distinguere invio richiesta, compilazione e verifica oltre allo stato
   operativo minimo gia presente.
