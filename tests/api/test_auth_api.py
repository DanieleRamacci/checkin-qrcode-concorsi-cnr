from flask import Flask

from routes.api_v1 import api_v1_bp
from routes.api_v1.csrf import get_csrf_token


def create_test_app():
    app = Flask(__name__)
    app.secret_key = "test-secret"
    app.register_blueprint(api_v1_bp)
    app.config.update(TESTING=True)
    return app


def test_me_rejects_anonymous_user():
    response = create_test_app().test_client().get("/api/v1/me")

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "authentication_required"


def test_me_returns_user_context_and_csrf(monkeypatch):
    from routes.api_v1 import auth

    class CursorStub:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def execute(self, *_args):
            pass

        def fetchone(self):
            return None

    class ConnectionStub:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def cursor(self):
            return CursorStub()

    monkeypatch.setattr(
        auth,
        "get_user_roles",
        lambda email: {"esperto_informatico"},
    )
    monkeypatch.setattr(
        auth,
        "ensure_fresh_access_token",
        lambda **kwargs: "fresh-token",
    )
    monkeypatch.setattr(
        auth,
        "has_any_assigned_sede_session",
        lambda email: True,
    )
    monkeypatch.setattr(
        auth,
        "get_app_settings",
        lambda: {"institution_name": "CNR", "app_title": "Check-in"},
    )
    monkeypatch.setattr(auth, "get_db_connection", ConnectionStub)
    app = create_test_app()
    app.config["APP_VERSION"] = "abc1234"
    app.config["APP_BUILD_TIME"] = "2026-07-16T12:00:00Z"
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "expert@cnr.it"
        flask_session["user_info"] = {"name": "Esperto CNR"}

    response = client.get("/api/v1/me")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["authenticated"] is True
    assert payload["email"] == "expert@cnr.it"
    assert payload["display_name"] == "Esperto CNR"
    assert payload["roles"] == ["esperto_informatico"]
    # Solo profili di supporto: segretario e referente non vengono proposti.
    assert payload["profiles"] == ["sede", "esperto"]
    assert "expert_workflow" in payload["capabilities"]
    assert "sede_workflow" in payload["capabilities"]
    assert payload["csrf_token"]
    assert payload["app_version"] == "abc1234"
    assert payload["app_build_time"] == "2026-07-16T12:00:00Z"
    assert payload["app_settings"]["institution_name"] == "CNR"


def test_profiles_for_user_returns_available_profiles_and_first_access(monkeypatch):
    from routes.api_v1 import auth

    def profile_result(secretary, referente, *, assigned=False, roles=()):
        class CursorStub:
            def __init__(self):
                self.results = iter([(1,) if secretary else None, (1,) if referente else None])

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def execute(self, *_args):
                pass

            def fetchone(self):
                return next(self.results)

        class ConnectionStub:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def cursor(self):
                return CursorStub()

        monkeypatch.setattr(auth, "get_db_connection", ConnectionStub)
        monkeypatch.setattr(auth, "has_any_assigned_sede_session", lambda _email: assigned)
        return auth._profiles_for_user("user@cnr.it", set(roles))

    assert profile_result(True, False) == ["segretario"]
    assert profile_result(False, True) == ["referente"]
    assert profile_result(False, False) == ["segretario", "referente"]
    assert profile_result(True, True, assigned=True, roles={"esperto_informatico", "admin_globale"}) == [
        "segretario", "referente", "sede", "esperto", "admin",
    ]


def test_session_refresh_returns_new_expiry(monkeypatch):
    from routes.api_v1 import auth

    monkeypatch.setattr(
        auth,
        "ensure_fresh_access_token",
        lambda **kwargs: "fresh-access-token",
    )
    app = create_test_app()
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "user@cnr.it"
        flask_session["expires_at"] = 123456
        csrf_token = get_csrf_token(flask_session)

    response = client.post(
        "/api/v1/session/refresh",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "authenticated": True,
        "expires_at": 123456,
        "refreshed": True,
    }


def test_me_requires_reauthentication_when_refresh_fails(monkeypatch):
    from routes.api_v1 import auth

    monkeypatch.setattr(auth, "ensure_fresh_access_token", lambda **kwargs: None)
    app = create_test_app()
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "user@cnr.it"

    response = client.get("/api/v1/me")

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "reauthentication_required"


def test_session_refresh_requires_reauthentication_when_refresh_fails(monkeypatch):
    from routes.api_v1 import auth

    monkeypatch.setattr(auth, "ensure_fresh_access_token", lambda **kwargs: None)
    app = create_test_app()
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "user@cnr.it"
        csrf_token = get_csrf_token(flask_session)

    response = client.post(
        "/api/v1/session/refresh",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "reauthentication_required"


def test_api_logout_clears_local_session():
    app = create_test_app()
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "user@cnr.it"
        flask_session["access_token"] = "access"
        csrf_token = get_csrf_token(flask_session)

    response = client.post(
        "/api/v1/logout",
        headers={"X-CSRF-Token": csrf_token},
    )

    assert response.status_code == 200
    assert response.get_json()["authenticated"] is False
    with client.session_transaction() as flask_session:
        assert "user_email" not in flask_session
        assert "access_token" not in flask_session


def test_profiles_offer_secretary_and_referente_on_first_access(monkeypatch):
    from routes.api_v1 import auth

    class CursorStub:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def execute(self, *_args):
            pass

        def fetchone(self):
            return None

    class ConnectionStub:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def cursor(self):
            return CursorStub()

    monkeypatch.setattr(auth, "get_db_connection", ConnectionStub)
    monkeypatch.setattr(auth, "has_any_assigned_sede_session", lambda email: False)

    assert auth._profiles_for_user("nuovo@cnr.it", set()) == ["segretario", "referente"]
    assert auth._profiles_for_user("admin@cnr.it", {auth.ROLE_ADMIN}) == ["admin"]


def _test_access_client(monkeypatch, enabled=True, roles=None):
    from routes.api_v1 import auth

    monkeypatch.setattr(auth, "get_user_roles", lambda email: roles if roles is not None else {auth.ROLE_ADMIN})
    app = create_test_app()
    app.config["API_TEST_ACCESS"] = enabled
    client = app.test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "admin@cnr.it"
    return client


def test_test_access_is_available_only_to_admins_when_enabled(monkeypatch):
    response = _test_access_client(monkeypatch).get("/api/v1/me/test-access")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["cookie_name"] == "session"
    assert payload["cookie_value"]
    assert payload["csrf_header"] == "X-CSRF-Token"
    assert payload["base_url"].endswith("/api/v1")
    assert response.headers["Cache-Control"] == "no-store"

    assert _test_access_client(monkeypatch, enabled=False).get("/api/v1/me/test-access").status_code == 404
    assert _test_access_client(monkeypatch, roles=set()).get("/api/v1/me/test-access").status_code == 404
