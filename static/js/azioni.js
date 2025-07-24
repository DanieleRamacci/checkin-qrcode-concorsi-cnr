document.addEventListener("DOMContentLoaded", () => {
  const wrapper = document.getElementById("azioni-wrapper");

  // Funzione principale per aggiornare il blocco azioni della sessione
  function aggiornaAzioni() {
    const contenitore = wrapper.querySelector("#contenitore-azioni");
    if (!contenitore) return console.warn("contenitore-azioni non trovato");

    const sessionId = contenitore.dataset.sessionId?.trim();

    // Fetch del frammento HTML aggiornato
    fetch(`/sessione/${sessionId}/azioni-frammento`)
      .then(res => res.text())
      .then(html => {
        wrapper.innerHTML = html;
        console.log("Azioni aggiornate");

        // 🔁 RICHIESTA SEPARATA per ottenere lo stato corrente dal server
        fetch(`/sessione/${sessionId}/stato_corrente`)
          .then(res => res.json())
          .then(data => {
            const statoCorrente = data.stato_corrente;
            console.log("Stato corrente dal server:", statoCorrente);

            // 1️⃣ Comportamento specifico per lo stato "candidati_scaricati"
            if (statoCorrente === "candidati_scaricati") {
              fetch(`/sessione/${sessionId}/verifica_dispositivi`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Requested-With": "XMLHttpRequest"
                }
              })
                .then(res => res.json())
                .then(data => {
                  if (data.success) {
                    console.log("Dispositivi trovati, aggiorno le azioni");
                    aggiornaAzioni(); // Stato aggiornato a "dispositivi_connessi"
                  } else {
                    alert("Nessun dispositivo connesso. Verrai reindirizzato per collegarne uno.");
                    window.location.href = `/dispositivi/${sessionId}`;
                  }
                });
            }

            // 🔁 QUI puoi aggiungere altri controlli in base a stati diversi:
            // if (statoCorrente === "dispositivi_connessi") { ... }
            // if (statoCorrente === "verifica_documenti") { ... }

          });

        // 2️⃣ Collega eventi ai bottoni di download candidati
        wrapper.querySelectorAll(".scarica-candidati").forEach(btn => {
          btn.addEventListener("click", () => {
            fetch(`/sessione/${sessionId}/scarica_candidati`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest"
              }
            })
              .then(res => res.json())
              .then(data => {
                alert(data.message);
                aggiornaAzioni(); // Ricarica dopo azione
              })
              .catch(err => alert("Errore di rete"));
          });
        });

        // 3️⃣ Collega eventi ai bottoni "verifica dispositivi" manuali
        wrapper.querySelectorAll(".verifica-dispositivi").forEach(btn => {
          btn.addEventListener("click", () => {
            fetch(`/sessione/${sessionId}/verifica_dispositivi`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest"
              }
            })
              .then(res => res.json())
              .then(data => {
                alert(data.message);
                if (data.success) aggiornaAzioni(); // Solo se stato aggiornato
              })
              .catch(err => alert("Errore di rete"));
          });
        });

        
        wrapper.querySelectorAll(".avvia-checkin").forEach(btn => {
          btn.addEventListener("click", () => {
            const sessionId = btn.dataset.sessionId;
            fetch(`/sessione/${sessionId}/avvia_checkin`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest"
              }
            })
            .then(res => res.json())
            .then(data => {
              alert(data.message);
              if (data.success) aggiornaAzioni();
            })
            .catch(err => alert("Errore di rete"));
          });
        });


          wrapper.querySelectorAll(".concludi-checkin").forEach(btn => {
            btn.addEventListener("click", () => {
              const sessionId = btn.dataset.sessionId;
              fetch(`/sessione/${sessionId}/concludi_checkin`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Requested-With": "XMLHttpRequest"
                }
              })
              .then(res => res.json())
              .then(data => {
                alert(data.message);
                if (data.success) aggiornaAzioni();
              })
              .catch(err => alert("Errore di rete"));
            });
          });



        // 🔁 QUI puoi aggiungere listener per altri bottoni futuri
        // wrapper.querySelectorAll(".verifica-documenti").forEach(btn => { ... });

      });
  }

  // Esegui all’avvio
  aggiornaAzioni();

  // Rendi richiamabile da altri moduli o script
  window.aggiornaAzioni = aggiornaAzioni;
});
