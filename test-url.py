import requests

# URL del tuo server Flask (modifica con il tuo URL ngrok o locale)
BASE_URL = "https://747805b8928a.ngrok-free.app/"  # oppure https://xxxxx.ngrok.io se usi ngrok

endpoint = "/verifica-candidato"
url = BASE_URL + endpoint

# UID e session_id del candidato da testare
payload = {
    "uid": "eaec8a7c-65d1-433c-8f57-54159329cbc",
    "session_id": "sessione123"
}

headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status code: {response.status_code}")
    print("Risposta JSON:")
    print(response.json())
except Exception as e:
    print("Errore nella richiesta:", str(e))
