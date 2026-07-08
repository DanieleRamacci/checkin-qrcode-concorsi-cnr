# Quickstart: validazione accesso referente/RDP configurazione bando

## Prerequisites

- Branch di lavoro della migrazione aggiornato.
- Ambiente locale o test con OIDC funzionante.
- Almeno due utenti di prova:
  - un informatico/admin o owner del bando;
  - un referente/RDP con email istituzionale.
  - un segretario o membro di commissione gia autorizzato sul bando, quando il
    caso deve essere validato.
- Almeno due bandi sincronizzati:
  - bando A assegnato al referente di prova;
  - bando B non assegnato allo stesso referente.

## Scenario 1: sincronizzazione e assegnazione referente

1. Accedere come informatico/admin.
2. Aprire la configurazione del bando A.
3. Sincronizzare i metadati istituzionali del bando.
4. Verificare che il referente/RDP venga proposto quando il dato contiene email.
5. Inviare la richiesta di configurazione.

Expected:

- esiste una assegnazione attiva per bando A e referente;
- lo stato passa a `requested`;
- viene registrato audit `request_sent`;
- nessun permesso viene concesso su bando B.

## Scenario 2: accesso referente

1. Accedere come referente/RDP.
2. Aprire l'area "I miei bandi da configurare".
3. Verificare l'elenco.
4. Aprire bando A.

Expected:

- bando A e visibile;
- bando B non e visibile;
- il form permette la modifica della configurazione bando ma blocca il cambio
  del referente/RDP;
- l'accesso diretto a bando B restituisce accesso negato.

## Scenario 3: compilazione e completamento

1. Accedere come referente/RDP tramite il nuovo flusso.
2. Salvare una modifica ammessa.
3. Completare la configurazione.
4. Riaprire come informatico/admin.

Expected:

- lo stato passa da `requested` a `in_progress` dopo il primo salvataggio;
- lo stato passa a `completed` dopo conferma finale;
- audit registra `config_saved` e `completed`;
- l'informatico/admin vede lo stato completato.
- il referente/RDP assegnato non puo essere cambiato dal referente/RDP senza
  permesso ulteriore.

## Scenario 3b: segretario o membro commissione

1. Accedere come segretario o membro commissione gia autorizzato.
2. Aprire Configura Bando tramite il flusso esistente.
3. Modificare la configurazione bando.

Expected:

- l'accesso non usa la nuova assegnazione RDP/referente;
- la configurazione puo essere salvata;
- il referente/RDP assegnato non puo essere cambiato senza permesso ulteriore.

## Scenario 4: eccezione manuale

1. Accedere come informatico/admin.
2. Aprire un bando senza email referente disponibile da fonte istituzionale.
3. Inserire manualmente il referente con motivazione.
4. Inviare richiesta.

Expected:

- l'assegnazione manuale richiede motivazione;
- l'assegnazione e marcata come eccezione;
- il referente puo accedere solo a quel bando;
- audit registra `manual_override` e `request_sent`.

## Scenario 5: credenziali personali

1. Censire i flussi che chiamano Selezioni Online/JConon.
2. Classificare ogni flusso come token utente, utenza applicativa, credenziale
   personale o non richiesto.
3. Verificare quelli necessari per test stabile e produzione.

Expected:

- il flusso API v1 `sync-meta` per RDP/commissione usa token OIDC dell'utente
  loggato come modalita primaria;
- e documentato l'esito del test con token OIDC di referente/RDP e segretario
  non admin;
- la utenza di servizio/applicativa resta fallback solo se il test dimostra che
  i dati RDP/commissione non vengono restituiti;
- eventuali flussi legacy che usano `JCONON_USERNAME`/`JCONON_PASSWORD` o altri
  segreti env sono marcati come temporanei;
- nessun flusso necessario alla feature in produzione resta classificato come
  credenziale personale;
- dove servisse una utenza applicativa, il blocco e esplicito finche non viene
  fornita.

## Scenario 5b: verifica OIDC con utenza non admin

1. Accedere come referente/RDP non admin.
2. Dalla home aprire la scheda "Referenti".
3. Verificare la chiamata a `/api/v1/referenti/bandi/sync`.
4. Se il bando compare, aprire "Configura bando".
5. Ripetere, se necessario, con segretario o membro commissione non admin.

Expected:

- con referente/RDP, Selezioni Online restituisce il bando di competenza e i
  dati `rdps`/`commissioners` necessari;
- se l'utente non riceve `rdps`/`commissioners`, la evidenza viene documentata e
  attiva la valutazione della utenza di servizio fallback;
- l'utente finale resta comunque tracciato come attore applicativo della
  richiesta o modifica.

## Scenario 6: cambio RDP dopo configurazione

1. Configurare un bando con RDP A.
2. Marcare la configurazione come completata.
3. Sincronizzare una variazione in cui il bando risulta collegato a RDP B.
4. Accedere o tentare una modifica come RDP A.

Expected:

- il bando gia configurato non viene bloccato;
- RDP A non puo effettuare nuove modifiche come referente/RDP del bando;
- il rifiuto e chiaro e tracciato;
- informatico/admin o utenti gia autorizzati dal flusso commissione/sessione
  possono continuare a gestire la configurazione.

## Test Commands

Indicativi per la fase di implementazione:

```bash
pytest
npm --prefix frontend test
npm --prefix frontend run build
```

I comandi effettivi e i test specifici verranno dettagliati in `tasks.md`.
