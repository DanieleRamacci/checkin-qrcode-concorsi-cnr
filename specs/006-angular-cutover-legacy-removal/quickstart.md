# Quickstart: Cutover Angular e rimozione legacy

## Verifica feature attiva

```bash
cat .specify/feature.json
```

Expected: `specs/006-angular-cutover-legacy-removal`.

## Test automatici locali

```bash
PYTHONPATH=. .venv/bin/pytest -q
cd frontend
npm run test:ci
npm run build:production
```

Expected:

- backend test passano;
- frontend test passano;
- build production passa;
- eventuali warning Sass/CommonJS restano limitati alle dipendenze note.

### Esito automatico 2026-07-16

- `PYTHONPATH=. .venv/bin/pytest -q`: 100 test backend passati.
- `npm run test:ci`: 16 file frontend, 34 test passati.
- `npm run build:production`: build superata; bundle iniziale 2.06 MB raw /
  436.06 kB stimati.
- Warning residui: deprecazioni Sass e CommonJS da dipendenze note
  Bootstrap Italia/Design Angular Kit/html5-qrcode.

## Verifica card Informatico in sede

1. Aprire la Home Angular.
2. Verificare la card `Informatico in sede`.
3. Entrare dalla card.
4. Verificare URL `/bandi?mode=sede`.
5. Aprire una sessione e verificare la sezione reset password candidati in
   modalita sede.

## Smoke route legacy

Su ambiente autenticato o con redirect OIDC configurato, verificare:

- `/dashboard/segretario` -> `/bandi`
- `/sessioni?commission_id=<id>` -> `/bandi/<id>/sessioni`
- `/gestione-concorso/<session_id>` -> `/sessioni/<session_id>`
- `/dispositivi/<session_id>` -> `/sessioni/<session_id>/dispositivi`
- `/device-link?session_id=<id>&token=<token>` -> `/scanner?sessionId=<id>&token=<token>`
- `/bando/<commission_id>/configura` -> `/bandi/<commission_id>/config`
- `/bando/<commission_id>/dettaglio` -> `/bandi/<commission_id>/detail`
- `/user` -> `/`

Expected: nessuna pagina ordinaria mostra `LEGACY HTML`.

## Collaudo manuale finale

- desktop 1440px: Home, bandi, sessioni, gestione sessione, admin;
- mobile 390px: dashboard, scanner, QR candidato;
- informatico in sede: richiesta/rimozione reset password candidati;
- esperto: completamento reset richiesto e workflow esame;
- scanner: associazione, scansione candidato, conferma, disassociazione;
- liste: generazione, download e invio.
