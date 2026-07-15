# Contract: API accesso referente/RDP configurazione bando

> **Stato al 2026-07-08**: la sezione "Referente/RDP Area" descrive gli
> endpoint realmente implementati (con lo shape di risposta reale, non quello
> aspirazionale). Le sezioni "Auth Context" (capability `configure_assigned_bandi`),
> "Informatico/Admin Assignment Management" e "Integration Credential
> Inventory" restano design target: nessuno di questi endpoint esiste oggi nel
> codice. Vedi `tasks.md` per cosa manca.

Base path: `/api/v1`

All mutating requests follow the existing CSRF rule: authenticated cookie
session plus `X-CSRF-Token`.

Errors follow the existing JSON shape:

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

## Auth Context

**Non implementato.** `GET /me` oggi non include `configure_assigned_bandi` né
`assigned_bandi_count`; la card "Referenti" in home è visibile a chiunque sia
autenticato, indipendentemente dal fatto che abbia bandi assegnati (vedi
`frontend/src/app/features/home/home.component.ts`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/me` | Include `configure_assigned_bandi` and `assigned_bandi_count` when applicable |

Expected extension (design target, non costruito):

```json
{
  "authenticated": true,
  "email": "referente@cnr.it",
  "capabilities": ["manage_owned_commissions", "configure_assigned_bandi"],
  "assigned_bandi_count": 2
}
```

## Referente/RDP Area

| Method | Path | Purpose |
|---|---|---|
| POST | `/referenti/bandi/sync` | Fetch and list bandi where the current user is RDP/referente |
| GET | `/bandi/{commission_id}/config` | Read config through the existing bando configuration endpoint |
| PUT | `/bandi/{commission_id}/config` | Save config through the existing bando configuration endpoint |

### POST `/referenti/bandi/sync`

Response (shape reale, `routes/api_v1/bandi.py::referente_bandi_sync` +
`utils/jconon_service.py::_serialize_referente_bando`):

```json
{
  "items": [
    {
      "commission_id": "string",
      "title": "string",
      "configured": false,
      "referente_email": "referente@cnr.it",
      "esperto_remoto_email": null,
      "config_status": "da_configurare",
      "expert_assigned": false,
      "required_data_complete": false,
      "session_count": 0,
      "last_sync": null,
      "capabilities": ["configure", "view"],
      "rdps": [],
      "commissioners": [],
      "rdp_names": ["Rita Verdi"]
    }
  ],
  "sync_error": null,
  "sync_source": "remote"
}
```

Non ci sono ancora `assignment_status`/`assignee_role`/`requested_at`: quei
campi restano design target (richiedono audit richiesta non ancora costruito).
Lo stato operativo minimo e invece presente tramite `config_status`,
`expert_assigned` e `required_data_complete`.

Authorization:

- Requires authenticated user.
- Calls Selezioni Online/JConon with the current user's OIDC token.
- Returns only bandi where current normalized email appears in `rdps`.
- Persists returned bandi in `bando_referenti` (upsert + delete delle righe
  non più restituite per l'utente = revoca), non più in `commissions`.
- Admin/commission-owner paths continue using existing bando endpoints.

### GET `/bandi/{commission_id}/config`

Response reale (`routes/api_v1/configurazioni.py::bando_config_get`): tutti i
campi di `bando_config` più `expert_options`, senza filtro per ruolo — non
esistono ancora `assignment_status`, `editable_fields`, `locked_fields` né
`audit_summary` (design target, non costruiti):

```json
{
  "commission_id": "string",
  "email_referente": "referente@cnr.it",
  "email_esperto_remoto": "esperto@cnr.it",
  "email_segretario": "segretario@cnr.it",
  "telefono_segretario": "string",
  "durata_prova_minuti": 60,
  "config_status": "dati_compilati",
  "expert_assigned": true,
  "required_data_complete": true,
  "commissione_members": [],
  "rdp_members": [
    {"nome": "Rita Verdi", "email": "rita.verdi@cnr.it"}
  ],
  "rdp_nomi": [],
  "commissione_nomi": [],
  "rdp_options": [
    {"nome": "Rita Verdi", "email": "rita.verdi@cnr.it"}
  ],
  "expert_options": ["esperto@cnr.it"]
}
```

Errors:

- `401 authentication_required`
- `403 forbidden` (utente non trovato né in `commissions` né, se
  `allow_referente`, in `bando_referenti`)
- `404 bando_not_found`

Non ancora implementati: `403 bando_assignment_required` /
`403 rdp_assignment_stale` come codici distinti (oggi entrambi i casi
rispondono `403 forbidden`, senza distinguere "mai autorizzato" da "RDP
revocato").

### PUT `/bandi/{commission_id}/config`

Request: qualunque sottoinsieme di `email_referente`, `email_esperto_remoto`,
`email_segretario`, `telefono_segretario`, `durata_prova_minuti`,
`commissione_members` (vedi `BANDO_FIELDS` in
`routes/api_v1/configurazioni.py`).

Behavior reale:

- Chi passa `commission_access_required(allow_referente=True)` (segretario
  proprietario o RDP tramite `bando_referenti`) può modificare i campi della
  configurazione.
- `email_referente`, quando valorizzato, deve essere una delle email presenti
  in `bando_config.rdp_members`/`rdp_options`; email arbitrarie vengono
  rifiutate con `422 validation_error`.
- Se la fonte istituzionale non fornisce RDP con email verificabili, il backend
  rifiuta l'impostazione di `email_referente` con `422 validation_error`.
  L'app non prevede fallback manuale o eccezioni locali: il dato va corretto
  su Selezioni Online.
- Ogni salvataggio ricalcola lo stato operativo minimo:
  `da_configurare`, `esperto_assegnato` o `dati_compilati`.
- Non esistono ancora audit event né stati formali di richiesta
  (`requested`/`in_progress`/`completed`/`verification_required`): il
  salvataggio aggiorna `bando_config.configured_at`/`configured_by`.

## Informatico/Admin Assignment Management (non implementato)

| Method | Path | Purpose |
|---|---|---|
| GET | `/bandi/{commission_id}/config/assignments` | List assignments and statuses |
| POST | `/bandi/{commission_id}/config/assignments/sync` | Upsert assignments from institutional source |
| POST | `/bandi/{commission_id}/config/assignments/{id}/request` | Send request email and mark requested |
| POST | `/bandi/{commission_id}/config/assignments/{id}/revoke` | Revoke assignment |

Authorization:

- Requires existing bando configuration permission for commission owner/admin.
- Assignment creation is driven by Selezioni Online/JConon sync; local manual
  creation is not allowed for referents absent from the institutional source.
- Request/revoke actions write audit events.
- Segretario and commission-member access to bando configuration remains on the
  existing commission/session authorization path, not on these assignment
  endpoints.
- A changed RDP from the institutional source must not block an already
  completed bando configuration, but old RDP assignments must not authorize new
  modifications.

## Integration Credential Inventory (non implementato)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/integrations/credentials` | Admin-only inventory of credential modes |

This endpoint must not return secrets. It can return status and whether a
replacement is required.

Minimum inventory rows for the current implementation:

| Integration flow | Credential mode |
|---|---|
| API v1 bando metadata sync | current user OIDC token, primary flow |
| Fallback RDP metadata sync | service account only if non-admin validation fails |
| Legacy call detail metadata | current user OIDC token when provided |
| Legacy RDP group members through rest proxy | env credential or technical bearer, temporary for test only |
