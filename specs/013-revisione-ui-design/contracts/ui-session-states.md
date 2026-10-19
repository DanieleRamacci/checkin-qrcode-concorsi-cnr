# Contratto UI: stati, fasi e prossimo passo per profilo

Fonte unica per etichette, fasi e pannello "Azioni · cosa fare adesso" della
pagina sessione. Gli stati e le azioni disponibili restano quelli del backend
(`utils/stato.py`, `/sessioni/<id>/state`): questa tabella decide solo come
presentarli. Riferimento visivo:
[docs/design-revisione](../../../docs/design-revisione/02-flussi-e-stati.md).

## Stati, etichette e fasi

| # | Codice stato | Etichetta | Fase |
| --- | --- | --- | --- |
| 1 | `iniziale` | Sessione creata | 1 · Preparazione |
| 2 | `configurata` | Configurata | 1 · Preparazione |
| 3 | `candidati_scaricati` | Candidati scaricati | 1 · Preparazione |
| 4 | `dispositivi_connessi` | Dispositivi collegati | 1 · Preparazione |
| 5 | `checkin_avviato` | Check-in avviato | 2 · Check-in |
| 6 | `checkin_concluso` | Check-in concluso | 2 · Check-in |
| 7 | `liste_generate` | Liste generate | 3 · Liste |
| 8 | `liste_inviate` | Liste inviate | 3 · Liste |
| 9 | `lista_presenti_aggiornata_su_moodle` | Presenti caricati su Moodle | 4 · Esame (esperto remoto) |
| 10 | `avvia_esame` | Ambiente d'esame pronto | 4 · Esame (esperto remoto) |
| 11 | `esame_in_corso` | Esame in corso | 4 · Esame (esperto remoto) |
| 12 | `esame_concluso` | Esame concluso | 4 · Esame (esperto remoto) |

Un codice sconosciuto si mostra come "Stato non riconosciuto" senza azioni.

## Segretario (e amministratore in vista di supporto)

| Stato | Titolo del pannello | Pulsante principale | Note |
| --- | --- | --- | --- |
| `iniziale` | Chi ti aiuta in questa sessione? | Salva e continua | Esperto remoto (da elenco) ed email informatico in sede obbligatori; avviso accanto al pulsante se mancano |
| `configurata` | Scarica i candidati | Scarica candidati | Avanzamento nel pannello; con accesso solo admin il pulsante è disabilitato con motivo |
| `candidati_scaricati` | Collega gli smartphone che useranno come scanner | Avvia check-in (disabilitato) | Motivo accanto: "Collega almeno un dispositivo"; QR ed elenco dispositivi nel pannello |
| `dispositivi_connessi` | Collega gli smartphone che useranno come scanner | Avvia check-in | Riepilogo "Tutto pronto: N dispositivi, M candidati" |
| `checkin_avviato` | Registra le presenze | Concludi check-in | Contatori presenti / totale; conferma modale con presenti e assenti |
| `checkin_concluso` | Genera le liste dei presenti | Genera liste | Avanzamento nel pannello; riepilogo presenti e assenti |
| `liste_generate` | Invia le liste all'esperto remoto | Invia liste | Download XLSX e CSV come azioni secondarie |
| `liste_inviate` | Hai finito la tua parte | nessuno | File scaricabili; esito email stabile se l'invio è fallito |
| `lista_presenti_aggiornata_su_moodle` | Hai finito la tua parte | nessuno | File scaricabili |
| `avvia_esame` | L'esperto remoto ha preparato l'ambiente d'esame | nessuno | Avviso esplicito; file scaricabili |
| `esame_in_corso` | Prova in corso | nessuno | File scaricabili |
| `esame_concluso` | Esame concluso | nessuno | File scaricabili |

L'indicazione "avvia il check-in prima di scansionare" compare accanto
all'azione bloccata (registrazione presenza, scanner), non come banner in cima.

## Esperto remoto

| Stato | Titolo del pannello | Pulsante principale |
| --- | --- | --- |
| da `iniziale` a `checkin_concluso` | In attesa che il segretario generi e invii le liste | nessuno |
| `liste_generate` | Liste generate, in attesa dell'invio | nessuno (file scaricabili) |
| `liste_inviate` | Carica i presenti su Moodle | Lista presenti aggiornata |
| `lista_presenti_aggiornata_su_moodle` | Prepara l'ambiente d'esame | Ambiente pronto |
| `avvia_esame` | Avvia la prova | Inizia esame |
| `esame_in_corso` | Prova in corso | Concludi esame |
| `esame_concluso` | Esame concluso | nessuno |

Dal check-in in poi il pannello mostra anche "N reset password da fare" con
"Vai ai candidati" e la nota che le richieste arrivano anche via email. I reset
si gestiscono nella tabella dei presenti (modalità `reset-esperto`): richieste
aperte in cima con "Segna come fatto", sulle altre righe "Registra un reset".
Non c'è una card separata delle richieste.

## Informatico in sede

| Stato | Titolo del pannello | Pulsante principale |
| --- | --- | --- |
| `iniziale`, `configurata` | In attesa che il segretario prepari la sessione | nessuno |
| `candidati_scaricati`, `dispositivi_connessi` | Collega gli smartphone che useranno come scanner | Copia link di collegamento |
| da `checkin_avviato` in poi | Segnala chi non riesce ad accedere | nessun pulsante pieno: spiegazione "il reset si chiede dalla riga del candidato", "N richieste in attesa" con "Vai ai candidati", "Collega un dispositivo" secondario |

I reset si chiedono nella tabella dei presenti (modalità `reset-sede`): "Serve
reset password" sulla riga, che passa a "Reset richiesto" e sale in cima;
"Annulla richiesta" finché non è fatto; filtri In attesa / Reset fatti / Tutti
i presenti.

Sotto il pannello principale, negli stati da `candidati_scaricati` a
`liste_generate`, una sezione **"Azioni del segretario"** chiusa per
impostazione predefinita: aperta, mostra il pannello del segretario per lo stato
corrente (stesso titolo e pulsante della tabella del segretario, inclusa la
registrazione delle presenze dalla tabella durante il check-in). Negli stati
`iniziale` e `configurata` la sezione non compare: configurazione della
sessione e scarico dei candidati restano al segretario (matrice della feature
[014](../../014-autorizzazioni-profili-sessione/spec.md)). Le azioni dell'esperto remoto non compaiono
mai. Ciò che l'informatico esegue da questa sezione risulta nella timeline con
il ruolo "Informatico in sede".

## Timeline

Per ogni passaggio completato: etichetta dello stato, ora e ruolo di chi l'ha
eseguito (Segretario, Informatico in sede, Esperto remoto, Amministratore). Lo
stato corrente è evidenziato; i passaggi futuri sono in grigio. La fase 4 è
indicata come "a cura dell'esperto remoto".
