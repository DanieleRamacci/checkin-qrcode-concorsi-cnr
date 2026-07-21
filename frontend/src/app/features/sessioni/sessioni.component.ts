import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BandoDetail, SessionSummary } from '../../core/models/api.models';
import { AuthService } from '../../core/auth.service';
import { BandiService } from '../bandi/bandi.service';
import { SessioniService } from './sessioni.service';

@Component({
  selector: 'app-sessioni',
  imports: [RouterLink],
  template: `
    <div class="container my-5">
      <h1 class="mb-1">Sessioni – {{ bando()?.title ?? 'Concorso' }}</h1>
      <p class="text-muted">Elenco delle sessioni collegate al concorso selezionato.</p>

      <div class="d-flex gap-2 align-items-center mb-3">
        <a
          class="btn btn-outline-secondary btn-sm"
          [routerLink]="['/bandi', commissionId, 'detail']"
          [queryParams]="{ mode: mode }"
        >
          Dettaglio Bando
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
            <span class="small">Caricamento…</span>
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
              Configura Bando
            </a>
          }
        </div>
      } @else if (bando()?.configured && canConfigureBando()) {
        <div class="d-flex justify-content-end mb-2">
          <a [routerLink]="['/bandi', commissionId, 'config']" [queryParams]="{ returnUrl: currentUrl() }" class="btn btn-sm btn-outline-secondary">
            Modifica config bando
          </a>
        </div>
      }

      @if (bando() && (bando()!.commissioners || []).length === 0) {
        <div class="alert alert-warning py-2 mb-3" role="alert">
          Componenti di commissione non sincronizzati o non aggiornati.
        </div>
      }

      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      } @else if (!loading() && items().length === 0) {
        <div class="alert alert-warning mb-2">Nessuna sessione in archivio locale.</div>
      } @else if (!loading()) {
        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead class="table-light">
              <tr>
                <th>#</th>
                <th>Nome Sessione</th>
                <th>Luogo</th>
                <th>Data</th>
                <th>Ora</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track item.session_id; let i = $index) {
                <tr>
                  <th scope="row">{{ i + 1 }}</th>
                  <td>{{ item.name }}</td>
                  <td>{{ item.location }}</td>
                  <td>{{ item.date }}</td>
                  <td>{{ item.time }}</td>
                  <td>
                    <a class="btn btn-sm btn-primary" [routerLink]="['/sessioni', item.session_id]"
                      [queryParams]="{ mode: mode }">
                      Gestisci
                    </a>
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
  readonly error = signal<string | null>(null);

  canConfigureBando(): boolean {
    return this.mode === 'referente' || this.auth.hasCapability('admin') || !!this.auth.user()?.dev_mode;
  }

  currentUrl(): string {
    return this.router.url;
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
    this.error.set(null);
    if (sync) {
      this.service.sync(this.commissionId, this.mode).subscribe({
        next: () => this.loadItems(),
        error: () => {
          this.error.set('Sincronizzazione sessioni non riuscita; sono mostrati i dati locali.');
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
      },
      error: (error) => {
        if (!preserveError) {
          this.error.set(apiErrorText(error, 'Impossibile caricare le sessioni.'));
        }
        this.loading.set(false);
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
