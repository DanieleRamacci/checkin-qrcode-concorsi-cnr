# Usa una immagine base leggera con Python
FROM python:3.11-slim

# Crea una cartella per l'app
WORKDIR /app

# Copia i file requirements e installa le dipendenze
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Copia il resto dei file dell'app
COPY . .

# Imposta variabili d'ambiente
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production

# Espone la porta
EXPOSE 5050

