# Research: Accesso referente/RDP alla configurazione bando

## Decisione: autorizzazione per singolo bando, non ruolo globale

**Decision**: il referente/RDP viene autorizzato sulla configurazione di un
singolo bando tramite una relazione interna `commission_id + email referente`.
Un eventuale ruolo applicativo "referente" non deve dare accesso a tutti i
bandi.

**Rationale**: il token OIDC identifica l'utente, ma non basta a stabilire per
quali bandi puo operare. La relazione bando-RDP arriva dal dominio concorsi e
deve essere verificata prima della lettura o modifica.

**Alternatives considered**:

- Ruolo globale `referente`: scartato perche troppo ampio.
- Inserire il referente nella tabella commissioni: scartato perche falserebbe il
  dominio; il referente non e un componente della commissione.
- Continuare con solo link email: scartato perche il link non e un controllo di
  autorizzazione.

## Decisione: tabella interna di assegnazioni referente/RDP

**Decision**: salvare in una struttura persistente dedicata le assegnazioni
referente-bando, con email normalizzata, fonte del dato, stato, eccezioni
manuali e timestamp.

**Rationale**: `bando_config.email_referente` e utile come campo operativo, ma
non basta per gestire piu RDP, cambi referente, stato richiesta e audit. Una
struttura dedicata rende testabile l'autorizzazione e mantiene storico minimo.

**Alternatives considered**:

- Usare solo `bando_config.email_referente`: semplice ma fragile e insufficiente
  per piu RDP.
- Salvare solo nomi RDP in JSON: insufficiente per autorizzare per email.
- Chiamare sempre Selezioni Online a ogni accesso: fragile in caso di downtime e
  meno tracciabile.

## Decisione: sincronizzazione da Selezioni Online/JConon con fallback manuale

**Decision**: i dati istituzionali restano la fonte preferita per suggerire
referenti/RDP. Se il dato manca o non contiene email utilizzabile, un
informatico/admin puo inserire una eccezione manuale tracciata.

**Rationale**: nella pratica operativa serve sbloccare bandi anche quando il
dato esterno non e completo. L'eccezione deve pero essere visibile e
rintracciabile.

**Alternatives considered**:

- Bloccare sempre senza dato istituzionale: corretto ma puo fermare il servizio.
- Accettare qualsiasi email senza audit: scartato per rischio autorizzativo.

## Decisione: accesso referente come capability separata

**Decision**: `/me` deve poter indicare una capability specifica legata alla
presenza di bandi assegnati come referente/RDP. Le capability amministrative e
quelle di commissione restano distinte.

**Rationale**: il frontend deve mostrare un'area referente solo quando serve,
senza confondere il referente con amministratore, esperto o componente di
commissione.

**Alternatives considered**:

- Mostrare sempre area referente: crea rumore e confusione.
- Nascondere la capability e far scoprire i bandi solo aprendo link diretti:
  poco chiaro per l'utente.

## Decisione: audit dedicato per configurazione bando

**Decision**: registrare richiesta, accesso autorizzato rilevante, modifica,
completamento, verifica ed eventuale revoca.

**Rationale**: la configurazione bando ha impatto operativo; serve ricostruire
chi ha chiesto, chi ha compilato e quando.

**Alternatives considered**:

- Affidarsi solo ai timestamp di `bando_config`: insufficiente per capire la
  sequenza e le eccezioni.
- Usare solo log applicativi: non garantisce consultazione stabile lato dominio.

## Decisione: cambio RDP non bloccante per configurazioni completate

**Decision**: se la fonte istituzionale cambia il referente/RDP dopo il
completamento della configurazione, il bando non viene bloccato. L'assegnazione
del vecchio RDP diventa non utilizzabile per nuove modifiche e ogni tentativo di
accesso/modifica viene rifiutato e tracciato.

**Rationale**: lo scopo principale della configurazione bando e avere gli
incarichi operativi, in particolare esperto informatico remoto e informatico in
sede. Un cambio RDP successivo non deve fermare un bando gia configurato, ma non
deve nemmeno lasciare attivo un accesso non piu valido.

**Alternatives considered**:

- Bloccare sempre il bando al cambio RDP: scartato perche introdurrebbe un
  blocco operativo non necessario.
- Sostituire automaticamente RDP e riaprire la configurazione: scartato perche
  rischia modifiche inattese.
- Lasciare attivo il vecchio RDP: scartato perche non rispetta piu la fonte
  istituzionale.

## Decisione: credenziali personali fuori dai flussi stabili

**Decision**: censire i flussi che usano JConon/Selezioni Online e classificare
ogni accesso come token utente corrente, utenza applicativa o credenziale
personale. Il recupero RDP usa come flusso primario il token OIDC dell'utente
loggato, perche il referente/RDP dovrebbe vedere i propri bandi. Una utenza
applicativa resta fallback se i test con referente o segretario non admin
dimostrano che i dati RDP/commissione non vengono restituiti.

**Rationale**: una password personale rende il deploy dipendente da un singolo
operatore, crea problemi di rotazione e non e accettabile per produzione.

**Alternatives considered**:

- Lasciare temporaneamente le credenziali personali in produzione: scartato.
- Eliminare subito tutti i flussi legacy senza analisi: rischioso, perche alcuni
  possono servire ancora durante la migrazione.

## Current integration credential map

**Decision**: per il test corrente e accettata la modalita esistente, ma la
documentazione deve distinguere chiaramente i flussi.

| Flow | Current mode | Notes |
|---|---|---|
| API v1 `sync-meta` / `utils.jconon_service.fetch_bando_metadata` | OIDC token dell'utente loggato | Flusso primario: chiama `/openapi/v1/call` con `Authorization: Bearer <access_token>` ottenuto da `ensure_fresh_access_token`; da validare con referente/RDP e segretario non admin |
| Fallback RDP metadata sync | Utenza di servizio/applicativa | Da attivare solo se i test dimostrano che il token OIDC di referente/RDP o segretario non restituisce RDP/commissione necessari |
| Legacy dashboard/config bando `utils.jconon_referenti.fetch_e_salva_bando_meta` per dettaglio call | OIDC token se passato dal chiamante | Usa `_make_session_oidc(oidc_access_token)` per `/openapi/v1/call/{uuid}` |
| Legacy recupero membri gruppo RDP via `/rest/proxy` | Credenziali/env o bearer tecnico | `_make_session()` usa priorita `JCONON_BEARER_TOKEN`, `AUTH_B64`, poi `JCONON_USERNAME/JCONON_PASSWORD` |

**Rationale**: il flusso nuovo che recupera `rdps` e `commissioners` per
precompilare la configurazione oggi passa dal token OIDC dell'utente loggato.
Questo e coerente se Selezioni Online autorizza il referente/RDP a vedere i
propri bandi e i relativi dettagli. Rimane da verificare con utenze non admin,
e rimane codice legacy che puo dipendere da credenziali in env per chiamate
Alfresco/rest proxy.

## Service account fallback

**Decision**: predisporre una possibile utenza applicativa per Selezioni
Online/JConon come fallback, non come flusso primario. Diventa necessaria solo
se i test con token OIDC di referente/RDP o segretario non admin dimostrano che
Selezioni Online non restituisce i dati RDP/commissione necessari.

**Required properties**:

- utenza non personale e intestata all'applicazione o al servizio;
- permessi di sola lettura sui metadati necessari: bando, RDP, commissione;
- possibilita di ottenere credenziale tecnica o token server-side gestibile come
  secret Coolify;
- rotazione credenziale definita;
- tracciamento lato Selezioni Online, se disponibile, distinguibile dagli utenti
  personali;
- nessun uso per operazioni di modifica sui bandi esterni.

**Configuration target**:

- `BASE_URL`: endpoint Selezioni Online/JConon;
- secret dedicati in Coolify per la modalita scelta, ad esempio bearer/token
  tecnico o credenziali applicative;
- nessun valore segreto nel repository.
