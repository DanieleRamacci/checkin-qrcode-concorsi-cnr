# Stato di avanzamento

Fonte: [`specs/002-angular-api-first-migration/tasks.md`](../../specs/002-angular-api-first-migration/tasks.md),
[`contracts/legacy-ui-flow-matrix.md`](../../specs/002-angular-api-first-migration/contracts/legacy-ui-flow-matrix.md),
[`contracts/cutover-readiness.md`](../../specs/002-angular-api-first-migration/contracts/cutover-readiness.md).
Aggiornato al 2026-07-15.

## Riepilogo

La migrazione e' organizzata in fasi Spec Kit (setup, hardening di
sicurezza, contratti API, frontend Angular, coesistenza/deploy, hardening
legacy, polish, convergenza di parita'). La maggior parte delle aree
applicative ha gia' una controparte Angular funzionante e testata; il lavoro
rimanente e' soprattutto **verifica manuale** (confronto visivo desktop/
mobile, flussi end-to-end per ogni ruolo) piu' alcuni gap puntuali trovati e
gia' corretti durante quella verifica.

## Cosa e' stato completato

- **API `/api/v1`**: tutte le aree core (auth/contesto, bandi, sessioni,
  workflow, candidati, dispositivi/scanner, liste, notifiche, admin) sono
  esposte via API JSON, con ownership, CSRF e test automatici dedicati.
- **Hardening di sicurezza**: validazione OIDC (firma, issuer, audience,
  scadenza via JWKS), protezione `/log` e endpoint debug, token dispositivo
  con scadenza/revoca, protezione open-redirect sul login OIDC.
- **Frontend Angular**: tutte le aree applicative hanno una schermata
  Angular corrispondente — home/profili, bandi, dettaglio e configurazione
  bando, sessioni, gestione sessione (azioni per stato, timeline a 9 step,
  notifiche/chat, candidati con QR e reset password, dispositivi con
  scanner fotocamera), amministrazione permessi/log.
- **Deploy test reale**: Coolify clona il repository BaLTIG tramite deploy key
  read-only, builda `docker-compose.coolify.yml` dal branch `test` ed espone
  il frontend su `https://test-checkin.concorsi.cnr.it`. Il flusso runner/
  registry BaLTIG resta una possibile evoluzione futura, ma non e il percorso
  operativo attuale.
- **Verifica end-to-end manuale (in locale)**: flusso segretario→esperto
  completato dall'inizio (`iniziale`) fino a `esame_concluso`, includendo
  associazione dispositivo via scansione QR reale, generazione e invio
  liste.

## Gap trovati e corretti durante la validazione manuale

La verifica manuale ha un valore preciso: alcune parti compilavano e
passavano i test unitari ma non si comportavano come il legacy in uno
scenario reale. Gap reali trovati e risolti finora:

1. **Associazione dispositivo non avanzava lo stato**: mancava l'endpoint
   equivalente a `verifica_dispositivi` del legacy, che conta i dispositivi
   collegati e fa avanzare lo stato sessione — aggiunto lato API e nel
   flusso scanner.
2. **Timeout Nginx troppo basso**: le chiamate lente all'API esterna
   Selezioni Online (~54s per l'import candidati) superavano il timeout di
   default di Nginx (60s), inferiore a quello gia' configurato per Gunicorn
   (120s) — allineati.
3. **"Configura Bando" non precompilava i dati da Selezioni Online**: il
   meccanismo di sincronizzazione RDP/componenti commissione esisteva gia'
   lato API ma non veniva richiamato dalla pagina di configurazione —
   collegato.
4. **Pagina Sessioni silenziosa se i componenti commissione non sono
   sincronizzati**: aggiunto un avviso esplicito (non presente nel legacy,
   richiesta esplicita durante la validazione).
5. **Autorizzazione referente/RDP basata su un trucco senza revoca**: la
   sincronizzazione dei bandi per cui l'utente e RDP scriveva una riga
   fittizia nella tabella `commissions` (quella dei segretari) solo per far
   passare il controllo di accesso a "Configura bando" — senza mai
   cancellarla, un vecchio RDP restava autorizzato anche dopo un cambio
   rilevato da Selezioni Online. Sostituito con una tabella dedicata
   `bando_referenti`, sincronizzata con upsert **e cancellazione** delle
   righe non piu' restituite per l'utente (stessa logica di revoca gia'
   usata per i segretari). Stesso endpoint/pagina di configurazione riusati,
   nessuna duplicazione. Dettaglio in
   [`specs/004-referente-rdp-configurazione/`](../../specs/004-referente-rdp-configurazione/),
   gap ancora aperti (stato/audit, blocco campo referente, credenziali
   personali legacy) elencati in
   [`tasks.md`](../../specs/004-referente-rdp-configurazione/tasks.md).
6. **Admin vedeva bandi locali dentro la dashboard Segretario**: un utente
   `admin_globale` vedeva tutti i bandi locali anche entrando come
   Segretario, creando confusione con i permessi reali di Selezioni Online.
   Separata la vista: `/bandi` resta filtrata sui bandi propri, mentre
   `/bandi?mode=admin` mostra il totale locale con badge "Solo vista admin"
   quando l'utente non risulta collegato localmente come membro operativo.
   Lo scarico candidati e' bloccato lato API quando manca la relazione locale
   di commissione per la sessione. Dettaglio operativo in
   [`docs/operativa/selezioni-online.md`](../operativa/selezioni-online.md).
7. **Ruoli Selezioni Online non equivalenti a segretario**: dai test reali e'
   emerso che `/openapi/v1/call/commissions` puo restituire bandi collegati
   all'utente anche quando l'utente e' presidente, componente o esperto, non
   segretario. Conferma 2026-07-15: mettendo l'utente come solo
   `COMPONENTE`, il bando compare comunque in `/bandi` quando la sync usa solo
   `/call/commissions`. Questo endpoint quindi non puo essere considerato prova
   del ruolo Segretario. Aggiornamento 2026-07-16: lo stesso scenario ha
   mostrato che un `COMPONENTE` interno CNR puo anche scaricare i candidati da
   Selezioni Online. Quindi il filtro "solo Segretario" non e' imposto
   dall'API esterna osservata, ma e' una possibile regola applicativa piu
   restrittiva. Decisione 2026-07-16: per il perimetro corrente si accetta
   "membro commissione abilitato da Selezioni Online" come criterio operativo,
   senza sync ruolo complessa. La vista amministratore resta utile per supporto,
   audit e visione globale dei bandi locali non collegati all'utente.

## Cosa resta da fare

- **Confronto visivo documentato** desktop/mobile di ogni area rispetto al
  legacy (in corso, riga per riga nella matrice di parita').
- **Flusso end-to-end per il ruolo "Informatico in sede"** (richiesta reset
  password) — unico ruolo non ancora verificato manualmente tra Segretario,
  Esperto e Scanner (gia' verificati).
- **Verifica finale di coerenza Spec Kit** prima di sbloccare il cutover
  definitivo (nessun placeholder, nessuna decisione tecnica aperta).
- Vedi [`ambiente-test-coolify.md`](ambiente-test-coolify.md) per il flusso
  reale BaLTIG/Coolify e per i controlli ancora da fare sul dominio test.

## Checklist di cutover (sintesi)

La produzione puo' passare ad Angular come UI principale solo quando, oltre
al lavoro sopra, risultano verificati: annuncio errori API accessibile
(non solo colore), layout core verificato a dimensioni desktop e mobile,
e i flussi funzionali critici confermati con evidenza reale (non solo test
automatici). Dettaglio completo in
[`cutover-readiness.md`](../../specs/002-angular-api-first-migration/contracts/cutover-readiness.md).
