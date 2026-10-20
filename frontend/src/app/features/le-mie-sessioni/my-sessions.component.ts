import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { AuthService } from '../../core/auth.service';
import { availableProfiles } from '../../core/profile.service';
import { AssignedSessionSummary, AssignedSessionsResponse } from '../../core/models/api.models';
import { sessionStateLabel } from '../../shared/session-states';
import { FilterChipOption, FilterChipsComponent } from '../../shared/filter-chips.component';
import { PagerComponent } from '../../shared/pager.component';
import { competitionLabel } from '../../shared/competition-label';

type SessionFilter = 'upcoming' | 'past';

@Component({
  selector: 'app-my-sessions',
  imports: [RouterLink, FormsModule, FilterChipsComponent, PagerComponent],
  template: `
    <div class="container py-4 py-lg-5">
      <h1 class="mb-1">Le mie sessioni</h1>
      <p class="lead text-secondary mb-4">Sessioni in cui sei indicato come <strong class="text-body">{{ roleLabel() }}</strong>
        @if (multiProfile()) { · <a routerLink="/">cambia profilo</a> }</p>

      @if (error()) { <div class="alert alert-warning" role="alert">{{ error() }}</div> }
      @if (loading() && items().length === 0) {
        <p class="d-flex align-items-center gap-2" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Carico le sessioni…</p>
      } @else {
        @for (item of highlighted(); track item.session_id) {
          <section class="card app-today mb-4" [attr.aria-labelledby]="'oggi-' + item.session_id"><div class="card-body d-flex flex-wrap align-items-center gap-4">
            <div class="app-datebox" [class.app-datebox--today]="isToday(item)" aria-hidden="true"><span>{{ isToday(item) ? 'Oggi' : shortDate(item.date) }}</span><strong>{{ item.time.slice(0, 5) }}</strong></div>
            <div class="flex-grow-1 app-minw">
              <p class="app-eyebrow mb-1" [id]="'oggi-' + item.session_id">{{ isToday(item) ? 'In corso oggi' : 'La tua prossima sessione' }}</p>
              <h2 class="h3 mb-1">{{ item.name }}</h2>
              <p class="mb-1 text-secondary">{{ competitionLabel(item.bando_title, item.commission_id) }}@if (item.location) { · {{ item.location }} }</p>
              <p class="mb-0"><span class="app-state-pill">Stato: <strong>{{ stateLabel(item.current_state) }}</strong></span>
                @if (item.open_reset_count > 0) { <span class="badge app-badge-warning ms-1">{{ resetLabel(item.open_reset_count) }}</span> }</p>
            </div>
            <a class="btn btn-primary btn-lg" [routerLink]="['/sessioni', item.session_id]" [queryParams]="{ mode: routeMode() }">Apri sessione</a>
          </div></section>
        } @empty {
          <section class="app-empty bg-white mb-4" role="status"><p class="fw-semibold mb-1">Nessuna sessione in programma</p><p class="mb-0 text-secondary">Le sessioni assegnate compariranno qui quando il segretario o il referente ti indicheranno.</p></section>
        }

        <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
          <app-filter-chips label="Filtra sessioni" [options]="filterOptions()" [selected]="filter()" (selectedChange)="setFilter($event)" />
          <div class="form-group mb-0 app-search"><label for="ms" class="active">Cerca sessione</label>
            <input type="search" class="form-control" id="ms" placeholder="Nome, concorso o sede" [ngModel]="query()" (ngModelChange)="query.set($event); page.set(0)" /></div>
        </div>
        <div class="card card-bg no-after"><div class="card-body p-0"><div class="table-responsive"><table class="table align-middle mb-0 app-table">
          <thead><tr><th scope="col">Data</th><th scope="col">Sessione</th><th scope="col">Stato</th><th scope="col">{{ mode() === 'sede' ? 'Reset segnalati' : 'Reset da fare' }}</th><th scope="col" class="text-end"><span class="visually-hidden">Azioni</span></th></tr></thead>
          <tbody>
            @for (item of pageItems(); track item.session_id) {
              <tr [class.app-row-today]="isToday(item)">
                <td class="app-num-cell"><strong>{{ isToday(item) ? 'Oggi' : shortDate(item.date) }}</strong><br>{{ item.time.slice(0, 5) }}</td>
                <td><a class="fw-semibold" [routerLink]="['/sessioni', item.session_id]" [queryParams]="{ mode: routeMode() }">{{ item.name }}</a><br>
                  <span class="small text-secondary">{{ competitionLabel(item.bando_title, item.commission_id) }}@if (item.location) { · {{ item.location }} }</span></td>
                <td>{{ stateLabel(item.current_state) }}</td>
                <td class="app-num-cell">{{ item.open_reset_count ? resetLabel(item.open_reset_count) : '—' }}</td>
                <td class="text-end"><a class="btn btn-sm" [class.btn-primary]="isToday(item)" [class.btn-outline-primary]="!isToday(item)" [routerLink]="['/sessioni', item.session_id]" [queryParams]="{ mode: routeMode() }">Apri sessione</a></td>
              </tr>
            } @empty { <tr><td colspan="5" class="text-secondary">Nessuna sessione corrisponde ai filtri.</td></tr> }
          </tbody>
        </table></div></div></div>
        <app-pager label="Sessioni" [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="setPageSize($event)" />
      }
    </div>
  `,
})
export class MySessionsComponent {
  readonly competitionLabel = competitionLabel;
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  readonly mode = signal<'sede' | 'expert'>('sede');
  readonly items = signal<AssignedSessionSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filter = signal<SessionFilter>('upcoming');
  readonly query = signal('');
  readonly page = signal(0);
  readonly pageSize = signal(10);
  readonly routeMode = computed(() => this.mode());
  readonly filterOptions = computed<FilterChipOption[]>(() => [
    { id: 'upcoming', label: 'Da oggi in poi', count: this.items().filter((item) => this.isUpcoming(item)).length },
    { id: 'past', label: 'Passate', count: this.items().filter((item) => !this.isUpcoming(item)).length },
  ]);
  /** Le sessioni di oggi in ordine di ora; se non ce ne sono, la prossima in arrivo (FR-033). */
  readonly highlighted = computed(() => this.todaySessions().length ? this.todaySessions() : (this.nextSession() ? [this.nextSession()!] : []));
  readonly multiProfile = computed(() => availableProfiles(this.auth.user()).length > 1);
  readonly roleLabel = computed(() => this.mode() === 'sede' ? 'Informatico in sede' : 'Esperto remoto');
  readonly todaySessions = computed(() => this.items().filter((item) => this.isToday(item)).sort((a, b) => `${a.time}`.localeCompare(`${b.time}`)));
  readonly nextSession = computed(() => this.items().filter((item) => this.isUpcoming(item)).sort((a, b) => this.sortKey(a).localeCompare(this.sortKey(b)))[0] ?? null);
  readonly filteredItems = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.items().filter((item) => (this.filter() === 'upcoming' ? this.isUpcoming(item) : !this.isUpcoming(item)))
      .filter((item) => !query || [item.name, item.bando_title, item.commission_id, item.location].some((value) => value?.toLocaleLowerCase().includes(query)))
      .sort((a, b) => (this.filter() === 'past' ? -1 : 1) * this.sortKey(a).localeCompare(this.sortKey(b)));
  });
  readonly pageItems = computed(() => this.filteredItems().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.mode.set(params.get('mode') === 'expert' ? 'expert' : 'sede');
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.get<AssignedSessionsResponse>(`/sessioni/assegnate?mode=${this.mode()}`).subscribe({
      next: (response) => { this.items.set(response.items ?? []); this.loading.set(false); this.page.set(0); },
      error: () => { this.error.set('Non è stato possibile caricare le sessioni assegnate. Riprova.'); this.loading.set(false); },
    });
  }

  setFilter(value: string): void { this.filter.set(value === 'past' ? 'past' : 'upcoming'); this.page.set(0); }
  setPageSize(value: number): void { this.pageSize.set(value); this.page.set(0); }
  stateLabel(state: string): string { return sessionStateLabel(state); }
  resetLabel(count: number): string { return `${count} reset ${this.mode() === 'sede' ? 'in attesa' : 'da fare'}`; }
  shortDate(value: string): string { return this.formatDate(value).slice(0, 5); }
  formatDate(value: string): string {
    const parsed = this.dateValue(value);
    return parsed ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed) : value;
  }
  private isUpcoming(item: AssignedSessionSummary): boolean { return this.dateKey(item.date) >= this.todayKey(); }
  isToday(item: AssignedSessionSummary): boolean { return this.dateKey(item.date) === this.todayKey(); }
  private sortKey(item: AssignedSessionSummary): string { return `${this.dateKey(item.date)} ${item.time ?? ''}`; }
  private dateKey(value: string): string {
    const parsed = this.dateValue(value);
    return parsed ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` : value.slice(0, 10);
  }
  private todayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  private dateValue(value: string): Date | null {
    if (!value) return null;
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
