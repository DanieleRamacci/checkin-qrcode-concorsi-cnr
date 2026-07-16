import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { ApiList, CandidateSummary } from '../../core/models/api.models';

type ResetViewMode = 'sede' | 'esperto';
type ResetFilter = 'all' | 'richiesto' | 'effettuato' | 'da_evade' | 'evasi';

export function resetFilterForApi(viewMode: ResetViewMode, filter: ResetFilter): string {
  if (viewMode === 'esperto') {
    if (filter === 'da_evade') return 'requested';
    if (filter === 'evasi') return 'completed';
  }
  if (filter === 'richiesto') return 'requested';
  if (filter === 'effettuato') return 'completed';
  return 'all';
}

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule],
  template: `
    <div class="it-card shadow-sm p-3 bg-white mt-3">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">Reset password richiesti</h6>
        <span class="badge bg-primary">{{ items().length }}</span>
      </div>

      <form class="row g-2 mb-3" (ngSubmit)="load()">
        <div class="col-12 col-md-6">
          <label class="visually-hidden" for="reset-search">Cerca nome o documento</label>
          <input id="reset-search" class="form-control" type="search" name="q"
            placeholder="Cerca nome o documento" [(ngModel)]="query" />
        </div>
        <div class="col-8 col-md-4">
          <label class="visually-hidden" for="reset-filter">Filtro reset</label>
          <select id="reset-filter" class="form-select" name="filter" [(ngModel)]="filter">
            @if (viewMode() === 'esperto') {
              <option value="da_evade">Reset da evadere</option>
              <option value="evasi">Reset evasi</option>
              <option value="all">Tutti</option>
            } @else {
              <option value="all">Tutti</option>
              <option value="richiesto">Reset richiesti</option>
              <option value="effettuato">Reset effettuati</option>
            }
          </select>
        </div>
        <div class="col-4 col-md-2">
          <button class="btn btn-outline-primary w-100" type="submit" [disabled]="loading()">Filtra</button>
        </div>
        <div class="col-12 col-md-2">
          <button class="btn btn-outline-secondary w-100" type="button" [disabled]="loading()" (click)="load()">↻ Aggiorna</button>
        </div>
      </form>

      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      } @else if (loading()) {
        <div class="d-flex align-items-center gap-2" role="status">
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <span>Caricamento reset…</span>
        </div>
      } @else if (items().length === 0) {
        <div class="text-muted">Nessun candidato trovato.</div>
      } @else {
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr><th>Nome</th><th>Documento</th><th>Reset</th></tr>
            </thead>
            <tbody>
              @for (candidate of items(); track candidate.uid) {
                <tr>
                  <td>{{ candidate.last_name }} {{ candidate.first_name }}</td>
                  <td>{{ candidate.document_number }}</td>
                  <td class="text-nowrap">
                    @if (viewMode() === 'sede') {
                      <button type="button"
                        [class]="'btn btn-sm ' + (candidate.reset_password_richiesto ? 'btn-outline-danger' : 'btn-outline-primary')"
                        [disabled]="busyUid() === candidate.uid"
                        (click)="mutate(candidate, candidate.reset_password_richiesto ? 'cancel_request' : 'request')">
                        {{ candidate.reset_password_richiesto ? 'Rimuovi' : 'Segna reset' }}
                      </button>
                    } @else {
                      <button type="button"
                        [class]="'btn btn-sm ' + (!candidate.reset_password_effettuato ? 'btn-outline-success' : 'btn-outline-secondary')"
                        [disabled]="busyUid() === candidate.uid"
                        (click)="mutate(candidate, candidate.reset_password_effettuato ? 'undo_complete' : 'complete')">
                        {{ candidate.reset_password_effettuato ? 'Annulla eseguito' : 'Segna eseguito' }}
                      </button>
                    }
                    @if (candidate.reset_password_richiesto) {
                      <span class="badge bg-warning text-dark ms-2">Richiesto</span>
                    }
                    @if (candidate.reset_password_effettuato) {
                      <span class="badge bg-success ms-2">Eseguito</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class ResetPasswordComponent {
  readonly sessionId = input.required<string>();
  readonly viewMode = input.required<ResetViewMode>();
  private readonly api = inject(ApiClient);

  readonly items = signal<CandidateSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busyUid = signal<string | null>(null);
  query = '';
  filter: ResetFilter = 'all';

  ngOnInit(): void {
    this.filter = this.viewMode() === 'esperto' ? 'da_evade' : 'all';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new URLSearchParams({
      q: this.query.trim(),
      reset: resetFilterForApi(this.viewMode(), this.filter),
      mode: this.viewMode(),
    });
    this.api.get<ApiList<CandidateSummary>>(`/sessioni/${this.sessionId()}/candidati?${params}`).subscribe({
      next: ({ items }) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Impossibile caricare le richieste di reset.');
      },
    });
  }

  mutate(candidate: CandidateSummary, operation: string): void {
    this.busyUid.set(candidate.uid);
    this.error.set('');
    this.api.post(
      `/sessioni/${this.sessionId()}/candidati/${encodeURIComponent(candidate.uid)}/reset-password?mode=${encodeURIComponent(this.viewMode())}`,
      { operation },
    ).subscribe({
      next: () => {
        this.busyUid.set(null);
        this.load();
      },
      error: () => {
        this.busyUid.set(null);
        this.error.set('Aggiornamento della richiesta di reset non riuscito.');
      },
    });
  }
}
