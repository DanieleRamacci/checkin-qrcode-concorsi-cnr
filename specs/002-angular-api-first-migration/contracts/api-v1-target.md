# Contract: Target API v1

Base path: `/api/v1`

All responses are JSON. Errors follow:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {},
    "request_id": "string"
  }
}
```

Le richieste autenticate che modificano stato (`POST`, `PUT`, `PATCH`,
`DELETE`) devono inviare il token restituito da `/me` nell'header
`X-CSRF-Token`. Il backend risponde `403` con errore JSON uniforme se il token
manca o non corrisponde alla sessione.

## Auth and Context

| Method | Path | Purpose |
|---|---|---|
| GET | `/me` | Current user, roles, capabilities and session CSRF token |
| POST | `/session/refresh` | Refresh backend session/token |
| POST | `/logout` | Logout current user |

## Bandi

| Method | Path | Purpose |
|---|---|---|
| GET | `/bandi` | List bandi/commissioni visible to current user |
| GET | `/bandi/{commission_id}` | Bando detail |
| GET | `/bandi/{commission_id}/config` | Read bando config |
| PUT | `/bandi/{commission_id}/config` | Save bando config |
| POST | `/bandi/{commission_id}/sync-meta` | Best-effort JConon/OpenAPI metadata refresh |
| POST | `/bandi/{commission_id}/request-config` | Send config request email |

## Sessioni

| Method | Path | Purpose |
|---|---|---|
| GET | `/bandi/{commission_id}/sessioni` | List sessions for bando |
| POST | `/bandi/{commission_id}/sessioni/sync` | Sync sessions from external API |
| GET | `/sessioni/{session_id}` | Session detail |
| GET | `/sessioni/{session_id}/config` | Read session config |
| PUT | `/sessioni/{session_id}/config` | Save session config |
| GET | `/sessioni/{session_id}/state` | Current state and actions |
| POST | `/sessioni/{session_id}/actions/{action}` | Execute workflow action |

## Candidati

| Method | Path | Purpose |
|---|---|---|
| GET | `/sessioni/{session_id}/candidati` | List/filter candidates |
| POST | `/sessioni/{session_id}/candidati/import` | Import candidates |
| POST | `/sessioni/{session_id}/candidati/{uid}/toggle-checkin` | Manual check-in toggle |
| POST | `/sessioni/{session_id}/candidati/{uid}/reset-password` | Reset password workflow |

## Dispositivi and Scanner

| Method | Path | Purpose |
|---|---|---|
| GET | `/sessioni/{session_id}/devices` | List devices |
| POST | `/sessioni/{session_id}/devices/registration-token` | Create signed registration token |
| POST | `/devices/register` | Register scanner device |
| POST | `/devices/ping` | Heartbeat |
| POST | `/devices/disconnect` | Disconnect |
| POST | `/scanner/verify-candidate` | Verify candidate with device token |
| POST | `/scanner/checkin-candidate` | Confirm check-in with device token |

## Liste and Notifications

| Method | Path | Purpose |
|---|---|---|
| POST | `/sessioni/{session_id}/lists/generate` | Generate lists |
| GET | `/sessioni/{session_id}/lists/latest` | Latest generated list metadata |
| GET | `/sessioni/{session_id}/lists/download?type=xlsx|moodle_csv` | Download file |
| POST | `/sessioni/{session_id}/lists/send` | Send list email or mark as sent |
| GET | `/sessioni/{session_id}/notifications` | Notification feed |
| POST | `/sessioni/{session_id}/notifications` | Add notification |

## Admin

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/roles` | List roles |
| POST | `/admin/roles` | Add role |
| DELETE | `/admin/roles/{email}/{role}` | Remove role |
| GET | `/admin/logs` | Admin-only logs |

## Legacy route coverage

La tabella raggruppa le route che condividono la stessa destinazione. Le viste
HTML restano disponibili come fallback finché la relativa slice Angular non ha
superato i test di accettazione.

| Legacy area/routes | API v1 target | Disposition |
|---|---|---|
| `/`, `/dashboard/segretario`, `/me`, `/user*`, `/api/userinfo` | `/me`, `/session/refresh`, `/logout` | Angular home/auth context |
| `/sync-commissioni`, `/api/commissioni` | `/bandi`, `/bandi/{id}/sync-meta` | Lettura e sincronizzazione bandi |
| `/sessioni`, frammenti e `/get-sessioni/{id}` | `/bandi/{id}/sessioni`, `/bandi/{id}/sessioni/sync` | Frammenti HTML eliminati dopo cutover |
| `/sessione/{id}`, `/gestione-concorso/{id}`, `/session-check` | `/sessioni/{id}` | Shell gestione sessione |
| dettaglio/configura/richiesta bando | `/bandi/{id}`, `/bandi/{id}/config`, `/bandi/{id}/request-config` | Semantica form preservata nei DTO |
| configurazione sessione | `/sessioni/{id}/config` | `PUT` idempotente |
| azioni, stato e timeline sessione | `/sessioni/{id}/state`, `/sessioni/{id}/actions/{action}`, `/sessioni/{id}/notifications` | Stato e capability calcolati dal backend |
| tabella candidati, toggle, reset e import | `/sessioni/{id}/candidati*` | Filtri e mutazioni JSON |
| dispositivi, frammento, QR e PDF | `/sessioni/{id}/devices`, `/sessioni/{id}/devices/registration-token` | QR generato dal token restituito |
| `/device-link`, device legacy e scansione candidato | `/devices/*`, `/scanner/*` | SSO iniziale e poi device token |
| download, generazione e invio liste | `/sessioni/{id}/lists/*` | Download binario; metadati/errori JSON |
| notifiche frammento/inserimento | `/sessioni/{id}/notifications` | Feed JSON |
| permessi e log | `/admin/roles*`, `/admin/logs` | Solo `admin_globale` |
| `/debug/*`, `/user/session/debug` | nessuna | Rimossi o limitati a development e admin |
