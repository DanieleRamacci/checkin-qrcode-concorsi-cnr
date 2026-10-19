# Flussi e stati

La logica non cambia: 12 stati, solo in avanti. Cambia come vengono presentati.

## Le 4 fasi

| Fase | Stati | Chi agisce |
|---|---|---|
| 1 · Preparazione | 1 Sessione creata (Iniziale) · 2 Configurata · 3 Candidati scaricati · 4 Dispositivi collegati | Segretario (l'informatico in sede può collegare dispositivi) |
| 2 · Check-in | 5 Check-in avviato · 6 Check-in concluso | Segretario, scanner |
| 3 · Liste | 7 Liste generate · 8 Liste inviate | Segretario |
| 4 · Esame | 9 Presenti caricati su Moodle · 10 Ambiente d'esame pronto · 11 Esame in corso · 12 Esame concluso | Esperto remoto |

Nella timeline del segretario la fase 4 è etichettata "a cura dell'esperto remoto". Nella timeline dell'esperto è la sua fase.

## Stato → pannello Azioni del segretario

| Stato attuale | Titolo nel pannello Azioni | Pulsante pieno | Va a | Sezione Candidati | Schermata |
|---|---|---|---|---|---|
| 1 Iniziale | Chi ti aiuta in questa sessione? | Salva e continua | 2 | Vuota: "compariranno dopo lo scaricamento" | `sessione-prepara` |
| 2 Configurata | Scarica i candidati | Scarica candidati (con avanzamento) | 3 | Vuota: "premi Scarica candidati" | `sessione-scarica` |
| 3 Candidati scaricati / 4 Dispositivi collegati | Collega gli smartphone (QR + elenco dispositivi) | Avvia check-in (attivo con ≥ 1 dispositivo) | 5 | Tabella in sola lettura | `sessione-dispositivi` |
| 5 Check-in avviato | Registra le presenze (contatore) | Concludi check-in → finestra di conferma | 6 | Tabella con filtri e "Segna presente" | `sessione-checkin` |
| 6 Check-in concluso | Genera le liste dei presenti | Genera liste (con avanzamento) | 7 | Presenti / assenti in sola lettura | `sessione-liste` |
| 7 Liste generate | Invia le liste all'esperto remoto (file scaricabili) | Invia liste | 8 | Presenti / assenti | `sessione-liste-invia` |
| 8+ Liste inviate | Nessuna azione da fare · "Hai finito la tua parte" | (solo outline) Torna alle sessioni | — | Presenti / assenti | `sessione-liste-inviate` |

I file delle liste restano scaricabili in tutti gli stati da 7 in poi, anche dopo che l'esperto ha aggiornato Moodle (oggi spariscono).

## Ruoli e viste

| Ruolo | Cosa vede | Schermate |
|---|---|---|
| Segretario | Tutto il flusso sopra, chat | home, concorsi, sessioni, configura-bando, sessione-*, mobile, scanner |
| Informatico in sede | Sessione con pannello Azioni che spiega come segnalare; il reset si chiede dalla riga del candidato nella tabella dei presenti; collega dispositivo come azione secondaria, chat | `sessione-sede` |
| Esperto remoto | Azioni della fase Esame (es. "Inizia esame") con il conteggio dei reset da fare, file ricevuti, tabella dei presenti con lo stato del reset su ogni riga, chat | `sessione-esperto` |
| Referente | Bandi di cui è referente e configurazione | `referente`, `configura-bando` |
| Amministratore | Area Amministrazione: permessi, impostazioni, log, tutti i bandi | `admin-permessi`, `admin-impostazioni`, `admin-log` |

## Reset password

1. Il reset si fa solo sui candidati presenti, quindi vive **dentro la tabella Candidati** (una sola lista, nessuna card separata).
2. L'informatico in sede preme **Serve reset password** sulla riga del candidato; la riga passa a *Reset richiesto* e sale in cima.
3. L'esperto vede la stessa riga evidenziata con **Segna come fatto**; nel pannello Azioni c'è il conteggio "N reset password da fare". Notifica: browser **e email** (vedi `05-backend.md`).
4. Dopo la conferma la riga mostra *Reset fatto* con l'orario, per entrambi.
5. Filtri sopra la tabella: Reset da fare (o In attesa) / Reset fatti / Tutti i presenti.

## Navigazione

```
Scelta profilo ──▶ Home segretario ──▶ I miei concorsi ──▶ Sessioni del concorso ──▶ Sessione
      │                    └──────────── Apri sessione (prossima) ─────────────────────▲
      ├──▶ Le mie sessioni (informatico in sede) ──▶ Sessione (vista informatico)
      ├──▶ Le mie sessioni (esperto remoto) ──▶ Sessione (vista esperto)
      ├──▶ Bandi di cui sei referente ──▶ Configura bando
      └──▶ Amministrazione
I miei concorsi / Sessioni ──▶ Configura bando
Smartphone: Sessione ──▶ Scanner ──▶ Conferma presenza ──▶ Sessione
```
