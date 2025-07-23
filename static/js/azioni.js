document.addEventListener("DOMContentLoaded", () => {
  const wrapper = document.getElementById("azioni-wrapper");

  function aggiornaAzioni() {
    const contenitore = wrapper.querySelector("#contenitore-azioni");
    if (!contenitore) return console.warn("contenitore-azioni non trovato");
    const sessionId = contenitore.dataset.sessionId;

    fetch(`/sessione/${sessionId}/azioni-frammento`)
      .then(res => res.text())
      .then(html => {
  wrapper.innerHTML = html;
  console.log("Azioni aggiornate");

  // 1. Verifica se lo stato è "candidati_scaricati"
  const contenitore = wrapper.querySelector("#contenitore-azioni");
  const statoCorrente = contenitore?.dataset.statoCorrente;
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

  // 2. Collega eventi ai bottoni di download
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
          aggiornaAzioni(); // ricarica dopo azione
        })
        .catch(err => alert("Errore di rete"));
    });
  });
});


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
        if (data.success) aggiornaAzioni(); // solo se ha aggiornato lo stato
      })
      .catch(err => alert("Errore di rete"));
  });
});

  }

  aggiornaAzioni(); // Al caricamento

  // Può essere richiamato anche da altri script
  window.aggiornaAzioni = aggiornaAzioni;
});
