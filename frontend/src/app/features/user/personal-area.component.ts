import { JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient } from '../../core/api-client';
import { AuthService } from '../../core/auth.service';

interface TestAccess { base_url: string; cookie_name: string; cookie_value: string; csrf_header: string; csrf_token: string; }

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
            <div class="card card-bg no-after app-cand-card h-100">
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
            <div class="card card-bg no-after app-cand-card h-100">
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

          @if (user()?.api_test_access) {
            <div class="col-12">
              <div class="card card-bg no-after app-cand-card border border-warning">
                <div class="card-header bg-light"><strong>Accesso API per i test</strong></div>
                <div class="card-body">
                  <p class="mb-2">Permette a chi lo riceve di usare l’applicazione <strong>come te</strong>, con i tuoi permessi, finché questa sessione resta valida (fino a 8 ore). Dallo solo per i test sul server di prova e premi <strong>Esci</strong> quando hai finito: l’accesso smette subito di funzionare.</p>
                  @if (testAccess(); as access) {
                    <dl class="app-access-data mb-3">
                      <dt>Indirizzo API</dt><dd><code class="user-select-all">{{ access.base_url }}</code></dd>
                      <dt>Cookie</dt><dd><code class="user-select-all">{{ access.cookie_name }}={{ access.cookie_value }}</code></dd>
                      <dt>{{ access.csrf_header }}</dt><dd><code class="user-select-all">{{ access.csrf_token }}</code></dd>
                    </dl>
                    <div class="d-flex flex-wrap gap-2">
                      <button class="btn btn-primary btn-sm" type="button" (click)="copyTestAccess(access)">Copia accesso API</button>
                      <button class="btn btn-outline-secondary btn-sm" type="button" (click)="testAccess.set(null)">Nascondi</button>
                    </div>
                  } @else {
                    <button class="btn btn-outline-primary btn-sm" type="button" [disabled]="testAccessLoading()" (click)="loadTestAccess()">Mostra accesso API</button>
                  }
                  @if (testAccessMessage()) { <p class="small mt-2 mb-0" role="status">{{ testAccessMessage() }}</p> }
                </div>
              </div>
            </div>
          }
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
    .app-access-data { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
    .app-access-data dt { font-weight: 600; }
    .app-access-data dd { margin: 0; min-width: 0; }
    .app-access-data code { display: block; padding: 4px 6px; border-radius: 4px; background: #f3f5f7; overflow-wrap: anywhere; }
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
  private readonly api = inject(ApiClient);
  readonly testAccess = signal<TestAccess | null>(null);
  readonly testAccessLoading = signal(false);
  readonly testAccessMessage = signal('');

  loadTestAccess(): void {
    this.testAccessLoading.set(true);
    this.testAccessMessage.set('');
    this.api.get<TestAccess>('/me/test-access').subscribe({
      next: (access) => { this.testAccess.set(access); this.testAccessLoading.set(false); },
      error: () => { this.testAccessLoading.set(false); this.testAccessMessage.set('Accesso API non disponibile su questo server.'); },
    });
  }

  /** Blocco pronto da incollare: indirizzo, cookie e intestazione CSRF. */
  async copyTestAccess(access: TestAccess): Promise<void> {
    const text = [`base_url: ${access.base_url}`, `cookie: ${access.cookie_name}=${access.cookie_value}`, `${access.csrf_header}: ${access.csrf_token}`].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.testAccessMessage.set('Accesso API copiato. Ricordati di premere Esci a fine test.');
    } catch {
      this.testAccessMessage.set('Copia non riuscita: seleziona i valori e copiali a mano.');
    }
  }

  list(values?: string[]): string {
    return values?.length ? values.join(', ') : '-';
  }
}
