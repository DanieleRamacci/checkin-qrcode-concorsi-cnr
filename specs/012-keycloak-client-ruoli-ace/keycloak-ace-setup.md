# Configurazione client Keycloak e contesto ACE per Check-in Concorsi

Riferimento: [spec 012](spec.md). Modello di riferimento: GEMODO
(`builder-modello-bando`, ADR-0003 "Accesso utenti tramite contesti ACE").

Stato: proposta da concordare con chi gestisce Keycloak e ACE. Nomi di
contesto e ruoli sono configurabili nell'applicativo.

## 1. Client Keycloak `checkin-concorsi`

Realm: `cnr`, sia in test sia in produzione.

| Impostazione | Valore |
| --- | --- |
| Client ID | `checkin-concorsi` |
| Protocollo | openid-connect |
| Tipo di accesso | confidenziale (Keycloak recenti: "Client authentication" = On) |
| Standard flow (authorization code) | On |
| Implicit flow | Off |
| Direct access grants | Off |
| Service accounts | Off |
| Valid redirect URIs | `https://test-checkin.concorsi.cnr.it/oidc-callback`, `https://checkin.concorsi.cnr.it/oidc-callback` |
| Valid post logout redirect URIs | `https://test-checkin.concorsi.cnr.it/logged-out`, `https://checkin.concorsi.cnr.it/logged-out` |
| Web origins | `https://test-checkin.concorsi.cnr.it`, `https://checkin.concorsi.cnr.it` |

Note:

- Nelle versioni di Keycloak senza il campo "Valid post logout redirect URIs",
  l'indirizzo di logout va aggiunto anche tra i "Valid redirect URIs".
- Se serve uno sviluppo locale, aggiungere solo nel realm di test l'URI di
  callback locale usato dagli sviluppatori.
- Il segreto del client va consegnato in modo riservato e configurato come
  variabile d'ambiente sull'ambiente Coolify, distinto tra test e produzione.

## 2. Informazioni da inserire nei token (mapper)

Ogni mapper va attivato su **ID token**, **access token** e **userinfo**.

| Claim | Tipo | Perché serve | Come configurarlo |
| --- | --- | --- | --- |
| `email` | stringa | Identità dell'utente nell'applicativo | scope standard `email` |
| `preferred_username`, `name`, `given_name`, `family_name` | stringa | Nome visualizzato | scope standard `profile` |
| `is_cnr_user` | booleano | L'applicativo nega l'accesso ai non CNR; Selezioni Online lo usa per riconoscere l'utente CNR | copiare il mapper del client `selezioni` |
| `username_cnr` | stringa | Selezioni Online identifica l'utente CNR con questo valore | copiare il mapper del client `selezioni` |
| `matricola_cnr` | stringa | Letto da Selezioni Online | copiare il mapper del client `selezioni` |
| `livello` | stringa | Letto da Selezioni Online | copiare il mapper del client `selezioni` |
| `contexts.checkin-concorsi.roles` | lista | Ruoli dell'applicativo gestiti in ACE | mapper ACE sul contesto `checkin-concorsi` |

Se nel client `selezioni` questi claim arrivano da uno scope condiviso, basta
assegnare lo stesso scope al client `checkin-concorsi`.

**Da aggiungere solo se la verifica del punto 5 fallisce per il destinatario
del token**: un audience mapper che aggiunga `selezioni` all'access token.

## 3. Contesto e ruoli ACE

Contesto: `checkin-concorsi`.

In questa fase il contesto ha **un solo ruolo**:

| Ruolo ACE | Ruolo nell'applicativo | Cosa abilita |
| --- | --- | --- |
| `ADMIN` | amministratore globale | Menu admin: gestione permessi (inclusa l'assegnazione degli esperti informatici), impostazioni, log, vista amministratore bandi; accesso di supporto a tutti i bandi e sessioni |

Restano **fuori da ACE**:

| Profilo | Da dove viene |
| --- | --- |
| Esperto informatico (qualifica) | Registro locale dell'applicativo, alimentato dall'amministratore ACE dalla pagina "Gestione permessi" |
| Segretario | Componente SEGRETARIO della commissione, dalle API di Selezioni Online |
| Referente / RDP | RDP del bando, dalle API di Selezioni Online |
| Informatico in sede | Email indicata nella configurazione della sessione |
| Esperto remoto della sessione | Email scelta nella configurazione della sessione, tra gli esperti del registro locale |

Assegnazioni iniziali in ACE: chi oggi è amministratore nel registro locale.
L'elenco si estrae dal database dell'applicativo con:

```sql
SELECT user_email FROM user_roles WHERE role = 'admin_globale' ORDER BY user_email;
```

Gli esperti informatici già presenti nel registro locale restano dove sono e
non vanno inseriti in ACE.

## 4. Cosa non serve mappare da Selezioni Online

Dal token del client `selezioni` l'applicativo oggi non legge ruoli: legge solo
`is_cnr_user`, `email`, nome utente e identificativo. I "ruoli" segretario e
referente arrivano dalle **API** di Selezioni Online, chiamate con il token
dell'utente. Per questo non va replicato nessun ruolo del client `selezioni`:
serve solo che Selezioni Online accetti il nuovo token e riconosca lo stesso
utente (claim `is_cnr_user` e `username_cnr`).

## 5. Verifica preliminare (bloccante)

Da eseguire nel realm di test appena il client esiste, e di nuovo in
produzione prima del passaggio.

1. Fare login sul client `checkin-concorsi` con un utente che è segretario di
   almeno un bando su Selezioni Online e ottenere id token e access token.
2. Decodificare i token e controllare:
   - `azp` = `checkin-concorsi`;
   - `aud` dell'id token contiene `checkin-concorsi`;
   - `is_cnr_user` = true e `username_cnr` valorizzato;
   - `contexts.checkin-concorsi.roles` presente per un utente con ruolo ACE.
3. Chiamare Selezioni Online con l'access token:
   `GET <url Selezioni Online>/openapi/v1/call/commissions` con intestazione
   `Authorization: Bearer <access token>`.
4. Confrontare la risposta con quella ottenuta con un token del client
   `selezioni` per lo stesso utente.

Esiti:

| Risultato | Azione |
| --- | --- |
| Stessa risposta | Procedere con la feature |
| 401 / 403 | Aggiungere l'audience mapper `selezioni` e ripetere |
| Risposta vuota o utente diverso | Controllare `is_cnr_user` e `username_cnr` nel token |
| Ancora rifiutato | Valutare con il team di Selezioni Online lo scambio di token (token exchange) |

## 6. Configurazione dell'applicativo (proposta, da definire nel piano)

Variabili che cambiano:

- `OIDC_CLIENT_ID` = `checkin-concorsi`
- `OIDC_CLIENT_SECRET` = segreto del nuovo client
- `OIDC_AUDIENCE` = `checkin-concorsi`

Variabili nuove (nomi indicativi):

- elenco dei client ammessi;
- nome del contesto ACE (`checkin-concorsi`);
- nome del ruolo ACE amministratore;
- fonte del ruolo amministratore: registro locale, ACE o entrambe.

Rollback: ripristinare `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`,
`OIDC_AUDIENCE` del client `selezioni` e fonte ruoli = registro locale.
