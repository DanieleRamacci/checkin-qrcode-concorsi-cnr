# Data Model: Migrazione API-first e Angular

La migrazione non cambia il modello dati di dominio nella prima fase. Introduce
rappresentazioni API e DTO sopra il modello esistente.

## Existing Domain Entities

- `commissions`
- `bando_config`
- `sessioni`
- `sessione_config`
- `candidati`
- `dispositivi`
- `liste_generate`
- `session_notifications`
- `session_state_log`
- `user_roles`

## API DTOs

### UserContext

- `email`
- `display_name`
- `roles`
- `capabilities`
- `authenticated`
- `csrf_token`

### BandoSummary

- `commission_id`
- `title`
- `configured`
- `referente_email`
- `esperto_remoto_email`
- `session_count`
- `last_sync`
- `capabilities`

### BandoConfig

- `commission_id`
- `email_referente`
- `email_esperto_remoto`
- `email_segretario`
- `telefono_segretario`
- `durata_prova_minuti`
- `commissione_members`
- `rdp_nomi`
- `commissione_nomi`
- `configured_at`
- `configured_by`

### SessionSummary

- `session_id`
- `commission_id`
- `name`
- `date`
- `time`
- `location`
- `current_state`
- `candidate_count`
- `checked_in_count`
- `device_count`
- `capabilities`

### SessionConfig

- `session_id`
- `nome_informatico_sede`
- `email_informatico_sede`
- `telefono_informatico_sede`
- `data_accesso_piattaforma`

### CandidateSummary

- `uid`
- `first_name`
- `last_name`
- `document_number`
- `document_expired`
- `checkin_effettuato`
- `reset_password_richiesto`
- `reset_password_effettuato`

### DeviceSummary

- `id`
- `session_id`
- `operator_email`
- `user_agent`
- `ip_address`
- `last_seen`
- `disconnected_at`
- `status`

Rule: API responses MUST NOT expose `device_token`.

### WorkflowAction

- `action`
- `label`
- `enabled`
- `disabled_reason`
- `target_state`
- `requires_confirmation`

### ApiError

- `code`
- `message`
- `details`
- `request_id`

## Validation Rules

- gli identificatori `commission_id`, `session_id` e `uid` sono stringhe non
  vuote e vengono sempre risolti nel backend prima di una mutazione.
- email e numeri di telefono vengono normalizzati con trim; le email, quando
  valorizzate, devono avere formato valido e lunghezza massima 254 caratteri.
- date e timestamp API usano ISO 8601; i timestamp sono UTC.
- liste, ruoli e capability sono array JSON, mai stringhe delimitate.
- i campi booleani sono booleani JSON e non valori testuali.
- `session_id` operations require ownership, admin role, or explicit role-based
  access to configured bando/session.
- `commission_id` operations require ownership, admin role, or assigned expert
  capability where applicable.
- workflow transitions are validated only in backend services.
- device tokens are never returned after initial registration.
- input sconosciuti non vengono persistiti; errori di validazione usano
  `ApiError.details` per associare campo e motivo.
