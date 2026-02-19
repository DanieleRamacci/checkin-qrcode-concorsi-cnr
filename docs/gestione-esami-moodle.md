# Gestione Esami Moodle (Modulo Prove)

Questa documentazione descrive **solo** il modulo operativo per la gestione prove/esami (integrazione Moodle/Esami), separato dal check-in candidati.

## 1. Scopo del modulo
Il modulo consente all'esperto informatico di:
- gestire anagrafica e pianificazione della prova
- governare un workflow a stati obbligato (step-by-step)
- gestire documenti di prova (inviati/ricevuti)
- gestire buste A/B/C
- inviare comunicazioni email operative
- usare un deposito globale di template buste riutilizzabili

## 2. Autorizzazioni
Tutte le route del modulo sono protette con login e ruoli locali (`user_roles`):
- ruoli ammessi: `esperto_informatico`, `admin_globale`
- `admin_globale`: vede e modifica tutto
- `esperto_informatico`: può vedere tutte le prove, ma può modificare solo le prove assegnate a lui (`prove.esperto_email`)

## 3. Entry point / file principali
- Blueprint: `routes/prove.py`
- FSM stati: `utils/prove_stato.py`
- Invio email modulo: `utils/prove_mail.py`
- Schema DB: `init_db.py`
- UI:
  - `templates/prove/lista.html`
  - `templates/prove/dettaglio.html`
  - `templates/prove/nuova.html`
  - `templates/prove/compila_token.html`

## 4. Modello dati (solo modulo prove)

### 4.1 Tabella `prove`
Dati principali del concorso/prova:
- identificativi/agenda: `prove_id`, `numero_bando`, `titolo`, `data_prova`, `ora_prova`, `luogo`
- tipologia prova: `tipologia_prova_esame` (`risposta_multipla` / `risposta_aperta`), `note_tipologia_prova`
- contatti: `esperto_email`, `referente_*`, `segretario_*`
- operativi: `num_partecipanti`, `num_presenti`, `durata_minuti`, `orario_inizio_prova`, `orario_fine_previsto`
- stato: `stato_corrente`
- date milestone workflow: `data_convocazioni_inviate`, `data_lista_candidati_acquisita`, `data_template_moodle_inviati`, `data_excel_presenti_inviato`, `data_lista_presenti_ricevuta`, `data_presenti_attivati_moodle`, `data_valutazione_prova`
- busta estratta: `busta_estratta_codice` (`A|B|C`)

### 4.2 Tabella `prove_documents`
Documenti specifici della singola prova:
- `doc_type`, `filename`, `version`, `note`, `uploaded_by`, `created_at`
- versione incrementale per `prove_id + doc_type`

### 4.3 Tabella `prove_global_templates`
Deposito globale template condivisi:
- `doc_type`, `template_categoria`, `filename`, `version`, `note`, `uploaded_by`
- nel codice attuale l'upload è limitato a:
  - `template_busta_a_vuota`
  - `template_busta_b_vuota`
  - `template_busta_c_vuota`
- categorie ammesse da UI/backend:
  - `risposta_multipla`
  - `risposta_aperta`

### 4.4 Tabella `prove_state_log`
Storico transizioni di stato:
- `from_state`, `to_state`, `timestamp`, `utente`, `payload_json`

### 4.5 Tabella `prove_emails_log`
Log invii email:
- destinatari `to/cc`, allegati, esito SMTP, autore invio

### 4.6 Tabella `prove_external_tokens`
Token esterni (compilazione senza login):
- scope, scadenza, metadati creazione

### 4.7 Tabella `prove_support_staff`
Unità supporto informatico multipla:
- più righe per prova (`prove_id`, `nome`, `email`)

## 5. Storage file
- cartella base: `FILES_BASE_DIR`
- documenti prova: `FILES_BASE_DIR/prove/<prove_id>/`
- template globali: `FILES_BASE_DIR/prove/_global_templates/`

Rinomina download documenti prova:
- formato: `<numero_bando> - <doc_type> - <gg mese anno>.<ext>`

## 6. Workflow stati (FSM)
Definito in `utils/prove_stato.py`.

Ordine stati:
1. `bozza`
2. `dettagli_completati`
3. `convocazioni_inviate`
4. `lista_candidati_da_acquisire`
5. `lista_candidati_acquisita`
6. `template_moodle_da_inviare`
7. `template_moodle_inviati`
8. `modelli_buste_inviati_al_segretario`
9. `excel_presenti_generato`
10. `excel_presenti_inviato`
11. `lista_presenti_ricevuta`
12. `presenti_attivati_su_moodle`
13. `buste_con_domande_ricevute`
14. `domande_caricate`
15. `estrazione_busta`
16. `busta_estratta`
17. `prova_avviata`
18. `prova_conclusa`
19. `inserire_data_valutazione_prova`
20. `prova_valutata`

Regole principali:
- transizioni solo al passo successivo
- admin può forzare transizioni
- validazioni bloccanti su documenti/campi richiesti
- ogni transizione aggiorna `prove.stato_corrente` e scrive su `prove_state_log`

Validazioni chiave implementate:
- `dettagli_completati`: richiede dati base e contatti
- `template_moodle_inviati`: richiede `lista_convocati_moodle`
- `modelli_buste_inviati_al_segretario`: richiede almeno un template busta A/B/C
- `excel_presenti_inviato`: richiede `excel_presenze_template` o `lista_presenti_excel`
- `lista_presenti_ricevuta` / `presenti_attivati_su_moodle`: richiedono `lista_presenti_excel`
- `presenti_attivati_su_moodle`: richiede `num_presenti`
- `buste_con_domande_ricevute`: richiede `busta_a_ricevuta`, `busta_b_ricevuta`, `busta_c_ricevuta`
- `busta_estratta`: richiede scelta `A/B/C`
- `prova_avviata`: consentita solo dopo `busta_estratta`
- `inserire_data_valutazione_prova`: richiede data
- `prova_valutata`: richiede `data_valutazione_prova`

## 7. Tipi documento operativi

Documenti prova (non globali) usati dal workflow:
- `lista_convocati_moodle`
- `excel_presenze_template`
- `lista_presenti_excel`
- `template_busta_a_vuota`
- `template_busta_b_vuota`
- `template_busta_c_vuota`
- `busta_a_ricevuta`
- `busta_b_ricevuta`
- `busta_c_ricevuta`
- `template_buste_esame` (supportato in alcuni flussi legacy)

Nota importante:
- il deposito globale **non** accetta `lista_convocati_moodle` e `excel_presenze_template`.
- questi restano documenti specifici del singolo concorso.

## 8. Deposito template globale
Disponibile in `Tutte le prove`.

Funzioni:
- upload template buste A/B/C con categoria (`risposta_multipla`/`risposta_aperta`)
- download template globale
- import template globale nella prova specifica (se utente autorizzato)

L'import crea una nuova versione nella `prove_documents` del concorso.

## 9. Informatici di supporto
Nella sezione `Dati` della scheda prova:
- tabella con righe multiple nome/email
- pulsante “Aggiungi unità”
- salvataggio insieme al form dati

Persistenza:
- tabella `prove_support_staff`

## 10. Email

### 10.1 Invii automatici su transizione stato
- `template_moodle_inviati` -> invio lista candidati a segreteria
- `modelli_buste_inviati_al_segretario` -> invio modelli buste
- `excel_presenti_inviato` -> invio excel presenti

### 10.2 Invio manuale per stato
Nella sezione `Stati e azioni`:
- invio rapido da blocco collassato
- invio personalizzato da pannello espandibile
- possibilità di scegliere allegati consigliati
- utente che invia inserito automaticamente in CC

Tutti gli invii vengono loggati in `prove_emails_log`.

## 11. Endpoints principali (modulo)

Liste e schede:
- `GET /prove/tutti`
- `GET /prove/miei`
- `GET /prove/nuova`
- `POST /prove/nuova`
- `GET /prove/<prove_id>`
- `POST /prove/<prove_id>/update`

Documenti prova:
- `POST /prove/<prove_id>/documenti/upload`
- `POST /prove/<prove_id>/documenti/genera-excel-presenze`
- `GET /prove/<prove_id>/documenti/<doc_id>/download`
- `POST /prove/<prove_id>/documenti/<doc_id>/delete`

Workflow:
- `POST /prove/<prove_id>/azione/<action>`

Template globali:
- `POST /prove/template-globali/upload`
- `GET /prove/template-globali/<template_id>/download`
- `POST /prove/<prove_id>/template-globali/<template_id>/import`

Email e token esterni:
- `POST /prove/<prove_id>/invia-email-stato`
- `POST /prove/<prove_id>/invio-link-compilazione`
- `GET/POST /prove/compila/<token>`

## 12. Runbook operativo sintetico
1. Creare prova (`/prove/nuova`)
2. Compilare dati completi e passare a `dettagli_completati`
3. Caricare/generare documenti richiesti step-by-step
4. Avanzare con pulsante stato successivo (no salti)
5. Gestire buste (template inviati, buste ricevute, estrazione)
6. Avviare/concludere prova, inserire data valutazione, chiudere su `prova_valutata`

## 13. Limitazioni e note tecniche
- La tabella `prove_global_templates` ha default DB `template_categoria='generico'` per retrocompatibilità schema, ma UI/backend consentono upload solo `risposta_multipla`/`risposta_aperta`.
- `template_buste_esame` è ancora presente in alcune logiche/label legacy; i template globali ufficiali sono A/B/C distinti.
- Gli invii email dipendono dalla configurazione SMTP dell'ambiente (`.env`). In locale è possibile ricevere rifiuti relay/policy.
