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
from .debug import debug_bp


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
    app.register_blueprint(debug_bp)





