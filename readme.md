# Sistema di Check-in con QR Code

Questo progetto permette di effettuare il **check-in dei candidati a un concorso** scansionando un QR code con la webcam. Include:

-  Caricamento della sessione d'esame tramite QR master
-  Scansione dei candidati per il check-in
-  Dashboard per visualizzare le sessioni
-  Controlli di sicurezza (sessione attiva, doppia scansione)
-  Supporto per **telecamera da browser** via HTTPS usando **ngrok**

---

## ⚙️ Requisiti

- Python 3.10+
- [ngrok](https://ngrok.com/download)
- Git (opzionale)

---

## 🧪 1. Installazione in locale (con virtualenv)

Apri il terminale nella cartella del progetto (o clonala con `git clone`) e poi:

```bash
# Crea e attiva un virtual environment
python3 -m venv venv
source venv/bin/activate  # Su Windows: venv\Scripts\activate

# Installa le dipendenze
pip install -r requirements.txt
🚀 2. Avvio del server Flask
L'app Flask è contenuta in server.py. Per avviarla:


# Attiva sempre l'ambiente virtuale prima
source venv/bin/activate

# Avvia il server
python server.py
impostata per oartire sulla 5050

3. Uso di Ngrok per HTTPS (obbligatorio per la webcam)
Per far funzionare la webcam con html5-qrcode, il sito deve essere in HTTPS. Per farlo, usa ngrok:

 Installazione (se non già fatto):

# Su Linux/macOS
brew install ngrok  # oppure usa il binario da https://ngrok.com/download

# Su Windows: scarica e installa da https://ngrok.com/download
Autenticazione (solo la prima volta):
Registrati su ngrok.com, accedi al tuo account, e prendi il tuo authtoken, poi esegui:


ngrok config add-authtoken TUO_AUTHTOKEN
🌐 Avvia ngrok:
Con il server Flask in esecuzione:


ngrok http 5050
Ngrok ti fornirà un link del tipo:


https://abcd-1234.ngrok.io
📲 4. Accesso alle interfacce
Usa il link ngrok come base per accedere alle interfacce:

Scanner Check-in (mobile):
👉 https://TUO-LINK.ngrok.io/scanner.html

Test QR (per generare e provare QR):
👉 https://TUO-LINK.ngrok.io/qr-test.html

Dashboard Sessioni (root):
👉 https://TUO-LINK.ngrok.io/

📌 Note importanti
La webcam funziona solo in HTTPS: assicurati di usare sempre il link https://...ngrok.io

Se chiudi ngrok o riavvii il server, il link cambia: ricalcola e ricarica la sessione master

Il localStorage del browser mantiene in memoria la sessione attiva. Se la sessione non è più valida, viene chiesto di scansionare nuovamente il QR master.

