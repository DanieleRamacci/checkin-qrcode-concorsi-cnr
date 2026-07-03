import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient } from '../../core/api-client';

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
  imports: [FormsModule, RouterLink],
  template: `
    <section class="container my-5" aria-labelledby="admin-logs-title">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h1 id="admin-logs-title" class="mb-0">Log sistema</h1>
          <a routerLink="/admin/permessi">Torna alla gestione permessi</a>
        </div>
        <form class="d-flex gap-2" (ngSubmit)="load()">
          <label class="visually-hidden" for="logs-limit">Numero massimo record</label>
          <input id="logs-limit" class="form-control" type="number" min="1" max="1000" name="limit" [(ngModel)]="limit" />
          <button class="btn btn-outline-primary" type="submit" [disabled]="loading()">Aggiorna</button>
        </form>
      </div>
      <p class="text-muted">Sono mostrati gli ultimi {{ limit }} record per tabella.</p>

      @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
      @if (loading()) { <p role="status">Caricamento log…</p> }

      @for (section of sections(); track section.title) {
        <h2 class="h5 mt-4">{{ section.title }}</h2>
        <div class="table-responsive mb-4">
          <table class="table table-striped table-sm align-middle">
            <thead class="table-light">
              <tr>@for (column of section.columns; track column.key) { <th>{{ column.label }}</th> }</tr>
            </thead>
            <tbody>
              @for (row of section.items; track row['id']) {
                <tr>
                  @for (column of section.columns; track column.key) {
                    <td>
                      @if (column.code) {
                        <code>{{ display(row[column.key]) }}</code>
                      } @else {
                        {{ display(row[column.key]) }}
                      }
                    </td>
                  }
                </tr>
              } @empty {
                <tr><td [attr.colspan]="section.columns.length">Nessun record registrato.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class AdminLogsComponent {
  private readonly api = inject(ApiClient);
  readonly data = signal<LogsResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  limit = 200;

  readonly sections = computed(() => {
    const data = this.data();
    return [
      {
        title: 'Errori tecnici raw (system_error_log)',
        items: data?.system_errors ?? [],
        columns: [
          { key: 'created_at', label: 'Quando' },
          { key: 'source', label: 'Sorgente', code: true },
          { key: 'actor_email', label: 'Utente' },
          { key: 'error_type', label: 'Tipo' },
          { key: 'raw_error', label: 'Errore raw', code: true },
          { key: 'context_json', label: 'Context', code: true },
        ],
      },
      {
        title: 'Log invii email prove (prove_emails_log)',
        items: data?.email_logs ?? [],
        columns: [
          { key: 'sent_at', label: 'Quando' },
          { key: 'prove_id', label: 'Prova' },
          { key: 'sent_by', label: 'By' },
          { key: 'to_emails', label: 'To' },
          { key: 'cc_emails', label: 'CC' },
          { key: 'smtp_status', label: 'Stato SMTP', code: true },
        ],
      },
      {
        title: 'Log stati sessione (session_state_log)',
        items: data?.session_state_logs ?? [],
        columns: [
          { key: 'timestamp', label: 'Quando' },
          { key: 'session_id', label: 'Sessione' },
          { key: 'stato', label: 'Stato' },
          { key: 'utente', label: 'Utente' },
        ],
      },
      {
        title: 'Log stati prove (prove_state_log)',
        items: data?.exam_state_logs ?? [],
        columns: [
          { key: 'timestamp', label: 'Quando' },
          { key: 'prove_id', label: 'Prova' },
          { key: 'from_state', label: 'Da' },
          { key: 'to_state', label: 'A' },
          { key: 'utente', label: 'Utente' },
          { key: 'payload_json', label: 'Payload', code: true },
        ],
      },
    ];
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
}
