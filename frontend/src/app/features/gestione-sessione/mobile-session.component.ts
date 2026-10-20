import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ItIconComponent } from 'design-angular-kit';
import { ApiClient } from '../../core/api-client';
import { ApiList, CandidateSummary, SessionSummary } from '../../core/models/api.models';
import { sessionStateLabel } from '../../shared/session-states';
import { competitionLabel } from '../../shared/competition-label';
import { sessionWhen } from '../../shared/session-date';

/**
 * P08 Sessione su smartphone (prototipo mobile-sessione.html): testata blu
 * compatta, durante il check-in contatore con "Apri scanner" ed elenco di chi
 * manca, barra in basso Sessione / Candidati / Messaggi.
 */
@Component({
  selector: 'app-mobile-session',
  imports: [RouterLink, FormsModule, ItIconComponent],
  template: `
    <div class="app-m-page">
      <header class="app-m-head">
        @if (technical()) {
          <a class="app-m-icon" routerLink="/le-mie-sessioni" [queryParams]="{ mode: mode() === 'sede' ? 'sede' : 'expert' }" aria-label="Indietro: le mie sessioni"><it-icon name="arrow-left" color="white" /></a>
        } @else {
          <a class="app-m-icon" [routerLink]="['/bandi', session()?.commission_id, 'sessioni']" [queryParams]="{ mode: mode() }" aria-label="Indietro: sessioni del concorso"><it-icon name="arrow-left" color="white" /></a>
        }
        <div class="app-minw flex-grow-1"><strong class="d-block text-truncate">{{ session()?.name || 'Sessione' }}</strong><span class="small">{{ subtitle() }}</span></div>
        <button type="button" class="app-m-icon position-relative border-0 bg-transparent" [attr.aria-label]="unreadCount() ? 'Messaggi, ' + unreadCount() + ' non letti' : 'Messaggi'" (click)="openMessages.emit()">
          <it-icon name="comment" color="white" />@if (unreadCount()) { <span class="app-m-dot" aria-hidden="true">{{ unreadCount() }}</span> }
        </button>
      </header>

      <div class="app-m-body" [hidden]="activeTab() !== 'sessione'">
        <p class="mb-0"><span class="app-state-pill">Stato: <strong>{{ stateLabel() }}</strong></span>
          @if (checkinSince()) { <span class="small text-secondary">&ngsp;dalle {{ checkinSince() }}</span> }</p>
        @if (checkin()) {
          <section class="card card-bg no-after" aria-label="Presenze"><div class="card-body">
            <p class="app-counter app-counter--sm mb-2"><strong>{{ present() }}</strong>&ngsp;<span>/ {{ total() }} presenti</span></p>
            <div class="progress app-progress mb-3"><div class="progress-bar" role="progressbar" [style.width.%]="percent()" [attr.aria-valuenow]="percent()" aria-valuemin="0" aria-valuemax="100" aria-label="Presenti sul totale"></div></div>
            <a class="btn btn-primary btn-lg w-100 btn-icon justify-content-center gap-2" routerLink="/scanner" [queryParams]="{ sessionId: session()?.session_id, mode: mode() }"><it-icon name="camera" color="white" /><span>Apri scanner</span></a>
          </div></section>
          @if (canRegister()) {
            <section class="card card-bg no-after" aria-labelledby="m-mancano"><div class="card-body">
              <div class="d-flex justify-content-between align-items-baseline mb-2"><h2 id="m-mancano" class="h5 mb-0">Mancano {{ missing().length }}</h2>
                <button type="button" class="btn btn-link p-0 small fw-semibold" (click)="activeTab.set('candidati')">Tutti</button></div>
              <div class="form-group mb-2"><label for="mq" class="visually-hidden">Cerca candidato</label>
                <input type="search" class="form-control" id="mq" placeholder="Cerca cognome o documento" [ngModel]="query()" (ngModelChange)="query.set($event)" /></div>
              <ul class="list-unstyled app-m-list mb-0">
                @for (item of filteredMissing(); track item.uid) {
                  <li><span class="flex-grow-1"><strong>{{ item.last_name }} {{ item.first_name }}</strong>
                    @if (item.document_expired) { <br><span class="small text-danger fw-semibold">Documento scaduto</span> }</span>
                    <button type="button" class="btn btn-outline-success btn-sm" [disabled]="busyUid() === item.uid" (click)="markPresent(item)">Presente<span class="visually-hidden"> {{ item.last_name }}</span></button></li>
                } @empty {
                  <li class="text-secondary">{{ query().trim() ? 'Nessun candidato corrisponde alla ricerca.' : 'Tutti i candidati risultano presenti.' }}</li>
                }
              </ul>
              @if (message()) { <p class="small mt-2 mb-0" role="status">{{ message() }}</p> }
            </div></section>
          }
        }
        <ng-content select="[session-actions]" />
      </div>
      <div class="app-m-body" [hidden]="activeTab() !== 'candidati'">
        <ng-content select="[session-candidates]" />
      </div>

      <nav class="app-m-tabs" aria-label="Sezioni">
        <a href="#" [attr.aria-current]="activeTab() === 'sessione' ? 'page' : null" (click)="$event.preventDefault(); activeTab.set('sessione')">Sessione</a>
        <a href="#" [attr.aria-current]="activeTab() === 'candidati' ? 'page' : null" (click)="$event.preventDefault(); activeTab.set('candidati')">Candidati</a>
        <a href="#" (click)="$event.preventDefault(); openMessages.emit()">Messaggi@if (unreadCount()) { · {{ unreadCount() }} }</a>
      </nav>
    </div>
  `,
  styles: `
    .app-m-page { min-height: 100vh; display: flex; flex-direction: column; background: var(--app-ground); }
    .app-m-head { position: sticky; top: 0; z-index: 20; }
    .app-m-tabs { position: sticky; bottom: 0; z-index: 20; margin-top: auto; }
  `,
})
export class MobileSessionComponent {
  private readonly api = inject(ApiClient);
  readonly session = input<SessionSummary | null>(null);
  readonly currentState = input('');
  readonly mode = input('segretario');
  readonly unreadCount = input(0);
  /** Ora di avvio del check-in (HH:MM). */
  readonly checkinSince = input('');
  readonly refreshTick = input(0);
  readonly openMessages = output<void>();
  /** Una presenza registrata da qui: la pagina aggiorna contatori e stato. */
  readonly changed = output<void>();
  readonly activeTab = signal<'sessione' | 'candidati'>('sessione');
  readonly candidates = signal<CandidateSummary[]>([]);
  readonly query = signal('');
  readonly busyUid = signal<string | null>(null);
  readonly message = signal('');

  readonly technical = computed(() => this.mode() === 'sede' || this.mode() === 'esperto');
  readonly checkin = computed(() => this.currentState() === 'checkin_avviato');
  readonly canRegister = computed(() => this.mode() === 'segretario' || this.mode() === 'admin');
  readonly stateLabel = computed(() => sessionStateLabel(this.currentState()));
  readonly total = computed(() => this.session()?.candidate_count ?? 0);
  readonly present = computed(() => this.session()?.checked_in_count ?? 0);
  readonly percent = computed(() => this.total() ? Math.round((this.present() / this.total()) * 100) : 0);
  readonly subtitle = computed(() => {
    const session = this.session();
    if (!session) return '';
    return [sessionWhen(session.date, session.time).replace(' alle ', ' '), competitionLabel(session.bando_title, session.commission_id)].filter(Boolean).join(' · ');
  });
  readonly missing = computed(() => this.candidates().filter((item) => !item.checkin_effettuato));
  readonly filteredMissing = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('it');
    return this.missing().filter((item) => !query || `${item.last_name} ${item.first_name} ${item.document_number}`.toLocaleLowerCase('it').includes(query));
  });

  ngOnChanges(): void {
    if (this.checkin() && this.canRegister() && this.session()) this.loadMissing();
  }

  markPresent(item: CandidateSummary): void {
    const session = this.session();
    if (!session) return;
    this.busyUid.set(item.uid);
    this.message.set('');
    this.api.post(`/sessioni/${session.session_id}/candidati/${encodeURIComponent(item.uid)}/toggle-checkin?mode=${encodeURIComponent(this.mode())}`).subscribe({
      next: () => { this.busyUid.set(null); this.candidates.update((items) => items.map((c) => c.uid === item.uid ? { ...c, checkin_effettuato: true } : c)); this.changed.emit(); },
      error: () => { this.busyUid.set(null); this.message.set('Registrazione della presenza non riuscita. Riprova.'); },
    });
  }

  private loadMissing(): void {
    const session = this.session();
    if (!session) return;
    const params = new URLSearchParams({ checkin: 'no', mode: this.mode() });
    this.api.get<ApiList<CandidateSummary>>(`/sessioni/${session.session_id}/candidati?${params}`).subscribe({
      next: ({ items }) => this.candidates.set(items ?? []),
      error: () => this.message.set('Impossibile aggiornare l’elenco di chi manca.'),
    });
  }
}
