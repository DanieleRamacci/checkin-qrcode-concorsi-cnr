# Regression Contract: Collaudo bugfix flow

## Reauth

- Una risposta autenticativa applicativa con stato 401 e codice
  `authentication_required` o `reauthentication_required` deve avviare login.
- Errori operativi non autenticativi non devono avviare login.
- Il redirect deve preservare il percorso locale corrente come destinazione di
  ritorno.

## Home profili

- Un utente senza capability `sede_workflow` e senza capability `admin` non deve
  vedere l'ingresso "Informatico in sede".
- Un utente con capability `sede_workflow` deve vedere l'ingresso.
- Un admin deve vedere l'ingresso come supporto esplicito.

## Profili tecnici admin

- Un admin globale puo aprire `sede` ed `expert` come supporto.
- Le liste tecniche devono distinguere assegnazione ordinaria da supporto admin.
- Gli utenti non-admin restano limitati alle proprie assegnazioni.

## Link legacy e QR/PDF

- `/sessioni` legacy deve preservare `mode` quando presente.
- Il QR PDF deve contenere un link dispositivo completo di token.
- La generazione PDF non deve usare file temporanei condivisi nella directory di
  lavoro.
