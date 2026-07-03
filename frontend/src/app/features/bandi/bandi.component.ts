import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BandoSummary } from '../../core/models/api.models';
import { AuthService } from '../../core/auth.service';
import { BandiService } from './bandi.service';

@Component({
  selector: 'app-bandi',
  imports: [RouterLink, FormsModule],
  template: `
    @if (auth.user()?.dev_mode) {
      <div class="alert alert-warning d-flex align-items-center gap-2 mb-0 rounded-0 py-2" role="alert">
        <strong>⚠ DEVELOPER MODE</strong> — Sessioni non attive abilitate, controlli temporali disabilitati.
      </div>
    }
    <div class="container my-5">
      <h1 class="mb-4">Dashboard Segretario</h1>
      <p class="lead">Di seguito trovi l'elenco dei concorsi per cui sei autorizzato.</p>

      @if (syncError()) {
        <div class="alert alert-warning" role="alert">
          <h2 class="alert-heading h5 mb-2">Sincronizzazione commissioni non riuscita</h2>
          <div><strong>Motivo:</strong> {{ syncError() }}</div>
          @if (syncSource() === 'db_cache' || syncSource() === 'db_fallback') {
            <div class="mt-1">Stai visualizzando i dati locali in cache (se presenti).</div>
          }
        </div>
      }

      @if (loading()) {
        <p role="status">Caricamento bandi…</p>
      } @else if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      } @else {
        @if (items().length === 0) {
          <div class="alert alert-info" role="status">Nessuna commissione disponibile.</div>
        }

        <div class="mb-3">
          <label for="filtro-concorso-segretario" class="form-label">Cerca concorso</label>
          <input
            id="filtro-concorso-segretario"
            type="search"
            class="form-control"
            placeholder="Scrivi il nome del concorso..."
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />
        </div>

        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead class="table-light">
              <tr>
                <th>#</th>
                <th>Nome Concorso</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              @for (bando of filteredItems(); track bando.commission_id; let i = $index) {
                <tr>
                  <th scope="row">{{ i + 1 }}</th>
                  <td>{{ bando.title }}</td>
                  <td>
                    <a
                      class="btn btn-sm btn-primary"
                      [routerLink]="['/bandi', bando.commission_id, 'sessioni']"
                      [queryParams]="{ mode: mode }"
                    >
                      Visualizza Sessioni
                    </a>
                    <a
                      class="btn btn-sm btn-outline-primary ms-2"
                      [routerLink]="['/bandi', bando.commission_id, 'config']"
                    >
                      Configura
                    </a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3">Nessuna commissione disponibile.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (mobilePromptOpen()) {
      <div class="modal mobile-scanner-prompt d-md-none" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="mobileScannerModalLabel">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content p-3">
            <div class="modal-header">
              <h2 class="modal-title h5" id="mobileScannerModalLabel">Accesso rapido</h2>
            </div>
            <div class="modal-body">Vuoi passare allo scanner per la scansione dei QR code?</div>
            <div class="modal-footer">
              <a routerLink="/scanner" class="btn btn-primary">Vai allo Scanner</a>
              <button type="button" class="btn btn-secondary" (click)="mobilePromptOpen.set(false)">Chiudi</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .mobile-scanner-prompt {
      display: block;
      background: rgba(0, 0, 0, 0.45);
    }
  `,
})
export class BandiComponent {
  private readonly service = inject(BandiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly mode = this.route.snapshot.queryParamMap.get('mode') ?? 'segretario';
  readonly items = signal<BandoSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly syncError = signal<string | null>(null);
  readonly syncSource = signal<string | null>(null);
  readonly mobilePromptOpen = signal(true);
  readonly query = signal('');
  readonly filteredItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.items();
    return this.items().filter((bando) => bando.title.toLowerCase().includes(q));
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.sync().subscribe({
      next: (response) => this.applyResponse(response),
      error: () => {
        this.syncError.set('Sincronizzazione remota non disponibile.');
        this.syncSource.set('db_fallback');
        this.service.list().subscribe({
          next: (response) => this.applyResponse(response, true),
          error: () => {
            this.error.set('Impossibile caricare i bandi.');
            this.loading.set(false);
          },
        });
      },
    });
  }

  private applyResponse(
    response: { items: BandoSummary[]; sync_error?: string | null; sync_source?: string | null },
    preserveSyncError = false,
  ): void {
    this.items.set(response.items);
    if (!preserveSyncError) {
      this.syncError.set(response.sync_error ?? null);
      this.syncSource.set(response.sync_source ?? null);
    }
    this.loading.set(false);
  }
}
