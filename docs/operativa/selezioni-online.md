# Selezioni Online: visibilita bandi e import candidati

## Regola operativa osservata

Per vedere un bando tramite le API di Selezioni Online, l'utente deve risultare
collegato alla commissione del bando. Le prove del 2026-07-15/2026-07-16 hanno
mostrato che questo collegamento non coincide necessariamente con il ruolo
`SEGRETARIO`: anche un utente CNR inserito come `COMPONENTE` vede il bando e,
nel test osservato, riesce a scaricare i candidati.

Essere configurato come esperto informatico nell'app Check-in CNR Concorsi non
autorizza di per se l'import candidati da Selezioni Online.

Il ruolo `admin_globale` nell'applicazione consente una visione piu ampia dei
bandi gia presenti nel database locale solo dalla vista esplicita
`mode=admin`. Dopo la decisione del 2026-07-16, la vista amministratore serve
per supporto, audit e visione dei bandi locali non collegati all'utente; non
serve a separare nel flusso ordinario il segretario dagli altri componenti
abilitati da Selezioni Online.

Nota API osservata: `/openapi/v1/call/commissions` indica che il bando e'
collegato all'utente, ma non distingue da solo se l'utente e' segretario,
presidente o componente. La prova del 2026-07-15 ha confermato che, usando solo
quell'endpoint, un utente CNR inserito come `COMPONENTE` vede il bando nella
dashboard `/bandi`. Per certificare il ruolo Segretario serve quindi il
dettaglio commissione (`/openapi/v1/call` con `detailCommission=true`) oppure
una verifica puntuale sulle azioni critiche.

Nota import candidati osservata: il 2026-07-16 e' stato verificato che un utente
CNR inserito come `COMPONENTE`, non come `SEGRETARIO`, puo scaricare i candidati
tramite le API di Selezioni Online. Di conseguenza il messaggio operativo non
deve piu assumere che l'import sia automaticamente negato ai componenti.

Decisione 2026-07-16: per il perimetro corrente la piattaforma accetta "membro
commissione abilitato da Selezioni Online" come criterio operativo. Non viene
introdotta una sync ruolo complessa o bloccante per certificare il solo ruolo
`SEGRETARIO`. Sono considerati operativi i bandi che Selezioni Online
restituisce come collegati all'utente e per cui l'utente risulta abilitato dalla
fonte esterna. Salvare in locale il ruolo sorgente (`source_role`) e lo stato
dell'accesso (`access_active`) resta utile per audit e diagnosi. Un futuro
filtro "solo `SEGRETARIO`" dovra essere trattato come scelta applicativa
esplicita, non come vincolo tecnico gia dimostrato dall'API esterna.

La visibilita amministrativa locale non sostituisce i permessi applicati da
Selezioni Online sulle chiamate esterne. Tuttavia, poiche' l'import candidati e'
risultato consentito anche a un `COMPONENTE`, il blocco locale
`selezioni_online_secretary_required` va trattato come scelta applicativa da
confermare, non come replica certa di un vincolo Selezioni Online.

## Sintomo tipico

Quando Selezioni Online nega comunque l'accesso, durante "Scarica candidati"
l'app mostra un errore di importazione. Nei log del backend si vede una chiamata
simile:

```text
[importa] GET .../openapi/v1/call/exam-sessions/{commission_id}?session=...
[importa] API status=500 ...
[importa] Errore API Selezioni Online: 500 body=...CmisUnauthorizedException...Unauthorized...
```

Il codice HTTP esterno puo essere `500`, ma la causa operativa nel body e'
`CmisUnauthorizedException` / `Unauthorized`.

## Verifiche da fare su Selezioni Online

1. Aprire il bando interessato su Selezioni Online.
2. Verificare che l'utente sia inserito tra i componenti di commissione.
3. Annotare il ruolo effettivo (`SEGRETARIO`, `PRESIDENTE`, `COMPONENTE`) per
   decidere se il blocco o l'abilitazione devono essere governati dall'app.
4. Verificare che il nominativo sia abilitato.
5. Salvare/aggiornare la configurazione su Selezioni Online.
6. Rientrare nell'app Check-in CNR Concorsi, aggiornare l'elenco bandi e
   riprovare "Scarica candidati".

Se l'abilitazione su Selezioni Online e' stata appena corretta, sincronizzare di
nuovo i bandi nell'app con **Aggiorna da Selezioni Online**: finche la
relazione locale non viene aggiornata, il bando puo restare visibile solo nella
vista amministratore oppure non risultare ancora nella dashboard Segretario.

## Stati locali di autorizzazione

- `source_role=SEGRETARIO`, `access_active=true`: l'utente e' segretario
  confermato.
- `source_role=PRESIDENTE`, `COMPONENTE`, `NOT_IN_COMMISSION` o `UNKNOWN`: il
  ruolo non e' segretario. Dopo la prova del 2026-07-16, `COMPONENTE` non va
  considerato automaticamente non operativo: Selezioni Online puo consentire
  anche a un componente interno CNR lo scarico candidati.
- `access_active=false`: una sync remota valida non ha piu restituito il bando
  per quell'utente. I dati operativi restano salvati, ma l'utente non puo piu
  operarci come segretario.
- Errore temporaneo Selezioni Online: l'app mantiene la cache locale e mostra
  il contesto di errore; non revoca automaticamente accessi esistenti.

## Note per il collaudo

- Se un bando e' visibile nell'app solo perche l'utente e' `admin_globale`,
  questo non garantisce di per se che le API esterne permettano l'import
  candidati. Va distinto dal caso in cui l'utente sia anche componente effettivo
  della commissione.
- Se un bando compare dopo sync basata solo su `/call/commissions`, questo non
  prova che l'utente sia segretario: puo essere anche componente interno CNR.
- Se un utente e' componente interno CNR e Selezioni Online consente l'import,
  nel perimetro corrente Check-in CNR Concorsi non applica una restrizione
  aggiuntiva al solo segretario.
- Se l'import funziona dopo aver inserito e abilitato l'utente come segretario
  su Selezioni Online, il problema era di autorizzazione esterna, non di
  frontend Angular.
- Se l'utente e' gia segretario abilitato e l'import continua a fallire, salvare
  dai log backend le righe `[importa]` con `session_id`, `commission_id`,
  `session_string`, status e body dell'errore, oscurando eventuali token.
