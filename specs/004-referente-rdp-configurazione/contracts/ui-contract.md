# Contract: UI accesso referente/RDP

## Navigation

When `/api/v1/me` includes `configure_assigned_bandi`, the authenticated home
view shows an entry for the referente/RDP configuration area.

The entry is hidden when:

- the user is not authenticated;
- `assigned_bandi_count` is zero;
- the user has no active referente/RDP assignment.

## Referente Bandi List

Route concept: area "Referenti" at `/referenti/bandi`.

Required states:

- loading
- empty: "Non risultano bandi assegnati alla tua utenza."
- list with status badges
- error with retry

Each row/card shows:

- bando title
- assignment status
- requested date, when available
- completed date, when available
- primary action: open configuration

The list must not expose bandi not assigned to the user.

For the validation phase, the home card may be visible even before backend
capability gating is finalized, so an RDP can test whether Selezioni Online
returns the expected bandi.

## Referente Config Form

Required states:

- loading
- access denied
- validation errors
- saved
- completed

The form shows:

- bando title
- referente/RDP identity currently authorized
- visible commission/RDP context needed to verify the bando
- editable fields allowed by backend `editable_fields`
- locked referente/RDP assignment controls
- completion action when required fields are valid

The form must not allow the assigned referente/RDP to change who is the
referente/RDP for the bando. It must not show global permission management.

Segretario and commission-member users continue to use the existing
commission/session-authorized bando configuration path.

## Informatico/Admin Config Form Extension

The existing bando configuration page gains a section for referente/RDP
assignment:

- suggested referenti from institutional data;
- current assignments and status;
- manual override with mandatory reason;
- send request;
- revoke assignment;
- audit/status summary.

## UX Rules

- Do not imply that the referente is a commission member.
- Show manual assignments as exceptions.
- Show institutional source sync failures without granting automatic access.
- Direct links must land on the same authorized UI states as navigation links.
