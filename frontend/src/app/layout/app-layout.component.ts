import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  imports: [
    RouterLink,
    RouterOutlet,
  ],
  template: `
    <a class="skip-link" href="#main-content">Vai al contenuto principale</a>

    <div class="app-shell">
      <header class="it-header-wrapper" data-bs-target="#header-nav">
        <div class="it-header-slim-wrapper">
          <div class="container-xxl">
            <div class="row">
              <div class="col-12">
                <div class="it-header-slim-wrapper-content">
                  <a class="d-none d-lg-block navbar-brand" routerLink="/">
                    Sistema Gestione Presenze Concorsi CNR
                  </a>
                  <div class="it-header-slim-right-zone">
                    <div class="it-access-top-wrapper">
                      <a class="btn btn-outline-light btn-sm" href="/me">Area riservata</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabindex="-1" class="flex-grow-1">
        <router-outlet />
      </main>

      <footer class="it-footer bg-light mt-5">
        <div class="it-footer-main">
          <div class="container-xxl">
            <div class="row">
              <div class="col-12 col-md-8">
                <p class="mb-1">Realizzato da Daniele Ramacci CNR - Consiglio Nazionale delle Ricerche</p>
                <p class="mb-1"><a href="/privacy-policy">Privacy Policy</a></p>
              </div>
              <div class="col-12 col-md-4 text-md-end text-start mt-3 mt-md-0">
                <small class="d-block">Versione: n/d</small>
                <small class="d-block">Aggiornato: n/d</small>
              </div>
            </div>
          </div>
        </div>
        <div class="it-footer-small-prints bg-dark text-white">
          <div class="container-xxl">
            <div class="row">
              <div class="col text-center py-3">
                <small>&copy; {{ currentYear }} CNR Ufficio Reclutamento - Tutti i diritti riservati.</small>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: `
    .app-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .skip-link {
      position: absolute;
      left: -10000px;
      top: auto;
    }
    .skip-link:focus {
      left: 1rem;
      top: 1rem;
      z-index: 10000;
      background: white;
      padding: 0.75rem;
    }
  `,
})
export class AppLayoutComponent {
  readonly currentYear = new Date().getFullYear();
}
