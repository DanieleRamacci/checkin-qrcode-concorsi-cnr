from utils import stato


def _make_fake_connection(rowcount: int):
    executed = []

    class FakeCursor:
        def execute(self, query, params=None):
            executed.append((query.strip(), params))
            self.rowcount = rowcount

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    class FakeConnection:
        def cursor(self):
            return FakeCursor()

        def commit(self):
            executed.append(("COMMIT", None))

        def rollback(self):
            executed.append(("ROLLBACK", None))

        def close(self):
            executed.append(("CLOSE", None))

    return FakeConnection(), executed


def test_claim_transition_succeeds_and_logs_when_state_matches(monkeypatch):
    conn, executed = _make_fake_connection(rowcount=1)
    monkeypatch.setattr(stato, "get_db_connection", lambda: conn)
    monkeypatch.setattr("utils.notifications.add_notification", lambda *a, **k: None)

    claimed = stato.claim_transition("session-1", "liste_generate", "liste_inviate", utente="segretario@cnr.it")

    assert claimed is True
    queries = [q for q, _ in executed]
    assert any("UPDATE sessioni" in q for q in queries)
    assert any("INSERT INTO session_state_log" in q for q in queries)
    assert ("COMMIT", None) in executed


def test_claim_transition_loses_race_when_state_already_moved(monkeypatch):
    conn, executed = _make_fake_connection(rowcount=0)
    monkeypatch.setattr(stato, "get_db_connection", lambda: conn)

    claimed = stato.claim_transition("session-1", "liste_generate", "liste_inviate", utente="segretario@cnr.it")

    assert claimed is False
    queries = [q for q, _ in executed]
    assert any("UPDATE sessioni" in q for q in queries)
    assert not any("INSERT INTO session_state_log" in q for q in queries)
    assert ("COMMIT", None) in executed


def test_claim_transition_rejects_invalid_transition_without_db_call(monkeypatch):
    called = []
    monkeypatch.setattr(stato, "get_db_connection", lambda: called.append(True))

    try:
        stato.claim_transition("session-1", "liste_generate", "esame_concluso", utente="segretario@cnr.it")
    except Exception as error:
        assert "Transizione non valida" in str(error)
    else:
        raise AssertionError("expected an exception for an invalid transition")

    assert called == []
