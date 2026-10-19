# Feature Specification: Autorizzazioni per profilo sulle operazioni di sessione e bando

**Feature Branch**: `014-autorizzazioni-profili-sessione`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Autorizzazioni per profilo sulle operazioni di sessione e bando: allineare il backend ai ruoli operativi, chiudendo i permessi oggi troppo ampi."

## Contesto

Nell'analisi della feature 013 è emerso che i controlli di accesso verificano
**se** una persona è collegata alla sessione, ma non **cosa** può fare in base
al suo ruolo. Ne seguono permessi più ampi di quelli previsti dal flusso:

- l'informatico in sede assegnato può eseguire anche le azioni d'esame
  dell'esperto remoto, riassegnare esperto e informatico della sessione e
  modificare la configurazione del bando;
- l'esperto remoto assegnato può eseguire le azioni del segretario
  (configurazione, scarico candidati, check-in, presenze, liste) e modificare la
  configurazione del bando;
- il segretario può eseguire le azioni d'esame dell'esperto, che l'interfaccia
  non gli mostra;
- la modalità di visualizzazione scelta nell'indirizzo cambia quali controlli
  vengono applicati.

Gli stati della sessione non tornano indietro: un'azione d'esame eseguita per
errore non si annulla. Non si tratta di accessi da parte di estranei (servono
login CNR e assegnazione alla sessione), ma di separazione dei compiti.

Decisioni già prese nella feature 013: l'informatico in sede fa da riserva al
segretario in aula; la sostituzione di esperto remoto o informatico in sede
deve restare possibile anche a sessione avviata.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Le fasi d'esame le avanza solo l'esperto remoto (Priority: P1)

Solo l'esperto remoto assegnato alla sessione, o un amministratore, può segnare
"Presenti caricati su Moodle", "Ambiente d'esame pronto", "Esame in corso" ed
"Esame concluso". Segretario e informatico in sede ricevono un rifiuto chiaro se
ci provano.

**Why this priority**: sono passaggi irreversibili che dipendono da operazioni
su Moodle fatte dall'esperto; eseguirli per errore falsa lo stato della prova.

**Independent Test**: con un segretario e un informatico in sede tentare ognuna
delle quattro azioni d'esame su una sessione con liste inviate; con l'esperto
remoto assegnato eseguirle.

**Acceptance Scenarios**:

1. **Given** una sessione con liste inviate, **When** l'informatico in sede o il
   segretario tentano un'azione d'esame, **Then** l'operazione è rifiutata e lo
   stato non cambia.
2. **Given** la stessa sessione, **When** l'esperto remoto assegnato esegue
   l'azione, **Then** lo stato avanza come oggi.
3. **Given** un esperto remoto non assegnato a quella sessione, **When** tenta
   l'azione, **Then** l'operazione è rifiutata.

---

### User Story 2 - Assegnazioni e configurazione solo a chi ne è responsabile (Priority: P1)

Esperto remoto e informatico in sede della sessione, e i dati del bando, li
possono cambiare solo il segretario titolare, il referente/RDP del bando e
l'amministratore. La sostituzione resta possibile in qualunque stato, anche a
check-in avviato.

**Why this priority**: chi è assegnato a una sessione non deve poterla
riassegnare a qualcun altro né cambiare i dati del bando.

**Independent Test**: tentare la modifica di esperto e informatico, e dei dati
del bando, con informatico in sede ed esperto remoto; eseguirla con segretario,
referente e amministratore a check-in avviato.

**Acceptance Scenarios**:

1. **Given** una sessione a check-in avviato, **When** il segretario sostituisce
   l'esperto remoto, **Then** la modifica viene salvata e il nuovo esperto vede
   la sessione.
2. **Given** la stessa sessione, **When** l'informatico in sede o l'esperto
   remoto tentano di cambiare le assegnazioni, **Then** la modifica è rifiutata.
3. **Given** un bando, **When** informatico in sede o esperto remoto tentano di
   modificarne la configurazione, **Then** la modifica è rifiutata; referente,
   segretario titolare e amministratore possono farlo.

---

### User Story 3 - L'informatico in sede fa da riserva solo per il lavoro in aula (Priority: P2)

L'informatico in sede assegnato può collegare dispositivi, avviare e concludere
il check-in, registrare e annullare presenze, generare e inviare le liste,
richiedere reset password e scrivere note e messaggi. Non può configurare la
sessione, scaricare i candidati né eseguire azioni d'esame.

**Why this priority**: conserva il ruolo di riserva deciso nella 013,
togliendo solo ciò che non serve in aula.

**Independent Test**: con un informatico in sede percorrere il check-in fino
all'invio delle liste; tentare configurazione, scarico candidati e azioni
d'esame.

**Acceptance Scenarios**:

1. **Given** una sessione con dispositivi collegati, **When** l'informatico in
   sede avvia il check-in, registra presenze, conclude, genera e invia le liste,
   **Then** ogni operazione riesce e lo storico indica che l'ha eseguita lui.
2. **Given** una sessione configurata, **When** l'informatico in sede tenta di
   scaricare i candidati, **Then** l'operazione è rifiutata con un messaggio che
   indica chi può farlo.

---

### User Story 4 - L'esperto remoto fa solo il proprio lavoro (Priority: P2)

L'esperto remoto assegnato vede la sessione, scarica le liste, esegue le azioni
d'esame, richiede ed evade i reset, scrive note e messaggi. Non può configurare,
scaricare candidati, gestire check-in, presenze, dispositivi né generare o
inviare liste.

**Why this priority**: lavora da remoto e non partecipa alle operazioni in aula.

**Independent Test**: con l'esperto remoto tentare le operazioni del segretario
e verificare il rifiuto; eseguire le proprie.

**Acceptance Scenarios**:

1. **Given** una sessione a check-in avviato, **When** l'esperto remoto tenta di
   registrare una presenza o concludere il check-in, **Then** l'operazione è
   rifiutata.
2. **Given** una sessione con liste inviate, **When** l'esperto remoto scarica
   le liste ed esegue le azioni d'esame, **Then** tutto riesce come oggi.

---

### User Story 5 - Rifiuti chiari e tracciati (Priority: P3)

Quando un'operazione viene rifiutata, chi la tenta riceve un messaggio che dice
che non rientra nel suo ruolo; il rifiuto viene registrato per l'audit senza
dati personali dei candidati.

**Why this priority**: aiuta a capire eventuali configurazioni sbagliate e a
verificare la matrice in collaudo.

**Independent Test**: provocare un rifiuto per ciascun profilo e controllare
messaggio e registro.

**Acceptance Scenarios**:

1. **Given** un'operazione non permessa, **When** viene tentata, **Then** la
   risposta è un rifiuto di autorizzazione con un messaggio leggibile.
2. **Given** lo stesso tentativo, **When** si consulta il registro, **Then**
   compaiono utente, profilo, operazione e sessione, senza dati dei candidati.

---

### Edge Cases

- Utente con più relazioni sulla stessa sessione (per esempio segretario e anche
  esperto remoto assegnato): ottiene l'unione dei permessi dei suoi profili.
- Modalità di visualizzazione nell'indirizzo diversa dal ruolo reale: non
  concede né toglie permessi; contano solo le relazioni effettive.
- Esperto remoto sostituito durante la sessione: perde subito i permessi su
  quella sessione; il nuovo li acquisisce subito.
- Amministratore senza relazione con la sessione: mantiene tutti i permessi
  (accesso di supporto), come oggi.
- Rotte legacy di scrittura ancora raggiungibili: applicano la stessa matrice o
  sono disattivate.
- Utente con il ruolo esperto informatico ma non assegnato alla sessione: nessun
  permesso su quella sessione.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il sistema MUST applicare, per ogni operazione su sessione e
  bando, la matrice dei permessi sotto, verificata nel backend prima di leggere o
  modificare dati.
- **FR-002**: I permessi MUST derivare dalle relazioni effettive dell'utente con
  la sessione o il bando (segretario titolare, referente/RDP, informatico in sede
  assegnato, esperto remoto assegnato, amministratore); con più relazioni valgono
  tutte. La modalità di visualizzazione MUST NOT concedere né togliere permessi.
- **FR-003**: Le operazioni non permesse MUST essere rifiutate con un errore di
  autorizzazione e un messaggio leggibile, senza effetti sui dati.
- **FR-004**: Ogni rifiuto MUST essere registrato con utente, profili, operazione
  e sessione o bando, senza dati personali dei candidati.
- **FR-005**: La sostituzione di esperto remoto e informatico in sede MUST
  restare possibile in qualunque stato della sessione per chi ne ha il permesso.
- **FR-006**: Le rotte di scrittura legacy ancora raggiungibili MUST applicare la
  stessa matrice oppure essere disattivate.
- **FR-007**: Le operazioni oggi permesse ai profili previsti dalla matrice MUST
  continuare a funzionare senza cambiamenti per chi le usa.

#### Matrice dei permessi

Legenda: ✓ permesso, ✗ rifiutato. "Segretario" = segretario titolare della
commissione; "Sede" = informatico in sede assegnato alla sessione; "Esperto" =
esperto remoto assegnato alla sessione; "Referente" = referente/RDP del bando.

| Operazione | Segretario | Referente | Sede | Esperto | Admin |
| --- | --- | --- | --- | --- | --- |
| Vedere sessione, candidati, storico, chat | ✓ | — | ✓ | ✓ | ✓ |
| Configurare la sessione, cambiare esperto e informatico | ✓ | ✓ (dal bando) | ✗ | ✗ | ✓ |
| Configurare il bando | ✓ | ✓ | ✗ | ✗ | ✓ |
| Scaricare i candidati da Selezioni Online | ✓ | — | ✗ | ✗ | ✓ |
| Collegare e scollegare dispositivi | ✓ | — | ✓ | ✗ | ✓ |
| Avviare e concludere il check-in | ✓ | — | ✓ | ✗ | ✓ |
| Registrare e annullare presenze | ✓ | — | ✓ | ✗ | ✓ |
| Generare e inviare le liste | ✓ | — | ✓ | ✗ | ✓ |
| Scaricare le liste | ✓ | — | ✓ | ✓ | ✓ |
| Azioni d'esame (Moodle, ambiente pronto, inizia, concludi) | ✗ | — | ✗ | ✓ | ✓ |
| Richiedere un reset password | ✓ | — | ✓ | ✓ | ✓ |
| Segnare un reset come eseguito | ✗ | — | ✗ | ✓ | ✓ |
| Scrivere note sui candidati | ✓ | — | ✓ | ✓ | ✓ |
| Scrivere in chat | ✓ | — | ✓ | ✓ | ✓ |

"—" indica che il profilo non ha accesso alla sessione (il referente lavora sul
bando).

### Key Entities

- **Profilo sulla sessione**: relazione tra un utente e una sessione o un bando
  (segretario titolare, referente/RDP, informatico in sede, esperto remoto,
  amministratore).
- **Operazione**: azione su sessione o bando soggetta alla matrice.
- **Rifiuto registrato**: evento di audit con utente, profili, operazione,
  sessione o bando e istante.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Per il 100% delle celle della matrice esiste una verifica
  automatica che conferma il comportamento atteso.
- **SC-002**: Nessuna azione d'esame può essere eseguita da segretario o
  informatico in sede in tutte le prove di collaudo.
- **SC-003**: Nel collaudo con utenti reali, il percorso completo da sessione
  creata a esame concluso, con ogni profilo che svolge il proprio compito,
  riesce senza rifiuti inattesi.
- **SC-004**: La sostituzione dell'esperto remoto a check-in avviato richiede
  meno di 2 minuti e il nuovo esperto accede subito alla sessione.
- **SC-005**: Il 100% dei rifiuti provocati in collaudo compare nel registro con
  utente, operazione e sessione e senza dati personali dei candidati.

## Assumptions

- L'amministratore mantiene tutti i permessi come accesso di supporto.
- Il segretario titolare non esegue più le azioni d'esame: coerente con la
  decisione che, se l'esperto remoto non usa l'applicativo, la sessione si ferma
  a "Liste inviate".
- Scaricare i candidati richiede le credenziali del segretario su Selezioni
  Online; per l'informatico in sede di solito fallirebbe comunque: viene escluso
  in modo esplicito.
- Le note sui candidati restano scrivibili da tutti i profili con accesso alla
  sessione, come oggi.
- Il referente configura le assegnazioni dalle pagine del bando; non ottiene
  accesso operativo alla sessione.
- La feature 013 si allinea a questa matrice: nella sezione "Azioni del
  segretario" dell'informatico in sede non compaiono configurazione della
  sessione e scarico dei candidati.
- Fuori ambito: migrazione Keycloak/ACE (012), interfaccia grafica (013), nuovi
  ruoli, modifiche alla macchina a stati, accesso dei dispositivi scanner (resta
  autorizzato dal token del dispositivo).
- Tocca autorizzazioni e audit; non tocca stati, transizioni, schema dei dati di
  sessione né generazione delle liste.
