from utils import candidati_service


def _row(**overrides):
    row = {
        "uid": "u1",
        "first_name": "Ada",
        "last_name": "Rossi",
        "document_number": "DOC1",
        "document_date": None,
        "checkin_effettuato": True,
        "reset_password_richiesto": True,
        "reset_password_richiesto_by": "sede@cnr.it",
        "reset_password_effettuato": False,
    }
    row.update(overrides)
    return row


def test_open_reset_shows_the_requester_role_without_email(monkeypatch):
    monkeypatch.setattr(candidati_service, "_author_role", lambda session_id, email: "Inf. sede")
    row = _row()
    dto = candidati_service._candidate_dto(row, candidati_service._requester_role("s1", row))
    assert dto["reset_password_richiesto_role"] == "Informatico in sede"
    assert "sede@cnr.it" not in dto.values()


def test_no_requester_role_without_an_open_request(monkeypatch):
    calls = []
    monkeypatch.setattr(candidati_service, "_author_role", lambda *args: calls.append(args) or "Segretario")
    assert candidati_service._requester_role("s1", _row(reset_password_richiesto=False)) is None
    assert candidati_service._requester_role("s1", _row(reset_password_richiesto_by=None)) is None
    assert calls == []
