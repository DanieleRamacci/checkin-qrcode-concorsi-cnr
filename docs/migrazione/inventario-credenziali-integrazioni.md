# Inventario credenziali integrazioni

Aggiornato: 2026-07-15

## Integrazioni applicative

| Integrazione | Uso | Modalita credenziale | Stato |
|---|---|---|---|
| Selezioni Online/JConon OpenAPI | Sync bandi referente, RDP, commissione, metadati bando | Token OIDC dell'utente loggato ottenuto da sessione applicativa | Abilitato |
| Selezioni Online/JConon Alfresco `/rest/proxy` | Vecchio recupero membri gruppo RDP | Non supportato: richiedeva credenziali fisse o bearer tecnico | Rimosso dai flussi applicativi |
| OIDC provider CNR | Login utente | Client OIDC applicativo (`OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`) | Abilitato |
| SMTP | Invio notifiche email | Secret SMTP applicativo | Abilitato se configurato |

## Servizi infrastrutturali

| Servizio | Uso | Modalita credenziale | Stato |
|---|---|---|---|
| PostgreSQL | Persistenza applicativa | Secret database applicativo | Abilitato |
| Redis | Sessioni Flask server-side | Secret Redis applicativo | Abilitato |

## Variabili non ammesse

Queste variabili non devono essere configurate nei deploy stabile/produzione e
non sono piu lette dai flussi applicativi:

- `JCONON_USERNAME`
- `JCONON_PASSWORD`
- `AUTH_B64`
- `JCONON_BEARER_TOKEN`

Se Selezioni Online non restituisce RDP/commissione tramite OpenAPI con token
OIDC dell'utente, il flusso deve restare bloccato o richiedere una decisione
esplicita su utenza applicativa istituzionale. Non va ripristinato un secret
personale locale.
