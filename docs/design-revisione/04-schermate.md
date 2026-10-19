# Schermate

Per ogni schermata: prototipo in `prototipo/<nome>.html`, immagine in `screenshot/`. Le rotte e i file Angular indicati sono quelli visti nell'app attuale: verificali nel codice prima di modificarli.

## Comuni

**Header** (tutte le pagine desktop) — `layout/app-layout.component.ts`
Una sola fascia: "CNR · Check-in Concorsi", menu Home / I miei concorsi / Scanner, pulsante "Profilo: <ruolo>" che porta alla scelta profilo, nome utente. Sostituisce le tre fasce attuali.

**Footer** — come oggi, su fondo scuro con testo bianco.

---

## P01a Scelta profilo — `profili.html`
Rotta attuale: `/` · File: `features/home/home.component.ts`
- Titolo "Con quale profilo vuoi lavorare?".
- Una card per ogni ruolo che l'utente ha: icona, nome, cosa fa, un'informazione di contesto (es. "Oggi: Prova Scritta Sessione 2"), pulsante "Entra come …". Il ruolo usato per ultimo ha bordo blu, badge "Ultimo usato" e pulsante pieno.
- Amministrazione in una sezione separata sotto, solo per gli amministratori.
- Con un solo ruolo si salta questa pagina. L'ultimo ruolo si ricorda.

## P01 Home del segretario — `home.html`
- "Buongiorno, [Nome]" e "cambia profilo".
- Card in evidenza con la prossima sessione: data, nome, sede, stato e prossimo passo, pulsante "Apri sessione".
- Elenco "Prossime sessioni" con data, nome, concorso e badge di stato.

## P02 I miei concorsi — `concorsi.html`
Rotta attuale: `/bandi` · File: `features/bandi/bandi.component.ts`
- Riga "Dati da Selezioni Online aggiornati alle …" con "Aggiorna ora" (non blocca più la pagina: mostra un avviso con spinner).
- Ricerca, chip filtro (Con sessioni in arrivo / Da completare / Tutti), ordinamento.
- Tabella: Concorso + titolo, Prossima sessione, Sessioni, Configurazione (badge), azioni "Configura" (link) e "Vedi sessioni".
- Paginazione 10/25/50.
- "Non trovi un concorso?" in un accordion al posto del riquadro permessi.

## P03 Sessioni del concorso — `sessioni.html`
Rotta attuale: `/bandi/:id/sessioni` · File: `features/bandi/bandi.component.ts` (o componente sessioni)
- Un solo avviso, specifico e con la soluzione (es. "1 sessione senza esperto remoto").
- Chip: Da oggi in poi / Passate / Tutte; ricerca.
- Tabella: Data e ora (riga di oggi evidenziata con badge "Oggi"), Sessione + sede, Stato (barra 4 fasi + nome stato + prossimo passo), Presenti, "Apri sessione".
- Paginazione.

## P04 Configura bando — `configura-bando.html`
Rotta attuale: `/bandi/:id/config` · File: `features/configurazioni/bando-config.component.ts`
- Indice delle sezioni a sinistra con spunte di completamento.
- Sezioni: Referente (facoltativo, "Invia richiesta al referente" resta un'azione separata perché manda un'email), Segretario e prova, Commissione (tabella, "Rimuovi" come link rosso), Supporto tecnico per sessione (tabella: sessione, esperto remoto, informatico in sede, stato).
- Barra fissa in basso: "N modifiche non salvate", Annulla, **Salva configurazione** (un solo salvataggio).

## P05–P11 Sessione (segretario)
Rotta attuale: `/sessioni/:id` · File: componente sessione + `features/candidati/candidati.component.ts`, `features/dispositivi/dispositivi.component.ts`

Struttura fissa:
- Testata: breadcrumb, titolo, data e sede, badge "Stato: …".
- Colonna principale: **pannello Azioni**, poi **sezione Candidati**.
- Colonna destra: **timeline**, poi **Riferimenti** (segretario, referente, esperto remoto, informatico in sede).
- Chat: pulsante fisso in basso a destra.

Contenuto del pannello Azioni per stato: vedi tabella in `02-flussi-e-stati.md`. Dettagli:
- **P05 Iniziale** (`sessione-prepara`): select esperto remoto (elenco chiuso), nome / email (obbligatoria) / telefono informatico in sede.
- **P05b Configurata** (`sessione-scarica`): testo + "Scarica candidati"; durante lo scaricamento barra e "Non chiudere la pagina".
- **P06 Dispositivi** (`sessione-dispositivi`): QR, "Copia link di collegamento" (il link con il token non è più mostrato per intero), passi numerati, elenco dispositivi che si aggiorna da solo con "Scollega", "Avvia check-in". La pagina dispositivi separata non serve più.
- **P07 Check-in** (`sessione-checkin`): contatore "2 / 4 presenti" con barra, scanner attivi, "Concludi check-in" apre `it-modal` con riepilogo e avviso che non si può riaprire. L'avviso rosso "avviare il check-in prima di scansionare" sparisce.
- **P10 Genera** (`sessione-liste`), **P10b Invia** (`sessione-liste-invia`), **P11 Inviate** (`sessione-liste-inviate`): vedi tabella stati.
- **P12 Chat aperta** (`sessione-chat`): esempio del pannello chat aperto.

## P13 Informatico in sede — `sessione-sede.html`
- Badge "Stai lavorando come Informatico in sede". Nessun pulsante del segretario.
- Azioni: spiega che il reset si chiede dalla riga del candidato e mostra "1 richiesta in attesa" con il link "Vai ai candidati". Azione secondaria: "Collega un dispositivo".
- Candidati (solo presenti): ricerca, filtri In attesa / Reset fatti / Tutti i presenti; colonne Cognome e nome, Reset password, azione (niente colonna utente Moodle: l'utente è sempre nome.cognome) ("Serve reset password" oppure "Annulla richiesta").

## P14 Esperto remoto — `sessione-esperto.html`
- Badge "Stai lavorando come Esperto remoto". Timeline con la fase Esame come propria.
- Azioni (esempio nello stato "Ambiente d'esame pronto"): "Avvia la prova", conteggio "1 reset password da fare" con "Vai ai candidati", nota sulla notifica browser + email, file ricevuti, **Inizia esame**.
- Candidati (solo presenti): stessa tabella dell'informatico; le richieste aperte sono evidenziate in cima con **Segna come fatto**; sulle altre righe "Registra un reset". Non c'è più una card separata delle richieste.

## P08 Sessione su smartphone — `mobile-sessione.html`
- Testata blu compatta con indietro, nome sessione, icona messaggi con badge.
- Badge stato, contatore presenti, **Apri scanner** grande.
- "Mancano N" con ricerca e "Presente" per riga.
- "Concludi check-in…" in outline. Barra in basso: Sessione / Candidati / Messaggi.

## P09 Scanner — `scanner.html`
- Fondo scuro, nome della sessione (non il codice), "Scanner collegato · 2/4 presenti".
- Menu ⋮: "Inserisci codice a mano", "Scollega questo telefono" (sostituisce il pulsante rosso "Elimina sessione").
- Fotocamera a tutto schermo con mirino.
- Risultato in un pannello dal basso: nome, documento, validità; se scaduto, avviso; **Conferma presenza** verde grande; Aggiungi nota / Annulla.

---

## Schermate aggiunte (ruoli, scanner, amministrazione, accesso)

### P15 / P16 Le mie sessioni — `home-esperto.html`, `home-sede.html`
Sostituiscono `/bandi?mode=expert` e `/bandi?mode=sede` come home di esperto remoto e informatico in sede.
- Card "In corso oggi" con stato e badge dei reset (da fare per l'esperto, in attesa per l'informatico), "Apri sessione".
- Tabella paginata delle sessioni assegnate: data, sessione + concorso + sede, stato, colonna reset, "Apri sessione". Chip Da oggi in poi / Passate, ricerca.
- Serve l'API delle sessioni assegnate (`05-backend.md`, punto 12).

### P17 Dashboard referente — `referente.html`
Rotta attuale: `/referenti/bandi` · File: `features/bandi/referente-bandi.component.ts`
- Titolo "I bandi di cui sei referente", riga di aggiornamento da Selezioni Online non bloccante.
- Chip: Da completare (predefinito) / Completi / Tutti; ricerca; paginazione.
- Tabella: Concorso, RDP ("Dato non disponibile" in grigio), Configurazione (badge + elenco: esperto remoto n su m sessioni, informatico in sede n su m, dati del bando, "Manca in: …"), azione "Completa configurazione" (pieno) o "Rivedi" (outline).

### P18–P20 Amministrazione — `admin-permessi.html`, `admin-impostazioni.html`, `admin-log.html`
Rotte attuali: `/admin/permessi`, `/admin/impostazioni`, `/admin/logs` · File: `features/admin/*`
- Area unica con menu a sinistra: Permessi, Impostazioni, Log di sistema, Tutti i bandi (`/bandi?mode=admin`). Breadcrumb "Profili / Amministrazione". In header "Profilo: Amministrazione".
- **Permessi:** sezione "Esperti remoti" (email + "Aggiungi esperto", tabella Email, Ruolo, Aggiunto da, Data, "Rimuovi" come link con conferma). Sezione "Altri ruoli" con select del ruolo. I ruoli si mostrano con il nome leggibile ("Esperto remoto"), non con il codice `esperto_informatico`.
- **Impostazioni:** "Identità dell'app" (nome ente, nome applicazione, sottotitolo, intestazione footer), anteprima dell'intestazione, "Salva impostazioni".
- **Log di sistema:** selettore "Ultimi 200/500/1000" e "Aggiorna"; una scheda per registro con conteggio (Cambi di stato, Email inviate, Errori tecnici); ricerca; date in formato italiano; nome leggibile con il codice tecnico sotto in piccolo (sessione, stato). Stato vuoto con icona.

### P21 Sessione di accesso scaduta — `sessione-scaduta.html`
- Quando l'API risponde 401 `authentication_required` / `reauthentication_required`, invece di reindirizzare subito si mostra un `it-modal` non chiudibile: "La sessione di accesso è scaduta", spiegazione, "Le presenze già registrate sono salvate", pulsante **Accedi di nuovo** che porta a `/login?next=<pagina corrente>` come oggi.
- Da modificare: `core/reauth.interceptor.ts` (mostrare la modale prima di `window.location.assign`).

### P22 Uscita — `uscita.html`
Rotta attuale: `/logged-out` · File: `features/auth/logged-out.component.ts`
- "Sei uscito dall'applicazione", "Per tornare a lavorare accedi con le credenziali CNR", pulsante "Accedi".

### P09a–P09e Scanner — stati
File: `features/scanner/scanner.component.ts`. Stessa struttura di P09: testata scura con nome sessione e stato, fotocamera, pannello dal basso.
- **P09a Collega il telefono** (`scanner-associa`): senza sessione. "Inquadra il QR della sessione", spiegazione di dove trovarlo, nota sul link ricevuto. Sostituisce "Scansiona il QR code della sessione per iniziare".
- **P09b Collegamento** (`scanner-collegamento`): tre riquadri d'esempio, uno per esito: in corso (spinner), non riuscito (motivo + "Scansiona di nuovo il QR"), riuscito ("Telefono collegato" + "Inizia a scansionare"). Sostituisce "Registrazione dispositivo…" e "Registrazione dispositivo non riuscita.".
- **P09c Check-in non avviato** (`scanner-non-avviato`): fotocamera in grigio, "Il check-in non è ancora iniziato", si sblocca da solo quando il segretario avvia. Sostituisce l'errore "Check-in non consentito." per questo caso.
- **P09d Candidato non trovato** (`scanner-non-trovato`): motivo, "Scansiona di nuovo", "Cerca per cognome".
- **P09e Già registrato** (`scanner-gia-registrato`): nome, "Presente dalle 14:07, registrato da un altro telefono", "Scansiona il prossimo".
- P09 (documento scaduto) resta come già disegnato: avviso rosso nel pannello e conferma comunque possibile, come oggi.
