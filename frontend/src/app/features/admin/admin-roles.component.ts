import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { ApiList } from '../../core/models/api.models';
import { roleLabel as readableRoleLabel } from '../../shared/session-states';

interface AdminRole {
  user_email: string;
  role: 'esperto_informatico' | 'admin_globale';
  created_by?: string | null;
  created_at?: string | null;
}

@Component({
  selector: 'app-admin-roles',
  imports: [FormsModule, DatePipe, NgTemplateOutlet],
  template: `
    <h1 class="mb-3">Permessi</h1>
    @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
    @if (message()) { <div class="alert alert-success" role="status">{{ message() }}</div> }

    <section class="card card-bg no-after mb-4" aria-labelledby="pe-esp"><div class="card-body">
      <h2 id="pe-esp" class="h4 mb-1">Esperti remoti</h2>
      <p class="text-secondary">Chi è in questo elenco si può scegliere come esperto remoto nella configurazione dei bandi e delle sessioni.</p>
      <form class="row g-3 align-items-end mb-3" (ngSubmit)="add(expertEmail, 'esperto_informatico')">
        <div class="col-12 col-md-8"><div class="form-group mb-0"><label for="expert-email" class="active">Email istituzionale</label>
          <input id="expert-email" class="form-control" type="email" name="expertEmail" placeholder="nome.cognome@cnr.it" [(ngModel)]="expertEmail" required /></div></div>
        <div class="col-12 col-md-4"><button class="btn btn-primary w-100" type="submit" [disabled]="busy()">Aggiungi esperto</button></div>
      </form>
      <ng-container *ngTemplateOutlet="roleTable; context: { $implicit: experts(), empty: 'Nessun esperto remoto registrato.' }" />
    </div></section>

    <section class="card card-bg no-after" aria-labelledby="pe-alt"><div class="card-body">
      <h2 id="pe-alt" class="h4 mb-1">Altri ruoli</h2>
      <p class="text-secondary">Amministratori dell’applicazione: vedono tutti i bandi e l’area Amministrazione.</p>
      <form class="row g-3 align-items-end mb-3" (ngSubmit)="add(roleEmail, selectedRole())">
        <div class="col-12 col-md-5"><div class="form-group mb-0"><label for="admin-email" class="active">Email istituzionale</label>
          <input id="admin-email" class="form-control" type="email" name="roleEmail" placeholder="nome.cognome@cnr.it" [(ngModel)]="roleEmail" required /></div></div>
        <div class="col-12 col-md-4"><div class="select-wrapper"><label for="role-select">Ruolo</label>
          <select id="role-select" name="role" [ngModel]="selectedRole()" (ngModelChange)="selectedRole.set($event)">
            <option value="admin_globale">Amministratore</option>
            <option value="esperto_informatico">Esperto remoto</option>
          </select></div></div>
        <div class="col-12 col-md-3"><button class="btn btn-outline-primary w-100" type="submit" [disabled]="busy()">Aggiungi</button></div>
      </form>
      <ng-container *ngTemplateOutlet="roleTable; context: { $implicit: admins(), empty: 'Nessun amministratore registrato.' }" />
      <p class="small text-secondary mt-3 mb-0">“Rimuovi” chiede conferma.</p>
    </div></section>

    <ng-template #roleTable let-rows let-empty="empty">
      @if (loading()) {
        <p class="d-flex align-items-center gap-2 py-2 mb-0" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Carico i permessi…</p>
      } @else if (rows.length === 0) {
        <p class="text-secondary mb-0">{{ empty }}</p>
      } @else {
        <div class="table-responsive"><table class="table align-middle mb-0">
          <thead><tr><th scope="col">Email</th><th scope="col">Ruolo</th><th scope="col">Aggiunto da</th><th scope="col">Data</th><th scope="col"><span class="visually-hidden">Azioni</span></th></tr></thead>
          <tbody>
            @for (row of rows; track row.user_email + row.role) {
              <tr>
                <td class="text-break">{{ row.user_email }}</td>
                <td><span class="badge app-badge-neutral">{{ roleLabel(row.role) }}</span></td>
                <td class="text-break">{{ row.created_by || '—' }}</td>
                <td class="app-num-cell">{{ row.created_at ? (row.created_at | date:'dd/MM/yyyy') : '—' }}</td>
                <td class="text-end"><button class="btn btn-link text-danger p-0 fw-semibold" type="button" [disabled]="busy()" (click)="pendingRemoval.set(row)">Rimuovi<span class="visually-hidden"> {{ row.user_email }}</span></button></td>
              </tr>
            }
          </tbody>
        </table></div>
      }
    </ng-template>
    @if (pendingRemoval(); as row) {
      <div class="modal d-block" role="dialog" aria-modal="true" aria-labelledby="remove-role-title" style="background:rgba(0,0,0,.45)" (keydown.escape)="pendingRemoval.set(null)">
        <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
          <div class="modal-header"><h2 id="remove-role-title" class="modal-title h5">Rimuovere questo permesso?</h2></div>
          <div class="modal-body">Il ruolo <strong>{{ roleLabel(row.role) }}</strong> verrà rimosso da <strong>{{ row.user_email }}</strong>.</div>
          <div class="modal-footer"><button class="btn btn-outline-secondary btn-sm" type="button" (click)="pendingRemoval.set(null)">Annulla</button><button class="btn btn-danger btn-sm" type="button" [disabled]="busy()" (click)="remove(row)">Rimuovi permesso</button></div>
        </div></div>
      </div>
    }
  `,
})
export class AdminRolesComponent {
  private readonly api = inject(ApiClient);
  readonly roles = signal<AdminRole[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly pendingRemoval = signal<AdminRole | null>(null);
  readonly experts = computed(() => this.roles().filter((row) => row.role === 'esperto_informatico'));
  readonly admins = computed(() => this.roles().filter((row) => row.role === 'admin_globale'));
  expertEmail = '';
  roleEmail = '';
  readonly selectedRole = signal<AdminRole['role']>('admin_globale');

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
      () => this.roleEmail = '',
    );
  }

  remove(row: AdminRole): void {
    this.pendingRemoval.set(null);
    this.mutate(
      this.api.delete(`/admin/roles/${encodeURIComponent(row.user_email)}/${row.role}`),
      'Permesso rimosso.',
    );
  }

  roleLabel(role: AdminRole['role']): string { return readableRoleLabel(role); }

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
