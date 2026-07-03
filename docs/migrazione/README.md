# Documentazione migrazione API-first + Angular

Questa cartella riassume, in forma leggibile, lo stato della migrazione del
progetto **Check-in CNR Concorsi** verso un'architettura API-first (backend
Flask con API JSON versionate) e un frontend **Angular 21** basato su
**Design Angular Kit** (Bootstrap Italia). E' generata a partire dagli
artefatti [Spec Kit](https://github.com/github/spec-kit) del progetto, che
restano la fonte di verita' dettagliata e aggiornata task per task.

## Indice

| Documento | Contenuto |
|---|---|
| [architettura.md](architettura.md) | Cosa cambia rispetto al monolite legacy, contratto API `/api/v1`, struttura del frontend Angular |
| [stato-avanzamento.md](stato-avanzamento.md) | Cosa e' stato migrato, cosa resta, gap noti trovati durante la validazione manuale |
| [ambiente-test-coolify.md](ambiente-test-coolify.md) | Stato del deploy su Coolify/Baltig, decisioni operative aperte |

## Dove trovare i dettagli tecnici completi

Questa cartella e' una sintesi. Per il dettaglio task-per-task, i test, i
contratti API e le decisioni tecniche puntuali, fare riferimento alle
specifiche Spec Kit nel repository:

- [`specs/002-angular-api-first-migration/`](../../specs/002-angular-api-first-migration/) —
  spec, piano, contratti e task della migrazione applicativa (backend +
  frontend)
- [`specs/003-coolify-test-environment/`](../../specs/003-coolify-test-environment/) —
  spec, piano e task della validazione dell'ambiente di test su Coolify/Baltig
- [`docs/deployment/baltig-ci-cd.md`](../deployment/baltig-ci-cd.md) —
  runbook pipeline, registry, runner e rollback
- [`readme.md`](../../readme.md) — documentazione tecnica completa
  dell'applicazione (architettura legacy, modello dati, endpoint, ruoli)

## Regola di base della migrazione

Il branch `checkin-dev` resta la baseline legacy funzionante e non viene
toccato. La migrazione procede sul branch `migration/angular-api-first` per
milestone verificabili, con le viste Jinja/HTMX legacy mantenute come
fallback finche' ogni area non ha superato i propri criteri di parita' (vedi
`stato-avanzamento.md`).
