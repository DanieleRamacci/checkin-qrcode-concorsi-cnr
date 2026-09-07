# Data Model: Stabilizzazione collaudo e correzione flussi

## Utente di collaudo

- **email**: identita istituzionale normalizzata
- **ruoli applicativi**: ruoli globali, inclusi admin ed esperto informatico
- **capabilities**: funzioni esposte alla UI, incluse capability operative

## Profilo operativo

- **tipo**: segretario, referente, esperto remoto, informatico in sede, admin
- **origine autorizzazione**: ruolo globale, assegnazione su bando/sessione o
  supporto amministrativo
- **visibilita**: badge o messaggio che distingue assegnazione ordinaria da
  supporto admin

## Richiesta di riautenticazione

- **codice**: identificatore applicativo del problema autenticativo
- **destinazione ritorno**: percorso locale e sicuro da riprendere dopo login
- **deduplicazione**: una sola navigazione login visibile per piu richieste
  contemporanee

## Link storico o tecnico

- **percorso originale**: URL legacy o endpoint tecnico
- **contesto operativo**: parametri utili a preservare profilo o destinazione
- **destinazione normalizzata**: URL nuova interfaccia o link tecnico valido

## Evidenza di collaudo

- **flusso**: area validata
- **esito automatico**: suite o test mirato
- **esito manuale**: PASS, FAIL, BLOCCATO o NON TESTATO
- **rischio residuo**: nota richiesta prima di utenti reali
