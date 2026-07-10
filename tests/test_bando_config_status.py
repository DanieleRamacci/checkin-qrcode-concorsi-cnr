from utils.bando_config_status import compute_bando_config_status


def test_bando_config_status_requires_remote_expert():
    status = compute_bando_config_status(
        {
            "email_referente": "referente@cnr.it",
            "email_segretario": "segretario@cnr.it",
            "durata_prova_minuti": 60,
            "commissione_members": [{"nome": "Mario Rossi", "email": "mario@cnr.it"}],
        }
    )

    assert status == {
        "config_status": "da_configurare",
        "expert_assigned": False,
        "required_data_complete": False,
    }


def test_bando_config_status_marks_expert_assigned_before_completion():
    status = compute_bando_config_status(
        {
            "email_esperto_remoto": "esperto@cnr.it",
        }
    )

    assert status == {
        "config_status": "esperto_assegnato",
        "expert_assigned": True,
        "required_data_complete": False,
    }


def test_bando_config_status_marks_required_data_complete():
    status = compute_bando_config_status(
        {
            "email_referente": "referente@cnr.it",
            "email_esperto_remoto": "esperto@cnr.it",
            "email_segretario": "segretario@cnr.it",
            "durata_prova_minuti": 60,
            "commissione_members": [{"nome": "Mario Rossi", "email": "mario@cnr.it"}],
        }
    )

    assert status == {
        "config_status": "dati_compilati",
        "expert_assigned": True,
        "required_data_complete": True,
    }
