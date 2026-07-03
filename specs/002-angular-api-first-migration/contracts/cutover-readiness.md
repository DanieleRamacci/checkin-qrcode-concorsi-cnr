# Contract: Cutover Readiness

Angular can become the primary UI only when these checks pass.

## Security

- [x] `/log` admin-only or disabled
- [x] debug endpoints admin/dev-only or removed
- [x] ownership decorator applied to all session/commission APIs
- [x] scanner device token rules documented and enforced
- [x] cookies/session settings production-safe
- [x] API mutations with session cookie reject missing or invalid CSRF tokens

## Functional Parity

- [x] Segretario flow works from bando list to `liste_inviate`
- [x] Bando/sessione config works
- [ ] Candidate import/list/filter and QR work
- [x] Device registration, scanner check-in work (disassociation not yet verified)
- [ ] Sede reset-password flow works
- [x] Expert flow works from lists to `esame_concluso`
- [ ] Download/send lists work
- [x] Expert role entry point implemented
- [x] Admin permissions and four log sections are Angular routes protected
  both client-side and server-side

### Evidenza E2E manuale (2026-07-03)

Flusso reale eseguito dall'utente sulla sessione di test
`ae54b61e0d4ef80017d72369b991a308`, dal browser via ngrok:

`iniziale` → Configura Bando → Configura Informatico in Sede → Scarica
Candidati → associazione dispositivo (scansione QR reale) →
`dispositivi_connessi` → Avvia check-in → Concludi check-in → Genera Liste
→ Invia lista (SMTP non raggiungibile in locale, stato avanzato comunque
come da design legacy) → `liste_inviate` → (vista esperto) Lista presenti
aggiornata → Avvia esame → Inizia esame → Concludi esame → `esame_concluso`.

Nel percorso sono stati trovati e corretti 3 gap reali (vedi
`tasks.md` T112-T118): transizione mancante a `dispositivi_connessi` dopo
la registrazione dispositivo, timeout Nginx su "Genera Liste". Un
comportamento segnalato (nessuna card segretario allo stato `avvia_esame`)
e' stato verificato come fedele al legacy, non un gap.

Non ancora verificati: filtro/QR candidati, disassociazione dispositivo,
flusso "sede" (reset password), download effettivo dei file generati.

## Frontend and Accessibility

- [x] Angular e `design-angular-kit` usano la stessa major supportata
- [x] build production Angular e test frontend passano
- [x] asset Bootstrap Italia, icone e traduzioni funzionano senza dipendenze CDN
- [x] pagine core hanno heading, landmark, label, focus e navigazione da tastiera
- [ ] errori API sono annunciati e mostrati senza affidarsi al solo colore
- [ ] layout e flussi core sono verificati alle dimensioni desktop e mobile

## Manual validation evidence (T108-T109)

Automated baseline completed on 2026-07-03:

- backend: 60 tests passed
- frontend: 15 test files, 25 tests passed
- production build: 2.06 MB raw / 435.79 kB estimated initial transfer
- local stack smoke: `/healthz`, `/api/v1/health`, `/` returned 200

The following checks require an authenticated browser session and real camera
or external-integration interaction and must not be marked complete from unit
tests alone:

- desktop comparison at 1440 px for secretary, site, expert and admin views
- mobile comparison at 390 px for dashboard, scanner and candidate QR
- full secretary workflow through list delivery
- site reset request/removal
- expert reset completion and workflow through exam completion
- scanner association, candidate scan, check-in, disassociation and reassociation

## Observability

- [x] API errors include request id
- [x] workflow transitions are logged
- [x] device registration/check-in are auditable
- [x] external integration failures are visible without exposing secrets

## Rollback

- [x] legacy Jinja/HTMX routes remain available until cutover
- [x] Angular can be disabled by routing/proxy config
- [x] database changes are backward compatible during migration
