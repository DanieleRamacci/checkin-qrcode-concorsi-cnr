# Contratto API: modifiche per la revisione dell'interfaccia

Prefisso di tutte le rotte: `/api/v1`. Tutte le modifiche sono **additive**:
nessun campo esistente cambia nome o significato, nessuna regola di
autorizzazione cambia.

## 1. `GET /bandi` — campi aggiunti per profilo segretario e vista admin

Ogni elemento di `items` aggiunge:

```json
{
  "next_session": {
    "session_id": "string",
    "name": "string",
    "date": "gg/mm/aaaa",
    "time": "HH:MM",
    "location": "string",
    "state": "codice stato (vedi ui-session-states.md)"
  }
}
```

- `next_session` è `null` se non ci sono sessioni future tra quelle scaricate.
- Il campo esistente `session_count` conta già le sessioni scaricate
  localmente: `session_count` = 0 significa "sessioni non ancora scaricate".
- Le modalità `expert` e `sede` non cambiano.

## 2. `GET /sessioni/<session_id>/candidati` — campi aggiunti

Ogni candidato aggiunge:

```json
{ "checkin_at": "2026-10-19T14:07:12" , "checkin_source": "scanner" }
```

- `checkin_at`: ISO 8601 oppure `null`.
- `checkin_source`: `"scanner"`, `"tabella"` oppure `null`.

## 3. `POST /sessioni/<session_id>/candidati/<uid>/toggle-checkin`

Richiesta invariata. Effetti aggiunti:

- passaggio a presente: `checkin_at` = ora corrente, `checkin_source` =
  `"tabella"`;
- annullamento: entrambi a `null`.

La risposta (il candidato aggiornato) include i due campi. Resta valido solo
nello stato `checkin_avviato` (409 `candidate_action_blocked` altrimenti).

## 4. `POST /scanner/checkin-candidate`

Richiesta invariata. Effetto aggiunto: `checkin_at` = ora corrente,
`checkin_source` = `"scanner"`. Se il candidato era già presente, i valori
esistenti non vengono sovrascritti.

## 5. `GET /me` — campo aggiunto

```json
{ "profiles": ["segretario", "referente", "sede", "esperto", "admin"] }
```

Solo i profili dell'utente autenticato, calcolati come in
[data-model.md](../data-model.md#profili-dellutente-calcolati-apiv1me).

## 6. Nuovo `POST /scanner/session-summary`

Autorizzazione: token del dispositivo associato alla sessione, come gli
endpoint scanner esistenti. Esente da CSRF come gli altri endpoint scanner.

Richiesta:

```json
{ "session_id": "string", "device_token": "string" }
```

Risposta 200:

```json
{
  "session_id": "string",
  "name": "string",
  "current_state": "codice stato",
  "checked_in_count": 0,
  "candidate_count": 0
}
```

Errori: 422 `validation_error` (parametri mancanti), 403
`device_unauthorized`.

## 7. Nuovo `POST /scanner/search-candidates`

Autorizzazione come sopra.

Richiesta:

```json
{ "session_id": "string", "device_token": "string", "q": "string" }
```

- `q`: almeno 2 caratteri (spazi esclusi), senza distinzione tra maiuscole e
  minuscole. Corrisponde se:
  - è contenuto nel cognome o nel nome;
  - con più parole, ogni parola è contenuta nel nome o nel cognome (quindi
    "mario rossi" e "rossi mario" trovano lo stesso candidato);
  - coincide con l'inizio del numero di documento (spazi ignorati);
  - coincide con l'identificativo del QR (in quel caso restituisce solo quel
    candidato).

Risposta 200:

```json
{
  "items": [
    {
      "uid": "string",
      "first_name": "string",
      "last_name": "string",
      "document_number": "string",
      "document_expired": false,
      "checkin_effettuato": false
    }
  ]
}
```

- Al massimo 10 risultati, ordinati per cognome e nome. L'interfaccia mostra per
  ciascuno cognome, nome e numero di documento; la scelta apre la scheda del
  candidato (stessa di `/scanner/verify-candidate`), da cui si conferma la
  presenza con `/scanner/checkin-candidate`.
- Errori: 422 `validation_error` (`q` troppo corto o parametri mancanti), 403
  `device_unauthorized`.
- Nei log non si registra il testo cercato.

## 8. `GET /sessioni/<session_id>/state` — campo aggiunto

```json
{
  "history": [
    { "state": "configurata", "at": "2026-10-19T13:40:02", "actor_role": "Segretario" },
    { "state": "checkin_avviato", "at": "2026-10-19T14:05:11", "actor_role": "Informatico in sede" }
  ]
}
```

- Ordinato dal più vecchio; una voce per ogni passaggio registrato nello
  storico degli stati.
- `actor_role`: `Segretario`, `Informatico in sede`, `Esperto remoto`,
  `Amministratore` o `Sistema`. Non si espone l'email di chi ha agito.
- Stessa autorizzazione dell'endpoint attuale. Il polling a 5 secondi resta
  invariato.

## 9. Nuovo `POST /sessioni/<session_id>/devices/<device_id>/disconnect`

Scollega un dispositivo dalla pagina sessione (oggi possibile solo dal
dispositivo stesso con il suo token).

- Autorizzazione: accesso alla sessione come gli altri endpoint dispositivi; con
  la feature 014 vale la matrice (segretario, informatico in sede, admin).
- Effetto: imposta l'istante di disconnessione se il dispositivo appartiene alla
  sessione ed è ancora collegato.
- Risposta 200: `{ "success": true }`. Errori: 404 `device_not_found`
  (dispositivo di un'altra sessione o già scollegato), 403 `forbidden`.

## 10. Nuovo `POST /scanner/candidate-note`

"Aggiungi nota" dalla scheda dello scanner.

Richiesta:

```json
{ "session_id": "string", "device_token": "string", "uid": "string", "note": "string" }
```

- Autorizzazione: token del dispositivo associato alla sessione; esente da CSRF
  come gli altri endpoint scanner.
- Stesse regole della nota dalla pagina sessione: testo, al massimo 2000
  caratteri, sostituisce la nota esistente.
- La nota è attribuita all'utente collegato sul telefono, se presente.
- Risposta 200: il candidato aggiornato. Errori: 422 `validation_error`, 403
  `device_unauthorized`, 404 `candidate_not_found`.

## 11. `POST /scanner/verify-candidate` — campi aggiunti

La risposta aggiunge `checkin_at` e `checkin_source` (come §2), per mostrare
"Presente dalle HH:MM, registrato dallo scanner / dalla tabella" (P09e).

## 12. `POST /scanner/checkin-candidate` — dettaglio del rifiuto

Il rifiuto 409 `checkin_not_active` aggiunge `details.current_state` (codice
stato), così lo scanner distingue "Il check-in non è ancora iniziato" da
"Il check-in è concluso" (P09c). Messaggio e codice restano invariati.

## 13. `POST /sessioni/<session_id>/candidati/<uid>/reset-password` — effetto aggiunto

Richiesta e risposta invariate. Con `operation = "request"` il backend invia
un'email all'esperto remoto assegnato alla sessione:

- oggetto provvisorio: "[Check-in] Reset password richiesto – [nome sessione]";
- corpo: cognome e nome del candidato, ruolo di chi l'ha chiesto, ora,
  collegamento alla sessione;
- invio con il servizio email esistente, registrato nei log email;
- un invio fallito non cambia l'esito della richiesta; nessuna email se la
  sessione non ha esperto remoto.

## 14. Nuovo `GET /sessioni/assegnate?mode=sede|expert`

Autorizzazione: utente autenticato; restituisce solo le sessioni in cui è
assegnato nel profilo indicato (vedi
[data-model.md](../data-model.md#sessione-assegnata-calcolata-sessioniassegnate)).

Risposta 200:

```json
{
  "items": [
    {
      "session_id": "string",
      "commission_id": "string",
      "bando_title": "string",
      "name": "string",
      "date": "gg/mm/aaaa",
      "time": "HH:MM",
      "location": "string",
      "current_state": "codice stato",
      "checked_in_count": 0,
      "candidate_count": 0,
      "open_reset_count": 0
    }
  ]
}
```

- Ordinamento per data ed ora (le sessioni di oggi e future prima).
- Errori: 422 `validation_error` se `mode` manca o non è `sede` / `expert`.

## 15. Rotte dell'interfaccia

- `/sessioni/<id>/dispositivi` reindirizza a `/sessioni/<id>` (il pannello
  dispositivi è nella pagina sessione).
- `/scanner` è servita fuori dal layout con header.
- Nuove rotte: `/segretario` (home del segretario), `/le-mie-sessioni` (home di
  informatico in sede ed esperto remoto, con `mode`), `/admin` (area
  Amministrazione con le pagine esistenti come sezioni).
