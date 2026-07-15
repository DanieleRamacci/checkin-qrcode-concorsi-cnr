from flask import Flask

from routes.auth import _safe_next_url, auth_bp
from routes.dashboard import dashboard_bp
from routes.dispositivi import dispositivi_bp
from routes.gestioneConcorso import gestione_concorso_bp
from routes.scanner import scanner_bp


def create_app():
    app = Flask(__name__)
    app.secret_key = "test-secret"
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(gestione_concorso_bp)
    app.register_blueprint(dispositivi_bp)
    app.register_blueprint(scanner_bp)
    app.config.update(TESTING=True)
    return app


def authenticated_client():
    client = create_app().test_client()
    with client.session_transaction() as flask_session:
        flask_session["access_token"] = "token"
        flask_session["user_email"] = "utente@cnr.it"
    return client


def test_login_next_normalizes_legacy_routes_to_angular_routes():
    assert _safe_next_url("/dashboard/segretario") == "/bandi"
    assert (
        _safe_next_url("/sessioni?commission_id=c1&mode=esperto")
        == "/bandi/c1/sessioni?mode=esperto"
    )
    assert _safe_next_url("/gestione-concorso/s1") == "/sessioni/s1"
    assert _safe_next_url("/dispositivi/s1") == "/sessioni/s1/dispositivi"
    assert (
        _safe_next_url("/device-link?session_id=s1&token=abc")
        == "/scanner?sessionId=s1&token=abc"
    )
    assert _safe_next_url("/bando/c1/configura") == "/bandi/c1/config"
    assert _safe_next_url("/bando/c1/dettaglio") == "/bandi/c1/detail"


def test_legacy_html_entrypoints_redirect_to_angular_routes():
    client = authenticated_client()

    assert client.get("/dashboard/segretario").location == "/bandi"
    assert (
        client.get("/sessioni?commission_id=c1&mode=segretario").location
        == "/bandi/c1/sessioni?mode=segretario"
    )
    assert client.get("/gestione-concorso/s1").location == "/sessioni/s1"
    assert client.get("/dispositivi/s1").location == "/sessioni/s1/dispositivi"
    assert (
        client.get("/device-link?session_id=s1&token=abc").location
        == "/scanner?sessionId=s1&token=abc"
    )


def test_unauthenticated_legacy_entrypoint_keeps_local_next_for_normalization():
    client = create_app().test_client()

    response = client.get("/gestione-concorso/s1")

    assert response.status_code == 302
    assert response.location == "/login?next=/gestione-concorso/s1"


def test_nginx_cutover_routes_are_not_proxied_to_legacy_backend():
    conf = open("frontend/nginx.conf").read()
    proxy_location = next(
        line for line in conf.splitlines()
        if line.strip().startswith("location ~ ^/(api|")
    )

    for legacy_prefix in (
        "dashboard",
        "sessione",
        "gestione-concorso",
        "admin",
        "static",
        "frammenti",
        "dispositivi",
        "device-link",
    ):
        assert legacy_prefix not in proxy_location
