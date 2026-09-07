# Quickstart: Stabilizzazione collaudo e correzione flussi

## Verifica automatica

Eseguire dalla root progetto:

```sh
PYTHONPATH=. .venv/bin/pytest -q
```

Atteso: tutta la suite backend passa.

Eseguire dal frontend:

```sh
npm run test:ci
npm run build:production
```

Atteso: test frontend e build produzione passano. Sono ammessi i warning gia
noti di Sass/bootstrap-italia, sourcemap html5-qrcode e CommonJS.

## Verifica manuale interna prima degli utenti reali

1. Aprire Home con utente non assegnato: la card "Informatico in sede" non deve
   essere visibile.
2. Aprire Home con utente assegnato sede: la card deve essere visibile e
   portare a bandi/sessioni assegnati.
3. Aprire Home con admin: le viste tecniche devono essere raggiungibili come
   supporto e mostrare badge/avvisi admin.
4. Simulare sessione scaduta: le pagine protette e le chiamate API devono
   portare al login, non a errori SOL generici.
5. Aprire un link storico `/sessioni?commission_id=...&mode=sede` o
   `mode=expert`: la destinazione deve preservare il profilo.
6. Generare/scansionare QR PDF tecnico: il link deve aprire una destinazione
   completa e valida.

## Criterio per utenti reali

Passare a utenti reali solo quando i sei punti manuali sono PASS o il rischio
residuo e' accettato esplicitamente nella documentazione di collaudo 009.
