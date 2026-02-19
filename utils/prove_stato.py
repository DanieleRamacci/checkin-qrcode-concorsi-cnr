import json
from datetime import datetime, date, timedelta
from db import get_db_connection

PROVE_STATES = [
    "bozza",
    "dettagli_completati",
    "convocazioni_inviate",
    "lista_candidati_da_acquisire",
    "lista_candidati_acquisita",
    "template_moodle_da_inviare",
    "template_moodle_inviati",
    "modelli_buste_inviati_al_segretario",
    "excel_presenti_generato",
    "excel_presenti_inviato",
    "lista_presenti_ricevuta",
    "presenti_attivati_su_moodle",
    "buste_con_domande_ricevute",
    "domande_caricate",
    "estrazione_busta",
    "busta_estratta",
    "prova_avviata",
    "prova_conclusa",
    "inserire_data_valutazione_prova",
    "prova_valutata",
]

ACTION_TO_STATE = {
    "set_dettagli_completati": "dettagli_completati",
    "set_convocazioni_inviate": "convocazioni_inviate",
    "set_lista_candidati_da_acquisire": "lista_candidati_da_acquisire",
    "set_lista_candidati_acquisita": "lista_candidati_acquisita",
    "set_template_moodle_da_inviare": "template_moodle_da_inviare",
    "set_template_moodle_inviati": "template_moodle_inviati",
    "set_modelli_buste_inviati_al_segretario": "modelli_buste_inviati_al_segretario",
    "set_excel_presenti_generato": "excel_presenti_generato",
    "set_excel_presenti_inviato": "excel_presenti_inviato",
    "set_lista_presenti_ricevuta": "lista_presenti_ricevuta",
    "set_presenti_attivati_su_moodle": "presenti_attivati_su_moodle",
    "set_buste_con_domande_ricevute": "buste_con_domande_ricevute",
    "set_domande_caricate": "domande_caricate",
    "set_estrazione_busta": "estrazione_busta",
    "set_busta_estratta": "busta_estratta",
    "set_prova_avviata": "prova_avviata",
    "set_prova_conclusa": "prova_conclusa",
    "set_inserire_data_valutazione_prova": "inserire_data_valutazione_prova",
    "set_prova_valutata": "prova_valutata",
}


class ProveStateError(Exception):
    pass


def giorni_alla_prova(data_prova):
    if not data_prova:
        return None
    if isinstance(data_prova, datetime):
        data_val = data_prova.date()
    else:
        data_val = data_prova
    return (data_val - date.today()).days


def calcola_orario_fine_previsto(orario_inizio, durata_minuti):
    if not orario_inizio or not durata_minuti:
        return None
    return orario_inizio + timedelta(minutes=int(durata_minuti))


def _state_idx(stato):
    if stato not in PROVE_STATES:
        raise ProveStateError(f"Stato non valido: {stato}")
    return PROVE_STATES.index(stato)


def _can_forward_only(from_state, to_state):
    return _state_idx(to_state) == (_state_idx(from_state) + 1)


def _document_exists(cur, prove_id, doc_type):
    cur.execute(
        """
        SELECT 1
        FROM prove_documents
        WHERE prove_id = %s AND doc_type = %s
        LIMIT 1
        """,
        (prove_id, doc_type),
    )
    return cur.fetchone() is not None

def _document_exists_any(cur, prove_id, doc_types):
    cur.execute(
        """
        SELECT 1
        FROM prove_documents
        WHERE prove_id = %s AND doc_type = ANY(%s)
        LIMIT 1
        """,
        (prove_id, doc_types),
    )
    return cur.fetchone() is not None

def _validate_transition(cur, prova, to_state, payload=None):
    prove_id = prova["prove_id"]

    if to_state == "dettagli_completati":
        required = [
            (prova.get("numero_bando") or "").strip(),
            (prova.get("titolo") or "").strip(),
            prova.get("data_prova"),
            prova.get("ora_prova"),
            (prova.get("luogo") or "").strip(),
            (prova.get("referente_nome") or "").strip(),
            (prova.get("referente_email") or "").strip(),
            (prova.get("segretario_nome") or "").strip(),
            (prova.get("segretario_email") or "").strip(),
            (prova.get("esperto_email") or "").strip(),
        ]
        if not all(required):
            raise ProveStateError(
                "Per passare a dettagli_completati compila i dati base (bando, titolo, data/ora/luogo, referente e segretario)."
            )
        if not prova.get("referente_dati_confermati"):
            raise ProveStateError("Il referente deve prima compilare e confermare i dati dal link dedicato.")

    if to_state == "convocazioni_inviate":
        required = [
            prova.get("data_prova"),
            prova.get("ora_prova"),
            (prova.get("luogo") or "").strip(),
            (prova.get("segretario_email") or "").strip(),
            (prova.get("referente_email") or "").strip(),
        ]
        if not all(required):
            raise ProveStateError(
                "Per avanzare a convocazioni_inviate servono data/ora/luogo e contatti segretario/referente."
            )

    if to_state == "template_moodle_inviati":
        if not _document_exists(cur, prove_id, "lista_convocati_moodle"):
            raise ProveStateError("Manca documento doc_type=lista_convocati_moodle.")

    if to_state == "modelli_buste_inviati_al_segretario":
        if not _document_exists_any(cur, prove_id, ["template_busta_a_vuota", "template_busta_b_vuota", "template_busta_c_vuota"]):
            raise ProveStateError("Carica almeno un modello busta vuota (A/B/C) prima dell'invio.")

    if to_state == "excel_presenti_inviato":
        if not _document_exists_any(cur, prove_id, ["excel_presenze_template", "lista_presenti_excel"]):
            raise ProveStateError("Manca documento doc_type=excel_presenze_template o lista_presenti_excel.")

    if to_state in ("lista_presenti_ricevuta", "presenti_attivati_su_moodle"):
        if not _document_exists(cur, prove_id, "lista_presenti_excel"):
            raise ProveStateError("Carica il documento lista_presenti_excel prima di avanzare.")
    if to_state == "presenti_attivati_su_moodle":
        raw = ((payload or {}).get("num_presenti") or "").strip()
        try:
            n = int(raw)
        except Exception:
            n = -1
        if n < 0:
            raise ProveStateError("Per passare a presenti_attivati_su_moodle inserisci il numero candidati presenti.")

    if to_state == "buste_con_domande_ricevute":
        required_received = ["busta_a_ricevuta", "busta_b_ricevuta", "busta_c_ricevuta"]
        missing = [d for d in required_received if not _document_exists(cur, prove_id, d)]
        if missing:
            raise ProveStateError(f"Mancano le buste ricevute: {', '.join(missing)}")

    if to_state == "busta_estratta":
        chosen = ((payload or {}).get("busta_estratta_codice") or "").strip().upper()
        if chosen not in ("A", "B", "C"):
            raise ProveStateError("Per passare a busta_estratta devi selezionare A, B o C.")

    if to_state == "inserire_data_valutazione_prova":
        raw_date = ((payload or {}).get("data_valutazione_prova") or "").strip()
        if not raw_date:
            raise ProveStateError("Inserisci la data valutazione prova per avanzare.")
        try:
            date.fromisoformat(raw_date)
        except Exception:
            raise ProveStateError("Formato data valutazione non valido (usa YYYY-MM-DD).")

    if to_state == "prova_valutata":
        cur.execute("SELECT data_valutazione_prova FROM prove WHERE prove_id = %s", (prove_id,))
        row = cur.fetchone()
        if not row or not row[0]:
            raise ProveStateError("Per chiudere su prova_valutata devi prima impostare la data valutazione prova.")

    if to_state == "prova_avviata" and prova.get("stato_corrente") != "busta_estratta":
        raise ProveStateError("La prova può essere avviata solo dopo lo stato busta_estratta.")


def _update_fields_for_state(prova, to_state, payload=None):
    now_dt = datetime.now()
    today = now_dt.date()
    updates = {}

    if to_state == "convocazioni_inviate":
        updates["data_convocazioni_inviate"] = today
    elif to_state == "lista_candidati_acquisita":
        updates["data_lista_candidati_acquisita"] = today
    elif to_state == "template_moodle_inviati":
        updates["data_template_moodle_inviati"] = today
    elif to_state == "excel_presenti_inviato":
        updates["data_excel_presenti_inviato"] = today
    elif to_state == "lista_presenti_ricevuta":
        updates["data_lista_presenti_ricevuta"] = today
    elif to_state == "presenti_attivati_su_moodle":
        updates["data_presenti_attivati_moodle"] = today
        raw = ((payload or {}).get("num_presenti") or "").strip()
        if raw:
            updates["num_presenti"] = int(raw)
    elif to_state == "busta_estratta":
        chosen = ((payload or {}).get("busta_estratta_codice") or "").strip().upper()
        updates["busta_estratta_codice"] = chosen
    elif to_state == "prova_avviata":
        inizio = now_dt
        custom_start = ((payload or {}).get("orario_inizio_prova") or "").strip()
        if custom_start:
            try:
                inizio = datetime.fromisoformat(custom_start)
            except Exception:
                pass
        updates["orario_inizio_prova"] = inizio
        updates["orario_fine_previsto"] = calcola_orario_fine_previsto(inizio, prova.get("durata_minuti"))
    elif to_state == "prova_conclusa":
        if not prova.get("orario_fine_previsto"):
            updates["orario_fine_previsto"] = now_dt
    elif to_state == "inserire_data_valutazione_prova":
        raw_date = ((payload or {}).get("data_valutazione_prova") or "").strip()
        if raw_date:
            updates["data_valutazione_prova"] = date.fromisoformat(raw_date)

    return updates


def transition_prova_state(prove_id, to_state, utente, is_admin=False, payload=None):
    if to_state not in PROVE_STATES:
        raise ProveStateError(f"Stato destinazione non valido: {to_state}")

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT prove_id, stato_corrente, data_prova, ora_prova, luogo,
                       segretario_nome, segretario_email, referente_nome, referente_email,
                       numero_bando, titolo, esperto_email, durata_minuti, orario_fine_previsto, busta_estratta_codice,
                       referente_dati_confermati
                FROM prove
                WHERE prove_id = %s
                """,
                (prove_id,),
            )
            row = cur.fetchone()
            if not row:
                raise ProveStateError("Concorso/prova non trovato.")

            prova = {
                "prove_id": row[0],
                "stato_corrente": row[1],
                "data_prova": row[2],
                "ora_prova": row[3],
                "luogo": row[4],
                "segretario_nome": row[5],
                "segretario_email": row[6],
                "referente_nome": row[7],
                "referente_email": row[8],
                "numero_bando": row[9],
                "titolo": row[10],
                "esperto_email": row[11],
                "durata_minuti": row[12],
                "orario_fine_previsto": row[13],
                "busta_estratta_codice": row[14],
                "referente_dati_confermati": row[15],
            }

            from_state = prova["stato_corrente"]
            if not from_state:
                raise ProveStateError("Stato corrente non valorizzato.")
            if from_state == to_state:
                return from_state

            if not _can_forward_only(from_state, to_state):
                raise ProveStateError("Transizione non consentita: puoi avanzare solo allo step successivo.")

            _validate_transition(cur, prova, to_state, payload=payload)
            extra_updates = _update_fields_for_state(prova, to_state, payload=payload)

            set_parts = ["stato_corrente = %s", "updated_at = NOW()", "updated_by = %s"]
            params = [to_state, utente]
            for col, val in extra_updates.items():
                set_parts.append(f"{col} = %s")
                params.append(val)
            params.append(prove_id)

            cur.execute(
                f"UPDATE prove SET {', '.join(set_parts)} WHERE prove_id = %s",
                tuple(params),
            )

            cur.execute(
                """
                INSERT INTO prove_state_log (prove_id, from_state, to_state, utente, payload_json)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (prove_id, from_state, to_state, utente, json.dumps(payload or {}, ensure_ascii=True)),
            )

        conn.commit()

    return to_state


def next_state_for(stato_corrente):
    if stato_corrente not in PROVE_STATES:
        return None
    idx = PROVE_STATES.index(stato_corrente)
    if idx + 1 >= len(PROVE_STATES):
        return None
    return PROVE_STATES[idx + 1]
