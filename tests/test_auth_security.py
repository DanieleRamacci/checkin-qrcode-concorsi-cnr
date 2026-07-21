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


def test_logout_redirects_to_public_logged_out_page_with_forwarded_proto(monkeypatch):
    monkeypatch.setattr(
        "routes.auth.OIDC_AUTH_URL",
        "https://idp.example.test/auth/realms/cnr/protocol/openid-connect/auth",
    )
    client = create_app().test_client()
    with client.session_transaction() as flask_session:
        flask_session["user_email"] = "user@cnr.it"
        flask_session["access_token"] = "access"
        flask_session["id_token"] = "id-token"

    response = client.get(
        "/logout",
        headers={
            "X-Forwarded-Host": "test-checkin.concorsi.cnr.it",
            "X-Forwarded-Proto": "https",
        },
    )

    assert response.status_code == 302
    parsed = urlparse(response.location)
    params = parse_qs(parsed.query)
    assert parsed.geturl().startswith(
        "https://idp.example.test/auth/realms/cnr/protocol/openid-connect/logout?"
    )
    assert params["post_logout_redirect_uri"] == [
        "https://test-checkin.concorsi.cnr.it/logged-out"
    ]
    assert params.get("id_token_hint") == ["id-token"] or params["client_id"] == [
        "selezioni"
    ]
    with client.session_transaction() as flask_session:
        assert "user_email" not in flask_session
        assert "access_token" not in flask_session
