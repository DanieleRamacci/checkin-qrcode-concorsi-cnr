import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ItIconComponent } from 'design-angular-kit';

/** Area Amministrazione (prototipi admin-*.html): menu laterale in card e contenuto a destra. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ItIconComponent],
  template: `
    <div class="container py-4 py-lg-5">
      <nav class="breadcrumb-container" aria-label="Percorso di navigazione"><ol class="breadcrumb p-0 mb-2">
        <li class="breadcrumb-item"><a routerLink="/">Profili</a><span class="separator">/</span></li>
        <li class="breadcrumb-item active" aria-current="page">Amministrazione</li>
      </ol></nav>
      <div class="row g-4">
        <div class="col-12 col-lg-3">
          <nav class="card card-bg no-after app-admin-nav" aria-label="Amministrazione"><div class="card-body">
            <p class="app-eyebrow mb-2">Amministrazione</p>
            <div class="link-list-wrapper"><ul class="link-list mb-0">
              <li><a class="list-item" routerLink="/admin/permessi" routerLinkActive="active" ariaCurrentWhenActive="page"><it-icon name="key" size="sm" color="primary" /><span>Permessi</span></a></li>
              <li><a class="list-item" routerLink="/admin/impostazioni" routerLinkActive="active" ariaCurrentWhenActive="page"><it-icon name="settings" size="sm" color="primary" /><span>Impostazioni</span></a></li>
              <li><a class="list-item" routerLink="/admin/logs" routerLinkActive="active" ariaCurrentWhenActive="page"><it-icon name="list" size="sm" color="primary" /><span>Log di sistema</span></a></li>
              <li><a class="list-item" routerLink="/bandi" [queryParams]="{ mode: 'admin' }"><it-icon name="folder" size="sm" color="primary" /><span>Tutti i bandi</span></a></li>
            </ul></div>
          </div></nav>
        </div>
        <div class="col-12 col-lg-9 app-minw"><router-outlet /></div>
      </div>
    </div>
  `,
})
export class AdminLayoutComponent {}
