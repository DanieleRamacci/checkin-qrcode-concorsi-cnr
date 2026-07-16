from contextlib import contextmanager

import pytest
from flask import Flask


class FakeCursor:
    def __init__(self, row):
        self.row = row
        self.executed = None

    def execute(self, query, params):
        self.executed = (query, params)

    def fetchone(self):
        return self.row

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


class FakeConnection:
    def __init__(self, row):
        self.row = row

    def cursor(self):
        return FakeCursor(self.row)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


def connection_factory(row):
    @contextmanager
    def factory():
        yield FakeConnection(row)

    return factory


def tracking_connection_factory(row, tracker):
    class TrackingCursor(FakeCursor):
        def execute(self, query, params):
            super().execute(query, params)
            tracker.append((query, params))

    class TrackingConnection(FakeConnection):
        def cursor(self):
            return TrackingCursor(self.row)

    @contextmanager
    def factory():
        yield TrackingConnection(row)

    return factory


def test_admin_can_access_any_commission(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(
        authorization, "get_user_roles", lambda email: {authorization.ROLE_ADMIN}
    )

    assert authorization.can_access_commission("admin@cnr.it", "commission-1")


def test_owner_can_access_commission(monkeypatch):
    from utils import authorization

    executed = []
    monkeypatch.setattr(authorization, "get_user_roles", lambda email: set())
    monkeypatch.setattr(
        authorization, "get_db_connection", tracking_connection_factory((1,), executed)
    )

    assert authorization.can_access_commission("owner@cnr.it", "commission-1")
    assert "COALESCE(access_active, TRUE)" in executed[0][0]
    assert "source_role" in executed[0][0]


def test_unrelated_user_cannot_access_session(monkeypatch):
    from utils import authorization

    executed = []
    monkeypatch.setattr(authorization, "get_user_roles", lambda email: set())
    monkeypatch.setattr(
        authorization, "get_db_connection", tracking_connection_factory(None, executed)
    )

    assert not authorization.can_access_session("other@cnr.it", "session-1")
    assert "COALESCE(c.access_active, TRUE)" in executed[0][0]
    assert "c.source_role" in executed[0][0]


def test_explicit_role_can_be_allowed(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "get_user_roles",
        lambda email: {authorization.ROLE_ESPERTO},
    )

    assert authorization.can_access_session(
        "expert@cnr.it",
        "session-1",
        allowed_roles={authorization.ROLE_ESPERTO},
    )


def test_secretary_cannot_use_sede_profile_without_assignment(monkeypatch):
    from utils import authorization

    executed = []
    monkeypatch.setattr(authorization, "get_user_roles", lambda email: set())
    monkeypatch.setattr(
        authorization,
        "get_db_connection",
        tracking_connection_factory(None, executed),
    )

    assert not authorization.can_access_session(
        "segretario@cnr.it",
        "session-1",
        profile_mode="sede",
    )
    assert "email_informatico_sede" in executed[0][0]


def test_sede_assignee_can_use_sede_profile(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(authorization, "get_user_roles", lambda email: set())
    monkeypatch.setattr(
        authorization,
        "get_db_connection",
        connection_factory((1,)),
    )

    assert authorization.can_access_session(
        "informatico@cnr.it",
        "session-1",
        profile_mode="sede",
    )


def test_global_expert_cannot_use_unassigned_expert_profile(monkeypatch):
    from utils import authorization

    executed = []
    monkeypatch.setattr(
        authorization,
        "get_user_roles",
        lambda email: {authorization.ROLE_ESPERTO},
    )
    monkeypatch.setattr(
        authorization,
        "get_db_connection",
        tracking_connection_factory(None, executed),
    )

    assert not authorization.can_access_session(
        "expert@cnr.it",
        "session-1",
        profile_mode="expert",
    )
    assert "email_esperto_remoto" in executed[0][0]


def test_assigned_remote_expert_can_use_expert_profile(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(
        authorization,
        "get_user_roles",
        lambda email: {authorization.ROLE_ESPERTO},
    )
    monkeypatch.setattr(
        authorization,
        "get_db_connection",
        connection_factory((1,)),
    )

    assert authorization.can_access_session(
        "expert@cnr.it",
        "session-1",
        profile_mode="expert",
    )


def test_referente_can_access_assigned_bando(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(authorization, "get_user_roles", lambda email: set())
    monkeypatch.setattr(
        authorization, "get_db_connection", connection_factory((1,))
    )

    assert authorization.can_access_commission(
        "Referente@Cnr.it", "commission-1", allow_referente=True
    )


def test_referente_without_assignment_is_denied(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(authorization, "get_user_roles", lambda email: set())
    monkeypatch.setattr(
        authorization, "get_db_connection", connection_factory(None)
    )

    assert not authorization.can_access_commission(
        "referente@cnr.it", "commission-1", allow_referente=True
    )


def test_referente_flag_off_does_not_check_bando_referenti(monkeypatch):
    from utils import authorization

    monkeypatch.setattr(authorization, "get_user_roles", lambda email: set())
    monkeypatch.setattr(
        authorization, "get_db_connection", connection_factory((1,))
    )

    # allow_referente non passato: stesso comportamento di prima, usato ad
    # esempio dagli endpoint sessioni/candidati riservati a segretario e
    # membri di commissione.
    assert authorization.can_access_commission("owner@cnr.it", "commission-1")


def test_session_decorator_rejects_unrelated_user(monkeypatch):
    from utils import authorization

    app = Flask(__name__)
    app.secret_key = "test"
    monkeypatch.setattr(
        authorization, "can_access_session", lambda email, session_id, **kwargs: False
    )

    @app.get("/sessions/<session_id>")
    @authorization.session_access_required()
    def protected(session_id):
        return {"session_id": session_id}

    with app.test_client() as client:
        with client.session_transaction() as flask_session:
            flask_session["user_email"] = "other@cnr.it"
        response = client.get("/sessions/session-1")

    assert response.status_code == 403
