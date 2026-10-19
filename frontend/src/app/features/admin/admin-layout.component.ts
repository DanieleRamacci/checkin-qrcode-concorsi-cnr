import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <main class="container-fluid app-admin-layout py-4 px-3 px-xl-5">
      <p class="small text-muted mb-1"><a routerLink="/">Profili</a> / Amministrazione</p>
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div><h1 class="mb-1">Amministrazione</h1><p class="mb-0 text-muted">Gestisci accessi, impostazioni e registri dell’applicazione.</p></div>
        <span class="badge text-bg-light">Profilo: Amministrazione</span>
      </div>
      <div class="row g-4">
        <aside class="col-12 col-lg-3 col-xl-2">
          <nav class="app-admin-nav nav nav-pills flex-lg-column gap-2" aria-label="Menu amministrazione">
            <a class="nav-link" routerLink="/admin/permessi" routerLinkActive="active">Permessi</a>
            <a class="nav-link" routerLink="/admin/impostazioni" routerLinkActive="active">Impostazioni</a>
            <a class="nav-link" routerLink="/admin/logs" routerLinkActive="active">Log di sistema</a>
            <a class="nav-link" routerLink="/bandi" [queryParams]="{ mode: 'admin' }">Tutti i bandi</a>
          </nav>
        </aside>
        <section class="col-12 col-lg-9 col-xl-10" aria-label="Contenuto amministrazione"><router-outlet /></section>
      </div>
    </main>
  `,
  styles: `
    .app-admin-layout { max-width: 1600px; margin-inline: auto; }
    .app-admin-nav { position: sticky; top: 1rem; }
    .app-admin-nav .nav-link { color: #17324d; border: 1px solid #d9dadb; background: white; }
    .app-admin-nav .nav-link.active { color: white; background: #005cb9; }
    @media (max-width: 991.98px) { .app-admin-nav { position: static; flex-direction: row !important; overflow-x: auto; } .app-admin-nav .nav-link { white-space: nowrap; } }
  `,
})
export class AdminLayoutComponent {}
