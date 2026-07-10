import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { BandiService } from '../bandi/bandi.service';

@Component({
  selector: 'app-bando-config',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container my-5" style="max-width: 760px;">
      <a [routerLink]="['/bandi', id, 'sessioni']" class="btn btn-outline-secondary btn-sm mb-3">
        &larr; Torna alle sessioni
      </a>
      <h1 class="mb-1">Configura Bando</h1>
      <p class="text-muted mb-4">{{ title() }}</p>

      @if (message()) {
        <div [class]="'alert mb-3 ' + (messageIsError() ? 'alert-danger' : 'alert-success')" role="status">
          {{ message() }}
        </div>
      }
      @if (syncing()) {
        <div class="d-flex align-items-center mb-3" role="status">
          <div class="spinner-border spinner-border-sm me-2" aria-hidden="true"></div>
          Aggiornamento dati da Selezioni Online…
        </div>
      }
      @if (syncWarning()) {
        <div class="alert alert-warning mb-3">{{ syncWarning() }}</div>
      }

      <div class="card mb-4">
        <div class="card-header bg-light py-2 d-flex align-items-center gap-2">
          <span class="fw-bold text-uppercase small text-primary">Referente del procedimento</span>
          <span class="badge bg-warning text-dark small">Consigliato</span>
        </div>
        <div class="card-body">
          <label class="form-label small mb-1" for="email_referente">Email referente</label>
          <div class="input-group input-group-sm">
            @if (rdpOptions().length) {
              <select class="form-select" id="email_referente" name="email_referente"
                      [(ngModel)]="model['email_referente']">
                <option value="">Seleziona referente</option>
                @for (rdp of rdpOptions(); track rdp.email) {
                  <option [value]="rdp.email">{{ rdp.nome || rdp.email }} — {{ rdp.email }}</option>
                }
              </select>
            } @else {
              <input type="email" class="form-control" id="email_referente" name="email_referente"
                     [(ngModel)]="model['email_referente']" placeholder="es. nome.cognome@cnr.it" />
            }
            <button type="button" class="btn btn-outline-primary" [disabled]="busy()" (click)="requestConfiguration()">
              Salva &amp; invia richiesta
            </button>
          </div>
          <div class="form-text">Salva l'email e invia al referente un link a questa pagina.</div>
        </div>
      </div>

      <form (ngSubmit)="save()">
        <div class="card mb-3">
          <div class="card-header bg-light py-2 d-flex align-items-center gap-2">
            <span class="fw-bold text-uppercase small text-primary">Esperto informatico da remoto</span>
            <span class="badge bg-warning text-dark small">Consigliato</span>
          </div>
          <div class="card-body py-3">
            <label class="form-label small mb-1" for="email_esperto_remoto">Seleziona esperto</label>
            <select class="form-select" id="email_esperto_remoto" name="email_esperto_remoto"
                    [(ngModel)]="model['email_esperto_remoto']">
              <option value="">— nessuno —</option>
              @for (email of expertOptions(); track email) {
                <option [value]="email">{{ email }}</option>
              }
            </select>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header bg-light py-2">
            <span class="fw-bold text-uppercase small text-primary">Segretario e durata prova</span>
          </div>
          <div class="card-body row g-3">
            <div class="col-md-6">
              <label class="form-label" for="email_segretario">Email segretario</label>
              <input class="form-control" id="email_segretario" name="email_segretario" type="email"
                     [(ngModel)]="model['email_segretario']" />
            </div>
            <div class="col-md-6">
              <label class="form-label" for="telefono_segretario">Telefono segretario</label>
              <input class="form-control" id="telefono_segretario" name="telefono_segretario"
                     [(ngModel)]="model['telefono_segretario']" />
            </div>
            <div class="col-md-6">
              <label class="form-label" for="durata_prova_minuti">Durata prova in minuti</label>
              <input class="form-control" id="durata_prova_minuti" name="durata_prova_minuti" type="number" min="1"
                     [(ngModel)]="model['durata_prova_minuti']" />
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-header bg-light py-2 d-flex justify-content-between align-items-center">
            <span class="fw-bold text-uppercase small text-primary">Componenti commissione</span>
            <button type="button" class="btn btn-sm btn-outline-primary" (click)="addCommissioner()">Aggiungi</button>
          </div>
          <div class="card-body">
            @for (member of commissionMembers; track $index; let i = $index) {
              <div class="row g-2 mb-2">
                <div class="col-md-5">
                  <label class="visually-hidden" [for]="'member-name-' + i">Nome componente</label>
                  <input class="form-control" [id]="'member-name-' + i" [name]="'member-name-' + i"
                         [(ngModel)]="member.nome" placeholder="Nome e cognome" />
                </div>
                <div class="col-md-5">
                  <label class="visually-hidden" [for]="'member-email-' + i">Email componente</label>
                  <input class="form-control" [id]="'member-email-' + i" [name]="'member-email-' + i" type="email"
                         [(ngModel)]="member.email" placeholder="Email" />
                </div>
                <div class="col-md-2">
                  <button type="button" class="btn btn-outline-danger w-100" (click)="removeCommissioner(i)">Rimuovi</button>
                </div>
              </div>
            } @empty {
              <p class="text-muted small mb-0">Nessun componente inserito.</p>
            }
          </div>
        </div>

        <div class="d-flex justify-content-end gap-2">
          <a [routerLink]="['/bandi', id, 'sessioni']" class="btn btn-outline-secondary">Annulla</a>
          <button class="btn btn-primary" type="submit" [disabled]="busy()">Salva configurazione</button>
        </div>
      </form>
    </div>
  `,
})
export class BandoConfigComponent {
  private readonly api = inject(ApiClient);
  private readonly bandiService = inject(BandiService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('commissionId') ?? '';
  readonly message = signal('');
  readonly messageIsError = signal(false);
  readonly busy = signal(false);
  readonly syncing = signal(false);
  readonly syncWarning = signal('');
  readonly title = signal('');
  readonly expertOptions = signal<string[]>([]);
  readonly rdpOptions = signal<Array<{ nome: string; email: string }>>([]);
  model: Record<string, any> = {};
  commissionMembers: Array<{ nome: string; email: string }> = [];

  constructor() {
    this.loadConfig();
    this.api.get<{ title: string }>(`/bandi/${this.id}`).subscribe((data) => this.title.set(data.title));
    this.refreshMetadata();
  }

  private loadConfig(): void {
    this.api.get<Record<string, any>>(`/bandi/${this.id}/config`).subscribe((data) => {
      this.model = { ...data };
      this.expertOptions.set(data['expert_options'] ?? []);
      this.rdpOptions.set(data['rdp_options'] ?? []);
      this.commissionMembers = [...(data['commissione_members'] ?? [])];
    });
  }

  /** Mirror di routes/azioni.py:configura_bando (GET): ad ogni apertura pagina
   * aggiorna commissione_members/rdp_nomi/referente/segretario da Selezioni
   * Online, poi ricarica la configurazione unita coi dati freschi. */
  private refreshMetadata(): void {
    this.syncing.set(true);
    this.bandiService.syncMetadata(this.id).subscribe({
      next: () => {
        this.syncing.set(false);
        this.loadConfig();
      },
      error: () => {
        this.syncing.set(false);
        this.syncWarning.set('Aggiornamento remoto non disponibile: sono mostrati gli ultimi dati salvati.');
      },
    });
  }

  save(): void {
    this.busy.set(true);
    const payload: Record<string, any> = {
      ...this.model,
      commissione_members: this.commissionMembers,
    };
    delete payload['expert_options'];
    this.api.put(`/bandi/${this.id}/config`, payload).subscribe({
      next: () => {
        this.busy.set(false);
        this.messageIsError.set(false);
        this.message.set('Configurazione salvata.');
      },
      error: (err) => {
        this.busy.set(false);
        this.messageIsError.set(true);
        this.message.set(this.extractError(err));
      },
    });
  }

  requestConfiguration(): void {
    this.busy.set(true);
    this.api.post(`/bandi/${this.id}/request-config`, {
      email_referente: this.model['email_referente'] ?? '',
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.messageIsError.set(false);
        this.message.set('Email inviata al referente.');
      },
      error: (err) => {
        this.busy.set(false);
        this.messageIsError.set(true);
        this.message.set(this.extractError(err));
      },
    });
  }

  addCommissioner(): void {
    this.commissionMembers.push({ nome: '', email: '' });
  }

  removeCommissioner(index: number): void {
    this.commissionMembers.splice(index, 1);
  }

  private extractError(err: unknown): string {
    const body = (err as { error?: { error?: { message?: string; details?: Record<string, string> } } })?.error?.error;
    if (!body) return 'Salvataggio non riuscito.';
    const details = body.details ? Object.entries(body.details).map(([field, msg]) => `${field}: ${msg}`).join('; ') : '';
    return details ? `${body.message} (${details})` : body.message || 'Salvataggio non riuscito.';
  }
}
