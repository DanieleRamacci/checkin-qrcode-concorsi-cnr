import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient } from '../../core/api-client';
import { AuthService } from '../../core/auth.service';
import { AppSettings } from '../../core/models/api.models';

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="container my-5 admin-settings" aria-labelledby="admin-settings-title">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 id="admin-settings-title" class="mb-0">Impostazioni applicazione</h1>
          <a routerLink="/admin/permessi">Gestione permessi</a>
        </div>
        <a class="btn btn-outline-primary btn-sm" routerLink="/admin/logs">Log sistema</a>
      </div>

      @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
      @if (message()) { <div class="alert alert-success" role="status">{{ message() }}</div> }

      <form class="card" (ngSubmit)="save()">
        <div class="card-header bg-light">
          <strong>Identità dell'app</strong>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label" for="slim-title">Ente di appartenenza</label>
              <input id="slim-title" class="form-control" name="slimTitle" [(ngModel)]="model.slim_title" required maxlength="160" />
            </div>
            <div class="col-md-6">
              <label class="form-label" for="institution-name">Nome istituzione</label>
              <input id="institution-name" class="form-control" name="institutionName" [(ngModel)]="model.institution_name" required maxlength="160" />
            </div>
            <div class="col-md-6">
              <label class="form-label" for="app-title">Nome applicazione</label>
              <input id="app-title" class="form-control" name="appTitle" [(ngModel)]="model.app_title" required maxlength="160" />
            </div>
            <div class="col-md-6">
              <label class="form-label" for="tagline">Sottotitolo</label>
              <input id="tagline" class="form-control" name="tagline" [(ngModel)]="model.tagline" required maxlength="160" />
            </div>
            <div class="col-12">
              <label class="form-label" for="footer-owner">Intestazione footer</label>
              <input id="footer-owner" class="form-control" name="footerOwner" [(ngModel)]="model.footer_owner" required maxlength="160" />
            </div>
          </div>
        </div>
        <div class="card-footer bg-white text-end">
          <button class="btn btn-primary" type="submit" [disabled]="busy()">Salva impostazioni</button>
        </div>
      </form>
    </section>
  `,
  styles: `.admin-settings { max-width: 920px; }`,
})
export class AdminSettingsComponent {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  model: AppSettings = { ...this.auth.defaultSettings };

  constructor() {
    this.load();
  }

  load(): void {
    this.api.get<AppSettings>('/admin/settings').subscribe({
      next: (settings) => this.model = { ...this.auth.defaultSettings, ...settings },
      error: () => this.error.set('Caricamento impostazioni non riuscito.'),
    });
  }

  save(): void {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.api.put<AppSettings>('/admin/settings', this.model).subscribe({
      next: (settings) => {
        this.model = { ...this.auth.defaultSettings, ...settings };
        this.auth.load().subscribe({
          next: () => {
            this.busy.set(false);
            this.message.set('Impostazioni salvate.');
          },
          error: () => {
            this.busy.set(false);
            this.message.set('Impostazioni salvate. Ricarica la pagina per aggiornare header e footer.');
          },
        });
      },
      error: (error) => {
        this.busy.set(false);
        this.error.set(
          (error as { error?: { error?: { message?: string } } })?.error?.error?.message
          ?? 'Salvataggio impostazioni non riuscito.',
        );
      },
    });
  }
}
