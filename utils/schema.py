from db import get_db_connection


BANDO_CONFIG_COLUMNS = (
    ("email_referente", "TEXT"),
    ("email_esperto_remoto", "TEXT"),
    ("email_segretario", "TEXT"),
    ("telefono_segretario", "TEXT"),
    ("durata_prova_minuti", "INTEGER"),
    ("data_accesso_piattaforma", "TEXT"),
    ("commissione_members", "TEXT"),
    ("rdp_members", "TEXT"),
    ("rdp_nomi", "TEXT"),
    ("commissione_nomi", "TEXT"),
    ("config_status", "TEXT"),
    ("expert_assigned", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("required_data_complete", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("fetched_at", "TIMESTAMP"),
    ("configured_at", "TIMESTAMP"),
    ("configured_by", "TEXT"),
)

SESSIONE_CONFIG_COLUMNS = (
    ("nome_informatico_sede", "TEXT"),
    ("email_informatico_sede", "TEXT"),
    ("telefono_informatico_sede", "TEXT"),
    ("data_accesso_piattaforma", "TEXT"),
)

SESSIONI_COLUMNS = (
    ("data_esame", "TEXT"),
    ("stato_corrente", "TEXT DEFAULT 'iniziale'"),
)

CANDIDATI_COLUMNS = (
    ("documento_scaduto", "BOOLEAN DEFAULT FALSE"),
    ("reset_password_richiesto", "BOOLEAN DEFAULT FALSE"),
    ("reset_password_richiesto_at", "TIMESTAMP"),
    ("reset_password_richiesto_by", "TEXT"),
    ("reset_password_effettuato", "BOOLEAN DEFAULT FALSE"),
    ("reset_password_effettuato_at", "TIMESTAMP"),
    ("reset_password_effettuato_by", "TEXT"),
)


def ensure_runtime_schema() -> None:
    """Apply additive schema updates required by the running application."""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            for column, data_type in BANDO_CONFIG_COLUMNS:
                cursor.execute(
                    f"ALTER TABLE bando_config ADD COLUMN IF NOT EXISTS {column} {data_type};"
                )
            cursor.execute(
                "UPDATE bando_config SET commissione_members = '[]' WHERE commissione_members IS NULL;"
            )
            cursor.execute(
                "UPDATE bando_config SET rdp_members = '[]' WHERE rdp_members IS NULL;"
            )
            cursor.execute(
                "UPDATE bando_config SET rdp_nomi = '[]' WHERE rdp_nomi IS NULL;"
            )
            cursor.execute(
                "UPDATE bando_config SET commissione_nomi = '[]' WHERE commissione_nomi IS NULL;"
            )
            cursor.execute(
                "UPDATE bando_config SET config_status = 'da_configurare' WHERE config_status IS NULL;"
            )
            cursor.execute(
                "UPDATE bando_config SET expert_assigned = FALSE WHERE expert_assigned IS NULL;"
            )
            cursor.execute(
                "UPDATE bando_config SET required_data_complete = FALSE WHERE required_data_complete IS NULL;"
            )

            for column, data_type in SESSIONE_CONFIG_COLUMNS:
                cursor.execute(
                    f"ALTER TABLE sessione_config ADD COLUMN IF NOT EXISTS {column} {data_type};"
                )
            for column, data_type in SESSIONI_COLUMNS:
                cursor.execute(
                    f"ALTER TABLE sessioni ADD COLUMN IF NOT EXISTS {column} {data_type};"
                )
            cursor.execute(
                "UPDATE sessioni SET stato_corrente = 'iniziale' WHERE stato_corrente IS NULL;"
            )
            for column, data_type in CANDIDATI_COLUMNS:
                cursor.execute(
                    f"ALTER TABLE candidati ADD COLUMN IF NOT EXISTS {column} {data_type};"
                )
        conn.commit()
