# Piano collaudo stampabile per chiusura spec

Data collaudo: ____________________  
Ambiente: `test` / `produzione` / altro: ____________________  
URL base: `https://test-checkin.concorsi.cnr.it`  
Versione footer: ____________________  
Browser/dispositivo: ____________________  
Collaudatore: ____________________

## Legenda esiti

- `PASS`: comportamento atteso confermato.
- `FAIL`: comportamento diverso dall'atteso, serve fix o analisi.
- `BLOCCATO`: test non eseguibile per dato, utente o servizio esterno mancante.
- `NON TESTATO`: test rimandato.

Per ogni `FAIL` segnare sempre: utente, URL, azione, risultato osservato,
risultato atteso, screenshot/log se disponibili.

## Utenti e dati da preparare

### Utenti minimi

| Codice | Utente da creare/usare | Ruoli/assegnazioni richieste | Note |
|--------|-------------------------|------------------------------|------|
| U0 | Admin globale | Ruolo applicativo `admin` | Serve per supporto e verifica badge vista admin |
| U1 | Segretario operativo | In Selezioni Online deve risultare segretario/membro operativo del bando A | Non usare admin per questo test |
| U2 | Referente/RDP | Deve risultare RDP/referente del bando A, possibilmente non membro commissione | Serve per scheda referenti |
| U3 | Esperto informatico remoto assegnato | Ruolo globale `esperto_informatico`, presente nella lista esperti remoti, assegnato al bando A come `email_esperto_remoto` | Deve vedere solo i propri bandi |
| U4 | Esperto informatico remoto non assegnato | Ruolo globale `esperto_informatico`, presente nella lista esperti, ma NON assegnato al bando A | Serve per test negativo |
| U5 | Informatico in sede assegnato | Email inserita nella configurazione della sessione A1 come `email_informatico_sede` | Non serve ruolo globale dedicato |
| U6 | Utente CNR non assegnato | Nessun ruolo applicativo e nessuna assegnazione su bando/sessione | Serve per test blocco accessi |
| U7 | Vecchio assegnatario opzionale | Ex esperto remoto o ex informatico in sede sostituito dopo configurazione | Serve per test revoca accesso |

### Dati minimi

| Codice | Dato | Configurazione richiesta |
|--------|------|--------------------------|
| Bando A | Bando principale di test | Visibile a U1, referente U2, esperto remoto U3 |
| Sessione A1 | Sessione del bando A | Informatico in sede U5 assegnato |
| Sessione A2 | Seconda sessione del bando A | Informatico in sede diverso da U5 oppure vuoto |
| Bando B | Bando di controllo negativo | Assegnato ad altri utenti, non a U3/U5/U6 |
| Bando C | Bando senza esperto remoto o senza informatico sede | Serve per verificare che nessun non-admin entri |

Prima di iniziare, chiudere tab vecchie del browser o aprire finestra anonima.
Ogni test deve partire da login nuovo, salvo dove indicato diversamente.

## Test preliminari ambiente - Spec 003

| ID | Utente | URL/Azione | Risultato atteso | Esito | Note |
|----|--------|------------|------------------|-------|------|
| 003.1 | Qualsiasi | Aprire `https://test-checkin.concorsi.cnr.it` | La Home Angular si apre, niente Bad Gateway | ____ | ____ |
| 003.2 | U0 | Fare login OIDC | Login completato e nome utente visibile | ____ | ____ |
| 003.3 | U0 | Verificare footer | Versione coerente con deploy atteso | ____ | ____ |
| 003.4 | Tecnico | Verificare health applicativo | `/api/v1/health` risponde OK | ____ | ____ |
| 003.5 | Tecnico | Verificare variabili test | Test usa dominio test e non produzione; `BASE_URL` punta a Selezioni Online corretto | ____ | ____ |
| 003.6 | Tecnico | Verificare produzione | Produzione non e' stata modificata dal deploy test | ____ | ____ |

Decisione 003: `CHIUDERE` / `TENERE APERTA` / `BLOCCATA`  
Motivo: ________________________________________________________________

## Test profili e autorizzazioni - Spec 007

### Home e ingressi profilo

| ID | Utente | Azione | Risultato atteso | Esito | Note |
|----|--------|--------|------------------|-------|------|
| 007.H1 | U1 segretario | Aprire Home | Vede ingresso Segretario, non deve vedere ingressi tecnici se non assegnato | ____ | ____ |
| 007.H2 | U2 referente | Aprire Home | Vede ingresso Referente/RDP se ha bandi assegnati | ____ | ____ |
| 007.H3 | U3 esperto assegnato | Aprire Home | Vede ingresso Esperto informatico remoto | ____ | ____ |
| 007.H4 | U5 sede assegnato | Aprire Home | Vede ingresso Informatico in sede | ____ | ____ |
| 007.H5 | U6 non assegnato | Aprire Home | Non vede profili operativi non assegnati | ____ | ____ |

### Segretario

| ID | Utente | URL/Azione | Risultato atteso | Esito | Note |
|----|--------|------------|------------------|-------|------|
| 007.S1 | U1 | `/bandi?mode=segretario` | Vede solo bandi dove e' segretario operativo, incluso bando A | ____ | ____ |
| 007.S2 | U1 | Aprire bando A, lista sessioni | Vede sessioni del bando A | ____ | ____ |
| 007.S3 | U1 | Premere `Aggiorna da Selezioni Online` | Se Selezioni Online risponde, aggiorna; se va in timeout, mostra cache locale senza perdere dati | ____ | ____ |
| 007.S4 | U1 | Provare URL `/bandi?mode=sede` | Lista vuota o accesso bloccato se U1 non e' informatico sede | ____ | ____ |
| 007.S5 | U1 | Provare URL `/bandi?mode=expert` | Lista vuota o accesso bloccato se U1 non e' esperto remoto | ____ | ____ |

### Referente/RDP

| ID | Utente | URL/Azione | Risultato atteso | Esito | Note |
|----|--------|------------|------------------|-------|------|
| 007.R1 | U2 | `/referenti/bandi` | Vede solo bandi dove e' referente/RDP, incluso bando A | ____ | ____ |
| 007.R2 | U2 | Aprire `Configura bando` dal bando A | Entra in configurazione e `Torna indietro` riporta alla scheda referenti | ____ | ____ |
| 007.R3 | U2 | Salvare configurazione valida | Salvataggio completato, stato bando aggiornato | ____ | ____ |
| 007.R4 | U2 | Tentare accesso a bando B non assegnato tramite link diretto | Accesso negato o messaggio chiaro | ____ | ____ |
| 007.R5 | U2 | Refresh pagina referenti | Non resta appesa; mostra dati locali e sync non distruttiva | ____ | ____ |

### Esperto remoto assegnato

| ID | Utente | URL/Azione | Risultato atteso | Esito | Note |
|----|--------|------------|------------------|-------|------|
| 007.E1 | U3 | `/bandi?mode=expert` | Vede bando A, non vede bando B | ____ | ____ |
| 007.E2 | U3 | Aprire sessioni bando A | Sessioni visibili; nessun errore 500/502 | ____ | ____ |
| 007.E3 | U3 | Aprire gestione sessione bando A | Vede flusso coerente esperto remoto | ____ | ____ |
| 007.E4 | U3 | Aprire link diretto a sessione di bando B | Accesso negato, niente dati operativi | ____ | ____ |
| 007.E5 | U3 | Verificare badge nella lista | Deve dire `Esperto remoto assegnato`, non `Vista admin` | ____ | ____ |
| 007.E6 | U3 | Vedere reset richiesti e segnare/annullare reset eseguito | Operazione riuscita solo sui dati assegnati | ____ | ____ |

### Esperto remoto non assegnato

| ID | Utente | URL/Azione | Risultato atteso | Esito | Note |
|----|--------|------------|------------------|-------|------|
| 007.EN1 | U4 | `/bandi?mode=expert` | Non vede bando A se non assegnato come `email_esperto_remoto` | ____ | ____ |
| 007.EN2 | U4 | Link diretto sessione bando A con `mode=expert` | Accesso negato o messaggio chiaro | ____ | ____ |
| 007.EN3 | U4 | Verificare messaggio | Non deve sembrare errore tecnico generico se e' un blocco autorizzativo | ____ | ____ |

### Informatico in sede assegnato

| ID | Utente | URL/Azione | Risultato atteso | Esito | Note |
|----|--------|------------|------------------|-------|------|
| 007.I1 | U5 | `/bandi?mode=sede` | Vede bando A se ha almeno una sessione assegnata | ____ | ____ |
| 007.I2 | U5 | Aprire sessioni bando A | Vede solo sessione A1, non A2 se non assegnata | ____ | ____ |
| 007.I3 | U5 | Aprire gestione sessione A1 | Entra correttamente in modalita sede | ____ | ____ |
| 007.I4 | U5 | Ricerca/filtri candidati | Funzionano nella sessione assegnata | ____ | ____ |
| 007.I5 | U5 | Segnare/rimuovere richiesta reset password candidato | Operazione riuscita e tracciata | ____ | ____ |
| 007.I6 | U5 | Link diretto sessione A2 non assegnata | Accesso negato o nessun dato operativo | ____ | ____ |

### Informatico in sede non assegnato / utente CNR ordinario

| ID | Utente | URL/Azione | Risultato atteso | Esito | Note |
|----|--------|------------|------------------|-------|------|
| 007.IN1 | U6 | `/bandi?mode=sede` | Non vede dati operativi | ____ | ____ |
| 007.IN2 | U6 | Link diretto sessione A1 con `mode=sede` | Accesso negato | ____ | ____ |
| 007.IN3 | U6 | `/bandi?mode=expert` | Non vede dati operativi | ____ | ____ |
| 007.IN4 | U6 | Link diretto sessione A1 con `mode=expert` | Accesso negato | ____ | ____ |

### Admin globale come supporto

| ID | Utente | URL/Azione | Risultato atteso | Esito | Note |
|----|--------|------------|------------------|-------|------|
| 007.A1 | U0 | `/bandi?mode=admin` | Vede bandi locali con badge `Solo vista admin` dove non operativo | ____ | ____ |
| 007.A2 | U0 | `/bandi?mode=expert` | Vede vista supporto; bandi non assegnati marcati come vista admin | ____ | ____ |
| 007.A3 | U0 | `/bandi?mode=sede` | Vede vista supporto; bandi/sessioni non assegnati marcati come vista admin | ____ | ____ |
| 007.A4 | U0 | Aprire bando dove non e' assegnato | Messaggio `Vista admin di supporto` o equivalente visibile | ____ | ____ |

Decisione 007: `CHIUDERE` / `TENERE APERTA` / `APRIRE FIX`  
Motivo: ________________________________________________________________

## Test configurazione bando e referenti - Spec 004

| ID | Utente | URL/Azione | Risultato atteso | Esito | Note |
|----|--------|------------|------------------|-------|------|
| 004.1 | U1 o U0 | Da bando A aprire `Configura` | La pagina mostra referente/RDP suggerito dai dati istituzionali | ____ | ____ |
| 004.2 | U1 o U0 | Provare a inserire referente manuale non presente in Selezioni Online | Il sistema impedisce o segnala che va corretto in fonte istituzionale | ____ | ____ |
| 004.3 | U2 | Salvare configurazione bando A | Stato diventa `dati compilati` o coerente con dati inseriti | ____ | ____ |
| 004.4 | U2 | Provare a cambiare referente/RDP assegnato | Modifica non consentita senza permesso ulteriore | ____ | ____ |
| 004.5 | U7 vecchio RDP | Dopo cambio RDP in fonte, provare ad accedere | Accesso rifiutato per nuove modifiche | ____ | ____ |

Decisione 004, se inclusa nel giro: `CHIUDERE` / `TENERE APERTA` / `APRIRE FIX`  
Motivo: ________________________________________________________________

## Test cutover Angular e assenza legacy - Spec 006

### Navigazione e deep link

| ID | Utente | URL/Azione | Risultato atteso | Esito | Note |
|----|--------|------------|------------------|-------|------|
| 006.N1 | U1 | Home -> Segretario -> Bando -> Sessioni -> Gestione sessione | Sempre Angular, nessun badge `LEGACY HTML` | ____ | ____ |
| 006.N2 | U2 | Home -> Referente -> Configura bando -> Torna indietro | Torna alla pagina di partenza, non a route fissa sbagliata | ____ | ____ |
| 006.N3 | U3 | Home -> Esperto -> Sessione | Sempre Angular, nessun legacy | ____ | ____ |
| 006.N4 | U5 | Home -> Informatico in sede -> Sessione | Sempre Angular, nessun legacy | ____ | ____ |
| 006.N5 | U0 | Home -> Admin -> Ruoli/Log/Impostazioni | Sempre Angular, refresh non apre HTML legacy | ____ | ____ |
| 006.N6 | U1/U0 | Refresh browser su `/bandi`, `/bandi/<id>/sessioni`, `/sessioni/<id>` | La stessa pagina torna disponibile | ____ | ____ |
| 006.N7 | Logout poi aprire deep link Angular | Dopo login torna alla route Angular corretta | ____ | ____ |

### URL storici legacy da verificare

| ID | Utente | URL storico | Risultato atteso | Esito | Note |
|----|--------|-------------|------------------|-------|------|
| 006.L1 | U1 | `/dashboard/segretario` | Redirect a `/bandi` o nuova route | ____ | ____ |
| 006.L2 | U1 | `/sessioni?commission_id=<BANDO_A>` | Redirect a `/bandi/<BANDO_A>/sessioni` | ____ | ____ |
| 006.L3 | U1 | `/gestione-concorso/<SESSIONE_A1>` | Redirect a `/sessioni/<SESSIONE_A1>` | ____ | ____ |
| 006.L4 | U1 | `/dispositivi/<SESSIONE_A1>` | Redirect a nuova route dispositivi/sessione | ____ | ____ |
| 006.L5 | U1 | Pagina HTML legacy ancora raggiungibile, se presente | Deve mostrare badge `LEGACY HTML` | ____ | ____ |

### Flussi operativi Angular

| ID | Utente | Azione | Risultato atteso | Esito | Note |
|----|--------|--------|------------------|-------|------|
| 006.O1 | U1 | Scaricare/importare candidati per sessione autorizzata | Operazione riuscita oppure errore SOL chiaro, non legacy | ____ | ____ |
| 006.O2 | U1 | Generare liste | Liste generate senza perdere dati | ____ | ____ |
| 006.O3 | U1 | Download XLSX/CSV liste | File scaricato corretto | ____ | ____ |
| 006.O4 | U1 | Inviare liste | Invio completato o errore tecnico chiaro | ____ | ____ |
| 006.O5 | U0/U1 | Registrare dispositivo scanner | Dispositivo associato alla sessione | ____ | ____ |
| 006.O6 | Postazione scanner | Camera legge QR sessione e QR candidato | Check-in completato | ____ | ____ |
| 006.O7 | Postazione scanner | Disassociare dispositivo | Disassociazione completata | ____ | ____ |
| 006.O8 | U0 | Log/notifiche principali | Eventi principali visibili dove previsto | ____ | ____ |

Decisione 006: `CHIUDERE` / `TENERE APERTA` / `APRIRE FIX`  
Motivo: ________________________________________________________________

## Test sessione scaduta e login - Spec 008

| ID | Utente | Azione | Risultato atteso | Esito | Note |
|----|--------|--------|------------------|-------|------|
| 008.1 | U1 | Aprire pagina, lasciare scadere sessione/token, poi premere azione protetta | Richiede nuovo login, non errore generico | ____ | ____ |
| 008.2 | U1 | Dopo login | Torna alla pagina/flusso corretto se ancora autorizzato | ____ | ____ |
| 008.3 | U1 | Token scaduto durante `Scarica candidati` | Messaggio di riautenticazione, non errore SOL generico | ____ | ____ |
| 008.4 | U1 | Sessione valida ma Selezioni Online lento/non raggiungibile | Messaggio parla di servizio esterno/cache, non porta al login | ____ | ____ |
| 008.5 | U1 | Sessione valida ma permesso SOL negato | Messaggio operativo di permesso/abilitazione, non login | ____ | ____ |
| 008.6 | U0/U1 | Più richieste falliscono per sessione scaduta | Un solo comportamento coerente di login, non raffica errori | ____ | ____ |

Decisione 008: `CHIUDERE` / `TENERE APERTA` / `APRIRE FIX`  
Motivo: ________________________________________________________________

## Test Selezioni Online e sincronizzazioni

Questi test possono risultare `BLOCCATO` se l'ambiente test di Selezioni Online
non risponde entro il timeout configurato. Non classificarli automaticamente come
bug applicativo se l'app mostra cache locale e messaggio chiaro.

| ID | Utente | Azione | Risultato atteso | Esito | Note |
|----|--------|--------|------------------|-------|------|
| SOL.1 | U1 | Dashboard segretario, apertura iniziale | Carica dati locali subito, senza aspettare sync remota | ____ | ____ |
| SOL.2 | U1 | Premere `Aggiorna da Selezioni Online` | Attende fino al timeout configurato; se timeout, mostra cache locale | ____ | Timeout letto: ____ |
| SOL.3 | U1 | Pagina sessioni, premere `Aggiorna` | Aggiorna sessioni oppure errore chiaro entro timeout configurato | ____ | Timeout letto: ____ |
| SOL.4 | U2 | Scheda referenti | Mostra dati locali e sync non distruttiva; bandi configurati restano tali | ____ | ____ |
| SOL.5 | Tecnico | Chiedere verifica endpoint test SOL | `cool-jconon.test.si.cnr.it/openapi/v1/call/commissions` analizzato da team SOL | ____ | ____ |
| SOL.6 | Tecnico | Confronto con produzione SOL, se autorizzato | Capire se lentezza e' solo test o anche produzione | ____ | ____ |

Variabili backend utili:

- `COMMISSIONI_SYNC_READ_TIMEOUT`: timeout lettura sync commissioni.
- `SESSIONI_SYNC_READ_TIMEOUT`: timeout lettura sync sessioni.

## Matrice finale

| Spec | Esito finale | Motivazione | Fix/task da aprire |
|------|--------------|-------------|--------------------|
| 003 Coolify/test |  |  |  |
| 004 Referente/RDP |  |  |  |
| 006 Cutover Angular |  |  |  |
| 007 Profili informatici |  |  |  |
| 008 Sessione scaduta |  |  |  |

Valori ammessi: `CHIUDERE`, `TENERE APERTA`, `APRIRE FIX`,
`BLOCCATA DA DATO ESTERNO`.

## Riepilogo anomalie da riportare

| ID test | Utente | URL | Errore/messaggio visto | Screenshot/log | Classificazione |
|---------|--------|-----|------------------------|----------------|-----------------|
|  |  |  |  |  | bug applicativo / dato errato / Selezioni Online / sessione scaduta |
|  |  |  |  |  | bug applicativo / dato errato / Selezioni Online / sessione scaduta |
|  |  |  |  |  | bug applicativo / dato errato / Selezioni Online / sessione scaduta |
