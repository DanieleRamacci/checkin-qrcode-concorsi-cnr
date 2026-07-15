from pathlib import Path

from flask import Flask, render_template, session


def create_template_app(is_admin=False, dev_mode=False):
    template_dir = Path(__file__).resolve().parents[1] / "templates"
    app = Flask(__name__, template_folder=str(template_dir))
    app.secret_key = "test-secret"
    app.jinja_env.globals.update(
        ROLE_ADMIN="admin_globale",
        dev_mode=dev_mode,
        has_role=lambda _email, role: is_admin and role == "admin_globale",
        get_bando_config=lambda _commission_id: None,
    )
    return app


def test_sessioni_fragment_hides_configure_bando_for_secretary():
    app = create_template_app(is_admin=False)

    with app.test_request_context("/"):
        session["user_email"] = "segretario@cnr.it"
        html = render_template(
            "frammenti/sessioni_tabella.html",
            sessioni=[],
            commission_id="commission-1",
            bando_config=None,
            messaggio=None,
            gestione_base="/gestione-concorso",
        )

    assert "Bando non configurato" in html
    assert "Configura Bando" not in html
    assert "/bando/commission-1/configura" not in html


def test_actions_fragment_hides_configure_bando_card_for_secretary():
    app = create_template_app(is_admin=False)

    with app.test_request_context("/"):
        session["user_email"] = "segretario@cnr.it"
        html = render_template(
            "frammenti/azioni.html",
            sessione={"session_id": "session-1", "commission_id": "commission-1"},
            stato_corrente="iniziale",
        )

    assert "Bando non configurato" in html
    assert "Configura il Bando" not in html
    assert "/bando/commission-1/configura" not in html


def test_sessioni_fragment_keeps_configure_bando_for_admin():
    app = create_template_app(is_admin=True)

    with app.test_request_context("/"):
        session["user_email"] = "admin@cnr.it"
        html = render_template(
            "frammenti/sessioni_tabella.html",
            sessioni=[],
            commission_id="commission-1",
            bando_config=None,
            messaggio=None,
            gestione_base="/gestione-concorso",
        )

    assert "Configura Bando" in html
    assert "/bando/commission-1/configura" in html
