# Preparazione riunione ICT: VM Check-in CNR Concorsi

Data di preparazione: 2 luglio 2026.

## Decisione proposta

- Produzione: `https://checkin.concorsi.cnr.it`
- Test: `https://checkin-test.concorsi.cnr.it`
- Reverse proxy unico: Traefik, esposto solo su `80/443`
- Portainer: non pubblicato direttamente su Internet; accesso da rete CNR/VPN,
  tramite allowlist oppure tunnel SSH
- Se è disponibile una sola VM: stack Docker, reti, volumi, database, Redis,
  variabili e credenziali completamente separati per `prod` e `test`
- Soluzione preferibile, se ICT può fornirla: due VM distinte, una per ambiente

`/test` sul dominio di produzione è tecnicamente realizzabile con una regola
Traefik `PathPrefix` e un middleware `StripPrefix`, ma non è la soluzione
raccomandata per questa applicazione. Il codice attuale genera URL assoluti
rispetto alla radice, usa callback OIDC e cookie di sessione: il prefisso
richiederebbe modifiche e test specifici e aumenterebbe il rischio di
interferenza con la produzione.

`checkin-test.concorsi.cnr.it` non è un nuovo dominio da registrare: è un record
DNS aggiunto alla zona già esistente `concorsi.cnr.it`.

Se in futuro serviranno molte applicazioni temporanee, chiedere a ICT se può
delegare o configurare:

- `*.test.concorsi.cnr.it` verso l'IP del reverse proxy;
- un certificato wildcard, oppure l'automazione dei certificati tramite
  DNS challenge;
- una regola per assegnare nomi come
  `nome-app.test.concorsi.cnr.it`.

## Chiave SSH disponibile per la riunione

Sul MacBook esiste già una chiave ED25519 con passphrase:

```text
Chiave pubblica: ~/.ssh/id_ed25519.pub
Impronta: SHA256:aUncwAlEVr4Q0rQ+jw9kB/EBqhbIkYr/eHCkWErpM6c
Commento: daniele@macbook
```

È possibile consegnare a ICT il file `.pub` o copiarne il contenuto:

```bash
pbcopy < ~/.ssh/id_ed25519.pub
ssh-keygen -lf ~/.ssh/id_ed25519.pub
```

La chiave privata `~/.ssh/id_ed25519` non deve essere inviata, allegata,
copiata in chat o inserita nel repository.

Per il provisioning chiedere a ICT di:

1. creare un utente nominativo, ad esempio `daniele.ramacci`, evitando
   l'accesso SSH diretto come `root`;
2. inserire la chiave pubblica nel relativo `~/.ssh/authorized_keys`;
3. assegnare solo i privilegi `sudo` necessari;
4. disabilitare l'autenticazione SSH con password dopo aver verificato
   l'accesso con chiave;
5. comunicare separatamente IP/FQDN, nome utente, porta SSH ed impronte delle
   host key della VM;
6. limitare SSH alla rete CNR/VPN o a indirizzi sorgente autorizzati;
7. mantenere una procedura ICT di accesso console/recovery se tutte le chiavi
   client vengono perse.

Prima del primo accesso confrontare l'impronta host ricevuta da ICT con quella
mostrata da SSH. Non accettare automaticamente una host key non verificata.

## Uso da MacBook e computer fisso

Non copiare normalmente la stessa chiave privata sui due computer. Ogni
dispositivo deve avere la propria chiave: in questo modo un dispositivo perso
può essere revocato rimuovendo una sola riga da `authorized_keys`.

Sul computer fisso generare una nuova chiave, con una passphrase diversa dalla
password CNR:

```bash
ssh-keygen -t ed25519 -a 64 \
  -f ~/.ssh/id_ed25519_cnr_checkin \
  -C "daniele.ramacci@cnr.it desktop checkin"
```

Consegnare poi a ICT solo:

```text
~/.ssh/id_ed25519_cnr_checkin.pub
```

In alternativa, dopo il primo provisioning, aggiungere la seconda chiave
pubblica alla stessa utenza sulla VM e verificarne l'impronta prima di
chiudere la sessione già funzionante.

Configurazione suggerita su ciascun computer:

```sshconfig
Host checkin-cnr
    HostName checkin.concorsi.cnr.it
    User daniele.ramacci
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

Sul computer fisso usare invece
`IdentityFile ~/.ssh/id_ed25519_cnr_checkin`.

Accesso:

```bash
ssh checkin-cnr
```

### Recupero e conservazione

- Conservare la passphrase nel password manager approvato dal CNR.
- Conservare una copia cifrata della chiave privata nel sistema di backup
  aziendale approvato; non usare email, repository Git o cartelle condivise in
  chiaro.
- Tenere almeno due chiavi indipendenti autorizzate (MacBook e fisso).
- Far confermare a ICT una procedura di revoca e una procedura console/recovery.
- Provare il ripristino della copia cifrata; un backup mai verificato non è una
  procedura di recupero.

## Requisiti da chiedere per la VM

Dimensionamento iniziale da validare con ICT:

- Linux LTS supportato dall'ente;
- 4 vCPU;
- 8 GB RAM minimo, 16 GB se test e produzione convivono e la VM esegue anche
  build;
- 100 GB di disco SSD espandibile;
- filesystem e spazio separato/monitorato per dati Docker e backup;
- snapshot della VM come protezione aggiuntiva, non come sostituto del backup
  PostgreSQL;
- aggiornamenti di sicurezza, NTP e monitoraggio concordati con ICT.

Connettività necessaria:

- ingresso `443/tcp`;
- `80/tcp` solo per redirect HTTPS o challenge ACME, se usata;
- `22/tcp` solo da rete CNR/VPN o allowlist;
- nessuna esposizione Internet di PostgreSQL `5432`, Redis `6379`, Adminer
  `8080`, RedisInsight `5540`, Portainer `9443` o Docker API;
- uscita HTTPS verso OIDC e API CNR; uscita verso il relay SMTP previsto;
- accesso ai registry necessari per scaricare immagini Docker.

Chiedere chi gestisce:

- record DNS e relativi tempi di attivazione;
- certificati TLS e rinnovo;
- firewall;
- patch del sistema operativo e Docker;
- backup, retention e test di ripristino;
- monitoraggio di disco, RAM, container e scadenza certificati;
- accesso di emergenza alla console della VM.

## Organizzazione Docker proposta

Struttura sulla VM:

```text
/opt/checkin/
├── proxy/       # Traefik e, se approvato, Portainer
├── prod/        # compose, env/secrets e dati produzione
└── test/        # compose, env/secrets e dati test
```

Principi:

- un progetto Compose distinto per ambiente;
- immagini applicative versionate e immutabili, preferibilmente con tag del
  commit; niente bind mount del sorgente in produzione;
- database, Redis e volumi distinti;
- una rete proxy condivisa soltanto dai servizi web;
- reti dati interne separate, senza porte pubblicate sull'host;
- file di segreti fuori da Git, permessi minimi e credenziali diverse per
  ambiente;
- backup PostgreSQL consistenti e prova periodica di restore;
- deploy di test, verifica, poi promozione della stessa immagine in produzione.

Il `docker-compose.yml` attuale è adatto allo sviluppo, non alla pubblicazione:
monta il sorgente nell'app, espone direttamente app, Adminer e RedisInsight e
usa un singolo insieme di volumi. Va quindi creato un compose di deploy
separato.

## Traefik e Portainer

Traefik è utile perché:

- termina TLS;
- instrada per hostname verso stack diversi;
- legge le route dalle label Docker;
- permette di aggiungere applicazioni senza pubblicare nuove porte.

Esempio concettuale delle regole:

```text
Host(`checkin.concorsi.cnr.it`)      -> servizio checkin-prod:5050
Host(`checkin-test.concorsi.cnr.it`) -> servizio checkin-test:5050
```

La dashboard Traefik non deve essere pubblicata senza autenticazione.

Portainer accede al socket Docker e deve essere considerato un pannello
amministrativo con capacità equivalenti al controllo dell'host. Proposta:

- niente binding pubblico di `9443`;
- accesso via tunnel SSH, rete CNR/VPN o hostname amministrativo protetto da
  allowlist e autenticazione forte;
- account nominativi, niente credenziali condivise;
- backup del volume `portainer_data`;
- niente porta `8000`, salvo uso effettivo delle funzioni Edge.

Tunnel possibile se Portainer ascolta solo su loopback della VM:

```bash
ssh -L 9443:127.0.0.1:9443 checkin-cnr
```

Poi aprire localmente `https://127.0.0.1:9443`.

## Configurazioni applicative da ottenere

Servono configurazioni OIDC distinte o almeno entrambe le callback autorizzate:

```text
https://checkin.concorsi.cnr.it/oidc-callback
https://checkin-test.concorsi.cnr.it/oidc-callback
```

Preferire due client OIDC separati, con secret separati. Anche PostgreSQL,
Redis, `SECRET_KEY`, credenziali SMTP e bootstrap admin devono essere distinti
tra test e produzione. In produzione:

```text
SESSION_TYPE=redis
COOKIE_SECURE=1
```

## Domande da chiudere durante la riunione

- Una VM o due VM per test e produzione?
- Quali sono hostname, IP, VLAN e modalità di accesso VPN?
- ICT può creare `checkin.concorsi.cnr.it` e
  `checkin-test.concorsi.cnr.it`?
- È possibile riservare `*.test.concorsi.cnr.it` per future applicazioni?
- Chi rilascia e rinnova i certificati TLS?
- Chi registra le due callback OIDC? Sono disponibili due client distinti?
- Qual è il relay SMTP e quali destinazioni esterne/API sono consentite?
- Chi installa e mantiene Docker Engine, Compose v2, Traefik e Portainer?
- Quali backup, retention, RPO/RTO e test di restore sono previsti?
- Come avvengono logging, monitoraggio, alerting e patching?
- Qual è la procedura di recovery/revoca in caso di perdita di un dispositivo?

## Riferimenti ufficiali

- Traefik, routing Docker:
  <https://doc.traefik.io/traefik/reference/routing-configuration/other-providers/docker/>
- Traefik, `StripPrefix`:
  <https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/stripprefix/>
- Portainer CE su Docker:
  <https://docs.portainer.io/start/install-ce/server/docker/linux>
- Docker, protezione del daemon e accesso via SSH:
  <https://docs.docker.com/engine/security/protect-access/>
