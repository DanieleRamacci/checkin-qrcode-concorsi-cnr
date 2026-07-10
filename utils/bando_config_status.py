def _has_commission_member(members) -> bool:
    return any(
        isinstance(member, dict)
        and (member.get("email") or member.get("nome") or member.get("name"))
        for member in (members or [])
    )


def compute_bando_config_status(config: dict) -> dict:
    """Calcola lo stato operativo sintetico della configurazione bando."""
    expert_assigned = bool((config.get("email_esperto_remoto") or "").strip())
    required_data_complete = all(
        [
            bool((config.get("email_referente") or "").strip()),
            expert_assigned,
            bool((config.get("email_segretario") or "").strip()),
            bool(config.get("durata_prova_minuti")),
            _has_commission_member(config.get("commissione_members")),
        ]
    )
    if required_data_complete:
        status = "dati_compilati"
    elif expert_assigned:
        status = "esperto_assegnato"
    else:
        status = "da_configurare"
    return {
        "config_status": status,
        "expert_assigned": expert_assigned,
        "required_data_complete": required_data_complete,
    }
