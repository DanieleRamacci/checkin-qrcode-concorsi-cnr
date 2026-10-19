import { Component, SimpleChanges, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import * as QRCode from 'qrcode';
import { ApiClient } from '../../core/api-client';
import { ApiList, CandidateSummary } from '../../core/models/api.models';
import { FilterChipsComponent } from '../../shared/filter-chips.component';
import { PagerComponent } from '../../shared/pager.component';
import { ResetPasswordComponent } from './reset-password.component';

export function candidateQrPayload(uid: string): string {
  return JSON.stringify({ uid });
}

@Component({
  selector: 'app-candidati',
  imports: [FormsModule, DatePipe, FilterChipsComponent, PagerComponent, ResetPasswordComponent],
  template: `
    @if (sectionMode() === 'reset-sede' || sectionMode() === 'reset-esperto') {
      <app-reset-password [sessionId]="sessionId()" [viewMode]="sectionMode() === 'reset-esperto' ? 'esperto' : 'sede'" (openCountChange)="openResetCountChange.emit($event)" />
    } @else if (sectionMode() === 'vuota') {
      <div class="app-empty it-card shadow-sm p-4"><p class="app-eyebrow">Candidati</p><h2 class="h5">L’elenco sarà disponibile al prossimo passaggio</h2><p class="mb-0">Dopo aver scaricato i candidati, l’elenco comparirà qui.</p></div>
    } @else {
    <div class="it-card-wrapper">
      <div class="it-card shadow-sm p-4">
        <h2 id="candidates" class="h5 mb-3">Candidati della sessione</h2>

        <div class="d-flex justify-content-end gap-2 mb-2">
          <button class="btn btn-outline-primary btn-sm" type="button" [disabled]="loading()" (click)="load()">
            @if (loading()) {
              <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
            }
            <span>Aggiorna</span>
          </button>
        </div>

        <form class="row g-2 mb-3" (submit)="$event.preventDefault()">
          <div class="col-md-4">
            <label class="visually-hidden" for="candidate-search">Cerca candidato</label>
            <input
              id="candidate-search"
              class="form-control"
              placeholder="Cerca nome, cognome o documento"
              [ngModel]="query()"
              (ngModelChange)="onQueryChange($event)"
              name="q"
            />
          </div>
          <div class="col-md-3">
            <label class="visually-hidden" for="candidate-sort">Ordina</label>
            <select id="candidate-sort" class="form-select" [ngModel]="sort()" (ngModelChange)="sort.set($event)" name="sort">
              <option value="alpha">Ordina A→Z (Cognome)</option>
              <option value="checkin_no">Prima non effettuati</option>
              <option value="checkin_yes">Prima effettuati</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="visually-hidden" for="candidate-checkin">Filtro check-in</label>
            <select id="candidate-checkin" class="form-select" [ngModel]="checkin()" (ngModelChange)="onCheckinChange($event)" name="checkin">
              <option value="all">Tutti i check-in</option>
              <option value="yes">Solo effettuati</option>
              <option value="no">Solo non effettuati</option>
            </select>
          </div>
          <div class="col-md-2 d-flex align-items-center">
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                id="expired_only"
                [ngModel]="expiredOnly()"
                (ngModelChange)="expiredOnly.set($event)"
                name="expired_only"
              />
              <label class="form-check-label" for="expired_only">Documento scaduto</label>
            </div>
          </div>
        </form>
        @if (sectionMode() === 'checkin') {
          <app-filter-chips label="Filtra i candidati" [options]="filterOptions()" [selected]="selectedFilter()" (selectedChange)="setFilter($event)" />
        }

        @if (error()) {
          <div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
            <span>{{ error() }}</span>
            <button class="btn btn-sm btn-outline-danger" type="button" (click)="load()">Riprova</button>
          </div>
        } @else if (loading()) {
          <div class="d-flex align-items-center gap-2 py-4" role="status" aria-live="polite">
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <span>Caricamento candidati…</span>
          </div>
        } @else if (filteredItems().length === 0) {
          <div class="alert alert-warning" role="alert">Nessun candidato presente.</div>
        } @else {
          <div class="table-responsive">
            <table class="table table-striped table-hover">
              <caption class="visually-hidden">Candidati della sessione</caption>
              <thead class="table-light">
                <tr>
                  <th>#</th>
                  <th>Nome</th>
                  <th>Cognome</th>
                  <th>Documento</th>
                  <th>Validità</th>
                  <th>Presenza</th>
                  <th>Note</th>
                  <th class="text-nowrap">Azioni</th>
                </tr>
              </thead>
              <tbody>
                @for (item of pageItems(); track item.uid; let i = $index) {
                  <tr [class.table-success]="item.checkin_effettuato" [class.table-danger]="!item.checkin_effettuato">
                    <th scope="row">{{ i + 1 }}</th>
                    <td>{{ item.first_name }}</td>
                    <td>{{ item.last_name }}</td>
                    <td>{{ item.document_number }}</td>
                    <td>
                      @if (item.document_expired) {
                        <span class="badge bg-danger">Scaduto</span>
                      } @else {
                        <span class="badge bg-success">Valido</span>
                      }
                    </td>
                    <td>
                      @if (item.checkin_effettuato) {
                        <span class="badge bg-success">Presente@if (item.checkin_at) { {{ item.checkin_at | date:'HH:mm' }} · da {{ item.checkin_source === 'scanner' ? 'scanner' : 'tabella' }} }</span>
                      } @else {
                        <span class="badge bg-secondary">Assente</span>
                      }
                    </td>
                    <td class="candidate-note-cell">
                      @if (item.note) {
                        <span>{{ item.note }}</span>
                      } @else {
                        <span class="text-muted">-</span>
                      }
                    </td>
                    <td class="text-nowrap">
                      <button class="btn btn-sm btn-outline-dark me-1" type="button"
                        title="Mostra QR candidato" [attr.aria-label]="'Mostra QR candidato ' + item.first_name + ' ' + item.last_name"
                        (click)="showQr(item)">
                        QR
                      </button>
                      <button
                        [class]="'btn btn-sm me-1 ' + (item.note ? 'btn-primary text-white' : 'btn-outline-primary')"
                        type="button"
                        [attr.aria-label]="'Apri note candidato ' + item.first_name + ' ' + item.last_name"
                        (click)="openNotes(item)"
                      >
                        {{ item.note ? 'Modifica note' : 'Note' }}
                      </button>
                      @if (sectionMode() === 'checkin') { <button
                        [class]="'btn btn-sm text-nowrap ' + (item.checkin_effettuato ? 'btn-outline-danger' : 'btn-outline-success')"
                        style="white-space: nowrap;"
                        type="button"
                        [disabled]="mutationUid() === item.uid"
                        (click)="requestToggle(item)"
                      >
                        {{ item.checkin_effettuato ? 'Annulla presenza' : 'Segna presente' }}
                      </button> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (sectionMode() === 'checkin') {
            <app-pager label="Candidati" [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" />
          }
        }
        @if (message()) { <p role="status">{{ message() }}</p> }
      </div>
    </div>
    }

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
    .candidate-qr-modal { display: block; background: rgba(0, 0, 0, 0.5); }
    .candidate-note-modal { display: block; background: rgba(0, 0, 0, 0.5); }
    .candidate-qr { image-rendering: pixelated; }
    .candidate-note-cell {
      max-width: 18rem;
      white-space: normal;
      overflow-wrap: anywhere;
      font-size: 0.9rem;
    }
  `,
})
export class CandidatiComponent {
  readonly sessionId = input.required<string>();
  readonly viewMode = input<'segretario' | 'sede' | 'esperto' | 'admin'>('segretario');
  readonly refreshTick = input(0);
  readonly sectionMode = input<'vuota' | 'sola-lettura' | 'checkin' | 'finale' | 'reset-sede' | 'reset-esperto'>('checkin');
  readonly openResetCountChange = output<number>();
  private readonly api = inject(ApiClient);
  readonly items = signal<CandidateSummary[]>([]);
  readonly message = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly mutationUid = signal<string | null>(null);
  readonly selectedCandidate = signal<CandidateSummary | null>(null);
  readonly noteCandidate = signal<CandidateSummary | null>(null);
  readonly qrDataUrl = signal('');
  readonly qrLoading = signal(false);
  readonly noteSaving = signal(false);
  readonly noteError = signal('');
  readonly query = signal('');
  readonly sort = signal<'alpha' | 'checkin_no' | 'checkin_yes'>('alpha');
  readonly checkin = signal<'all' | 'yes' | 'no'>('all');
  readonly expiredOnly = signal(false);
  readonly selectedFilter = signal('all');
  readonly page = signal(0);
  readonly pageSize = signal(25);
  readonly pendingToggle = signal<CandidateSummary | null>(null);
  private searchDebounce?: ReturnType<typeof setTimeout>;
  noteDraft = '';

  readonly filteredItems = computed(() => {
    let items = this.items();
    if (this.selectedFilter() === 'yes') items = items.filter((item) => item.checkin_effettuato);
    if (this.selectedFilter() === 'no') items = items.filter((item) => !item.checkin_effettuato);
    if (this.selectedFilter() === 'expired') items = items.filter((item) => item.document_expired);
    if (this.expiredOnly()) {
      items = items.filter((item) => item.document_expired);
    }
    const sort = this.sort();
    items = [...items].sort((a, b) => {
      if (sort === 'checkin_no') return Number(a.checkin_effettuato) - Number(b.checkin_effettuato);
      if (sort === 'checkin_yes') return Number(b.checkin_effettuato) - Number(a.checkin_effettuato);
      return a.last_name.localeCompare(b.last_name);
    });
    return items;
  });

  readonly pageItems = computed(() => this.filteredItems().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));
  readonly filterOptions = computed(() => [
    { id: 'no', label: 'Da registrare', count: this.items().filter((item) => !item.checkin_effettuato).length },
    { id: 'yes', label: 'Presenti', count: this.items().filter((item) => item.checkin_effettuato).length },
    { id: 'expired', label: 'Documento scaduto', count: this.items().filter((item) => item.document_expired).length },
    { id: 'all', label: 'Tutti', count: this.items().length },
  ]);

  ngOnInit(): void { this.load(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refreshTick'] && !changes['refreshTick'].firstChange) {
      this.load();
    }
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.load(), 300);
  }

  onCheckinChange(value: 'all' | 'yes' | 'no'): void {
    this.checkin.set(value);
    this.page.set(0);
    this.load();
  }

  setFilter(value: string): void {
    this.selectedFilter.set(value);
    this.page.set(0);
    this.checkin.set('all');
    this.expiredOnly.set(false);
  }

  changePageSize(size: number): void { this.pageSize.set(size); this.page.set(0); }

  requestToggle(item: CandidateSummary): void {
    if (item.checkin_effettuato) this.pendingToggle.set(item);
    else this.toggle(item);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new URLSearchParams({ q: this.query(), checkin: this.checkin(), mode: this.viewMode() });
    this.api
      .get<ApiList<CandidateSummary>>(`/sessioni/${this.sessionId()}/candidati?${params}`)
      .subscribe({
        next: ({ items }) => {
          this.items.set(items);
          this.loading.set(false);
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
      next: () => {
        this.mutationUid.set(null);
        this.load();
      },
      error: () => {
        this.mutationUid.set(null);
        this.message.set('Aggiornamento del check-in non riuscito.');
      },
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
