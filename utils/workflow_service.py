from utils.stato import AZIONI_PER_STATO, get_stato_corrente, set_stato_corrente


class InvalidTransition(Exception):
    pass


class SessionNotFound(Exception):
    pass


ACTION_DEFINITIONS = {
    "configura_sessione": ("Configura sessione", "configurata", False),
    "scarica_candidati": ("Importa candidati", "candidati_scaricati", True),
    "collega_dispositivo": ("Collega dispositivo", "dispositivi_connessi", False),
    "avvia_checkin": ("Avvia check-in", "checkin_avviato", True),
    "concludi_checkin": ("Concludi check-in", "checkin_concluso", True),
    "genera_liste": ("Genera liste", "liste_generate", True),
    "invia_liste": ("Invia liste", "liste_inviate", True),
    "aggiorna_presenti_moodle": (
        "Aggiorna presenti Moodle",
        "lista_presenti_aggiornata_su_moodle",
        True,
    ),
    "avvia_esame": ("Prepara esame", "avvia_esame", True),
    "inizia_esame": ("Avvia esame", "esame_in_corso", True),
    "concludi_esame": ("Concludi esame", "esame_concluso", True),
}

DIRECT_ACTIONS = {
    "avvia_checkin",
    "concludi_checkin",
    "aggiorna_presenti_moodle",
    "avvia_esame",
    "inizia_esame",
    "concludi_esame",
}

EXPERT_ACTIONS = {
    "aggiorna_presenti_moodle",
    "avvia_esame",
    "inizia_esame",
    "concludi_esame",
}


def is_expert_action(action: str) -> bool:
    return action in EXPERT_ACTIONS


def describe_workflow(session_id: str) -> dict:
    current_state = get_stato_corrente(session_id)
    if current_state is None:
        raise SessionNotFound(session_id)

    available = AZIONI_PER_STATO.get(current_state, [])
    actions = []
    for action in available:
        label, target_state, requires_confirmation = ACTION_DEFINITIONS[action]
        actions.append(
            {
                "action": action,
                "label": label,
                "enabled": True,
                "disabled_reason": None,
                "target_state": target_state,
                "requires_confirmation": requires_confirmation,
            }
        )
    return {"current_state": current_state, "actions": actions}


def execute_workflow_action(
    session_id: str,
    action: str,
    *,
    actor_email: str,
) -> dict:
    workflow = describe_workflow(session_id)
    available = {item["action"] for item in workflow["actions"]}
    if action not in available:
        raise InvalidTransition(
            f"L'azione {action} non è disponibile nello stato "
            f"{workflow['current_state']}."
        )
    if action not in DIRECT_ACTIONS:
        raise InvalidTransition(
            "Questa azione deve essere eseguita dal relativo endpoint applicativo."
        )

    target_state = ACTION_DEFINITIONS[action][1]
    set_stato_corrente(session_id, target_state, utente=actor_email)
    return describe_workflow(session_id)
