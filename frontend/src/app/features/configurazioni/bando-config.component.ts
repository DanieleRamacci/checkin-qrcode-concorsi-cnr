import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { BandiService } from '../bandi/bandi.service';

interface SedeTechnician {
  nome: string;
  email: string;
  telefono: string;
  principale: boolean;
}

interface SessionAssignment {
  session_id: string;
  nome: string;
  giorno: string;
  ora: string;
  luogo: string;
  email_esperto_remoto: string;
  nome_informatico_sede: string;
  email_informatico_sede: string;
  telefono_informatico_sede: string;
  informatici_sede: SedeTechnician[];
}

@Component({
  selector: 'app-bando-config',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container-xxl my-5">
      <a [routerLink]="returnUrl()" class="btn btn-outline-secondary btn-sm mb-3">
        &larr; {{ returnLabel() }}
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
              <div class="form-control form-control-sm text-muted" id="email_referente">
                Nessun RDP disponibile da Selezioni Online
              </div>
            }
            <button type="button" class="btn btn-outline-primary" [disabled]="busy() || !canSendRequest()" (click)="requestConfiguration()">
              Salva &amp; invia richiesta
            </button>
          </div>
          <div class="form-text">
            Il referente può essere scelto solo tra gli RDP restituiti da Selezioni Online.
          </div>
        </div>
      </div>

      <form (ngSubmit)="save()">
        <div class="card mb-3">
          <div class="card-header bg-light py-2">
            <span class="fw-bold text-uppercase small text-primary">Assegnazioni tecniche per sessione</span>
          </div>
          <div class="card-body">
            @if (sessionAssignments.length) {
              @for (assignment of sessionAssignments; track assignment.session_id; let i = $index) {
                <section class="border rounded p-3 mb-3">
                  <div class="mb-3">
                    <h2 class="h5 mb-1">{{ assignment.nome || 'Sessione' }}</h2>
                    <div class="small text-muted">{{ assignment.giorno }} {{ assignment.ora }} {{ assignment.luogo }}</div>
                  </div>

                  <div class="mb-4">
                    <label class="form-label fw-semibold" [for]="'session-expert-' + i">Esperto informatico da remoto</label>
                    <select class="form-select"
                            [id]="'session-expert-' + i"
                            [name]="'session-expert-' + i"
                            [(ngModel)]="assignment.email_esperto_remoto">
                      <option value="">Seleziona esperto remoto</option>
                      @for (email of expertOptions(); track email) {
                        <option [value]="email">{{ email }}</option>
                      }
                    </select>
                  </div>

                  <div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <h3 class="h6 mb-0">Informatico in sede di riferimento</h3>
                      <button type="button" class="btn btn-sm btn-outline-primary" (click)="addSessionSedeTechnician(i)">Aggiungi</button>
                    </div>
                    @for (technician of assignment.informatici_sede; track $index; let t = $index) {
                      <div class="row g-2 align-items-end mb-2">
                        <div class="col-lg-3 col-md-6">
                          <label class="form-label small" [for]="'session-sede-name-' + i + '-' + t">Nome e cognome</label>
                          <input class="form-control"
                                 [id]="'session-sede-name-' + i + '-' + t"
                                 [name]="'session-sede-name-' + i + '-' + t"
                                 [(ngModel)]="technician.nome" />
                        </div>
                        <div class="col-lg-3 col-md-6">
                          <label class="form-label small" [for]="'session-sede-email-' + i + '-' + t">Email</label>
                          <input class="form-control"
                                 [id]="'session-sede-email-' + i + '-' + t"
                                 [name]="'session-sede-email-' + i + '-' + t"
                                 type="email"
                                 [(ngModel)]="technician.email" />
                        </div>
                        <div class="col-lg-3 col-md-6">
                          <label class="form-label small" [for]="'session-sede-phone-' + i + '-' + t">Telefono</label>
                          <input class="form-control"
                                 [id]="'session-sede-phone-' + i + '-' + t"
                                 [name]="'session-sede-phone-' + i + '-' + t"
                                 [(ngModel)]="technician.telefono" />
                        </div>
                        <div class="col-lg-2 col-md-3">
                          <div class="form-check mb-2">
                            <input class="form-check-input"
                                   type="radio"
                                   [name]="'session-sede-primary-' + i"
                                   [id]="'session-sede-primary-' + i + '-' + t"
                                   [checked]="technician.principale"
                                   (change)="setPrimarySessionSedeTechnician(i, t)" />
                            <label class="form-check-label small" [for]="'session-sede-primary-' + i + '-' + t">Principale</label>
                          </div>
                        </div>
                        <div class="col-lg-1 col-md-3">
                          <button type="button" class="btn btn-outline-danger w-100" (click)="removeSessionSedeTechnician(i, t)">Rimuovi</button>
                        </div>
                      </div>
                    } @empty {
                      <p class="text-muted small mb-2">Nessun informatico in sede inserito per questa sessione.</p>
                    }
                  </div>
                </section>
              }
            } @else {
              <div class="empty-session-assignments border rounded p-4 text-center">
                <p class="text-muted mb-3">
                  Nessuna sessione locale disponibile per questo bando.
                </p>
                <button
                  type="button"
                  class="btn btn-primary"
                  [disabled]="busy() || syncingSessions()"
                  (click)="syncSessions()"
                >
                  @if (syncingSessions()) {
                    <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                  }
                  <span>Scarica sessioni da Selezioni Online</span>
                </button>
                <p class="small text-muted mt-3 mb-0">
                  Serve per assegnare l'esperto remoto e l'informatico in sede alle singole sessioni del bando.
                </p>
              </div>
            }
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header bg-light py-2">
            <span class="fw-bold text-uppercase small text-primary">Segretario e durata prova</span>
          </div>
          <div class="card-body row g-3">
            <div class="col-md-6">
              <label class="form-label" for="email_segretario">Email segretario</label>
              @if (secretaryOptions().length) {
                <select class="form-select" id="email_segretario" name="email_segretario"
                        [(ngModel)]="model['email_segretario']">
                  <option value="">Seleziona segretario</option>
                  @for (secretary of secretaryOptions(); track secretary.email) {
                    <option [value]="secretary.email">{{ secretary.nome || secretary.email }} — {{ secretary.email }}</option>
                  }
                </select>
              } @else {
                <div class="form-control text-muted" id="email_segretario">
                  Nessun segretario disponibile da Selezioni Online
                </div>
              }
              <div class="form-text">Il segretario puo essere scelto solo tra i componenti con ruolo SEGRETARIO restituiti da Selezioni Online.</div>
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
            <div class="col-md-6">
              <label class="form-label" for="data_accesso_piattaforma">Data accesso piattaforma</label>
              <input class="form-control" id="data_accesso_piattaforma" name="data_accesso_piattaforma" type="date"
                     [(ngModel)]="model['data_accesso_piattaforma']" />
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-header bg-light py-2 d-flex justify-content-between align-items-center">
            <span class="fw-bold text-uppercase small text-primary">Componenti commissione</span>
            <button type="button" class="btn btn-sm btn-outline-primary" (click)="addCommissioner()">Aggiungi</button>
          </div>
          <div class="card-body">
            @if (!commissionMembers.length) {
              <div class="alert alert-warning">
                Mancano i componenti commissione da Selezioni Online. Verificare la configurazione del bando sulla fonte dati prima di completare la configurazione operativa.
              </div>
            }
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
          <a [routerLink]="returnUrl()" class="btn btn-outline-secondary">Annulla</a>
          <button class="btn btn-primary" type="submit" [disabled]="busy()">Salva configurazione</button>
        </div>
      </form>
    </div>
  `,
})
export class BandoConfigComponent {
  private readonly api = inject(ApiClient);
  private readonly bandiService = inject(BandiService);
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('commissionId') ?? '';
  readonly returnUrl = signal(
    safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'))
      ?? `/bandi/${encodeURIComponent(this.id)}/sessioni`,
  );
  readonly message = signal('');
  readonly messageIsError = signal(false);
  readonly busy = signal(false);
  readonly syncing = signal(false);
  readonly syncingSessions = signal(false);
  readonly syncWarning = signal('');
  readonly title = signal('');
  readonly expertOptions = signal<string[]>([]);
  readonly rdpOptions = signal<Array<{ nome: string; email: string }>>([]);
  readonly secretaryOptions = signal<Array<{ nome: string; email: string }>>([]);
  model: Record<string, any> = {};
  commissionMembers: Array<{ nome: string; email: string }> = [];
  sessionAssignments: SessionAssignment[] = [];

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
      this.secretaryOptions.set(data['secretary_options'] ?? []);
      this.commissionMembers = [...(data['commissione_members'] ?? [])];
      this.sessionAssignments = normalizeSessionAssignments(data['session_assignments'] ?? []);
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

  syncSessions(): void {
    this.syncingSessions.set(true);
    this.syncWarning.set('');
    this.api.post<{ success: boolean; inserted: number }>(
      `/bandi/${encodeURIComponent(this.id)}/sessioni/sync`,
    ).subscribe({
      next: () => {
        this.syncingSessions.set(false);
        this.messageIsError.set(false);
        this.message.set('Sessioni scaricate da Selezioni Online.');
        this.loadConfig();
      },
      error: (err) => {
        this.syncingSessions.set(false);
        this.messageIsError.set(true);
        this.message.set(this.extractError(
          err,
          'Scarico sessioni da Selezioni Online non riuscito.',
        ));
      },
    });
  }

  save(): void {
    this.busy.set(true);
    const payload: Record<string, any> = {
      email_segretario: this.model['email_segretario'] ?? '',
      telefono_segretario: this.model['telefono_segretario'] ?? '',
      durata_prova_minuti: this.model['durata_prova_minuti'] ?? '',
      data_accesso_piattaforma: this.model['data_accesso_piattaforma'] ?? '',
      commissione_members: this.commissionMembers,
      session_assignments: this.sessionAssignmentsPayload(),
    };
    if (this.rdpOptions().length) {
      payload['email_referente'] = this.model['email_referente'] ?? '';
    }
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
    if (!this.canSendRequest()) return;
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

  addSessionSedeTechnician(sessionIndex: number): void {
    const assignment = this.sessionAssignments[sessionIndex];
    if (!assignment) return;
    assignment.informatici_sede.push({
      nome: '',
      email: '',
      telefono: '',
      principale: assignment.informatici_sede.length === 0,
    });
  }

  removeSessionSedeTechnician(sessionIndex: number, technicianIndex: number): void {
    const assignment = this.sessionAssignments[sessionIndex];
    if (!assignment) return;
    const removedPrimary = assignment.informatici_sede[technicianIndex]?.principale;
    assignment.informatici_sede.splice(technicianIndex, 1);
    if (removedPrimary && assignment.informatici_sede.length) {
      assignment.informatici_sede[0].principale = true;
    }
  }

  setPrimarySessionSedeTechnician(sessionIndex: number, technicianIndex: number): void {
    const assignment = this.sessionAssignments[sessionIndex];
    if (!assignment) return;
    assignment.informatici_sede = assignment.informatici_sede.map((technician, index) => ({
      ...technician,
      principale: index === technicianIndex,
    }));
  }

  canSendRequest(): boolean {
    return this.rdpOptions().length > 0 && !!this.model['email_referente'];
  }

  returnLabel(): string {
    if (this.returnUrl().startsWith('/referenti/bandi')) return 'Torna ai bandi referente';
    if (this.returnUrl().includes('/detail')) return 'Torna al dettaglio bando';
    if (this.returnUrl().includes('/bandi?')) return 'Torna alla lista concorsi';
    return 'Torna alla pagina precedente';
  }

  private extractError(err: unknown, fallback = 'Salvataggio non riuscito.'): string {
    const body = (err as { error?: { error?: { message?: string; details?: Record<string, string> } } })?.error?.error;
    if (!body) return fallback;
    const details = body.details ? Object.entries(body.details).map(([field, msg]) => `${field}: ${msg}`).join('; ') : '';
    return details ? `${body.message} (${details})` : body.message || fallback;
  }

  private sessionAssignmentsPayload(): SessionAssignment[] {
    return this.sessionAssignments.map((assignment) => {
      const informatici_sede = ensureSinglePrimary(
        normalizeSedeTechnicians(assignment.informatici_sede),
      );
      const primary = informatici_sede.find((item) => item.principale) ?? informatici_sede[0];
      return {
        ...assignment,
        nome_informatico_sede: primary?.nome ?? '',
        email_informatico_sede: primary?.email ?? '',
        telefono_informatico_sede: primary?.telefono ?? '',
        informatici_sede,
      };
    });
  }
}

function safeReturnUrl(value: string | null): string | null {
  const url = (value ?? '').trim();
  if (!url || !url.startsWith('/') || url.startsWith('//')) return null;
  if (url.includes('\n') || url.includes('\r')) return null;
  return url;
}

function normalizeSedeTechnicians(value: unknown): SedeTechnician[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<SedeTechnician>;
      return {
        nome: (row.nome ?? '').trim(),
        email: (row.email ?? '').trim(),
        telefono: (row.telefono ?? '').trim(),
        principale: !!row.principale,
      };
    })
    .filter((item) => item.nome || item.email || item.telefono);
}

function normalizeSessionAssignments(value: unknown): SessionAssignment[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as Partial<SessionAssignment>;
    const informatici_sede = ensureSinglePrimary(normalizeSedeTechnicians([
      ...(row.informatici_sede ?? []),
      {
        nome: row.nome_informatico_sede ?? '',
        email: row.email_informatico_sede ?? '',
        telefono: row.telefono_informatico_sede ?? '',
        principale: true,
      },
    ]));
    return {
      session_id: row.session_id ?? '',
      nome: row.nome ?? '',
      giorno: row.giorno ?? '',
      ora: row.ora ?? '',
      luogo: row.luogo ?? '',
      email_esperto_remoto: row.email_esperto_remoto ?? '',
      nome_informatico_sede: row.nome_informatico_sede ?? '',
      email_informatico_sede: row.email_informatico_sede ?? '',
      telefono_informatico_sede: row.telefono_informatico_sede ?? '',
      informatici_sede,
    };
  }).filter((item) => item.session_id);
}

function ensureSinglePrimary(items: SedeTechnician[]): SedeTechnician[] {
  const merged = new Map<string, SedeTechnician>();
  items.forEach((item, index) => {
    const emailKey = item.email.trim().toLowerCase();
    const key = emailKey || `__row_${index}`;
    const existing = merged.get(key);
    merged.set(key, existing
      ? {
          nome: item.nome || existing.nome,
          email: item.email || existing.email,
          telefono: item.telefono || existing.telefono,
          principale: existing.principale || item.principale,
        }
      : item);
  });
  let primarySeen = false;
  const normalized = [...merged.values()].map((item) => {
    const principale = !!item.principale && !primarySeen;
    if (principale) primarySeen = true;
    return { ...item, principale };
  });
  if (normalized.length && !primarySeen) {
    normalized[0].principale = true;
  }
  return normalized;
}
