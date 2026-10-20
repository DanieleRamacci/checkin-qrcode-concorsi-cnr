import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BandoSummary } from '../../core/models/api.models';
import { FilterChipsComponent, FilterChipOption } from '../../shared/filter-chips.component';
import { PagerComponent } from '../../shared/pager.component';
import { competitionLabel } from '../../shared/competition-label';
import { sessionWhen } from '../../shared/session-date';

type BandoFilter = 'upcoming' | 'incomplete' | 'all';

/** "Dati da Selezioni Online aggiornati oggi alle 10:19" dal più recente aggiornamento dei concorsi. */
export function bandiSyncLine(items: BandoSummary[], now = new Date()): string {
  const latest = items.map((bando) => bando.last_sync).filter((value): value is string => !!value).sort().at(-1);
  const date = latest ? new Date(latest) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Dati da Selezioni Online';
  const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const today = now.toDateString() === date.toDateString();
  return `Dati da Selezioni Online aggiornati ${today ? 'oggi' : 'il ' + date.toLocaleDateString('it-IT')} alle ${time}`;
}

/**
 * Elenco dei concorsi del segretario (prototipo concorsi.html): ricerca,
 * contatori-filtro, ordinamento per prossima sessione e paginazione. Usato in
 * "I miei concorsi", nella vista admin "Tutti i bandi" e sotto la home segretario.
 */
@Component({
  selector: 'app-bandi-table',
  imports: [RouterLink, FormsModule, FilterChipsComponent, PagerComponent],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
      <app-filter-chips label="Filtra concorsi" [options]="bandoFilterOptions()" [selected]="bandoFilter()" (selectedChange)="setBandoFilter($event)" />
      <div class="d-flex flex-wrap align-items-end gap-3">
        <div class="form-group mb-0 app-search">
          <label [for]="searchId()" class="active">Cerca concorso</label>
          <input type="search" class="form-control" [id]="searchId()" placeholder="Codice o titolo" [ngModel]="query()" (ngModelChange)="onQueryChange($event)" />
        </div>
        <div class="select-wrapper app-sort"><label [for]="sortId()" class="visually-hidden">Ordina</label>
          <select [id]="sortId()" [ngModel]="bandoSort()" (ngModelChange)="setBandoSort($event)">
            <option value="session">Ordina: prossima sessione</option><option value="name">Ordina: codice</option>
          </select></div>
      </div>
    </div>
    <div class="card card-bg no-after"><div class="card-body p-0">
      <div class="table-responsive"><table class="table table-hover align-middle mb-0 app-table">
        <thead><tr><th scope="col">Concorso</th><th scope="col">Prossima sessione</th><th scope="col">Sessioni</th><th scope="col">Configurazione</th><th scope="col" class="text-end"><span class="visually-hidden">Azioni</span></th></tr></thead>
        <tbody>
          @for (bando of pageItems(); track bando.commission_id) {
            <tr>
              <td><a class="fw-semibold" [routerLink]="['/bandi', bando.commission_id, 'sessioni']" [queryParams]="{ mode: mode() }">{{ competitionLabel(bando.title, bando.commission_id) }}</a>
                @if (mode() === 'admin' && bando.visibility_reason === 'admin') { <br><span class="badge app-badge-neutral">Solo vista admin</span> }</td>
              <td class="app-num-cell">
                @if (bando.next_session; as next) {
                  @if (dayBadge(next.date); as day) { <span class="badge app-badge-warning me-1">{{ day }}</span> }
                  {{ nextSessionLabel(next.date, next.time) }}
                } @else if (!bando.session_count) { <span class="text-secondary">da scaricare</span> } @else { — }
              </td>
              <td class="app-num-cell">{{ bando.session_count }}</td>
              <td><span [class]="'badge app-badge-' + configBadge(bando).tone">{{ configBadge(bando).label }}</span></td>
              <td class="text-end app-actions">
                <a class="me-3 fw-semibold" [routerLink]="['/bandi', bando.commission_id, 'config']" [queryParams]="{ returnUrl: currentUrl() }">Configura</a>
                <a class="btn btn-primary btn-sm" [routerLink]="['/bandi', bando.commission_id, 'sessioni']" [queryParams]="{ mode: mode() }">Vedi sessioni</a>
              </td>
            </tr>
          } @empty { <tr><td colspan="5" class="text-secondary">Nessun concorso corrisponde ai filtri.</td></tr> }
        </tbody>
      </table></div>
    </div></div>
    <app-pager label="Concorsi" [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="setPageSize($event)" />
  `,
})
export class BandiTableComponent {
  readonly items = input.required<BandoSummary[]>();
  readonly mode = input('segretario');
  /** Prefisso degli id dei campi, se la tabella compare più volte nella stessa pagina. */
  readonly idPrefix = input('concorsi');
  readonly competitionLabel = competitionLabel;
  private readonly router = inject(Router);
  readonly query = signal('');
  readonly bandoFilter = signal<BandoFilter>('all');
  readonly bandoSort = signal<'session' | 'name'>('session');
  readonly page = signal(0);
  readonly pageSize = signal(10);
  readonly searchId = computed(() => `${this.idPrefix()}-cerca`);
  readonly sortId = computed(() => `${this.idPrefix()}-ordina`);
  readonly bandoFilterOptions = computed<FilterChipOption[]>(() => [
    { id: 'upcoming', label: 'Con sessioni in arrivo', count: this.items().filter((b) => !!b.next_session).length },
    { id: 'incomplete', label: 'Da completare', count: this.items().filter((b) => this.configBadge(b).tone === 'warning').length },
    { id: 'all', label: 'Tutti', count: this.items().length },
  ]);
  /** Ordine cronologico: prima i concorsi con la sessione più vicina, poi quelli senza sessioni in arrivo. */
  readonly filteredItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.items().filter((bando) => {
      const matchesQuery = !q || `${bando.title} ${bando.commission_id}`.toLowerCase().includes(q);
      const matchesFilter = this.bandoFilter() === 'all'
        || (this.bandoFilter() === 'upcoming' ? !!bando.next_session : this.configBadge(bando).tone === 'warning');
      return matchesQuery && matchesFilter;
    }).sort((a, b) => {
      if (this.bandoSort() === 'name') return a.title.localeCompare(b.title);
      const aDate = a.next_session ? `${a.next_session.date} ${a.next_session.time}` : '9999-99-99';
      const bDate = b.next_session ? `${b.next_session.date} ${b.next_session.time}` : '9999-99-99';
      return aDate.localeCompare(bDate) || a.title.localeCompare(b.title);
    });
  });
  readonly pageItems = computed(() => this.filteredItems().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));

  onQueryChange(query: string): void { this.query.set(query); this.page.set(0); }
  setBandoFilter(filter: string): void { this.bandoFilter.set(filter as BandoFilter); this.page.set(0); }
  setBandoSort(sort: string): void { this.bandoSort.set(sort as 'session' | 'name'); this.page.set(0); }
  setPageSize(size: number): void { this.pageSize.set(size); this.page.set(0); }

  currentUrl(): string {
    return this.router.url;
  }

  /** "oggi 14:17" oppure "30/09 15:52" (prototipo concorsi.html). */
  nextSessionLabel(date: string, time: string): string {
    const when = sessionWhen(date, time);
    if (when.startsWith('Oggi')) return when.replace('Oggi alle', 'oggi');
    const iso = date.match(/^\d{4}-(\d{2})-(\d{2})/);
    return iso ? `${iso[2]}/${iso[1]} ${time.slice(0, 5)}` : when;
  }

  /** Avviso per le sessioni imminenti: "Oggi" o "Domani". */
  dayBadge(date: string, today = new Date()): string {
    const key = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const day = date.slice(0, 10);
    if (day === key(today)) return 'Oggi';
    return day === key(tomorrow) ? 'Domani' : '';
  }

  /** Un solo messaggio per riga, con la cosa da sistemare (FR-023, prototipo concorsi.html). */
  configBadge(bando: BandoSummary): { label: string; tone: 'success' | 'warning' | 'neutral' } {
    const sessions = Number(bando.session_count || 0);
    if (!sessions) return { label: 'Sessioni non ancora scaricate', tone: 'neutral' };
    const missingExperts = sessions - Number(bando.remote_expert_assigned_count || 0);
    if (missingExperts > 0) return { label: `Manca l’esperto remoto in ${missingExperts} ${missingExperts === 1 ? 'sessione' : 'sessioni'}`, tone: 'warning' };
    if (!bando.referente_email) return { label: 'Referente non indicato', tone: 'warning' };
    if (bando.required_data_complete === false) return { label: 'Dati del bando da completare', tone: 'warning' };
    if (!bando.next_session) return { label: 'Tutte le sessioni concluse', tone: 'neutral' };
    return { label: 'Configurazione completa', tone: 'success' };
  }
}
