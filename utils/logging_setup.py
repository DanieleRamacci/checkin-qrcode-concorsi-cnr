# logging_setup.py
import os, sys, json, logging
from datetime import datetime
from logging.handlers import RotatingFileHandler

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)

class _StreamToLogger:
    """Redirige qualsiasi write() su un logger (cattura anche print non monkeypatchati)."""
    def __init__(self, logger_name, level=logging.INFO):
        self.logger = logging.getLogger(logger_name)
        self.level = level
        self._buffer = ""

    def write(self, buf):
        # spezza su newline per evitare log lunghissimi
        for line in buf.splitlines():
            line = line.rstrip()
            if line:
                self.logger.log(self.level, line)

    def flush(self):  # richiesto da alcune runtime
        pass

def setup_logging(app):
    log_level = (app.config.get("LOG_LEVEL") or "DEBUG").upper()

    # File instance/logs/app.jsonl
    log_dir = os.path.join(app.instance_path, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "app.jsonl")
    app.config["APP_LOG_FILE"] = log_file

    # Root logger pulito
    root = logging.getLogger()
    root.setLevel(log_level)
    for h in list(root.handlers):
        root.removeHandler(h)

    fmt = JsonFormatter()

    # 1) Console (stdout)
    sh = logging.StreamHandler(sys.stdout)
    sh.setLevel(log_level)
    sh.setFormatter(fmt)
    root.addHandler(sh)

    # 2) File con rotazione
    fh = RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=5, encoding="utf-8")
    fh.setLevel(log_level)
    fh.setFormatter(fmt)
    root.addHandler(fh)

    # Integra logger Flask/werkzeug/urllib3
    logging.captureWarnings(True)
    logging.getLogger("werkzeug").setLevel(log_level)
    logging.getLogger("urllib3").setLevel(logging.DEBUG if log_level=="DEBUG" else logging.INFO)

    # 3) Redirigi stdout/stderr → logger (cattura print grezzi)
    sys.stdout = _StreamToLogger("stdout", logging.INFO)
    sys.stderr = _StreamToLogger("stderr", logging.ERROR)

    # 4) (Opzionale) Trasforma print() in logger dedicato
    import builtins
    _orig_print = builtins.print
    def _print(*args, **kwargs):
        logging.getLogger("app.print").info(" ".join(str(a) for a in args))
        # se vuoi anche mantenere l’output nella console Docker, togli il commento qui sotto:
        # _orig_print(*args, **kwargs)
    builtins.print = _print

    app.logger.debug("JSON logging + stdout/stderr redirect attivi")
