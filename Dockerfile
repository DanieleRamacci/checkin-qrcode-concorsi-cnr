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

# Comando di avvio
CMD sh -c "\
  echo 'Attendo che PostgreSQL sia pronto...' && \
  until pg_isready -h db -U \"$POSTGRES_USER\"; do sleep 2; done && \
  echo 'PostgreSQL è pronto. Inizializzo il DB...' && \
  python init_db.py && \
  echo 'Avvio Gunicorn in produzione...' && \
  gunicorn -b 0.0.0.0:5050 server_pg:app"