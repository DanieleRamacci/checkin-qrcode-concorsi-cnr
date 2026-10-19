# Da completare prima di chiudere il design

Stato di queste aree. Le sezioni 1–6 ora sono **disegnate** (vedi `04-schermate.md`, P09a–P09e, P15–P22). **Finché non vengono implementate, per questi casi si mantiene il comportamento attuale**, descritto qui sotto come riferimento (verificato sul codice di `frontend/src/app` al 19/10/2026). Ogni task di implementazione che tocca queste aree deve limitarsi ad applicare gli stili comuni (header, card, badge, pulsanti) senza cambiare flusso e testi.

## 1. Home di informatico in sede ed esperto remoto
- [x] Disegnato (P15, P16): "Le mie sessioni" (sessioni assegnate, quella di oggi in evidenza, stato e richieste di reset aperte).
- **Oggi:** la card della home porta a `/bandi?mode=sede` o `/bandi?mode=expert`, cioè lo stesso elenco bandi del segretario filtrato per ruolo (`BandiComponent`). Da lì si apre la sessione.
- **Da mantenere finché manca:** il percorso `/bandi?mode=…` → sessioni → sessione.
- Dipende da: elenco sessioni assegnate per utente (`05-backend.md`, punto 12).

## 2. Scanner: casi d'errore e check-in non avviato
- [x] Disegnato (P09c, P09d, P09e): candidato non trovato, check-in già registrato, check-in non consentito (es. non ancora avviato o già concluso), fotocamera non disponibile.
- **Oggi** (`ScannerComponent`), messaggio testuale sotto la fotocamera:
  - "Candidato non trovato o dispositivo non autorizzato." (rosso)
  - "Check-in già registrato." (scheda candidato senza pulsante di conferma)
  - "Check-in non consentito." o il messaggio restituito dall'API (rosso; blocca la conferma)
  - "Impossibile accedere alla fotocamera. Verifica i permessi del browser."
  - Pulsanti: "Conferma Check-in", "Nuovo Check-in".
- **Da mantenere finché manca:** messaggi e logica attuali; si può già applicare il layout di P09 (pannello dal basso) al solo caso "candidato trovato".

## 3. Associazione del telefono alla sessione
- [x] Disegnato (P09a, P09b): apertura dal link del QR, registrazione in corso, registrazione fallita, scansione del QR della sessione dallo scanner (senza link), dispositivo già associato.
- **Oggi** (`ScannerComponent`):
  - Senza `sessionId`: modalità associazione, "Scansiona il QR code della sessione per iniziare".
  - Con `sessionId` e `token`: "Registrazione dispositivo…", poi badge "Dispositivo associato"; errore "Registrazione dispositivo non riuscita.".
  - Il token del dispositivo resta nel browser (localStorage) e il telefono invia un segnale periodico.
  - Pulsante rosso "Elimina sessione" per dissociare.
- **Da mantenere finché manca:** tutto il flusso. Nel nuovo design "Elimina sessione" diventa "Scollega questo telefono" nel menu ⋮ (solo testo e posizione, stessa funzione).

## 4. Dashboard referente
- [x] Disegnato (P17): elenco paginato dei bandi di cui l'utente è RDP o referente, con stato della configurazione e cosa manca.
- **Oggi** (`/referenti/bandi`, `ReferenteBandiComponent`): ricerca; tabella con Nome concorso, RDP, Stato (badge configurazione + esperto remoto assegnato, informatico in sede "n su m sessioni", dati compilati / da completare, sessioni incomplete in rosso), azioni; avviso di sincronizzazione con Selezioni Online; messaggio se non ci sono bandi.
- **Da mantenere finché manca:** contenuti e azioni; la tabella può già usare lo stile di P02 (badge `app-badge-*`, paginazione).

## 5. Amministrazione
- [x] Disegnato (P18–P20): area "Amministrazione" con navigazione tra le sue pagine.
- **Oggi** (solo per chi ha la capability `admin`, "Menu admin" nella home):
  - `/admin/permessi` — Gestione permessi: email utente, ruolo, aggiunto da, data, "Rimuovi"; aggiunta per email.
  - `/admin/impostazioni` — Impostazioni applicazione: nome ente, nome applicazione, sottotitolo, intestazione footer.
  - `/admin/logs` — Log sistema, con numero massimo di record.
  - `/bandi?mode=admin` — Vista amministratore di tutti i bandi.
- **Da mantenere finché manca:** pagine e permessi attuali; nella scelta profilo (P01a) i link restano nella sezione "Amministrazione".

## 6. Sessione scaduta e accesso
- [x] Disegnato (P21, P22): avviso di sessione scaduta prima del rientro, pagina "Sessione terminata", accesso negato.
- **Oggi:**
  - Una risposta 401 con codice `authentication_required` o `reauthentication_required` porta subito, senza avviso, a `/login?next=<pagina corrente>` (`core/reauth.interceptor.ts`).
  - `/logged-out`: "Sessione terminata — Hai effettuato il logout dall'applicazione." + "Effettua il login".
  - Pagine admin senza permesso: ritorno alla home (`adminGuard`).
  - Token Selezioni Online scaduto o non valido durante una sincronizzazione: errore "UNAUTHORIZED" lato API (`utils/sessioni.py`); il messaggio a schermo dipende dalla pagina.
- **Da mantenere finché manca:** il reindirizzamento automatico come oggi.

## Altre schermate ancora da disegnare (fino ad allora comportamento attuale)
- [ ] Dettaglio bando (`/bandi/:id/detail`)
- [ ] Finestre del check-in: note sul candidato, QR del candidato
- [ ] Stati dopo l'invio liste visti dal segretario ("Ambiente d'esame pronto", "Esame in corso")
- [ ] Esperto: "Liste ricevute → conferma presenti su Moodle", "Esame in corso → Concludi esame", "Esame concluso"
- [ ] Chat su smartphone
- [ ] Area personale (`/area-personale`)
- [ ] Testi delle email: invio liste, richiesta al referente, notifica reset password
- [ ] Scanner: "Cerca per cognome" e "Inserisci codice a mano" (oggi non esistono: da confermare)
- [ ] Menu dell'header per ruoli diversi dal segretario (oggi il prototipo mostra quello del segretario)

## Decisioni aperte
- [x] Notifica reset all'esperto: notifica nel browser **più email** — deciso
- [x] Home di informatico ed esperto: elenco sessioni assegnate (serve API) — scelta adottata nel design
- [x] Sessione scaduta: avviso prima del reindirizzamento — scelta adottata nel design
- [x] Amministrazione: area unica con menu laterale — scelta adottata nel design
- [ ] Header: `it-header` del kit ridotto alla fascia slim o componente proprio
