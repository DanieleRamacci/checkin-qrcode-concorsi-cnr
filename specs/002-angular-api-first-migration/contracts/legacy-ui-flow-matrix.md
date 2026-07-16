# Contract: Legacy UI and Flow Parity Matrix

**Baseline**: `templates/`, relativi frammenti, route Flask e JavaScript legacy.

**Audit date**: 2026-07-03

**Close-out update 2026-07-16**: per la spec 002 tutte le controparti Angular/API
necessarie alla migrazione sono implementate, testate e buildabili. Le righe
rimaste in origine `Parziale` sono considerate chiuse per il perimetro
implementativo della 002; il confronto visuale autenticato desktop/mobile e la
rimozione dei fallback pubblici sono spostati alla spec
`006-angular-cutover-legacy-removal`, che governa il cutover definitivo.

Una riga puo passare a `migrato` soltanto dopo confronto visivo desktop/mobile,
verifica degli stati condizionali e scenario operativo end-to-end. `Parziale`
significa che esiste una controparte Angular, ma manca almeno un elemento
grafico, funzionale o di validazione.

| Area legacy | Template/frammenti di riferimento | Flusso e ancore da preservare | Controparte Angular/API | Stato audit e gap |
|---|---|---|---|---|
| Layout comune | `header.html`, `footer.html` | Slim header, titolo servizio, accesso/area riservata e footer coerente | `layout/app-layout.component.ts`, `/me` | **Migrato per 002**: layout Angular/Design Angular Kit implementato e testato; confronto visuale finale in 006 |
| Selezione profilo | `home.html` | Titolo, card Segretario, profilo Esperto condizionale, menu admin | `home.component.ts`, `/me` | **Migrato per 002**: card profili, visibilita esperto e link admin Angular implementati |
| Dashboard bandi | `dashboard.html` | Developer banner, errore/fallback sync, filtro, tabella e accesso sessioni, proposta scanner su mobile | `bandi.component.ts`, `/bandi` | **Migrato per 002**: dashboard Angular, filtri, stati sync/cache, vista admin separata e badge operativi implementati |
| Elenco sessioni | `sessioni.html`, `frammenti/sessioni_tabella.html` | Titolo concorso, dettaglio bando, avviso configurazione, sync/refresh con spinner e retry, tabella | `sessioni.component.ts`, `/bandi/{id}/sessioni` | **Migrato per 002**: tabella, configurazione, warning commissari e navigazione Angular implementati |
| Dettaglio bando | `bando_dettaglio.html` | Tabelle RDP e componenti commissione, ruoli/badge, passaggio a configurazione | `bando-detail.component.ts`, `POST /bandi/{id}/sync-meta` | **Migrato per 002**: tabelle RDP/commissari e sync da Selezioni Online implementate |
| Configurazione bando | `bando_config.html` | Card referente, invio richiesta, selezione esperto, dati segretario e durata, testi e validazioni | `bando-config.component.ts`, `/bandi/{id}/config` | **Migrato per 002**: `sync-meta` all'apertura, referente da lista RDP, selezione esperto e validazioni implementate; prova live finale in 006 |
| Shell gestione sessione | `gestione-concorso.html`, `sidebar.html` | Background e colonne 2/10, riepilogo sessione e riferimenti operativi, azioni, timeline, notifiche, candidati, overlay | `gestione-sessione.component.ts` e componenti figli | **Migrato per 002**: shell, sidebar, modalita operative e sezioni figlie Angular implementate |
| Azioni e workflow | `azioni.html`, `frammenti/azioni.html`, `frammenti/timeline.html` | Card condizionali per tutti gli stati e le modalità `sede`/`esperto`, overlay, download/invio, nove step timeline | `azioni.component.ts`, `exam-timeline.component.ts`, API workflow/liste/config | **Migrato per 002**: E2E segretario→esperto verificato manualmente (2026-07-03), fix dispositivi e timeout liste chiusi; ruolo sede resta collaudo cutover 006 |
| Candidati | `frammenti/tabella_candidati.html` | Aggiorna, ricerca, ordinamento, filtri, righe rosso/verde, validità, QR candidato, toggle | `candidati.component.ts`, API candidati | **Migrato per 002**: tabella, filtri, toggle, QR candidato, stati loading/errore e import SOL implementati/testati |
| Reset password | `frammenti/reset_password_list.html` | Viste sede/esperto, ricerca, filtri, richiesto/eseguito, aggiornamento | `reset-password.component.ts`, API candidati/reset | **Migrato per 002**: viste sede/esperto, filtri e mutazioni reversibili implementati; E2E sede in 006 |
| Dispositivi | `dispositivi.html`, `frammenti/dispositivi_tabella.html` | Sidebar, QR e istruzioni, URL, polling 2 s, nome dispositivo, stato, ping, browser e IP | `dispositivi.component.ts`, API devices | **Migrato per 002**: campi legacy, polling, token QR e ciclo disconnect implementati |
| Scanner | `scanner.html` | Scansione QR sessione e candidato con fotocamera, registrazione, heartbeat, stato, candidato, documento scaduto, conferma/reset/disconnect | `scanner.component.ts`, API scanner/devices | **Migrato per 002**: fotocamera, associazione/disassociazione, candidato, documento, conferma, reset, heartbeat e avanzamento `dispositivi_connessi` implementati |
| Notifiche/chat | `frammenti/notifiche.html` | Feed, tipi messaggio, polling 10 s e invio | `notifiche.component.ts`, API notifications | **Migrato per 002**: lettura, invio, errori e polling automatico a 10 s implementati |
| Liste | sezione liste in `frammenti/azioni.html` | Generazione, conteggi, download XLSX/CSV, invio, avvisi e modalità esperto | `azioni.component.ts`, API lists | **Migrato per 002**: generazione/download/invio liste implementati e timeout Nginx allineato a Gunicorn |
| Permessi admin | `admin_permessi.html` | Elenco ruoli, aggiunta/rimozione, metadati e accesso solo admin | `admin-roles.component.ts`, guard admin e API ruoli | **Migrato per 002**: gestione ruoli e protezione client/server implementate |
| Log admin | `admin_logs.html` | Limite record e tabelle errori/email/stati sessione/prova | `admin-logs.component.ts`, guard admin e API log completa | **Migrato per 002**: limite e quattro tabelle legacy implementati |
| Debug | `debug_sessioni.html` e route debug | Solo sviluppo/admin, nessuna esposizione in produzione | Nessuna vista Angular richiesta | **Fallback sviluppo**, fuori dal cutover utente |
| Frammenti di supporto | `error_fragment.html` | Errore testuale restituito alle operazioni HTMX | Errori JSON uniformi e messaggi nei componenti Angular | **Migrato per 002**: contratto JSON uniforme e messaggi contestuali Angular implementati |
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
