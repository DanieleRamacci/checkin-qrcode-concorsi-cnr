from flask import Flask, redirect, request
import requests
import base64

app = Flask(__name__)

# Configurazione
client_id = 'selezioni'
client_secret = '17812d1a-6bdc-412f-acf8-ba0d9aa130de'
redirect_uri = 'http://localhost:8000/callback'
auth_url = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/auth'
token_url = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/token'
userinfo_url = 'https://traefik.test.si.cnr.it/auth/realms/cnr/protocol/openid-connect/userinfo'


@app.route('/')
def home():
    return redirect(f"{auth_url}?client_id={client_id}&response_type=code&redirect_uri={redirect_uri}&scope=openid email profile")


@app.route('/callback')
def callback():
    code = request.args.get('code')

    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirect_uri,
        'client_id': client_id,
        'client_secret': client_secret
    }

    token_response = requests.post(token_url, data=data)
    tokens = token_response.json()

    access_token = tokens.get('access_token')
    id_token = tokens.get('id_token')

    # Recupera informazioni utente
    headers = {'Authorization': f'Bearer {access_token}'}
    userinfo_response = requests.get(userinfo_url, headers=headers)

    return f"""
    <h2>Accesso riuscito</h2>
    <p><strong>Token:</strong> {access_token}</p>
    <p><strong>Userinfo:</strong> {userinfo_response.json()}</p>
    """

if __name__ == '__main__':
    app.run(port=8000)
