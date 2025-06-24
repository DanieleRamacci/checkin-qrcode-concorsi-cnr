from flask import Flask, request, jsonify, send_from_directory
import json
import os
from datetime import datetime

app = Flask(__name__, static_folder='static')
DATA_DIR = 'sessions'
os.makedirs(DATA_DIR, exist_ok=True)

@app.route('/')
def index():
    return send_from_directory('static', 'dashboard.html')

@app.route('/scanner')
def scanner():
    return send_from_directory('static', 'scanner.html')

@app.route('/checkin', methods=['POST'])
def checkin():
    try:
        data = request.json
        session_id = data.get('session_id')
        candidate_id = data.get('id')

        if not session_id or not candidate_id:
            return jsonify(success=False, message="session_id o ID candidato mancante."), 400

        file_path = os.path.join(DATA_DIR, f'{session_id}.json')
        if not os.path.exists(file_path):
            return jsonify(success=False, message="Sessione non trovata."), 404

        with open(file_path, 'r', encoding='utf-8') as f:
            session_data = json.load(f)

        found = False
        for candidate in session_data.get("candidati", []):
            if candidate.get("id") == candidate_id:
                candidate["checkin_effettuato"] = True
                found = True
                break

        if not found:
            return jsonify(success=False, message="Candidato non trovato."), 404

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, indent=2, ensure_ascii=False)

        return jsonify(success=True)

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

@app.route('/upload-session', methods=['POST'])
def upload_session():
    data = request.json
    session_id = data.get('session_id')
    nome = data.get('nome')  # es: "Esame CNR 367.434"
    candidati = data.get('candidati')

    if not session_id or not nome or not candidati:
        return jsonify(success=False, message="Dati mancanti."), 400

    session_data = {
        "session_id": session_id,
        "nome": nome,
        "creata_il": datetime.now().strftime('%Y-%m-%d %H:%M'),
        "candidati": candidati
    }

    file_path = os.path.join(DATA_DIR, f'{session_id}.json')
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(session_data, f, indent=2, ensure_ascii=False)

    return jsonify(success=True, message=f"Sessione {session_id} caricata.")

@app.route('/lista-sessioni', methods=['GET'])
def lista_sessioni():
    sessioni = []
    for filename in os.listdir(DATA_DIR):
        if filename.endswith('.json'):
            path = os.path.join(DATA_DIR, filename)
            with open(path, 'r', encoding='utf-8') as f:
                try:
                    data = json.load(f)
                    sessioni.append({
                        "session_id": data.get("session_id"),
                        "nome_sessione": data.get("nome", "Sessione senza nome"),
                        "data_creazione": data.get("creata_il", "Data sconosciuta")
                    })
                except Exception:
                    continue
    return jsonify(sessioni)

@app.route('/sessione/<session_id>', methods=['GET'])
def get_session(session_id):
    file_path = os.path.join(DATA_DIR, f"{session_id}.json")
    if not os.path.exists(file_path):
        return jsonify(success=False, message="Sessione non trovata."), 404

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Mappa i nomi dei campi come si aspettano nel frontend
    session_response = {
        "session_id": data.get("session_id"),
        "nome_sessione": data.get("nome"),
        "data_creazione": data.get("creata_il"),
        "candidates": data.get("candidati", [])
    }

    return jsonify(success=True, session=session_response)




if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)
