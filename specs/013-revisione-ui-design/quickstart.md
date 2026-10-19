# Quickstart: verifica della revisione dell'interfaccia

Feature: [spec.md](spec.md) · Piano: [plan.md](plan.md) · Riferimento visivo:
[docs/design-revisione](../../docs/design-revisione/README.md) (prototipo e
screenshot)

## Prerequisiti

- Ambiente di sviluppo del progetto (Python 3.11 con `.venv`, Node per
  `frontend/`).
- Per le prove con utenti reali: server di test
  `https://test-checkin.concorsi.cnr.it` con almeno un utente per profilo
  (segretario, referente, informatico in sede, esperto remoto, amministratore) e
  un bando di prova con una sessione e 4 candidati, di cui 2 con documento
  scaduto.
- Uno smartphone per lo scanner e una casella email dell'esperto remoto di prova.

## Verifiche automatiche

```bash
# backend: colonne, campi ed endpoint nuovi, email di reset
.venv/bin/python -m pytest -q

# frontend: mappa stati, pannello azioni, filtri, colonna reset, scanner, chat
cd frontend && npm run test:ci

# build di produzione entro i budget di angular.json
cd frontend && npm run build:production
```

Esito atteso: tutti i test passano; la build non supera i budget.

## Avvio locale

```bash
docker compose up --build        # backend su http://localhost:5050
cd frontend && npm start         # frontend con proxy verso :5050
```

Il login passa da Keycloak di test: serve che l'URI di callback locale sia
registrato sul client. Senza, la verifica visiva si fa sul server di test.

## Scenari di validazione

Per ogni schermata confrontare gerarchia, testi e disposizione con prototipo e
screenshot indicati in [contracts/ui-screens.md](contracts/ui-screens.md).

1. **Sessione guidata (US1, SC-001, SC-002, SC-003)**: con almeno 3 segretari
   che non hanno mai usato la nuova interfaccia, ognuno su una propria sessione
   di prova, portare la sessione da "Sessione creata" a "Liste inviate" senza
   istruzioni. In ogni stato annotare se il segretario individua il prossimo
   passo entro 5 secondi (SC-001: almeno il 90% dei casi) e verificare una sola
   azione principale, titolo e pulsante di
   [contracts/ui-session-states.md](contracts/ui-session-states.md), pannello
   visibile senza scorrere a 1280×800, timeline con ora e ruolo. Cronometrare
   ogni percorso (SC-002: meno di 15 minuti).
2. **Dispositivi nella sessione (FR-009)**: collegare lo smartphone dal QR
   nella pagina sessione, scollegarlo da "Scollega"; aprire
   `/sessioni/<id>/dispositivi` e verificare il reindirizzamento.
3. **Check-in e conclusione (FR-010, FR-011, FR-016)**: registrare 2 presenze
   da scanner e 1 da tabella; verificare contatori e filtri, ora e origine di
   ogni presenza, annullamento con conferma, modale di conclusione con 3
   presenti e 1 assente.
4. **File sempre scaricabili (SC-006)**: con l'esperto remoto far avanzare la
   sessione fino a "Esame concluso"; in ogni stato il segretario scarica XLSX e
   CSV. In "Ambiente d'esame pronto" il segretario vede l'avviso.
5. **Scanner (US2, FR-038, SC-004)**:
   - aprire `/scanner` senza sessione (P09a) e collegarlo dal QR, vedendo
     l'esito del collegamento (P09b);
   - prima dell'avvio del check-in vedere "Il check-in non è ancora iniziato"
     (P09c); avviare il check-in dal PC e verificare lo sblocco entro 10 secondi;
   - leggere un QR e confermare con un tocco; aprire un candidato con documento
     scaduto, aggiungere una nota e confermare;
   - con "Cerca a mano" trovare un candidato scrivendo "nome cognome", uno
     "cognome nome" e uno con le prime cifre del documento; i risultati mostrano
     il numero di documento;
   - leggere un codice inesistente (P09d) e un candidato già presente (P09e, con
     ora e origine);
   - a check-in concluso verificare che lo scanner lo indichi.
6. **Smartphone (SC-007)**: a 390px aprire home, concorsi, sessioni e sessione;
   nessuno scorrimento orizzontale della pagina; schede Sessione / Candidati /
   Messaggi funzionanti.
7. **Profili ed elenchi (US3)**: Home mostra le tab dei profili disponibili
   anche con un solo profilo; i link di ogni tab aprono le rispettive pagine;
   la home del segretario mostra la prossima sessione e sotto i concorsi paginati;
   un concorso senza sessioni locali indica come scaricarle; elenchi paginati e
   filtrabili; menu dell'header coerente con il profilo attivo.
8. **Viste tecniche e reset (US4, FR-027, FR-032, SC-009)**:
   - informatico ed esperto entrano in "Le mie sessioni" (P15, P16) con la
     sessione di oggi in evidenza e i reset aperti;
   - l'informatico preme "Serve reset password" su un presente: la riga sale in
     cima come "Reset richiesto";
   - l'esperto la vede in cima con "Segna come fatto", il conteggio nel pannello
     e il titolo della scheda aggiornati; arriva l'email, presente nei log email;
   - l'esperto la segna come fatta; l'informatico vede "Reset fatto" con l'ora
     senza ricaricare; l'esperto usa "Registra un reset" su un'altra riga;
   - l'informatico apre "Azioni del segretario" (chiusa per impostazione
     predefinita), avvia il check-in, e il segretario lo vede in timeline con
     ruolo "Informatico in sede"; l'informatico non vede azioni dell'esperto.
9. **Referente (US5)**: la dashboard (P17) apre sui bandi da completare con "n
   su m sessioni" e "Manca in: …"; "Completa configurazione" apre la
   configurazione con l'indice delle sessioni da completare, salvataggio unico e
   avviso di modifiche non salvate.
10. **Chat (US6, SC-005)**: badge non letti, risposta rapida inviata a tutti,
    nessun codice di stato nei messaggi.
11. **Amministrazione (US7)**: area con menu laterale; aggiungere e rimuovere un
    esperto remoto (con conferma); modificare il nome dell'applicazione
    vedendo l'anteprima; nei log scegliere "Ultimi 500", cambiare registro,
    cercare; date in formato italiano e nomi leggibili.
12. **Accesso scaduto e uscita (US8, SC-010)**: durante il check-in far scadere la
    sessione di accesso; compare la modale non chiudibile; "Accedi di nuovo"
    riporta alla stessa pagina e le presenze registrate ci sono; fare logout e
    verificare la pagina "Sei uscito dall'applicazione".
13. **Accessibilità (SC-008)**: verifica automatica senza errori bloccanti su
    ogni schermata rivisitata; navigazione completa da tastiera nella pagina
    sessione, nelle modali e nel pannello chat; contrasto ≥ 4.5:1.

Registrare gli esiti nel piano di collaudo della feature 009 con il prefisso
`013.`.
