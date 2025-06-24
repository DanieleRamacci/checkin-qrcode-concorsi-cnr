FROM python:3.11-slim

# Install curl e unzip per scaricare ngrok
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

# Crea directory app
WORKDIR /app

# Copia i file del progetto
COPY . /app

# Installa dipendenze Python
RUN pip install --no-cache-dir -r requirements.txt

# Scarica e installa ngrok
RUN curl -s https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-amd64.zip -o ngrok.zip \
    && unzip ngrok.zip -d /usr/local/bin \
    && rm ngrok.zip

# Espone la porta di Flask
EXPOSE 5050

# Variabile di ambiente per Flask
ENV FLASK_APP=server.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5050


# Entrypoint che avvia Flask + Ngrok
CMD bash -c "\
    flask run & \
    sleep 2 && \
    ngrok http 5050 > /dev/null & \
    echo '⏳ Attendo URL pubblico Ngrok...' && \
    until curl -s localhost:4040/api/tunnels | grep -q 'https://'; do sleep 1; done && \
    echo '🔗 URL pubblico Ngrok:' && \
    curl -s localhost:4040/api/tunnels | grep -o 'https://[a-zA-Z0-9.-]*.ngrok.io' | head -n 1 && \
    tail -f /dev/null"


