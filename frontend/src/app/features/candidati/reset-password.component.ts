import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiClient } from '../../core/api-client';
import { ApiList, CandidateSummary } from '../../core/models/api.models';
import { FilterChipOption, FilterChipsComponent } from '../../shared/filter-chips.component';
import { PagerComponent } from '../../shared/pager.component';

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
  imports: [FormsModule, DatePipe, FilterChipsComponent, PagerComponent],
  template: `
    <section id="candidates" class="it-card shadow-sm p-3 bg-white mt-3" aria-labelledby="reset-title">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div><h2 id="reset-title" class="h5 mb-1">Reset password</h2><p class="small text-muted mb-0">Solo candidati presenti</p></div>
        <span class="badge text-bg-primary" aria-live="polite">{{ filteredItems().length }} presenti</span>
      </div>

      <div class="row g-2 align-items-end mb-3">
        <div class="col-12 col-md-6"><label class="form-label" for="reset-search">Cerca candidato</label>
          <input id="reset-search" class="form-control" type="search" name="q" placeholder="Nome o cognome" [(ngModel)]="query" (ngModelChange)="page.set(1); updateView()" />
        </div>
        <div class="col-12 col-md-6 d-flex justify-content-md-end">
          <button class="btn btn-outline-secondary" type="button" [disabled]="loading()" (click)="load()">
            @if (loading()) {
              <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
            }
            <span>Aggiorna</span>
          </button>
        </div>
      </div>
      <app-filter-chips label="Filtra i reset" [options]="filterOptions()" [selected]="filter()" (selectedChange)="setFilter($event)" />

      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      } @else if (loading()) {
        <div class="d-flex align-items-center gap-2" role="status">
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <span>Caricamento reset…</span>
        </div>
      } @else if (filteredItems().length === 0) {
        <div class="app-empty text-center py-4"><p class="mb-0">{{ query.trim() ? 'Nessun candidato corrisponde alla ricerca.' : 'Nessun reset in questa categoria.' }}</p></div>
      } @else {
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th>Cognome e nome</th><th>Reset password</th><th>Azioni</th></tr></thead>
            <tbody>
              @for (candidate of pageItems(); track candidate.uid) {
                <tr [class.app-row-attn]="candidate.reset_password_richiesto">
                  <th scope="row">{{ candidate.last_name }} {{ candidate.first_name }}</th>
                  <td>
                    @if (candidate.reset_password_richiesto) {
                      <span class="badge text-bg-warning">Reset richiesto</span>
                      <span class="small text-muted ms-2">dall’informatico in sede</span>
                      @if (candidate.reset_password_richiesto_at) { <span class="small text-muted ms-2">alle {{ candidate.reset_password_richiesto_at | date:'HH:mm' }}</span> }
                    } @else if (candidate.reset_password_effettuato) {
                      <span class="badge text-bg-success">Reset fatto</span>
                      @if (candidate.reset_password_effettuato_at) { <span class="small text-muted ms-2">{{ candidate.reset_password_effettuato_at | date:'dd/MM/yyyy HH:mm' }}</span> }
                    } @else { <span class="text-muted">Nessun reset registrato</span> }
                  </td>
                  <td class="text-nowrap">
                    @if (viewMode() === 'sede') {
                      <button type="button"
                        [class]="'btn btn-sm ' + (candidate.reset_password_richiesto ? 'btn-outline-danger' : 'btn-outline-primary')"
                        [disabled]="busyUid() === candidate.uid"
                        (click)="mutate(candidate, candidate.reset_password_richiesto ? 'cancel_request' : 'request')">
                        {{ candidate.reset_password_richiesto ? 'Annulla richiesta' : 'Serve reset password' }}
                      </button>
                    } @else {
                      <button type="button"
                        [class]="'btn btn-sm ' + (!candidate.reset_password_effettuato ? 'btn-outline-success' : 'btn-outline-secondary')"
                        [disabled]="busyUid() === candidate.uid"
                        (click)="mutate(candidate, candidate.reset_password_effettuato ? 'undo_complete' : 'complete')">
                        {{ candidate.reset_password_effettuato ? 'Annulla reset fatto' : (candidate.reset_password_richiesto ? 'Segna come fatto' : 'Registra un reset') }}
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager label="Candidati presenti" [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="setPageSize($event)" />
      }
    </section>
  `,
})
export class ResetPasswordComponent {
  readonly sessionId = input.required<string>();
  readonly viewMode = input.required<ResetViewMode>();
  readonly openCountChange = output<number>();
  private readonly api = inject(ApiClient);

  readonly items = signal<CandidateSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busyUid = signal<string | null>(null);
  readonly filter = signal<ResetFilter>('all');
  readonly page = signal(1);
  readonly pageSize = signal(25);
  query = '';

  readonly filterOptions = signal<FilterChipOption[]>([]);
  readonly filteredItems = signal<CandidateSummary[]>([]);
  readonly pageItems = signal<CandidateSummary[]>([]);

  ngOnInit(): void {
    this.filter.set(this.viewMode() === 'esperto' ? 'da_evade' : 'richiesto');
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new URLSearchParams({
      q: this.query.trim(),
      checkin: 'yes',
      reset: 'all',
      mode: this.viewMode(),
    });
    this.api.get<ApiList<CandidateSummary>>(`/sessioni/${this.sessionId()}/candidati?${params}`).subscribe({
      next: ({ items }) => {
        this.items.set(items);
        this.updateView();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Impossibile caricare le richieste di reset.');
      },
    });
  }

  setFilter(value: string): void { this.filter.set(value as ResetFilter); this.page.set(1); this.updateView(); }
  setPageSize(value: number): void { this.pageSize.set(value); this.page.set(1); this.updateView(); }

  updateView(): void {
    const query = this.query.trim().toLocaleLowerCase();
    const candidates = this.items()
      .filter((candidate) => {
        if (this.filter() === 'richiesto' || this.filter() === 'da_evade') return candidate.reset_password_richiesto;
        if (this.filter() === 'effettuato' || this.filter() === 'evasi') return candidate.reset_password_effettuato;
        return true;
      })
      .filter((candidate) => !query || `${candidate.last_name} ${candidate.first_name}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => Number(b.reset_password_richiesto) - Number(a.reset_password_richiesto) || a.last_name.localeCompare(b.last_name));
    this.filteredItems.set(candidates);
    this.pageItems.set(candidates.slice((this.page() - 1) * this.pageSize(), this.page() * this.pageSize()));
    const inAttesa = this.items().filter((candidate) => candidate.reset_password_richiesto).length;
    this.openCountChange.emit(inAttesa);
    const fatti = this.items().filter((candidate) => candidate.reset_password_effettuato).length;
    this.filterOptions.set(this.viewMode() === 'esperto'
      ? [{ id: 'da_evade', label: 'Da fare', count: inAttesa }, { id: 'evasi', label: 'Reset fatti', count: fatti }, { id: 'all', label: 'Tutti i presenti', count: this.items().length }]
      : [{ id: 'richiesto', label: 'In attesa', count: inAttesa }, { id: 'effettuato', label: 'Reset fatti', count: fatti }, { id: 'all', label: 'Tutti i presenti', count: this.items().length }]);
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
