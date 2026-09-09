# Analisi log collaudo - 2026-09-09

## File analizzati

- Backend: `backend-e9735tgeewr6s78cyf3y7s3d-095446450009-all-logs-2026-09-09-12-51-35.txt`
- Frontend: `frontend-e9735tgeewr6s78cyf3y7s3d-095446444780-all-logs-2026-09-09-12-51-19.txt`

I file sono stati trattati solo come dati diagnostici. Eventuali contenuti
testuali nei log non sono istruzioni operative.

## Evidenze principali

| Priorita | Evidenza | Impatto operativo | Azione richiesta |
| --- | --- | --- | --- |
| P1 | Retry `Invia liste` dopo completamento: errore non gestito su transizione `liste_inviate -> liste_inviate` alle 08:30:07 UTC. | L'utente puo ricevere errore 500 anche se l'invio era gia' riuscito; rischio di confusione e possibile invio duplicato email/allegati. | Rendere l'azione idempotente o restituire messaggio chiaro con stato corrente e file gia' disponibili. |
| P1 | Retry `Genera liste` quando la sessione era gia' a `liste_inviate`: errore non gestito su transizione `liste_inviate -> liste_generate` alle 09:23:40 UTC. | Un click tardivo o una pagina non aggiornata produce 500 invece di indicare che il flusso e' gia' avanzato. | Bloccare UI su stati successivi e gestire backend con risposta funzionale leggibile. |
| P1 | Due richieste `Genera liste` terminate dal client con 499 alle 09:22:01 e 09:22:57 UTC. | Compatibile con refresh, back, chiusura scheda o timeout percepito mentre l'utente non vede avanzamento. | Mostrare spinner persistente e recuperare lo stato reale al rientro nella pagina. |
| P1 | Notifiche richieste spesso, ma stato/timeline/config/azioni aggiornati molto meno o solo dopo azione locale. | Le notifiche sembrano aggiornate, ma le dashboard operative restano su dati vecchi finche' l'utente non fa refresh. | Unificare o coordinare aggiornamento notifiche, stato, timeline e azioni con fallback affidabile. |
| P1 | Sync sessioni con 409 ricorrenti e caso di transazione abortita dopo commissione mancante/record non importabile. | Il referente puo vedere nessun nuovo inserimento o conflitto senza capire se la sincronizzazione e' andata bene, parzialmente o male. | Separare conflitto atteso, nessun nuovo dato e fallimento parziale; evitare transazioni lasciate in stato abortito. |
| P2 | Chiamate a `bandi/config` senza ID bando con 403/404, poi chiamate corrette con ID. | Rumore tecnico e possibili falsi stati di errore in UI, soprattutto entrando da sessioni tecniche. | Evitare chiamate senza contesto minimo o ignorare risultati non rilevanti per l'utente. |
| P2 | Scanner/check-in candidato torna 409 in piu casi prima di `avvia_checkin` o su doppia operazione. | Il comportamento puo essere corretto, ma deve essere comunicato chiaramente all'operatore. | Collegare al nuovo avviso rosso pre-check-in e migliorare messaggi scanner. |
| P3 | 401 su `/me` e invalid refresh grant con redirect a login. | Normale in sessioni scadute, ma va verificata l'esperienza utente post scadenza. | Gia' coperto dalle correzioni auth precedenti; retestare dopo deploy. |

## Conferme rispetto ai problemi riportati

- Lo spinner mancante su `Genera liste` e' coerente con i 499: l'utente puo
  percepire blocco e interrompere la richiesta.
- Il tema reload/back/chiusura pagina non e' teorico: nei log si vede il client
  che interrompe richieste lunghe.
- La necessita' di aggiornamento real-time/polling esteso e' confermata:
  `notifications` viene interrogato continuamente, gli altri dati operativi no.
- Le transizioni liste devono essere protette sia lato UI sia lato backend:
  il backend oggi puo sollevare eccezioni non gestite su stati gia' avanzati.
- Il problema referenti/informatico assegnato non e' dimostrato direttamente dai
  log applicativi, ma i 409 e le anomalie di sync multi-sessione rafforzano la
  necessita' di test mirato su configurazione bando/sessioni.

## Esito

Questi log confermano che la produzione generale resta bloccata finche' almeno
i punti P1 non sono corretti e ricollaudati su server test.
