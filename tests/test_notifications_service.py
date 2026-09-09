from utils import notifications


def _make_fake_connection():
    inserted = []

    class FakeCursor:
        def execute(self, query, params=None):
            inserted.append((query.strip(), params))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    class FakeConnection:
        def cursor(self):
            return FakeCursor()

        def commit(self):
            inserted.append(("COMMIT", None))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    return FakeConnection(), inserted


def test_add_notification_persists_author_display_and_role(monkeypatch):
    conn, inserted = _make_fake_connection()
    monkeypatch.setattr(notifications, "get_db_connection", lambda: conn)
    monkeypatch.setattr(
        notifications,
        "get_sessione_config",
        lambda session_id: {"email_esperto_remoto": "remote.expert@cnr.it"},
    )
    monkeypatch.setattr(notifications, "get_user_roles", lambda email: set())

    notifications.add_notification(
        "session-1", "state", payload="liste_inviate", author_email="remote.expert@cnr.it"
    )

    insert_query, insert_params = next(
        (q, p) for q, p in inserted if q.startswith("INSERT INTO session_notifications")
    )
    assert "author_display" in insert_query
    assert "author_role" in insert_query
    assert insert_params[-2:] == ("Remote Expert", "Inf. remoto")


def test_get_notifications_uses_persisted_author_fields(monkeypatch):
    class FakeCursor:
        def execute(self, query, params=None):
            pass

        def fetchall(self):
            return [
                (1, "session-1", "sede.tech@cnr.it", "message", "ciao", "2026-09-09T10:00:00",
                 "Sede Tech", "Inf. sede"),
            ]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    class FakeConnection:
        def cursor(self):
            return FakeCursor()

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    monkeypatch.setattr(notifications, "get_db_connection", lambda: FakeConnection())
    # Se il fallback live venisse ancora usato, questi mock farebbero fallire
    # l'assert sotto restituendo un valore diverso da quello persistito.
    monkeypatch.setattr(
        notifications,
        "get_sessione_config",
        lambda session_id: {"email_informatico_sede": "someone.else@cnr.it"},
    )
    monkeypatch.setattr(notifications, "get_user_roles", lambda email: set())

    items = notifications.get_notifications("session-1", limit=20)

    assert items[0]["author_display"] == "Sede Tech"
    assert items[0]["author_role"] == "Inf. sede"


def test_get_notifications_falls_back_for_legacy_rows_without_persisted_role(monkeypatch):
    class FakeCursor:
        def execute(self, query, params=None):
            pass

        def fetchall(self):
            return [
                (1, "session-1", "sede.tech@cnr.it", "message", "ciao", "2026-09-09T10:00:00",
                 None, None),
            ]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    class FakeConnection:
        def cursor(self):
            return FakeCursor()

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

    monkeypatch.setattr(notifications, "get_db_connection", lambda: FakeConnection())
    monkeypatch.setattr(
        notifications,
        "get_sessione_config",
        lambda session_id: {"email_informatico_sede": "sede.tech@cnr.it"},
    )
    monkeypatch.setattr(notifications, "get_user_roles", lambda email: set())

    items = notifications.get_notifications("session-1", limit=20)

    assert items[0]["author_display"] == "Sede Tech"
    assert items[0]["author_role"] == "Inf. sede"
