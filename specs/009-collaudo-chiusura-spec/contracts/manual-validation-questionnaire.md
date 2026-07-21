# Questionario collaudo manuale per chiusura spec

Compilare una risposta per ogni domanda usando:

- `PASS`: comportamento atteso confermato
- `FAIL`: comportamento diverso dall'atteso, serve fix o analisi
- `BLOCCATO`: test non eseguibile per dato/servizio/utente mancante
- `NON TESTATO`: test rimandato

Per ogni `FAIL` indicare: utente usato, URL, azione, risultato osservato,
risultato atteso e screenshot/log se disponibili.

## Dati iniziali della sessione

1. Ambiente testato: `test` / `produzione` / altro?
2. URL base usata?
3. Versione visibile nel footer?
4. Data e ora del collaudo?
5. Browser e dispositivo usati?
6. Il deploy appena fatto e' visibile dalla versione nel footer?
7. Sono state usate tab aperte prima del deploy o solo nuove tab?

## Utenti disponibili

Compilare email o descrizione, anche parziale se non si vuole riportare l'email
completa.

1. Admin globale usato?
2. Segretario operativo usato?
3. Referente/RDP usato?
4. Esperto informatico da remoto assegnato usato?
5. Esperto informatico globale non assegnato a un bando usato?
6. Informatico in sede assegnato usato?
7. Utente CNR non assegnato usato?
8. Per ogni utente, il ruolo/assegnazione su Selezioni Online e configurazione
   locale erano noti prima del test?

## Spec 007 - Profili informatici assegnati

### Dashboard informatico in sede

1. Con utente informatico in sede assegnato, aprendo `/bandi?mode=sede`, vede
   solo i bandi/sessioni assegnati?
2. Con utente segretario non assegnato come informatico in sede, aprendo
   `/bandi?mode=sede`, non vede bandi/sessioni tecniche?
3. Con utente membro commissione non assegnato come informatico in sede, aprendo
   `/bandi?mode=sede`, viene bloccato o vede lista vuota?
4. Con utente CNR non assegnato, aprendo `/bandi?mode=sede`, non vede dati
   operativi?
5. Con link diretto a `/sessioni/<id>?mode=sede`, un utente non assegnato viene
   bloccato?
6. Con admin globale su vista sede non assegnata, la pagina si apre solo come
   supporto e mostra avviso amministrativo?
7. Se una sessione non ha `email_informatico_sede`, nessun non-admin riesce ad
   aprirla in modalita sede?
8. L'informatico in sede riesce a segnare/rimuovere richiesta reset password
   candidato nella propria sessione?

### Dashboard esperto remoto

1. Con esperto remoto assegnato, aprendo `/bandi?mode=expert`, vede solo i bandi
   dove e' configurato come `email_esperto_remoto`?
2. Con esperto globale non assegnato al bando, quel bando non compare nella
   dashboard esperto?
3. Con link diretto a `/sessioni/<id>?mode=expert`, un esperto globale non
   assegnato viene bloccato?
4. Con referente/RDP non configurato come esperto remoto, la vista esperto viene
   bloccata?
5. Con segretario non configurato come esperto remoto, la vista esperto viene
   bloccata?
6. Con admin globale su vista esperto non assegnata, la pagina si apre solo come
   supporto e mostra avviso amministrativo?
7. Se il bando non ha `email_esperto_remoto`, nessun non-admin riesce ad aprire
   la vista esperto?
8. L'esperto remoto assegnato riesce a vedere i reset richiesti e segnare/annullare
   il reset eseguito?

### Decisione 007

1. Tutti gli scenari critici sono `PASS`?
2. Ci sono `FAIL` che indicano dati configurati male anziche' bug applicativi?
3. La spec 007 puo' essere chiusa?
4. Se no, quale fix va aperto?

## Spec 006 - Cutover Angular e legacy

### Navigazione Angular

1. La Home mostra i profili attesi e i link portano a pagine Angular?
2. `/bandi` apre dashboard segretario Angular?
3. `/referenti/bandi` apre dashboard referente Angular?
4. `/bandi?mode=sede` apre dashboard informatico in sede Angular?
5. `/bandi?mode=expert` apre dashboard esperto Angular?
6. `/bandi?mode=admin` apre dashboard admin Angular?
7. I refresh browser su Home, dashboard, sessioni, gestione sessione e scanner
   non portano a 404 o pagina legacy?
8. I deep link post-login riportano alla route Angular corretta?

### Flussi operativi

1. Segretario: vede bandi autorizzati, sessioni e gestione sessione?
2. Segretario: scarica candidati solo quando e' autorizzato da Selezioni Online?
3. Informatico in sede: ricerca/filtri candidati e reset password funzionano?
4. Esperto remoto: reset richiesti e workflow esame funzionano?
5. Scanner: camera reale legge QR sessione e QR candidato?
6. Scanner: registrazione dispositivo, check-in e disassociazione funzionano?
7. Liste: generazione, download XLSX/CSV e invio liste funzionano?
8. Notifiche/log operativi principali sono visibili dove previsto?

### Legacy

1. Durante i flussi sopra compare una pagina HTML legacy non prevista?
2. Se compare, ha badge/indicazione legacy?
3. Le route legacy inventariate redirigono o restano disponibili solo come
   endpoint tecnico previsto?
4. API, login/logout/callback, healthcheck, QR/PDF/download restano disponibili?

### Decisione 006

1. Tutti gli scenari critici sono `PASS`?
2. Restano pagine legacy visibili all'utente finale?
3. La spec 006 puo' essere chiusa?
4. Se no, quale route/flusso va corretto?

## Spec 008 - Sessione scaduta e redirect login

1. Lasciando una pagina aperta fino a scadenza sessione/token, una nuova azione
   protetta porta al login invece di mostrare errore generico?
2. Dopo login, l'utente torna alla pagina o flusso corretto?
3. Se il token e' scaduto durante "scarica candidati", il messaggio e' di
   riautenticazione e non di errore generico Selezioni Online?
4. Se Selezioni Online nega realmente il permesso con sessione valida, il
   messaggio resta operativo e non porta al login?
5. Se piu' chiamate falliscono insieme per sessione scaduta, appare un solo
   comportamento coerente e non una raffica di errori?
6. Utente non-admin e admin hanno lo stesso comportamento di riautenticazione
   quando la sessione scade?

### Decisione 008

1. Il comportamento e' gia' accettabile oppure serve implementare/fissare la spec
   008?
2. Quali schermate mostrano ancora messaggi fuorvianti?
3. La spec 008 puo' essere pianificata come prossimo fix?

## Spec 003 - Coolify e ambiente

1. Il dominio test risponde correttamente?
2. Il login OIDC reale su test funziona?
3. Il footer mostra una versione coerente con il deploy atteso?
4. Lo smoke test sul dominio test passa?
5. Le variabili test sono distinte da produzione?
6. Produzione resta non promossa finche' non viene presa decisione esplicita?

### Decisione 003

1. I task test possono essere chiusi?
2. I task produzione restano aperti intenzionalmente?
3. Serve ancora definire utenza di servizio per Selezioni Online/JConon?

## Matrice finale di chiusura

Compilare una riga per ogni spec.

| Spec | Esito | Motivazione | Fix/task da aprire |
|------|-------|-------------|--------------------|
| 006 Cutover Angular |  |  |  |
| 007 Profili informatici |  |  |  |
| 008 Sessione scaduta |  |  |  |
| 003 Coolify |  |  |  |

Valori ammessi per `Esito`: `CHIUDERE`, `TENERE APERTA`, `APRIRE FIX`,
`BLOCCATA DA DATO ESTERNO`.
