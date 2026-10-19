import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BandoSummary } from '../../core/models/api.models';
import { AuthService } from '../../core/auth.service';
import { BandiService } from './bandi.service';
import { FilterChipsComponent, FilterChipOption } from '../../shared/filter-chips.component';
import { PagerComponent } from '../../shared/pager.component';
import { competitionLabel } from '../../shared/competition-label';

@Component({
  selector: 'app-bandi',
  imports: [RouterLink, FormsModule, FilterChipsComponent, PagerComponent],
  template: `
    @if (auth.user()?.dev_mode) {
      <div class="alert alert-warning d-flex align-items-center gap-2 mb-0 rounded-0 py-2" role="alert">
        <strong>⚠ DEVELOPER MODE</strong> — Sessioni non attive abilitate, controlli temporali disabilitati.
      </div>
    }
    <div class="container my-5">
      <h1 class="mb-4">{{ dashboardTitle() }}</h1>
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <p class="lead mb-0">{{ dashboardLead() }}</p>
        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          [disabled]="loading()"
          (click)="reload()"
        >
          @if (loading()) {
            <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
          }
          <span>Aggiorna da Selezioni Online</span>
        </button>
      </div>

      @if (isAdminMode()) {
        <div class="alert alert-warning" role="note">
          <strong>Vista amministratore.</strong>
          Stai vedendo i bandi presenti nel database locale. I bandi marcati come
          "Solo vista admin" non risultano collegati al tuo utente come membro operativo nei dati locali.
        </div>
      }

      @if (isTechnicalMode() && hasAdminSupportItems()) {
        <div class="alert alert-warning" role="note">
          <strong>Vista admin di supporto.</strong>
          I bandi marcati come vista admin non risultano assegnati al profilo operativo selezionato.
        </div>
      }

      @if (syncError()) {
        <div class="alert alert-warning" role="alert">
          <h2 class="alert-heading h5 mb-2">Sincronizzazione commissioni non riuscita</h2>
          <div><strong>Motivo:</strong> {{ syncError() }}</div>
          @if (syncSource() === 'db_cache' || syncSource() === 'db_fallback') {
            @if (hasLocalItems()) {
              <div class="mt-1">Stai visualizzando i dati locali in cache.</div>
            } @else {
              <div class="mt-1">Non ci sono ancora dati locali da mostrare. Riprova la sincronizzazione quando Selezioni Online risponde.</div>
            }
          }
        </div>
      }

      @if (loading() && !hasLocalItems()) {
        <div class="d-flex align-items-center gap-2 py-3" role="status" aria-live="polite">
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <span>Caricamento bandi…</span>
        </div>
      } @else if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      } @else {
        @if (items().length === 0) {
          <div class="empty-state border rounded p-4 p-md-5 text-center" role="status">
            <h2 class="h4 mb-2">{{ emptyTitle() }}</h2>
            <p class="text-muted mb-4">{{ emptyMessage() }}</p>
            <button type="button" class="btn btn-primary" [disabled]="loading()" (click)="reload()">
              {{ emptyActionLabel() }}
            </button>
            @if (isSecretaryMode() || isAdminMode()) {
              <p class="small text-muted mt-3 mb-0">
                La prima sincronizzazione puo richiedere fino al timeout configurato per Selezioni Online.
              </p>
            }
          </div>
        } @else {
          @if (isSecretaryMode()) {
            <p class="small text-muted">Dati da Selezioni Online · <button type="button" class="btn btn-link btn-sm p-0" [disabled]="syncing()" (click)="reload()">Aggiorna ora</button></p>
            @if (syncing()) { <p class="small" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Aggiornamento in corso…</p> }
            <div class="row g-3 mb-3 align-items-end"><div class="col-12 col-md-8"><label for="filtro-concorso-dashboard" class="form-label">Cerca concorso</label><input id="filtro-concorso-dashboard" type="search" class="form-control" placeholder="Cerca per nome o codice…" [ngModel]="query()" (ngModelChange)="onQueryChange($event)" /></div><div class="col-12 col-md-4"><label for="ordina-concorsi" class="form-label">Ordina</label><select id="ordina-concorsi" class="form-select" [ngModel]="bandoSort()" (ngModelChange)="setBandoSort($event)"><option value="session">Prossima sessione</option><option value="name">Nome concorso</option></select></div></div>
            <app-filter-chips label="Filtra i concorsi" [options]="bandoFilterOptions()" [selected]="bandoFilter()" (selectedChange)="setBandoFilter($event)" />
            <div class="table-responsive mt-3"><table class="table table-striped table-hover">
              <thead><tr><th>Concorso</th><th>Prossima sessione</th><th>Sessioni</th><th>Configurazione</th><th>Azioni</th></tr></thead>
              <tbody>
                @for (bando of pageItems(); track bando.commission_id) {
                  <tr><th scope="row">{{ competitionLabel(bando.title, bando.commission_id) }}</th>
                    <td>@if (bando.next_session) { {{ bando.next_session.date }} · {{ bando.next_session.time }}<br /><span class="small text-muted">{{ bando.next_session.name }}</span> } @else { <span class="text-muted">Nessuna sessione in arrivo</span> }</td>
                    <td>{{ bando.session_count }}</td>
                    <td><span class="badge" [class.text-bg-success]="bando.configured && bando.required_data_complete !== false" [class.text-bg-warning]="!bando.configured || bando.required_data_complete === false">{{ bando.configured && bando.required_data_complete !== false ? 'Completa' : 'Da completare' }}</span></td>
                    <td class="d-flex flex-wrap gap-2">
                      @if (canConfigureBando()) { <a class="btn btn-sm btn-outline-primary" [routerLink]="['/bandi', bando.commission_id, 'config']" [queryParams]="{ returnUrl: currentUrl() }">Configura bando</a> }
                      <a class="btn btn-sm btn-primary" [routerLink]="['/bandi', bando.commission_id, 'sessioni']" [queryParams]="{ mode: mode }">Vedi sessioni</a>
                    </td>
                  </tr>
                } @empty { <tr><td colspan="5">Nessun concorso corrisponde ai filtri.</td></tr> }
              </tbody>
            </table></div>
            <app-pager label="Concorsi" [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="setPageSize($event)" />
            <details class="mt-4"><summary>Non trovi un concorso?</summary><p class="mt-2 mb-0">Verifica che la tua utenza sia collegata alla commissione e abilitata su Selezioni Online, poi aggiorna l’elenco.</p>@if (auth.hasCapability('admin')) { <p class="mt-2 mb-0">L’amministratore può consultare i dati locali anche quando non risulta collegato al bando come membro operativo.</p> }</details>
          } @else {
          <div class="mb-3">
            <label for="filtro-concorso-dashboard" class="form-label">Cerca concorso</label>
            <input
              id="filtro-concorso-dashboard"
              type="search"
              class="form-control"
              placeholder="Scrivi il nome del concorso..."
              [ngModel]="query()"
              (ngModelChange)="onQueryChange($event)"
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
                    <td>
                      <div class="d-flex flex-column gap-1">
                        <span>{{ competitionLabel(bando.title, bando.commission_id) }}</span>
                        @if (accessBadgeLabel(bando)) {
                          <span [class]="'badge align-self-start ' + accessBadgeClass(bando)">
                            {{ accessBadgeLabel(bando) }}
                          </span>
                        }
                        @if (bando.source_role && bando.source_role !== 'SEGRETARIO') {
                          <span class="badge text-bg-secondary align-self-start">Ruolo Selezioni: {{ bando.source_role }}</span>
                        }
                        @if (bando.access_active === false) {
                          <span class="badge text-bg-danger align-self-start">Accesso non confermato</span>
                        }
                      </div>
                    </td>
                    <td>
                      <a
                        class="btn btn-sm btn-primary"
                        [routerLink]="['/bandi', bando.commission_id, 'sessioni']"
                        [queryParams]="{ mode: mode }"
                      >
                        Vedi sessioni
                      </a>
                      @if (canConfigureBando()) {
                        <a
                          class="btn btn-sm btn-outline-primary ms-2"
                          [routerLink]="['/bandi', bando.commission_id, 'config']"
                          [queryParams]="{ returnUrl: currentUrl() }"
                        >
                          Configura bando
                        </a>
                      } @else {
                        <a
                          class="btn btn-sm btn-outline-secondary ms-2"
                          [routerLink]="['/bandi', bando.commission_id, 'detail']"
                          [queryParams]="{ mode: mode }"
                        >
                          Dettagli bando
                        </a>
                      }
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
        }
      }
    </div>

    @if (loading() && !hasLocalItems()) {
      <div class="loading-overlay" role="status" aria-live="polite" aria-busy="true">
        <div class="loading-panel text-center">
          <div class="spinner-border text-primary" aria-hidden="true"></div>
          <div class="fw-semibold mt-3">
            {{ syncing() ? 'Aggiornamento bandi da Selezioni Online…' : 'Caricamento bandi…' }}
          </div>
          <div class="small text-muted mt-1">Attendi il completamento dell'operazione.</div>
        </div>
      </div>
    }

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
export class BandiComponent {
  readonly competitionLabel = competitionLabel;
  private readonly service = inject(BandiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly mode = this.route.snapshot.queryParamMap.get('mode') ?? 'segretario';
  readonly items = signal<BandoSummary[]>([]);
  readonly loading = signal(true);
  readonly syncing = signal(false);
  readonly error = signal<string | null>(null);
  readonly syncError = signal<string | null>(null);
  readonly syncSource = signal<string | null>(null);
  readonly mobilePromptOpen = signal(true);
  readonly secretaryHelpOpen = signal(false);
  readonly query = signal('');
  readonly bandoFilter = signal<'upcoming' | 'incomplete' | 'all'>('all');
  readonly bandoSort = signal<'session' | 'name'>('session');
  readonly page = signal(0);
  readonly pageSize = signal(10);
  readonly bandoFilterOptions = computed<FilterChipOption[]>(() => [
    { id: 'upcoming', label: 'Con sessioni in arrivo', count: this.items().filter((b) => !!b.next_session).length },
    { id: 'incomplete', label: 'Da completare', count: this.items().filter((b) => !b.configured || b.required_data_complete === false).length },
    { id: 'all', label: 'Tutti', count: this.items().length },
  ]);
  readonly filteredItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.items().filter((bando) => {
      const matchesQuery = !q || `${bando.title} ${bando.commission_id}`.toLowerCase().includes(q);
      const matchesFilter = this.bandoFilter() === 'all'
        || (this.bandoFilter() === 'upcoming' ? !!bando.next_session : !bando.configured || bando.required_data_complete === false);
      return matchesQuery && matchesFilter;
    }).sort((a, b) => {
      if (this.bandoSort() === 'name') return a.title.localeCompare(b.title);
      const aDate = a.next_session ? `${a.next_session.date} ${a.next_session.time}` : '9999-99-99';
      const bDate = b.next_session ? `${b.next_session.date} ${b.next_session.time}` : '9999-99-99';
      return aDate.localeCompare(bDate) || a.title.localeCompare(b.title);
    });
  });
  readonly pageItems = computed(() => this.filteredItems().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));
  readonly hasAdminSupportItems = computed(() =>
    this.items().some((bando) => bando.visibility_reason === 'admin'),
  );
  readonly hasLocalItems = computed(() => this.items().length > 0);

  canConfigureBando(): boolean {
    return this.mode === 'referente' || this.auth.hasCapability('admin') || !!this.auth.user()?.dev_mode;
  }

  isSecretaryMode(): boolean {
    return this.mode === 'segretario';
  }

  isAdminMode(): boolean {
    return this.mode === 'admin';
  }

  isExpertMode(): boolean {
    return this.mode === 'expert' || this.mode === 'esperto';
  }

  isSedeMode(): boolean {
    return this.mode === 'sede';
  }

  isTechnicalMode(): boolean {
    return this.isExpertMode() || this.isSedeMode();
  }

  accessBadgeLabel(bando: BandoSummary): string {
    if (bando.visibility_reason === 'admin') {
      if (this.isExpertMode()) return 'Vista admin: non assegnato come esperto remoto';
      if (this.isSedeMode()) return 'Vista admin: non assegnato come informatico in sede';
      return 'Solo vista admin';
    }
    if (bando.visibility_reason === 'expert') return 'Esperto remoto assegnato';
    if (bando.visibility_reason === 'sede') return 'Informatico in sede assegnato';
    if (bando.visibility_reason === 'referente') return 'Referente/RDP';
    if (bando.visibility_reason === 'owner') return 'Segretario operativo';
    return '';
  }

  accessBadgeClass(bando: BandoSummary): string {
    if (bando.visibility_reason === 'admin') return 'text-bg-warning';
    if (bando.visibility_reason === 'referente') return 'text-bg-info';
    return 'text-bg-success';
  }

  dashboardTitle(): string {
    if (this.mode === 'admin') return 'Tutti i bandi';
    if (this.mode === 'expert' || this.mode === 'esperto' || this.mode === 'sede') return 'Le mie sessioni';
    if (this.mode === 'referente') return 'I bandi di cui sei referente';
    return 'I miei concorsi';
  }

  dashboardLead(): string {
    if (this.mode === 'expert' || this.mode === 'esperto') {
      return "Di seguito trovi l'elenco dei concorsi per cui sei assegnato come esperto remoto.";
    }
    if (this.mode === 'sede') {
      return "Di seguito trovi l'elenco dei concorsi per cui sei assegnato come informatico in sede.";
    }
    if (this.mode === 'referente') {
      return "Di seguito trovi l'elenco dei concorsi per cui sei autorizzato come referente.";
    }
    if (this.mode === 'admin') {
      return "Di seguito trovi tutti i concorsi già presenti nel database locale.";
    }
    return 'Consulta i concorsi assegnati e apri la prossima sessione.';
  }

  emptyMessage(): string {
    if (this.mode === 'segretario') {
      return 'Non ci sono ancora bandi locali per il tuo utente. Per iniziare, sincronizza i bandi da Selezioni Online.';
    }
    if (this.mode === 'admin') {
      return 'Non ci sono bandi nel database locale. Sincronizza da Selezioni Online o verifica che un utente operativo abbia già importato i propri bandi.';
    }
    if (this.isExpertMode()) {
      return 'Non risultano bandi assegnati al tuo profilo esperto remoto.';
    }
    if (this.isSedeMode()) {
      return 'Non risultano bandi con sessioni assegnate al tuo profilo informatico in sede.';
    }
    return 'Nessuna commissione disponibile.';
  }

  emptyTitle(): string {
    if (this.mode === 'segretario') return 'Nessun bando sincronizzato';
    if (this.mode === 'admin') return 'Nessun bando locale';
    if (this.isExpertMode()) return 'Nessun bando assegnato';
    if (this.isSedeMode()) return 'Nessuna sessione assegnata';
    return 'Nessuna commissione disponibile';
  }

  emptyActionLabel(): string {
    if (this.mode === 'segretario') return 'Sincronizza bandi da Selezioni Online';
    if (this.mode === 'admin') return 'Aggiorna bandi da Selezioni Online';
    return 'Ricarica elenco';
  }

  currentUrl(): string {
    return this.router.url;
  }

  constructor() {
    this.loadItems();
  }

  onQueryChange(query: string): void { this.query.set(query); this.page.set(0); }
  setBandoFilter(filter: string): void { this.bandoFilter.set(filter as 'upcoming' | 'incomplete' | 'all'); this.page.set(0); }
  setBandoSort(sort: string): void { this.bandoSort.set(sort as 'session' | 'name'); this.page.set(0); }
  setPageSize(size: number): void { this.pageSize.set(size); this.page.set(0); }

  reload(): void {
    this.loading.set(true);
    this.syncing.set(true);
    this.error.set(null);
    this.service.sync(this.mode).subscribe({
      next: (response) => this.applyResponse(response),
      error: (syncError) => {
        this.syncError.set(apiErrorText(syncError, 'Sincronizzazione commissioni non riuscita.'));
        this.syncSource.set('db_fallback');
        this.service.list(this.mode).subscribe({
          next: (response) => this.applyResponse(response, true),
          error: (listError) => {
            this.error.set(apiErrorText(listError, 'Impossibile caricare i bandi.'));
            this.loading.set(false);
            this.syncing.set(false);
          },
        });
      },
    });
  }

  private loadItems(): void {
    this.loading.set(true);
    this.syncing.set(false);
    this.error.set(null);
    this.syncError.set(null);
    this.syncSource.set(null);
    this.service.list(this.mode).subscribe({
      next: (response) => this.applyResponse(response),
      error: (error) => {
        this.error.set(apiErrorText(error, 'Impossibile caricare i bandi.'));
        this.loading.set(false);
        this.syncing.set(false);
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
    this.syncing.set(false);
  }
}

function apiErrorText(error: unknown, fallback: string): string {
  const httpError = error as {
    status?: number;
    message?: string;
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
