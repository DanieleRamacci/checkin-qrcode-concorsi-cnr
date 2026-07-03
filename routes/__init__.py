from .auth import auth_bp, login_required
from .dashboard import dashboard_bp
from .sessioni import sessioni_bp
from .gestioneConcorso import gestione_concorso_bp
from .commissioni import commissioni_bp
from .candidati import candidati_bp
from .dispositivi import dispositivi_bp
from .user import user_bp
from .scanner import scanner_bp
from .azioni import azioni_bp
from .admin_permessi import admin_permessi_bp
from .notifiche import notifiche_bp
from .api_v1 import api_v1_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(sessioni_bp)
    app.register_blueprint(gestione_concorso_bp)
    app.register_blueprint(commissioni_bp)
    app.register_blueprint(candidati_bp)
    app.register_blueprint(dispositivi_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(scanner_bp)
    app.register_blueprint(azioni_bp)
    app.register_blueprint(admin_permessi_bp)
    app.register_blueprint(notifiche_bp)
    app.register_blueprint(api_v1_bp)

