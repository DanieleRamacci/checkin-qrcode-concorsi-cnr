import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReferenteBandoSummary } from '../../core/models/api.models';
import { FilterChipOption, FilterChipsComponent } from '../../shared/filter-chips.component';
import { PagerComponent } from '../../shared/pager.component';
import { BandiService } from './bandi.service';
import { competitionLabel } from '../../shared/competition-label';
import { isBandoComplete } from './bando-completeness';

@Component({
  selector: 'app-referente-bandi',
  imports: [FormsModule, RouterLink, FilterChipsComponent, PagerComponent],
  template: `
    <div class="container py-4 py-lg-5">
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
        <div>
          <h1 class="mb-1">I bandi di cui sei referente</h1>
          <p class="mb-0 text-secondary">Bandi in cui Selezioni Online ti indica come RDP o referente. {{ syncLine() }} ·
            <button type="button" class="btn btn-link p-0 align-baseline fw-semibold" [disabled]="syncing()" (click)="refreshRemote()">Aggiorna ora</button></p>
        </div>
      </div>
      @if (syncing()) {
        <div class="alert alert-info" role="status">
          <div class="d-flex align-items-center gap-3">
            <div class="progress-spinner progress-spinner-active size-sm"><span class="visually-hidden">Caricamento</span></div>
            <span><strong>Aggiornamento da Selezioni Online…</strong> Intanto vedi i bandi già salvati nell’app.</span>
          </div>
        </div>
      }
      @if (syncError()) { <div class="alert alert-warning" role="alert">{{ syncError() }}</div> }

      @if (loading()) {
        <p class="d-flex align-items-center gap-2 py-3" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Carico i bandi…</p>
      } @else if (error()) {
        <div class="alert alert-warning" role="alert"><strong>Bandi non disponibili.</strong> {{ error() }}</div>
      } @else if (items().length === 0) {
        <div class="app-empty bg-white" role="status">
          <p class="fw-semibold mb-1">{{ syncing() ? 'Cerco i tuoi bandi su Selezioni Online…' : 'Nessun bando come referente' }}</p>
          <p class="mb-0 text-secondary">Non risultano bandi per cui la tua utenza è indicata come RDP o referente.</p>
        </div>
      } @else {
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <app-filter-chips label="Filtra bandi" [options]="filterOptions()" [selected]="filter()" (selectedChange)="setFilter($event)" />
          <div class="form-group mb-0 app-search"><label for="rq" class="active">Cerca concorso</label>
            <input type="search" class="form-control" id="rq" placeholder="Codice o titolo" [ngModel]="query()" (ngModelChange)="query.set($event); page.set(0)" /></div>
        </div>
        <div class="card card-bg no-after"><div class="card-body p-0"><div class="table-responsive"><table class="table align-middle mb-0 app-table">
          <thead><tr><th scope="col">Concorso</th><th scope="col">RDP</th><th scope="col">Configurazione</th><th scope="col" class="text-end"><span class="visually-hidden">Azioni</span></th></tr></thead>
          <tbody>
            @for (bando of pageItems(); track bando.commission_id) {
              <tr>
                <td><a class="fw-semibold" [routerLink]="['/bandi', bando.commission_id, 'config']" [queryParams]="{ returnUrl: '/referenti/bandi' }">{{ competitionLabel(bando.title, bando.commission_id) }}</a></td>
                <td>@if ((bando.rdp_names ?? []).length) { {{ (bando.rdp_names ?? []).join(', ') }} } @else { <span class="text-secondary">Dato non disponibile</span> }</td>
                <td>
                  <span [class]="'badge app-badge-' + status(bando).tone">{{ status(bando).label }}</span>
                  <div class="small mt-1">Esperto remoto: <strong>{{ expertProgress(bando) }}</strong></div>
                  <div class="small">Informatico in sede: <strong>{{ progress(bando.sede_technician_assigned_count, bando.session_count) }}</strong></div>
                  <div class="small">Dati del bando: <strong>{{ bando.required_data_complete ? 'compilati' : 'da completare' }}</strong></div>
                  @if (!isComplete(bando) && (bando.incomplete_session_names ?? []).length) {
                    <div class="small text-warning-emphasis">Manca in: {{ (bando.incomplete_session_names ?? []).join(', ') }}</div>
                  }
                </td>
                <td class="text-end">
                  <a [class]="'btn ' + (isComplete(bando) ? 'btn-outline-primary' : 'btn-primary')" [routerLink]="['/bandi', bando.commission_id, 'config']" [queryParams]="{ returnUrl: '/referenti/bandi' }">{{ isComplete(bando) ? 'Rivedi' : 'Completa configurazione' }}</a>
                </td>
              </tr>
            } @empty { <tr><td colspan="4" class="text-secondary">Nessun bando corrisponde alla ricerca.</td></tr> }
          </tbody>
        </table></div></div></div>
        <app-pager label="Bandi" [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="setPageSize($event)" />
      }
    </div>
  `,
})
export class ReferenteBandiComponent {
  readonly competitionLabel = competitionLabel;
  private readonly service = inject(BandiService);
  readonly items = signal<ReferenteBandoSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly syncing = signal(false);
  readonly syncError = signal<string | null>(null);
  readonly query = signal('');
  readonly filter = signal('incomplete');
  readonly page = signal(0);
  readonly pageSize = signal(10);
  readonly filterOptions = computed<FilterChipOption[]>(() => [
    { id: 'incomplete', label: 'Da completare', count: this.items().filter((bando) => !this.isComplete(bando)).length },
    { id: 'complete', label: 'Completi', count: this.items().filter((bando) => this.isComplete(bando)).length },
    { id: 'all', label: 'Tutti', count: this.items().length },
  ]);
  readonly filteredItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.items().filter((bando) => {
      const matchesFilter = this.filter() === 'all' || (this.filter() === 'complete' ? this.isComplete(bando) : !this.isComplete(bando));
      const matchesQuery = !q || [bando.title, bando.commission_id, ...(bando.rdp_names ?? []), ...(bando.incomplete_session_names ?? [])].some((value) => value.toLowerCase().includes(q));
      return matchesFilter && matchesQuery;
    });
  });
  readonly pageItems = computed(() => this.filteredItems().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));

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

  refreshRemote(): void {
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

  isComplete(bando: ReferenteBandoSummary): boolean { return isBandoComplete(bando); }

  status(bando: ReferenteBandoSummary): { label: string; tone: 'success' | 'warning' | 'neutral' } {
    if (!Number(bando.session_count || 0)) return { label: 'Nessuna sessione', tone: 'neutral' };
    return this.isComplete(bando) ? { label: 'Configurazione completa', tone: 'success' } : { label: 'Da completare', tone: 'warning' };
  }

  /** "2 su 3 sessioni"; senza sessioni "—". */
  progress(done: number | undefined, total: number | undefined): string {
    const sessions = Number(total || 0);
    return sessions ? `${Number(done || 0)} su ${sessions} sessioni` : '—';
  }

  syncLine(): string {
    const latest = this.items().map((bando) => bando.last_sync).filter((value): value is string => !!value).sort().at(-1);
    const date = latest ? new Date(latest) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Dati da Selezioni Online';
    const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return `Dati aggiornati ${new Date().toDateString() === date.toDateString() ? 'oggi' : 'il ' + date.toLocaleDateString('it-IT')} alle ${time}.`;
  }
  setFilter(value: string): void { this.filter.set(value); this.page.set(0); }
  setPageSize(value: number): void { this.pageSize.set(value); this.page.set(0); }

  /**
   * `expert_assigned` può essere vero anche con 0 su N (esperto indicato a
   * livello di bando prima dell'import delle sessioni): non mostrarlo come mancante.
   */
  expertProgress(bando: ReferenteBandoSummary): string {
    const total = Number(bando.session_count || 0);
    const count = Number(bando.remote_expert_assigned_count || 0);
    if (!total) return bando.expert_assigned ? 'assegnato' : '—';
    return count === 0 && bando.expert_assigned ? `${count} su ${total} sessioni (assegnato a livello di bando)` : `${count} su ${total} sessioni`;
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
