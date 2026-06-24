# Research: Baseline Ufficiale Progetto Esistente

## Decision: baseline as-is prima di ogni proposta to-be

**Rationale**: il progetto e gia sviluppato. Spec Kit deve prima registrare cosa
esiste, poi generare feature separate per sicurezza, API JSON o Angular.

**Alternatives considered**:

- Generare direttamente una spec Angular: scartato perche mischierebbe
  documentazione, refactor e migrazione.
- Tenere solo `docs/spec-kit/`: scartato come fonte canonica perche non usa la
  struttura ufficiale Spec Kit.

## Decision: il working tree corrente e la sorgente della baseline

**Rationale**: le modifiche locali non committate includono comportamento
applicativo gia rilevante per la versione attuale: configurazione di bando,
configurazione per-sessione, recupero RDP/componenti commissione, UI di
configurazione e separazione esperti/permessi globali.

**Alternatives considered**:

- Documentare solo l'ultimo commit: scartato perche produrrebbe una baseline
  arretrata rispetto alla versione effettivamente in uso/sviluppo.
- Committare tutto senza classificazione: scartato perche nasconderebbe quali
  cambiamenti definiscono il comportamento corrente.

## Decision: configurazione bando e sessione sono domini distinti

**Rationale**: il codice corrente sposta dati comuni come referente, esperto
remoto, segretario, durata prova e componenti commissione in `bando_config`,
mentre lascia informatico in sede e data accesso piattaforma in
`sessione_config`. La baseline deve riflettere questa separazione.

**Alternatives considered**:

- Tenere tutta la configurazione su `sessione_config`: superato dal working tree
  corrente e meno coerente con dati comuni a tutte le sessioni del bando.

## Decision: JConon/OpenAPI e best-effort, non fonte unica obbligatoria

**Rationale**: il sistema prova a recuperare RDP, componenti commissione e
metadati bando da JConon/OpenAPI, ma conserva form manuali e configurazioni
locali. Questo evita blocchi quando sistemi esterni non rispondono o restituiscono
dati incompleti.

**Alternatives considered**:

- Rendere JConon obbligatorio per configurare il bando: scartato perche riduce
  resilienza operativa.

## Decision: constitution ufficiale in `.specify/memory/constitution.md`

**Rationale**: Spec Kit usa la constitution come vincolo per plan e task. I
principi devono quindi stare nel file ufficiale, non solo in documentazione
esterna.

**Alternatives considered**:

- Lasciare la constitution nei documenti manuali: scartato perche gli artefatti
  Spec Kit non avrebbero un riferimento governativo ufficiale.

## Decision: `specs/001-baseline-progetto/` come feature descrittiva

**Rationale**: Spec Kit organizza il lavoro per feature directory. Anche la
baseline di un progetto esistente puo essere trattata come feature documentale:
produce valore, ha criteri di completamento e abilita il lavoro successivo.

**Alternatives considered**:

- Usare `docs/` come unica posizione: scartato perche non abilita il flusso
  `spec -> plan -> tasks`.

## Decision: contratti HTTP correnti in Markdown

**Rationale**: le route attuali restituiscono un mix di HTML, frammenti HTMX,
JSON, redirect e file. Un OpenAPI formale sarebbe prematuro e potenzialmente
fuorviante senza normalizzare prima le API.

**Alternatives considered**:

- OpenAPI completo: rimandato a una futura feature API JSON.
- Nessun contratto: scartato perche la migrazione Angular richiede almeno una
  mappa dei contratti correnti.

## Decision: Angular come readiness assessment, non implementazione

**Rationale**: la migrazione richiede prima API JSON, auth/CSRF, test workflow e
separazione HTML/HTMX. Inserirla nella baseline renderebbe ambiguo cosa e gia
presente e cosa va costruito.

**Alternatives considered**:

- Creare subito `frontend/`: scartato perche non richiesto nella fase baseline e
  rischioso senza contratti API.

## Decision: gap tecnici come task di classificazione, non fix immediati

**Rationale**: il working tree contiene modifiche locali gia presenti. La
baseline non deve introdurre cambi applicativi ulteriori. I rischi vanno
documentati e poi trasformati in feature separate.

**Alternatives considered**:

- Correggere subito sicurezza/debug durante la baseline: scartato perche
  confonderebbe documentazione e implementazione.
