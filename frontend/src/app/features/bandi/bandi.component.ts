import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BandoSummary } from '../../core/models/api.models';
import { AuthService } from '../../core/auth.service';
import { BandiService } from './bandi.service';
import { competitionLabel } from '../../shared/competition-label';
import { BandiTableComponent, bandiSyncLine } from './bandi-table.component';

@Component({
  selector: 'app-bandi',
  imports: [RouterLink, FormsModule, BandiTableComponent],
  template: `
    @if (auth.user()?.dev_mode) {
      <div class="alert alert-warning d-flex align-items-center gap-2 mb-0 rounded-0 py-2" role="alert">
        <strong>⚠ DEVELOPER MODE</strong> — Sessioni non attive abilitate, controlli temporali disabilitati.
      </div>
    }
    @if (isSecretaryMode() || isAdminMode()) {
      <div class="container py-4 py-lg-5">
        <nav class="breadcrumb-container" aria-label="Percorso di navigazione"><ol class="breadcrumb p-0 mb-2">
          @if (isAdminMode()) {
            <li class="breadcrumb-item"><a routerLink="/admin">Amministrazione</a><span class="separator">/</span></li>
          } @else {
            <li class="breadcrumb-item"><a routerLink="/">Home</a><span class="separator">/</span></li>
          }
          <li class="breadcrumb-item active" aria-current="page">{{ dashboardTitle() }}</li>
        </ol></nav>
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <div>
            <h1 class="mb-1">{{ dashboardTitle() }}</h1>
            <p class="mb-0 text-secondary">{{ syncLine() }} ·
              <button type="button" class="btn btn-link p-0 align-baseline fw-semibold" [disabled]="syncing()" (click)="reload()">Aggiorna ora</button></p>
          </div>
        </div>
        @if (syncing()) {
          <div class="alert alert-info" role="status">
            <div class="d-flex align-items-center gap-3">
              <div class="progress-spinner progress-spinner-active size-sm"><span class="visually-hidden">Caricamento</span></div>
              <span><strong>Aggiornamento da Selezioni Online…</strong> Puoi continuare a lavorare: l’elenco si aggiorna da solo.</span>
            </div>
          </div>
        }
        @if (isAdminMode()) {
          <div class="alert alert-warning" role="note"><strong>Vista amministratore.</strong> Vedi tutti i bandi presenti nell’app; quelli marcati “Solo vista admin” non sono collegati al tuo utente come membro operativo.</div>
        }
        @if (syncError()) {
          <div class="alert alert-warning" role="alert">
            <strong>Aggiornamento da Selezioni Online non riuscito.</strong> {{ syncError() }}
            @if (hasLocalItems()) { Stai vedendo i dati già salvati nell’app. } @else { Non ci sono ancora dati salvati: riprova quando Selezioni Online risponde. }
          </div>
        }
        @if (loading() && !hasLocalItems()) {
          <p class="d-flex align-items-center gap-2 py-3" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Carico i concorsi…</p>
        } @else if (error()) {
          <div class="alert alert-danger" role="alert">{{ error() }}</div>
        } @else if (items().length === 0) {
          <div class="app-empty bg-white" role="status">
            <p class="fw-semibold mb-1">{{ emptyTitle() }}</p>
            <p class="text-secondary mb-3">{{ emptyMessage() }}</p>
            <button type="button" class="btn btn-primary" [disabled]="syncing()" (click)="reload()">{{ emptyActionLabel() }}</button>
          </div>
        } @else {
          <app-bandi-table [items]="items()" [mode]="mode" />
          <div class="accordion mt-4">
            <div class="accordion-item">
              <h2 class="accordion-header" id="faq-h"><button class="accordion-button" [class.collapsed]="!helpOpen()" type="button" [attr.aria-expanded]="helpOpen()" aria-controls="faq-c" (click)="helpOpen.set(!helpOpen())">Non trovi un concorso?</button></h2>
              <div id="faq-c" class="accordion-collapse collapse" [class.show]="helpOpen()" role="region" aria-labelledby="faq-h">
                <div class="accordion-body">Per vedere un bando il tuo nominativo deve essere collegato alla commissione e abilitato su Selezioni Online. Se l’hai appena ottenuto usa “Aggiorna ora” in alto, altrimenti contatta il referente del procedimento.
                  @if (auth.hasCapability('admin')) { L’amministratore può consultare i dati locali da “Tutti i bandi” anche quando non è collegato al bando come membro operativo. }</div>
              </div>
            </div>
          </div>
        }
      </div>
    } @else {
      <!-- Vecchie viste per modalità tecniche e referente: le home di questi profili sono altrove (Le mie sessioni, Bandi da referente). -->
      <div class="container my-5">
        <h1 class="mb-4">{{ dashboardTitle() }}</h1>
        <p class="lead">{{ dashboardLead() }}</p>
        @if (isTechnicalMode() && hasAdminSupportItems()) {
          <div class="alert alert-warning" role="note"><strong>Vista admin di supporto.</strong> I bandi marcati come vista admin non risultano assegnati al profilo operativo selezionato.</div>
        }
        @if (loading() && !hasLocalItems()) {
          <p role="status" aria-live="polite">Carico i bandi…</p>
        } @else if (error()) {
          <div class="alert alert-danger" role="alert">{{ error() }}</div>
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
  readonly helpOpen = signal(false);
  readonly query = signal('');
  /** Ricerca della vista per le modalità tecniche; la tabella del segretario ha la sua. */
  readonly filteredItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.items().filter((bando) => !q || `${bando.title} ${bando.commission_id}`.toLowerCase().includes(q));
  });
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

  syncLine(): string {
    return bandiSyncLine(this.items());
  }

  currentUrl(): string {
    return this.router.url;
  }

  constructor() {
    this.loadItems();
  }

  onQueryChange(query: string): void { this.query.set(query); }

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
      next: (response) => {
        this.applyResponse(response);
        // I concorsi del segretario si aggiornano da Selezioni Online all'apertura (al massimo ogni 10 minuti).
        if (this.isSecretaryMode() && this.service.secretarySyncDue()) this.reload();
      },
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
