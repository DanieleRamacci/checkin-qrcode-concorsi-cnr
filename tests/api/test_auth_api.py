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

    monkeypatch.setattr(
        auth,
        "get_user_roles",
        lambda email: {"esperto_informatico"},
    )
    app = create_test_app()
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
    assert "expert_workflow" in payload["capabilities"]
    assert payload["csrf_token"]


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
