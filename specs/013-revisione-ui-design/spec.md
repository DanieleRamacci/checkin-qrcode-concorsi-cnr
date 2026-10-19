# Feature Specification: Revisione dell'interfaccia guidata dal "prossimo passo"

**Feature Branch**: `013-revisione-ui-design`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Revisione dell'interfaccia grafica secondo la proposta di Claude Design (tela <https://claude.ai/artifact/1nX76seaTxbPUQo4iL7Bc2>, pagina "Proposta (Bootstrap Italia)"), restando su Bootstrap Italia / design-angular-kit e senza cambiare la macchina a stati della sessione."

Riferimento visivo: pacchetto di consegna
[docs/design-revisione](../../docs/design-revisione/README.md), aggiornato al
19/10/2026: schede delle schermate P01–P22 e P09a–P09e in `04-schermate.md`,
prototipo navigabile in `prototipo/`, 30 screenshot in `screenshot/`, foglio
`stili/proposta.css`. I codici P01…P22 sono i titoli delle tavole sulla tela.
Le schede sono la fonte per gerarchia, testi e disposizione; questa spec fissa
cosa deve valere qualunque sia il dettaglio grafico finale.

## Contesto

L'applicativo serve a gestire il check-in in presenza dei candidati ai
concorsi CNR ed estrarre la lista dei presenti. Lo usano persone che fanno
poche sessioni l'anno, spesso con candidati in fila. Il collaudo (feature 011)
e la revisione delle schermate hanno mostrato che oggi la pagina della sessione
mette insieme troppe informazioni, che il "prossimo passo" non è evidente e che
avvisi tecnici e codici di stato competono per l'attenzione.

Principi della proposta (`01-principi.md`):

1. un solo pulsante principale per stato, nel pannello "Azioni · cosa fare
   adesso";
2. quattro fasi al posto di dodici stati per il segretario;
3. avvisi solo dove bloccano un'azione, accanto all'azione;
4. meno fasce e colonne: header unico, testata della sessione al posto della
   barra laterale, chat in un pannello apribile;
5. numeri prima delle tabelle: contatori che fanno anche da filtri;
6. tutto nella sessione: QR e dispositivi dentro la pagina della sessione;
7. ogni ruolo vede le sue azioni, con la propria home.

## Clarifications

### Session 2026-10-19

- Decisioni ereditate e non da riprogettare: esperto remoto e informatico in
  sede restano obbligatori nella configurazione della sessione; dopo "Invia
  liste" il segretario non ha altre azioni; ordine e logica degli stati restano
  invariati.
- Q: L'informatico in sede deve poter fare da riserva al segretario? → A: Sì.
  La sua azione principale resta il reset password; sotto ha una sezione
  secondaria "Azioni del segretario", chiusa per impostazione predefinita, con
  il prossimo passo del segretario per lo stato corrente, esclusi configurazione
  e scarico candidati (matrice della feature 014). Le azioni eseguite così
  risultano nella timeline con il ruolo di chi le ha fatte. Questa decisione
  prevale sulla scheda P13, che non mostra pulsanti del segretario.
- Q: Nella ricerca manuale dello scanner cosa si scrive e cosa si vede? → A: Nome
  e cognome (in qualunque ordine, anche solo il cognome) o numero di documento;
  i risultati mostrano cognome, nome e numero di documento. Copre sia "Inserisci
  codice a mano" (P09) sia "Cerca per cognome" (P09d), che il pacchetto segna
  ancora come da confermare.
- Aggiornamento del pacchetto di consegna (19/10/2026), recepito:
  - il reset password si gestisce solo nella tabella dei presenti, con lo stato
    sulla riga; non esiste un elenco separato delle richieste;
  - per ogni nuova richiesta di reset l'esperto remoto riceve anche un'email,
    oltre alla notifica nel browser;
  - schermate nuove in ambito: stati dello scanner (P09a–P09e), "Le mie
    sessioni" per informatico in sede ed esperto remoto (P15, P16), dashboard
    referente (P17), area Amministrazione (P18–P20), sessione di accesso scaduta
    (P21), pagina di uscita (P22);
  - nessuna colonna "Utente Moodle": l'utente Moodle è sempre nome.cognome.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Il segretario sa sempre cosa fare adesso nella sessione (Priority: P1)

Il segretario apre una sessione e trova in cima il pannello "Azioni · cosa fare
adesso" con un'istruzione, una frase di contesto e un solo pulsante principale
adatto allo stato corrente: scegliere esperto e informatico, scaricare i
candidati, collegare gli smartphone e avviare il check-in, registrare le
presenze e concludere, generare le liste, inviarle. Sopra vede la testata della
sessione con lo stato; a destra la timeline delle quattro fasi con l'ora di
ogni passaggio; sotto, l'elenco dei candidati sempre nello stesso posto. Quando
ha inviato le liste legge "Hai finito la tua parte" e continua a poter
scaricare i file.

**Why this priority**: è la schermata dove si concentra il lavoro in aula e dove
il collaudo ha trovato i problemi principali; da sola rende l'applicativo usabile
da chi lo usa di rado.

**Independent Test**: portare una sessione di test da "Sessione creata" a
"Liste inviate" con un segretario alla prima esperienza, senza istruzioni,
verificando in ogni stato la presenza di una sola azione principale.

**Acceptance Scenarios**:

1. **Given** una sessione in qualunque stato, **When** il segretario la apre,
   **Then** vede una sola azione principale in evidenza, coerente con lo stato,
   visibile senza scorrere su uno schermo di 1280×800.
2. **Given** una sessione nella fase di preparazione, **When** il segretario
   collega uno smartphone, **Then** QR, istruzioni e dispositivi collegati sono
   nella stessa pagina della sessione, senza passare da una pagina separata.
3. **Given** il check-in avviato, **When** il segretario guarda il pannello
   azioni, **Then** vede presenti/totale, scanner attivi e "Concludi check-in",
   che chiede conferma indicando quanti candidati risulteranno assenti e che
   dopo non si potranno registrare presenze.
4. **Given** "Genera liste" in corso, **When** l'operazione dura alcuni secondi,
   **Then** il pannello stesso mostra l'avanzamento e "Non chiudere la pagina".
5. **Given** liste inviate o qualunque stato successivo, **When** il segretario
   apre la sessione, **Then** legge che non ha altre azioni e può scaricare
   XLSX presenti e CSV Moodle.
6. **Given** lo stato "Ambiente d'esame pronto", **When** il segretario è sulla
   sessione, **Then** riceve un avviso esplicito che l'esperto remoto ha
   preparato l'ambiente d'esame.
7. **Given** la sessione non ancora in check-in, **When** il segretario o uno
   scanner provano a registrare una presenza, **Then** l'indicazione di avviare
   prima il check-in compare accanto all'azione bloccata.

---

### User Story 2 - Check-in rapido da smartphone (Priority: P1)

Un operatore collega il telefono alla sessione inquadrando il QR, poi usa lo
scanner: inquadra il QR della domanda, vede la scheda del candidato con l'esito
del documento e conferma la presenza; se serve aggiunge una nota o cerca il
candidato a mano. Lo scanner spiega con chiarezza i casi particolari (check-in
non ancora avviato, candidato non trovato, già registrato) e si sblocca da solo
quando il segretario avvia il check-in. Dalla pagina della sessione su
smartphone vede presenti/totale, chi manca con un pulsante "Presente" e i
messaggi.

**Why this priority**: è il punto di contatto con la fila dei candidati; ogni
secondo e ogni tocco risparmiato contano.

**Independent Test**: collegare un telefono, aprirlo prima dell'avvio del
check-in, avviare il check-in dal PC e registrare quattro presenze, una con
documento scaduto e nota, una trovata con la ricerca manuale, una già
registrata da un altro dispositivo.

**Acceptance Scenarios**:

1. **Given** un telefono senza sessione, **When** l'operatore apre lo scanner,
   **Then** vede come collegarlo inquadrando il QR della sessione, e l'esito del
   collegamento (in corso, non riuscito con motivo, riuscito).
2. **Given** lo scanner collegato prima dell'avvio del check-in, **When** il
   segretario avvia il check-in, **Then** lo scanner passa da "Il check-in non è
   ancora iniziato" a pronto senza azioni dell'operatore.
3. **Given** lo scanner in check-in, **When** l'operatore inquadra un QR valido,
   **Then** vede nome, documento, validità e "Conferma presenza" ampio; la
   presenza si registra con un tocco.
4. **Given** un candidato con documento scaduto, **When** compare la scheda,
   **Then** l'avviso è evidente, la conferma resta possibile e si può aggiungere
   una nota.
5. **Given** un QR illeggibile o un candidato non trovato, **When** l'operatore
   sceglie la ricerca manuale e scrive nome e cognome o il numero di documento,
   **Then** vede i candidati corrispondenti con il numero di documento, sceglie
   quello giusto e ne registra la presenza.
6. **Given** un candidato già presente, **When** viene inquadrato di nuovo,
   **Then** lo scanner indica da che ora è presente e se è stato registrato da
   scanner o da tabella, e propone di passare al prossimo.
7. **Given** la pagina sessione su smartphone, **When** l'operatore la apre,
   **Then** la pagina non scorre in orizzontale e mostra schede Sessione,
   Candidati, Messaggi con il numero di messaggi non letti.

---

### User Story 3 - Trovare subito la propria sessione (Priority: P2)

Dopo il login l'utente sceglie il profilo con cui lavorare tra quelli che ha
davvero (chi ne ha uno solo entra direttamente). Il segretario arriva su una
home con "La tua prossima sessione" e le prossime sessioni; da "I miei
concorsi" e dall'elenco delle sessioni capisce a colpo d'occhio a che punto è
ogni sessione e quanti sono i presenti.

**Why this priority**: riduce i passaggi per arrivare in aula, ma il lavoro
vero resta nella sessione (US1).

**Independent Test**: con un utente che ha due profili e un utente con un solo
profilo, verificare la scelta profilo, la home e gli elenchi paginati con
filtri.

**Acceptance Scenarios**:

1. **Given** un utente con un solo profilo, **When** fa login, **Then** entra
   direttamente nella home di quel profilo.
2. **Given** un utente con più profili, **When** fa login, **Then** vede solo le
   card dei profili che ha e può cambiare profilo in qualunque momento
   dall'header.
3. **Given** un segretario con sessioni in arrivo, **When** apre la home,
   **Then** vede in evidenza la prossima sessione con stato e prossimo passo e
   un pulsante "Apri sessione".
4. **Given** molti concorsi o molte sessioni, **When** l'utente apre gli
   elenchi, **Then** sono paginati, ricercabili e filtrabili, e ogni sessione
   mostra fase, stato, prossimo passo e presenti/totale.

---

### User Story 4 - Informatico in sede ed esperto remoto: la propria home e il reset dalla tabella (Priority: P2)

L'informatico in sede e l'esperto remoto entrano in "Le mie sessioni", con la
sessione di oggi in evidenza e i reset aperti. Nella sessione il reset password
si gestisce solo nella tabella dei presenti: l'informatico preme "Serve reset
password" sulla riga, la riga sale in cima come "Reset richiesto" e l'esperto
riceve notifica nel browser ed email; l'esperto preme "Segna come fatto" e
entrambi vedono "Reset fatto" con l'orario. Il pannello azioni dell'informatico
spiega come chiedere un reset e quante richieste sono in attesa; sotto ha la
sezione "Azioni del segretario" per fare da riserva. Il pannello dell'esperto
mostra il passo d'esame corrente, i file ricevuti e quanti reset sono da fare.

**Why this priority**: oggi l'informatico in sede vede gli stessi pulsanti del
segretario allo stesso livello dei suoi e i reset sono in un elenco separato;
riunire tutto nella tabella e dare a ciascuno la propria home riduce errori,
ma non blocca il check-in.

**Independent Test**: con un informatico in sede chiedere un reset dalla riga
del candidato e avviare il check-in dalla sezione "Azioni del segretario"; con
l'esperto remoto ricevere l'email, segnare il reset come fatto; verificare le
due home, la timeline e il ruolo registrato.

**Acceptance Scenarios**:

1. **Given** un informatico in sede o un esperto remoto, **When** entrano nel
   loro profilo, **Then** vedono "Le mie sessioni" con la sessione di oggi in
   evidenza, lo stato e il numero di reset aperti.
2. **Given** un informatico in sede su una sessione, **When** la apre, **Then**
   il pannello spiega come chiedere un reset dalla tabella e mostra le richieste
   in attesa; i pulsanti del segretario sono solo nella sezione "Azioni del
   segretario", chiusa.
3. **Given** l'informatico che preme "Serve reset password" su un presente,
   **When** l'esperto remoto guarda la sessione, **Then** la riga è in cima
   evidenziata con "Segna come fatto", il conteggio nel pannello è aggiornato e
   l'esperto ha ricevuto un'email.
4. **Given** l'esperto che segna il reset come fatto, **When** l'informatico
   guarda la tabella, **Then** vede "Reset fatto" con l'orario senza ricaricare.
5. **Given** l'informatico in sede che avvia il check-in dalla sezione "Azioni
   del segretario", **When** il segretario guarda la timeline, **Then** vede
   l'ora del passaggio e che l'ha eseguito l'informatico in sede.

---

### User Story 5 - Referente: i miei bandi e la configurazione (Priority: P3)

Il referente apre "I bandi di cui sei referente" e vede subito quelli da
completare, con cosa manca e in quali sessioni; da lì apre "Configura bando",
che ha un indice delle sezioni con lo stato di completamento, i campi marcati
come "Facoltativo" o "Obbligatorio", una tabella del supporto tecnico per
sessione e un unico pulsante di salvataggio sempre raggiungibile.

**Why this priority**: la configurazione si fa una volta per bando e il
segretario può completarla da sé; utile ma non critica in aula.

**Independent Test**: con un referente di due bandi, uno completo e uno no,
verificare filtri e azioni della dashboard; configurare il bando incompleto
lasciando vuoto un campo facoltativo.

**Acceptance Scenarios**:

1. **Given** un referente, **When** apre la dashboard, **Then** vede per
   impostazione predefinita i bandi da completare, con esperto remoto e
   informatico in sede "n su m sessioni", dati del bando e "Manca in: …".
2. **Given** un bando con sessioni senza esperto remoto, **When** il referente
   apre la configurazione, **Then** l'indice segnala quante sessioni sono da
   completare.
3. **Given** modifiche in più sezioni, **When** il referente salva, **Then** un
   solo salvataggio registra tutto e la barra indica se ci sono modifiche non
   salvate.

---

### User Story 6 - Chat interna che non ingombra (Priority: P3)

Ogni profilo apre la chat da un pulsante fisso con il numero di messaggi non
letti; la chat si apre in un pannello sopra la pagina, mostra chi scrive con il
nome del ruolo, offre risposte rapide e non contiene più i cambi di stato, che
restano nella timeline.

**Why this priority**: migliora la comunicazione, ma l'applicativo funziona
anche senza.

**Independent Test**: scambiare messaggi tra segretario, informatico in sede ed
esperto remoto su una sessione e verificare badge, risposte rapide e assenza di
codici tecnici.

**Acceptance Scenarios**:

1. **Given** un nuovo messaggio, **When** il pannello è chiuso, **Then** il
   pulsante mostra il numero di non letti.
2. **Given** il pannello aperto, **When** l'utente sceglie una risposta rapida,
   **Then** il messaggio viene inviato a tutti i partecipanti della sessione.
3. **Given** un cambio di stato della sessione, **When** si apre la chat,
   **Then** non compare un messaggio con il codice tecnico dello stato.

---

### User Story 7 - Area Amministrazione (Priority: P3)

L'amministratore entra in un'area unica con menu laterale: Permessi, Impostazioni,
Log di sistema e Tutti i bandi. Nei permessi gestisce gli esperti remoti e gli
altri ruoli con nomi leggibili; nelle impostazioni vede l'anteprima
dell'intestazione; nei log filtra per registro, cerca e legge date e stati in
forma leggibile.

**Why this priority**: lo usa una persona sola e già oggi funziona; il valore è
coerenza e leggibilità.

**Independent Test**: con un amministratore aggiungere e rimuovere un esperto
remoto, modificare il nome dell'applicazione vedendo l'anteprima, consultare i
log dei cambi di stato.

**Acceptance Scenarios**:

1. **Given** l'area Amministrazione, **When** l'amministratore apre Permessi,
   **Then** vede gli esperti remoti e gli altri ruoli con nome leggibile (mai il
   codice tecnico) e la rimozione chiede conferma.
2. **Given** i log, **When** l'amministratore sceglie "Ultimi 500" e un
   registro, **Then** vede il conteggio per registro, date in formato italiano e
   nomi leggibili con il codice tecnico solo come dettaglio.

---

### User Story 8 - Accesso scaduto e uscita senza sorprese (Priority: P3)

Quando la sessione di accesso scade mentre l'utente lavora, compare un avviso
che spiega cosa è successo e rassicura che le presenze già registrate sono
salvate; "Accedi di nuovo" riporta alla stessa pagina dopo il login. Dopo il
logout l'utente vede una pagina di uscita chiara.

**Why this priority**: oggi il reindirizzamento improvviso disorienta, ma non fa
perdere dati.

**Independent Test**: far scadere la sessione di accesso durante il check-in e
verificare avviso, rientro e dati; fare logout e verificare la pagina di uscita.

**Acceptance Scenarios**:

1. **Given** una sessione di accesso scaduta, **When** l'applicativo riceve la
   risposta di autenticazione scaduta, **Then** mostra un avviso non chiudibile
   con "Accedi di nuovo", e dopo il login l'utente torna alla pagina in cui era.
2. **Given** il logout, **When** l'utente esce, **Then** vede "Sei uscito
   dall'applicazione" con il pulsante "Accedi".

---

### Edge Cases

- Sessione con molti candidati (oltre 100): tabella paginata (25 per pagina),
  ricerca e contatori sempre in cima.
- Operazione lunga interrotta da ricarica o chiusura pagina: al rientro il
  pannello mostra lo stato reale (operazione completata o da ripetere) come oggi.
- Nessun dispositivo collegato: il pannello spiega come collegarne uno; la
  registrazione dalla tabella resta disponibile a check-in avviato.
- Presenza registrata per errore: resta possibile annullarla durante il
  check-in, con un'azione secondaria e conferma.
- Scanner aperto a check-in concluso: indica che il check-in è concluso e non
  propone la conferma.
- Reset chiesto e poi annullato dall'informatico prima che l'esperto lo veda:
  la riga torna normale; l'email già inviata non viene ritirata.
- Invio dell'email di reset non riuscito: la richiesta resta valida e visibile
  nella tabella; l'errore è registrato nei log email.
- Utente senza alcun profilo operativo: messaggio chiaro su chi contattare,
  nessuna card vuota.
- Concorso le cui sessioni non sono mai state scaricate: la home e "I miei
  concorsi" indicano "sessioni non ancora scaricate" con il collegamento per
  aprirle.
- Utente amministratore che apre una sessione non sua: la testata indica la
  vista di supporto.
- Invio email delle liste fallito: il pannello di "Liste inviate" lo dice in
  modo stabile anche dopo ricarica, e i file restano scaricabili.
- Sessione di accesso scaduta durante un'operazione lunga: l'avviso compare al
  termine della risposta; nessuna operazione già confermata viene persa.
- Schermo stretto (390px): nessuna pagina scorre in orizzontale; le tabelle
  larghe diventano elenchi o scorrono nel proprio riquadro.

## Requirements *(mandatory)*

### Functional Requirements

#### Comuni

- **FR-001**: Ogni pagina MUST avere un'unica fascia di intestazione con nome
  del servizio, navigazione principale del profilo attivo, profilo attivo con
  accesso al cambio profilo e utente.
- **FR-002**: L'interfaccia MUST usare il linguaggio unico di
  `01-principi.md`: "I miei concorsi", "Sessione", "Apri sessione", "Vedi
  sessioni", "Configura bando", "Esperto remoto", "Scollega questo telefono";
  campi marcati "Facoltativo" o "Obbligatorio".
- **FR-003**: Nessun codice tecnico di stato o di ruolo MUST comparire agli
  utenti come testo principale; gli stati si mostrano con le etichette: Sessione
  creata, Configurata, Candidati scaricati, Dispositivi collegati, Check-in
  avviato, Check-in concluso, Liste generate, Liste inviate, Presenti caricati su
  Moodle, Ambiente d'esame pronto, Esame in corso, Esame concluso; i ruoli con
  nomi leggibili (per esempio "Esperto remoto" e non `esperto_informatico`).
- **FR-004**: Gli avvisi MUST comparire accanto all'azione che bloccano;
  non sono ammessi banner fissi in cima che non riguardano l'azione corrente.
- **FR-005**: Le schermate rivisitate MUST rispettare WCAG 2.1 AA e le linee
  guida AgID, e usare i componenti del design system della PA già adottato.
- **FR-006**: Ogni pagina MUST funzionare a 390px di larghezza senza scorrimento
  orizzontale della pagina.

#### Pagina sessione (segretario)

- **FR-007**: La pagina sessione MUST mostrare una testata con nome, data, luogo,
  concorso e stato corrente, e una timeline con quattro fasi: Preparazione
  (Sessione creata, Configurata, Candidati scaricati, Dispositivi collegati),
  Check-in (Check-in avviato, Check-in concluso), Liste (Liste generate, Liste
  inviate), Esame a cura dell'esperto remoto (Presenti caricati su Moodle,
  Ambiente d'esame pronto, Esame in corso, Esame concluso).
- **FR-008**: In ogni stato la pagina MUST mostrare il pannello "Azioni · cosa
  fare adesso" con un solo pulsante principale; le altre azioni sono secondarie.
- **FR-009**: Collegamento dispositivi (QR, istruzioni, elenco dei dispositivi
  con stato e possibilità di scollegarli) MUST essere disponibile dentro la
  pagina sessione.
- **FR-010**: Durante il check-in la pagina MUST mostrare contatori presenti /
  totale, da registrare e documenti scaduti, che fungono anche da filtri
  dell'elenco candidati.
- **FR-011**: "Concludi check-in" MUST chiedere conferma indicando il numero di
  presenti e di assenti e l'irreversibilità dell'operazione.
- **FR-012**: Le operazioni lunghe (scarica candidati, genera liste, invia
  liste, sincronizzazioni) MUST mostrare l'avanzamento nel pannello azioni con
  l'indicazione di non chiudere la pagina.
- **FR-013**: I file delle liste MUST restare scaricabili in tutti gli stati da
  "Liste generate" a "Esame concluso".
- **FR-014**: Da "Liste inviate" in poi il pannello MUST dire al segretario che
  non ha altre azioni; nello stato "Ambiente d'esame pronto" MUST mostrare un
  avviso esplicito.
- **FR-015**: L'elenco candidati MUST restare nella stessa posizione in tutti gli
  stati, vuoto con il messaggio del passo successivo prima dello scarico, in
  sola lettura quando il check-in non è avviato, paginato oltre 25 righe.
- **FR-016**: Per ogni presenza il sistema MUST registrare e mostrare ora e
  origine (scanner o tabella); annullare una presenza durante il check-in MUST
  restare possibile con un'azione secondaria e conferma.
- **FR-017**: Le note sul candidato MUST restare disponibili dall'elenco e dalla
  scheda dello scanner.

#### Smartphone e scanner

- **FR-018**: La pagina sessione su smartphone MUST offrire schede Sessione,
  Candidati e Messaggi, il contatore presenti / totale, l'elenco dei candidati
  da registrare con un pulsante "Presente" e l'accesso diretto allo scanner.
- **FR-019**: Lo scanner MUST mostrare il nome della sessione collegata (non il
  codice) e presenti / totale, e dopo la lettura una scheda con nome, documento
  e validità, "Conferma presenza" in evidenza, "Aggiungi nota" e "Annulla"; con
  documento scaduto mostra l'avviso e lascia possibile la conferma.
- **FR-020**: Lo scanner MUST permettere di cercare il candidato scrivendo nome e
  cognome (anche solo il cognome) o il numero di documento; i risultati MUST
  mostrare nome, cognome e numero di documento, e dalla scelta si apre la stessa
  scheda della lettura del QR. Lo scanner MUST permettere anche di scollegare il
  telefono dalla sessione.
- **FR-038**: Lo scanner MUST mostrare in modo dedicato: telefono non collegato
  (come collegarlo), collegamento in corso, non riuscito con motivo, riuscito;
  check-in non ancora iniziato, sbloccandosi da solo quando il check-in viene
  avviato; check-in concluso; candidato non trovato con "Scansiona di nuovo" e
  ricerca manuale; candidato già presente con ora e origine della presenza e
  "Scansiona il prossimo".

#### Navigazione ed elenchi

- **FR-021**: Dopo il login il sistema MUST proporre la scelta tra i soli profili
  dell'utente; con un solo profilo MUST portare direttamente alla sua home.
- **FR-022**: La home del segretario MUST mostrare la prossima sessione tra tutti
  i suoi concorsi, con stato, prossimo passo e "Apri sessione", e l'elenco delle
  prossime sessioni.
- **FR-023**: "I miei concorsi" MUST essere paginato (10, 25 o 50 per pagina),
  ricercabile, filtrabile e mostrare per ogni concorso prossima sessione,
  numero di sessioni e stato della configurazione.
- **FR-024**: L'elenco delle sessioni di un concorso MUST essere paginato e
  mostrare per ogni sessione data, fase, stato, prossimo passo e presenti /
  totale; problemi di configurazione si mostrano come un unico avviso con la
  soluzione.
- **FR-039**: La navigazione dell'header MUST dipendere dal profilo attivo:
  segretario (Home, I miei concorsi, Scanner), informatico in sede ed esperto
  remoto (Home, Le mie sessioni, Scanner per l'informatico), referente (Home,
  I bandi di cui sei referente), amministratore (Home, Amministrazione).

#### Profili tecnici

- **FR-025**: Il pannello azioni dell'informatico in sede MUST spiegare che il
  reset si chiede dalla riga del candidato, mostrare il numero di richieste in
  attesa con il collegamento alla tabella e offrire "Collega un dispositivo"
  come azione secondaria. I pulsanti del segretario MUST comparire solo in una
  sezione secondaria "Azioni del segretario", chiusa per impostazione
  predefinita, con il prossimo passo del segretario per lo stato corrente,
  esclusi configurazione della sessione e scarico dei candidati; le azioni
  dell'esperto remoto MUST NOT comparire. I permessi effettivi sono quelli della
  matrice della feature 014.
- **FR-026**: Il pannello azioni dell'esperto remoto MUST avere come azione
  principale il passo d'esame corrente, mostrare i file ricevuti e il numero di
  reset da fare con il collegamento alla tabella, e un segnale di novità quando
  arriva una richiesta.
- **FR-027**: Nelle viste tecniche l'elenco candidati MUST mostrare solo i
  presenti, con lo stato del reset sulla riga (richiesto da chi e a che ora,
  fatto a che ora), le richieste aperte in cima ed evidenziate, filtri In attesa
  (o Da fare) / Reset fatti / Tutti i presenti; azioni sulla riga: "Serve reset
  password" e "Annulla richiesta" per l'informatico, "Segna come fatto" e
  "Registra un reset" per l'esperto. Non esiste un elenco separato delle
  richieste.
- **FR-032**: Per ogni nuova richiesta di reset il sistema MUST inviare un'email
  all'esperto remoto assegnato alla sessione, con sessione e candidato, oltre
  alla notifica nel browser; il mancato invio non blocca la richiesta ed è
  registrato nei log email.
- **FR-033**: Informatico in sede ed esperto remoto MUST avere come home "Le mie
  sessioni": sessione di oggi in evidenza con stato e reset aperti (in attesa per
  l'informatico, da fare per l'esperto) e "Apri sessione" (con più sessioni oggi
  tutte, in ordine di ora; con nessuna oggi la prossima in arrivo; senza
  sessioni future uno stato vuoto); tabella paginata delle
  sessioni assegnate con data, sessione, concorso, sede, stato, reset aperti;
  filtri Da oggi in poi / Passate e ricerca.

#### Referente e configurazione bando

- **FR-028**: "Configura bando" MUST avere un indice delle sezioni con stato di
  completamento, una tabella del supporto tecnico per sessione (esperto remoto,
  informatico in sede, stato) e un unico salvataggio con indicazione delle
  modifiche non salvate.
- **FR-034**: La dashboard referente MUST mostrare i bandi di cui l'utente è RDP
  o referente con filtri Da completare (predefinito) / Completi / Tutti, ricerca,
  paginazione, aggiornamento da Selezioni Online non bloccante, e per ogni bando
  RDP, stato della configurazione con esperto remoto e informatico in sede "n su
  m sessioni", dati del bando, "Manca in: …", e l'azione "Completa
  configurazione" o "Rivedi".

#### Chat interna

- **FR-029**: La chat MUST aprirsi da un pulsante fisso con il numero di non
  letti, in un pannello che non sposta la pagina, mostrando il ruolo di chi
  scrive con le etichette Segretario, Esperto remoto, Informatico in sede.
- **FR-030**: La chat MUST offrire risposte rapide e inviare i messaggi a tutti i
  partecipanti della sessione; i cambi di stato MUST comparire nella timeline e
  non come messaggi.
- **FR-031**: La timeline della sessione MUST mostrare per ogni passaggio
  completato l'ora e il ruolo di chi l'ha eseguito (Segretario, Informatico in
  sede, Esperto remoto, Amministratore); il pannello azioni MUST poter indicare
  da quando è iniziata la fase corrente (per esempio "Check-in in corso dalle
  14:05").

#### Amministrazione, accesso e uscita

- **FR-035**: L'area Amministrazione MUST riunire Permessi, Impostazioni, Log di
  sistema e Tutti i bandi con un menu laterale; i permessi distinguono esperti
  remoti e altri ruoli, con nomi leggibili e conferma alla rimozione; le
  impostazioni mostrano l'anteprima dell'intestazione; i log offrono 200 / 500 /
  1000 record, schede per registro con conteggio, ricerca, date in formato
  italiano e nomi leggibili con il codice tecnico come dettaglio.
- **FR-036**: Alla scadenza della sessione di accesso il sistema MUST mostrare
  un avviso non chiudibile con spiegazione, la rassicurazione che le presenze
  già registrate sono salvate e "Accedi di nuovo", che riporta alla pagina
  corrente dopo il login.
- **FR-037**: Dopo il logout il sistema MUST mostrare la pagina "Sei uscito
  dall'applicazione" con il pulsante "Accedi".

### Key Entities

- **Fase della sessione**: raggruppamento per il segretario dei dodici stati in
  quattro fasi; puramente di presentazione, non cambia gli stati.
- **Prossimo passo**: l'azione principale associata a ogni stato e profilo, con
  testo, contesto e pulsante.
- **Presenza**: registrazione del check-in di un candidato, con ora e origine
  (scanner o tabella).
- **Stato del reset sul candidato presente**: richiesto (da chi, a che ora),
  fatto (a che ora); un candidato ha al più una richiesta aperta.
- **Sessione assegnata**: sessione in cui l'utente è informatico in sede o
  esperto remoto, con stato e numero di reset aperti.
- **Messaggio di sessione**: testo scritto da un partecipante, con ruolo e ora;
  le risposte rapide sono testi predefiniti.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In una prova con almeno 3 segretari che non hanno mai usato la
  nuova interfaccia, il 90% individua il prossimo passo in ogni stato entro 5
  secondi, senza aiuto.
- **SC-002**: Un segretario alla prima esperienza porta una sessione di prova
  con 4 candidati da "Sessione creata" a "Liste inviate" in meno di 15 minuti,
  senza assistenza.
- **SC-003**: In tutti i 12 stati la pagina sessione del segretario presenta
  esattamente un'azione principale.
- **SC-004**: Con lo scanner, registrare una presenza richiede al massimo un
  tocco dopo la lettura del QR; lo scanner aperto prima dell'avvio si sblocca
  entro 10 secondi dall'avvio del check-in.
- **SC-005**: Zero codici tecnici di stato visibili in chat, timeline ed elenchi.
- **SC-006**: I file delle liste sono scaricabili nel 100% degli stati da
  "Liste generate" a "Esame concluso".
- **SC-007**: Nessuna schermata rivisitata produce scorrimento orizzontale della
  pagina a 390px; il pannello azioni è visibile senza scorrere a 1280×800.
- **SC-008**: Le schermate rivisitate superano le verifiche di accessibilità
  senza errori bloccanti, con contrasto del testo di almeno 4.5:1.
- **SC-009**: Nel collaudo il 100% delle richieste di reset genera un'email
  all'esperto remoto registrata nei log email, e la richiesta compare in cima
  alla sua tabella entro 10 secondi.
- **SC-010**: Alla scadenza della sessione di accesso, nel 100% delle prove
  l'utente vede l'avviso prima del login e torna alla stessa pagina senza perdere
  presenze già registrate.

## Assumptions

- Il pacchetto di consegna è il riferimento per gerarchia, testi e
  disposizione; dettagli grafici minori possono essere affinati nel piano senza
  aggiornare la spec.
- La consegna è incrementale per user story (prima US1 e US2), come richiesto
  dalla constitution; schermate vecchie e nuove possono convivere durante il
  passaggio.
- Le schermate che il pacchetto segna ancora come da disegnare (dettaglio bando,
  finestre note e QR del candidato, area personale, chat su smartphone oltre al
  pannello a tutto schermo, testi definitivi delle email, menu dell'header per i
  profili diversi dal segretario) mantengono il comportamento attuale con stili
  e linguaggio comuni; per il menu dell'header vale FR-039 come scelta
  provvisoria.
- Nessuna colonna "Utente Moodle": l'utente Moodle è sempre nome.cognome.
- La chat continua a inviare a tutti i partecipanti della sessione; i ruoli in
  testa al pannello indicano chi partecipa, non selezionano destinatari.
- La home del segretario usa le sessioni già presenti localmente: l'elenco dei
  concorsi dell'utente le collega già (oggi ne espone solo il numero). Basta
  esporre, per ogni concorso, la prossima sessione futura (data, nome, stato),
  senza cambiare le regole di autorizzazione. Le sessioni di un concorso sono
  disponibili solo dopo essere state scaricate da Selezioni Online (apertura
  dell'elenco sessioni o sincronizzazione del referente); l'aggiornamento
  dell'elenco concorsi non le scarica.
- Ora e origine della presenza richiedono un'aggiunta ai dati del candidato; le
  presenze già registrate prima della modifica restano senza ora e origine.
- Il testo dell'email di reset è provvisorio finché il pacchetto non lo
  definisce: oggetto con sessione, corpo con candidato, chi ha chiesto e ora.
- Il segnale di novità per l'esperto remoto è visivo (badge, titolo della scheda
  del browser); un avviso sonoro è facoltativo e disattivabile.
- L'aggiornamento automatico resta quello esistente (stato e candidati ogni 5
  secondi, chat ogni 10 secondi).
- Paginazione, ricerca e filtri degli elenchi possono essere svolti
  dall'interfaccia sui dati già caricati finché i volumi restano sotto soglie
  indicative di 200 concorsi e 500 sessioni per utente; oltre, va introdotta la
  paginazione lato server suggerita dal pacchetto (`05-backend.md`, punti 1–2).
- Oggi il backend permette all'informatico in sede anche le azioni dell'esperto
  remoto e la modifica della configurazione in qualunque stato: la correzione
  tocca le autorizzazioni ed è trattata nella feature 014.
- Fuori ambito: migrazione Keycloak/ACE (feature 012), modifiche alla macchina a
  stati, riapertura del check-in, scelta dei destinatari in chat.
- Tocca interfaccia, contratti di risposta (dati aggregati per home ed elenchi,
  storico degli stati, sessioni assegnate), dati del candidato (ora e origine
  presenza) e l'invio di email per i reset; non tocca stati, transizioni,
  autorizzazioni né generazione delle liste.
