# Contratto UI: schermate, rotte e user story

Corrispondenza tra le schermate del pacchetto di consegna
([docs/design-revisione](../../../docs/design-revisione/04-schermate.md):
prototipo in `prototipo/<file>.html`, immagini in `screenshot/`) e le rotte
dell'applicativo Angular. I codici sono i titoli delle tavole sulla tela.

| Tavola | Schermata | Prototipo | Rotta | User story | Note |
| --- | --- | --- | --- | --- | --- |
| — | Principi e flusso | — | — | tutte | `01-principi.md`, `02-flussi-e-stati.md` |
| P01a | Scelta profilo | `profili.html` | `/` | US3 | Tab dei profili disponibili e link alle loro pagine; resta visibile anche con un solo profilo |
| P01 | Home del segretario | `home.html` | `/segretario` (nuova) | US3 | Prossima sessione, prossime sessioni ed elenco paginato dei concorsi |
| P02 | I miei concorsi | `concorsi.html` | `/bandi` | US3 | Paginata, filtri, stato configurazione |
| P03 | Sessioni del concorso | `sessioni.html` | `/bandi/:commissionId/sessioni` | US3 | Fase, stato, prossimo passo, presenti / totale |
| P04 | Configura bando | `configura-bando.html` | `/bandi/:commissionId/config` | US5 | Indice sezioni, supporto per sessione, salvataggio unico |
| P05 | Sessione – iniziale | `sessione-prepara.html` | `/sessioni/:sessionId` | US1 | Pannello da [ui-session-states.md](ui-session-states.md) |
| P05b | Sessione – configurata | `sessione-scarica.html` | `/sessioni/:sessionId` | US1 | |
| P06 | Sessione – dispositivi | `sessione-dispositivi.html` | `/sessioni/:sessionId` | US1 | `/sessioni/:sessionId/dispositivi` reindirizza qui |
| P07 | Sessione – check-in | `sessione-checkin.html` | `/sessioni/:sessionId` | US1 | Modale di conclusione |
| P10 | Sessione – genera liste | `sessione-liste.html` | `/sessioni/:sessionId` | US1 | |
| P10b | Sessione – invia liste | `sessione-liste-invia.html` | `/sessioni/:sessionId` | US1 | |
| P11 | Sessione – liste inviate | `sessione-liste-inviate.html` | `/sessioni/:sessionId` | US1 | File sempre scaricabili |
| P12 | Chat aperta | `sessione-chat.html` | tutte le pagine sessione | US6 | Pulsante fisso e pannello laterale |
| P13 | Vista informatico in sede | `sessione-sede.html` | `/sessioni/:sessionId?mode=sede` | US4 | Reset dalla tabella; più la sezione "Azioni del segretario" (decisione 013) |
| P14 | Vista esperto remoto | `sessione-esperto.html` | `/sessioni/:sessionId?mode=expert` | US4 | Passo d'esame, conteggio reset, reset dalla tabella |
| P15 | Le mie sessioni – esperto remoto | `home-esperto.html` | `/le-mie-sessioni?mode=expert` (nuova) | US4 | Sostituisce `/bandi?mode=expert` come home |
| P16 | Le mie sessioni – informatico in sede | `home-sede.html` | `/le-mie-sessioni?mode=sede` (nuova) | US4 | Sostituisce `/bandi?mode=sede` come home |
| P08 | Sessione su smartphone | `mobile-sessione.html` | `/sessioni/:sessionId` sotto 768px | US2 | Schede Sessione / Candidati / Messaggi |
| P09 | Scanner – candidato trovato | `scanner.html` | `/scanner` (fuori dal layout) | US2 | "Cerca a mano" per nome e cognome o documento |
| P09a | Scanner – collega il telefono | `scanner-associa.html` | `/scanner` | US2 | Senza sessione |
| P09b | Scanner – collegamento | `scanner-collegamento.html` | `/scanner?sessionId&token` | US2 | In corso / non riuscito / riuscito |
| P09c | Scanner – check-in non avviato | `scanner-non-avviato.html` | `/scanner` | US2 | Si sblocca da solo |
| P09d | Scanner – candidato non trovato | `scanner-non-trovato.html` | `/scanner` | US2 | "Scansiona di nuovo", "Cerca a mano" |
| P09e | Scanner – già registrato | `scanner-gia-registrato.html` | `/scanner` | US2 | Ora e origine della presenza |
| P17 | Dashboard referente | `referente.html` | `/referenti/bandi` | US5 | Filtri Da completare / Completi / Tutti |
| P18 | Amministrazione – permessi | `admin-permessi.html` | `/admin/permessi` | US7 | Esperti remoti e altri ruoli |
| P19 | Amministrazione – impostazioni | `admin-impostazioni.html` | `/admin/impostazioni` | US7 | Anteprima dell'intestazione |
| P20 | Amministrazione – log | `admin-log.html` | `/admin/logs` | US7 | Schede per registro, 200/500/1000 |
| P21 | Sessione di accesso scaduta | `sessione-scaduta.html` | modale su qualunque pagina | US8 | Prima del rientro al login |
| P22 | Uscita | `uscita.html` | `/logged-out` | US8 | "Sei uscito dall'applicazione" |

## Schermate ancora da disegnare

Elencate in `06-da-completare.md` ("Altre schermate"). Finché non hanno un
disegno si mantiene il comportamento attuale, con header, stili e linguaggio
comuni.

| Schermata | Rotta | Trattamento |
| --- | --- | --- |
| Dettaglio bando | `/bandi/:commissionId/detail` | Stili e linguaggio comuni |
| Finestre note e QR del candidato | modali della sezione candidati | Contenuto attuale con `it-modal` |
| Stati dopo l'invio liste per il segretario | `/sessioni/:sessionId` | Pannello di [ui-session-states.md](ui-session-states.md) |
| Stati d'esame dell'esperto non disegnati | `/sessioni/:sessionId?mode=expert` | Pannello di [ui-session-states.md](ui-session-states.md) |
| Chat su smartphone | pannello a tutto schermo | Stesso componente della chat desktop |
| Area personale | `/area-personale` | Stili comuni |
| Testi delle email | — | Testi attuali; per il reset il testo provvisorio di research R19 |
| Menu dell'header per i profili non segretario | header | Scelta provvisoria FR-039 |

## Header comune

Una fascia: "CNR · Check-in Concorsi", navigazione del profilo attivo (FR-039),
profilo attivo ("Profilo: …", porta alla scelta profilo), utente con menu (area
personale, impostazioni per admin, logout). Sotto 992px la navigazione si apre
dal pulsante "Menu". Footer su fondo scuro.
