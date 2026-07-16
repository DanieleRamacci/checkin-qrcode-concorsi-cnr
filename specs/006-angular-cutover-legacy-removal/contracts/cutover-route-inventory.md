# Contract: Cutover Route Inventory

Ogni entry point legacy deve rispettare una delle decisioni qui sotto.

| Legacy entry point | Decisione | Destinazione / vincolo | Stato |
|---|---|---|---|
| `/dashboard/segretario` | redirect | `/bandi` | implementato e coperto da test; da riverificare su deploy |
| `/sessioni?commission_id=...` | redirect | `/bandi/{commission_id}/sessioni` | implementato e coperto da test; da riverificare |
| `/gestione-concorso/{session_id}` | redirect | `/sessioni/{session_id}` | implementato e coperto da test; da riverificare |
| `/dispositivi/{session_id}` | redirect | `/sessioni/{session_id}/dispositivi` | implementato e coperto da test; da riverificare |
| `/device-link?session_id=...&token=...` | redirect | `/scanner?sessionId=...&token=...` | implementato e coperto da test; da riverificare con camera |
| `/bando/{commission_id}/configura` | redirect | `/bandi/{commission_id}/config` | implementato e coperto da test; da riverificare |
| `/bando/{commission_id}/dettaglio` | redirect | `/bandi/{commission_id}/detail` | implementato e coperto da test; da riverificare |
| `/user` | redirect | `/` | implementato; da riverificare |
| `/admin/permessi` | SPA Angular | route Angular protetta admin | implementato e coperto da test frontend/API |
| `/admin/logs` | SPA Angular | route Angular protetta admin | implementato e coperto da test frontend/API |
| `/scanner` | SPA Angular | scanner Angular | implementato e coperto da test frontend/API |
| `/api/v1/**` | technical | mantenere API JSON | mantenere |
| `/login`, `/logout`, callback OIDC | technical | mantenere backend auth | mantenere |
| `/healthz`, `/api/v1/health` | technical | mantenere healthcheck | mantenere |
| download liste/QR/PDF | technical | mantenere endpoint file | mantenere |
| route debug HTML | admin/development only | bloccare percorso utente ordinario | da verificare |
| pagine HTML legacy non mappate | block/remove | messaggio chiaro o redirect | da censire |

## Evidenza automatica disponibile

- `tests/test_legacy_cutover_routes.py`: normalizzazione `next`, redirect
  entry point legacy e proxy Nginx non orientato ai prefissi HTML legacy.
- `tests/test_legacy_bando_config_visibility.py`: badge `LEGACY HTML` nei
  template/frammenti legacy verificati.
- `frontend/src/app/features/home/home.component.spec.ts`: Home Angular con card
  Informatico in sede e senza badge legacy.

## Regole

- Le route utente ordinarie non devono servire HTML legacy dopo il cutover.
- Le route tecniche possono restare backend se non renderizzano pagine utente.
- Ogni pagina HTML legacy ancora renderizzabile durante transizione deve mostrare
  `LEGACY HTML`.
- I deep link Angular devono essere gestiti dalla SPA, non da template legacy.
