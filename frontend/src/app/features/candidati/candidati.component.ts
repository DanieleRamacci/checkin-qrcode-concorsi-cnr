import { Component, SimpleChanges, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import * as QRCode from 'qrcode';
import { ItIconComponent } from 'design-angular-kit';
import { ApiClient } from '../../core/api-client';
import { ApiList, CandidateSummary } from '../../core/models/api.models';
import { FilterChipOption, FilterChipsComponent } from '../../shared/filter-chips.component';
import { PagerComponent } from '../../shared/pager.component';

export type CandidateSectionMode = 'vuota' | 'sola-lettura' | 'checkin' | 'finale' | 'reset-sede' | 'reset-esperto';
type ResetOperation = 'request' | 'cancel_request' | 'complete';

export function candidateQrPayload(uid: string): string {
  return JSON.stringify({ uid });
}

const REQUESTER: Record<string, string> = {
  'Informatico in sede': 'dall’informatico in sede', 'Esperto remoto': 'dall’esperto remoto',
  Segretario: 'dal segretario', Amministratore: 'dall’amministratore',
};

/**
 * Sezione Candidati della pagina sessione (prototipi sessione-*.html, sempre
 * sotto il pannello Azioni). Una sola tabella: la modalità decide colonne,
 * filtri e azioni; il reset password vive sulla riga del candidato presente.
 */
@Component({
  selector: 'app-candidati',
  imports: [FormsModule, DatePipe, NgTemplateOutlet, ItIconComponent, FilterChipsComponent, PagerComponent],
  template: `
    <section class="card card-bg no-after app-cand-card" aria-labelledby="cand">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <h2 id="cand" class="h4 mb-0" tabindex="-1">{{ heading() }}</h2>
          @switch (sectionMode()) {
            @case ('sola-lettura') { @if (expiredCount()) { <span class="text-warning-emphasis fw-semibold">{{ expiredCount() === 1 ? '1 con documento scaduto' : expiredCount() + ' con documento scaduto' }}: verificali in aula</span> } }
            @case ('finale') { @if (concludedAt()) { <span class="small text-secondary">Check-in concluso alle {{ concludedAt() }}</span> } }
            @case ('checkin') {
              <div class="form-group mb-0 app-search"><label for="cand-q" class="active">Cerca per cognome o documento</label>
                <input type="search" class="form-control" id="cand-q" placeholder="es. Rossi" [ngModel]="query()" (ngModelChange)="setQuery($event)" /></div>
            }
            @case ('reset-sede') { <ng-container [ngTemplateOutlet]="resetSearch" /> }
            @case ('reset-esperto') { <ng-container [ngTemplateOutlet]="resetSearch" /> }
          }
        </div>
        <ng-template #resetSearch>
          <div class="form-group mb-0 app-search"><label for="cand-rq" class="active">Cerca candidato</label>
            <input type="search" class="form-control" id="cand-rq" placeholder="Cognome o nome" [ngModel]="query()" (ngModelChange)="setQuery($event)" /></div>
        </ng-template>

        @if (sectionMode() === 'vuota') {
          <div class="app-empty">
            <it-icon name="inbox" size="lg" />
            <p class="fw-semibold mb-1">Nessun candidato ancora</p>
            <p class="mb-0 text-secondary">{{ emptyMessage() }}</p>
          </div>
        } @else if (error()) {
          <div class="alert alert-danger d-flex flex-wrap justify-content-between align-items-center gap-2" role="alert">
            <span>{{ error() }}</span><button class="btn btn-sm btn-outline-danger" type="button" (click)="load()">Riprova</button>
          </div>
        } @else if (loading() && !items().length) {
          <p class="d-flex align-items-center gap-2 py-3 mb-0" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Carico i candidati…</p>
        } @else {
          @if (filterOptions().length) {
            <div class="mb-3"><app-filter-chips [label]="isReset() ? 'Filtra per reset password' : 'Filtra candidati'" [options]="filterOptions()" [selected]="filter()" (selectedChange)="setFilter($event)" /></div>
          }
          <div class="table-responsive"><table class="table align-middle mb-0">
            <caption class="visually-hidden">Candidati della sessione</caption>
            <thead><tr>
              <th scope="col">Cognome e nome</th>
              @if (isReset()) {
                <th scope="col">Reset password</th><th scope="col" class="text-end"><span class="visually-hidden">Azioni</span></th>
              } @else {
                <th scope="col">Documento</th>
                @if (sectionMode() !== 'checkin') { <th scope="col">Validità</th> }
                @if (sectionMode() !== 'sola-lettura') { <th scope="col">Presenza</th> }
                @if (sectionMode() === 'checkin') { <th scope="col" class="text-end">Azioni</th> }
              }
            </tr></thead>
            <tbody>
              @for (item of pageItems(); track item.uid) {
                <tr [class.app-row-attn]="isReset() && item.reset_password_richiesto">
                  <td><strong>{{ item.last_name }}</strong> {{ item.first_name }}
                    @if (item.note && !isReset()) { <span class="d-block small text-secondary text-break">{{ item.note }}</span> }</td>
                  @if (isReset()) {
                    <td>
                      @if (item.reset_password_richiesto) {
                        <span class="badge app-badge-warning">Reset richiesto</span><br><span class="small text-secondary">{{ requestedBy(item) }}</span>
                      } @else if (item.reset_password_effettuato) {
                        <span class="badge app-badge-success">Reset fatto</span>@if (item.reset_password_effettuato_at) { <br><span class="small text-secondary">alle {{ item.reset_password_effettuato_at | date:'HH:mm' }}</span> }
                      } @else { <span class="text-secondary">Nessuna richiesta</span> }
                    </td>
                    <td class="text-end">
                      @if (sectionMode() === 'reset-sede') {
                        @if (item.reset_password_richiesto) {
                          <button type="button" class="btn btn-link btn-sm text-danger p-0 fw-semibold" [disabled]="busyUid() === item.uid" (click)="mutateReset(item, 'cancel_request')">Annulla richiesta<span class="visually-hidden"> per {{ item.last_name }}</span></button>
                        } @else if (!item.reset_password_effettuato) {
                          <button type="button" class="btn btn-outline-primary btn-sm" [disabled]="busyUid() === item.uid" (click)="mutateReset(item, 'request')">Serve reset password<span class="visually-hidden"> per {{ item.last_name }}</span></button>
                        }
                      } @else {
                        @if (item.reset_password_richiesto) {
                          <button type="button" class="btn btn-success btn-sm" [disabled]="busyUid() === item.uid" (click)="mutateReset(item, 'complete')">Segna come fatto<span class="visually-hidden"> per {{ item.last_name }}</span></button>
                        } @else if (!item.reset_password_effettuato) {
                          <button type="button" class="btn btn-link btn-sm p-0 fw-semibold" [disabled]="busyUid() === item.uid" (click)="mutateReset(item, 'complete')">Registra un reset<span class="visually-hidden"> per {{ item.last_name }}</span></button>
                        }
                      }
                    </td>
                  } @else {
                    <td><span class="app-mono">{{ item.document_number }}</span>
                      @if (sectionMode() === 'checkin' && item.document_expired) { <span class="badge app-badge-danger">Scaduto</span> }</td>
                    @if (sectionMode() !== 'checkin') {
                      <td>@if (item.document_expired) { <span class="badge app-badge-danger">Scaduto</span> } @else { <span class="badge app-badge-success">Valido</span> }</td>
                    }
                    @if (sectionMode() !== 'sola-lettura') {
                      <td>
                        @if (item.checkin_effettuato) {
                          <span class="text-success fw-semibold">@if (sectionMode() === 'checkin') { <it-icon name="check-circle" size="xs" color="success" /> }Presente</span>
                          @if (item.checkin_at) { @if (sectionMode() === 'checkin') { <br> } @else { &ngsp; } <span class="small text-secondary">{{ item.checkin_at | date:'HH:mm' }} · {{ item.checkin_source === 'scanner' ? 'da scanner' : 'da tabella' }}</span> }
                        } @else { <span class="text-secondary">{{ sectionMode() === 'checkin' ? 'Da registrare' : 'Assente' }}</span> }
                      </td>
                    }
                    @if (sectionMode() === 'checkin') {
                      <td class="text-end app-actions">
                        @if (item.checkin_effettuato) {
                          <button type="button" class="btn btn-link btn-sm text-danger fw-semibold" [disabled]="mutationUid() === item.uid" (click)="pendingToggle.set(item)">Annulla presenza<span class="visually-hidden"> {{ item.last_name }}</span></button>
                        } @else {
                          <button type="button" class="btn btn-outline-success btn-sm" [disabled]="mutationUid() === item.uid" (click)="toggle(item)">Segna presente<span class="visually-hidden"> {{ item.last_name }}</span></button>
                        }
                        <button type="button" class="btn btn-link btn-sm fw-semibold" (click)="openNotes(item)">{{ item.note ? 'Modifica note' : 'Note' }}<span class="visually-hidden"> {{ item.last_name }}</span></button>
                        <button type="button" class="btn btn-link btn-sm fw-semibold" (click)="showQr(item)">QR<span class="visually-hidden"> candidato {{ item.last_name }}</span></button>
                      </td>
                    }
                  }
                </tr>
              } @empty {
                <tr><td [attr.colspan]="columnCount()" class="text-secondary">{{ query().trim() ? 'Nessun candidato corrisponde alla ricerca.' : emptyFilterMessage() }}</td></tr>
              }
            </tbody>
          </table></div>
          @if (filteredItems().length > 25) {
            <div class="mt-3"><app-pager label="Candidati" [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" /></div>
          }
          @if (sectionMode() === 'sola-lettura') { <p class="small text-secondary mt-2 mb-0">In sola lettura finché il check-in non è avviato.</p> }
          @if (isReset()) { <p class="small text-secondary mt-3 mb-0">Le richieste da fare restano in cima alla tabella finché non sono risolte.</p> }
        }
        @if (message()) { <p class="small mt-2 mb-0" role="status">{{ message() }}</p> }
      </div>
    </section>

    @if (pendingToggle(); as candidate) {
      <div class="modal d-block" role="dialog" aria-modal="true" aria-labelledby="presence-title" style="background:rgba(0,0,0,.45)">
        <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
          <div class="modal-header"><h2 id="presence-title" class="modal-title h5">Annullare la presenza?</h2></div>
          <div class="modal-body">{{ candidate.last_name }} {{ candidate.first_name }} risulterà assente.</div>
          <div class="modal-footer"><button class="btn btn-outline-secondary" type="button" (click)="pendingToggle.set(null)">Continua</button><button class="btn btn-danger" type="button" (click)="toggle(candidate)">Annulla presenza</button></div>
        </div></div>
      </div>
    }

    @if (selectedCandidate(); as candidate) {
      <div class="modal candidate-qr-modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="candidateQrTitle">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content app-cand-card">
            <div class="modal-header">
              <h2 class="modal-title h5" id="candidateQrTitle">QR candidato</h2>
              <button class="btn-close" type="button" aria-label="Chiudi" (click)="closeQr()"></button>
            </div>
            <div class="modal-body text-center">
              <p class="fw-semibold">{{ candidate.last_name }} {{ candidate.first_name }}</p>
              @if (qrLoading()) {
                <div class="py-5" role="status">
                  <span class="spinner-border" aria-hidden="true"></span>
                  <span class="visually-hidden">Generazione QR…</span>
                </div>
              } @else if (qrDataUrl()) {
                <img class="img-fluid candidate-qr" [src]="qrDataUrl()" width="260" height="260"
                  [alt]="'QR code candidato ' + candidate.first_name + ' ' + candidate.last_name" />
              }
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" type="button" (click)="closeQr()">Chiudi</button>
            </div>
          </div>
        </div>
      </div>
    }

    @if (noteCandidate(); as candidate) {
      <div class="modal candidate-note-modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="candidateNoteTitle">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content app-cand-card">
            <form (ngSubmit)="saveNotes()">
              <div class="modal-header">
                <h2 class="modal-title h5" id="candidateNoteTitle">Note candidato</h2>
                <button class="btn-close" type="button" aria-label="Chiudi" (click)="closeNotes()"></button>
              </div>
              <div class="modal-body">
                <p class="fw-semibold mb-2">{{ candidate.last_name }} {{ candidate.first_name }}</p>
                <label class="form-label" for="candidate-note-text">Note documento / identità</label>
                <textarea
                  id="candidate-note-text"
                  class="form-control"
                  name="candidateNote"
                  rows="6"
                  maxlength="2000"
                  [(ngModel)]="noteDraft"
                ></textarea>
                <div class="form-text text-end">{{ noteDraft.length }}/2000</div>
                @if (noteError()) {
                  <div class="alert alert-danger mt-3 mb-0" role="alert">{{ noteError() }}</div>
                }
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" type="button" [disabled]="noteSaving()" (click)="closeNotes()">Annulla</button>
                <button class="btn btn-primary" type="submit" [disabled]="noteSaving()">
                  @if (noteSaving()) { <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span> }
                  Salva note
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .candidate-qr-modal, .candidate-note-modal { display: block; background: rgba(0, 0, 0, 0.5); }
    .candidate-qr { image-rendering: pixelated; }
    .app-actions .btn { white-space: nowrap; }
  `,
})
export class CandidatiComponent {
  readonly sessionId = input.required<string>();
  readonly viewMode = input<'segretario' | 'sede' | 'esperto' | 'admin'>('segretario');
  readonly refreshTick = input(0);
  readonly sectionMode = input<CandidateSectionMode>('checkin');
  /** Testo dello stato vuoto: cosa fare perché compaiano i candidati. */
  readonly emptyMessage = input('Compariranno qui dopo lo scaricamento da Selezioni Online.');
  /** Ora di conclusione del check-in (HH:MM), per la modalità finale. */
  readonly concludedAt = input('');
  readonly openResetCountChange = output<number>();
  private readonly api = inject(ApiClient);
  readonly items = signal<CandidateSummary[]>([]);
  readonly message = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly mutationUid = signal<string | null>(null);
  readonly busyUid = signal<string | null>(null);
  readonly selectedCandidate = signal<CandidateSummary | null>(null);
  readonly noteCandidate = signal<CandidateSummary | null>(null);
  readonly qrDataUrl = signal('');
  readonly qrLoading = signal(false);
  readonly noteSaving = signal(false);
  readonly noteError = signal('');
  readonly query = signal('');
  readonly filter = signal('all');
  readonly page = signal(0);
  readonly pageSize = signal(25);
  readonly pendingToggle = signal<CandidateSummary | null>(null);
  noteDraft = '';

  readonly isReset = computed(() => this.sectionMode() === 'reset-sede' || this.sectionMode() === 'reset-esperto');
  readonly presentCount = computed(() => this.items().filter((item) => item.checkin_effettuato).length);
  readonly expiredCount = computed(() => this.items().filter((item) => item.document_expired).length);
  readonly pendingResetCount = computed(() => this.items().filter((item) => item.reset_password_richiesto).length);
  readonly doneResetCount = computed(() => this.items().filter((item) => item.reset_password_effettuato).length);

  readonly heading = computed(() => {
    switch (this.sectionMode()) {
      case 'vuota': return 'Candidati';
      case 'finale': return `Candidati · ${this.presentCount()} presenti su ${this.items().length}`;
      case 'reset-sede': case 'reset-esperto': return `Candidati · ${this.items().length} presenti`;
      default: return `Candidati · ${this.items().length}`;
    }
  });

  readonly filterOptions = computed<FilterChipOption[]>(() => {
    switch (this.sectionMode()) {
      case 'checkin': return [
        { id: 'daregistrare', label: 'Da registrare', count: this.items().length - this.presentCount() },
        { id: 'presenti', label: 'Presenti', count: this.presentCount() },
        { id: 'scaduto', label: 'Documento scaduto', count: this.expiredCount() },
        { id: 'all', label: 'Tutti', count: this.items().length },
      ];
      case 'reset-sede': case 'reset-esperto': return [
        { id: 'attesa', label: this.sectionMode() === 'reset-esperto' ? 'Reset da fare' : 'In attesa', count: this.pendingResetCount() },
        { id: 'fatti', label: 'Reset fatti', count: this.doneResetCount() },
        { id: 'all', label: 'Tutti i presenti', count: this.items().length },
      ];
      default: return [];
    }
  });

  readonly filteredItems = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('it');
    const filter = this.filter();
    return this.items()
      .filter((item) => {
        if (filter === 'daregistrare') return !item.checkin_effettuato;
        if (filter === 'presenti') return item.checkin_effettuato;
        if (filter === 'scaduto') return item.document_expired;
        if (filter === 'attesa') return item.reset_password_richiesto;
        if (filter === 'fatti') return item.reset_password_effettuato;
        return true;
      })
      .filter((item) => !query || `${item.last_name} ${item.first_name} ${item.first_name} ${item.last_name} ${this.isReset() ? '' : item.document_number}`.toLocaleLowerCase('it').includes(query))
      .sort((a, b) => (this.isReset() ? Number(b.reset_password_richiesto) - Number(a.reset_password_richiesto) : 0)
        || a.last_name.localeCompare(b.last_name, 'it') || a.first_name.localeCompare(b.first_name, 'it'));
  });

  readonly pageItems = computed(() => this.filteredItems().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));

  readonly columnCount = computed(() => {
    if (this.isReset()) return 3;
    return ({ 'sola-lettura': 3, checkin: 4, finale: 4 } as Record<string, number>)[this.sectionMode()] ?? 3;
  });

  ngOnInit(): void {
    // Filtro iniziale come nei prototipi: "Da registrare" durante il check-in, tutti i presenti per i reset.
    this.filter.set(this.sectionMode() === 'checkin' ? 'daregistrare' : 'all');
    if (this.sectionMode() !== 'vuota') this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const mode = changes['sectionMode'];
    if (mode && !mode.firstChange) {
      this.filter.set(this.sectionMode() === 'checkin' ? 'daregistrare' : 'all');
      this.page.set(0);
      // Le viste dei reset caricano solo i presenti: cambiando vista si riparte da zero.
      if (this.isReset() || isResetMode(mode.previousValue)) this.items.set([]);
      if (this.sectionMode() !== 'vuota') this.load();
      return;
    }
    if (changes['refreshTick'] && !changes['refreshTick'].firstChange && this.sectionMode() !== 'vuota') this.load();
  }

  setQuery(value: string): void { this.query.set(value); this.page.set(0); }
  setFilter(value: string): void { this.filter.set(value); this.page.set(0); }
  changePageSize(size: number): void { this.pageSize.set(size); this.page.set(0); }

  emptyFilterMessage(): string {
    if (this.filter() === 'daregistrare' && this.items().length) return 'Tutti i candidati risultano presenti.';
    if (this.filter() === 'attesa') return 'Nessuna richiesta di reset in attesa.';
    if (this.filter() === 'fatti') return 'Nessun reset fatto finora.';
    return this.isReset() ? 'Nessun candidato presente.' : 'Nessun candidato in questa sessione.';
  }

  requestedBy(item: CandidateSummary): string {
    const who = item.reset_password_richiesto_role ? REQUESTER[item.reset_password_richiesto_role] : '';
    const at = item.reset_password_richiesto_at ? new Date(item.reset_password_richiesto_at) : null;
    const time = at && !Number.isNaN(at.getTime()) ? at.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
    return [who, time ? `alle ${time}` : ''].filter(Boolean).join(' ') || 'in attesa';
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new URLSearchParams({ checkin: this.isReset() ? 'yes' : 'all', reset: 'all', mode: this.viewMode() });
    this.api.get<ApiList<CandidateSummary>>(`/sessioni/${this.sessionId()}/candidati?${params}`).subscribe({
      next: ({ items }) => {
        this.items.set(items ?? []);
        this.loading.set(false);
        if (this.isReset()) this.openResetCountChange.emit(this.pendingResetCount());
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Impossibile caricare l’elenco dei candidati.');
      },
    });
  }

  toggle(item: CandidateSummary): void {
    this.pendingToggle.set(null);
    this.mutationUid.set(item.uid);
    this.message.set('');
    this.api.post<CandidateSummary>(`/sessioni/${this.sessionId()}/candidati/${encodeURIComponent(item.uid)}/toggle-checkin?mode=${encodeURIComponent(this.viewMode())}`).subscribe({
      next: () => { this.mutationUid.set(null); this.load(); },
      error: () => { this.mutationUid.set(null); this.message.set('Aggiornamento della presenza non riuscito. Riprova.'); },
    });
  }

  mutateReset(item: CandidateSummary, operation: ResetOperation): void {
    this.busyUid.set(item.uid);
    this.message.set('');
    this.api.post(
      `/sessioni/${this.sessionId()}/candidati/${encodeURIComponent(item.uid)}/reset-password?mode=${encodeURIComponent(this.viewMode())}`,
      { operation },
    ).subscribe({
      next: () => { this.busyUid.set(null); this.load(); },
      error: () => { this.busyUid.set(null); this.message.set('Aggiornamento della richiesta di reset non riuscito. Riprova.'); },
    });
  }

  async showQr(item: CandidateSummary): Promise<void> {
    this.selectedCandidate.set(item);
    this.qrDataUrl.set('');
    this.qrLoading.set(true);
    try {
      this.qrDataUrl.set(await QRCode.toDataURL(candidateQrPayload(item.uid), {
        width: 260,
        margin: 1,
        errorCorrectionLevel: 'M',
      }));
    } catch {
      this.message.set('Generazione del QR candidato non riuscita.');
      this.selectedCandidate.set(null);
    } finally {
      this.qrLoading.set(false);
    }
  }

  closeQr(): void {
    this.selectedCandidate.set(null);
    this.qrDataUrl.set('');
  }

  openNotes(candidate: CandidateSummary): void {
    this.noteCandidate.set(candidate);
    this.noteDraft = candidate.note ?? '';
    this.noteError.set('');
  }

  closeNotes(): void {
    if (this.noteSaving()) return;
    this.noteCandidate.set(null);
    this.noteDraft = '';
    this.noteError.set('');
  }

  saveNotes(): void {
    const candidate = this.noteCandidate();
    if (!candidate) return;
    this.noteSaving.set(true);
    this.noteError.set('');
    this.api.put<CandidateSummary>(
      `/sessioni/${this.sessionId()}/candidati/${encodeURIComponent(candidate.uid)}/note?mode=${encodeURIComponent(this.viewMode())}`,
      { note: this.noteDraft },
    ).subscribe({
      next: (updated) => {
        this.items.update((items) => items.map((item) => item.uid === updated.uid ? updated : item));
        this.message.set('Note candidato salvate.');
        this.noteSaving.set(false);
        this.closeNotes();
      },
      error: () => {
        this.noteSaving.set(false);
        this.noteError.set('Salvataggio note non riuscito.');
      },
    });
  }
}

function isResetMode(mode: CandidateSectionMode | undefined): boolean {
  return mode === 'reset-sede' || mode === 'reset-esperto';
}
