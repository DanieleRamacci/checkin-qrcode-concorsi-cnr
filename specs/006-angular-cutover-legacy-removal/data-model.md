# Data Model: Cutover Angular e rimozione flusso legacy

La feature non introduce nuove tabelle obbligatorie. Le entita sono operative e
documentali.

## Legacy Entry Point

- `path`: URL storico o pattern legacy.
- `source`: route Flask, template, proxy o link esterno che puo raggiungerlo.
- `decision`: `redirect`, `block`, `technical`, `admin_only`, `development_only`,
  `remove`.
- `angular_destination`: rotta Angular equivalente, se esiste.
- `context_required`: parametri necessari per costruire la destinazione.
- `status`: `pending`, `implemented`, `validated`, `removed`.
- `evidence`: test automatico, smoke o prova manuale collegata.

## Cutover Decision

- `entry_point`: riferimento al Legacy Entry Point.
- `owner`: area responsabile della verifica.
- `reason`: motivo della decisione.
- `removal_condition`: condizione che consente di eliminare il fallback.
- `security_notes`: vincoli auth/ruolo/proxy.

## Legacy Marker

- `label`: testo visibile, attualmente `LEGACY HTML`.
- `placement`: posizione sopra il contenuto legacy.
- `scope`: pagine HTML legacy renderizzabili.
- `excluded_from`: SPA Angular e endpoint tecnici non visuali.

## Validation Evidence

- `flow`: segretario, referente, informatico in sede, esperto, scanner, admin.
- `environment`: locale, Coolify test, produzione.
- `viewport`: desktop, mobile o non applicabile.
- `result`: pass/fail/bloccato.
- `notes`: evidenza operativa, log o screenshot se disponibile.
- `date`: data della verifica.
