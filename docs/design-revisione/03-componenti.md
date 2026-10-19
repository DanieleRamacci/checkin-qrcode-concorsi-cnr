# Componenti

## Dal prototipo al kit

| Blocco | Classi nel prototipo | design-angular-kit |
|---|---|---|
| Header a una fascia | `it-header-wrapper` + `it-header-slim-wrapper` | `<it-header>` con sola fascia slim, oppure componente proprio `app-header` con le stesse classi |
| Percorso | `breadcrumb-container` | `<it-breadcrumb>` |
| Card | `card card-bg` | `<it-card>` |
| Pulsanti | `btn btn-primary`, `btn-outline-primary` | `itButton="primary"`, `itButton="outline-primary"` |
| Filtri con conteggio | `btn btn-sm rounded-pill` + `aria-pressed` | `<it-chip>` selezionabili o pulsanti toggle |
| Tabelle | `table`, `table-responsive` | `<it-table>` |
| Paginazione | `pagination-wrapper`, `pagination` | `<it-pagination>` (+ `<it-select>` per elementi per pagina) |
| Modulo | `form-group`, `select-wrapper` | `<it-input>`, `<it-select>` |
| Avvisi | `alert alert-warning` | `<it-alert>` |
| Esito positivo | `callout success` | `<it-callout color="success">` |
| Avanzamento | `progress`, `progress-spinner` | `<it-progress-bar>`, `<it-spinner>` |
| Conferma | `modal` | `<it-modal>` |
| "Non trovi un concorso?" | `accordion` | `<it-accordion>` |
| Icone | sprite Bootstrap Italia | `<it-icon name="...">` |

## Componenti nuovi

Tutti usano le classi di `stili/proposta.css`.

### `app-session-header`
Testata della pagina sessione: breadcrumb, titolo, data e sede, badge "Stato: …" e, per i ruoli diversi dal segretario, badge "Stai lavorando come …".
- Input: `sessione`, `statoCorrente`, `ruolo`.
- Classi: `app-session-head`, `app-state-pill`, `app-state-pill--role`.

### `app-actions-panel`
Il pannello Azioni. Una sola azione principale per stato.
- Input: `etichetta` (es. "Passo 2 di 3 · Preparazione"), `titolo`, `nota`.
- Slot: contenuto (`ng-content`) e pulsante (`ng-content select="[azione]"`).
- Classi: `app-actions-card`, `app-actions-head`, `app-actions-sub`, `app-next-footer`, `app-longop` per le operazioni lunghe.
- Il contenuto lo sceglie la pagina in base a stato e ruolo (vedi tabella in `02-flussi-e-stati.md`).

### `app-state-timeline`
I 12 stati in 4 gruppi, verticale, nella colonna destra.
- Input: `statoCorrente` (1–12), `orari` (mappa stato → ora), `faseEsameMia: boolean` (true per l'esperto).
- Markup: `<ol class="app-tl">` per ogni fase; `li.is-done` con spunta e orario, `li.is-current` con `aria-current="step"` ed etichetta "stato attuale".
- Si aggiorna con il polling esistente (5 s).

### `app-candidates-section`
Sezione sempre presente sotto le Azioni.
- Input: `candidati`, `modalita: 'vuota' | 'sola-lettura' | 'checkin' | 'finale' | 'reset-sede' | 'reset-esperto'`.
- `vuota`: riquadro `app-empty` con il messaggio del passo successivo.
- `checkin`: chip filtro (Da registrare / Presenti / Documento scaduto / Tutti) con conteggi, ricerca, "Segna presente", paginazione oltre 25 righe.
- `finale`: colonna Presenza con Presente + ora / Assente.
- `reset-*`: colonna "Reset password" (vedi `04-schermate.md`).

### Reset password (nessun componente separato)
Lo stato del reset è una colonna di `app-candidates-section` in modalità `reset-sede` / `reset-esperto`: badge *Reset richiesto* / *Reset fatto* con orario, azione sulla riga (*Serve reset password*, *Annulla richiesta*, *Segna come fatto*, *Registra un reset*). Le righe con richiesta aperta hanno la classe `app-row-attn` e stanno in cima. Filtri a chip sopra la tabella.

### `app-chat-drawer`
Chat interna della sessione per segretario, esperto remoto e informatico in sede.
- Pulsante fisso `app-chat-fab` in basso a destra con badge `app-chat-fab-badge` dei non letti.
- Pannello `app-chat-drawer` (`.is-open` per aprirlo) sopra la pagina, largo 400 px, a tutto schermo su smartphone.
- Contenuto: partecipanti, messaggi (`app-msg`, `app-msg--me`, `app-role-tag--seg|esp|sede`), risposte rapide, campo "Scrivi a tutti".
- Polling esistente (10 s). Chiusura con X ed Esc; focus restituito al pulsante.
- I cambi di stato **non** vanno in chat: restano nella timeline.

### `app-pager`
Riga sotto le tabelle: "Concorsi 1–10 di 37", `<it-pagination>`, selettore 10/25/50.

## Colori

Primario Bootstrap Italia `#0066CC`. Colori semantici usati dai badge (testo su sfondo, contrasto AA):

| Uso | Sfondo | Testo |
|---|---|---|
| Successo | `#E6F4EE` | `#00653F` |
| Attenzione | `#FFF4E0` | `#6B4100` |
| Errore | `#FBE9EB` | `#8E1C2C` |
| Neutro | trasparente, bordo `#4D5B69` | `#4D5B69` |
| Evidenza azzurra | `#E6F0FA` | `#0B3D75` |
