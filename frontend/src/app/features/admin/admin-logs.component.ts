import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ItIconComponent } from 'design-angular-kit';
import { ApiClient } from '../../core/api-client';
import { sessionStateLabel } from '../../shared/session-states';

type LogRow = Record<string, unknown>;

interface LogSection {
  id: string;
  title: string;
  empty: string;
  columns: string[];
  items: LogRow[];
  timestamp: (row: LogRow) => unknown;
  cells: (row: LogRow) => Array<{ main: string; code?: string }>;
}

interface LogsResponse {
  limit: number;
  system_errors: LogRow[];
  email_logs: LogRow[];
  session_state_logs: LogRow[];
  exam_state_logs: LogRow[];
}

@Component({
  selector: 'app-admin-logs',
  imports: [FormsModule, ItIconComponent],
  template: `
    <h1 class="mb-3">Log di sistema</h1>
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
      <p class="mb-0 text-secondary">Ultimi record di ogni registro, dal più recente.</p>
      <form class="d-flex gap-2 align-items-end" (ngSubmit)="load()">
        <div class="select-wrapper app-perpage"><label for="logs-limit">Record</label>
          <select id="logs-limit" name="limit" [(ngModel)]="limit">
            <option [ngValue]="200">Ultimi 200</option><option [ngValue]="500">Ultimi 500</option><option [ngValue]="1000">Ultimi 1000</option>
          </select></div>
        <button class="btn btn-outline-primary btn-icon gap-1" type="submit" [disabled]="loading()"><it-icon name="restore" size="sm" color="primary" /><span>Aggiorna</span></button>
      </form>
    </div>
    <ul class="nav nav-tabs mb-3" role="tablist">
      @for (section of sections(); track section.id) {
        <li class="nav-item" role="presentation">
          <button type="button" class="nav-link" role="tab" [id]="'tab-' + section.id" [class.active]="section.id === active()" [attr.aria-selected]="section.id === active()" [attr.aria-controls]="'panel-' + section.id" (click)="active.set(section.id)">{{ section.title }} · {{ section.items.length }}</button>
        </li>
      }
    </ul>
    <div class="d-flex flex-wrap gap-3 mt-4 mb-3">
      <div class="form-group mb-0 app-search"><label for="lg-q" class="active">Cerca</label>
        <input type="search" class="form-control" id="lg-q" placeholder="Sessione, utente o testo" [ngModel]="query()" (ngModelChange)="query.set($event)" name="search" /></div>
    </div>
    @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
    @if (loading()) { <p class="d-flex align-items-center gap-2" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Carico i log…</p> }
    @if (current(); as section) {
      <div role="tabpanel" [id]="'panel-' + section.id" [attr.aria-labelledby]="'tab-' + section.id">
        @if (section.items.length) {
          <div class="card card-bg no-after"><div class="card-body p-0"><div class="table-responsive"><table class="table align-middle mb-0 app-table">
            <thead><tr>@for (column of section.columns; track column) { <th scope="col">{{ column }}</th> }</tr></thead>
            <tbody>
              @for (row of section.items; track $index) {
                <tr>
                  <td class="app-num-cell">{{ day(section.timestamp(row)) }}<br>{{ time(section.timestamp(row)) }}</td>
                  @for (cell of section.cells(row); track $index) {
                    <td class="text-break">{{ cell.main }}@if (cell.code) { <br><span class="small text-secondary app-mono">{{ cell.code }}</span> }</td>
                  }
                </tr>
              }
            </tbody>
          </table></div></div></div>
        } @else {
          <div class="app-empty"><it-icon name="check-circle" size="lg" /><p class="fw-semibold mb-1">{{ section.empty }}</p></div>
        }
      </div>
    }
  `,
})
export class AdminLogsComponent {
  private readonly api = inject(ApiClient);
  readonly data = signal<LogsResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly query = signal('');
  limit = 200;

  readonly active = signal('state-logs');

  /** Un registro per scheda (P20): nomi leggibili con il codice tecnico sotto. */
  readonly sections = computed(() => {
    const data = this.data();
    const query = this.query().trim().toLocaleLowerCase();
    const all: LogSection[] = [
      {
        id: 'state-logs', title: 'Cambi di stato', empty: 'Nessun cambio di stato registrato',
        columns: ['Quando', 'Sessione', 'Stato', 'Utente'],
        items: [...(data?.session_state_logs ?? []), ...(data?.exam_state_logs ?? [])],
        timestamp: (row) => row['timestamp'],
        cells: (row) => [
          { main: this.shortId(row['session_id'] ?? row['prove_id']) },
          { main: this.readableState(row['stato'] ?? row['to_state']), code: this.display(row['stato'] ?? row['to_state']) },
          { main: this.display(row['utente']) },
        ],
      },
      {
        id: 'email-logs', title: 'Email inviate', empty: 'Nessuna email registrata',
        columns: ['Quando', 'Destinatari', 'Inviata da', 'Esito'],
        items: data?.email_logs ?? [],
        timestamp: (row) => row['sent_at'],
        cells: (row) => [
          { main: this.display(row['to_emails']), code: row['cc_emails'] ? 'cc: ' + this.display(row['cc_emails']) : '' },
          { main: this.display(row['sent_by']) },
          { main: this.display(row['smtp_status']) },
        ],
      },
      {
        id: 'system-errors', title: 'Errori tecnici', empty: 'Nessun errore tecnico registrato',
        columns: ['Quando', 'Errore', 'Utente', 'Dettaglio'],
        items: data?.system_errors ?? [],
        timestamp: (row) => row['created_at'],
        cells: (row) => [
          { main: this.display(row['error_type'] ?? 'Errore tecnico'), code: this.display(row['source']) },
          { main: this.display(row['actor_email']) },
          { main: this.display(row['raw_error']).slice(0, 240) },
        ],
      },
    ];
    return all.map((section) => ({ ...section, items: section.items.filter((row) => !query || Object.values(row).some((value) => this.display(value).toLocaleLowerCase().includes(query))) }));
  });
  readonly current = computed(() => this.sections().find((section) => section.id === this.active()) ?? null);

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

  day(value: unknown): string {
    const date = value ? new Date(String(value)) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('it-IT') : '—';
  }
  time(value: unknown): string {
    const date = value ? new Date(String(value)) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('it-IT') : '';
  }
  shortId(value: unknown): string {
    const text = this.display(value);
    return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-5)}` : text;
  }
  readableState(value: unknown): string { return sessionStateLabel(String(value ?? '')); }
}
