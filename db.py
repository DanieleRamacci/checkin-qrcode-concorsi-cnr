import os
import psycopg2

DB_CONFIG = {
    'host': os.environ.get('POSTGRES_HOST', 'db'),
    'port': os.environ.get('POSTGRES_PORT', '5432'),
    'dbname': os.environ.get('POSTGRES_DB', 'checkin'),
    'user': os.environ.get('POSTGRES_USER', 'postgres'),
    'password': os.environ.get('POSTGRES_PASSWORD', '')
}

def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)
