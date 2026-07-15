# Selezioni Online: visibilita bandi e import candidati

## Regola operativa osservata

Per vedere un bando nel flusso Segretario e per scaricare i candidati tramite
le API di Selezioni Online, l'utente deve risultare nella commissione del bando
come segretario e il nominativo deve essere abilitato in Selezioni Online.

Essere configurato come esperto informatico nell'app Check-in CNR Concorsi non
autorizza di per se l'import candidati da Selezioni Online.

Il ruolo `admin_globale` nell'applicazione consente una visione piu ampia dei
bandi gia presenti nel database locale solo dalla vista esplicita
`mode=admin`. La dashboard Segretario resta filtrata sui bandi collegati
all'utente nella tabella locale `commissions`.

La visibilita amministrativa locale non sostituisce i permessi applicati da
Selezioni Online sulle chiamate esterne. Per questo l'app marca i bandi visti
solo come admin con il badge "Solo admin - non sei segretario" e blocca
"Scarica candidati" prima della chiamata remota, restituendo
`selezioni_online_secretary_required`.

## Sintomo tipico

Durante "Scarica candidati" l'app mostra un errore di importazione. Nei log del
backend si vede una chiamata simile:

```text
[importa] GET .../openapi/v1/call/exam-sessions/{commission_id}?session=...
[importa] API status=500 ...
[importa] Errore API Selezioni Online: 500 body=...CmisUnauthorizedException...Unauthorized...
```

Il codice HTTP esterno puo essere `500`, ma la causa operativa nel body e'
`CmisUnauthorizedException` / `Unauthorized`.

## Verifiche da fare su Selezioni Online

1. Aprire il bando interessato su Selezioni Online.
2. Verificare che l'utente sia inserito tra i componenti di commissione come
   segretario, non soltanto come esperto informatico o altro ruolo operativo.
3. Verificare che il nominativo del segretario sia abilitato.
4. Salvare/aggiornare la configurazione su Selezioni Online.
5. Rientrare nell'app Check-in CNR Concorsi, aggiornare l'elenco bandi e
   riprovare "Scarica candidati".

Se l'abilitazione su Selezioni Online e' stata appena corretta, sincronizzare di
nuovo i bandi/sessioni nell'app: finche la relazione locale non viene aggiornata,
il bando puo restare visibile solo nella vista amministratore.

## Note per il collaudo

- Se un bando e' visibile nell'app solo perche l'utente e' `admin_globale`,
  questo non garantisce che le API esterne permettano l'import candidati. Nella
  vista admin l'import deve restare bloccato.
- Se l'import funziona dopo aver inserito e abilitato l'utente come segretario
  su Selezioni Online, il problema era di autorizzazione esterna, non di
  frontend Angular.
- Se l'utente e' gia segretario abilitato e l'import continua a fallire, salvare
  dai log backend le righe `[importa]` con `session_id`, `commission_id`,
  `session_string`, status e body dell'errore, oscurando eventuali token.
