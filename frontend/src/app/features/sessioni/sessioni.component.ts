import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BandoDetail, SessionSummary } from '../../core/models/api.models';
import { AuthService } from '../../core/auth.service';
import { BandiService } from '../bandi/bandi.service';
import { SessioniService } from './sessioni.service';
import { FilterChipsComponent, FilterChipOption } from '../../shared/filter-chips.component';
import { PagerComponent } from '../../shared/pager.component';
import { sessionStateInfo, sessionStateLabel } from '../../shared/session-states';

@Component({
  selector: 'app-sessioni',
  imports: [RouterLink, FormsModule, FilterChipsComponent, PagerComponent],
  template: `
    <div class="container my-5">
      <p class="small text-muted mb-1"><a routerLink="/bandi" [queryParams]="{ mode: mode }">I miei concorsi</a> / Concorso {{ commissionId }}</p>
      <h1 class="mb-1">Concorso {{ commissionId }}</h1>
      <p class="text-muted">{{ bando()?.title ?? 'Sessioni del concorso' }} · {{ items().length }} sessioni</p>

      <div class="d-flex gap-2 align-items-center mb-3">
        <a
          class="btn btn-outline-secondary btn-sm"
          [routerLink]="['/bandi', commissionId, 'detail']"
          [queryParams]="{ mode: mode }"
        >
          Dettaglio bando
        </a>
        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          [disabled]="loading()"
          (click)="reload(true)"
        >
          Aggiorna
        </button>
        @if (loading()) {
          <div class="d-flex align-items-center">
            <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
            <span class="small">{{ syncing() ? 'Sincronizzazione da Selezioni Online…' : 'Caricamento…' }}</span>
          </div>
        }
      </div>

      @if (bando()?.visibility_reason === 'admin') {
        <div class="alert alert-warning py-2 mb-3" role="alert">
          <strong>Vista amministratore.</strong>
          Stai usando un accesso di supporto su un bando per cui non risulti assegnato al profilo operativo richiesto.
        </div>
      }

      @if (bando() && !bando()!.configured) {
        <div class="alert alert-warning d-flex align-items-center py-2 mb-3" role="alert">
          <span class="flex-grow-1">
            <strong>Bando non configurato.</strong>
            Il referente deve completare i riferimenti operativi del bando. Puoi gestire la sessione dalla scheda azioni.
          </span>
          @if (canConfigureBando()) {
            <a [routerLink]="['/bandi', commissionId, 'config']" [queryParams]="{ returnUrl: currentUrl() }" class="btn btn-sm btn-warning ms-3 text-nowrap">
              Configura bando
            </a>
          }
        </div>
      } @else if (bando()?.configured && canConfigureBando()) {
        <div class="d-flex justify-content-end mb-2">
          <a [routerLink]="['/bandi', commissionId, 'config']" [queryParams]="{ returnUrl: currentUrl() }" class="btn btn-sm btn-outline-secondary">
            Configura bando
          </a>
        </div>
      }

      @if (bando() && (bando()!.commissioners || []).length === 0) {
        <div class="alert alert-warning py-2 mb-3" role="alert">
          Componenti di commissione non sincronizzati o non aggiornati.
        </div>
      }

      @if (syncError()) {
        <div class="alert alert-warning" role="alert">
          <h2 class="alert-heading h5 mb-2">Sincronizzazione sessioni non riuscita</h2>
          <div>{{ syncError() }}</div>
          @if (items().length > 0) {
            <div class="mt-1">Stai visualizzando le sessioni gia presenti in archivio locale.</div>
          } @else {
            <div class="mt-1">Non ci sono ancora sessioni locali da mostrare per questo bando.</div>
          }
        </div>
      }

      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      } @else if (!loading() && items().length === 0) {
        <div class="empty-state border rounded p-4 p-md-5 text-center" role="status">
          <h2 class="h4 mb-2">Nessuna sessione sincronizzata</h2>
          <p class="text-muted mb-4">
            Per iniziare scarica le sessioni di questo bando da Selezioni Online.
          </p>
          <button type="button" class="btn btn-primary" [disabled]="loading()" (click)="reload(true)">
            Scarica sessioni da Selezioni Online
          </button>
          <p class="small text-muted mt-3 mb-0">
            La prima sincronizzazione puo richiedere fino al timeout configurato per Selezioni Online.
          </p>
        </div>
      } @else if (!loading()) {
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <app-filter-chips label="Filtra sessioni" [options]="dateFilterOptions()" [selected]="dateFilter()" (selectedChange)="setDateFilter($event)" />
          <div class="form-group mb-0 flex-grow-1" style="max-width: 22rem"><label for="session-search">Cerca sessione</label><input id="session-search" class="form-control" type="search" placeholder="Nome, sede o data" [ngModel]="query()" (ngModelChange)="setQuery($event)" /></div>
        </div>
        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead class="table-light">
              <tr>
                <th>Data</th>
                <th>Sessione</th>
                <th>Stato</th>
                <th>Presenti</th>
                <th><span class="visually-hidden">Azioni</span></th>
              </tr>
            </thead>
            <tbody>
              @for (item of pageItems(); track item.session_id) {
                <tr [class.app-row-today]="isToday(item.date)">
                  <td><strong>{{ item.date }}</strong><br />{{ item.time }} @if (isToday(item.date)) { <span class="badge bg-primary ms-1">Oggi</span> }</td>
                  <td><a [routerLink]="['/sessioni', item.session_id]" [queryParams]="{ mode: mode }" class="fw-semibold">{{ item.name }}</a><br /><span class="small text-secondary">{{ item.location }}</span></td>
                  <td><div class="app-phasebar" role="img" [attr.aria-label]="'Fase ' + phaseOf(item.current_state) + ' di 4'">@for (phase of phases; track phase) { <span [class.is-done]="phase < phaseOf(item.current_state)" [class.is-current]="phase === phaseOf(item.current_state) && phase > 1" [class.is-current-light]="phase === phaseOf(item.current_state) && phase === 1"></span> }</div><div class="mt-1"><strong>{{ stateLabel(item.current_state) }}</strong><br /><span class="small">{{ nextStep(item.current_state) }}</span></div></td>
                  <td>{{ item.checked_in_count }} / {{ item.candidate_count || '—' }}</td>
                  <td class="text-end">
                    <a class="btn btn-sm" [class.btn-primary]="isToday(item.date)" [class.btn-outline-primary]="!isToday(item.date)" [routerLink]="['/sessioni', item.session_id]"
                      [queryParams]="{ mode: mode }">
                      Apri sessione
                    </a>
                  </td>
                </tr>
              } @empty { <tr><td colspan="5">Nessuna sessione corrisponde ai filtri.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager label="Sessioni" [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="setPageSize($event)" />
      }
    </div>

    @if (loading()) {
      <div class="loading-overlay" role="status" aria-live="polite" aria-busy="true">
        <div class="loading-panel text-center">
          <div class="spinner-border text-primary" aria-hidden="true"></div>
          <div class="fw-semibold mt-3">
            {{ syncing() ? 'Sincronizzazione sessioni da Selezioni Online…' : 'Caricamento sessioni…' }}
          </div>
          <div class="small text-muted mt-1">Attendi il completamento dell'operazione.</div>
        </div>
      </div>
    }
  `,
  styles: `
    .empty-state {
      max-width: 760px;
      margin: 2rem auto;
      background: #fff;
    }
    .loading-overlay {
      position: fixed;
      inset: 0;
      z-index: 2050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.72);
    }
    .loading-panel {
      width: min(92vw, 420px);
      border: 1px solid #d8e2ec;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 1rem 2.5rem rgba(23, 50, 77, 0.18);
      padding: 1.5rem;
    }
  `,
})
export class SessioniComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(SessioniService);
  private readonly bandiService = inject(BandiService);
  readonly auth = inject(AuthService);
  readonly commissionId = this.route.snapshot.paramMap.get('commissionId') ?? '';
  readonly mode = this.route.snapshot.queryParamMap?.get('mode') ?? 'segretario';
  readonly items = signal<SessionSummary[]>([]);
  readonly bando = signal<BandoDetail | null>(null);
  readonly loading = signal(true);
  readonly syncing = signal(false);
  readonly error = signal<string | null>(null);
  readonly syncError = signal<string | null>(null);
  readonly query = signal('');
  readonly dateFilter = signal<'upcoming' | 'past' | 'all'>('all');
  readonly page = signal(0);
  readonly pageSize = signal(10);
  readonly phases = [1, 2, 3, 4];
  readonly dateFilterOptions = computed<FilterChipOption[]>(() => [
    { id: 'upcoming', label: 'Da oggi in poi', count: this.items().filter((item) => !this.isPast(item.date)).length },
    { id: 'past', label: 'Passate', count: this.items().filter((item) => this.isPast(item.date)).length },
    { id: 'all', label: 'Tutte', count: this.items().length },
  ]);
  readonly filteredItems = computed(() => {
    const q = this.query().trim().toLocaleLowerCase();
    return this.items().filter((item) => {
      const matchesQuery = !q || `${item.name} ${item.location} ${item.date}`.toLocaleLowerCase().includes(q);
      const matchesDate = this.dateFilter() === 'all' || (this.dateFilter() === 'past' ? this.isPast(item.date) : !this.isPast(item.date));
      return matchesQuery && matchesDate;
    }).sort((a, b) => this.dateKey(a.date).localeCompare(this.dateKey(b.date)) || a.time.localeCompare(b.time));
  });
  readonly pageItems = computed(() => this.filteredItems().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));

  canConfigureBando(): boolean {
    return this.mode === 'referente' || this.auth.hasCapability('admin') || !!this.auth.user()?.dev_mode;
  }

  currentUrl(): string {
    return this.router.url;
  }

  setQuery(value: string): void { this.query.set(value); this.page.set(0); }
  setDateFilter(value: string): void { this.dateFilter.set(value as 'upcoming' | 'past' | 'all'); this.page.set(0); }
  setPageSize(value: number): void { this.pageSize.set(value); this.page.set(0); }
  stateLabel(state: string): string { return sessionStateLabel(state); }
  phaseOf(state: string): number { return sessionStateInfo(state).phase; }
  nextStep(state: string): string { const action = sessionStateInfo(state).actions.segretario?.action; return action ? `prossimo passo: ${action.toLocaleLowerCase()}` : ''; }
  isToday(value: string): boolean { return this.dateKey(value) === localDateKey(new Date()); }
  isPast(value: string): boolean { return this.dateKey(value) < localDateKey(new Date()); }
  private dateKey(value: string): string {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const italian = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return italian ? `${italian[3]}-${italian[2]}-${italian[1]}` : value;
  }

  constructor() {
    this.bandiService.detail(this.commissionId, this.mode).subscribe({
      next: (bando) => this.bando.set(bando),
      error: (error) => this.error.set(apiErrorText(error, 'Impossibile caricare il dettaglio del bando.')),
    });
    this.reload(false);
  }

  reload(sync = false): void {
    this.loading.set(true);
    this.syncing.set(sync);
    this.error.set(null);
    this.syncError.set(null);
    if (sync) {
      this.service.sync(this.commissionId, this.mode).subscribe({
        next: () => this.loadItems(),
        error: (error) => {
          this.syncError.set(apiErrorText(
            error,
            'Non e stato possibile scaricare le sessioni da Selezioni Online.',
          ));
          this.loadItems(true);
        },
      });
      return;
    }
    this.loadItems();
  }

  private loadItems(preserveError = false): void {
    this.service.list(this.commissionId, this.mode).subscribe({
      next: ({ items }) => {
        this.items.set(items);
        this.loading.set(false);
        this.syncing.set(false);
      },
      error: (error) => {
        if (!preserveError) {
          this.error.set(apiErrorText(error, 'Impossibile caricare le sessioni.'));
        }
        this.loading.set(false);
        this.syncing.set(false);
      },
    });
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

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
