# Contract: API accesso referente/RDP configurazione bando

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

| Method | Path | Purpose |
|---|---|---|
| GET | `/me` | Include `configure_assigned_bandi` and `assigned_bandi_count` when applicable |

Expected extension:

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

Response:

```json
{
  "items": [
    {
      "commission_id": "string",
      "title": "string",
      "assignment_status": "requested",
      "assignee_email": "referente@cnr.it",
      "assignee_role": "rdp",
      "requested_at": "2026-07-08T10:00:00Z",
      "completed_at": null,
      "last_updated_at": "2026-07-08T10:00:00Z",
      "capabilities": ["view", "configure"]
    }
  ]
}
```

Authorization:

- Requires authenticated user.
- Calls Selezioni Online/JConon with the current user's OIDC token.
- Returns only bandi where current normalized email appears in `rdps`.
- Persists returned bandi locally so existing Configura Bando authorization can
  be reused.
- Admin/commission-owner paths should continue using existing bando endpoints.

### GET `/bandi/{commission_id}/config`

Response includes only data needed by the assigned referente/RDP:

```json
{
  "commission_id": "string",
  "title": "string",
  "assignment_status": "in_progress",
  "email_referente": "referente@cnr.it",
  "email_esperto_remoto": "esperto@cnr.it",
  "email_segretario": "segretario@cnr.it",
  "telefono_segretario": "string",
  "durata_prova_minuti": 60,
  "commissione_members": [],
  "rdp_members": [],
  "editable_fields": [
    "email_esperto_remoto",
    "email_segretario",
    "telefono_segretario",
    "durata_prova_minuti"
  ],
  "locked_fields": [
    "referente_assignments"
  ],
  "audit_summary": {
    "requested_at": "2026-07-08T10:00:00Z",
    "requested_by": "informatico@cnr.it",
    "completed_at": null
  }
}
```

Errors:

- `401 authentication_required`
- `403 bando_assignment_required`
- `403 rdp_assignment_stale`
- `404 bando_not_found`

### PUT `/bandi/{commission_id}/config`

Request:

```json
{
  "email_esperto_remoto": "esperto@cnr.it",
  "email_segretario": "segretario@cnr.it",
  "telefono_segretario": "string",
  "durata_prova_minuti": 60
}
```

Behavior:

- Ignores or rejects fields outside `editable_fields`.
- Always rejects attempts to change referente/RDP assignments from this area.
- Rejects modifications when the current user matches an assignment that is no
  longer valid because institutional data changed.
- Sets assignment status to `in_progress` if it was `requested`.
- Writes audit event `config_saved`.

## Informatico/Admin Assignment Management

| Method | Path | Purpose |
|---|---|---|
| GET | `/bandi/{commission_id}/config/assignments` | List assignments and statuses |
| POST | `/bandi/{commission_id}/config/assignments/sync` | Upsert assignments from institutional source |
| POST | `/bandi/{commission_id}/config/assignments` | Add manual assignment with reason |
| POST | `/bandi/{commission_id}/config/assignments/{id}/request` | Send request email and mark requested |
| POST | `/bandi/{commission_id}/config/assignments/{id}/revoke` | Revoke assignment |

Authorization:

- Requires existing bando configuration permission for commission owner/admin.
- Manual assignment requires reason.
- Request/revoke actions write audit events.
- Segretario and commission-member access to bando configuration remains on the
  existing commission/session authorization path, not on these assignment
  endpoints.
- A changed RDP from the institutional source must not block an already
  completed bando configuration, but old RDP assignments must not authorize new
  modifications.

## Integration Credential Inventory

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
