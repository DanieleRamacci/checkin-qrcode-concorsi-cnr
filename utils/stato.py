from datetime import datetime
from db import get_db_connection

# Ordine degli stati possibili
SESSION_STATES = [
    "iniziale",
    "configurata",
    "candidati_scaricati",
    "dispositivi_connessi",
    "checkin_avviato",
    "checkin_concluso",
    "liste_generate",
    "liste_inviate",
    "lista_presenti_aggiornata_su_moodle",
    "avvia_esame",
    "esame_in_corso",
    "esame_concluso"
]


STATE_TRANSITIONS = {
    "iniziale": ["configurata"],
    "configurata": ["candidati_scaricati"],
    "candidati_scaricati": ["dispositivi_connessi"],
    "dispositivi_connessi": ["checkin_avviato"],
    "checkin_avviato": ["checkin_concluso"],
    "checkin_concluso": ["liste_generate"],
    "liste_generate": ["liste_inviate"],
    "liste_inviate": ["lista_presenti_aggiornata_su_moodle"],
    "lista_presenti_aggiornata_su_moodle": ["avvia_esame"],
    "avvia_esame": ["esame_in_corso"],
    "esame_in_corso": ["esame_concluso"],
    "esame_concluso": []
}

# Azioni disponibili per ogni stato
AZIONI_PER_STATO = {
    "iniziale": ["configura_sessione"],
    "configurata": ["scarica_candidati"],
    "candidati_scaricati": ["collega_dispositivo"],
    "dispositivi_connessi": ["avvia_checkin"],
    "checkin_avviato": ["concludi_checkin"],
    "checkin_concluso": ["genera_liste"],
    "liste_generate": ["invia_liste"],
    "liste_inviate": ["aggiorna_presenti_moodle"],
    "lista_presenti_aggiornata_su_moodle": ["avvia_esame"],
    "avvia_esame": ["inizia_esame"],
    "esame_in_corso": ["concludi_esame"],
    "esame_concluso": []
}



# Ottieni lo stato corrente da DB
def get_stato_corrente(session_id):
    db = get_db_connection()
    with db.cursor() as cursor:
        cursor.execute("SELECT stato_corrente FROM sessioni WHERE session_id = %s", (session_id,))
        row = cursor.fetchone()
    db.close()
    return row[0] if row else None

# Verifica se il passaggio è valido
def posso_passare_a(session_id, nuovo_stato):
    stato_attuale = get_stato_corrente(session_id)
    if stato_attuale is None:
        return nuovo_stato == "iniziale"
    return nuovo_stato in STATE_TRANSITIONS.get(stato_attuale, [])

# Imposta il nuovo stato corrente
from datetime import datetime
from db import get_db_connection

def set_stato_corrente(session_id, nuovo_stato, utente=None):
    print(f"[DEBUG] Richiesta di aggiornamento stato per sessione {session_id} → '{nuovo_stato}' da parte di {utente}")

    stato_attuale = get_stato_corrente(session_id)
    print(f"[DEBUG] Stato attuale dal DB: {stato_attuale}")

    if not posso_passare_a(session_id, nuovo_stato):
        raise Exception(f"[ERRORE] Transizione non valida da {stato_attuale} a {nuovo_stato}")

    db = get_db_connection()
    try:
        with db.cursor() as cursor:
            print(f"[DEBUG] Eseguo UPDATE su sessioni...")
            cursor.execute(
                "UPDATE sessioni SET stato_corrente = %s WHERE session_id = %s",
                (nuovo_stato, session_id)
            )

            print(f"[DEBUG] Inserisco nuovo log in session_state_log...")
            cursor.execute(
                """
                INSERT INTO session_state_log (session_id, stato, timestamp, utente)
                VALUES (%s, %s, %s, %s)
                """,
                (session_id, nuovo_stato, datetime.now(), utente)
            )

        try:
            from utils.notifications import add_notification
            add_notification(session_id, "state", payload=nuovo_stato, author_email=utente)
        except Exception:
            pass

        db.commit()
        print(f"[DEBUG] Stato aggiornato correttamente e log inserito.")

    except Exception as e:
        db.rollback()
        print(f"[ERRORE] Errore durante l'aggiornamento dello stato: {e}")
        raise

    finally:
        db.close()

def claim_transition(session_id, stato_da, stato_a, utente=None):
    """Transizione atomica: aggiorna lo stato solo se e' ancora `stato_da`.

    A differenza di `set_stato_corrente`, il confronto e l'aggiornamento
    avvengono in un'unica UPDATE condizionata, cosi' che due richieste
    concorrenti sullo stesso passaggio di stato (es. doppio click o due tab
    aperte su "Invia liste") non possano entrambe superare il controllo:
    solo una vince la race e deve eseguire l'effetto collaterale associato
    (es. invio email), l'altra riceve False e deve trattare l'operazione
    come gia' completata.
    """
    if stato_a not in STATE_TRANSITIONS.get(stato_da, []):
        raise Exception(f"[ERRORE] Transizione non valida da {stato_da} a {stato_a}")

    db = get_db_connection()
    try:
        with db.cursor() as cursor:
            cursor.execute(
                "UPDATE sessioni SET stato_corrente = %s WHERE session_id = %s AND stato_corrente = %s",
                (stato_a, session_id, stato_da),
            )
            claimed = cursor.rowcount > 0
            if claimed:
                cursor.execute(
                    """
                    INSERT INTO session_state_log (session_id, stato, timestamp, utente)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (session_id, stato_a, datetime.now(), utente),
                )
        if claimed:
            try:
                from utils.notifications import add_notification
                add_notification(session_id, "state", payload=stato_a, author_email=utente)
            except Exception:
                pass
        db.commit()
        return claimed
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# Utility per sapere se ci si trova in uno specifico stato
def is_nello_stato(session_id, stato_atteso):
    return get_stato_corrente(session_id) == stato_atteso

# Utility per ottenere tutti gli stati raggiunti
def get_storia_stati(session_id):
    db = get_db_connection()
    with db.cursor() as cursor:
        cursor.execute("SELECT stato, timestamp, utente FROM session_state_log WHERE session_id = %s ORDER BY timestamp ASC", (session_id,))
        result = cursor.fetchall()
    db.close()
    return result


#AZIONI

def get_azioni_per_stato(session_id):
    stato = get_stato_corrente(session_id)
    return AZIONI_PER_STATO.get(stato, [])
