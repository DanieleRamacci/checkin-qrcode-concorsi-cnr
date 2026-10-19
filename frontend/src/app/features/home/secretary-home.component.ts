import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BandoSummary } from '../../core/models/api.models';
import { sessionStateAction, sessionStateLabel } from '../../shared/session-states';
import { competitionLabel } from '../../shared/competition-label';
import { BandiService } from '../bandi/bandi.service';

@Component({
  selector: 'app-secretary-home',
  imports: [RouterLink],
  template: `
    <section class="container my-4" aria-labelledby="secretary-home-title">
      <header class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div><p class="app-eyebrow mb-1">Area segretario</p><h1 id="secretary-home-title" class="h2 mb-0">Buongiorno, {{ firstName() }}</h1></div>
        <a routerLink="/" class="btn btn-outline-primary">Cambia profilo</a>
      </header>
      @if (loading()) { <p role="status" aria-live="polite">Caricamento delle prossime sessioni…</p> }
      @if (error()) { <div class="alert alert-warning" role="status">{{ error() }}</div> }
      @if (nextSession(); as next) {
        <section class="card app-today mb-4" aria-labelledby="next-session-title">
          <div class="card-body d-flex flex-wrap align-items-center gap-4">
            <div class="app-datebox app-datebox--today" aria-hidden="true"><span>{{ shortDate(next.session.date) }}</span><strong>{{ next.session.time }}</strong></div>
            <div class="flex-grow-1">
              <p class="app-eyebrow mb-1">La tua prossima sessione</p>
              <h2 id="next-session-title" class="h3 mb-1">{{ next.session.name }}</h2>
              <p class="mb-1 text-secondary">{{ competitionLabel(next.bando.title, next.bando.commission_id) }} · {{ next.session.location }}</p>
              <p class="mb-0 fw-semibold">Stato: {{ stateLabel(next.session.state) }} · Prossimo passo: {{ nextStep(next.session.state) }}</p>
            </div>
            <a class="btn btn-primary btn-lg" [routerLink]="['/sessioni', next.session.session_id]" [queryParams]="{ mode: 'segretario' }">Apri sessione</a>
          </div>
        </section>
      } @else if (!loading()) {
        <div class="app-empty card shadow-sm mb-4 p-4">
          <h2 class="h5">Nessuna sessione in arrivo</h2>
          <p>Le prossime sessioni compariranno qui quando saranno disponibili.</p>
          @if (unloadedCount()) { <p>{{ unloadedCount() }} {{ unloadedCount() === 1 ? 'concorso non ha' : 'concorsi non hanno' }} ancora sessioni sincronizzate.</p> }
          <a class="btn btn-primary" routerLink="/bandi">Vai ai miei concorsi</a>
        </div>
      }
      @if (upcomingSessions().length > 0) {
        <section aria-labelledby="upcoming-sessions-title">
          <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2"><h2 id="upcoming-sessions-title" class="h4 mb-0">Prossime sessioni</h2><a routerLink="/bandi" class="fw-semibold">Tutti i miei concorsi</a></div>
          <div class="card card-bg no-after"><ul class="app-rows list-unstyled mb-0">
            @for (entry of upcomingSessions(); track entry.session.session_id) {
              <li><a class="app-row text-decoration-none" [routerLink]="['/sessioni', entry.session.session_id]" [queryParams]="{ mode: 'segretario' }">
                <span class="app-row-date">{{ shortDate(entry.session.date) }} · {{ entry.session.time }}</span>
                <span class="flex-grow-1"><strong>{{ entry.session.name }}</strong> <span class="text-secondary">· {{ competitionLabel(entry.bando.title, entry.bando.commission_id) }} · {{ entry.session.location }}</span></span>
                <span class="badge" [class.app-badge-warning]="entry.session.state === 'iniziale'" [class.app-badge-neutral]="entry.session.state !== 'iniziale'">{{ stateLabel(entry.session.state) }}</span>
              </a></li>
            }
          </ul></div>
        </section>
      }
    </section>
  `,
})
export class SecretaryHomeComponent {
  readonly auth = inject(AuthService);
  private readonly bandiService = inject(BandiService);
  readonly bandi = signal<BandoSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly competitionLabel = competitionLabel;
  stateLabel = sessionStateLabel;
  nextStep(state: string): string { return sessionStateAction(state, 'segretario')?.action ?? sessionStateAction(state, 'segretario')?.title ?? 'Controlla la sessione'; }
  readonly upcomingSessions = computed(() => this.bandi().flatMap((bando) => bando.next_session ? [{ bando, session: bando.next_session }] : [])
    .sort((a, b) => `${a.session.date} ${a.session.time}`.localeCompare(`${b.session.date} ${b.session.time}`)));
  readonly nextSession = computed(() => this.upcomingSessions()[0] ?? null);
  readonly unloadedCount = computed(() => this.bandi().filter((bando) => bando.session_count === 0).length);

  firstName(): string {
    const first = this.auth.user()?.display_name?.trim().split(/\s+/)[0];
    if (!first) return 'Segretario';
    const normalized = first.toLocaleLowerCase('it');
    return normalized.charAt(0).toLocaleUpperCase('it') + normalized.slice(1);
  }

  shortDate(value: string): string {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return iso ? `${iso[3]}/${iso[2]}` : value.slice(0, 5);
  }

  constructor() {
    this.bandiService.list('segretario').subscribe({
      next: ({ items }) => { this.bandi.set(items ?? []); this.loading.set(false); },
      error: () => { this.error.set('Impossibile caricare i concorsi. Puoi riprovare da I miei concorsi.'); this.loading.set(false); },
    });
  }
}
