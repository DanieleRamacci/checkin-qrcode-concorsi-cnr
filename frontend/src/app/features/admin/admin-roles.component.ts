import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient } from '../../core/api-client';
import { ApiList } from '../../core/models/api.models';

interface AdminRole {
  user_email: string;
  role: 'esperto_informatico' | 'admin_globale';
  created_by?: string | null;
  created_at?: string | null;
}

@Component({
  selector: 'app-admin-roles',
  imports: [FormsModule, RouterLink, DatePipe, NgTemplateOutlet],
  template: `
    <section class="container my-5 admin-page" aria-labelledby="admin-roles-title">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 id="admin-roles-title" class="mb-0">Gestione permessi</h1>
        <a class="btn btn-outline-primary btn-sm" routerLink="/admin/logs">Log sistema</a>
      </div>

      @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
      @if (message()) { <div class="alert alert-success" role="status">{{ message() }}</div> }

      <div class="card mb-4">
        <div class="card-header bg-light py-2">
          <span class="fw-bold text-uppercase small text-primary">Esperti informatici</span>
          <span class="text-muted small ms-2">Disponibili come “Esperto remoto” nella configurazione bandi</span>
        </div>
        <div class="card-body">
          <form class="row g-2 align-items-end mb-3" (ngSubmit)="add(expertEmail, 'esperto_informatico')">
            <div class="col-md-8">
              <label for="expert-email" class="form-label small mb-1">Email esperto</label>
              <input id="expert-email" class="form-control form-control-sm" type="email" name="expertEmail"
                placeholder="nome.cognome@cnr.it" [(ngModel)]="expertEmail" required />
            </div>
            <div class="col-md-4">
              <button class="btn btn-primary btn-sm w-100" type="submit" [disabled]="busy()">Aggiungi esperto</button>
            </div>
          </form>
          <ng-container *ngTemplateOutlet="roleTable; context: { $implicit: experts(), empty: 'Nessun esperto informatico registrato.' }" />
        </div>
      </div>

      <div class="card mb-4">
        <div class="card-header bg-light py-2">
          <span class="fw-bold text-uppercase small text-primary">Permessi globali</span>
          <span class="text-muted small ms-2">Amministratori di sistema</span>
        </div>
        <div class="card-body">
          <form class="row g-2 align-items-end mb-3" (ngSubmit)="add(adminEmail, 'admin_globale')">
            <div class="col-md-8">
              <label for="admin-email" class="form-label small mb-1">Email utente</label>
              <input id="admin-email" class="form-control form-control-sm" type="email" name="adminEmail"
                placeholder="nome.cognome@cnr.it" [(ngModel)]="adminEmail" required />
            </div>
            <div class="col-md-4">
              <button class="btn btn-primary btn-sm w-100" type="submit" [disabled]="busy()">Aggiungi amministratore</button>
            </div>
          </form>
          <ng-container *ngTemplateOutlet="roleTable; context: { $implicit: admins(), empty: 'Nessun amministratore registrato.' }" />
        </div>
      </div>

      <ng-template #roleTable let-rows let-empty="empty">
        @if (loading()) {
          <p role="status">Caricamento permessi…</p>
        } @else if (rows.length === 0) {
          <p class="text-muted small mb-0">{{ empty }}</p>
        } @else {
          <div class="table-responsive">
            <table class="table table-sm table-hover mb-0">
              <thead class="table-light"><tr><th>Email</th><th>Ruolo</th><th>Aggiunto da</th><th>Il</th><th></th></tr></thead>
              <tbody>
                @for (row of rows; track row.user_email + row.role) {
                  <tr>
                    <td>{{ row.user_email }}</td>
                    <td><span class="badge bg-secondary">{{ row.role }}</span></td>
                    <td>{{ row.created_by || '-' }}</td>
                    <td class="text-muted small">{{ row.created_at ? (row.created_at | date:'dd/MM/yyyy') : '-' }}</td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-danger" type="button" [disabled]="busy()" (click)="remove(row)">Rimuovi</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </ng-template>
    </section>
  `,
  styles: `.admin-page { max-width: 900px; }`,
})
export class AdminRolesComponent {
  private readonly api = inject(ApiClient);
  readonly roles = signal<AdminRole[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly experts = computed(() => this.roles().filter((row) => row.role === 'esperto_informatico'));
  readonly admins = computed(() => this.roles().filter((row) => row.role === 'admin_globale'));
  expertEmail = '';
  adminEmail = '';

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.get<ApiList<AdminRole>>('/admin/roles').subscribe({
      next: ({ items }) => { this.roles.set(items); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Caricamento dei permessi non riuscito.'); },
    });
  }

  add(userEmail: string, role: AdminRole['role']): void {
    this.mutate(
      this.api.post('/admin/roles', { user_email: userEmail, role }),
      'Permesso aggiunto.',
      () => role === 'esperto_informatico' ? this.expertEmail = '' : this.adminEmail = '',
    );
  }

  remove(row: AdminRole): void {
    if (!window.confirm(`Rimuovere ${row.role} da ${row.user_email}?`)) return;
    this.mutate(
      this.api.delete(`/admin/roles/${encodeURIComponent(row.user_email)}/${row.role}`),
      'Permesso rimosso.',
    );
  }

  private mutate(request: ReturnType<ApiClient['post']>, success: string, done?: () => void): void {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    request.subscribe({
      next: () => { this.busy.set(false); this.message.set(success); done?.(); this.load(); },
      error: (error) => {
        this.busy.set(false);
        this.error.set(
          (error as { error?: { error?: { message?: string } } })?.error?.error?.message
          ?? 'Operazione non riuscita.',
        );
      },
    });
  }
}
