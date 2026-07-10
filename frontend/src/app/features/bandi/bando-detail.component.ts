import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BandoDetail, BandoPerson } from '../../core/models/api.models';
import { AuthService } from '../../core/auth.service';
import { BandiService } from './bandi.service';

@Component({
  selector: 'app-bando-detail',
  imports: [RouterLink],
  template: `
    <div class="container my-5" style="max-width: 860px;">
      <a [routerLink]="['/bandi', commissionId, 'sessioni']" class="btn btn-outline-secondary btn-sm mb-3">
        &larr; Torna alle sessioni
      </a>

      <h1 class="mb-1">Dettaglio Bando</h1>
      <p class="text-muted mb-4">
        Codice: <strong>{{ detail()?.title ?? commissionId }}</strong> &mdash;
        commission_id: <code>{{ commissionId }}</code>
      </p>

      @if (loading()) {
        <div class="d-flex align-items-center" role="status">
          <div class="spinner-border spinner-border-sm me-2" aria-hidden="true"></div>
          Caricamento dettaglio…
        </div>
      }
      @if (warning()) {
        <div class="alert alert-warning">{{ warning() }}</div>
      }
      @if (!loading() && rdps().length === 0 && commissioners().length === 0) {
        <div class="alert alert-warning">Nessun dato ricevuto dall'API per questo bando.</div>
      }

      @if (rdps().length > 0) {
        <div class="card mb-4">
          <div class="card-header bg-light py-2">
            <span class="fw-bold text-uppercase small text-primary">Responsabili del Procedimento (RDP)</span>
            <span class="badge bg-secondary ms-2">{{ rdps().length }}</span>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead class="table-light"><tr><th>Nome</th><th>Email</th><th>Email certificata</th><th>Matricola</th></tr></thead>
                <tbody>
                  @for (person of rdps(); track person.email ?? person.name ?? $index) {
                    <tr>
                      <td>{{ personName(person) }}</td>
                      <td>{{ person.email || '—' }}</td>
                      <td>{{ person.emailcertificatoperpuk || '—' }}</td>
                      <td>{{ person.matricola || '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      @if (commissioners().length > 0) {
        <div class="card mb-4">
          <div class="card-header bg-light py-2">
            <span class="fw-bold text-uppercase small text-primary">Componenti Commissione</span>
            <span class="badge bg-secondary ms-2">{{ commissioners().length }}</span>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead class="table-light"><tr><th>Nome</th><th>Email</th><th>Ruolo</th></tr></thead>
                <tbody>
                  @for (person of commissioners(); track person.email ?? person.name ?? $index) {
                    <tr>
                      <td>{{ personName(person) }}</td>
                      <td>{{ person.email || '—' }}</td>
                      <td>
                        @if (person.ruolo) {
                          <span [class]="roleBadge(person.ruolo)">{{ person.ruolo }}</span>
                        } @else { — }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      @if (canConfigureBando()) {
        <div class="text-end">
          <a [routerLink]="['/bandi', commissionId, 'config']" class="btn btn-primary btn-sm">
            Vai a Configura Bando
          </a>
        </div>
      }
    </div>
  `,
})
export class BandoDetailComponent {
  private readonly service = inject(BandiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly commissionId = this.route.snapshot.paramMap.get('commissionId') ?? '';
  readonly mode = this.route.snapshot.queryParamMap.get('mode') ?? 'segretario';
  readonly detail = signal<BandoDetail | null>(null);
  readonly rdps = signal<BandoPerson[]>([]);
  readonly commissioners = signal<BandoPerson[]>([]);
  readonly loading = signal(true);
  readonly warning = signal('');

  constructor() {
    this.service.detail(this.commissionId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.rdps.set(detail.rdps ?? []);
        this.commissioners.set(detail.commissioners ?? []);
        this.refreshMetadata();
      },
      error: () => {
        this.loading.set(false);
        this.warning.set('Impossibile caricare il dettaglio del bando.');
      },
    });
  }

  private refreshMetadata(): void {
    this.service.syncMetadata(this.commissionId).subscribe({
      next: (metadata) => {
        this.rdps.set(metadata.rdps);
        this.commissioners.set(metadata.commissioners);
        this.loading.set(false);
      },
      error: () => {
        this.warning.set('Aggiornamento remoto non disponibile: sono mostrati gli ultimi dati salvati.');
        this.loading.set(false);
      },
    });
  }

  personName(person: BandoPerson): string {
    return person.name || person.nome || `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || '—';
  }

  roleBadge(role: string): string {
    const color = role === 'PRESIDENTE' ? 'bg-primary' : role === 'SEGRETARIO' ? 'bg-success' : 'bg-secondary';
    return `badge ${color}`;
  }

  canConfigureBando(): boolean {
    return this.mode === 'referente' || this.auth.hasCapability('admin') || !!this.auth.user()?.dev_mode;
  }
}
