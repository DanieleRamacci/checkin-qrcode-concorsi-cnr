import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BandoSummary } from '../../core/models/api.models';
import { sessionStateAction, sessionStateLabel } from '../../shared/session-states';
import { BandiService } from '../bandi/bandi.service';

@Component({
  selector: 'app-secretary-home',
  imports: [RouterLink],
  template: `
    <section class="container my-4" aria-labelledby="secretary-home-title">
      <header class="d-flex justify-content-between align-items-center gap-3 mb-4">
        <div><p class="app-eyebrow mb-1">Area segretario</p><h1 id="secretary-home-title" class="h2 mb-0">Buongiorno, {{ auth.user()?.display_name || 'Segretario' }}</h1></div>
        <a routerLink="/" class="btn btn-outline-primary">Cambia profilo</a>
      </header>
      @if (loading()) { <p role="status" aria-live="polite">Caricamento delle prossime sessioni…</p> }
      @if (error()) { <div class="alert alert-warning" role="status">{{ error() }}</div> }
      @if (nextSession(); as next) {
        <section class="next-session card shadow-sm mb-4" aria-labelledby="next-session-title">
          <div class="card-body"><p class="app-eyebrow">Prossima sessione</p><h2 id="next-session-title" class="h4">{{ next.session.name }}</h2>
            <p>{{ next.bando.title }} · {{ next.session.date }} · {{ next.session.time }} · {{ next.session.location }}</p>
            <p class="mb-1">Stato: {{ stateLabel(next.session.state) }}</p>
            <p class="mb-3">Prossimo passo: {{ nextStep(next.session.state) }}</p>
            <a class="btn btn-primary" [routerLink]="['/sessioni', next.session.session_id]">Apri sessione</a>
          </div>
        </section>
      } @else if (!loading()) { <div class="app-empty card shadow-sm mb-4 p-4"><h2 class="h5">Nessuna sessione in arrivo</h2><p class="mb-0">Le prossime sessioni compariranno qui quando saranno disponibili.</p></div> }
      <h2 class="h4">Prossime sessioni</h2>
      <div class="list-group">
        @for (bando of bandi(); track bando.commission_id) {
          @if (bando.next_session; as session) {
            <a class="list-group-item list-group-item-action d-flex justify-content-between gap-3" [routerLink]="['/sessioni', session.session_id]">
              <span><strong>{{ session.name }}</strong><br /><span class="text-muted">{{ bando.title }} · {{ session.location }}</span></span>
              <span class="text-nowrap">{{ session.date }} · {{ session.time }}</span>
            </a>
          } @else if (bando.session_count === 0) {
            <a class="list-group-item list-group-item-action" [routerLink]="['/bandi', bando.commission_id, 'sessioni']">{{ bando.title }} · sessioni non ancora scaricate</a>
          }
        }
      </div>
      <a class="btn btn-outline-primary mt-4" routerLink="/bandi">I miei concorsi</a>
    </section>
  `,
})
export class SecretaryHomeComponent {
  readonly auth = inject(AuthService);
  private readonly bandiService = inject(BandiService);
  readonly bandi = signal<BandoSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  stateLabel = sessionStateLabel;
  nextStep(state: string): string { return sessionStateAction(state, 'segretario')?.action ?? sessionStateAction(state, 'segretario')?.title ?? 'Controlla la sessione'; }
  readonly nextSession = () => this.bandi().flatMap((bando) => bando.next_session ? [{ bando, session: bando.next_session }] : [])
    .sort((a, b) => `${a.session.date} ${a.session.time}`.localeCompare(`${b.session.date} ${b.session.time}`))[0] ?? null;

  constructor() {
    this.bandiService.list('segretario').subscribe({
      next: ({ items }) => { this.bandi.set(items ?? []); this.loading.set(false); },
      error: () => { this.error.set('Impossibile caricare i concorsi. Puoi riprovare da I miei concorsi.'); this.loading.set(false); },
    });
  }
}
