# Feature Specification: Accesso referente/RDP alla configurazione bando

**Feature Branch**: `004-referente-rdp-configurazione`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Definire il caso d'uso in cui il referente/RDP del bando, normalmente non presente tra i componenti della commissione, accede con identita istituzionale, vede i bandi che gli competono, compila o conferma la configurazione richiesta dagli informatici, e il sistema autorizza l'accesso usando la relazione RDP/referente recuperata da Selezioni Online e salvata internamente. Verificare anche il problema delle credenziali personali usate per integrazioni esterne e prevedere una utenza di servizio dove necessario."

## Clarifications

### Session 2026-07-08

- Q: Quando un bando ha piu RDP, chi puo compilare la configurazione? → A: Tutti gli RDP autorizzati possono accedere; la prima compilazione completa chiude la richiesta.
- Q: Quali campi puo compilare o modificare il referente/RDP? → A: Referente/RDP e segretario possono inserire o modificare tutta la configurazione bando; non possono cambiare chi e il referente/RDP senza permesso ulteriore.
- Q: Da dove nasce l'accesso del segretario alla configurazione? → A: Il segretario usa l'autorizzazione gia esistente come segretario/membro commissione; il nuovo flusso di assegnazione serve per RDP/referente.
- Q: Se Selezioni Online cambia referente/RDP dopo una configurazione gia completata, cosa succede? → A: Il cambio non blocca il bando gia configurato; se il vecchio RDP prova a modificare, l'accesso viene rifiutato perche non e piu RDP del bando.
- Q: Quale modalita di chiamata a Selezioni Online/JConon e accettata ora e cosa serve per produzione? → A: In test si accetta la modalita corrente, ma la documentazione deve distinguere i flussi OIDC utente dai flussi con credenziali env; prima della produzione le credenziali personali devono essere sostituite da token utente corretto o utenza applicativa.
- Q: Come recuperare RDP se l'utente loggato non e admin? → A: Il flusso primario resta il token OIDC dell'utente loggato, perche il referente/RDP dovrebbe essere autorizzato sui propri bandi; una utenza di servizio resta fallback solo se i test dimostrano che Selezioni Online non restituisce RDP/commissione a referente o segretario.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Referente vede i propri bandi da configurare (Priority: P1)

Un referente/RDP accede con identita istituzionale e trova una pagina con i soli
bandi per cui risulta referente o RDP, distinguendo quelli da configurare da
quelli gia completati.

**Why this priority**: senza questa vista il referente riceve una richiesta ma
non ha un punto chiaro e autorizzato da cui completare il lavoro.

**Independent Test**: creare o sincronizzare due bandi, uno associato all'email
del referente e uno non associato; accedere come quel referente e verificare che
sia visibile solo il bando di competenza.

**Acceptance Scenarios**:

1. **Given** un referente autenticato e associato a un bando, **When** apre la
   propria area di configurazione, **Then** vede quel bando nell'elenco.
2. **Given** un referente autenticato ma non associato a un bando, **When**
   prova a raggiungere quel bando, **Then** l'accesso viene negato.
3. **Given** un referente associato a piu bandi, **When** apre l'elenco, **Then**
   vede tutti e soli i bandi di propria competenza con stato comprensibile.

---

### User Story 2 - Informatico richiede la compilazione al referente corretto (Priority: P1)

Un informatico o amministratore seleziona un bando, verifica il referente/RDP
suggerito dai dati istituzionali, invia la richiesta di configurazione e puo
controllare se la compilazione e stata completata.

**Why this priority**: il processo operativo parte dagli informatici, che devono
poter assegnare la configurazione senza trasformare il referente in membro della
commissione o amministratore.

**Independent Test**: da un account autorizzato aprire la configurazione bando,
usare il referente suggerito, inviare la richiesta e verificare che il bando
risulti assegnato al referente indicato.

**Acceptance Scenarios**:

1. **Given** un bando con dati RDP disponibili, **When** l'informatico apre la
   configurazione, **Then** il referente suggerito e precompilato se presente.
2. **Given** il referente e stato confermato, **When** l'informatico invia la
   richiesta, **Then** il sistema registra chi ha richiesto la compilazione e a
   chi e stata assegnata.
3. **Given** il referente non e disponibile nei dati istituzionali, **When**
   l'informatico deve procedere, **Then** il sistema non permette inserimenti
   manuali e richiede di correggere il dato su Selezioni Online.

---

### User Story 3 - Referente o segretario compila la configurazione (Priority: P2)

Il referente/RDP apre il bando tramite il nuovo flusso dedicato, mentre il
segretario o membro di commissione usa l'autorizzazione gia esistente. Entrambi
possono completare la configurazione bando senza poter cambiare chi e il
referente/RDP fuori dalla lista restituita da Selezioni Online.

**Why this priority**: il referente deve contribuire alla configurazione anche
se non e in commissione, mentre il segretario deve continuare a usare il flusso
gia previsto senza introdurre una seconda assegnazione parallela.

**Independent Test**: accedere come referente/RDP tramite nuovo flusso e come
segretario tramite autorizzazione esistente; in entrambi i casi verificare che
sia possibile salvare la configurazione bando, mentre la modifica del
referente/RDP resta non consentita senza permesso ulteriore.

**Acceptance Scenarios**:

1. **Given** un referente/RDP o segretario autorizzato sul bando, **When** salva la
   configurazione, **Then** il sistema registra completamento, autore e data.
2. **Given** un referente/RDP o segretario autorizzato, **When** prova a
   cambiare chi e il referente/RDP del bando, **Then** il sistema impedisce la
   modifica.
3. **Given** la configurazione contiene dati mancanti o non validi, **When** il
   referente/RDP o segretario salva, **Then** riceve indicazioni chiare sui
   campi da correggere.

---

### User Story 4 - Credenziali personali eliminate dai flussi applicativi (Priority: P2)

Il responsabile tecnico verifica quali integrazioni usano ancora credenziali
personali e le sostituisce con una utenza applicativa o con un accesso
istituzionalmente autorizzato.

**Why this priority**: un'applicazione in test o produzione non deve dipendere
dalle credenziali personali di un singolo operatore.

**Independent Test**: censire i flussi di integrazione esterna e verificare che
nessun flusso automatico o server-side richieda username/password personali.

**Acceptance Scenarios**:

1. **Given** un'integrazione esterna usata dall'applicazione, **When** viene
   censita, **Then** il sistema indica se usa identita utente corrente, utenza
   applicativa o credenziali personali.
2. **Given** un flusso che usa credenziali personali, **When** la feature viene
   completata, **Then** esiste una sostituzione approvata o il flusso resta
   esplicitamente bloccato per produzione.

### Edge Cases

- Il referente e presente nei dati istituzionali senza email utilizzabile.
- Piu RDP risultano collegati allo stesso bando.
- Un secondo RDP prova a modificare la configurazione dopo che un altro RDP l'ha
  completata.
- Il referente cambia dopo che la richiesta e stata inviata o dopo che il bando
  e gia stato configurato.
- Un vecchio RDP prova ad accedere o modificare la configurazione dopo che non
  risulta piu RDP del bando.
- I dati istituzionali non sono disponibili al momento della sincronizzazione.
- Un utente e referente di un bando e componente di commissione di un altro.
- Un segretario autorizzato prova a cambiare il referente/RDP assegnato al
  bando.
- L'email restituita dai dati istituzionali differisce per maiuscole/minuscole
  o alias rispetto all'identita usata in accesso.
- Un informatico prova a inserire un referente non presente nei dati
  istituzionali.
- Un referente prova ad accedere a un bando tramite link diretto ricevuto o
  inoltrato da altri.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il sistema DEVE autenticare il referente tramite identita
  istituzionale prima di mostrare qualsiasi bando o configurazione.
- **FR-002**: Il sistema DEVE autorizzare il referente sul singolo bando usando
  una relazione esplicita tra bando e referente/RDP, non un ruolo generico valido
  per tutti i bandi.
- **FR-003**: Il sistema DEVE salvare internamente la relazione tra bando,
  referente/RDP, fonte del dato, data di acquisizione e stato della richiesta di
  configurazione.
- **FR-004**: Il referente DEVE vedere un elenco filtrato ai soli bandi per cui
  e autorizzato.
- **FR-005**: Il referente NON DEVE vedere bandi di altri referenti, altri RDP o
  commissioni non collegate alla sua identita.
- **FR-006**: Gli informatici e gli amministratori autorizzati DEVONO poter
  richiedere la configurazione a un referente suggerito dai dati istituzionali.
- **FR-007**: Gli informatici e gli amministratori autorizzati NON DEVONO poter
  inserire o correggere manualmente il referente quando il dato istituzionale
  manca; il sistema DEVE accettare solo referenti/RDP restituiti da Selezioni
  Online per il bando.
- **FR-008**: Il sistema DEVE distinguere almeno lo stato operativo della
  configurazione bando: "da configurare", "esperto assegnato" e "dati
  compilati". Stati formali di richiesta/audit possono essere aggiunti in una
  spec successiva se serve distinguere invio richiesta, compilazione e verifica.
- **FR-009**: Il referente/RDP tramite nuova assegnazione e il segretario o
  membro di commissione tramite autorizzazione esistente DEVONO poter inserire,
  modificare e confermare la configurazione del bando.
- **FR-010**: Il sistema DEVE impedire a referente/RDP, segretario e membro di
  commissione di cambiare chi e il referente/RDP autorizzato, modificare ruoli
  applicativi o intervenire su assegnazioni di altri bandi se non hanno un
  permesso ulteriore.
- **FR-011**: Ogni richiesta, accesso autorizzato, modifica e completamento della
  configurazione DEVE essere tracciato con utente, data, bando e azione.
- **FR-012**: Il sistema DEVE gestire il caso di piu RDP sullo stesso bando,
  consentendo l'accesso ai referenti autorizzati; la prima compilazione
  completata chiude la richiesta e successive modifiche richiedono riapertura o
  verifica da parte di un informatico/amministratore.
- **FR-013**: Il sistema DEVE normalizzare il confronto tra email dell'identita
  autenticata e email dei referenti per evitare differenze solo formali.
- **FR-014**: Il sistema DEVE mostrare un messaggio chiaro quando un referente
  autenticato non ha bandi assegnati.
- **FR-015**: Il sistema DEVE bloccare l'accesso tramite link diretto se
  l'utente autenticato non e associato al bando.
- **FR-016**: Il sistema DEVE censire le integrazioni esterne usate per
  recuperare dati RDP/referenti e indicare quali possono usare identita utente
  corrente e quali richiedono una utenza applicativa.
- **FR-017**: I flussi destinati a test stabile o produzione NON DEVONO
  dipendere da credenziali personali di un operatore.
- **FR-018**: Se i dati istituzionali non sono disponibili, il sistema DEVE
  bloccare l'impostazione del referente e mostrare che il dato va corretto
  sulla fonte istituzionale, senza concedere accessi automatici o locali non
  verificati.
- **FR-019**: Il cambio referente/RDP rilevato dalla fonte istituzionale NON
  DEVE bloccare un bando gia configurato, ma DEVE revocare o rendere non
  utilizzabile l'accesso del vecchio RDP per nuove modifiche.
- **FR-020**: Se un vecchio RDP prova ad accedere o modificare un bando per cui
  non risulta piu RDP, il sistema DEVE rifiutare l'operazione con un messaggio
  chiaro e tracciare il rifiuto.
- **FR-021**: La documentazione operativa DEVE indicare per ogni chiamata a
  Selezioni Online/JConon se usa token OIDC dell'utente loggato, utenza
  applicativa o credenziali da variabili ambiente.
- **FR-022**: Le credenziali personali da variabili ambiente possono essere
  tollerate solo in test temporaneo; prima della produzione DEVONO essere
  sostituite o il flusso dipendente DEVE restare non abilitato.
- **FR-023**: Il recupero degli RDP da Selezioni Online/JConon DEVE usare come
  flusso primario il token OIDC dell'utente loggato, assumendo che il
  referente/RDP sia autorizzato sui propri bandi.
- **FR-024**: La feature DEVE prevedere una verifica esplicita con utenze
  referente/RDP e segretario non admin; una utenza di servizio diventa requisito
  solo se tali utenze non ricevono da Selezioni Online i dati RDP/commissione
  necessari.

### Key Entities *(include if feature involves data)*

- **Referente/RDP**: persona collegata a uno o piu bandi con email istituzionale,
  nome e fonte del dato.
- **Segretario autorizzato**: persona indicata per la configurazione operativa
  del bando, autorizzata tramite il flusso esistente di segretario/membro
  commissione a compilare la configurazione ma non a cambiare il referente/RDP.
- **Bando assegnato**: bando per cui un referente puo vedere o completare la
  configurazione.
- **Richiesta di configurazione**: assegnazione operativa inviata da un
  informatico o amministratore a uno o piu referenti, con stato e tracciamento.
- **Audit configurazione**: evidenza delle azioni eseguite su richiesta,
  accesso, modifica, completamento e verifica.
- **Identita applicativa esterna**: utenza o modalita autorizzata usata
  dall'applicazione per integrazioni che non devono dipendere da credenziali
  personali.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In collaudo, un referente con almeno un bando assegnato trova il
  proprio elenco in meno di 3 passaggi dopo l'accesso.
- **SC-002**: Nel 100% dei test di autorizzazione, un referente non associato a
  un bando non riesce a visualizzarne o modificarne la configurazione.
- **SC-003**: Nel 100% dei test di autorizzazione, un referente associato a un
  bando riesce ad aprire la configurazione assegnata.
- **SC-004**: Almeno il 95% dei bandi con dati RDP completi viene precompilato
  senza inserimento manuale del referente.
- **SC-005**: Ogni configurazione completata dal referente/RDP o segretario
  risulta tracciabile con bando, utente, data e stato finale.
- **SC-006**: Prima della promozione in produzione, nessun flusso server-side
  richiesto dalla feature usa credenziali personali.
- **SC-007**: Un informatico riesce a verificare lo stato di richiesta o
  completamento di un bando in meno di 2 minuti.
- **SC-008**: Nel 100% dei test su cambio RDP, il bando gia configurato resta
  utilizzabile dagli operatori autorizzati e il vecchio RDP non puo effettuare
  nuove modifiche.
- **SC-009**: Prima della produzione, il censimento integrazioni indica 0 flussi
  obbligatori basati su credenziali personali.
- **SC-010**: In collaudo, il flusso con token OIDC di un referente/RDP non
  admin restituisce i bandi di competenza e i dati RDP/commissione necessari,
  oppure produce evidenza che giustifica l'attivazione di una utenza di
  servizio.

## Assumptions

- L'identita istituzionale dell'utente fornisce un'email affidabile per il
  confronto con i dati referente/RDP.
- Se piu RDP sono collegati allo stesso bando, tutti possono essere autorizzati;
  il primo completamento chiude la richiesta per evitare modifiche concorrenti
  non controllate.
- Il referente non e normalmente un componente della commissione e non deve
  essere aggiunto artificialmente alla commissione solo per ottenere accesso.
- Il segretario o membro di commissione continua a usare l'autorizzazione
  applicativa esistente; non deve essere inserito nella nuova tabella di
  assegnazione RDP/referente.
- I dati istituzionali restano la fonte preferita per proporre il referente, ma
  il sistema mantiene una copia interna per stabilizzare autorizzazioni e stato
  operativo.
- Il recupero RDP usa inizialmente il token OIDC dell'utente finale; la utenza
  di servizio e considerata fallback operativo, non flusso primario.
- La finalita principale della configurazione bando e rendere disponibili gli
  incarichi operativi, in particolare esperto informatico remoto e informatico
  in sede; il cambio RDP non deve bloccare questi dati quando sono gia stati
  configurati.
- Il referente configurabile deve provenire dalla lista RDP/referenti
  restituita da Selezioni Online; se il dato istituzionale manca o e
  incompleto, va corretto alla fonte e non inserito manualmente nell'app.
- Le credenziali personali eventualmente presenti oggi sono considerate
  provvisorie e non accettabili per test stabile o produzione.
