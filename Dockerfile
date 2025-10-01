# Usa una immagine base leggera con Python
FROM python:3.11-slim

# Crea una cartella per l'app
WORKDIR /app

# Copia i file requirements e installa le dipendenze
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Installa postgresql-client per pg_isready
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*


# Copia il resto dei file dell'app
COPY . .

# Imposta variabili d'ambiente
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production

# Espone la porta
EXPOSE 5050

# Comando di avvio con Gunicorn parametrico
CMD sh -c "\
  echo 'Attendo che PostgreSQL sia pronto...' && \
  until pg_isready -h db -U \"$POSTGRES_USER\"; do sleep 2; done && \
  echo 'PostgreSQL è pronto. Inizializzo il DB...' && \
  python init_db.py && \
  echo 'Avvio Gunicorn in produzione...' && \
  gunicorn -b 0.0.0.0:5050 \
    --workers ${WEB_CONCURRENCY:-2} \
    --worker-class ${GUNICORN_WORKER_CLASS:-gthread} \
    --threads ${GUNICORN_THREADS:-4} \
    --timeout ${GUNICORN_TIMEOUT:-120} \
    --keep-alive ${GUNICORN_KEEPALIVE:-10} \
    --graceful-timeout ${GUNICORN_GRACEFUL_TIMEOUT:-120} \
    --max-requests ${GUNICORN_MAX_REQUESTS:-500} \
    --max-requests-jitter ${GUNICORN_MAX_REQUESTS_JITTER:-50} \
    ${GUNICORN_EXTRA:-} \
    server_pg:app"

