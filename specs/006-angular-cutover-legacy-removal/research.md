# Research: Cutover Angular e rimozione flusso legacy

## Decisione: cutover per route, non cancellazione immediata template

**Decision**: governare prima gli URL utente pubblici con redirect/blocchi/proxy
e mantenere temporaneamente i template legacy marcati con badge.

**Rationale**: consente rollback e diagnosi durante il collaudo. La rimozione
fisica dei template diventa sicura solo dopo che ogni URL utente e' inventariato
e validato.

**Alternatives considered**: cancellazione immediata dei template legacy. Scartata
perche renderebbe piu rischioso il redeploy e impedirebbe diagnosi controllata.

## Decisione: badge legacy temporaneo

**Decision**: ogni pagina HTML legacy ancora renderizzabile deve mostrare
`LEGACY HTML`.

**Rationale**: se un percorso sfugge al redirect, l'utente e il collaudatore lo
vedono subito.

**Alternatives considered**: affidarsi solo ai test automatici. Scartata perche
bookmark, redirect OIDC e link esterni possono emergere solo in prova reale.

## Decisione: Informatico in sede come profilo SSO ordinario

**Decision**: esporre in Home una card "Informatico in sede" verso
`/bandi?mode=sede`.

**Rationale**: l'informatico e' un utente CNR autenticato con SSO come gli altri.
Non serve una login o una password dedicata. Il reset password del flusso
riguarda i candidati.

**Alternatives considered**: nascondere il flusso dietro URL manuale o capability
separata. Scartata perche rende il collaudo ambiguo e non riflette il modello
SSO corrente.

## Decisione: collaudo manuale autenticato resta bloccante

**Decision**: mantenere task manuali per desktop/mobile, scanner camera reale,
reset password sede e deep link autenticati.

**Rationale**: queste aree dipendono da browser reale, sessione OIDC e/o
integrazioni esterne; i test automatici riducono il rischio ma non bastano a
dichiarare il cutover pubblico completo.

**Alternatives considered**: chiudere da test unitari/build. Scartata perche la
spec 002 ha gia distinto implementazione da cutover.
