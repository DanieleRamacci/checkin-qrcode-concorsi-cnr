import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="container my-5" aria-labelledby="page-title">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h1 id="page-title" class="mb-0">Seleziona il profilo</h1>
        @if (auth.hasCapability('admin')) {
          <div class="dropdown">
            <button
              class="btn btn-outline-secondary dropdown-toggle"
              type="button"
              aria-haspopup="true"
              [attr.aria-expanded]="adminMenuOpen()"
              (click)="adminMenuOpen.set(!adminMenuOpen())"
            >
              Menu admin
            </button>
            @if (adminMenuOpen()) {
              <ul class="dropdown-menu dropdown-menu-end show">
                <li><a class="dropdown-item" routerLink="/admin/permessi">Gestione permessi</a></li>
                <li><a class="dropdown-item" routerLink="/admin/logs">Log sistema</a></li>
              </ul>
            }
          </div>
        }
      </div>
      <p class="text-muted">Scegli il flusso di lavoro per continuare.</p>

      <div class="row g-3">
        <div class="col-md-4">
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h2 class="card-title h5">Segretario</h2>
              <p class="card-text">Gestione concorsi e sessioni fino alle liste inviate.</p>
              <a class="btn btn-primary" routerLink="/bandi">Entra come Segretario</a>
            </div>
          </div>
        </div>
        @if (auth.hasCapability('expert_workflow')) {
          <div class="col-md-4">
            <div class="card h-100 shadow-sm">
              <div class="card-body">
                <h2 class="card-title h5">Esperto informatico</h2>
                <p class="card-text">Gestisci supporto tecnico, reset e fasi dell'esame.</p>
                <a class="btn btn-primary" routerLink="/bandi" [queryParams]="{ mode: 'expert' }">
                  Entra come Esperto
                </a>
              </div>
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  readonly adminMenuOpen = signal(false);
}
