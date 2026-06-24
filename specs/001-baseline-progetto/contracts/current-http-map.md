# Contract: Current HTTP Map

Questo contratto documenta le route correnti. Non e un contratto API JSON
normalizzato: il progetto restituisce pagine HTML, frammenti HTMX, JSON, redirect
e file.

## Globali

| Metodo | Path | Output prevalente | Scopo |
|---|---|---|---|
| GET | `/qr-code/<session_id>` | PNG | Genera QR per collegamento scanner |
| GET | `/qr-pdf/<session_id>` | PDF | Genera PDF con QR |
| GET | `/log` | text/plain | Tail log applicativo |

## Auth

| Metodo | Path | Output prevalente | Scopo |
|---|---|---|---|
| GET | `/login` | redirect | Avvia login OIDC |
| GET | `/oidc-callback` | redirect/error | Callback OIDC |
| GET | `/logout` | redirect | Logout locale e OIDC |
| GET | `/api/userinfo` | JSON | Dati utente corrente |

## User/sessione utente

| Metodo | Path | Output prevalente | Scopo |
|---|---|---|---|
| GET | `/me` | JSON/HTML | Profilo utente |
| GET | `/user` | HTML/JSON | Vista/endpoint utente |
| GET | `/user/session/status` | JSON | Stato token/sessione |
| POST | `/user/session/refresh` | JSON | Refresh token/sessione |
| GET | `/user/session/debug` | JSON | Debug sessione |

## Dashboard, commissioni e sessioni

| Metodo | Path | Output prevalente | Scopo |
|---|---|---|---|
| GET | `/` | HTML | Home/dashboard iniziale |
| GET | `/dashboard/segretario` | HTML | Dashboard segretario |
| GET | `/sessioni` | HTML | Vista sessioni |
| GET | `/sessioni/<commission_id>/frammento` | HTML fragment | Frammento sessioni |
| GET | `/api/commissioni` | JSON | Elenco commissioni |
| GET | `/sync-commissioni` | redirect/HTML/JSON | Sincronizza commissioni |
| GET | `/get-sessioni/<commission_id>` | HTML/JSON | Recupera sessioni |
| GET | `/sessione/<session_id>` | HTML | Dettaglio sessione |
| GET | `/session-check` | JSON/HTML | Controllo sessione/debug |

## Gestione concorso e azioni

| Metodo | Path | Output prevalente | Scopo |
|---|---|---|---|
| GET | `/gestione-concorso/<session_id>` | HTML | Pagina operativa sessione |
| GET | `/sessione/<session_id>/azioni` | HTML/JSON | Azioni disponibili |
| GET | `/sessione/<session_id>/azioni-frammento` | HTML fragment | Frammento azioni |
| GET | `/sessione/<session_id>/stato_corrente` | JSON/text | Stato corrente |
| GET | `/sessione/<session_id>/timeline-frammento` | HTML fragment | Timeline eventi |
| POST | `/sessione/<session_id>/salva_config` | redirect/HTML/JSON | Salva configurazione |
| POST | `/sessione/<session_id>/scarica_candidati` | redirect/HTML/JSON | Import candidati |
| POST | `/sessione/<session_id>/verifica_dispositivi` | JSON/HTML | Verifica dispositivi |
| POST | `/sessione/<session_id>/avvia_checkin` | JSON/HTML | Avvia check-in |
| POST | `/sessione/<session_id>/concludi_checkin` | JSON/HTML | Conclude check-in |
| POST | `/sessione/<session_id>/genera_liste` | file/JSON/HTML | Genera liste |
| POST | `/sessione/<session_id>/moodle-csv` | CSV/JSON/HTML | CSV Moodle |
| POST | `/sessione/<session_id>/invia-lista-esame` | JSON/HTML | Invio liste |
| POST | `/sessione/<session_id>/lista_presenti_moodle` | JSON/HTML | Conferma presenti Moodle |
| POST | `/sessione/<session_id>/avvia_esame` | JSON/HTML | Avvia fase esame |
| POST | `/sessione/<session_id>/inizia_esame` | JSON/HTML | Inizio esame |
| POST | `/sessione/<session_id>/concludi_esame` | JSON/HTML | Conclusione esame |

## Bando/configurazioni

| Metodo | Path | Output prevalente | Scopo |
|---|---|---|---|
| GET | `/bando/<commission_id>/dettaglio` | HTML | Dettaglio bando |
| GET/POST | `/bando/<commission_id>/configura` | HTML/redirect | Configurazione bando |
| POST | `/bando/<commission_id>/richiedi-configurazione` | JSON/HTML | Richiesta configurazione |

Note:

- `/bando/<commission_id>/configura` gestisce dati comuni al bando:
  referente, esperto remoto, segretario, durata prova e componenti commissione.
- `/sessione/<session_id>/salva_config` gestisce solo dati specifici della
  sessione: informatico in sede e data accesso piattaforma.
- il dettaglio bando e visibile in contesti admin/dev e usa dati OpenAPI quando
  disponibili.

## Candidati

| Metodo | Path | Output prevalente | Scopo |
|---|---|---|---|
| POST | `/verifica-candidato` | JSON | Verifica candidato da scanner |
| POST | `/checkin-candidato` | JSON | Conferma check-in |
| GET | `/sessione/<session_id>/tabella_candidati` | HTML fragment | Tabella candidati |
| POST | `/sessione/<session_id>/candidato/<candidato_uid>/toggle_checkin` | JSON/HTML | Toggle manuale check-in |
| GET | `/sessione/<session_id>/reset-password-frammento` | HTML fragment | Reset password fragment |
| POST | `/sessione/<session_id>/candidato/<candidato_uid>/reset_password` | JSON/HTML | Reset password |

## Dispositivi

| Metodo | Path | Output prevalente | Scopo |
|---|---|---|---|
| GET | `/device-link` | HTML | Pagina scanner |
| POST | `/api/dispositivo/registrazione` | JSON | Registra scanner |
| GET | `/dispositivi/<session_id>` | HTML | Vista dispositivi |
| GET | `/frammenti/dispositivi/<session_id>` | HTML fragment | Frammento dispositivi |
| POST | `/api/dispositivo/ping` | JSON | Heartbeat |
| POST | `/api/dispositivo/disconnetti` | JSON | Disconnessione |

## Admin e notifiche

| Metodo | Path | Output prevalente | Scopo |
|---|---|---|---|
| GET | `/admin/permessi` | HTML | Vista permessi |
| POST | `/admin/permessi` | redirect/HTML | Aggiunge ruolo |
| POST | `/admin/permessi/remove` | redirect/HTML | Rimuove ruolo |
| GET | `/admin/logs` | HTML | Log admin |
| GET | `/sessione/<session_id>/notifiche-frammento` | HTML fragment | Feed notifiche |
| POST | `/sessione/<session_id>/notifiche` | JSON/HTML | Crea notifica |

## Debug

| Metodo | Path | Output prevalente | Scopo |
|---|---|---|---|
| GET | `/debug/exam-moodle-sessions/<commission_id>` | JSON/HTML | Debug esami/Moodle |
| GET | `/debug/jconon/<commission_id>` | JSON/HTML | Debug referenti |
| GET | `/debug/sessioni` | JSON/HTML | Debug sessioni; blueprint non registrato nel bootstrap corrente |

## Implicazioni per API Future

Per Angular serve una feature successiva che definisca API JSON versionate,
autorizzazioni, error format e gestione CSRF. Questa baseline non normalizza i
contratti correnti.
