import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
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
    <main class="container my-5">
      <p class="small text-muted mb-1">Home / Le mie sessioni</p>
      <h1 class="mb-2">Le mie sessioni</h1>
      <p class="lead mb-4">{{ mode() === 'sede' ? 'Sessioni assegnate al supporto informatico in sede.' : 'Sessioni assegnate all’esperto remoto.' }}</p>

      @if (error()) {
        <div class="alert alert-warning" role="alert">{{ error() }}</div>
      }
      @if (loading() && items().length === 0) {
        <p class="d-flex align-items-center gap-2" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Caricamento sessioni…</p>
      } @else {
        @if (todaySessions().length) {
          <section class="mb-5" aria-labelledby="oggi-title">
            <h2 id="oggi-title" class="h3 mb-3">In corso oggi</h2>
            <div class="row g-3">
              @for (item of todaySessions(); track item.session_id) {
                <div class="col-12" [class.col-lg-6]="todaySessions().length > 1">
                  <article class="card h-100 border-primary">
                    <div class="card-body">
                      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
                        <div><p class="small text-muted mb-1">{{ item.time }} · {{ item.location || 'Sede non indicata' }}</p><h3 class="h5 mb-1">{{ item.name }}</h3><p class="mb-2">{{ competitionLabel(item.bando_title, item.commission_id) }}</p></div>
                        <span class="badge text-bg-light">{{ stateLabel(item.current_state) }}</span>
                      </div>
                      @if (item.open_reset_count > 0) {
                        <p class="mb-3"><span class="badge text-bg-warning">{{ item.open_reset_count }} reset {{ mode() === 'sede' ? 'in attesa' : 'da fare' }}</span></p>
                      }
                      <a class="btn btn-primary" [routerLink]="['/sessioni', item.session_id]" [queryParams]="{ mode: routeMode() }">Apri sessione</a>
                    </div>
                  </article>
                </div>
              }
            </div>
          </section>
        } @else if (nextSession(); as item) {
          <section class="mb-5" aria-labelledby="prossima-title">
            <h2 id="prossima-title" class="h3 mb-3">Prossima sessione</h2>
            <article class="card border-primary"><div class="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div><p class="small text-muted mb-1">{{ formatDate(item.date) }} · {{ item.time }} · {{ item.location || 'Sede non indicata' }}</p><h3 class="h5 mb-1">{{ item.name }}</h3><p class="mb-0">{{ competitionLabel(item.bando_title, item.commission_id) }}</p></div>
              <div class="d-flex align-items-center gap-3"><span class="badge text-bg-light">{{ stateLabel(item.current_state) }}</span><a class="btn btn-primary" [routerLink]="['/sessioni', item.session_id]" [queryParams]="{ mode: routeMode() }">Apri sessione</a></div>
            </div></article>
          </section>
        } @else {
          <section class="app-empty text-center py-4 mb-5" role="status"><h2 class="h4">Nessuna sessione in programma</h2><p class="mb-0">Le sessioni assegnate compariranno qui quando saranno disponibili.</p></section>
        }

        <section aria-labelledby="tutte-title">
          <h2 id="tutte-title" class="h3 mb-3">Tutte le sessioni assegnate</h2>
          <div class="row align-items-end g-3 mb-3">
            <div class="col-12 col-lg-6"><label class="form-label" for="session-search">Cerca sessione</label><input id="session-search" class="form-control" type="search" placeholder="Sessione, concorso o sede" [ngModel]="query()" (ngModelChange)="query.set($event); page.set(1)" /></div>
            <div class="col-12 col-lg-6"><app-filter-chips label="Filtra sessioni" [options]="filterOptions()" [selected]="filter()" (selectedChange)="setFilter($event)" /></div>
          </div>
          <div class="table-responsive"><table class="table table-striped table-hover align-middle">
            <thead><tr><th>Data</th><th>Sessione</th><th>Concorso</th><th>Sede</th><th>Stato</th><th>Reset aperti</th><th>Azioni</th></tr></thead>
            <tbody>
              @for (item of pageItems(); track item.session_id) {
                <tr><td>{{ formatDate(item.date) }}<br /><span class="small text-muted">{{ item.time }}</span></td><th scope="row">{{ item.name }}</th><td>{{ competitionLabel(item.bando_title, item.commission_id) }}</td><td>{{ item.location || '—' }}</td><td>{{ stateLabel(item.current_state) }}</td><td>{{ item.open_reset_count || '—' }}</td><td><a class="btn btn-sm btn-primary" [routerLink]="['/sessioni', item.session_id]" [queryParams]="{ mode: routeMode() }">Apri sessione</a></td></tr>
              } @empty { <tr><td colspan="7" class="text-center py-4">Nessuna sessione corrisponde ai filtri.</td></tr> }
            </tbody>
          </table></div>
          <app-pager label="Sessioni" [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="setPageSize($event)" />
        </section>
      }
    </main>
  `,
})
export class MySessionsComponent {
  readonly competitionLabel = competitionLabel;
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  readonly mode = signal<'sede' | 'expert'>('sede');
  readonly items = signal<AssignedSessionSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filter = signal<SessionFilter>('upcoming');
  readonly query = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly routeMode = computed(() => this.mode());
  readonly filterOptions = computed<FilterChipOption[]>(() => [
    { id: 'upcoming', label: 'Da oggi in poi', count: this.items().filter((item) => this.isUpcoming(item)).length },
    { id: 'past', label: 'Passate', count: this.items().filter((item) => !this.isUpcoming(item)).length },
  ]);
  readonly todaySessions = computed(() => this.items().filter((item) => this.isToday(item)).sort((a, b) => `${a.time}`.localeCompare(`${b.time}`)));
  readonly nextSession = computed(() => this.items().filter((item) => this.isUpcoming(item)).sort((a, b) => this.sortKey(a).localeCompare(this.sortKey(b)))[0] ?? null);
  readonly filteredItems = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.items().filter((item) => (this.filter() === 'upcoming' ? this.isUpcoming(item) : !this.isUpcoming(item)))
      .filter((item) => !query || [item.name, item.bando_title, item.commission_id, item.location].some((value) => value?.toLocaleLowerCase().includes(query)))
      .sort((a, b) => this.sortKey(a).localeCompare(this.sortKey(b)));
  });
  readonly pageItems = computed(() => this.filteredItems().slice((this.page() - 1) * this.pageSize(), this.page() * this.pageSize()));

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
      next: (response) => { this.items.set(response.items ?? []); this.loading.set(false); this.page.set(1); },
      error: () => { this.error.set('Non è stato possibile caricare le sessioni assegnate. Riprova.'); this.loading.set(false); },
    });
  }

  setFilter(value: string): void { this.filter.set(value === 'past' ? 'past' : 'upcoming'); this.page.set(1); }
  setPageSize(value: number): void { this.pageSize.set(value); this.page.set(1); }
  stateLabel(state: string): string { return sessionStateLabel(state); }
  formatDate(value: string): string {
    const parsed = this.dateValue(value);
    return parsed ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed) : value;
  }
  private isUpcoming(item: AssignedSessionSummary): boolean { return this.dateKey(item.date) >= this.todayKey(); }
  private isToday(item: AssignedSessionSummary): boolean { return this.dateKey(item.date) === this.todayKey(); }
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
