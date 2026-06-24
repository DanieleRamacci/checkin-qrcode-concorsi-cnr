# Data Model: Baseline Ufficiale Progetto Esistente

Fonte: `init_db.py` nel working tree al 2026-06-24.

## Entita e Tabelle

### Commissione (`commissions`)

Rappresenta una commissione sincronizzata e associata a un utente.

Campi principali:

- `commission_id`
- `titolo`
- `user_email`
- `data_sync`

Relazioni:

- una commissione ha piu sessioni tramite `(commission_id, user_email)`

### Ruolo Utente (`user_roles`)

Autorizzazioni locali applicative.

Campi principali:

- `user_email`
- `role`
- `created_by`
- `created_at`

Regole:

- chiave primaria `(user_email, role)`
- bootstrap tramite `BOOTSTRAP_ADMIN_EMAILS`

### Sessione (`sessioni`)

Unita operativa del check-in.

Campi principali:

- `session_id`
- `commission_id`
- `user_email`
- `session_string`
- `nome`
- `giorno`
- `ora`
- `luogo`
- `data_esame`
- `attiva`
- `candidati_importati`
- `sync_user_email`
- `data_sync`
- `stato_corrente`

Relazioni:

- riferisce `commissions`
- contiene candidati, dispositivi, notifiche, stato e liste

Stati noti:

1. `iniziale`
2. `configurata`
3. `candidati_scaricati`
4. `dispositivi_connessi`
5. `checkin_avviato`
6. `checkin_concluso`
7. `liste_generate`
8. `liste_inviate`
9. `lista_presenti_aggiornata_su_moodle`
10. `avvia_esame`
11. `esame_in_corso`
12. `esame_concluso`

### Configurazione Bando (`bando_config`)

Dati comuni a tutte le sessioni di un bando/commissione. Nel working tree
corrente questa tabella sostituisce i campi comuni precedentemente gestiti a
livello di `sessione_config`.

Campi principali:

- `commission_id`
- `email_referente`
- `email_esperto_remoto`
- `email_segretario`
- `telefono_segretario`
- `durata_prova_minuti`
- `commissione_members`
- `rdp_nomi`
- `commissione_nomi`
- `fetched_at`
- `configured_at`
- `configured_by`

Regole:

- `commissione_members`, `rdp_nomi` e `commissione_nomi` sono JSON serializzato
  in campi `TEXT`
- i dati possono arrivare da JConon/OpenAPI o da inserimento manuale
- `configured_at` indica che il bando e stato configurato manualmente

### Configurazione Sessione (`sessione_config`)

Dati specifici della singola sessione.

Campi principali:

- `session_id`
- `nome_informatico_sede`
- `email_informatico_sede`
- `telefono_informatico_sede`
- `data_accesso_piattaforma`

Relazioni:

- riferisce `sessioni`

Regole:

- contiene solo dati variabili per sessione
- non contiene piu esperto remoto, segretario, durata prova o referente bando

### Candidato (`candidati`)

Candidato importato e gestito nel check-in.

Campi principali:

- `uid`
- `session_id`
- `first_name`
- `last_name`
- `birthdate`
- `fiscal_code`
- `document_type`
- `document_number`
- `document_date`
- `document_issued_by`
- `checkin_effettuato`
- `documento_scaduto`
- `reset_password_richiesto`
- `reset_password_richiesto_at`
- `reset_password_richiesto_by`
- `reset_password_effettuato`
- `reset_password_effettuato_at`
- `reset_password_effettuato_by`

Regole:

- chiave primaria `(uid, session_id)`
- riferisce `sessioni`

### Dispositivo (`dispositivi`)

Scanner registrato per una sessione.

Campi principali:

- `id`
- `ip_address`
- `user_agent`
- `session_id`
- `nome_dispositivo`
- `device_token`
- `last_seen`
- `disconnected_at`
- `timestamp`

Regole:

- indice unique su `device_token`

### Notifica Sessione (`session_notifications`)

Messaggio o evento associato a una sessione.

Campi principali:

- `id`
- `session_id`
- `author_email`
- `type`
- `payload`
- `created_at`

Indice:

- `(session_id, created_at DESC)`

### Log Stato Sessione (`session_state_log`)

Audit dei cambi stato.

Campi principali:

- `id`
- `session_id`
- `stato`
- `timestamp`
- `utente`

### Lista Generata (`liste_generate`)

Output generato dopo check-in.

Campi principali:

- `id`
- `session_id`
- `file_xlsx`
- `file_csv_moodle`
- `num_presenti`
- `generato_da`
- `timestamp_creazione`

### Prova (`prove`)

Modulo separato per gestione prove/esami Moodle.

Campi principali:

- `prove_id`
- `numero_bando`
- `titolo`
- `data_prova`
- `ora_prova`
- `luogo`
- `tipologia_prova_esame`
- `esperto_email`
- dati referente, segretario e informatico sede
- dati partecipanti e presenti
- date operative del workflow prova
- `busta_estratta_codice`
- `orario_inizio_prova`
- `durata_minuti`
- `orario_fine_previsto`
- `stato_corrente`
- audit `created_*` e `updated_*`

Indici:

- `(data_prova, ora_prova)`
- `esperto_email`
- `stato_corrente`

### Tabelle Prove Correlate

- `prove_documents`: documenti caricati per prova
- `prove_state_log`: storico stati prova
- `prove_external_tokens`: token esterni con scadenza e scope
- `prove_support_staff`: personale di supporto
- `prove_emails_log`: storico email inviate
- `prove_global_templates`: template globali

### Errori Tecnici (`system_error_log`)

Log errori cross-modulo.

Campi principali:

- `id`
- `source`
- `actor_email`
- `error_type`
- `raw_error`
- `context_json`
- `created_at`

## Note di Qualita Dati

- molte date nel modulo check-in sono salvate come `TEXT`
- alcuni array/JSON sono salvati come `TEXT`
- `init_db.py` combina creazione schema e migrazioni additive
- in `APP_ENV=dev` alcune tabelle vengono eliminate e ricreate
- una futura feature dovrebbe valutare migrazioni versionate
