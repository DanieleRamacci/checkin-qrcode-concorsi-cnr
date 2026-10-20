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
import { competitionLabel } from '../../shared/competition-label';
import { isSessionPast, isSessionToday, sessionDateKey, sessionDateLabel } from '../../shared/session-date';

@Component({
  selector: 'app-sessioni',
  imports: [RouterLink, FormsModule, FilterChipsComponent, PagerComponent],
  template: `
    <div class="container py-4 py-lg-5">
      <nav class="breadcrumb-container" aria-label="Percorso di navigazione"><ol class="breadcrumb p-0 mb-2">
        <li class="breadcrumb-item">
          @if (mode === 'admin') { <a routerLink="/bandi" [queryParams]="{ mode: 'admin' }">Tutti i bandi</a> }
          @else { <a routerLink="/bandi" [queryParams]="{ mode: mode }">I miei concorsi</a> }
          <span class="separator">/</span>
        </li>
        <li class="breadcrumb-item active" aria-current="page">{{ title() }}</li>
      </ol></nav>
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
        <div>
          <h1 class="mb-1">{{ title() }}</h1>
          <p class="mb-0 text-secondary">{{ items().length }} {{ items().length === 1 ? 'sessione' : 'sessioni' }} ·
            <button type="button" class="btn btn-link p-0 align-baseline fw-semibold" [disabled]="loading()" (click)="reload(true)">Aggiorna da Selezioni Online</button></p>
        </div>
        <div class="d-flex flex-wrap align-items-center gap-3">
          <a class="fw-semibold" [routerLink]="['/bandi', commissionId, 'detail']" [queryParams]="{ mode: mode }">Dettaglio bando</a>
          <a class="btn btn-outline-primary" [routerLink]="['/bandi', commissionId, 'config']" [queryParams]="{ returnUrl: currentUrl() }">Configura bando</a>
        </div>
      </div>

      @if (syncing()) {
        <div class="alert alert-info" role="status">
          <div class="d-flex align-items-center gap-3">
            <div class="progress-spinner progress-spinner-active size-sm"><span class="visually-hidden">Caricamento</span></div>
            <span><strong>Scarico le sessioni da Selezioni Online…</strong> L’elenco si aggiorna da solo al termine.</span>
          </div>
        </div>
      }
      @if (bando()?.visibility_reason === 'admin') {
        <div class="alert alert-warning" role="note"><strong>Vista amministratore.</strong> Non risulti assegnato a questo bando con il profilo operativo richiesto.</div>
      }
      @if (configWarning(); as warning) {
        <div class="alert alert-warning" role="status">
          <strong>{{ warning.title }}</strong> {{ warning.text }} <a [routerLink]="['/bandi', commissionId, 'config']" [queryParams]="{ returnUrl: currentUrl() }">Configura bando</a>.
        </div>
      }
      @if (syncError()) {
        <div class="alert alert-warning" role="alert">
          <strong>Scarico delle sessioni non riuscito.</strong> {{ syncError() }}
          @if (items().length > 0) { Stai vedendo le sessioni già salvate nell’app. } @else { Non ci sono ancora sessioni salvate nell’app. }
        </div>
      }

      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      } @else if (loading() && items().length === 0) {
        <p class="d-flex align-items-center gap-2 py-3" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Carico le sessioni…</p>
      } @else if (items().length === 0) {
        <div class="app-empty bg-white" role="status">
          <p class="fw-semibold mb-1">Nessuna sessione nell’app per questo concorso</p>
          <p class="text-secondary mb-3">Scarica le sessioni del bando da Selezioni Online per iniziare.</p>
          <button type="button" class="btn btn-primary" [disabled]="loading()" (click)="reload(true)">Scarica sessioni da Selezioni Online</button>
        </div>
      } @else {
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <app-filter-chips label="Filtra sessioni" [options]="dateFilterOptions()" [selected]="dateFilter()" (selectedChange)="setDateFilter($event)" />
          <div class="form-group mb-0 app-search"><label for="cs" class="active">Cerca sessione</label>
            <input type="search" class="form-control" id="cs" placeholder="Nome, sede o data" [ngModel]="query()" (ngModelChange)="setQuery($event)" /></div>
        </div>
        <div class="card card-bg no-after"><div class="card-body p-0">
          <div class="table-responsive"><table class="table align-middle mb-0 app-table">
            <thead><tr><th scope="col">Data</th><th scope="col">Sessione</th><th scope="col">Stato</th><th scope="col">Presenti</th><th scope="col" class="text-end"><span class="visually-hidden">Azioni</span></th></tr></thead>
            <tbody>
              @for (item of pageItems(); track item.session_id) {
                <tr [class.app-row-today]="isToday(item.date)">
                  <td class="app-num-cell"><strong>{{ italianDate(item.date) }}</strong><br>{{ item.time.slice(0, 5) }}@if (isToday(item.date)) { <span class="badge bg-primary ms-1">Oggi</span> }</td>
                  <td><a class="fw-semibold" [routerLink]="['/sessioni', item.session_id]" [queryParams]="{ mode: mode }">{{ item.name }}</a><br><span class="small text-secondary">{{ item.location }}</span></td>
                  <td>
                    <div class="app-phasebar" role="img" [attr.aria-label]="'Fase ' + phaseOf(item.current_state) + ' di 4'">
                      @for (phase of phases; track phase) { <span [class.is-done]="phaseDone(item.current_state, phase)" [class.is-current]="phaseCurrent(item.current_state, phase) && item.current_state !== 'iniziale'" [class.is-current-light]="phaseCurrent(item.current_state, phase) && item.current_state === 'iniziale'"></span> }
                    </div>
                    <div class="mt-1"><strong [class.text-success]="finished(item.current_state)">{{ stateLabel(item.current_state) }}</strong>
                      @if (nextStep(item.current_state)) { <br><span class="small">{{ nextStep(item.current_state) }}</span> }</div>
                  </td>
                  <td class="app-num-cell">{{ presentLabel(item) }}</td>
                  <td class="text-end"><a class="btn btn-sm" [class.btn-primary]="isToday(item.date)" [class.btn-outline-primary]="!isToday(item.date)" [routerLink]="['/sessioni', item.session_id]" [queryParams]="{ mode: mode }">Apri sessione</a></td>
                </tr>
              } @empty { <tr><td colspan="5" class="text-secondary">Nessuna sessione corrisponde ai filtri.</td></tr> }
            </tbody>
          </table></div>
        </div></div>
        <app-pager label="Sessioni" [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="setPageSize($event)" />
      }
    </div>
  `,
})
export class SessioniComponent {
  readonly competitionLabel = competitionLabel;
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
  private autoSyncDone = false;
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
    }).sort((a, b) => {
      // Oggi e le prossime in ordine di data, poi le passate dalla più recente (prototipo sessioni.html).
      const aPast = this.isPast(a.date), bPast = this.isPast(b.date);
      if (aPast !== bPast) return aPast ? 1 : -1;
      const order = this.dateKey(a.date).localeCompare(this.dateKey(b.date)) || a.time.localeCompare(b.time);
      return aPast ? -order : order;
    });
  });
  readonly pageItems = computed(() => this.filteredItems().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));

  readonly title = computed(() => {
    const label = competitionLabel(this.bando()?.title, this.commissionId);
    return label === 'Concorso' ? 'Sessioni del concorso' : label;
  });

  /** Un solo avviso con la soluzione (FR-024): prima gli esperti remoti mancanti, poi i dati del bando. */
  readonly configWarning = computed(() => {
    const bando = this.bando();
    if (!bando) return null;
    const missing = Number(bando.session_count || 0) - Number(bando.remote_expert_assigned_count || 0);
    if (missing > 0) {
      return { title: `${missing} ${missing === 1 ? 'sessione' : 'sessioni'} senza esperto remoto.`, text: 'Puoi indicarlo all’apertura della sessione oppure ora da' };
    }
    if (!bando.configured || bando.required_data_complete === false) {
      return { title: 'Configurazione del bando da completare.', text: 'Mancano dati richiesti per le liste: completali da' };
    }
    return null;
  });

  currentUrl(): string {
    return this.router.url;
  }

  setQuery(value: string): void { this.query.set(value); this.page.set(0); }
  setDateFilter(value: string): void { this.dateFilter.set(value as 'upcoming' | 'past' | 'all'); this.page.set(0); }
  setPageSize(value: number): void { this.pageSize.set(value); this.page.set(0); }
  stateLabel(state: string): string { return sessionStateLabel(state); }
  phaseOf(state: string): number { return sessionStateInfo(state).phase; }
  /** Liste inviate chiude la fase 3, esame concluso la fase 4. */
  finished(state: string): boolean { return state === 'liste_inviate' || state === 'esame_concluso'; }
  phaseDone(state: string, phase: number): boolean { return phase < this.phaseOf(state) || (this.finished(state) && phase === this.phaseOf(state)); }
  phaseCurrent(state: string, phase: number): boolean { return phase === this.phaseOf(state) && !this.finished(state); }
  italianDate(value: string): string { return sessionDateLabel(value); }
  /** "— / 4" prima del check-in: i presenti si contano solo da quando è avviato. */
  presentLabel(item: SessionSummary): string {
    const started = this.phaseOf(item.current_state) >= 2;
    return `${started ? item.checked_in_count : '—'} / ${item.candidate_count || '—'}`;
  }
  nextStep(state: string): string { const action = sessionStateInfo(state).actions.segretario?.action; return action ? `prossimo passo: ${action.toLocaleLowerCase()}` : ''; }
  isToday(value: string): boolean { return isSessionToday(value); }
  isPast(value: string): boolean { return isSessionPast(value); }
  private dateKey(value: string): string { return sessionDateKey(value); }

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
        // Concorso aperto per la prima volta dal segretario: le sessioni si scaricano da sole, una volta.
        if (!items.length && this.mode === 'segretario' && !this.autoSyncDone) {
          this.autoSyncDone = true;
          this.reload(true);
        }
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
