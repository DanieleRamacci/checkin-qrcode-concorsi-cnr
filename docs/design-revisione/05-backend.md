# Cosa serve lato backend

Da verificare nel codice Flask prima di implementare. Ogni punto indica la schermata che ne dipende.

| # | Necessità | Schermate | Note |
|---|---|---|---|
| 1 | Paginazione, ricerca e ordinamento lato server per l'elenco concorsi (`page`, `per_page`, `q`, `sort`, filtri) con totale | P02 | Oggi l'elenco sembra caricato tutto insieme |
| 2 | Stessa cosa per le sessioni di un concorso, con filtro da oggi / passate | P03 | |
| 3 | Nell'elenco sessioni: stato corrente, presenti, totale candidati, prossimo passo | P03, P01 | L'API li fornisce già secondo l'analisi; vanno solo esposti in elenco |
| 4 | Riepilogo configurazione del bando (completa / cosa manca) per l'elenco concorsi | P02, P03 | Può essere calcolato da `compute_bando_config_status` |
| 5 | Orario di ogni cambio di stato della sessione | Timeline | Per mostrare l'ora accanto agli stati completati |
| 6 | Salvataggio della configurazione sessione e scaricamento candidati come due passi distinti (stati 1 → 2 → 3) | P05, P05b | Già così nella logica; il design li separa a schermo |
| 7 | Avanzamento delle operazioni lunghe (scaricamento candidati, generazione liste) | P05b, P10 | Anche solo "in corso / finito" basta per la barra indeterminata |
| 8 | File delle liste scaricabili in tutti gli stati da "Liste generate" in poi | P10b, P11, P14 | Oggi spariscono dopo la conferma Moodle |
| 9 | Richieste di reset password: crea (sede), annulla (sede), segna fatto (esperto), elenco per sessione con stato e orari | P13, P14 | Probabilmente esiste in parte |
| 10 | **Email all'esperto remoto per ogni nuova richiesta di reset** | P14 | Deciso: email in aggiunta alla notifica nel browser |
| 11 | Chat: messaggi di sola chat separati dagli eventi di stato; contatore non letti per utente | Chat | Oggi gli stati compaiono in chat come codici |
| 12 | Elenco sessioni assegnate per esperto remoto e informatico in sede, con conteggio reset aperti | P15, P16 | Nuova API |
| 13 | Ultimo profilo usato dall'utente | P01a | Anche solo lato browser |
| 14 | Stato del reset sulla riga del candidato presente: richiesto da / alle, fatto alle; ordinamento con richieste aperte in cima | P13, P14 | Il reset si gestisce solo sui presenti; nessuna colonna utente Moodle (è sempre nome.cognome) |
| 15 | Messaggio specifico quando il check-in non è avviato, per sbloccare lo scanner da solo all'avvio | P09c | Oggi l'API restituisce un errore generico "Check-in non consentito" |
| 16 | 401 di sessione scaduta: il frontend mostra prima la modale, poi reindirizza a `/login?next=` | P21 | Nessuna modifica lato API |
