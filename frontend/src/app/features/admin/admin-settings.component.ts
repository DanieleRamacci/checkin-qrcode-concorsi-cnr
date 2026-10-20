import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { AuthService } from '../../core/auth.service';
import { AppSettings } from '../../core/models/api.models';

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule],
  template: `
    <h1 class="mb-3">Impostazioni</h1>
    @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
    @if (message()) { <div class="alert alert-success" role="status">{{ message() }}</div> }
    @if (loading()) { <p class="d-flex align-items-center gap-2" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Carico le impostazioni…</p> }
    <form class="card card-bg no-after" aria-labelledby="im-id" (ngSubmit)="save()"><div class="card-body">
      <h2 id="im-id" class="h4 mb-1">Identità dell’app</h2>
      <p class="text-secondary">Questi testi compaiono nell’intestazione, nel piè di pagina e nelle email.</p>
      <div class="row g-4">
        <div class="col-12 col-md-6"><div class="form-group mb-0"><label for="institution-name" class="active">Nome ente</label><input id="institution-name" class="form-control" name="institutionName" [(ngModel)]="model.institution_name" required maxlength="160" /></div></div>
        <div class="col-12 col-md-6"><div class="form-group mb-0"><label for="app-title" class="active">Nome applicazione</label><input id="app-title" class="form-control" name="appTitle" [(ngModel)]="model.app_title" required maxlength="160" /></div></div>
        <div class="col-12 col-md-6"><div class="form-group mb-0"><label for="tagline" class="active">Sottotitolo</label><input id="tagline" class="form-control" name="tagline" [(ngModel)]="model.tagline" required maxlength="160" /></div></div>
        <div class="col-12 col-md-6"><div class="form-group mb-0"><label for="footer-owner" class="active">Intestazione footer</label><input id="footer-owner" class="form-control" name="footerOwner" [(ngModel)]="model.footer_owner" required maxlength="160" /></div></div>
      </div>
      <h3 class="h6 mt-4 mb-2">Anteprima intestazione</h3>
      <div class="app-preview-head" aria-label="Anteprima dell’intestazione"><strong>{{ model.institution_name || 'Nome ente' }} · {{ model.app_title || 'Nome applicazione' }}</strong><span>{{ model.tagline || 'Sottotitolo' }}</span></div>
      <div class="app-next-footer"><p class="mb-0 text-secondary">Le modifiche valgono per tutti gli utenti.</p>
        <button class="btn btn-primary" type="submit" [disabled]="busy() || loading()">Salva impostazioni</button></div>
    </div></form>
  `,
})
export class AdminSettingsComponent {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  model: AppSettings = { ...this.auth.defaultSettings };

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<AppSettings>('/admin/settings').subscribe({
      next: (settings) => {
        this.model = { ...this.auth.defaultSettings, ...settings };
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Caricamento impostazioni non riuscito.');
      },
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
