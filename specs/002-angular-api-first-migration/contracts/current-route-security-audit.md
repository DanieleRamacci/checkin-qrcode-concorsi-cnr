# Current route security audit

Audit eseguito il 2026-07-02 sul branch `migration/angular-api-first`.

| Area | Autenticazione | Autorizzazione risorsa | Esito |
|---|---|---|---|
| API v1 bandi/sessioni/configurazioni | sessione OIDC | helper condivisi commission/session | PASS |
| API v1 candidati/liste/notifiche | sessione OIDC + CSRF mutazioni | ownership o capability esperto | PASS |
| API v1 dispositivi/scanner | token registrazione/device | scadenza, revoca, confronto e rowcount | PASS |
| API v1 admin/log | sessione OIDC | `admin_globale` | PASS |
| Legacy azioni/candidati/notifiche | `login_required` | helper condivisi | PASS |
| Legacy dispositivi/QR/gestione sessione | `login_required` | helper condivisi | PASS |
| `/log` e `/user/session/debug` | `login_required` | admin; debug solo development | PASS |
| `/debug/*` | `login_required` | admin e solo development | PASS |
| `/session-check` | `login_required` | sessione autenticata; ID non enumerabile | PASS |
| Callback OIDC | state monouso | firma, issuer, audience, scadenza | PASS |

Le route device e scanner senza cookie sono intenzionalmente esenti da CSRF:
usano un token firmato o un device token dedicato e non accettano una sessione
browser come unica autorizzazione.
