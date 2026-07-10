# Contract: UI accesso referente/RDP

> **Stato al 2026-07-08**: implementate le sezioni "Referente Bandi List" e,
> per le parti di sola lettura/scrittura via endpoint esistenti, "Referente
> Config Form". La capability gating descritta in "Navigation" non è ancora
> costruita. La scelta del referente da RDP disponibili è implementata come
> chiusura minima; la pagina Referenti mostra lo stato operativo minimo del
> bando. Permessi extra/eccezioni manuali motivate restano design target.
> "Informatico/Admin Config Form Extension" resta design target.

## Navigation

When `/api/v1/me` includes `configure_assigned_bandi`, the authenticated home
view shows an entry for the referente/RDP configuration area.

The entry is hidden when:

- the user is not authenticated;
- `assigned_bandi_count` is zero;
- the user has no active referente/RDP assignment.

**Stato reale**: `/me` non espone ancora `configure_assigned_bandi` né
`assigned_bandi_count` (vedi `api-contract.md`). La card "Referenti" in
`frontend/src/app/features/home/home.component.ts` è quindi visibile a
chiunque sia autenticato, senza gating — coerente con la nota già presente
sotto in "Referente Bandi List" sulla fase di validazione, ma non ancora
sostituita da un gating reale.

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
- expert assigned / not assigned
- required data complete / incomplete
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
- menu a tendina per scegliere il referente tra gli RDP disponibili quando
  Selezioni Online restituisce email utilizzabili
- editable fields allowed by backend `editable_fields`
- locked referente/RDP assignment controls
- completion action when required fields are valid

The form must not allow the assigned referente/RDP to change who is the
referente/RDP for the bando. It must not show global permission management.

**Stato reale aggiornato**:
`frontend/src/app/features/configurazioni/bando-config.component.ts` è lo
stesso form per segretario e referente/RDP (corretto, nessuna duplicazione).
Quando `GET /bandi/{id}/config` restituisce `rdp_options`, il campo
`email_referente` è una select e il backend accetta solo email presenti tra
gli RDP del bando. Se `rdp_options` è vuoto, resta il fallback manuale.
Permessi extra/eccezioni manuali motivate restano design target.

Segretario and commission-member users continue to use the existing
commission/session-authorized bando configuration path.

## Informatico/Admin Config Form Extension (non implementato)

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
