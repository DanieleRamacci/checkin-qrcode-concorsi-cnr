# Research: Stabilizzazione collaudo e correzione flussi

## Decision: Reauth gestita sia all'ingresso sia durante le chiamate API

**Rationale**: il problema osservato puo emergere quando l'utente apre una
pagina protetta o quando una pagina gia aperta fa una chiamata successiva. Serve
quindi un controllo iniziale su contesto utente e un intercettore globale degli
errori di autenticazione.

**Alternatives considered**: gestire l'errore in ogni componente. Scartato
perche' avrebbe lasciato duplicazione e rischio di messaggi incoerenti.

## Decision: Capability sede calcolata dal backend

**Rationale**: la Home deve proporre il profilo "Informatico in sede" solo
quando esiste un incarico o l'utente e' admin. La relazione operativa vive nel
backend, quindi il frontend deve limitarsi a consumare una capability.

**Alternatives considered**: mostrare sempre la card e lasciare lista vuota.
Scartato perche' contraddice la spec 007 e crea confusione nel collaudo.

## Decision: Admin support consentito e visibile nei profili tecnici

**Rationale**: le spec 007 e 009 richiedono esplicitamente accesso admin di
supporto distinguibile. Il codice viene allineato alla documentazione invece di
ridurre la documentazione al comportamento restrittivo precedente.

**Alternatives considered**: negare accesso admin in `mode=sede/expert`.
Scartato perche' avrebbe richiesto revisione della matrice collaudo gia
preparata.

## Decision: Preservare `mode` nel redirect Nginx legacy

**Rationale**: i link storici possono includere il profilo operativo. Perdere il
profilo porta l'utente nella dashboard sbagliata durante cutover.

**Alternatives considered**: demandare sempre la normalizzazione al backend.
Scartato perche' il frontend Nginx gestisce gia alcuni redirect prima del proxy.

## Decision: QR PDF legacy con token e file temporaneo isolato

**Rationale**: il link scanner richiede token. Il PDF deve produrre un QR valido
e non scrivere un file condiviso nella working directory del processo.

**Alternatives considered**: rimuovere l'endpoint PDF legacy. Scartato perche'
la spec 006 mantiene endpoint tecnici durante il cutover.
