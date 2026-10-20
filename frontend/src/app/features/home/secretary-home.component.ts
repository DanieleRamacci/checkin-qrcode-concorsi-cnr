import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BandiResponse, BandoSummary } from '../../core/models/api.models';
import { availableProfiles } from '../../core/profile.service';
import { sessionStateAction, sessionStateLabel } from '../../shared/session-states';
import { competitionLabel } from '../../shared/competition-label';
import { BandiService } from '../bandi/bandi.service';
import { BandiTableComponent, bandiSyncLine } from '../bandi/bandi-table.component';

/**
 * P01 Home segretario (docs/design-revisione/prototipo/home.html): la sessione
 * più vicina tra quelle scaricate in primo piano e, sotto, i concorsi di cui
 * l'utente è segretario come in "I miei concorsi". All'apertura i concorsi si
 * aggiornano da Selezioni Online; le sessioni si scaricano aprendo un concorso.
 */
@Component({
  selector: 'app-secretary-home',
  imports: [RouterLink, BandiTableComponent],
  template: `
    <div class="container py-4 py-lg-5">
      <h1 class="mb-1">Buongiorno, {{ firstName() }}</h1>
      <p class="lead text-secondary mb-4">
        Lavori come <strong class="text-body">Segretario</strong>
        @if (multiProfile()) { · <a routerLink="/">cambia profilo</a> }
      </p>

      @if (loading()) { <p role="status" aria-live="polite">Carico i tuoi concorsi…</p> }
      @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }

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
      } @else if (!loading() && bandi().length) {
        <section class="card card-bg no-after mb-4" aria-labelledby="nessuna-sessione">
          <div class="card-body">
            <h2 id="nessuna-sessione" class="h5">Nessuna sessione in programma tra quelle scaricate</h2>
            <p class="mb-0">Le sessioni di un concorso si scaricano da Selezioni Online quando lo apri. Scegli un concorso qui sotto.</p>
          </div>
        </section>
      }

      @if (!loading() && !error()) {
        <section aria-labelledby="concorsi-title">
          <div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-3">
            <h2 id="concorsi-title" class="h3 mb-0">I miei concorsi</h2>
            <p class="mb-0 small text-secondary" role="status" aria-live="polite">
              @if (syncing()) {
                <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Aggiorno i concorsi da Selezioni Online…
              } @else {
                {{ syncLine() }} · <button type="button" class="btn btn-link p-0 align-baseline small fw-semibold" (click)="sync()">Aggiorna ora</button>
              }
            </p>
          </div>
          @if (syncError()) {
            <div class="alert alert-warning" role="alert"><strong>Aggiornamento da Selezioni Online non riuscito.</strong> {{ syncError() }} Stai vedendo i dati già salvati nell’app.</div>
          }
          @if (bandi().length) {
            <app-bandi-table [items]="bandi()" mode="segretario" idPrefix="home-concorsi" />
          } @else if (!syncing()) {
            <div class="app-empty bg-white" role="status">
              <p class="fw-semibold mb-1">Nessun concorso trovato</p>
              <p class="text-secondary mb-3">Su Selezioni Online non risultano concorsi in cui sei segretario. Se l’incarico è recente, riprova tra qualche minuto.</p>
              <button type="button" class="btn btn-primary" (click)="sync()">Aggiorna da Selezioni Online</button>
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class SecretaryHomeComponent {
  readonly auth = inject(AuthService);
  private readonly bandiService = inject(BandiService);
  readonly bandi = signal<BandoSummary[]>([]);
  readonly loading = signal(true);
  readonly syncing = signal(false);
  readonly error = signal('');
  readonly syncError = signal('');
  readonly competitionLabel = competitionLabel;
  readonly stateLabel = sessionStateLabel;
  readonly multiProfile = computed(() => availableProfiles(this.auth.user()).length > 1);
  /** La sessione futura più vicina fra le prossime sessioni dei concorsi (una per concorso). */
  readonly nextSession = computed(() => this.bandi().flatMap((bando) => bando.next_session ? [{ bando, session: bando.next_session }] : [])
    .sort((a, b) => `${a.session.date} ${a.session.time}`.localeCompare(`${b.session.date} ${b.session.time}`))[0] ?? null);
  readonly syncLine = computed(() => bandiSyncLine(this.bandi()));

  constructor() {
    // Prima i dati salvati nell'app, subito; poi l'aggiornamento da Selezioni Online.
    this.bandiService.list('segretario').subscribe({
      next: ({ items }) => {
        this.bandi.set(items ?? []);
        this.loading.set(false);
        if (this.bandiService.secretarySyncDue()) this.sync();
      },
      error: () => { this.error.set('Impossibile caricare i concorsi. Ricarica la pagina per riprovare.'); this.loading.set(false); },
    });
  }

  sync(): void {
    this.syncing.set(true);
    this.syncError.set('');
    this.bandiService.sync('segretario').subscribe({
      next: (response: BandiResponse) => {
        this.bandi.set(response.items ?? []);
        this.syncError.set(response.sync_error ?? '');
        this.syncing.set(false);
      },
      error: () => {
        this.syncError.set('Selezioni Online non ha risposto.');
        this.syncing.set(false);
      },
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
