# Feature Specification: Client Keycloak dedicato e ruoli applicativi da ACE

**Feature Branch**: `012-keycloak-client-ruoli-ace`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Migrazione autenticazione e autorizzazione verso un client Keycloak dedicato "checkin-concorsi" con ruoli applicativi gestiti in ACE (stesso modello di GEMODO, ADR-0003 di builder-modello-bando)."

## Clarifications

### Session 2026-10-19

- Q: Come includere nell'elenco gli esperti che non hanno ancora fatto login? →
  A: In questa fase da ACE arriva **un solo ruolo**, l'amministratore. Il ruolo
  esperto informatico **non** passa ad ACE: resta nel registro locale e lo
  assegna, dalla pagina "Gestione permessi", chi ha il ruolo amministratore ACE.
  L'elenco degli esperti quindi non dipende dal login dell'esperto. Eventuali
  altri ruoli ACE saranno valutati in seguito.

Documento di configurazione da condividere con chi gestisce Keycloak e ACE:
[keycloak-ace-setup.md](keycloak-ace-setup.md).

## Situazione attuale (verificata nel codice il 2026-10-19)

- Il login usa il client Keycloak `selezioni`, lo stesso di Selezioni Online,
  sul realm `cnr`. In test `traefik.test.si.cnr.it` e `sso.test.si.cnr.it`
  rispondono con lo stesso realm e lo stesso orologio.
- Dal token l'applicativo legge solo quattro informazioni: `is_cnr_user`
  (obbligatorio vero), email, nome utente/nome visualizzato e identificativo
  soggetto. **Non legge ruoli dal token.**
- I ruoli applicativi globali sono due e stanno nel registro locale:
  amministratore globale ed esperto informatico. Si gestiscono dalla pagina
  admin "Gestione permessi". Lo stesso registro alimenta l'elenco a tendina
  degli esperti remoti in configurazione sessione e bando.
- Le autorizzazioni di dominio **non** sono ruoli dell'identity provider e
  restano nell'applicativo:
  - segretario: componente con ruolo SEGRETARIO della commissione, restituito
    dalle API di Selezioni Online;
  - referente/RDP: RDP del bando restituito dalle API di Selezioni Online;
  - informatico in sede ed esperto remoto di una sessione: email indicate nella
    configurazione della sessione.
- Il token dell'utente viene inoltrato a Selezioni Online per cinque operazioni:
  elenco commissioni, import candidati, sessioni, metadati bando, bandi del
  referente. Selezioni Online riconosce l'utente CNR dalle informazioni
  `is_cnr_user` e `username_cnr` del token; senza queste lo tratta come utente
  esterno e lo cerca per codice fiscale. Nella configurazione presente nel suo
  repository non verifica il destinatario del token (audience).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Selezioni Online continua a funzionare con il nuovo client (Priority: P1)

Un segretario e un referente accedono all'applicativo tramite il nuovo client
dedicato. Vedono gli stessi bandi di prima, scaricano i candidati, sincronizzano
le sessioni e leggono i bandi come referente, esattamente come con il client di
Selezioni Online.

**Why this priority**: è il requisito bloccante. Se Selezioni Online non accetta
il token del nuovo client, o non riconosce lo stesso utente, il segretario non
vede i propri bandi e non può importare i candidati: la migrazione non può
procedere. Va verificato prima di qualunque modifica all'applicativo.

**Independent Test**: con un utente segretario di test, ottenere un token dal
nuovo client e invocare le cinque operazioni verso Selezioni Online; confrontare
i risultati con quelli ottenuti con il client attuale.

**Acceptance Scenarios**:

1. **Given** un segretario abilitato su Selezioni Online per un bando, **When**
   accede con il nuovo client e apre la dashboard, **Then** vede gli stessi bandi
   che vede con il client attuale.
2. **Given** una sessione configurata, **When** il segretario preme "Scarica
   candidati", **Then** i candidati vengono importati come oggi.
3. **Given** un RDP di un bando, **When** apre la dashboard referente, **Then**
   vede gli stessi bandi che vede con il client attuale.
4. **Given** che Selezioni Online rifiuti il token del nuovo client, **When** si
   esegue la verifica preliminare, **Then** la migrazione si ferma e si adotta una
   delle alternative documentate prima di procedere.

---

### User Story 2 - Amministratore gestito in ACE (Priority: P1)

Chi gestisce gli accessi assegna in ACE il ruolo amministratore del contesto
check-in a una persona. Al login successivo la persona ha i privilegi di
amministratore globale nell'applicativo; quando il ruolo viene revocato in ACE,
li perde.

**Why this priority**: è il motivo principale della migrazione: togliere la
gestione dei privilegi amministrativi dal registro locale e portarla nel sistema
istituzionale di gestione accessi.

**Independent Test**: assegnare il ruolo in ACE a un utente di test, fare login
e verificare l'accesso alle funzioni admin; revocare il ruolo, rifare login e
verificare che l'accesso sia negato.

**Acceptance Scenarios**:

1. **Given** un utente con ruolo amministratore nel contesto check-in di ACE,
   **When** fa login, **Then** vede il menu admin e accede a permessi,
   impostazioni, log e vista amministratore bandi.
2. **Given** un utente a cui il ruolo è stato revocato in ACE, **When** fa di
   nuovo login, **Then** non vede più le funzioni admin.
3. **Given** un utente con ruoli ACE solo in un altro contesto, **When** fa
   login, **Then** non ottiene alcun privilegio nell'applicativo.

---

### User Story 3 - Esperti informatici assegnati dall'amministratore ACE (Priority: P2)

Una persona con il ruolo amministratore ACE apre "Gestione permessi" e
aggiunge o rimuove gli esperti informatici nel registro locale, come oggi. Gli
esperti aggiunti compaiono subito nell'elenco selezionabile da segretario e
referente, anche se non hanno mai fatto login; una volta assegnati a una
sessione possono aprirla in vista esperto.

**Why this priority**: la scelta dell'esperto in configurazione resta
obbligatoria e avviene da un elenco chiuso; chi lo alimenta deve essere
l'amministratore riconosciuto da ACE, non più un amministratore del solo
registro locale.

**Independent Test**: con un utente amministratore ACE aggiungere un esperto in
"Gestione permessi", verificare che compaia nell'elenco in configurazione
sessione, assegnarlo a una sessione e verificare il suo accesso in vista
esperto; rimuoverlo e verificare che scompaia dall'elenco.

**Acceptance Scenarios**:

1. **Given** un utente con ruolo amministratore ACE, **When** aggiunge un
   esperto in "Gestione permessi", **Then** l'esperto compare nell'elenco degli
   esperti remoti in configurazione sessione e bando, senza dover prima fare
   login.
2. **Given** un esperto assegnato a una sessione, **When** apre la dashboard
   esperto, **Then** vede la sessione e può scaricare le liste.
3. **Given** un esperto rimosso dall'amministratore, **When** il segretario apre
   la configurazione, **Then** l'esperto non compare più tra le scelte e non
   accede più alla vista esperto.
4. **Given** un utente senza ruolo amministratore ACE, **When** prova ad aprire
   "Gestione permessi", **Then** l'accesso è negato.

---

### User Story 4 - Passaggio graduale e reversibile (Priority: P2)

L'amministratore tecnico attiva la nuova modalità per gradi: prima i ruoli
vengono letti sia dal registro locale sia da ACE, poi solo da ACE. In caso di
problemi può tornare al client e alla fonte ruoli precedenti con la sola
configurazione, senza perdere dati.

**Why this priority**: l'applicativo è in collaudo con utenti reali; un cambio
di autenticazione non reversibile metterebbe a rischio le sessioni in corso.

**Independent Test**: commutare la fonte ruoli tra registro locale, ACE ed
entrambe e verificare il comportamento; tornare al client attuale e verificare
che login e ruoli funzionino come prima.

**Acceptance Scenarios**:

1. **Given** fonte ruoli "entrambe", **When** un utente ha il ruolo nel registro
   locale ma non in ACE, **Then** mantiene il privilegio.
2. **Given** fonte ruoli "solo ACE", **When** un utente ha il ruolo solo nel
   registro locale, **Then** non ottiene il privilegio.
3. **Given** un problema in produzione, **When** si ripristina la configurazione
   precedente, **Then** gli utenti accedono di nuovo con il client attuale e i
   ruoli del registro locale, senza perdita di configurazioni di bandi e
   sessioni.

---

### User Story 5 - Login, logout e sessione invariati (Priority: P3)

Per l'utente il cambio è trasparente: entra con le credenziali CNR, il rinnovo
automatico della sessione funziona, il logout lo disconnette davvero e la
sessione scaduta lo riporta alla pagina corretta.

**Why this priority**: sono comportamenti già collaudati (feature 003, 008);
vanno preservati, non riprogettati.

**Independent Test**: ripetere sul nuovo client i casi di collaudo 003 e 008:
login, rinnovo, logout, sessione scaduta.

**Acceptance Scenarios**:

1. **Given** un utente CNR, **When** fa login, **Then** accede senza passaggi
   aggiuntivi rispetto a oggi.
2. **Given** una sessione attiva vicina alla scadenza, **When** l'utente continua
   a lavorare, **Then** la sessione viene rinnovata senza nuovo login.
3. **Given** un utente autenticato, **When** fa logout, **Then** tornando
   indietro gli viene richiesto il login.

---

### Edge Cases

- Utente autenticato con il vecchio client al momento del passaggio: il rinnovo
  della sessione fallisce e deve essere richiesto un nuovo login, senza errori
  non gestiti.
- Token del nuovo client privo delle informazioni di contesto ACE (mapper non
  configurato o utente senza ruoli): l'utente accede come utente base, senza
  privilegi globali; l'anomalia viene registrata nei log.
- Token privo di `is_cnr_user` o con valore falso: accesso negato come oggi.
- Token privo di `username_cnr`: Selezioni Online non riconoscerebbe l'utente
  CNR; il login deve essere rifiutato o segnalato in modo esplicito invece di
  produrre risultati vuoti da Selezioni Online.
- Utente con ruoli ACE in più contesti: valgono solo quelli del contesto
  check-in.
- Ruolo ACE con nome non configurato nella mappatura: viene ignorato, nessun
  privilegio derivato dal nome.
- Token emesso da un client diverso da quelli ammessi: rifiutato.
- Amministratore ACE a cui il ruolo viene revocato: gli esperti che aveva
  aggiunto restano nel registro e continuano a funzionare finché un altro
  amministratore non li rimuove.
- Nessun utente con ruolo amministratore ACE: il registro esperti resta
  utilizzabile in lettura (elenco in configurazione) ma nessuno può modificarlo;
  con fonte ruoli "entrambe" resta valido l'amministratore del registro locale.
- Orologio dell'identity provider sfasato: si applica la tolleranza già
  introdotta (fino a 120 secondi su emissione del token).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il sistema MUST autenticare gli utenti tramite un client
  dedicato all'applicativo nel realm istituzionale, distinto da quello di
  Selezioni Online.
- **FR-002**: Il sistema MUST accettare solo token emessi per i client
  ammessi, configurati come elenco, e rifiutare gli altri.
- **FR-003**: Il sistema MUST continuare a negare l'accesso a utenti non CNR,
  come oggi.
- **FR-004**: Il sistema MUST continuare a invocare le cinque operazioni di
  Selezioni Online con l'identità dell'utente autenticato, ottenendo gli stessi
  risultati del client attuale.
- **FR-005**: Prima di qualunque modifica applicativa, MUST essere eseguita e
  documentata una verifica che Selezioni Online accetti il token del nuovo
  client e riconosca lo stesso utente. In caso negativo, la feature MUST
  adottare un'alternativa documentata (destinatario del token aggiuntivo verso
  Selezioni Online oppure scambio di token) prima di proseguire.
- **FR-006**: Il sistema MUST leggere i ruoli dell'utente dal contesto ACE
  dedicato all'applicativo, ignorando i ruoli di altri contesti.
- **FR-007**: Il sistema MUST tradurre i ruoli ACE in ruoli applicativi tramite
  una mappatura esplicita e configurabile. In questa fase la mappatura contiene
  un solo ruolo ACE, che concede i privilegi di amministratore globale. Ruoli
  non mappati non concedono privilegi.
- **FR-008**: Il sistema MUST permettere di scegliere la fonte del ruolo
  amministratore tra registro locale, ACE o entrambe (unione), tramite
  configurazione.
- **FR-009**: I ruoli letti da ACE MUST essere aggiornati a ogni login e a ogni
  rinnovo della sessione, così che una revoca abbia effetto al più tardi alla
  scadenza del token.
- **FR-010**: Segretario, referente/RDP, informatico in sede ed esperto
  assegnato alla sessione MUST continuare a essere determinati come oggi, da
  Selezioni Online e dalla configurazione della sessione; la feature non li
  sposta in ACE.
- **FR-011**: Il ruolo esperto informatico MUST restare nel registro locale e
  l'elenco degli esperti remoti selezionabili in configurazione MUST continuare
  a leggerlo da lì, indipendentemente dal login degli esperti.
- **FR-012**: Il ruolo amministratore ricevuto da ACE MUST abilitare la gestione
  degli esperti informatici nel registro locale (aggiunta e rimozione dalla
  pagina "Gestione permessi") e tutte le altre funzioni oggi riservate
  all'amministratore globale.
- **FR-013**: Login, rinnovo della sessione, logout, tolleranza sullo
  sfasamento dell'orologio e reindirizzamento per sessione scaduta MUST
  funzionare con il nuovo client come con quello attuale.
- **FR-014**: Il ritorno al client e alla fonte ruoli precedenti MUST essere
  possibile con la sola configurazione, senza migrazioni di dati.
- **FR-015**: Il sistema MUST registrare nei log, senza dati sensibili del
  token, i casi di token rifiutato, client non ammesso, contesto ACE assente e
  ruoli ACE non mappati.
- **FR-016**: La pagina "Gestione permessi" MUST indicare che il ruolo
  amministratore proviene da ACE e, con fonte "solo ACE", non deve permettere di
  concedere localmente il ruolo amministratore, che non avrebbe effetto. La
  gestione degli esperti informatici resta invariata.

### Key Entities

- **Client dell'applicativo**: identità dell'applicativo presso l'identity
  provider; ha indirizzi di ritorno per login e logout per test e produzione e
  definisce quali informazioni entrano nei token.
- **Contesto ACE check-in**: ambito di autorizzazione dell'applicativo in ACE;
  contiene i ruoli assegnabili alle persone.
- **Ruolo ACE**: ruolo di una persona nel contesto check-in; in questa fase
  solo amministratore.
- **Mappatura ruoli**: corrispondenza configurata tra ruolo ACE e ruolo
  applicativo (ruolo ACE amministratore → amministratore globale).
- **Ruolo applicativo globale**: amministratore globale (da ACE e/o registro
  locale secondo la fonte configurata) o esperto informatico (sempre dal
  registro locale, gestito dall'amministratore).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In test, il 100% dei profili (segretario, referente, informatico
  in sede, esperto remoto, amministratore) accede con il nuovo client e
  raggiunge la propria dashboard.
- **SC-002**: Per un segretario e un referente di test, le cinque operazioni
  verso Selezioni Online restituiscono gli stessi risultati del client attuale
  (stessi bandi, stesse sessioni, stesso numero di candidati importati).
- **SC-003**: Il ruolo amministratore assegnato o revocato in ACE ha effetto
  nell'applicativo al login successivo dell'utente, senza interventi sul
  registro locale.
- **SC-007**: Un esperto aggiunto da un amministratore ACE compare nell'elenco
  di configurazione sessione al primo ricaricamento della pagina, senza che
  l'esperto abbia mai fatto login.
- **SC-004**: Il ritorno alla configurazione precedente richiede meno di 15
  minuti e nessuna perdita di configurazioni di bandi e sessioni.
- **SC-005**: Nessun utente privo della qualifica CNR e nessun token di un
  client non ammesso ottiene accesso nei test negativi.
- **SC-006**: I casi di collaudo di login, logout e sessione scaduta delle
  feature 003 e 008 passano tutti con il nuovo client.

## Assumptions

- Il nome del contesto ACE è `checkin-concorsi` e l'unico ruolo è `ADMIN`;
  nomi definitivi da concordare con chi gestisce ACE, e comunque configurabili.
  Un eventuale ruolo ACE per gli esperti sarà valutato in una fase successiva.
- Le informazioni CNR oggi presenti nel token del client `selezioni`
  (`is_cnr_user`, `username_cnr`, `matricola_cnr`, `livello`) possono essere
  aggiunte anche al nuovo client con gli stessi nomi.
- La verifica dei token avviene sull'id token, che per standard porta come
  destinatario il client che ha fatto il login: il problema dei token ACE privi
  di destinatario, emerso in GEMODO per gli access token di client pubblici, non
  si presenta per l'id token.
- La configurazione di produzione di Selezioni Online può differire da quella
  del repository: per questo la verifica di FR-005 va ripetuta anche in
  produzione prima del passaggio.
- La feature non richiede nuovi ruoli applicativi: sposta in ACE solo
  l'amministratore; esperto informatico resta locale; un eventuale ruolo
  "informatico in sede" come qualifica resta fuori ambito.
- Fuori ambito: modifica della logica di autorizzazione per bando e sessione,
  modifiche a Selezioni Online, nuovi profili utente, utenza di servizio per
  Selezioni Online (feature 003, T026).
- Tocca autenticazione/sessione, autorizzazioni e integrazione con Selezioni
  Online; non tocca macchina a stati, schema delle sessioni né generazione liste.
