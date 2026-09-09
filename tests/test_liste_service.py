from pathlib import Path


def test_send_latest_list_uses_session_remote_expert(monkeypatch, tmp_path):
    from utils import liste_service

    sent = {}
    email_status_calls = []
    xlsx = tmp_path / "presenti.xlsx"
    csv = tmp_path / "moodle.csv"
    xlsx.write_text("xlsx")
    csv.write_text("csv")

    monkeypatch.setattr(
        liste_service,
        "get_latest_list",
        lambda session_id: {
            "id": 1,
            "session_id": session_id,
            "num_presenti": 2,
        },
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_by_id",
        lambda session_id: {
            "session_id": session_id,
            "commission_id": "commission-1",
            "nome": "Prova scritta",
        },
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_config",
        lambda session_id: {"email_esperto_remoto": "esperto.sessione@cnr.it"},
    )
    monkeypatch.setattr(
        liste_service,
        "get_download_path",
        lambda session_id, file_type: (
            str(xlsx if file_type == "xlsx" else csv),
            Path(xlsx if file_type == "xlsx" else csv).name,
        ),
    )

    def fake_send(to_emails, subject, body, **kwargs):
        sent["to_emails"] = to_emails
        sent["subject"] = subject
        sent["body"] = body
        sent["kwargs"] = kwargs
        return True, None

    monkeypatch.setattr(liste_service, "send_notification_email", fake_send)
    monkeypatch.setattr(liste_service, "get_stato_corrente", lambda session_id: "liste_generate")
    monkeypatch.setattr(liste_service, "claim_transition", lambda *args, **kwargs: True)
    monkeypatch.setattr(
        liste_service,
        "_set_list_email_status",
        lambda list_id, *, status, error: email_status_calls.append((list_id, status, error)),
    )

    result = liste_service.send_latest_list(
        "session-1",
        actor_email="segretario@cnr.it",
    )

    assert result["recipients"] == ["esperto.sessione@cnr.it"]
    assert result["sent"] is True
    assert result["status"] == "sent"
    assert result["email_status"] == "sent"
    assert sent["to_emails"] == ["esperto.sessione@cnr.it"]
    assert sent["kwargs"]["cc_emails"] == ["segretario@cnr.it"]
    assert email_status_calls == [(1, "sent", None)]


def test_send_latest_list_requires_session_remote_expert(monkeypatch):
    from utils import liste_service

    monkeypatch.setattr(
        liste_service,
        "get_latest_list",
        lambda session_id: {"id": 1, "session_id": session_id, "num_presenti": 2},
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_by_id",
        lambda session_id: {
            "session_id": session_id,
            "commission_id": "commission-1",
            "nome": "Prova scritta",
        },
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_config",
        lambda session_id: {},
    )
    monkeypatch.setattr(liste_service, "get_stato_corrente", lambda session_id: "liste_generate")

    try:
        liste_service.send_latest_list(
            "session-1",
            actor_email="segretario@cnr.it",
        )
    except liste_service.ListOperationError as error:
        assert "per questa sessione" in str(error)
    else:
        raise AssertionError("expected ListOperationError")


def test_send_latest_list_is_idempotent_when_already_sent(monkeypatch):
    from utils import liste_service

    send_calls = []
    claim_calls = []

    monkeypatch.setattr(
        liste_service,
        "get_latest_list",
        lambda session_id: {
            "id": 1,
            "session_id": session_id,
            "num_presenti": 2,
            "email_status": "sent",
        },
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_by_id",
        lambda session_id: {"session_id": session_id, "nome": "Prova scritta"},
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_config",
        lambda session_id: {"email_esperto_remoto": "esperto.sessione@cnr.it"},
    )
    monkeypatch.setattr(liste_service, "get_stato_corrente", lambda session_id: "liste_inviate")
    monkeypatch.setattr(liste_service, "send_notification_email", lambda *args, **kwargs: send_calls.append(args))
    monkeypatch.setattr(liste_service, "claim_transition", lambda *args, **kwargs: claim_calls.append(args))

    result = liste_service.send_latest_list("session-1", actor_email="segretario@cnr.it")

    assert result["already_sent"] is True
    assert result["status"] == "already_sent"
    assert result["sent"] is True
    assert result["email_status"] == "sent"
    assert send_calls == []
    assert claim_calls == []


def test_send_latest_list_already_sent_surfaces_persisted_email_failure(monkeypatch):
    from utils import liste_service

    monkeypatch.setattr(
        liste_service,
        "get_latest_list",
        lambda session_id: {
            "id": 1,
            "session_id": session_id,
            "num_presenti": 2,
            "email_status": "failed",
            "email_error": "SMTP KO",
        },
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_by_id",
        lambda session_id: {"session_id": session_id, "nome": "Prova scritta"},
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_config",
        lambda session_id: {"email_esperto_remoto": "esperto.sessione@cnr.it"},
    )
    monkeypatch.setattr(liste_service, "get_stato_corrente", lambda session_id: "liste_inviate")

    result = liste_service.send_latest_list("session-1", actor_email="segretario@cnr.it")

    assert result["already_sent"] is True
    assert result["sent"] is False
    assert result["email_status"] == "failed"
    assert "SMTP KO" in result["warning"]


def test_send_latest_list_loses_race_does_not_resend_email(monkeypatch):
    """Se un'altra richiesta ha gia' reclamato la transizione (race su doppio
    click/doppia tab), questa richiesta non deve inviare una seconda email."""
    from utils import liste_service

    send_calls = []

    monkeypatch.setattr(
        liste_service,
        "get_latest_list",
        lambda session_id: {
            "id": 1,
            "session_id": session_id,
            "num_presenti": 2,
            "email_status": "sent",
        },
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_by_id",
        lambda session_id: {"session_id": session_id, "nome": "Prova scritta"},
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_config",
        lambda session_id: {"email_esperto_remoto": "esperto.sessione@cnr.it"},
    )
    # Entrambe le richieste concorrenti leggono ancora lo stato pre-invio.
    monkeypatch.setattr(liste_service, "get_stato_corrente", lambda session_id: "liste_generate")
    monkeypatch.setattr(liste_service, "send_notification_email", lambda *args, **kwargs: send_calls.append(args))
    # L'altra richiesta ha gia' vinto la race: claim_transition ritorna False.
    monkeypatch.setattr(liste_service, "claim_transition", lambda *args, **kwargs: False)

    result = liste_service.send_latest_list("session-1", actor_email="segretario@cnr.it")

    assert result["already_sent"] is True
    assert result["sent"] is True
    assert send_calls == []


def test_send_latest_list_advances_state_when_mail_fails(monkeypatch, tmp_path):
    from utils import liste_service

    xlsx = tmp_path / "presenti.xlsx"
    csv = tmp_path / "moodle.csv"
    xlsx.write_text("xlsx")
    csv.write_text("csv")
    claim_calls = []
    email_status_calls = []

    monkeypatch.setattr(
        liste_service,
        "get_latest_list",
        lambda session_id: {"id": 1, "session_id": session_id, "num_presenti": 2},
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_by_id",
        lambda session_id: {"session_id": session_id, "nome": "Prova scritta"},
    )
    monkeypatch.setattr(
        liste_service,
        "get_sessione_config",
        lambda session_id: {"email_esperto_remoto": "esperto.sessione@cnr.it"},
    )
    monkeypatch.setattr(
        liste_service,
        "get_download_path",
        lambda session_id, file_type: (
            str(xlsx if file_type == "xlsx" else csv),
            Path(xlsx if file_type == "xlsx" else csv).name,
        ),
    )
    monkeypatch.setattr(liste_service, "get_stato_corrente", lambda session_id: "liste_generate")
    monkeypatch.setattr(liste_service, "send_notification_email", lambda *args, **kwargs: (False, "SMTP KO"))

    def fake_claim(session_id, stato_da, stato_a, utente=None):
        claim_calls.append((session_id, stato_da, stato_a, utente))
        return True

    monkeypatch.setattr(liste_service, "claim_transition", fake_claim)
    monkeypatch.setattr(
        liste_service,
        "_set_list_email_status",
        lambda list_id, *, status, error: email_status_calls.append((list_id, status, error)),
    )

    result = liste_service.send_latest_list("session-1", actor_email="segretario@cnr.it")

    assert result["sent"] is False
    assert result["state_updated"] is True
    assert result["status"] == "available_email_failed"
    assert result["email_status"] == "failed"
    assert "rese disponibili" in result["message"]
    assert result["warning"] == "SMTP KO"
    assert claim_calls == [("session-1", "liste_generate", "liste_inviate", "segretario@cnr.it")]
    assert email_status_calls == [(1, "failed", "SMTP KO")]


def test_generate_lists_returns_existing_list_after_sent_state(monkeypatch):
    from utils import liste_service

    monkeypatch.setattr(liste_service, "get_stato_corrente", lambda session_id: "liste_inviate")
    monkeypatch.setattr(
        liste_service,
        "get_latest_list",
        lambda session_id: {"id": 1, "session_id": session_id, "num_presenti": 2},
    )

    result = liste_service.generate_lists("session-1", actor_email="segretario@cnr.it")

    assert result["status"] == "already_sent"
    assert "già inviate" in result["message"]
