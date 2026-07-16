# Feature Specification: Accesso profili informatici assegnati

**Feature Branch**: `007-accesso-informatico-sede`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Per l'informatico in sede non esiste un ruolo applicativo dedicato, pero un utente SSO qualsiasi non deve poter vedere la scheda o la lista dei bandi come informatico in sede. Serve controllare che l'utente sia effettivamente l'informatico indicato per il concorso/sessione, probabilmente usando l'email inserita dal segretario o referente nella configurazione. Inoltre ogni profilo operativo deve aprire solo le proprie pagine: segretario, referente, esperto informatico da remoto e informatico in sede restano separati, salvo admin globale."

## Analisi comportamento corrente

- L'admin globale puo aprire pagine operative anche quando non e' configurato
  come esperto o informatico assegnato: questo e' accettabile solo come accesso
  di supporto, purche' sia visibile e distinguibile dalla normale operativita.
- La modalita "Informatico in sede" oggi non deve essere interpretata come un
  ruolo globale: deve essere valida solo quando l'email dell'utente coincide con
  l'informatico in sede indicato sulla sessione.
- La modalita "Esperto informatico da remoto" non deve bastare da sola tramite
  ruolo globale o URL: l'utente deve essere l'esperto remoto configurato per quel
  bando, salvo admin globale.
- Segretario, referente/RDP, membro commissione, esperto remoto e informatico in
  sede sono profili distinti. Il fatto che un utente possa aprire una pagina di
  un profilo non deve autorizzarlo automaticamente sulle pagine degli altri
  profili.

## Implementazione 2026-07-16

- Aggiunti controlli backend per `mode=sede` e `mode=expert/esperto` basati
  sulle email configurate: `email_informatico_sede` a livello sessione e
  `email_esperto_remoto` a livello bando.
- Per utenti non-admin, la dashboard sede mostra solo bandi con almeno una
  sessione assegnata; la dashboard esperto mostra solo bandi dove l'utente e'
  l'esperto remoto configurato.
- I link diretti a sessione, configurazioni in lettura, candidati, reset,
  dispositivi e stato workflow propagano il profilo operativo richiesto e
  vengono bloccati se l'utente non e' assegnato.
- L'admin globale resta autorizzato come supporto, ma le viste restituiscono
  `visibility_reason=admin` e la UI mostra un avviso di accesso amministrativo
  non assegnato.
- Non e' stata introdotta una tabella dedicata: il perimetro iniziale usa i dati
  gia' configurati su bando/sessione.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Informatico in sede vede solo incarichi propri (Priority: P1)

Un utente CNR autenticato entra dal profilo "Informatico in sede" e vede solo i
concorsi/sessioni per cui la sua identita istituzionale risulta associata come
informatico in sede.

**Why this priority**: senza questo controllo, qualunque utente SSO potrebbe
aprire il profilo sede e vedere bandi o sessioni non assegnati, creando un
problema di riservatezza e confusione operativa.

**Independent Test**: configurare due sessioni, una con email informatico in
sede uguale all'utente autenticato e una con email diversa; accedere dal profilo
"Informatico in sede" e verificare che compaia solo la sessione assegnata.

**Acceptance Scenarios**:

1. **Given** un utente autenticato con email istituzionale associata a una
   sessione come informatico in sede, **When** apre la home applicativa, **Then**
   vede l'ingresso "Informatico in sede" e puo entrare nella sessione assegnata.
2. **Given** un utente autenticato non associato ad alcuna sessione, **When**
   apre la home applicativa, **Then** non vede l'ingresso operativo
   "Informatico in sede"; se raggiunge la URL direttamente, riceve un messaggio
   chiaro che non risultano sessioni assegnate.
3. **Given** un utente associato a una sola sessione di un concorso, **When**
   apre l'elenco, **Then** non vede altre sessioni dello stesso concorso se non
   gli sono state assegnate.

---

### User Story 2 - Link diretto bloccato se l'utente non e assegnato (Priority: P1)

Un utente prova ad aprire direttamente una sessione in modalita informatico in
sede tramite URL, ma non risulta associato a quella sessione.

**Why this priority**: filtrare solo la lista non basta; i link diretti devono
rispettare la stessa autorizzazione.

**Independent Test**: autenticarsi con un utente non associato e aprire
direttamente l'URL di una sessione con modalita sede; il sistema deve rifiutare
l'accesso senza mostrare dati operativi.

**Acceptance Scenarios**:

1. **Given** un utente non associato alla sessione, **When** apre un link diretto
   alla gestione sessione in modalita sede, **Then** riceve un rifiuto chiaro.
2. **Given** un utente associato alla sessione, **When** apre lo stesso link,
   **Then** puo vedere la vista sede e gestire le richieste di reset password
   dei candidati.
3. **Given** un amministratore globale, **When** apre la sessione in modalita
   sede per supporto, **Then** l'accesso amministrativo e' distinguibile
   dall'assegnazione operativa ordinaria.

---

### User Story 3 - Segretario o referente assegna l'informatico corretto (Priority: P2)

Un segretario o referente inserisce l'informatico in sede nella configurazione
della sessione usando l'email istituzionale corretta; da quel momento
l'informatico puo vedere la sessione nel proprio profilo.

**Why this priority**: il controllo di accesso dipende dalla qualita del dato
inserito. Il sistema deve guidare chi configura ed evitare errori silenziosi.

**Independent Test**: inserire o modificare l'email informatico in sede nella
configurazione, poi accedere con quell'utente e verificare che la visibilita sia
aggiornata.

**Acceptance Scenarios**:

1. **Given** una sessione senza informatico in sede, **When** il segretario salva
   un'email valida, **Then** l'utente corrispondente diventa autorizzato alla
   vista sede per quella sessione.
2. **Given** una sessione gia assegnata a un informatico, **When** il segretario
   sostituisce l'email, **Then** il vecchio informatico perde accesso e il nuovo
   lo acquisisce.
3. **Given** un'email assente o non valida, **When** la configurazione viene
   salvata, **Then** il sistema impedisce o segnala che il profilo sede non sara
   utilizzabile.

---

### User Story 4 - Ogni profilo apre solo il proprio flusso (Priority: P1)

Un utente autenticato prova ad aprire una pagina operativa diversa dal profilo
per cui risulta assegnato: ad esempio un segretario prova ad aprire la vista
informatico in sede, un informatico in sede prova ad aprire la vista esperto
remoto, o un esperto remoto prova ad aprire una sessione dove non e' configurato.

**Why this priority**: la separazione dei profili evita accessi impropri e
riduce la confusione tra ruoli SOL, ruoli applicativi globali e incarichi
operativi sul singolo bando/sessione.

**Independent Test**: configurare un bando con segretario, referente, esperto
remoto e informatico in sede diversi; autenticarsi con ciascun utente e
verificare che ogni profilo apra solo le pagine coerenti con il proprio incarico.

**Acceptance Scenarios**:

1. **Given** un segretario non configurato come informatico in sede, **When**
   apre una URL in modalita sede, **Then** il sistema rifiuta l'accesso alla
   pagina sede.
2. **Given** un referente/RDP non configurato come esperto remoto, **When** apre
   una URL in modalita esperto, **Then** il sistema rifiuta l'accesso alla pagina
   esperto.
3. **Given** un esperto informatico da remoto configurato su un bando, **When**
   apre la dashboard esperto, **Then** vede solo i bandi in cui la sua email e'
   configurata come esperto remoto.
4. **Given** un admin globale non configurato sul bando, **When** apre una vista
   sede o esperto per supporto, **Then** la pagina si apre solo con indicazione
   chiara di accesso amministrativo.

### Edge Cases

- Email inserita con maiuscole/minuscole diverse dall'email SSO.
- Email informatico in sede vuota.
- Stessa persona assegnata a piu sessioni o piu concorsi.
- Cambio informatico dopo che il flusso di check-in e' gia avviato.
- Utente amministratore globale che usa la vista sede per supporto.
- Link diretto a sessione non assegnata.
- Sessione assegnata ma concorso non piu visibile da Selezioni Online.
- Email personale o non istituzionale inserita per errore.
- Piu informatici in sede per una stessa sessione, se in futuro il processo lo
  richiedera.
- Segretario o membro di commissione che prova ad aprire la vista informatico in
  sede senza essere indicato come informatico della sessione.
- Referente/RDP che prova ad aprire la vista esperto remoto senza essere
  indicato come esperto remoto del bando.
- Esperto informatico da remoto globale che prova ad aprire un bando dove non e'
  configurato come esperto remoto.
- Bando senza esperto informatico remoto configurato: nessun utente non-admin
  deve poter aprire la vista esperto per quel bando.
- Admin globale che apre una vista tecnica non assegnata: l'accesso deve restare
  tracciabile e visivamente distinto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il sistema DEVE distinguere l'accesso SSO ordinario
  dall'autorizzazione operativa come informatico in sede.
- **FR-002**: Un utente autenticato NON DEVE vedere bandi o sessioni nel profilo
  "Informatico in sede" se non risulta associato come informatico in sede.
- **FR-002a**: L'ingresso operativo "Informatico in sede" nella home NON DEVE
  essere proposto a utenti senza sessioni assegnate, salvo accesso
  amministrativo esplicito.
- **FR-003**: L'associazione informatico-sessione DEVE basarsi su un dato
  esplicito inserito o confermato nella configurazione della sessione o del
  concorso.
- **FR-004**: Il confronto tra identita autenticata e informatico assegnato DEVE
  normalizzare l'email per evitare differenze dovute a maiuscole/minuscole o
  spazi.
- **FR-005**: La dashboard "Informatico in sede" DEVE mostrare solo i concorsi
  con almeno una sessione assegnata all'utente autenticato.
- **FR-006**: La lista sessioni in modalita sede DEVE mostrare solo le sessioni
  assegnate all'utente autenticato, salvo accesso amministrativo esplicito.
- **FR-007**: L'apertura diretta di una sessione in modalita sede DEVE verificare
  l'associazione dell'utente prima di mostrare candidati, reset o dati operativi.
- **FR-008**: Se l'utente non ha sessioni assegnate, il sistema DEVE mostrare un
  messaggio chiaro e non una lista generica di concorsi.
- **FR-009**: Quando l'informatico assegnato viene cambiato, la vecchia
  associazione NON DEVE continuare ad autorizzare l'accesso.
- **FR-010**: La configurazione della sessione DEVE rendere evidente che l'email
  informatico in sede determina la visibilita del profilo sede.
- **FR-011**: Se il sistema consente accesso amministrativo alla vista sede, tale
  accesso DEVE essere distinguibile dall'accesso ordinario dell'informatico
  assegnato.
- **FR-012**: La documentazione operativa DEVE spiegare che il reset password in
  questo flusso riguarda i candidati e non l'autenticazione dell'informatico.
- **FR-013**: Ogni rifiuto di accesso alla vista sede DEVE avere un messaggio
  comprensibile e tracciabile.
- **FR-014**: Il sistema DEVE separare i profili operativi: segretario,
  referente/RDP, esperto informatico da remoto e informatico in sede non devono
  ereditare accesso alle rispettive pagine solo perche' autorizzati sullo stesso
  bando.
- **FR-015**: La vista "Esperto informatico da remoto" DEVE essere accessibile a
  utenti non-admin solo se la loro email coincide con l'esperto remoto
  configurato sul bando.
- **FR-016**: Un ruolo applicativo globale di esperto informatico, se presente,
  NON DEVE consentire da solo l'apertura di tutti i bandi in modalita esperto.
- **FR-017**: Un segretario, referente/RDP o membro di commissione NON DEVE
  poter aprire la pagina informatico in sede se non e' anche l'informatico in
  sede assegnato alla sessione.
- **FR-018**: Un informatico in sede NON DEVE poter aprire la pagina esperto
  remoto se non e' anche l'esperto remoto configurato per quel bando.
- **FR-019**: Se un bando non ha esperto remoto configurato, la vista esperto per
  quel bando DEVE essere inaccessibile agli utenti non-admin.
- **FR-020**: L'accesso admin alle viste tecniche DEVE essere ammesso solo come
  supporto e DEVE mostrare un'indicazione esplicita che l'utente non e'
  l'assegnatario operativo.

### Key Entities

- **Informatico in sede assegnato**: persona indicata nella configurazione della
  sessione/concorso come referente tecnico locale per il supporto durante la
  prova.
- **Associazione sede-sessione**: relazione tra identita autenticata e sessione
  che abilita la vista "Informatico in sede".
- **Profilo sede**: modalita operativa che consente di vedere le sessioni
  assegnate e gestire le richieste di reset password dei candidati.
- **Accesso amministrativo sede**: accesso eccezionale o di supporto che non
  equivale a essere l'informatico assegnato.
- **Esperto informatico da remoto assegnato**: persona indicata nella
  configurazione del bando come destinatario tecnico remoto del flusso esperto.
- **Accesso amministrativo tecnico**: accesso di supporto alle viste sede o
  esperto con privilegi admin, distinto dagli incarichi operativi assegnati.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nel 100% dei test, un utente non assegnato non vede concorsi o
  sessioni nel profilo "Informatico in sede".
- **SC-002**: Nel 100% dei test di link diretto, un utente non assegnato non puo
  aprire dati operativi della sessione in modalita sede.
- **SC-003**: Nel 100% dei test, l'utente assegnato vede la sessione corretta e
  puo gestire le richieste di reset password dei candidati.
- **SC-004**: Nel 100% dei test di cambio informatico, il vecchio assegnatario
  perde accesso e il nuovo lo acquisisce senza interventi manuali ulteriori.
- **SC-005**: I messaggi per utente senza incarichi o non autorizzato sono
  comprensibili senza consultare log tecnici.
- **SC-006**: La documentazione e la UI non lasciano intendere che serva una
  password/login separata per l'informatico in sede.
- **SC-007**: Nel 100% dei test, segretario, referente/RDP e membro commissione
  non aprono la vista sede se non sono anche informatico in sede assegnato.
- **SC-008**: Nel 100% dei test, un esperto informatico globale non vede bandi in
  modalita esperto dove non e' configurato come esperto remoto.
- **SC-009**: Nel 100% dei test, un bando senza esperto remoto configurato non
  apre la vista esperto per utenti non-admin.
- **SC-010**: Nel 100% dei test admin, l'apertura di una vista tecnica non
  assegnata mostra chiaramente che si tratta di accesso amministrativo.

## Assumptions

- L'informatico in sede e' un utente CNR che accede con SSO ordinario.
- Nel perimetro iniziale l'associazione piu affidabile e' l'email indicata nella
  configurazione della sessione; la dashboard puo raggruppare per concorso solo
  quando esiste almeno una sessione assegnata.
- Il segretario o referente resta responsabile di inserire l'email corretta
  dell'informatico in sede.
- Non si introduce un ruolo applicativo globale "informatico in sede" valido per
  tutti i concorsi.
- Il ruolo globale "esperto_informatico", se mantenuto, abilita al tipo di
  flusso ma non sostituisce l'assegnazione sul singolo bando.
- L'eventuale accesso admin alla vista sede o esperto e' supporto, non
  operativita ordinaria.
