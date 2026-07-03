from urllib.parse import parse_qs, urlparse

from flask import Flask

from routes.auth import auth_bp


def create_app():
    app = Flask(__name__)
    app.secret_key = "test-secret"
    app.register_blueprint(auth_bp)
    app.config.update(TESTING=True)
    return app


def test_login_uses_random_state_and_stores_safe_next():
    client = create_app().test_client()

    response = client.get("/login?next=/bandi")

    state = parse_qs(urlparse(response.location).query)["state"][0]
    assert state != "/bandi"
    with client.session_transaction() as flask_session:
        assert flask_session["oidc_state"] == state
        assert flask_session["oidc_next"] == "/bandi"


def test_login_rejects_external_next_url():
    client = create_app().test_client()
    client.get("/login?next=https://evil.example/phishing")

    with client.session_transaction() as flask_session:
        assert flask_session["oidc_next"] == "/"


def test_callback_rejects_invalid_state_before_token_exchange(monkeypatch):
    monkeypatch.setattr(
        "routes.auth.requests.post",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("token exchange must not run")
        ),
    )
    client = create_app().test_client()
    with client.session_transaction() as flask_session:
        flask_session["oidc_state"] = "expected"

    response = client.get("/oidc-callback?code=code&state=invalid")

    assert response.status_code == 400
