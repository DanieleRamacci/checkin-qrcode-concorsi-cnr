# Principi

Chi usa l'app fa poche sessioni l'anno e lavora con i candidati in fila. Ogni schermata deve rispondere a una domanda: **cosa faccio adesso?**

## Regole

1. **Un solo pulsante pieno per schermata.** È dentro il pannello *Azioni*. Tutto il resto è pulsante outline o link.
2. **Le azioni stanno sempre nello stesso posto.** Nella pagina sessione il pannello *Azioni* è in cima alla colonna principale, con l'intestazione blu "Azioni · cosa fare adesso".
3. **I candidati stanno sempre sotto le Azioni.** La sezione *Candidati* esiste in ogni stato: vuota con un messaggio prima dello scaricamento, poi tabella.
4. **Lo stato si legge in un punto solo.** Badge "Stato: …" nella testata e timeline completa a destra. Niente codici tecnici (`candidati_scaricati`) a schermo.
5. **Avvisi dove servono.** Niente banner rossi fissi in cima. Un avviso compare solo se blocca qualcosa, vicino a ciò che blocca.
6. **Operazioni lunghe dichiarate.** Barra di avanzamento dentro il pannello Azioni, testo "Non chiudere la pagina" e cosa succede dopo.
7. **Numeri prima delle tabelle.** Presenti / totale grande in alto; filtri come chip con il conteggio.
8. **La chat non disturba.** Pulsante fisso in basso a destra con i non letti; pannello laterale sopra la pagina.
9. **Ogni ruolo vede solo le sue azioni.** L'informatico in sede non vede i pulsanti del segretario. In testata compare "Stai lavorando come …" per i ruoli diversi dal segretario.
10. **Elenchi pronti per crescere.** Concorsi, sessioni e candidati hanno ricerca, filtri e paginazione (10 / 25 / 50 per pagina).

## Linguaggio unico

| Oggi | Da usare |
|---|---|
| Dashboard Segretario, Lista Concorsi, Gestione concorso | **I miei concorsi** (elenco), **Sessione** (lavoro in aula) |
| Gestisci, Visualizza Sessioni | **Apri sessione**, **Vedi sessioni** |
| Esperto, Inf. remoto, Esperto informatico da remoto | **Esperto remoto** |
| Candidati Importati, candidati_scaricati | **Candidati scaricati** |
| Consigliato (badge marrone) | **Facoltativo** / **Obbligatorio**, badge neutri |
| Modifica config bando, Configura | **Configura bando** |
| Elimina sessione (sullo scanner) | **Scollega questo telefono** |
| Codice sessione (hash) | **Nome della sessione** |

## Accessibilità (WCAG 2.1 AA, linee guida AgID)

- Contrasto almeno 4.5:1 sul testo, anche sulle etichette piccole. I badge usano le coppie di colori in `proposta.css` (`app-badge-*`), già verificate.
- Aree cliccabili di almeno 44 px.
- Pulsanti veri (`<button>`, `itButton`) e link veri; niente click su `div`.
- Le icone decorative hanno `aria-hidden="true"`; i pulsanti solo icona hanno `aria-label`.
- Timeline: lista ordinata con `aria-current="step"` sullo stato attuale.
- Contatore e messaggi di avanzamento con `role="status"` / `aria-live="polite"`.
- Chat: si chiude con Esc e restituisce il focus al pulsante "Messaggi".
