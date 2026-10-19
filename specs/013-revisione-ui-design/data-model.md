# Data Model: Revisione dell'interfaccia guidata dal "prossimo passo"

Feature: [spec.md](spec.md) · Decisioni: [research.md](research.md)

La feature non introduce entità persistenti nuove. Aggiunge due campi a
`candidati` e dati calcolati nelle risposte esistenti. Gli stati della sessione
e le transizioni restano quelli di `utils/stato.py`.

## Candidato (tabella `candidati`) — campi aggiunti

| Campo | Tipo | Valori | Regole |
| --- | --- | --- | --- |
| `checkin_at` | data e ora | null o istante della registrazione | Valorizzato quando la presenza passa a vero; azzerato quando viene annullata |
| `checkin_source` | testo | `scanner`, `tabella`, null | `scanner` se registrata dal dispositivo, `tabella` se dalla pagina sessione; azzerato all'annullamento |

- Aggiunti con `ADD COLUMN IF NOT EXISTS` in `init_db.py` e in
  `utils/schema.py::ensure_runtime_schema`.
- Le presenze registrate prima della modifica restano con entrambi i campi a
  null: l'interfaccia mostra "Presente" senza ora e origine.
- Registrare o annullare una presenza resta possibile solo nello stato
  `checkin_avviato` (regola esistente, invariata).

## Prossima sessione (calcolata, elenco concorsi)

Per ogni concorso dell'elenco del segretario e della vista admin:

| Campo | Origine |
| --- | --- |
| `next_session.session_id`, `name`, `date`, `time`, `location`, `state` | Sessione del concorso con `data_esame` uguale o successiva all'istante corrente, la più vicina |
| `next_session` = null | Nessuna sessione futura tra quelle scaricate |
| `session_count` (esistente) | Numero di sessioni del concorso presenti localmente; 0 = "sessioni non ancora scaricate" |

Regole: stessa visibilità dell'elenco concorsi attuale; nessun accesso a
Selezioni Online per calcolarla.

## Profili dell'utente (calcolati, `/api/v1/me`)

| Profilo | Condizione |
| --- | --- |
| `segretario` | Almeno una commissione locale con ruolo SEGRETARIO attivo per l'utente |
| `referente` | Almeno una riga in `bando_referenti` per l'utente |
| `sede` | Almeno una sessione con l'utente come informatico in sede |
| `esperto` | Ruolo applicativo esperto informatico |
| `admin` | Ruolo applicativo amministratore globale |

Regola di primo accesso: se l'utente non è né `segretario` né `referente` nei
dati locali, entrambi vengono proposti, perché i dati arrivano solo dopo la
prima sincronizzazione con Selezioni Online.

Con un solo profilo l'interfaccia porta direttamente alla home di quel
profilo; l'ultimo profilo scelto è una preferenza del singolo browser.

## Fase della sessione (presentazione)

Raggruppamento dei 12 stati in 4 fasi, con etichetta e prossimo passo per
profilo: tabella completa in
[contracts/ui-session-states.md](contracts/ui-session-states.md). È solo
presentazione: non è salvata e non cambia gli stati.

## Storico degli stati (calcolato, `/sessioni/<id>/state`)

| Campo | Origine |
| --- | --- |
| `state` | `session_state_log.stato` |
| `at` | `session_state_log.timestamp` |
| `actor_role` | ruolo di `session_state_log.utente` rispetto alla sessione, calcolato come per l'autore dei messaggi; `Sistema` se l'utente manca |

Nessuna tabella nuova; nessuna email esposta.

## Messaggio di sessione (tabella `session_notifications`) — uso

| Tipo | In chat | Nei non letti | Altrove |
| --- | --- | --- | --- |
| `message` | sì | sì | — |
| `reset` | sì, come testo leggibile | sì | card delle segnalazioni |
| `candidate_note` | sì, come testo leggibile | sì | colonna note |
| `state` | no | no | timeline, dallo storico stati |

Le risposte rapide sono testi predefiniti inviati come `message`.

## Stato del reset sulla riga del candidato (campi esistenti su `candidati`)

Nessun campo nuovo: si usano `reset_password_richiesto`, `_at`, `_by` e
`reset_password_effettuato`, `_at`, `_by`, già restituiti dall'elenco
candidati.

| Stato sulla riga | Condizione | Mostrato |
| --- | --- | --- |
| Reset richiesto | `reset_password_richiesto` vero | chi l'ha chiesto (ruolo) e a che ora; riga in cima con `app-row-attn` |
| Reset fatto | `reset_password_effettuato` vero | a che ora |
| Nessuno | entrambi falsi | azione "Serve reset password" (informatico) o "Registra un reset" (esperto) |

Regole:

- solo i candidati presenti (`checkin_effettuato` vero) compaiono nelle viste
  tecniche;
- ordinamento: richieste aperte per ora di richiesta, poi gli altri per
  cognome e nome;
- "Segna come fatto" e "Registra un reset" usano l'operazione esistente
  `complete`, che azzera la richiesta;
- ogni operazione `request` invia un'email all'esperto remoto della sessione
  (registrata nei log email); `cancel_request` non invia nulla.

## Sessione assegnata (calcolata, `/sessioni/assegnate`)

| Campo | Origine |
| --- | --- |
| `session_id`, `name`, `date`, `time`, `location`, `current_state` | `sessioni` |
| `commission_id`, `bando_title` | `sessioni` + `commissions` |
| `checked_in_count`, `candidate_count` | `candidati` della sessione |
| `open_reset_count` | candidati con `reset_password_richiesto` vero |

Regola di appartenenza: con `mode=sede` le sessioni in cui l'utente è
informatico in sede; con `mode=expert` quelle in cui è esperto remoto (con il
ruolo esperto informatico). Stessa regola delle autorizzazioni attuali.
