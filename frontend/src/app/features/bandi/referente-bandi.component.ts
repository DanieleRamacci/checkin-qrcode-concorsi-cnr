import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReferenteBandoSummary } from '../../core/models/api.models';
import { BandiService } from './bandi.service';

@Component({
  selector: 'app-referente-bandi',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container my-5">
      <a routerLink="/" class="btn btn-outline-secondary btn-sm mb-3">&larr; Torna alla home</a>
      <h1 class="mb-2">Bandi come referente</h1>
      <p class="lead">Di seguito trovi i bandi per cui Selezioni Online ti indica come RDP o referente.</p>

      @if (syncing()) {
        <div class="alert alert-info py-2" role="status">
          Aggiornamento da Selezioni Online in corso. Sono mostrati subito i bandi gia sincronizzati.
        </div>
      }
      @if (syncError()) {
        <div class="alert alert-warning py-2" role="alert">
          {{ syncError() }}
        </div>
      }

      @if (loading()) {
        <p role="status">Caricamento bandi referente…</p>
      } @else if (error()) {
        <div class="alert alert-warning" role="alert">
          <h2 class="alert-heading h5 mb-2">Bandi referente non disponibili</h2>
          <div>{{ error() }}</div>
        </div>
      } @else {
        @if (items().length === 0) {
          <div class="alert alert-info" role="status">
            @if (syncing()) {
              Cerco bandi referente su Selezioni Online.
            } @else {
              Non risultano bandi per cui la tua utenza e indicata come RDP o referente.
            }
          </div>
        } @else {
          <div class="mb-3">
            <label for="filtro-concorso-referente" class="form-label">Cerca concorso</label>
            <input
              id="filtro-concorso-referente"
              type="search"
              class="form-control"
              placeholder="Scrivi il nome del concorso..."
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
            />
          </div>

          <div class="table-responsive">
            <table class="table table-striped table-hover align-middle">
              <thead class="table-light">
                <tr>
                  <th>#</th>
                  <th>Nome Concorso</th>
                  <th>RDP</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                @for (bando of filteredItems(); track bando.commission_id; let i = $index) {
                  <tr>
                    <th scope="row">{{ i + 1 }}</th>
                    <td>{{ bando.title }}</td>
                    <td>
                      @if ((bando.rdp_names ?? []).length > 0) {
                        {{ (bando.rdp_names ?? []).join(', ') }}
                      } @else {
                        <span class="text-muted">Dato non disponibile</span>
                      }
                    </td>
                    <td>
                      <span [class]="'badge ' + statusBadgeClass(bando.config_status)">
                        {{ statusLabel(bando.config_status) }}
                      </span>
                      <div class="small text-muted mt-1">
                        Esperto:
                        <strong>{{ bando.expert_assigned ? 'assegnato' : 'non assegnato' }}</strong>
                      </div>
                      <div class="small text-muted">
                        Dati:
                        <strong>{{ bando.required_data_complete ? 'compilati' : 'da completare' }}</strong>
                      </div>
                    </td>
                    <td>
                      <a
                        class="btn btn-sm btn-outline-primary"
                        [routerLink]="['/bandi', bando.commission_id, 'config']"
                        [queryParams]="{ returnUrl: '/referenti/bandi' }"
                      >
                        Configura bando
                      </a>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5">Nessun bando corrisponde alla ricerca.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  `,
})
export class ReferenteBandiComponent {
  private readonly service = inject(BandiService);
  readonly items = signal<ReferenteBandoSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly syncing = signal(false);
  readonly syncError = signal<string | null>(null);
  readonly query = signal('');
  readonly filteredItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter((bando) => bando.title.toLowerCase().includes(q));
  });

  constructor() {
    this.service.listReferente().subscribe({
      next: (response) => {
        this.items.set(response.items);
        this.loading.set(false);
        this.refreshRemote();
      },
      error: (error) => {
        this.error.set(apiErrorText(error, 'Non e stato possibile caricare i bandi referente locali.'));
        this.loading.set(false);
        this.refreshRemote();
      },
    });
  }

  private refreshRemote(): void {
    this.syncing.set(true);
    this.syncError.set(null);
    this.service.syncReferente().subscribe({
      next: () => this.reloadLocalAfterSync(),
      error: (error) => {
        this.syncError.set(apiErrorText(error, 'Aggiornamento remoto non riuscito: restano visibili i bandi gia sincronizzati.'));
        this.syncing.set(false);
      },
    });
  }

  private reloadLocalAfterSync(): void {
    this.service.listReferente().subscribe({
      next: (response) => {
        this.items.set(response.items);
        this.syncing.set(false);
      },
      error: (error) => {
        this.syncError.set(apiErrorText(error, 'Aggiornamento completato, ma ricaricamento locale non riuscito.'));
        this.syncing.set(false);
      },
    });
  }

  statusLabel(status?: string | null): string {
    switch (status) {
      case 'dati_compilati':
        return 'Dati compilati';
      case 'esperto_assegnato':
        return 'Esperto assegnato';
      default:
        return 'Da configurare';
    }
  }

  statusBadgeClass(status?: string | null): string {
    switch (status) {
      case 'dati_compilati':
        return 'bg-success';
      case 'esperto_assegnato':
        return 'bg-primary';
      default:
        return 'bg-secondary';
    }
  }
}

function apiErrorText(error: unknown, fallback: string): string {
  const httpError = error as {
    status?: number;
    error?: string | { error?: { code?: string; message?: string; details?: Record<string, string> } };
  };
  const apiError = typeof httpError.error === 'object' ? httpError.error?.error : undefined;
  const details = apiError?.details ? Object.values(apiError.details).filter(Boolean).join(' ') : '';
  return [
    fallback,
    httpError.status ? `HTTP ${httpError.status}` : '',
    apiError?.code ?? '',
    apiError?.message ?? '',
    details,
  ].filter(Boolean).join(' - ');
}
