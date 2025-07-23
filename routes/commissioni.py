from flask import Blueprint, Flask, request, abort, jsonify, send_from_directory, session, redirect, url_for, render_template
import requests
import os
from datetime import datetime
from db import get_db_connection  # se hai una funzione centralizzata
from routes.auth import login_required  # è un decoratore deve essere importato 

commissioni_bp = Blueprint('commissioni', __name__)
BASE_URL = os.environ.get('BASE_URL', 'https://cool-jconon.test.si.cnr.it')


@commissioni_bp.route('/sync-commissioni')
@login_required
def sync_commissioni():
    access_token = session.get('access_token')
    user_email = session.get('user_email')

    if not access_token or not user_email:
        return jsonify({"success": False, "message": "Autenticazione mancante"}), 401

    try:
        # 1. Chiamata API remota
        api_url = f"{BASE_URL}/openapi/v1/call/commissions"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }
        response = requests.get(api_url, headers=headers)
        response.raise_for_status()
        remote_commissions = response.json()

        remote_ids = {c['id'] for c in remote_commissions}

        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 2. Recupera commissioni locali per l'utente
                cursor.execute("""
                    SELECT commission_id FROM commissions
                    WHERE user_email = %s
                """, (user_email,))
                local_ids = {row[0] for row in cursor.fetchall()}

                # 3. INSERT nuove commissioni
                nuovi = remote_ids - local_ids
                for c in remote_commissions:
                    if c['id'] in nuovi:
                        cursor.execute("""
                            INSERT INTO commissions (commission_id, titolo, user_email, data_sync)
                            VALUES (%s, %s, %s, %s)
                        """, (c['id'], c['title'], user_email, datetime.now().isoformat()))

                # 4. DELETE commissioni non più autorizzate
                da_eliminare = local_ids - remote_ids
                for cid in da_eliminare:
                    cursor.execute("""
                        DELETE FROM commissions
                        WHERE commission_id = %s AND user_email = %s
                    """, (cid, user_email))

                # 5. Recupera la lista aggiornata
                cursor.execute("""
                    SELECT commission_id, titolo FROM commissions
                    WHERE user_email = %s
                    ORDER BY titolo
                """, (user_email,))
                risultati = [{"id": r[0], "title": r[1]} for r in cursor.fetchall()]

        return jsonify({
            "success": True,
            "commissioni": risultati
        })

    except requests.exceptions.HTTPError as http_err:
        return jsonify({
            "success": False,
            "error": "Errore HTTP",
            "status_code": response.status_code,
            "body": response.text
        }), response.status_code

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


