import { JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-personal-area',
  imports: [JsonPipe, RouterLink],
  template: `
    <section class="container my-5 personal-area" aria-labelledby="personal-area-title">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <h1 id="personal-area-title" class="mb-0">Area personale</h1>
        <button class="btn btn-outline-danger btn-sm" type="button" (click)="auth.logout()">Logout</button>
      </div>

      @if (user()) {
        <div class="row g-4">
          <div class="col-lg-7">
            <div class="card h-100">
              <div class="card-header bg-light">
                <strong>Dati utente</strong>
              </div>
              <dl class="card-body row mb-0">
                <dt class="col-sm-4">Nome visualizzato</dt>
                <dd class="col-sm-8">{{ user()?.display_name || '-' }}</dd>
                <dt class="col-sm-4">Email</dt>
                <dd class="col-sm-8">{{ user()?.email || '-' }}</dd>
                <dt class="col-sm-4">Ruoli locali</dt>
                <dd class="col-sm-8">{{ list(user()?.roles) }}</dd>
                <dt class="col-sm-4">Capability</dt>
                <dd class="col-sm-8">{{ list(user()?.capabilities) }}</dd>
                <dt class="col-sm-4">Versione app</dt>
                <dd class="col-sm-8">{{ user()?.app_version || 'n/d' }}</dd>
                <dt class="col-sm-4">Aggiornato</dt>
                <dd class="col-sm-8">{{ user()?.app_build_time || 'n/d' }}</dd>
                <dt class="col-sm-4">Modalità sviluppo</dt>
                <dd class="col-sm-8">{{ user()?.dev_mode ? 'Sì' : 'No' }}</dd>
              </dl>
            </div>
          </div>

          <div class="col-lg-5">
            <div class="card h-100">
              <div class="card-header bg-light">
                <strong>Sessione API</strong>
              </div>
              <div class="card-body">
                <dl>
                  <dt>Token CSRF</dt>
                  <dd><code>{{ user()?.csrf_token || '-' }}</code></dd>
                </dl>
                <button
                  class="btn btn-outline-primary btn-sm"
                  type="button"
                  [attr.aria-expanded]="jsonOpen()"
                  aria-controls="user-json"
                  (click)="jsonOpen.set(!jsonOpen())">
                  {{ jsonOpen() ? 'Nascondi JSON' : 'Mostra JSON sessione' }}
                </button>
                @if (jsonOpen()) {
                  <pre id="user-json" class="json-box mt-3 mb-0">{{ user() | json }}</pre>
                }
              </div>
            </div>
          </div>
        </div>
      } @else {
        <div class="alert alert-warning" role="alert">
          Sessione non disponibile.
          <button class="btn btn-link p-0 align-baseline" type="button" (click)="auth.login()">Effettua il login</button>.
        </div>
      }

      <div class="mt-4">
        <a routerLink="/">Torna ai profili</a>
      </div>
    </section>
  `,
  styles: `
    .personal-area { max-width: 1100px; }
    .json-box {
      max-height: 24rem;
      overflow: auto;
      padding: 0.75rem;
      border-radius: 4px;
      background: #f3f5f7;
      font-size: 0.85rem;
    }
  `,
})
export class PersonalAreaComponent {
  readonly auth = inject(AuthService);
  readonly user = this.auth.user;
  readonly jsonOpen = signal(false);

  list(values?: string[]): string {
    return values?.length ? values.join(', ') : '-';
  }
}
