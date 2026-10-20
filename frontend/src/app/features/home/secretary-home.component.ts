import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ItIconComponent } from 'design-angular-kit';
import { AuthService } from '../../core/auth.service';
import { BandoSummary } from '../../core/models/api.models';
import { availableProfiles } from '../../core/profile.service';
import { sessionStateAction, sessionStateBadge, sessionStateLabel } from '../../shared/session-states';
import { competitionLabel } from '../../shared/competition-label';
import { BandiService } from '../bandi/bandi.service';

/**
 * P01 Home segretario (docs/design-revisione/prototipo/home.html): la prossima
 * sessione in evidenza e l'elenco delle prossime sessioni. L'elenco completo
 * dei concorsi resta in "I miei concorsi".
 */
@Component({
  selector: 'app-secretary-home',
  imports: [RouterLink, ItIconComponent],
  template: `
    <div class="container py-4 py-lg-5">
      <h1 class="mb-1">Buongiorno, {{ firstName() }}</h1>
      <p class="lead text-secondary mb-4">
        Lavori come <strong class="text-body">Segretario</strong>
        @if (multiProfile()) { · <a routerLink="/">cambia profilo</a> }
      </p>

      @if (loading()) { <p role="status" aria-live="polite">Caricamento delle prossime sessioni…</p> }
      @if (error()) { <div class="alert alert-warning" role="status">{{ error() }}</div> }

      @if (nextSession(); as next) {
        <section class="card app-today mb-4" aria-labelledby="oggi">
          <div class="card-body d-flex flex-wrap align-items-center gap-4">
            <div class="app-datebox" [class.app-datebox--today]="isToday(next.session.date)" aria-hidden="true">
              <span>{{ isToday(next.session.date) ? 'Oggi' : shortDate(next.session.date) }}</span><strong>{{ next.session.time }}</strong>
            </div>
            <div class="flex-grow-1 app-minw">
              <p class="app-eyebrow mb-1" id="oggi">La tua prossima sessione</p>
              <h2 class="h3 mb-1">{{ next.session.name }}</h2>
              <p class="mb-1 text-secondary">{{ competitionLabel(next.bando.title, next.bando.commission_id) }} · {{ next.session.location }}</p>
              <p class="mb-0 fw-semibold">Stato: {{ stateLabel(next.session.state).toLocaleLowerCase('it') }} · Prossimo passo: {{ nextStep(next.session.state) }}</p>
            </div>
            <a class="btn btn-primary btn-lg" [routerLink]="['/sessioni', next.session.session_id]" [queryParams]="{ mode: 'segretario' }">Apri sessione</a>
          </div>
        </section>
      } @else if (!loading() && !error()) {
        <section class="card card-bg no-after mb-4" aria-labelledby="nessuna-sessione">
          <div class="card-body">
            <h2 id="nessuna-sessione" class="h5">Nessuna prossima sessione tra quelle scaricate</h2>
            <p>Questa pagina mostra solo le sessioni già salvate nell’app. Non consulta in tempo reale Selezioni Online.</p>
            @if (unloadedCount()) {
              <p>{{ unloadedCount() }} {{ unloadedCount() === 1 ? 'concorso è presente' : 'concorsi sono presenti' }} senza sessioni scaricate nell’app. Apri un concorso e seleziona “Scarica sessioni da Selezioni Online” per verificare e importare le sue sessioni.</p>
            }
            <a class="btn btn-primary" routerLink="/bandi">Vai ai miei concorsi</a>
          </div>
        </section>
      }

      @if (upcomingSessions().length > 1) {
        <section class="mb-4" aria-labelledby="prossime">
          <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
            <h2 id="prossime" class="h4 mb-0">Prossime sessioni</h2>
            <a routerLink="/bandi" class="fw-semibold">Tutti i miei concorsi <it-icon name="chevron-right" size="xs" color="primary" /></a>
          </div>
          <div class="card card-bg no-after"><div class="link-list-wrapper"><ul class="link-list app-rows mb-0">
            @for (entry of upcomingSessions().slice(1); track entry.session.session_id) {
              <li><a class="list-item app-row" [routerLink]="['/sessioni', entry.session.session_id]" [queryParams]="{ mode: 'segretario' }">
                <span class="app-row-date">{{ shortDate(entry.session.date) }} · {{ entry.session.time }}</span>
                <span class="flex-grow-1">{{ entry.session.name }} – {{ entry.session.location }} <span class="text-secondary">· {{ competitionLabel(entry.bando.title, entry.bando.commission_id) }}</span></span>
                <span [class]="'badge app-badge-' + badge(entry.session.state).tone">{{ badge(entry.session.state).label }}</span>
              </a></li>
            }
          </ul></div></div>
        </section>
      } @else if (!loading() && !error()) {
        <p><a routerLink="/bandi" class="fw-semibold">Tutti i miei concorsi <it-icon name="chevron-right" size="xs" color="primary" /></a></p>
      }
    </div>
  `,
})
export class SecretaryHomeComponent {
  readonly auth = inject(AuthService);
  private readonly bandiService = inject(BandiService);
  readonly bandi = signal<BandoSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly competitionLabel = competitionLabel;
  readonly stateLabel = sessionStateLabel;
  readonly badge = sessionStateBadge;
  readonly multiProfile = computed(() => availableProfiles(this.auth.user()).length > 1);
  readonly upcomingSessions = computed(() => this.bandi().flatMap((bando) => bando.next_session ? [{ bando, session: bando.next_session }] : [])
    .sort((a, b) => `${a.session.date} ${a.session.time}`.localeCompare(`${b.session.date} ${b.session.time}`)));
  readonly nextSession = computed(() => this.upcomingSessions()[0] ?? null);
  readonly unloadedCount = computed(() => this.bandi().filter((bando) => bando.session_count === 0).length);

  constructor() {
    this.bandiService.list('segretario').subscribe({
      next: ({ items }) => { this.bandi.set(items ?? []); this.loading.set(false); },
      error: () => { this.error.set('Impossibile caricare i concorsi. Puoi riprovare da I miei concorsi.'); this.loading.set(false); },
    });
  }

  nextStep(state: string): string {
    const action = sessionStateAction(state, 'segretario');
    return action?.action ?? action?.title ?? 'Controlla la sessione';
  }

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

  isToday(value: string): boolean {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return value.startsWith(today);
  }
}
