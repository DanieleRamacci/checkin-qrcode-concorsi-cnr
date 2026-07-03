import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';
import { ApiClient } from '../../core/api-client';
import { ApiList, CandidateSummary } from '../../core/models/api.models';

export function candidateQrPayload(uid: string): string {
  return JSON.stringify({ uid });
}

@Component({
  selector: 'app-candidati',
  imports: [FormsModule],
  template: `
    <div class="it-card-wrapper">
      <div class="it-card shadow-sm p-4">
        <h5 class="mb-3">Elenco candidati</h5>

        <div class="d-flex justify-content-end mb-2">
          <button class="btn btn-outline-primary btn-sm" type="button" [disabled]="loading()" (click)="load()">Aggiorna</button>
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
                  <th>Check-in</th>
                  <th class="text-nowrap">Azioni</th>
                </tr>
              </thead>
              <tbody>
                @for (item of filteredItems(); track item.uid; let i = $index) {
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
                        <span class="badge bg-success">Effettuato</span>
                      } @else {
                        <span class="badge bg-secondary">Non effettuato</span>
                      }
                    </td>
                    <td class="text-nowrap">
                      <button class="btn btn-sm btn-outline-dark me-1" type="button"
                        title="Mostra QR candidato" [attr.aria-label]="'Mostra QR candidato ' + item.first_name + ' ' + item.last_name"
                        (click)="showQr(item)">
                        QR
                      </button>
                      <button
                        [class]="'btn btn-sm text-nowrap ' + (item.checkin_effettuato ? 'btn-outline-danger' : 'btn-outline-success')"
                        style="white-space: nowrap;"
                        type="button"
                        [disabled]="mutationUid() === item.uid"
                        (click)="toggle(item)"
                      >
                        {{ item.checkin_effettuato ? 'Disabilita' : 'Conferma' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (message()) { <p role="status">{{ message() }}</p> }
      </div>
    </div>

    @if (selectedCandidate(); as candidate) {
      <div class="modal candidate-qr-modal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="candidateQrTitle">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
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
  `,
  styles: `
    .candidate-qr-modal { display: block; background: rgba(0, 0, 0, 0.5); }
    .candidate-qr { image-rendering: pixelated; }
  `,
})
export class CandidatiComponent {
  readonly sessionId = input.required<string>();
  private readonly api = inject(ApiClient);
  readonly items = signal<CandidateSummary[]>([]);
  readonly message = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly mutationUid = signal<string | null>(null);
  readonly selectedCandidate = signal<CandidateSummary | null>(null);
  readonly qrDataUrl = signal('');
  readonly qrLoading = signal(false);
  readonly query = signal('');
  readonly sort = signal<'alpha' | 'checkin_no' | 'checkin_yes'>('alpha');
  readonly checkin = signal<'all' | 'yes' | 'no'>('all');
  readonly expiredOnly = signal(false);
  private searchDebounce?: ReturnType<typeof setTimeout>;

  readonly filteredItems = computed(() => {
    let items = this.items();
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

  ngOnInit(): void { this.load(); }

  onQueryChange(value: string): void {
    this.query.set(value);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.load(), 300);
  }

  onCheckinChange(value: 'all' | 'yes' | 'no'): void {
    this.checkin.set(value);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params = new URLSearchParams({ q: this.query(), checkin: this.checkin() });
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
    this.mutationUid.set(item.uid);
    this.message.set('');
    this.api.post<CandidateSummary>(`/sessioni/${this.sessionId()}/candidati/${encodeURIComponent(item.uid)}/toggle-checkin`).subscribe({
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
}
