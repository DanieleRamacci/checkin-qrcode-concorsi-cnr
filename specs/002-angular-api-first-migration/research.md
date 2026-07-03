# Research: Migrazione API-first e Angular

## Decision: migrazione incrementale, non riscrittura unica

**Rationale**: il sistema corrente funziona e contiene logica di dominio utile.
Una riscrittura completa aumenterebbe il rischio di perdere dettagli operativi.

**Alternatives considered**:

- Riscrivere tutto subito in Angular/API: scartato per rischio e costo.
- Lasciare Jinja/HTMX senza API: scartato perche limita integrazione futura.

## Decision: mantenere Flask come backend iniziale

**Rationale**: Flask e gia operativo con OIDC, sessioni, PostgreSQL e workflow.
Il valore della migrazione e creare API e service layer, non cambiare framework
subito.

**Alternatives considered**:

- Passare subito a FastAPI: rimandato. Potra essere valutato dopo contratti API
  e service layer.

## Decision: Angular consuma solo `/api/v1`

**Rationale**: Angular deve essere separato da HTML server-side e HTMX. Questo
permette integrazione futura con altri servizi.

**Alternatives considered**:

- Chiamare endpoint HTML/HTMX esistenti: scartato perche creerebbe dipendenza da
  markup legacy.

## Decision: OIDC resta backend-managed nella prima fase

**Rationale**: l'autenticazione attuale e gia integrata. Tenere session cookie
server-side riduce rischio. Angular usera `/api/v1/me` per stato utente.

**Alternatives considered**:

- OIDC gestito direttamente da Angular: rimandato perche richiede revisione
  completa di token storage, callback, CSRF e refresh.

## Decision: hardening backend come prerequisito di cutover

**Rationale**: problemi come `/log`, debug endpoint, ownership route e device
token non dipendono da Angular. Vanno risolti prima che Angular diventi la UI
principale.

**Alternatives considered**:

- Migrare UI e rimandare hardening: scartato perche porterebbe rischi backend
  nella nuova architettura.

## Decision: piattaforma esami fuori scope

**Rationale**: l'idea futura serve a orientare integrabilita, ma includerla ora
allargherebbe troppo lo scope e renderebbe impossibile stimare la migrazione.

**Alternatives considered**:

- Progettare check-in + esami insieme: scartato perche serve prima consolidare
  check-in API-first.

## Decision: Angular 21 LTS con Node.js 24

**Rationale**: al 2 luglio 2026 Angular 21 e in LTS e
`design-angular-kit` dichiara una linea 21.x compatibile. Angular 21 supporta
Node.js `^24.0.0` e TypeScript `>=5.9.0 <6.0.0`; il Mac di sviluppo usa gia
Node.js 24.

**Alternatives considered**:

- Angular 22: non scelto per la prima milestone perche il kit pubblica come
  linea corrente la major 21.
- Angular 20: compatibile con una linea precedente del kit, ma ha una finestra
  di supporto residua inferiore.

Riferimenti:

- <https://angular.dev/reference/versions>
- <https://angular.dev/reference/releases>
- <https://github.com/italia/design-angular-kit>

## Decision: integrare Design Angular Kit come dipendenza

**Rationale**: il repository `italia/design-angular-kit` e una libreria Angular
basata su Bootstrap Italia, non un template applicativo da copiare. Il frontend
viene creato con Angular CLI e configurato con
`ng add design-angular-kit@21`, mantenendo la dipendenza aggiornabile.

L'app usa componenti standalone, `provideDesignAngularKit`, import selettivi,
stili SCSS Bootstrap Italia, asset e traduzioni forniti dalla libreria.

La baseline generata dal kit produce circa 2,07 MB raw tra JavaScript e CSS. Il
budget iniziale e quindi 2,25 MB warning e 2,5 MB error; route lazy e import
selettivi devono impedire crescita non controllata. Gli avvisi Sass e CommonJS
provenienti dalle dipendenze restano visibili e non vengono soppressi.

**Alternatives considered**:

- Clonare il repository del kit: scartato perche importerebbe codice demo,
  tooling e manutenzione non appartenenti all'applicazione.
- Usare Bootstrap Italia direttamente: possibile, ma perderebbe componenti,
  direttive e integrazione Angular gia mantenuti dal progetto ufficiale.
- Mantenere i template Bootstrap correnti senza kit: scartato perche
  replicherebbe markup e comportamento nel nuovo frontend.

## Decision: frontend e backend sullo stesso origin

**Rationale**: OIDC e sessioni restano gestiti da Flask con cookie sicuro. In
sviluppo Angular usa un dev proxy; negli ambienti pubblicati il reverse proxy
instrada SPA e API sotto lo stesso hostname. Questo evita CORS e non sposta
token OIDC nel browser.

**Alternatives considered**:

- Domini separati per frontend e API: scartato nella prima fase perche
  richiederebbe configurazione CORS, cookie cross-site e maggior hardening.
- Servire la build Angular dal processo Flask: possibile, ma mantiene accoppiati
  i cicli di build e deploy; si preferiscono container separati dietro proxy.

## Decision: accessibilita verificata oltre al solo uso del kit

**Rationale**: usare componenti ufficiali riduce il rischio ma non garantisce
automaticamente l'accessibilita delle pagine assemblate. Ogni slice Angular
include struttura semantica, navigazione da tastiera, focus, label, messaggi di
errore e smoke test accessibilita.

**Alternatives considered**:

- Considerare sufficiente l'installazione del kit: scartato perche layout,
  contenuti e integrazione applicativa restano responsabilita del progetto.

## Decision: protezione CSRF dedicata alle API cookie-based

**Rationale**: Angular usa la sessione backend e quindi il browser invia
automaticamente il cookie. `/api/v1/me` fornisce un token CSRF associato alla
sessione; un interceptor Angular lo invia come `X-CSRF-Token` per richieste
`POST`, `PUT`, `PATCH` e `DELETE`. Il backend valida il token soltanto sulle API
v1, senza rompere durante la prima slice i form legacy.

**Alternatives considered**:

- Affidarsi soltanto a `SameSite=Lax`: scartato come difesa unica.
- Abilitare subito una protezione globale su tutte le route Flask: rimandato
  perche richiede migrare nello stesso momento tutti i form Jinja/HTMX.
- Spostare token OIDC nel frontend: scartato; aumenta l'esposizione e cambia il
  modello di autenticazione.

## Decision: preservare l'autorizzazione corrente dell'esperto

**Rationale**: il backend corrente protegge le route esperto con il ruolo locale
`esperto_informatico` o `admin_globale`. Il campo `email_esperto_remoto` e usato
come configurazione operativa e destinatario delle comunicazioni, non come
meccanismo di autorizzazione. API capability e UI Angular mantengono questa
distinzione.

**Alternatives considered**:

- Concedere accesso in base a `email_esperto_remoto`: scartato perche
  cambierebbe il modello di sicurezza corrente.
- Rinviare il profilo esperto: scartato perche la migrazione richiede parita
  funzionale dello stato applicativo attuale.

## Decision: migrare lo scanner senza cambiare il trust model

**Rationale**: l'operatore apre la pagina scanner tramite SSO e registra il
dispositivo con un token firmato; le chiamate operative successive usano il
device token. Angular deve riprodurre il flusso e il backend deve aggiungere
scadenza, revoca e audit senza cambiare la sequenza visibile.

**Alternatives considered**:

- Lasciare indefinitamente lo scanner legacy: scartato perche impedirebbe la
  parita completa.
- Usare il token OIDC per ogni scansione: scartato perche cambierebbe il modello
  dispositivo corrente.
