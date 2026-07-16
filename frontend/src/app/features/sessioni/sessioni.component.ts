import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
          Stai vedendo un bando locale per cui non risulti segretario. Lo scarico candidati non e disponibile da questa vista.
        </div>
      }

      @if (bando() && !bando()!.configured) {
        <div class="alert alert-warning d-flex align-items-center py-2 mb-3" role="alert">
          <span class="flex-grow-1">
            <strong>Bando non configurato.</strong>
            Il referente deve completare i riferimenti operativi del bando. Puoi gestire la sessione dalla scheda azioni.
          </span>
          @if (canConfigureBando()) {
            <a [routerLink]="['/bandi', commissionId, 'config']" class="btn btn-sm btn-warning ms-3 text-nowrap">
              Configura Bando
            </a>
          }
        </div>
      } @else if (bando()?.configured && canConfigureBando()) {
        <div class="d-flex justify-content-end mb-2">
          <a [routerLink]="['/bandi', commissionId, 'config']" class="btn btn-sm btn-outline-secondary">
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

  constructor() {
    this.bandiService.detail(this.commissionId).subscribe({
      next: (bando) => this.bando.set(bando),
      error: () => this.error.set('Impossibile caricare il dettaglio del bando.'),
    });
    this.reload(false);
  }

  reload(sync = false): void {
    this.loading.set(true);
    this.error.set(null);
    if (sync) {
      this.service.sync(this.commissionId).subscribe({
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
    this.service.list(this.commissionId).subscribe({
      next: ({ items }) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        if (!preserveError) {
          this.error.set('Impossibile caricare le sessioni.');
        }
        this.loading.set(false);
      },
    });
  }
}
