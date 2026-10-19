import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, switchMap, timer } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { SessionSummary, WorkflowState } from '../../core/models/api.models';
import { BandiService } from '../bandi/bandi.service';
import { CandidatiComponent } from '../candidati/candidati.component';
import { NotificheComponent } from '../notifiche/notifiche.component';
import { SessionHeaderComponent } from './session-header.component';
import { StateTimelineComponent } from './state-timeline.component';
import { SessionReferencesComponent } from './session-references.component';
import { AzioniComponent } from './azioni.component';
import { MobileSessionComponent } from './mobile-session.component';

interface OperationalConfig {
  email_referente?: string;
  email_esperto_remoto?: string;
  email_segretario?: string;
  telefono_segretario?: string;
  durata_prova_minuti?: number;
  nome_informatico_sede?: string;
  email_informatico_sede?: string;
  telefono_informatico_sede?: string;
  [key: string]: unknown;
}

@Component({
  selector: 'app-gestione-sessione',
  imports: [CandidatiComponent, NotificheComponent, StateTimelineComponent, SessionHeaderComponent, SessionReferencesComponent, AzioniComponent, MobileSessionComponent],
  template: `
    <main class="container-fluid gestione-sessione content-area">
      <div class="session-layout mx-auto">
        @if (detail(); as sessionDetail) {
          @if (!mobileView()) { <app-session-header [session]="sessionDetail" [state]="workflowState()?.current_state ?? ''" [profile]="viewMode" [adminView]="sessionDetail.visibility_reason === 'admin'" /> }
        }
          @if (error()) {
            <div class="alert alert-danger mb-3" role="alert">{{ error() }}</div>
          }
          @if (detail(); as sessionDetail) {
            @if (mobileView()) {
              <app-mobile-session [session]="sessionDetail" [currentState]="workflowState()?.current_state ?? ''" [mode]="viewMode">
                <div session-actions>
                  <app-azioni
                    [sessionId]="sessionId"
                    [commissionId]="sessionDetail.commission_id"
                    [currentState]="workflowState()?.current_state ?? null"
                    [bandoConfigured]="bandoConfigured()"
                    [deviceCount]="sessionDetail.device_count"
                    [candidateCount]="sessionDetail.candidate_count"
                    [checkedInCount]="sessionDetail.checked_in_count"
                    [openResetCount]="openResetCount()"
                    [viewMode]="viewMode"
                    [adminOnly]="sessionDetail.visibility_reason === 'admin'"
                    (changed)="load()"
                  />
                </div>
                <div session-candidates>
                  <app-candidati [sessionId]="sessionId" [viewMode]="viewMode" [refreshTick]="refreshTick()" [sectionMode]="candidateSectionMode()" (openResetCountChange)="openResetCount.set($event)" />
                </div>
                <div session-messages><app-notifiche [sessionId]="sessionId" [mode]="viewMode" /></div>
              </app-mobile-session>
            } @else {
          <div class="row g-4">
            <div class="col-12 col-xl-9 action-column">
              @if (detail()) {
                  <app-azioni
                    [sessionId]="sessionId"
                    [commissionId]="detail()?.commission_id ?? ''"
                    [currentState]="workflowState()?.current_state ?? null"
                    [bandoConfigured]="bandoConfigured()"
                    [deviceCount]="detail()?.device_count ?? 0"
                    [candidateCount]="detail()?.candidate_count ?? 0"
                    [checkedInCount]="detail()?.checked_in_count ?? 0"
                    [openResetCount]="openResetCount()"
                    [viewMode]="viewMode"
                    [adminOnly]="detail()?.visibility_reason === 'admin'"
                    (changed)="load()"
                  />
                  <div class="mb-3">
                    <app-candidati [sessionId]="sessionId" [viewMode]="viewMode" [refreshTick]="refreshTick()" [sectionMode]="candidateSectionMode()" (openResetCountChange)="openResetCount.set($event)" />
                  </div>
                  <app-notifiche [sessionId]="sessionId" [mode]="viewMode" />
              }
            </div>
            <aside class="col-12 col-xl-3 timeline-column">
              <app-state-timeline [currentState]="workflowState()?.current_state ?? ''" [history]="workflowState()?.history ?? []" [faseEsameMia]="viewMode === 'esperto'" />
              @if (mergedConfig(); as cfg) { <app-session-references [references]="cfg" /> }
            </aside>
          </div>
            }
          }
      </div>
    </main>
  `,
  styles: `
    .gestione-sessione { background-color: var(--app-ground); min-height: 70vh; padding: 1.5rem; }
    .session-layout { max-width: 1440px; }
    .action-column, .timeline-column { min-width: 0; }
    @media (max-width: 767.98px) { .gestione-sessione { padding: .75rem; } }
  `,
})
export class GestioneSessioneComponent {
  private readonly api = inject(ApiClient);
  private readonly bandiService = inject(BandiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
  readonly viewMode = normalizeViewMode(this.route.snapshot.queryParamMap.get('mode'));
  readonly showTimeline = this.viewMode === 'segretario' || this.viewMode === 'admin';
  readonly detail = signal<SessionSummary | null>(null);
  readonly workflowState = signal<WorkflowState | null>(null);
  readonly bandoConfigured = signal(false);
  readonly mergedConfig = signal<OperationalConfig | null>(null);
  readonly refreshTick = signal(0);
  readonly openResetCount = signal(0);
  readonly error = signal('');
  readonly mobileView = signal(typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767.98px)').matches);
  private readonly onViewportChange = (event: MediaQueryListEvent) => this.mobileView.set(event.matches);

  candidateSectionMode(): 'vuota' | 'sola-lettura' | 'checkin' | 'finale' | 'reset-sede' | 'reset-esperto' {
    const state = this.workflowState()?.current_state;
    if (!state || state === 'iniziale' || state === 'configurata') return 'vuota';
    if (state === 'candidati_scaricati' || state === 'dispositivi_connessi') return 'sola-lettura';
    if (state === 'checkin_avviato') {
      if (this.viewMode === 'sede') return 'reset-sede';
      if (this.viewMode === 'esperto') return 'reset-esperto';
      return 'checkin';
    }
    return 'finale';
  }

  constructor() {
    const viewport = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 767.98px)') : null;
    viewport?.addEventListener('change', this.onViewportChange);
    this.destroyRef.onDestroy(() => viewport?.removeEventListener('change', this.onViewportChange));
    this.load();
    // Poll periodico di stato/timeline/azioni. switchMap annulla la richiesta
    // precedente ad ogni nuovo tick e takeUntilDestroyed disiscrive (annullando
    // anche una richiesta in volo) alla distruzione del componente, cosi' un
    // tick in corso non puo' piu' scrivere su un componente gia' smontato.
    timer(5000, 5000)
      .pipe(
        switchMap(() =>
          this.api.get<WorkflowState>(`/sessioni/${this.sessionId}/state?mode=${encodeURIComponent(this.viewMode)}`),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (state) => {
          const previous = this.workflowState()?.current_state ?? null;
          this.workflowState.set(state);
          if (previous && previous !== state.current_state) {
            this.loadSessionContext();
          }
          // Aggiorna anche i figli (es. lista candidati/note) ad ogni tick e non
          // solo sui cambi di stato: un'altra scheda puo' modificare dati a
          // livello di candidato (nota, check-in) senza far avanzare lo stato
          // della sessione.
          this.refreshChildren();
        },
        error: () => {
          // Evita alert ripetuti durante brevi problemi di rete: il prossimo polling riprova.
        },
      });
  }

  load(): void {
    this.error.set('');
    this.loadSessionContext();
    this.loadWorkflowState();
  }

  private loadSessionContext(): void {
    const modeParam = encodeURIComponent(this.viewMode);
    this.api.get<SessionSummary>(`/sessioni/${this.sessionId}?mode=${modeParam}`).subscribe((detail) => {
      this.detail.set(detail);
      this.bandiService.detail(detail.commission_id, this.viewMode).subscribe({
        next: (bando) => this.bandoConfigured.set(bando.configured),
        error: (error) => this.error.set(apiErrorText(error, 'Impossibile caricare il dettaglio del bando.')),
      });
      forkJoin({
        bando: this.api.get<OperationalConfig>(`/bandi/${detail.commission_id}/config?mode=${modeParam}`),
        sessione: this.api.get<OperationalConfig>(`/sessioni/${this.sessionId}/config?mode=${modeParam}`),
      }).subscribe(({ bando, sessione }) => {
        const sessionValues = Object.fromEntries(
          Object.entries(sessione).filter(([, value]) => value !== null && value !== ''),
        );
        this.mergedConfig.set({ ...bando, ...sessionValues });
      }, (error) => this.error.set(apiErrorText(error, 'Impossibile caricare i riferimenti operativi.')));
    }, (error) => {
      this.error.set(apiErrorText(error, 'Impossibile caricare la sessione.'));
    });
  }

  private loadWorkflowState(): void {
    this.api.get<WorkflowState>(`/sessioni/${this.sessionId}/state?mode=${encodeURIComponent(this.viewMode)}`).subscribe({
      next: (state) => {
        this.workflowState.set(state);
        this.refreshChildren();
      },
      error: (error) => this.error.set(apiErrorText(error, 'Impossibile caricare lo stato del workflow.')),
    });
  }

  private refreshChildren(): void {
    this.refreshTick.update((value) => value + 1);
  }

  showPreCheckinWarning(): boolean {
    if (!this.showTimeline) return false;
    const currentState = this.workflowState()?.current_state;
    return [
      'iniziale',
      'configurata',
      'candidati_scaricati',
      'dispositivi_connessi',
    ].includes(currentState ?? '');
  }
}

function apiErrorText(error: unknown, fallback: string): string {
  const httpError = error as {
    status?: number;
    error?: string | { error?: { code?: string; message?: string; details?: Record<string, string> } };
  };
  const apiError = typeof httpError.error === 'object' ? httpError.error?.error : undefined;
  const details = apiError?.details ? Object.values(apiError.details).filter(Boolean).join(' ') : '';
  return [
    fallback,
    httpError.status ? `HTTP ${httpError.status}` : '',
    apiError?.code ?? '',
    apiError?.message ?? '',
    details,
  ].filter(Boolean).join(' - ');
}

export function normalizeViewMode(mode: string | null): 'segretario' | 'sede' | 'esperto' | 'admin' {
  if (mode === 'expert' || mode === 'esperto') return 'esperto';
  if (mode === 'sede') return 'sede';
  if (mode === 'admin') return 'admin';
  return 'segretario';
}
