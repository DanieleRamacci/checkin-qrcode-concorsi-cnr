# Contract: Legacy UI and Flow Parity Matrix

**Baseline**: `templates/`, relativi frammenti, route Flask e JavaScript legacy.

**Audit date**: 2026-07-03

Una riga puo passare a `migrato` soltanto dopo confronto visivo desktop/mobile,
verifica degli stati condizionali e scenario operativo end-to-end. `Parziale`
significa che esiste una controparte Angular, ma manca almeno un elemento
grafico, funzionale o di validazione.

| Area legacy | Template/frammenti di riferimento | Flusso e ancore da preservare | Controparte Angular/API | Stato audit e gap |
|---|---|---|---|---|
| Layout comune | `header.html`, `footer.html` | Slim header, titolo servizio, accesso/area riservata e footer coerente | `layout/app-layout.component.ts`, `/me` | **Parziale**: Design Angular Kit presente, ma header, navigazione e footer sono stati ridisegnati e non ancora confrontati con la baseline |
| Selezione profilo | `home.html` | Titolo, card Segretario, profilo Esperto condizionale, menu admin | `home.component.ts`, `/me` | **Parziale**: card principali presenti; menu admin e collegamenti alle relative viste Angular mancanti |
| Dashboard bandi | `dashboard.html` | Developer banner, errore/fallback sync, filtro, tabella e accesso sessioni, proposta scanner su mobile | `bandi.component.ts`, `/bandi` | **Parziale**: tabella e filtro presenti; mancano banner dev, dettaglio dello stato sync e accesso rapido scanner mobile |
| Elenco sessioni | `sessioni.html`, `frammenti/sessioni_tabella.html` | Titolo concorso, dettaglio bando, avviso configurazione, sync/refresh con spinner e retry, tabella | `sessioni.component.ts`, `/bandi/{id}/sessioni` | **Parziale**: tabella e refresh presenti; titolo dinamico, stato configurazione, dettaglio bando e retry/sync equivalenti mancanti |
| Dettaglio bando | `bando_dettaglio.html` | Tabelle RDP e componenti commissione, ruoli/badge, passaggio a configurazione | `bando-detail.component.ts`, `POST /bandi/{id}/sync-meta` | **Parziale in validazione**: tabelle RDP/commissari e sync da Selezioni Online implementate e funzionanti (verificato 2026-07-03); resta il confronto visivo T108 |
| Configurazione bando | `bando_config.html` | Card referente, invio richiesta, selezione esperto, dati segretario e durata, testi e validazioni | `bando-config.component.ts`, `/bandi/{id}/config` | **Parziale**: form a card, invio richiesta e selezione esperto presenti; **gap confermato (2026-07-03, T119-T120)**: a differenza del legacy, non richiama `sync-meta` all'apertura pagina, quindi componenti commissione e referente/segretario suggeriti non risultano precompilati per bandi non ancora sincronizzati |
| Shell gestione sessione | `gestione-concorso.html`, `sidebar.html` | Background e colonne 2/10, riepilogo sessione e riferimenti operativi, azioni, timeline, notifiche, candidati, overlay | `gestione-sessione.component.ts` e componenti figli | **Parziale**: struttura principale ripresa; riferimenti operativi sidebar, alcune modalità/stati, refresh e validazione visiva mancano |
| Azioni e workflow | `azioni.html`, `frammenti/azioni.html`, `frammenti/timeline.html` | Card condizionali per tutti gli stati e le modalità `sede`/`esperto`, overlay, download/invio, nove step timeline | `azioni.component.ts`, `exam-timeline.component.ts`, API workflow/liste/config | **Parziale in validazione**: E2E segretario→esperto verificato manualmente (2026-07-03) da `iniziale` fino a `esame_in_corso`, incluso il fix della transizione `dispositivi_connessi` (T112-T116), del timeout Nginx su "Genera Liste" (T117-T118) e dell'invio lista (avanza stato anche con SMTP non raggiungibile, come da legacy). Confermato che l'assenza di card segretario allo stato `avvia_esame` e' comportamento legacy identico (`frammenti/azioni.html` non ha alcuna condizione `not is_esperto` per quello stato), non un gap di migrazione. Restano confronto visivo T108 e validazione E2E per il ruolo sede |
| Candidati | `frammenti/tabella_candidati.html` | Aggiorna, ricerca, ordinamento, filtri, righe rosso/verde, validità, QR candidato, toggle | `candidati.component.ts`, API candidati | **Parziale in validazione**: tabella, filtri, toggle, QR candidato e stati loading/errore implementati; resta confronto visivo/E2E |
| Reset password | `frammenti/reset_password_list.html` | Viste sede/esperto, ricerca, filtri, richiesto/eseguito, aggiornamento | `reset-password.component.ts`, API candidati/reset | **Parziale in validazione**: viste sede/esperto, filtri e mutazioni reversibili implementati; resta confronto E2E per ruolo |
| Dispositivi | `dispositivi.html`, `frammenti/dispositivi_tabella.html` | Sidebar, QR e istruzioni, URL, polling 2 s, nome dispositivo, stato, ping, browser e IP | `dispositivi.component.ts`, API devices | **Parziale in validazione**: riferimenti sidebar, campi legacy, nome dispositivo, polling e ciclo disconnect implementati; resta confronto desktop/mobile |
| Scanner | `scanner.html` | Scansione QR sessione e candidato con fotocamera, registrazione, heartbeat, stato, candidato, documento scaduto, conferma/reset/disconnect | `scanner.component.ts`, API scanner/devices | **Parziale in validazione**: flusso fotocamera, associazione/disassociazione, candidato, documento, conferma, reset, heartbeat e disconnect implementati; associazione dispositivo → `dispositivi_connessi` verificata E2E (2026-07-03, T112-T116) con scansione reale del QR; resta il confronto mobile e T108 |
| Notifiche/chat | `frammenti/notifiche.html` | Feed, tipi messaggio, polling 10 s e invio | `notifiche.component.ts`, API notifications | **Parziale in validazione**: lettura, invio, errori e polling automatico a 10 s implementati; resta il confronto E2E |
| Liste | sezione liste in `frammenti/azioni.html` | Generazione, conteggi, download XLSX/CSV, invio, avvisi e modalità esperto | `azioni.component.ts`, API lists | **Parziale in validazione**: generazione verificata E2E (2026-07-03, T117-T118) dopo il fix del timeout Nginx (`frontend/nginx.conf`, allineato ai 120s Gunicorn per la chiamata JConon di `genera_moodle_csv_su_disco`); resta la validazione E2E di invio/destinatari e flusso esperto |
| Permessi admin | `admin_permessi.html` | Elenco ruoli, aggiunta/rimozione, metadati e accesso solo admin | `admin-roles.component.ts`, guard admin e API ruoli | **Parziale in validazione**: gestione esperti/amministratori e protezione client/server implementate; resta confronto visivo/E2E |
| Log admin | `admin_logs.html` | Limite record e tabelle errori/email/stati sessione/prova | `admin-logs.component.ts`, guard admin e API log completa | **Parziale in validazione**: limite e quattro tabelle legacy implementati; resta confronto visivo/E2E |
| Debug | `debug_sessioni.html` e route debug | Solo sviluppo/admin, nessuna esposizione in produzione | Nessuna vista Angular richiesta | **Fallback sviluppo**, fuori dal cutover utente |
| Frammenti di supporto | `error_fragment.html` | Errore testuale restituito alle operazioni HTMX | Errori JSON uniformi e messaggi nei componenti Angular | **Parziale**: contratto JSON presente; ogni componente deve mostrare il messaggio contestuale |
| Prototipi non attivi | `stato.html`, `static/js/azioni.js`, `static/js/eventi.js` | Mockup timeline e listener Fetch sperimentali; non risultano inclusi o caricati dalle viste attive | Timeline e aggiornamenti implementati nei componenti Angular | **Fuori scope runtime**: mantenuti nell'inventario, non sono baseline attiva; rimozione legacy solo dopo cutover |

## Copertura inventario

L'audit statico ha verificato 24 template/frammenti, 2 file JavaScript legacy e
134 riferimenti a render, include, link, HTMX o Fetch. Ogni file e classificato
nelle righe precedenti:

- comuni: `header.html`, `footer.html`, `sidebar.html`, `error_fragment.html`;
- ingresso e liste: `home.html`, `dashboard.html`, `sessioni.html`,
  `frammenti/sessioni_tabella.html`;
- bando: `bando_dettaglio.html`, `bando_config.html`;
- sessione: `gestione-concorso.html`, `azioni.html`, `stato.html`,
  `frammenti/azioni.html`, `frammenti/timeline.html`,
  `frammenti/notifiche.html`, `frammenti/tabella_candidati.html`,
  `frammenti/reset_password_list.html`;
- dispositivi e scanner: `dispositivi.html`,
  `frammenti/dispositivi_tabella.html`, `scanner.html`;
- amministrazione e debug: `admin_permessi.html`, `admin_logs.html`,
  `debug_sessioni.html`;
- script: `static/js/azioni.js`, `static/js/eventi.js`.

Le route Flask corrispondenti sono tracciate per destinazione in
`api-v1-target.md`. Le varianti runtime rilevate sono `dev_mode`,
`admin_globale`, `esperto_informatico`, `view_mode=sede`,
`view_mode=esperto` e i nove stati da `iniziale` a `esame_concluso`.

## Regole di verifica per ogni riga

1. Confrontare contenuto, ordine, gerarchia e classi visuali rilevanti a viewport
   desktop e mobile.
2. Provare caricamento, vuoto, errore, successo, attesa e condizioni per ruolo e
   stato applicabili.
3. Verificare che ogni controllo legacy abbia una controparte funzionante o una
   decisione di rimozione approvata e documentata.
4. Collegare almeno un test automatico o uno scenario manuale ripetibile.
5. Aggiornare questa matrice e la checklist di cutover prima di impostare
   `migrato`.
