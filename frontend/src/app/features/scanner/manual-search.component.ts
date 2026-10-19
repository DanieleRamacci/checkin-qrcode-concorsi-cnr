import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { ScannerCandidateSearchResult } from '../../core/models/api.models';

@Component({
  selector: 'app-manual-search',
  imports: [FormsModule],
  template: `
    <form class="scanner-search" (submit)="$event.preventDefault(); search()">
      <label for="scanner-search-input" class="form-label">Cerca per nome, cognome o numero di documento</label>
      <div class="input-group"><input id="scanner-search-input" class="form-control" [(ngModel)]="query" name="query" minlength="2" autocomplete="off" />
        <button class="btn btn-primary" type="submit" [disabled]="query.trim().length < 2 || loading()">Cerca</button></div>
    </form>
    @if (error()) { <p class="alert alert-warning mt-2" role="status">{{ error() }}</p> }
    @if (results().length) { <ul class="list-group mt-2" aria-label="Risultati ricerca">
      @for (item of results(); track item.uid) { <li class="list-group-item d-flex justify-content-between align-items-center gap-2">
        <span>{{ item.last_name }} {{ item.first_name }} · {{ item.document_number }} · {{ item.checkin_effettuato ? 'Presente' : 'Da registrare' }}</span>
        <button class="btn btn-sm btn-outline-primary" type="button" (click)="candidateSelected.emit(item.uid)">Apri scheda</button>
      </li> }
    </ul> }
  `,
})
export class ManualSearchComponent {
  readonly sessionId = input.required<string>();
  readonly deviceToken = input.required<string>();
  readonly candidateSelected = output<string>();
  private readonly api = inject(ApiClient);
  readonly results = signal<ScannerCandidateSearchResult[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  query = '';

  search(): void {
    if (this.query.trim().length < 2) return;
    this.loading.set(true); this.error.set('');
    this.api.post<{ items: ScannerCandidateSearchResult[] }>('/scanner/search-candidates', {
      session_id: this.sessionId(), device_token: this.deviceToken(), q: this.query.trim(),
    }).subscribe({
      next: ({ items }) => { this.results.set(items); this.loading.set(false); if (!items.length) this.error.set('Nessun candidato trovato.'); },
      error: () => { this.loading.set(false); this.error.set('Ricerca non riuscita. Verifica il testo e riprova.'); },
    });
  }
}
