# Research: Revisione dell'interfaccia guidata dal "prossimo passo"

Feature: [spec.md](spec.md) · Piano: [plan.md](plan.md)

Ogni voce riporta decisione, motivazione e alternative scartate. Le verifiche
sul codice sono del 2026-10-19. Riallineato al pacchetto di consegna
aggiornato il 19/10/2026 (schermate P01–P22, P09a–P09e).

## R1. Riferimento visivo

- **Decisione**: il riferimento è il pacchetto di consegna di Claude Design in
  [docs/design-revisione/](../../docs/design-revisione/README.md): principi,
  flussi e stati, specifiche dei componenti, una scheda per schermata
  (`04-schermate.md`, P01–P22 e P09a–P09e), requisiti di backend
  (`05-backend.md`), aree ancora da disegnare (`06-da-completare.md`), prototipo
  HTML navigabile (`prototipo/`), 30 screenshot desktop 1280 px e smartphone
  390 px (`screenshot/`) e foglio `stili/proposta.css` (sha256 `8c8bbb28…`,
  20 324 byte). Il Bootstrap Italia compilato del prototipo (2.17.4) non si usa:
  il progetto ha già il proprio (2.18.1, via SCSS).
- **Differenze del pacchetto superate da decisioni prese con l'utente**:
  - l'informatico in sede vede le azioni del segretario in una sezione
    secondaria (R12); la scheda P13 dice "nessun pulsante del segretario";
  - la ricerca manuale dello scanner è "Cerca a mano" per nome e cognome o
    documento (R13): copre "Inserisci codice a mano" (P09) e "Cerca per
    cognome" (P09d), che il pacchetto segna ancora come da confermare;
  - paginazione lato client (R10); il pacchetto suggerisce lato server;
  - card della scelta profilo senza l'informazione di contesto ("Oggi: …",
    conteggi) prevista da P01a, rimandata a una versione successiva (R9).
- **Schermate ancora da disegnare** (`06-da-completare.md`, sezione "Altre
  schermate"): dettaglio bando, finestre note e QR del candidato, area
  personale, testi delle email, menu dell'header per i profili diversi dal
  segretario. Per questi casi si mantiene il comportamento attuale con stili e
  linguaggio comuni; per il menu dell'header vale la scelta provvisoria FR-039.
- **Motivazione**: il pacchetto è versionato nel repository ed è più completo
  delle sole tavole (screenshot, prototipo e requisiti di backend).
- **Alternative**: lavorare direttamente sulla tela (riferimento mobile); una
  copia delle sole tavole nella cartella della spec (duplicato, rimossa).

## R2. Fogli di stile

- **Decisione**: `docs/design-revisione/stili/proposta.css` diventa un partial
  SCSS globale (`frontend/src/styles/_app.scss`) importato in
  `frontend/src/styles.scss` dopo Bootstrap Italia. Le variabili `--app-*`
  restano custom property. Stili specifici di un solo componente restano nel
  componente. A ogni nuovo aggiornamento del pacchetto si ricopia il foglio.
- **Motivazione**: le classi `app-*` sono condivise da tutte le schermate
  (pannello azioni, contatori, fasi, timeline, chat, cornici mobile, righe in
  evidenza); il foglio è di circa 20 KB, ben dentro il budget del bundle
  iniziale.
- **Alternative**: riscrivere ogni stile nei componenti (duplicazione);
  importare il CSS compilato del prototipo (versione diversa di Bootstrap
  Italia, doppio caricamento).

## R3. Componenti del kit Developers Italia

- **Decisione**: usare i componenti di `design-angular-kit` 21.2 dove esistono,
  le classi Bootstrap Italia dove il kit non ha un componente. I componenti
  nuovi seguono
  [03-componenti.md](../../docs/design-revisione/03-componenti.md):
  `app-session-header`, `app-actions-panel`, `app-state-timeline`,
  `app-candidates-section` (con la colonna del reset nelle modalità
  `reset-sede` / `reset-esperto`, nessun componente separato per le richieste),
  `app-chat-drawer`, `app-pager`.

| Elemento | Implementazione |
| --- | --- |
| Header a una fascia | `it-header` se permette la sola fascia slim con navigazione e zona destra; altrimenti componente proprio con le classi del prototipo (decisione ancora aperta nel pacchetto) |
| Percorso | `it-breadcrumb` |
| Paginazione | `it-pagination` + select elementi per pagina |
| Conferme ("Concludi check-in", sessione scaduta, rimozione permesso) | `it-modal` |
| Avvisi ed esiti | `it-alert`, `it-callout` |
| Operazioni lunghe | `it-spinner`, `it-progress-bar` dentro il pannello azioni |
| Elenchi home | `it-list` |
| Domande frequenti | `it-accordion` |
| Badge | direttiva `itBadge` + classi `app-badge-*` (contrasto AA) |
| Icone | `it-icon` (sprite del kit) al posto degli SVG del prototipo |
| Menu scanner | `it-dropdown` |
| Menu laterale Amministrazione | link list Bootstrap Italia (`it-sidebar` se adatto) |
| Fasi, timeline, contatori, schede mobile, cornice scanner, righe in evidenza | classi `app-*` di R2 |

- **Motivazione**: requisito del committente (kit Developers Italia) e
  accessibilità già curata dai componenti.
- **Alternative**: tutto con classi CSS (si perdono comportamenti accessibili
  dei componenti); componenti di terze parti (fuori dal design system PA).

## R4. Pannello della chat

- **Decisione**: componente proprio (pulsante fisso + pannello laterale, a tutto
  schermo su smartphone) con le classi `app-chat-*`; gestisce focus, tasto Esc,
  `aria-modal` e ritorno del focus al pulsante.
- **Motivazione**: il kit installato non esporta un offcanvas.
- **Alternative**: `it-modal` a tutta altezza (copre la pagina, contro il
  principio "non sposta la pagina").

## R5. Fasi ed etichette degli stati

- **Decisione**: un unico modulo frontend definisce per ognuno dei 12 stati:
  fase, etichetta leggibile e "prossimo passo" per profilo (vedi
  [contracts/ui-session-states.md](contracts/ui-session-states.md)), più le
  etichette leggibili dei ruoli. Le azioni abilitate continuano a venire dal
  backend (`/sessioni/<id>/state`).
- **Motivazione**: la fase è solo presentazione; macchina a stati e azioni
  restano nel backend (constitution I e III).
- **Alternative**: aggiungere fase ed etichette alle risposte del backend
  (accoppia testi d'interfaccia al dominio, senza vantaggi).

## R6. Cambi di stato fuori dalla chat

- **Decisione**: la chat non mostra le notifiche di tipo `state` e non le conta
  tra i non letti; restano salvate e la timeline usa lo storico degli stati.
- **Motivazione**: requisito FR-030 senza modifiche al backend.
- **Alternative**: smettere di generare le notifiche `state` (perde un audit
  già usato).

## R7. Ora e origine della presenza

- **Decisione**: due colonne nuove su `candidati`: `checkin_at` (data e ora) e
  `checkin_source` (`scanner` o `tabella`), aggiunte da `init_db.py` e dalla
  migrazione runtime in `utils/schema.py`. Le valorizzano
  `utils/scanner_service.py::checkin_candidate` (scanner) e
  `utils/candidati_service.py::toggle_candidate_checkin` (tabella);
  l'annullamento della presenza le azzera. Esposte nell'elenco candidati e
  nella risposta di `/scanner/verify-candidate` (serve a P09e "già
  registrato").
- **Motivazione**: FR-016 e FR-038; stesso meccanismo già usato in 011 per le
  note.
- **Alternative**: ricavarle dallo storico notifiche (non esiste un evento per
  candidato); una tabella di eventi di presenza (più completa, non richiesta
  ora). Il pacchetto mostra "registrato da un altro telefono": l'origine
  distingue solo scanner e tabella, non quale telefono.

## R8. Prossima sessione nell'elenco concorsi

- **Decisione**: la query di `routes/api_v1/bandi.py::list_bandi` (profilo
  segretario e vista admin) aggiunge per ogni bando la prossima sessione futura
  (id, nome, data, ora, luogo, stato) con una sottoquery su `sessioni` ordinata
  per `data_esame` (salvata come testo `AAAA-MM-GG HH:MM:SS`, ordinabile). Il
  campo esistente `session_count` conta già le sessioni scaricate: con zero
  sessioni la UI mostra "sessioni non ancora scaricate".
- **Motivazione**: le sessioni sono già collegate dalla stessa query; una sola
  chiamata alimenta home e "I miei concorsi" (P01, P02).
- **Alternative**: una chiamata `/bandi/<id>/sessioni` per bando (decine di
  richieste); scaricare le sessioni da Selezioni Online durante la sync dei bandi
  (una chiamata esterna per bando, tempi già critici in collaudo).

## R9. Profili disponibili e scelta profilo

- **Decisione**: `/api/v1/me` restituisce anche `profiles`, calcolati dai dati
  locali: `segretario` (commissione con ruolo SEGRETARIO attiva), `referente`
  (riga in `bando_referenti`), `sede` (assegnazione in `sessione_config`),
  `esperto` (ruolo esperto informatico), `admin`. Se l'utente non ha ancora dati
  locali come segretario o referente, entrambi i profili vengono proposti (primo
  accesso: i dati arrivano dalla prima sincronizzazione). Con un solo profilo
  si entra direttamente nella sua home. L'ultimo profilo usato si ricorda nel
  browser. Prima versione delle card: descrizione del profilo senza
  informazioni di contesto ("Oggi: …", conteggi) rimandate.
- **Motivazione**: evita card inutili senza nascondere i profili a chi non ha
  ancora sincronizzato.
- **Alternative**: mostrare sempre tutte le card (com'è oggi); calcolare le
  informazioni di contesto subito (più query a ogni login, valore marginale per
  la prima versione).

## R10. Elenchi paginati

- **Decisione**: paginazione, ricerca e filtri lato client per concorsi,
  sessioni, sessioni assegnate e bandi del referente (10, 25 o 50 per pagina) e
  per i candidati (25 per pagina); i filtri sono contatori cliccabili.
- **Motivazione**: le API restituiscono già l'elenco completo; i volumi sono di
  decine di concorsi e fino a qualche centinaio di candidati.
- **Alternative**: paginazione server come suggerisce `05-backend.md` (punti
  1–2): nuovi parametri API senza necessità attuale; da riconsiderare se i
  volumi crescono.

## R11. Dispositivi dentro la sessione

- **Decisione**: il pannello dispositivi (QR, "Copia link di collegamento",
  istruzioni, elenco con stato e "Scollega") diventa un componente usato nel
  pannello azioni della fase di preparazione e richiamabile durante il check-in
  ("collega un altro dispositivo"). La rotta `/sessioni/:id/dispositivi`
  reindirizza alla pagina della sessione.
- **Motivazione**: principio 6 della proposta.
- **Alternative**: tenere la pagina separata (contro FR-009).

## R12. Viste per profilo nella pagina sessione

- **Decisione**: la pagina sessione compone un pannello azioni diverso per
  profilo:
  - segretario e admin: avanzamento del flusso;
  - informatico in sede: spiega che il reset si chiede dalla riga del
    candidato, conta le richieste in attesa con il collegamento alla tabella,
    "Collega un dispositivo" secondario, più la sezione "Azioni del segretario"
    chiusa per impostazione predefinita, da "Candidati scaricati" a "Liste
    generate", che riusa la stessa card del segretario;
  - esperto remoto: passo d'esame corrente, file ricevuti, conteggio dei reset
    da fare con il collegamento alla tabella.

  Il reset si gestisce solo nella tabella dei presenti (R19). Decisione sulla
  sezione "Azioni del segretario" confermata dall'utente il 2026-10-19 (ruolo di
  riserva in aula).
- **Motivazione**: FR-025/FR-026/FR-027; interfaccia e backend restano coerenti
  (l'informatico vede ciò che può fare) e il ruolo di riserva resta.
- **Alternative**: nascondere del tutto le azioni del segretario
  all'informatico (perde il ruolo di riserva); tenerle allo stesso livello delle
  sue (situazione attuale, confonde le priorità). Le restrizioni di backend
  sull'informatico e sull'esperto sono nella feature 014.

## R13. Scanner a schermo intero e ricerca manuale

- **Decisione**: la rotta `/scanner` esce dal layout con header e usa la
  cornice scura del prototipo. Endpoint nuovi autorizzati dal token del
  dispositivo, come quelli esistenti: riepilogo sessione (nome, stato, presenti,
  totale) e ricerca candidati per "Cerca a mano": nome e cognome (in qualunque
  ordine, anche solo il cognome) o numero di documento, almeno 2 caratteri, al
  massimo 10 risultati con cognome, nome e numero di documento. La scelta apre
  la stessa scheda della lettura del QR, da cui si conferma la presenza. Un
  testo identico all'identificativo del QR apre direttamente la scheda.
  Decisione confermata dall'utente il 2026-10-19.
- **Motivazione**: FR-019/FR-020; il dispositivo è già autorizzato a leggere i
  candidati della propria sessione; mostrare il numero di documento permette di
  verificare la persona prima di confermare.
- **Alternative**: inserimento del solo codice del QR (non sempre stampato in
  chiaro sulla domanda); nessuna ricerca dal telefono, solo "Segna presente"
  dalla tabella sul PC (scartata dall'utente).

## R14. Segnale di novità per l'esperto remoto

- **Decisione**: contatore nel titolo della scheda del browser, badge sul
  conteggio dei reset da fare e riga in evidenza in cima alla tabella; avviso
  sonoro opzionale, spento per impostazione predefinita e ricordato nel
  browser; in più l'email (R19).
- **Motivazione**: assunzione della spec; nessun permesso del browser richiesto.
- **Alternative**: notifiche di sistema del browser (richiedono permesso,
  esperienza disomogenea).

## R15. Consegna incrementale

- **Decisione**: fondazioni (stili, header, fasi, componenti comuni) e poi una
  consegna per user story nell'ordine US1, US2, US3, US4, US5, US6, US7, US8.
  Ogni consegna sostituisce le schermate interessate e resta pubblicabile da
  sola; il ritorno indietro si fa annullando la singola consegna.
- **Motivazione**: constitution V; la sessione e lo scanner sono il valore
  principale.
- **Alternative**: interruttore per tenere vecchia e nuova interfaccia insieme
  (doppio codice da mantenere per tutta la transizione).

## R16. Verifica

- **Decisione**: test unitari del frontend (Vitest via `ng test`) per mappa
  degli stati, pannello azioni, filtri, colonna reset, scanner e pannello chat;
  test backend (pytest) per colonne, campi ed endpoint nuovi e per l'email di
  reset; verifica visiva rispetto a prototipo e screenshot e controllo
  accessibilità sul server di test con i profili reali
  ([quickstart.md](quickstart.md)).
- **Motivazione**: l'app richiede login CNR; non esiste un accesso di sviluppo
  senza OIDC.
- **Alternative**: modalità di sviluppo con dati finti (utile, ma fuori ambito
  di questa feature).

## R17. Storico degli stati nella timeline

- **Decisione**: `GET /sessioni/<id>/state` aggiunge `history` letto da
  `session_state_log` (stato, ora, utente), con il ruolo di chi ha agito
  calcolato con la stessa regola già usata per l'autore dei messaggi
  (`utils/notifications.py`): Segretario, Informatico in sede, Esperto remoto,
  Amministratore. Non si espone l'email.
- **Motivazione**: la timeline mostra l'ora di ogni passaggio e il pannello "in
  corso dalle…"; con la sezione "Azioni del segretario" serve sapere chi ha
  eseguito un passaggio. Lo storico esiste già ma è esposto solo nella pagina
  log dell'admin.
- **Alternative**: ricavarlo dalle notifiche di tipo `state` (hanno il ruolo
  salvato, ma la loro creazione non è garantita); un endpoint separato (una
  chiamata in più a ogni polling).
- **Limite noto**: il ruolo è calcolato sulla configurazione attuale della
  sessione; se l'informatico in sede viene cambiato, i passaggi fatti dal
  precedente risultano come "Segretario" o "Amministratore" secondo i suoi
  ruoli. Accettato: l'ora resta corretta e l'audit completo è nello storico.

## R18. Scollegare dispositivi e note dallo scanner

- **Decisione**: `POST /sessioni/<id>/devices/<device_id>/disconnect` per
  "Scollega" dalla pagina sessione, e `POST /scanner/candidate-note` per
  "Aggiungi nota" dalla scheda dello scanner, autorizzato dal token del
  dispositivo e con le stesse regole della nota esistente (massimo 2000
  caratteri).
- **Motivazione**: oggi un dispositivo si scollega solo dal dispositivo stesso;
  l'API delle note richiede i permessi della persona sulla sessione, mentre chi
  tiene il telefono può non averli.
- **Alternative**: niente "Scollega" in pagina sessione (contro FR-009); nota
  dallo scanner con i permessi della persona (fallisce per chi non è assegnato).

## R19. Reset password nella tabella dei presenti ed email all'esperto

- **Decisione**: il reset vive solo nella tabella dei presenti
  (`app-candidates-section` in modalità `reset-sede` / `reset-esperto`): stato
  sulla riga con chi l'ha chiesto e a che ora, ora di esecuzione, righe aperte
  in cima con `app-row-attn`, filtri In attesa (o Da fare) / Reset fatti / Tutti
  i presenti. Si riusano i campi e l'endpoint esistenti
  (`/sessioni/<id>/candidati/<uid>/reset-password`, operazioni `request`,
  `cancel_request`, `complete`, `undo_complete`); "Registra un reset"
  dell'esperto è `complete` senza richiesta precedente. Alla `request` il
  backend invia un'email all'esperto remoto della sessione con
  `utils/send_mail.py::send_notification_email` (già registrata nei log email);
  un invio fallito non annulla la richiesta.
- **Motivazione**: `02-flussi-e-stati.md` e `05-backend.md` (punti 9, 10, 14,
  decisione presa: email in aggiunta al browser).
- **Alternative**: elenco separato delle richieste (tolto dal pacchetto);
  email solo su richiesta esplicita dell'informatico (meno affidabile).
- **Testo provvisorio**: oggetto "[Check-in] Reset password richiesto –
  [nome sessione]", corpo con cognome e nome del candidato, ruolo di chi l'ha
  chiesto (non il nome), ora e collegamento alla sessione; da sostituire quando il pacchetto definirà i
  testi delle email.

## R20. "Le mie sessioni" per informatico in sede ed esperto remoto

- **Decisione**: nuovo endpoint `GET /sessioni/assegnate?mode=sede|expert` che
  restituisce le sessioni in cui l'utente è assegnato (stessa regola delle
  autorizzazioni attuali) con concorso, data, ora, sede, stato, presenti /
  totale e reset aperti (richiesti e non eseguiti). Nuova rotta
  `/le-mie-sessioni` con il profilo attivo; sostituisce `/bandi?mode=sede` e
  `/bandi?mode=expert` come home di questi profili, che restano raggiungibili.
- **Motivazione**: P15/P16 e `05-backend.md` punto 12.
- **Alternative**: riusare `/bandi?mode=…` e poi le sessioni (due passaggi in
  più, contro la scheda).

## R21. Stati dello scanner e sblocco automatico

- **Decisione**: lo scanner ricava gli stati P09a–P09e da dati già disponibili
  o aggiunti in questa feature:
  - P09a/P09b: dal flusso di associazione attuale (token nel browser), con i
    nuovi testi;
  - P09c/check-in concluso: dal `current_state` del riepilogo sessione,
    interrogato ogni 5 secondi mentre lo scanner è bloccato; il rifiuto 409
    `checkin_not_active` della conferma aggiunge `details.current_state` per
    distinguere "non ancora iniziato" da "già concluso";
  - P09d: risposta 404 della verifica, con "Scansiona di nuovo" e "Cerca a
    mano";
  - P09e: `checkin_effettuato` con `checkin_at` e `checkin_source` nella
    risposta della verifica.
- **Motivazione**: `05-backend.md` punto 15 e FR-038; nessun canale nuovo.
- **Alternative**: notifiche push al telefono (infrastruttura in più).

## R22. Sessione di accesso scaduta e uscita

- **Decisione**: `frontend/src/app/core/reauth.interceptor.ts`, alla risposta
  401 `authentication_required` / `reauthentication_required`, apre un
  `it-modal` non chiudibile ("La sessione di accesso è scaduta", "Le presenze già
  registrate sono salvate", "Accedi di nuovo") e solo al clic porta a
  `/login?next=<pagina corrente>`; una sola modale anche con più risposte 401.
  `/logged-out` diventa la pagina P22. Nessuna modifica alle API.
- **Motivazione**: P21, P22, `05-backend.md` punto 16; comportamento di
  rientro della feature 008 invariato.
- **Alternative**: reindirizzamento immediato (comportamento attuale, disorienta).

## R23. Dashboard referente e area Amministrazione

- **Decisione**: P17 usa i dati già esposti da `/referenti/bandi`
  (`remote_expert_assigned_count`, `sede_technician_assigned_count`,
  `session_count`, `required_data_complete`, `incomplete_session_names`, stato
  della configurazione) con filtri e paginazione lato client. P18–P20 riuniscono
  le pagine admin esistenti in un layout con menu laterale; i ruoli e gli stati
  nei log si mostrano con le etichette di R5 e il codice come dettaglio. Nessuna
  API nuova.
- **Motivazione**: schede P17–P20; i dati ci sono già.
- **Alternative**: nuove API aggregate (non necessarie). Con la feature 012 la
  pagina Permessi indicherà gli amministratori provenienti da ACE: la struttura
  a sezioni (Esperti remoti / Altri ruoli) lo permette senza riprogettare.
