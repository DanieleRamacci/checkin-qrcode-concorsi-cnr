// Comportamenti dimostrativi del prototipo (in Angular diventano stato del componente).
(function () {
  function animateProgress(box, ms, done) {
    var bar = box.querySelector('.progress-bar');
    box.classList.remove('d-none');
    var start = Date.now();
    var t = setInterval(function () {
      var p = Math.min(100, Math.round((Date.now() - start) / ms * 100));
      bar.style.width = p + '%';
      bar.setAttribute('aria-valuenow', p);
      if (p >= 100) { clearInterval(t); done(); }
    }, 80);
  }

  // Operazione lunga prima di navigare (Salva e scarica candidati)
  document.querySelectorAll('[data-demo-longop]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var box = document.getElementById(a.getAttribute('data-demo-longop'));
      a.classList.add('disabled'); a.setAttribute('aria-disabled', 'true');
      animateProgress(box, 2200, function () { window.location.href = a.getAttribute('href'); });
    });
  });

  // Aggiorna da Selezioni Online, non bloccante
  document.querySelectorAll('[data-demo-sync]').forEach(function (b) {
    b.addEventListener('click', function () {
      var s = document.getElementById('sync-status');
      s.classList.remove('d-none');
      setTimeout(function () { s.classList.add('d-none'); }, 2500);
    });
  });

  // Copia link
  document.querySelectorAll('[data-demo-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var label = b.lastChild;
      var url = 'https://test-checkin.concorsi.cnr.it/scanner?sessionId=[id]&token=[token]';
      var ok = function () { label.textContent = ' Link copiato'; setTimeout(function () { label.textContent = ' Copia link di collegamento'; }, 2000); };
      try { navigator.clipboard.writeText(url).then(ok, ok); } catch (e) { ok(); }
    });
  });

  // Configura bando: barra di salvataggio
  var bar = document.getElementById('savebar');
  if (bar) {
    var n = 0, txt = document.getElementById('savebar-text');
    var upd = function () {
      bar.classList.toggle('is-dirty', n > 0);
      txt.textContent = n === 0 ? 'Nessuna modifica da salvare' : (n === 1 ? '1 modifica non salvata' : n + ' modifiche non salvate');
    };
    document.querySelectorAll('[data-demo-dirty]').forEach(function (el) {
      var ev = el.tagName === 'BUTTON' ? 'click' : 'change';
      el.addEventListener(ev, function () {
        n++; upd();
        if (el.tagName === 'BUTTON') { var tr = el.closest('tr'); if (tr) tr.remove(); }
      });
    });
    document.querySelector('[data-demo-reset]').addEventListener('click', function () { window.location.reload(); });
  }

  // Check-in: filtri e "Segna presente"
  var tab = document.getElementById('tab-cand');
  if (tab) {
    var current = 'daregistrare';
    var apply = function () {
      tab.querySelectorAll('tbody tr').forEach(function (tr) {
        var f = tr.getAttribute('data-filter');
        tr.classList.toggle('is-hidden', current !== '' && f.split(' ').indexOf(current) < 0);
      });
      var count = function (k) { return tab.querySelectorAll('tbody tr[data-filter~="' + k + '"]').length; };
      ['daregistrare', 'presenti', 'scaduto'].forEach(function (k) {
        var el = document.querySelector('[data-count="' + k + '"]'); if (el) el.textContent = count(k);
      });
      var pres = count('presenti'), tot = tab.querySelectorAll('tbody tr').length;
      document.getElementById('cnt-pres').textContent = pres;
      var b = document.getElementById('cnt-bar'), p = Math.round(pres / tot * 100);
      b.style.width = p + '%'; b.setAttribute('aria-valuenow', p);
    };
    document.querySelectorAll('[data-demo-filters] button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        current = btn.getAttribute('data-f');
        document.querySelectorAll('[data-demo-filters] button').forEach(function (o) {
          var on = o === btn;
          o.setAttribute('aria-pressed', on ? 'true' : 'false');
          o.classList.toggle('btn-primary', on); o.classList.toggle('btn-outline-secondary', !on);
        });
        apply();
      });
    });
    tab.addEventListener('click', function (e) {
      var b = e.target.closest('[data-demo-present]'); if (!b) return;
      var tr = b.closest('tr');
      var now = new Date(), hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
      tr.querySelector('[data-cell="stato"]').innerHTML = '<span class="text-success fw-semibold">Presente</span><br><span class="small text-secondary">' + hh + ':' + mm + ' · da tabella</span>';
      tr.querySelector('[data-cell="azioni"]').innerHTML = '<button type="button" class="btn btn-link p-0 fw-semibold">Note</button>';
      tr.setAttribute('data-filter', tr.getAttribute('data-filter').replace('daregistrare', 'presenti'));
      apply();
    });
    apply();
  }


  // Chat interna: apri/chiudi il pannello
  var drawer = document.getElementById('chat'), fab = document.querySelector('[data-chat-open]');
  if (drawer && fab) {
    var setOpen = function (o) {
      drawer.classList.toggle('is-open', o); fab.classList.toggle('d-none', o);
      fab.setAttribute('aria-expanded', o ? 'true' : 'false');
      var b = fab.querySelector('.app-chat-fab-badge'); if (o && b) b.remove();
      if (o) { var i = document.getElementById('chat-msg'); if (i) i.focus(); } else { fab.focus(); }
    };
    fab.addEventListener('click', function () { setOpen(true); });
    drawer.querySelector('[data-chat-close]').addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('is-open')) setOpen(false); });
  }

  // Informatico in sede: segnala reset
  document.querySelectorAll('[data-demo-reset-req]').forEach(function (b) {
    b.addEventListener('click', function () { b.outerHTML = '<span class="badge app-badge-warning">Reset richiesto</span>'; });
  });
  // Link senza destinazione nel prototipo: non saltare in cima
  document.querySelectorAll('a[href="#"]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); }); });
})();
