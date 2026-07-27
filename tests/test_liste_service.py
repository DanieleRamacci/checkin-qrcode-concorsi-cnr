from pathlib import Path


def test_send_latest_list_uses_session_remote_expert(monkeypatch, tmp_path):
    from utils import liste_service

    sent = {}
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
    monkeypatch.setattr(liste_service, "set_stato_corrente", lambda *args, **kwargs: None)

    result = liste_service.send_latest_list(
        "session-1",
        actor_email="segretario@cnr.it",
    )

    assert result["recipients"] == ["esperto.sessione@cnr.it"]
    assert sent["to_emails"] == ["esperto.sessione@cnr.it"]
    assert sent["kwargs"]["cc_emails"] == ["segretario@cnr.it"]


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

    try:
        liste_service.send_latest_list(
            "session-1",
            actor_email="segretario@cnr.it",
        )
    except liste_service.ListOperationError as error:
        assert "per questa sessione" in str(error)
    else:
        raise AssertionError("expected ListOperationError")
