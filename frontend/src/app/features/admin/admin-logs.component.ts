import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { sessionStateLabel } from '../../shared/session-states';

type LogRow = Record<string, unknown>;

interface LogsResponse {
  limit: number;
  system_errors: LogRow[];
  email_logs: LogRow[];
  session_state_logs: LogRow[];
  exam_state_logs: LogRow[];
}

@Component({
  selector: 'app-admin-logs',
  imports: [FormsModule],
  template: `
    <section class="container my-5" aria-labelledby="admin-logs-title">
      <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
        <div>
          <h2 id="admin-logs-title" class="h2 mb-0">Log di sistema</h2>
        </div>
        <form class="d-flex flex-wrap gap-2" (ngSubmit)="load()">
          <label class="visually-hidden" for="logs-limit">Numero di record</label>
          <select id="logs-limit" class="form-select" name="limit" [(ngModel)]="limit">
            <option [ngValue]="200">Ultimi 200</option><option [ngValue]="500">Ultimi 500</option><option [ngValue]="1000">Ultimi 1000</option>
          </select>
          <button class="btn btn-outline-primary" type="submit" [disabled]="loading()">
            @if (loading()) {
              <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
            }
            <span>Aggiorna</span>
          </button>
        </form>
      </div>
      <div class="mb-4"><label class="form-label" for="logs-search">Cerca nei registri</label><input id="logs-search" class="form-control" type="search" placeholder="Sessione, stato, email o testo" [ngModel]="query()" (ngModelChange)="query.set($event)" name="search" /></div>

      @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
      @if (loading()) {
        <div class="d-flex align-items-center gap-2 py-2" role="status" aria-live="polite">
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <span>Caricamento log…</span>
        </div>
      }

      @for (section of sections(); track section.title) {
        <section class="card mb-4" [attr.aria-labelledby]="section.id">
          <div class="card-header d-flex justify-content-between align-items-center"><h3 class="h5 mb-0" [id]="section.id">{{ section.title }}</h3><span class="badge text-bg-light">{{ section.items.length }}</span></div>
          @if (section.items.length) {
            <div class="list-group list-group-flush">
              @for (row of section.items; track $index) {
                <article class="list-group-item">
                  <div class="d-flex flex-wrap justify-content-between gap-2 mb-2"><strong>{{ section.summary(row) }}</strong><time class="small text-muted">{{ formatDate(section.timestamp(row)) }}</time></div>
                  <div class="row g-2 small">
                    @for (field of section.fields(row); track field.key) {
                      <div class="col-12 col-md-6 col-xl-4"><span class="text-muted">{{ field.label }}:</span>
                        @if (isStateKey(field.key)) { <span class="ms-1">{{ readableState(field.value) }}</span><code class="d-block text-muted">{{ display(field.value) }}</code> }
                        @else { <span class="ms-1">{{ display(field.value) }}</span> }
                      </div>
                    }
                  </div>
                </article>
              }
            </div>
          } @else {
            <div class="card-body text-center py-4"><span class="fs-3" aria-hidden="true">✓</span><p class="mb-0">Nessun record registrato.</p></div>
          }
        </section>
      }
    </section>
  `,
})
export class AdminLogsComponent {
  private readonly api = inject(ApiClient);
  readonly data = signal<LogsResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  limit = 200;

  readonly sections = computed(() => {
    const data = this.data();
    const query = this.query().trim().toLocaleLowerCase();
    const all = [
      {
        id: 'system-errors', title: 'Errori tecnici',
        items: data?.system_errors ?? [],
        summary: (row: LogRow) => this.display(row['error_type'] ?? 'Errore tecnico'),
        timestamp: (row: LogRow) => row['created_at'],
        fields: (row: LogRow) => this.fields(row, ['source', 'actor_email', 'raw_error', 'context_json']),
      },
      {
        id: 'email-logs', title: 'Email inviate',
        items: data?.email_logs ?? [],
        summary: (row: LogRow) => `Invio email · ${this.display(row['smtp_status'] ?? 'esito non disponibile')}`,
        timestamp: (row: LogRow) => row['sent_at'],
        fields: (row: LogRow) => this.fields(row, ['prove_id', 'sent_by', 'to_emails', 'cc_emails', 'smtp_status']),
      },
      {
        id: 'state-logs', title: 'Cambi di stato',
        items: [...(data?.session_state_logs ?? []), ...(data?.exam_state_logs ?? [])],
        summary: (row: LogRow) => `Sessione ${this.display(row['session_id'] ?? row['prove_id'] ?? '')}`,
        timestamp: (row: LogRow) => row['timestamp'],
        fields: (row: LogRow) => this.fields(row, ['session_id', 'prove_id', 'stato', 'from_state', 'to_state', 'utente', 'payload_json']),
      },
    ];
    return all.map((section) => ({ ...section, items: section.items.filter((row) => !query || Object.values(row).some((value) => this.display(value).toLocaleLowerCase().includes(query))) }));
  });

  constructor() { this.load(); }

  load(): void {
    this.limit = Math.max(1, Math.min(Number(this.limit) || 200, 1000));
    this.loading.set(true);
    this.error.set('');
    this.api.get<LogsResponse>(`/admin/logs?limit=${this.limit}`).subscribe({
      next: (data) => { this.data.set(data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Caricamento dei log non riuscito.'); },
    });
  }

  display(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  formatDate(value: unknown): string {
    if (!value) return 'Data non disponibile';
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? this.display(value) : new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }
  isStateKey(key: string): boolean { return ['stato', 'from_state', 'to_state'].includes(key); }
  readableState(value: unknown): string { return sessionStateLabel(String(value ?? '')); }
  private fields(row: LogRow, keys: string[]): Array<{ key: string; label: string; value: unknown }> {
    const labels: Record<string, string> = { source: 'Sorgente', actor_email: 'Utente', raw_error: 'Dettaglio', context_json: 'Contesto', prove_id: 'Prova', sent_by: 'Inviato da', to_emails: 'Destinatari', cc_emails: 'In copia', smtp_status: 'Esito email', session_id: 'Sessione', stato: 'Stato', from_state: 'Stato precedente', to_state: 'Nuovo stato', utente: 'Utente', payload_json: 'Dettaglio' };
    return keys.filter((key) => row[key] !== null && row[key] !== undefined && row[key] !== '').map((key) => ({ key, label: labels[key] ?? key, value: row[key] }));
  }
}
