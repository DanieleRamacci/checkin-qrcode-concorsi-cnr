from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os
from datetime import datetime

app = Flask(__name__, static_folder='static')
DB_PATH = 'checkin.db'

# Home e scanner
@app.route('/')
def index():
    return send_from_directory('static', 'dashboard.html')

@app.route('/qr-test')
def qr_test():
    return send_from_directory('static', 'qr-test.html')

@app.route('/scanner')
def scanner():
    return send_from_directory('static', 'scanner.html')

# Check-in candidato
@app.route('/checkin', methods=['POST'])
def checkin():
    try:
        data = request.json
        session_id = data.get('session_id')
        candidate_id = data.get('id')

        if not session_id or not candidate_id:
            return jsonify(success=False, message="Dati mancanti"), 400

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()

            # Verifica se il candidato esiste e appartiene alla sessione
            cursor.execute("""
                SELECT checkin_effettuato FROM candidati 
                WHERE id = ? AND session_id = ?
            """, (candidate_id, session_id))
            result = cursor.fetchone()

            if not result:
                return jsonify(success=False, message="Candidato non trovato nella sessione attiva."), 404

            if result[0] == 1:
                return jsonify(success=False, message="Il candidato ha già effettuato il check-in."), 409

            # Aggiorna lo stato del check-in
            cursor.execute("""
                UPDATE candidati SET checkin_effettuato = 1 
                WHERE id = ? AND session_id = ?
            """, (candidate_id, session_id))

        return jsonify(success=True)

    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


# Caricamento nuova sessione e candidati
@app.route('/upload-session', methods=['POST'])
def upload_session():
    try:
        data = request.json
        session_id = data.get('session_id')
        nome = data.get('nome')
        candidati = data.get('candidati')

        if not session_id or not nome or not candidati:
            return jsonify(success=False, message="Dati incompleti"), 400

        now = datetime.now().strftime('%Y-%m-%d %H:%M')
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO sessioni (session_id, nome, creata_il) VALUES (?, ?, ?)", (session_id, nome, now))
            for c in candidati:
                cursor.execute("""
                    INSERT INTO candidati (id, session_id, nome, cognome, numero_documento, checkin_effettuato)
                    VALUES (?, ?, ?, ?, ?, 0)
                """, (c['id'], session_id, c['nome'], c['cognome'], c['numero_documento']))

        return jsonify(success=True)
    except sqlite3.IntegrityError:
        return jsonify(success=False, message="Sessione o candidati già presenti"), 409
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

# Lista sessioni
@app.route('/lista-sessioni', methods=['GET'])
def lista_sessioni():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT session_id, nome, creata_il FROM sessioni")
            rows = cursor.fetchall()
            result = [
                {"session_id": r[0], "nome_sessione": r[1], "data_creazione": r[2]}
                for r in rows
            ]
        return jsonify(result)
    except Exception as e:
        return jsonify([])

# Dettagli sessione
@app.route('/sessione/<session_id>', methods=['GET'])
def get_session(session_id):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT nome, creata_il FROM sessioni WHERE session_id = ?", (session_id,))
            session = cursor.fetchone()
            if not session:
                return jsonify(success=False, message="Sessione non trovata."), 404

            cursor.execute("""
                SELECT id, nome, cognome, numero_documento, checkin_effettuato 
                FROM candidati WHERE session_id = ?
            """, (session_id,))
            candidati = cursor.fetchall()
            lista_candidati = [
                {
                    "id": c[0],
                    "nome": c[1],
                    "cognome": c[2],
                    "numero_documento": c[3],
                    "checkin_effettuato": bool(c[4])
                } for c in candidati
            ]

        return jsonify(success=True, session={
            "session_id": session_id,
            "nome_sessione": session[0],
            "data_creazione": session[1],
            "candidates": lista_candidati
        })
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)
