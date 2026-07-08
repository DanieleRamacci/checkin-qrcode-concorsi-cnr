# Data Model: Accesso referente/RDP alla configurazione bando

## Existing Domain Entities

- `commissions`: fonte locale dei bandi sincronizzati.
- `bando_config`: configurazione operativa del bando.
- `user_roles`: ruoli applicativi globali o tecnici.
- `sessioni`: sessioni collegate al bando.

## New / Updated Entities

### BandoConfigAssignment

Relazione interna tra bando e referente/RDP autorizzato tramite il nuovo flusso
dedicato.

Fields:

- `id`
- `commission_id`
- `assignee_email`
- `assignee_email_normalized`
- `assignee_name`
- `source`: `selezioni_online`, `manual`, `legacy`
- `assignee_role`: `rdp`, `referente`
- `source_role`: `rdp`, `referente`, `manual_override`
- `status`: `suggested`, `requested`, `in_progress`, `completed`,
  `verification_required`, `revoked`, `stale`
- `source_fetched_at`
- `requested_by`
- `requested_at`
- `completed_by`
- `completed_at`
- `verified_by`
- `verified_at`
- `exception_reason`
- `created_at`
- `updated_at`

Relationships:

- belongs to one `commissions.commission_id`.
- can mirror or supersede `bando_config.email_referente` for compatibility.
- can have many `BandoConfigAuditEvent`.

Validation:

- `commission_id` must reference an existing bando.
- `assignee_email_normalized` must be lowercase/trimmed and unique per active
  assignment on the same bando and role.
- manual assignments require `exception_reason`.
- revoked or stale assignments must not authorize new modifications.
- completed assignments require `completed_by` and `completed_at`.

State transitions:

```text
suggested -> requested -> in_progress -> completed -> verification_required
suggested -> requested -> revoked
completed -> stale
in_progress -> revoked
verification_required -> completed
```

### BandoConfigAuditEvent

Audit append-only delle azioni rilevanti sulla richiesta/configurazione bando.

Fields:

- `id`
- `commission_id`
- `assignment_id`
- `actor_email`
- `action`: `suggested`, `request_sent`, `access_granted`, `access_denied`,
  `config_saved`, `completed`, `verified`, `revoked`, `stale_detected`,
  `manual_override`
- `details`
- `created_at`

Relationships:

- belongs to one bando.
- optionally belongs to one assignment.

Validation:

- `actor_email` is required for user actions.
- `details` must not store secrets or access tokens.
- denied access events should include reason class, not sensitive data.

### ExternalIntegrationCredentialInventory

Documento o struttura di censimento per capire quali integrazioni usano token
utente, utenza applicativa o credenziali personali.

Fields:

- `integration_name`
- `flow_name`
- `credential_mode`: `current_user_token`, `service_account`,
  `personal_credentials`, `not_required`
- `used_in_test`
- `used_in_production`
- `owner`
- `replacement_required`
- `replacement_status`
- `notes`

Validation:

- any production-critical flow with `personal_credentials` is blocking.
- secrets are not stored in this inventory.

## API DTO Extensions

### UserContext

Add:

- `capabilities`: may include `configure_assigned_bandi` when the current user
  has active referente/RDP assignments.
- `assigned_bandi_count`

### ReferenteBandoSummary

- `commission_id`
- `title`
- `assignment_status`
- `assignee_email`
- `assignee_role`
- `requested_at`
- `completed_at`
- `last_updated_at`
- `capabilities`

### ReferenteBandoConfig

- `commission_id`
- `title`
- `assignment_status`
- `email_referente`
- `email_esperto_remoto`
- `email_segretario`
- `telefono_segretario`
- `durata_prova_minuti`
- `commissione_members`
- `rdp_members`
- `editable_fields`
- `audit_summary`

## Authorization Rules

- Admin users can read and manage all assignments.
- Commission owners keep current bando configuration permissions.
- Referente/RDP users can read assigned bando summaries and open only assigned
  bando configuration.
- Referente/RDP users can mutate bando configuration fields through the new
  assigned flow, but cannot change referente/RDP assignments without an
  additional permission.
- If institutional data indicates that an assigned RDP is no longer current for
  the bando, the old assignment cannot authorize new modifications. A completed
  bando configuration remains valid and is not blocked solely by that change.
- Segretario and commission-member users keep the existing commission/session
  authorization path and can modify bando configuration through that path.
- Direct URL access must perform the same assignment check as list/detail views.
- Email comparison uses normalized email from OIDC session and assignment table.

## Migration Notes

- Existing `bando_config.email_referente` should be backfilled into
  `BandoConfigAssignment` as `legacy` or `manual` source when no better source
  is available.
- Future sync from Selezioni Online/JConon should upsert assignments instead of
  replacing manual overrides blindly.
- `rdp_nomi` remains display-only until RDP email data is available.
