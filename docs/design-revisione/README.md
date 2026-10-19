# Revisione UI – Check-in CNR Concorsi

Pacchetto di consegna del nuovo design. Serve a ricreare le schermate dentro il progetto Angular con **design-angular-kit 21** (Bootstrap Italia **2.17.4**), senza cambiare la logica dei 12 stati della sessione.

## Cosa c'è nella cartella

| Percorso | Contenuto |
|---|---|
| `01-principi.md` | Regole di design, linguaggio unico, accessibilità |
| `02-flussi-e-stati.md` | I 12 stati raggruppati in 4 fasi, chi fa cosa, quale schermata per ogni stato e ruolo |
| `03-componenti.md` | Corrispondenza blocco → componente del kit e specifica dei componenti nuovi da creare |
| `04-schermate.md` | Scheda per ogni schermata: ruolo, rotta, contenuto, azioni, file Angular probabilmente coinvolti |
| `05-backend.md` | Cosa serve lato API perché il design funzioni (paginazione, campi, email, chat) |
| `06-da-completare.md` | Schermate e decisioni ancora aperte |
| `stili/proposta.css` | Gli unici stili propri dell'app; tutto il resto è Bootstrap Italia senza modifiche |
| `prototipo/` | Pagine HTML navigabili: apri `prototipo/index.html` in un browser (meglio con un server locale, vedi sotto) |
| `screenshot/` | Una immagine per schermata, desktop 1280 px e smartphone 390 px |

## Come usarlo

1. Leggi `01-principi.md` e `02-flussi-e-stati.md`: spiegano il perché delle scelte.
2. Per ogni schermata parti da `04-schermate.md`, guarda lo screenshot e apri la pagina HTML corrispondente in `prototipo/`. Nel sorgente HTML un commento indica il componente del kit per ogni blocco.
3. Copia `stili/proposta.css` negli stili globali del progetto (per esempio `src/styles/proposta.scss`) e importalo dopo Bootstrap Italia.
4. Crea i componenti nuovi descritti in `03-componenti.md` prima di rifare le pagine: sono condivisi tra segretario, informatico in sede ed esperto remoto.

Per vedere il prototipo con le icone:

```bash
cd docs/design-revisione/prototipo
python3 -m http.server 8080
# poi apri http://localhost:8080
```

## Ordine di lavoro consigliato

1. Componenti comuni: header a una fascia, testata sessione, pannello Azioni, timeline stati, sezione Candidati (con colonna reset), chat.
2. Pagina sessione del segretario (tutti gli stati), perché è la più usata in aula.
3. Scanner e sessione su smartphone, compresi collegamento del telefono e stati d'errore (P09a–P09e).
4. Elenchi paginati: I miei concorsi, Sessioni del concorso.
5. Scelta profilo e home del segretario.
6. Viste di informatico in sede ed esperto remoto, con le loro home "Le mie sessioni".
7. Configura bando e dashboard referente.
8. Area Amministrazione (permessi, impostazioni, log).
9. Sessione di accesso scaduta e pagina di uscita.

Elenco completo delle schermate con codice tavola (P01…P22), rotta e file Angular: `04-schermate.md`.

## Riferimenti

- Tela di design (modificabile): "Check-in Concorsi CNR – Revisione UI" su claude.ai, pagina "Proposta (Bootstrap Italia)". I codici P01…P22 di questi documenti sono i titoli delle tavole.
- Aggiornato al 19/10/2026.
- Prototipo HTML pubblicato: "Prototipo Check-in Concorsi" su claude.ai.
- I dati nelle schermate sono segnaposto (`[COGNOME 1]`, `[email]`, `[codice 03]`).
