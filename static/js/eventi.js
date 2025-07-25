document.addEventListener("DOMContentLoaded", function () {
  const sessionId = "{{ sessione.session_id }}";  // Passato dal backend con Jinja
  const key = "dispositivo_connesso_" + sessionId;

  if (sessionStorage.getItem(key) === "true") {
    console.log("🔄 Aggiorno azioni per sessione", sessionId);
    document.body.dispatchEvent(new Event("azioniAggiornate"));
    sessionStorage.removeItem(key); // Rimuoviamo il flag, è una tantum
  }
});
