#!/usr/bin/env python3
"""Reset controlled contest data for manual test/collaudo environments.

The script intentionally preserves global users/roles and app settings. It is
meant to be run inside the backend container, where the usual POSTGRES_* env
vars are already available.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import DB_CONFIG, get_db_connection  # noqa: E402


DEFAULT_TABLES = (
    "session_notifications",
    "session_state_log",
    "candidati",
    "liste_generate",
    "dispositivi",
    "sessione_config",
    "sessioni",
    "bando_referenti",
    "bando_config",
    "commissions",
)

PROVE_TABLES = (
    "prove_emails_log",
    "prove_support_staff",
    "prove_external_tokens",
    "prove_state_log",
    "prove_documents",
    "prove",
)

CONFIRM_TOKEN = "RESET_TEST_CONCORSI"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Svuota i dati operativi concorsi/sessioni/candidati/configurazioni "
            "per ripartire da uno stato pulito di collaudo."
        )
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Esegue davvero il reset. Senza questo flag fa solo dry-run.",
    )
    parser.add_argument(
        "--confirm",
        default="",
        help=f"Conferma obbligatoria per eseguire: {CONFIRM_TOKEN}",
    )
    parser.add_argument(
        "--allow-non-test",
        action="store_true",
        help=(
            "Consente l'esecuzione anche se le variabili ambiente non indicano "
            "chiaramente un ambiente test. Usarlo solo sul servizio test."
        ),
    )
    parser.add_argument(
        "--include-prove",
        action="store_true",
        help="Svuota anche il modulo prove. Default: preservato.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Non crea il backup JSON prima della cancellazione.",
    )
    parser.add_argument(
        "--backup-dir",
        default="/tmp/checkin-reset-backups",
        help="Directory dove scrivere il backup JSON. Default: /tmp/checkin-reset-backups",
    )
    return parser.parse_args()


def env_summary() -> dict[str, str]:
    keys = (
        "APP_ENV",
        "FLASK_ENV",
        "ENVIRONMENT",
        "COOLIFY_FQDN",
        "SERVICE_FQDN_FRONTEND",
        "POSTGRES_HOST",
        "POSTGRES_DB",
        "POSTGRES_USER",
    )
    values = {key: os.environ.get(key, "") for key in keys}
    values.update(
        {
            "db_host": DB_CONFIG.get("host", ""),
            "db_name": DB_CONFIG.get("dbname", ""),
            "db_user": DB_CONFIG.get("user", ""),
        }
    )
    return values


def looks_like_test_environment(values: dict[str, str]) -> bool:
    joined = " ".join(str(value).lower() for value in values.values())
    production_markers = ("produzione", "production", "checkin.concorsi.cnr.it")
    if any(marker in joined for marker in production_markers):
        return False
    return "test" in joined or "collaudo" in joined


def table_exists(cursor, table: str) -> bool:
    cursor.execute("SELECT to_regclass(%s)", (f"public.{table}",))
    return cursor.fetchone()[0] is not None


def existing_tables(cursor, tables: Iterable[str]) -> list[str]:
    return [table for table in tables if table_exists(cursor, table)]


def table_counts(cursor, tables: Iterable[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for table in tables:
        cursor.execute(f'SELECT COUNT(*) FROM "{table}"')
        counts[table] = int(cursor.fetchone()[0])
    return counts


def write_backup(conn, tables: Iterable[str], backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = backup_dir / f"reset_concorsi_backup_{timestamp}.json"
    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "db": {
            "host": DB_CONFIG.get("host"),
            "port": DB_CONFIG.get("port"),
            "dbname": DB_CONFIG.get("dbname"),
            "user": DB_CONFIG.get("user"),
        },
        "tables": {},
    }
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        for table in tables:
            cursor.execute(f'SELECT * FROM "{table}"')
            payload["tables"][table] = [dict(row) for row in cursor.fetchall()]
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    return path


def delete_tables(conn, tables: Iterable[str]) -> dict[str, int]:
    deleted: dict[str, int] = {}
    with conn.cursor() as cursor:
        for table in tables:
            cursor.execute(f'DELETE FROM "{table}"')
            deleted[table] = int(cursor.rowcount if cursor.rowcount is not None else 0)
    return deleted


def print_counts(title: str, counts: dict[str, int]) -> None:
    print(title)
    for table, count in counts.items():
        print(f"  - {table}: {count}")


def main() -> int:
    args = parse_args()
    tables = list(DEFAULT_TABLES)
    if args.include_prove:
        tables = list(PROVE_TABLES) + tables

    values = env_summary()
    print("Ambiente rilevato:")
    for key, value in values.items():
        if value:
            print(f"  - {key}: {value}")

    if args.execute:
        if args.confirm != CONFIRM_TOKEN:
            print(
                f"\nERRORE: per eseguire serve --confirm {CONFIRM_TOKEN}",
                file=sys.stderr,
            )
            return 2
        if not args.allow_non_test and not looks_like_test_environment(values):
            print(
                "\nERRORE: l'ambiente non sembra chiaramente di test. "
                "Se sei certo di essere sul servizio test, rilancia con "
                "--allow-non-test.",
                file=sys.stderr,
            )
            return 2

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            available_tables = existing_tables(cursor, tables)
            missing = [table for table in tables if table not in available_tables]
            before = table_counts(cursor, available_tables)

        if missing:
            print("\nTabelle non presenti, ignorate:")
            for table in missing:
                print(f"  - {table}")

        print_counts("\nRighe attuali:", before)

        if not args.execute:
            print(
                "\nDRY-RUN: nessun dato cancellato. Per eseguire davvero:\n"
                f"  python scripts/reset_test_concorsi.py --execute --confirm {CONFIRM_TOKEN}"
            )
            return 0

        backup_path = None
        if not args.no_backup:
            backup_path = write_backup(conn, available_tables, Path(args.backup_dir))
            print(f"\nBackup JSON creato: {backup_path}")

        deleted = delete_tables(conn, available_tables)
        conn.commit()

        print_counts("\nRighe cancellate:", deleted)
        if backup_path:
            print(f"\nBackup disponibile in: {backup_path}")
        print("\nReset completato.")
        print("Preservati: user_roles, app_settings, prove_global_templates, system_error_log.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
