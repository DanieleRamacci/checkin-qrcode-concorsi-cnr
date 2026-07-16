# Feature Specification: Redirect coerente per sessione scaduta

**Feature Branch**: `008-reauth-session-redirect`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Se scade il token a volte apre le pagine e non se ne accorge, poi mostra errori come impossibile scaricare dati da Selezioni Online invece di fare sempre redirect al login. Analizzare e creare una spec."

## Analisi osservata

L'applicazione puo avere una sessione applicativa ancora presente mentre il token
OIDC usato per chiamare Selezioni Online non e' piu valido o non e' piu
rinnovabile. In questa condizione alcune pagine Angular continuano ad aprirsi
perche' il contesto utente locale risulta ancora caricato, ma le operazioni che
richiedono token OIDC fresco falliscono e possono mostrare errori operativi
generici, ad esempio riferiti a Selezioni Online.

La correzione deve rendere uniforme il comportamento: quando il problema e'
autenticativo, l'utente deve essere portato a rifare login, non lasciato dentro
una pagina apparentemente valida con azioni che falliscono in modo fuorviante.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Redirect automatico quando la sessione non e' piu valida (Priority: P1)

Un utente resta sulla piattaforma abbastanza a lungo da avere token OIDC scaduto
o non rinnovabile. Quando apre una pagina o compie un'azione che richiede
autenticazione valida, il sistema riconosce la condizione e lo manda al login,
con ritorno alla pagina che stava usando.

**Why this priority**: evita errori operativi falsi, riduce confusione durante
le prove e impedisce di continuare a usare una UI che non puo piu autorizzare le
operazioni richieste.

**Independent Test**: simulare una sessione applicativa presente ma token OIDC
non rinnovabile; aprire una pagina Angular protetta e avviare un'azione che
richiede autenticazione fresca; verificare che il sistema avvii il login invece
di mostrare un errore generico.

**Acceptance Scenarios**:

1. **Given** l'utente ha sessione applicativa presente ma token OIDC non
   rinnovabile, **When** apre una pagina protetta, **Then** viene richiesto nuovo
   login prima di mostrare dati operativi non piu aggiornabili.
2. **Given** l'utente ha sessione scaduta durante l'uso della pagina, **When**
   esegue un'azione che richiede autenticazione valida, **Then** viene
   reindirizzato al login mantenendo la destinazione di ritorno.
3. **Given** l'utente completa il login, **When** torna alla piattaforma,
   **Then** riprende dalla pagina o dal flusso che stava usando, se ancora
   autorizzato.

---

### User Story 2 - Errori SOL distinti da problemi di autenticazione (Priority: P1)

Un utente avvia una sincronizzazione o un download da Selezioni Online. Se il
fallimento dipende dalla sessione utente, vede richiesta di login; se dipende
dal servizio esterno o dai permessi SOL, vede un messaggio operativo specifico.

**Why this priority**: oggi un problema di token puo essere percepito come
problema di Selezioni Online o di permessi sul bando, rendendo piu difficile
capire cosa fare.

**Independent Test**: simulare separatamente token scaduto, servizio esterno non
raggiungibile e permesso SOL negato; verificare che i tre casi producano
comportamenti distinti.

**Acceptance Scenarios**:

1. **Given** il token OIDC non e' rinnovabile, **When** l'utente scarica
   candidati o sincronizza dati, **Then** viene richiesto nuovo login.
2. **Given** Selezioni Online risponde con errore tecnico ma la sessione utente
   e' valida, **When** l'operazione fallisce, **Then** il messaggio indica un
   problema del servizio esterno e non avvia login.
3. **Given** Selezioni Online rifiuta l'operazione per permessi o abilitazione,
   **When** l'operazione fallisce, **Then** il messaggio spiega il vincolo
   operativo senza confonderlo con sessione scaduta.

---

### User Story 3 - Messaggio chiaro prima del redirect quando utile (Priority: P2)

Quando una sessione scade durante un'attivita, l'utente riceve un'indicazione
breve che deve autenticarsi di nuovo, evitando che sembri un blocco casuale o un
errore del bando.

**Why this priority**: migliora l'esperienza durante collaudi e prove reali,
specialmente su pagine lasciate aperte a lungo.

**Independent Test**: lasciare una pagina aperta, invalidare la sessione e
attivare un'azione; verificare che la comunicazione sia comprensibile e che il
redirect avvenga senza perdita del contesto navigabile.

**Acceptance Scenarios**:

1. **Given** la pagina e' aperta e la sessione scade, **When** l'utente compie
   una nuova azione, **Then** vede una comunicazione chiara di riautenticazione.
2. **Given** piu richieste falliscono insieme per sessione scaduta, **When** il
   sistema avvia il login, **Then** non mostra una raffica di messaggi duplicati.

### Edge Cases

- Sessione applicativa presente, ma access token OIDC scaduto e refresh token
  assente o non valido.
- Sessione applicativa completamente assente.
- Pagina Angular gia caricata che effettua chiamate API successive.
- Chiamate multiple contemporanee che ricevono errore di riautenticazione.
- Operazione di download candidati fallita per permesso SOL reale, non per
  sessione scaduta.
- Servizio Selezioni Online non raggiungibile con sessione utente valida.
- Link diretto o bookmark aperto dopo scadenza sessione.
- Redirect post-login con URL di ritorno non sicuro o non locale.
- Mutazioni con token di protezione applicativa scaduto o mancante.
- Scanner o device token: il comportamento di riautenticazione SSO non deve
  invalidare i controlli dedicati dei dispositivi.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Il sistema DEVE distinguere una sessione applicativa mancante da
  una sessione presente ma non piu utilizzabile per operazioni che richiedono
  token OIDC valido.
- **FR-002**: Ogni risposta applicativa che indica necessita' di
  riautenticazione DEVE produrre un comportamento utente coerente di ritorno al
  login.
- **FR-003**: Le pagine protette NON DEVONO mostrare dati operativi come se la
  sessione fosse pienamente valida quando il sistema sa gia che il token utente
  non e' piu rinnovabile.
- **FR-004**: Le operazioni verso Selezioni Online che falliscono per token
  utente scaduto o non rinnovabile DEVONO essere presentate come richiesta di
  nuovo login, non come errore generico di Selezioni Online.
- **FR-005**: Gli errori di Selezioni Online con sessione utente valida DEVONO
  restare distinti dai casi di riautenticazione.
- **FR-006**: Il redirect al login DEVE conservare una destinazione di ritorno
  locale e sicura verso la pagina che l'utente stava usando.
- **FR-007**: Se piu richieste simultanee richiedono riautenticazione, il sistema
  DEVE avviare un solo flusso di login percepibile dall'utente.
- **FR-008**: L'utente DEVE ricevere un messaggio breve e comprensibile quando
  una sessione scaduta interrompe un'azione gia avviata.
- **FR-009**: Dopo il nuovo login, l'utente DEVE tornare alla pagina richiesta
  solo se e' ancora autorizzato a visualizzarla.
- **FR-010**: I messaggi di permesso operativo, ad esempio utente non abilitato
  su Selezioni Online, NON DEVONO attivare redirect al login se la sessione e'
  valida.
- **FR-011**: I log o dettagli tecnici DEVONO permettere di distinguere
  riautenticazione, servizio esterno non disponibile e permesso negato.
- **FR-012**: La documentazione operativa DEVE spiegare il comportamento atteso
  quando una pagina resta aperta e il token utente scade.

### Key Entities

- **Stato autenticazione utente**: condizione percepita dall'applicazione per
  decidere se l'utente puo continuare o deve rifare login.
- **Richiesta di riautenticazione**: risposta o evento che comunica che la
  sessione non e' piu sufficiente per proseguire.
- **Destinazione di ritorno**: pagina locale e sicura a cui riportare l'utente
  dopo login.
- **Errore operativo esterno**: fallimento di Selezioni Online o di un servizio
  collegato che non dipende dalla scadenza della sessione utente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nel 100% dei test con sessione non piu rinnovabile, l'utente viene
  indirizzato al login invece di vedere errori generici di caricamento o SOL.
- **SC-002**: Nel 100% dei test con permesso SOL negato ma sessione valida,
  l'utente vede un messaggio operativo specifico e non viene mandato al login.
- **SC-003**: Nel 100% dei test con servizio esterno non disponibile ma sessione
  valida, il messaggio resta distinto dalla riautenticazione.
- **SC-004**: Nel 100% dei test di link diretto o bookmark dopo scadenza
  sessione, il login conserva una destinazione di ritorno locale e sicura.
- **SC-005**: In caso di richieste multiple simultanee scadute, l'utente osserva
  un solo flusso di riautenticazione, senza messaggi duplicati incoerenti.
- **SC-006**: Nei collaudi manuali, l'utente riesce a distinguere in meno di 10
  secondi se deve rifare login o se il problema riguarda Selezioni Online.

## Assumptions

- Il login SSO esistente resta il meccanismo di autenticazione.
- La correzione riguarda prima di tutto le pagine Angular e le API applicative
  usate da esse.
- Le risposte applicative possono gia distinguere, o dovranno distinguere,
  richiesta di riautenticazione, errore esterno e permesso negato.
- Il redirect post-login deve continuare ad accettare solo URL locali e sicuri.
- I flussi scanner con token dispositivo restano governati dalle proprie regole
  di autorizzazione.
