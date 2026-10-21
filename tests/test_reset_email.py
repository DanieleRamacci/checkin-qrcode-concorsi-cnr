from utils import candidati_service


class _Cursor:
    def __init__(self, row):
        self.row = row
        self.rowcount = 1

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, *_args):
        pass

    def fetchone(self):
        return self.row


class _Connection:
    def __init__(self, row=("Prova scritta", "C1", "Ada", "Rossi")):
        self.row = row

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def cursor(self, *_args, **_kwargs):
        return _Cursor(self.row)

    def commit(self):
        pass


def _setup(monkeypatch, expert="esp@cnr.it", send_result=(True, None)):
    sent = []
    monkeypatch.setattr(candidati_service, "get_db_connection", lambda: _Connection())
    monkeypatch.setattr(candidati_service, "get_merged_config", lambda *_: {"email_esperto_remoto": expert})
    monkeypatch.setattr(candidati_service, "_author_role", lambda *_: "Inf. sede")
    monkeypatch.setattr(candidati_service, "add_notification", lambda *_a, **_k: None)
    monkeypatch.setattr(candidati_service, "_get_candidate", lambda *_: {"uid": "u1"})
    monkeypatch.setenv("OIDC_REDIRECT_URI", "https://checkin.example/oidc-callback")

    def fake_send(to, subject, body, **kwargs):
        sent.append((to, subject, body, kwargs.get("source")))
        return send_result

    monkeypatch.setattr(candidati_service, "send_notification_email", fake_send)
    return sent


def test_reset_request_emails_the_remote_expert(monkeypatch):
    sent = _setup(monkeypatch)

    candidati_service.update_reset_password("S1", "u1", operation="request", actor_email="sede@cnr.it")

    assert len(sent) == 1
    to, subject, body, source = sent[0]
    assert to == ["esp@cnr.it"]
    assert subject == "[Check-in] Reset password richiesto – Prova scritta"
    assert "Rossi Ada" in body and "Informatico in sede" in body
    assert "https://checkin.example/sessioni/S1?mode=expert" in body
    assert source == "api_v1.reset.request"


def test_no_email_for_other_operations_or_without_expert(monkeypatch):
    sent = _setup(monkeypatch)
    for operation in ("cancel_request", "complete", "undo_complete"):
        candidati_service.update_reset_password("S1", "u1", operation=operation, actor_email="esp@cnr.it")
    assert sent == []

    sent = _setup(monkeypatch, expert="")
    candidati_service.update_reset_password("S1", "u1", operation="request", actor_email="sede@cnr.it")
    assert sent == []


def test_failed_email_does_not_fail_the_request(monkeypatch):
    _setup(monkeypatch, send_result=(False, "SMTP KO"))

    result = candidati_service.update_reset_password("S1", "u1", operation="request", actor_email="sede@cnr.it")

    assert result == {"uid": "u1"}
