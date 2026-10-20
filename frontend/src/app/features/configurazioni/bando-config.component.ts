import { Component, inject, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ItIconComponent } from 'design-angular-kit';
import { FormsModule, NgForm } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { InPageLinkDirective } from '../../shared/in-page-link.directive';
import { BandiService } from '../bandi/bandi.service';
import { competitionLabel } from '../../shared/competition-label';

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
  imports: [FormsModule, RouterLink, ItIconComponent, InPageLinkDirective],
  template: `
    <div class="container py-4 py-lg-5">
      <nav class="breadcrumb-container" aria-label="Percorso di navigazione"><ol class="breadcrumb p-0 mb-2">
        @if (fromReferente()) {
          <li class="breadcrumb-item"><a routerLink="/referenti/bandi">Bandi da referente</a><span class="separator">/</span></li>
        } @else {
          <li class="breadcrumb-item"><a routerLink="/bandi" [queryParams]="{ mode: 'segretario' }">I miei concorsi</a><span class="separator">/</span></li>
          <li class="breadcrumb-item"><a [routerLink]="['/bandi', id, 'sessioni']" [queryParams]="{ mode: 'segretario' }">{{ competitionLabel(title(), id) }}</a><span class="separator">/</span></li>
        }
        <li class="breadcrumb-item active" aria-current="page">Configura bando</li>
      </ol></nav>
      <h1 class="mb-1">Configura bando {{ code() }}</h1>
      <p class="text-secondary mb-4">Chi lavora alle sessioni di questo concorso. Ciò che è facoltativo puoi lasciarlo vuoto: il segretario lo indicherà all’apertura della sessione.</p>

      @if (message()) { <div [class]="'alert ' + (messageIsError() ? 'alert-danger' : 'alert-success')" role="status">{{ message() }}</div> }
      @if (syncing()) {
        <div class="alert alert-info" role="status"><div class="d-flex align-items-center gap-3">
          <div class="progress-spinner progress-spinner-active size-sm"><span class="visually-hidden">Caricamento</span></div>
          <span>Aggiorno commissione, RDP e segretario da Selezioni Online…</span></div></div>
      }
      @if (syncWarning()) { <div class="alert alert-warning" role="status">{{ syncWarning() }}</div> }

      <form #configForm="ngForm" (ngSubmit)="save()">
        <div class="row g-4">
          <div class="col-12 col-lg-3">
            <nav class="card card-bg no-after app-toc" aria-label="Sezioni della configurazione">
              <div class="card-body">
                <p class="app-eyebrow mb-2">Sezioni</p>
                <ul class="list-unstyled mb-0">
                  @for (entry of toc(); track entry.id) {
                    <li><a [href]="'#' + entry.id" [appInPageLink]="entry.id" [class.app-toc-todo]="!entry.done">
                      <it-icon [name]="entry.done ? 'check' : 'warning-circle'" size="xs" [color]="entry.done ? 'success' : 'warning'" />{{ entry.label }}</a></li>
                  }
                </ul>
              </div>
            </nav>
          </div>
          <div class="col-12 col-lg-9 d-flex flex-column gap-4">
            <section id="s-referente" class="card card-bg no-after"><div class="card-body">
              <h2 class="h4 d-flex align-items-center gap-2 mb-4">Referente del procedimento <span class="badge app-badge-neutral app-badge-sm">Facoltativo</span></h2>
              <div class="row g-3 align-items-end">
                <div class="col-12 col-md-8">
                  @if (rdpOptions().length) {
                    <div class="select-wrapper"><label for="ref">Referente</label>
                      <select id="ref" name="email_referente" [(ngModel)]="model['email_referente']">
                        <option value="">Nessun referente</option>
                        @for (rdp of rdpOptions(); track rdp.email) { <option [value]="rdp.email">{{ rdp.nome || rdp.email }} — {{ rdp.email }}</option> }
                      </select></div>
                  } @else {
                    <p class="mb-0 text-secondary">Nessun RDP disponibile da Selezioni Online.</p>
                  }
                </div>
                <div class="col-12 col-md-4"><button type="button" class="btn btn-outline-primary w-100" [disabled]="busy() || !canSendRequest()" (click)="requestConfiguration()">Invia richiesta al referente</button></div>
              </div>
              <p class="small text-secondary mt-2 mb-0">Solo tra gli RDP di Selezioni Online. La richiesta parte via email; il resto della pagina si salva con il pulsante in basso.</p>
            </div></section>

            <section id="s-segretario" class="card card-bg no-after"><div class="card-body">
              <h2 class="h4 mb-4">Segretario e prova</h2>
              <div class="row g-4">
                <div class="col-12 col-md-6">
                  @if (secretaryOptions().length) {
                    <div class="select-wrapper"><label for="seg">Segretario</label>
                      <select id="seg" name="email_segretario" [(ngModel)]="model['email_segretario']">
                        <option value="">Scegli…</option>
                        @for (secretary of secretaryOptions(); track secretary.email) { <option [value]="secretary.email">{{ secretary.nome || secretary.email }} — {{ secretary.email }}</option> }
                      </select></div>
                  } @else { <p class="mb-0 text-secondary">Nessun segretario disponibile da Selezioni Online.</p> }
                  <p class="small text-secondary mt-1 mb-0">Solo tra i componenti con ruolo SEGRETARIO su Selezioni Online.</p>
                </div>
                <div class="col-12 col-md-6"><div class="form-group mb-0"><label for="tel" class="active">Telefono segretario</label><input type="tel" class="form-control" id="tel" name="telefono_segretario" [(ngModel)]="model['telefono_segretario']" /></div></div>
                <div class="col-12 col-md-6"><div class="form-group mb-0"><label for="dur" class="active">Durata prova (minuti)</label><input type="number" min="1" class="form-control" id="dur" name="durata_prova_minuti" [(ngModel)]="model['durata_prova_minuti']" /></div></div>
                <div class="col-12 col-md-6"><div class="form-group mb-0"><label for="dat" class="active">Data accesso piattaforma</label><input type="date" class="form-control" id="dat" name="data_accesso_piattaforma" [(ngModel)]="model['data_accesso_piattaforma']" /></div></div>
              </div>
            </div></section>

            <section id="s-commissione" class="card card-bg no-after"><div class="card-body">
              <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <h2 class="h4 mb-0">Commissione</h2>
                <button type="button" class="btn btn-outline-primary btn-sm btn-icon gap-1" (click)="addCommissioner()"><it-icon name="plus" size="xs" color="primary" /><span>Aggiungi componente</span></button>
              </div>
              @if (!commissionMembers.length) {
                <div class="alert alert-warning mb-0">Mancano i componenti della commissione da Selezioni Online. Verifica il bando sulla fonte dati o aggiungili qui.</div>
              } @else {
                <div class="table-responsive"><table class="table mb-0">
                  <thead><tr><th scope="col">Nome</th><th scope="col">Email</th><th scope="col"><span class="visually-hidden">Azioni</span></th></tr></thead>
                  <tbody>
                    @for (member of commissionMembers; track $index; let i = $index) {
                      <tr>
                        @if (isNewMember(member)) {
                          <td><label class="visually-hidden" [for]="'member-name-' + i">Nome componente</label><input class="form-control" [id]="'member-name-' + i" [name]="'member-name-' + i" [(ngModel)]="member.nome" placeholder="Nome e cognome" /></td>
                          <td><label class="visually-hidden" [for]="'member-email-' + i">Email componente</label><input class="form-control" type="email" [id]="'member-email-' + i" [name]="'member-email-' + i" [(ngModel)]="member.email" placeholder="Email" /></td>
                        } @else {
                          <td>{{ member.nome || '—' }}</td><td class="text-break">{{ member.email || '—' }}</td>
                        }
                        <td class="text-end"><button type="button" class="btn btn-link text-danger p-0 fw-semibold" (click)="removeCommissioner(i)">Rimuovi<span class="visually-hidden"> {{ member.nome || 'componente ' + (i + 1) }}</span></button></td>
                      </tr>
                    }
                  </tbody>
                </table></div>
              }
            </div></section>

            <section id="s-sessioni" class="card card-bg no-after"><div class="card-body">
              <h2 class="h4">Supporto tecnico per sessione</h2>
              <p class="text-secondary">Esperto remoto e informatico in sede servono per avviare ogni sessione. Se li indichi qui, il segretario li trova già compilati.</p>
              @if (sessionAssignments.length) {
                <div class="table-responsive"><table class="table align-middle mb-0">
                  <thead><tr><th scope="col">Sessione</th><th scope="col">Esperto remoto</th><th scope="col">Informatico in sede</th><th scope="col">Stato</th></tr></thead>
                  <tbody>
                    @for (assignment of sessionAssignments; track assignment.session_id; let i = $index) {
                      <tr>
                        <td><strong>{{ assignment.nome || 'Sessione' }}</strong><br><span class="small text-secondary">{{ assignment.giorno }} · {{ assignment.ora }}@if (assignment.luogo) { · {{ assignment.luogo }} }</span></td>
                        <td><div class="select-wrapper app-select-inline"><label class="visually-hidden" [for]="'esp' + i">Esperto remoto per {{ assignment.nome || 'la sessione' }}</label>
                          <select [id]="'esp' + i" [name]="'session-expert-' + i" [(ngModel)]="assignment.email_esperto_remoto">
                            <option value="">Scegli…</option>
                            @for (email of expertOptions(); track email) { <option [value]="email">{{ email }}</option> }
                          </select></div></td>
                        <td class="assignment-cell">
                          @if (editingSede().has(i) || hasEmptyTechnician(assignment)) {
                            @for (technician of assignment.informatici_sede; track $index; let t = $index) {
                              <div class="border rounded p-2 mb-2">
                                <input class="form-control form-control-sm mb-1" [id]="'session-sede-name-' + i + '-' + t" [name]="'session-sede-name-' + i + '-' + t" [(ngModel)]="technician.nome" placeholder="Nome e cognome" aria-label="Nome informatico in sede" />
                                <input class="form-control form-control-sm mb-1" type="email" [id]="'session-sede-email-' + i + '-' + t" [name]="'session-sede-email-' + i + '-' + t" [(ngModel)]="technician.email" placeholder="Email (obbligatoria)" aria-label="Email informatico in sede" />
                                <input class="form-control form-control-sm mb-1" [id]="'session-sede-phone-' + i + '-' + t" [name]="'session-sede-phone-' + i + '-' + t" [(ngModel)]="technician.telefono" placeholder="Telefono" aria-label="Telefono informatico in sede" />
                                <div class="d-flex justify-content-between align-items-center">
                                  @if (assignment.informatici_sede.length > 1) {
                                    <div class="form-check mb-0"><input class="form-check-input" type="radio" [name]="'session-sede-primary-' + i" [id]="'session-sede-primary-' + i + '-' + t" [checked]="technician.principale" (change)="setPrimarySessionSedeTechnician(i, t)" /><label class="form-check-label small" [for]="'session-sede-primary-' + i + '-' + t">Principale</label></div>
                                  } @else { <span></span> }
                                  <button type="button" class="btn btn-link btn-sm text-danger p-0" (click)="removeSessionSedeTechnician(i, t)">Rimuovi</button>
                                </div>
                              </div>
                            }
                          } @else {
                            @for (technician of assignment.informatici_sede; track $index) {
                              <span class="d-block">{{ technician.nome || technician.email }}@if (technician.principale && assignment.informatici_sede.length > 1) { <span class="small text-secondary"> (principale)</span> }</span>
                            }
                            @if (assignment.informatici_sede.length) { <button type="button" class="btn btn-link p-0 fw-semibold" (click)="editSede(i)">Modifica</button> }
                          }
                          <button type="button" class="btn btn-link p-0 fw-semibold d-block" (click)="addSessionSedeTechnician(i)">+ Aggiungi informatico</button>
                        </td>
                        <td><span [class]="'badge ' + (assignmentComplete(assignment) ? 'app-badge-success' : 'app-badge-warning')">{{ assignmentComplete(assignment) ? 'Completa' : 'Da completare' }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table></div>
              } @else {
                <div class="app-empty">
                  <p class="fw-semibold mb-1">Nessuna sessione nell’app per questo bando</p>
                  <p class="text-secondary">Scaricale per indicare esperto remoto e informatico in sede per ogni sessione.</p>
                  <button type="button" class="btn btn-primary" [disabled]="busy() || syncingSessions()" (click)="syncSessions()">{{ syncingSessions() ? 'Scarico le sessioni…' : 'Scarica sessioni da Selezioni Online' }}</button>
                </div>
              }
            </div></section>
          </div>
        </div>
      </form>
    </div>
    <div class="app-savebar" [class.is-dirty]="dirty()">
      <div class="container d-flex flex-wrap align-items-center justify-content-end gap-3">
        <span class="flex-grow-1 text-secondary" id="savebar-text" role="status">{{ dirty() ? (unsavedCount() === 1 ? '1 modifica non salvata' : unsavedCount() + ' modifiche non salvate') : 'Nessuna modifica da salvare' }}</span>
        <button type="button" class="btn btn-link fw-semibold" [disabled]="busy() || !dirty()" (click)="cancel()">Annulla</button>
        <button type="button" class="btn btn-primary" [disabled]="busy() || !dirty()" (click)="save()">Salva configurazione</button>
      </div>
    </div>
  `,
  styles: `
    .assignment-cell { min-width: 14rem; }
    .app-badge-sm { font-size: .8rem; }
  `,
})
export class BandoConfigComponent {
  readonly competitionLabel = competitionLabel;
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
  /** Componenti aggiunti a mano in questa visita: solo loro hanno i campi modificabili. */
  private newMembers = new WeakSet<object>();
  /** Modifiche fatte con pulsanti (aggiungi/rimuovi), che il form non vede come "dirty". */
  readonly manualChanges = signal(0);
  readonly editingSede = signal(new Set<number>());
  sessionAssignments: SessionAssignment[] = [];
  @ViewChild('configForm') private configForm?: NgForm;

  constructor() {
    this.loadConfig();
    this.api.get<{ title: string }>(`/bandi/${this.id}`).subscribe((data) => this.title.set(data.title));
    this.refreshMetadata();
  }

  loadConfig(): void {
    this.api.get<Record<string, any>>(`/bandi/${this.id}/config`).subscribe((data) => {
      this.model = { ...data };
      this.expertOptions.set(data['expert_options'] ?? []);
      this.rdpOptions.set(data['rdp_options'] ?? []);
      this.secretaryOptions.set(data['secretary_options'] ?? []);
      this.commissionMembers = [...(data['commissione_members'] ?? [])];
      this.sessionAssignments = normalizeSessionAssignments(data['session_assignments'] ?? []);
      this.newMembers = new WeakSet<object>();
      this.manualChanges.set(0);
      this.editingSede.set(new Set<number>());
      this.configForm?.form.markAsPristine();
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
        this.configForm?.form.markAsPristine();
        this.manualChanges.set(0);
        this.editingSede.set(new Set<number>());
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
    const member = { nome: '', email: '' };
    this.newMembers.add(member);
    this.commissionMembers.push(member);
    this.changed();
  }

  removeCommissioner(index: number): void {
    this.commissionMembers.splice(index, 1);
    this.changed();
  }

  isNewMember(member: object): boolean { return this.newMembers.has(member); }

  editSede(index: number): void { this.editingSede.update((set) => new Set(set).add(index)); }

  hasEmptyTechnician(assignment: SessionAssignment): boolean {
    return assignment.informatici_sede.some((technician) => !String(technician.email ?? '').trim() && !String(technician.nome ?? '').trim());
  }

  dirty(): boolean { return this.manualChanges() > 0 || !!this.configForm?.dirty; }

  cancel(): void {
    this.message.set('');
    this.loadConfig();
  }

  fromReferente(): boolean { return this.returnUrl().startsWith('/referenti'); }

  /** "999.999" dal titolo del bando, altrimenti il titolo leggibile. */
  code(): string {
    const label = competitionLabel(this.title(), this.id);
    return label.startsWith('Concorso ') ? label.slice('Concorso '.length) : label === 'Concorso' ? '' : label;
  }

  /** Indice della pagina con lo stato di ogni sezione (FR-028). */
  toc(): Array<{ id: string; label: string; done: boolean }> {
    const todo = this.incompleteAssignments();
    return [
      { id: 's-referente', label: 'Referente', done: true },
      { id: 's-segretario', label: 'Segretario e prova', done: !!this.model['email_segretario'] && !!this.model['durata_prova_minuti'] },
      { id: 's-commissione', label: `Commissione · ${this.commissionMembers.length}`, done: this.commissionMembers.length > 0 },
      { id: 's-sessioni', label: this.sessionAssignments.length ? `Sessioni · ${todo ? todo + ' da completare' : 'complete'}` : 'Sessioni · da scaricare', done: this.sessionAssignments.length > 0 && !todo },
    ];
  }

  private changed(): void { this.manualChanges.update((count) => count + 1); }

  addSessionSedeTechnician(sessionIndex: number): void {
    const assignment = this.sessionAssignments[sessionIndex];
    if (!assignment) return;
    assignment.informatici_sede.push({
      nome: '',
      email: '',
      telefono: '',
      principale: assignment.informatici_sede.length === 0,
    });
    this.editSede(sessionIndex);
    this.changed();
  }

  removeSessionSedeTechnician(sessionIndex: number, technicianIndex: number): void {
    const assignment = this.sessionAssignments[sessionIndex];
    if (!assignment) return;
    const removedPrimary = assignment.informatici_sede[technicianIndex]?.principale;
    assignment.informatici_sede.splice(technicianIndex, 1);
    if (removedPrimary && assignment.informatici_sede.length) {
      assignment.informatici_sede[0].principale = true;
    }
    this.changed();
  }

  setPrimarySessionSedeTechnician(sessionIndex: number, technicianIndex: number): void {
    const assignment = this.sessionAssignments[sessionIndex];
    if (!assignment) return;
    assignment.informatici_sede = assignment.informatici_sede.map((technician, index) => ({
      ...technician,
      principale: index === technicianIndex,
    }));
    this.changed();
  }

  unsavedCount(): number {
    return (Object.values(this.configForm?.controls ?? {}).filter((control) => control.dirty).length + this.manualChanges()) || 1;
  }

  incompleteAssignments(): number {
    return this.sessionAssignments.filter((item) => !this.assignmentComplete(item)).length;
  }

  assignmentComplete(item: SessionAssignment): boolean {
    return !!item.email_esperto_remoto && item.informatici_sede.some((technician) => !!String(technician.email ?? '').trim());
  }

  canSendRequest(): boolean {
    return this.rdpOptions().length > 0 && !!this.model['email_referente'];
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
