import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, switchMap, timer } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { SessionSummary, WorkflowState } from '../../core/models/api.models';
import { BandiService } from '../bandi/bandi.service';
import { CandidateSectionMode, CandidatiComponent } from '../candidati/candidati.component';
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
  imports: [NgTemplateOutlet, CandidatiComponent, NotificheComponent, StateTimelineComponent, SessionHeaderComponent, SessionReferencesComponent, AzioniComponent, MobileSessionComponent],
  template: `
    @if (detail(); as sessionDetail) {
      @if (mobileView()) {
        @if (error()) { <div class="alert alert-danger m-3" role="alert">{{ error() }}</div> }
        <app-mobile-session [session]="sessionDetail" [currentState]="state()" [mode]="viewMode" [unreadCount]="unread()"
          [checkinSince]="stateTime('checkin_avviato')" [refreshTick]="refreshTick()" (openMessages)="chat.openDrawer()" (changed)="load()">
          <div session-actions><ng-container [ngTemplateOutlet]="azioni" [ngTemplateOutletContext]="{ $implicit: sessionDetail, compatto: true }" /></div>
          <div session-candidates><ng-container [ngTemplateOutlet]="candidati" /></div>
        </app-mobile-session>
        <app-notifiche #chat [sessionId]="sessionId" [mode]="viewMode" [sessionName]="sessionDetail.name" [showFab]="false" (unreadChange)="unread.set($event)" />
      } @else {
        <app-session-header [session]="sessionDetail" [state]="state()" [profile]="viewMode" [adminView]="sessionDetail.visibility_reason === 'admin'" />
        <div class="container py-4">
          @if (error()) { <div class="alert alert-danger mb-4" role="alert">{{ error() }}</div> }
          <div class="row g-4">
            <div class="col-12 col-lg-8 d-flex flex-column gap-4 app-minw">
              <ng-container [ngTemplateOutlet]="azioni" [ngTemplateOutletContext]="{ $implicit: sessionDetail }" />
              <ng-container [ngTemplateOutlet]="candidati" />
            </div>
            <div class="col-12 col-lg-4 d-flex flex-column gap-4">
              <app-state-timeline [currentState]="state()" [history]="history()" [faseEsameMia]="viewMode === 'esperto'" />
              <app-session-references [references]="mergedConfig() ?? {}" />
            </div>
          </div>
        </div>
        <app-notifiche [sessionId]="sessionId" [mode]="viewMode" [sessionName]="sessionDetail.name" />
      }
    } @else if (error()) {
      <div class="container py-4"><div class="alert alert-danger" role="alert">{{ error() }}</div></div>
    } @else {
      <div class="container py-4"><p role="status" aria-live="polite">Carico la sessione…</p></div>
    }

    <ng-template #azioni let-sessionDetail let-compatto="compatto">
      <app-azioni
        [compatto]="!!compatto"
        [sessionId]="sessionId"
        [commissionId]="sessionDetail.commission_id"
        [currentState]="workflowState()?.current_state ?? null"
        [bandoConfigured]="bandoConfigured()"
        [deviceCount]="sessionDetail.device_count"
        [candidateCount]="sessionDetail.candidate_count"
        [checkedInCount]="sessionDetail.checked_in_count"
        [openResetCount]="openResetCount()"
        [history]="history()"
        [references]="mergedConfig() ?? {}"
        [viewMode]="viewMode"
        [adminOnly]="sessionDetail.visibility_reason === 'admin'"
        (changed)="load()"
        (secretaryActionsOpen)="secretaryActionsOpen.set($event)"
      />
    </ng-template>
    <ng-template #candidati>
      <app-candidati [sessionId]="sessionId" [viewMode]="viewMode" [refreshTick]="refreshTick()" [sectionMode]="candidateSectionMode()"
        [emptyMessage]="candidateEmptyMessage()" [concludedAt]="stateTime('checkin_concluso')" (openResetCountChange)="openResetCount.set($event)" (countsChange)="applyCounts($event)" />
    </ng-template>
  `,
})
export class GestioneSessioneComponent {
  private readonly api = inject(ApiClient);
  private readonly bandiService = inject(BandiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
  readonly viewMode = normalizeViewMode(this.route.snapshot.queryParamMap.get('mode'));
  readonly detail = signal<SessionSummary | null>(null);
  readonly workflowState = signal<WorkflowState | null>(null);
  readonly state = computed(() => this.workflowState()?.current_state ?? '');
  readonly history = computed(() => this.workflowState()?.history ?? []);
  readonly bandoConfigured = signal(false);
  readonly mergedConfig = signal<OperationalConfig | null>(null);
  readonly refreshTick = signal(0);
  readonly openResetCount = signal(0);
  readonly unread = signal(0);
  /** L'informatico in sede ha aperto "Azioni del segretario". */
  readonly secretaryActionsOpen = signal(false);
  readonly error = signal('');
  readonly mobileView = signal(typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767.98px)').matches);
  private readonly onViewportChange = (event: MediaQueryListEvent) => this.mobileView.set(event.matches);

  readonly candidateSectionMode = computed<CandidateSectionMode>(() => {
    const state = this.state();
    if (!state || state === 'iniziale' || state === 'configurata') return 'vuota';
    if (state === 'candidati_scaricati' || state === 'dispositivi_connessi') return 'sola-lettura';
    // Il reset password si gestisce sulla riga dei presenti dal check-in in poi (contracts/ui-session-states.md).
    if (this.viewMode === 'esperto') return 'reset-esperto';
    if (this.viewMode === 'sede') return state === 'checkin_avviato' && this.secretaryActionsOpen() ? 'checkin' : 'reset-sede';
    return state === 'checkin_avviato' ? 'checkin' : 'finale';
  });

  readonly candidateEmptyMessage = computed(() => {
    if (this.viewMode === 'sede' || this.viewMode === 'esperto') return 'Compariranno qui quando il segretario avrà scaricato i candidati.';
    return this.state() === 'configurata'
      ? 'Premi “Scarica candidati” qui sopra: l’elenco comparirà qui.'
      : 'Compariranno qui dopo lo scaricamento da Selezioni Online (passo 2).';
  });

  stateTime(state: string): string {
    const at = this.history().find((item) => item.state === state)?.at;
    const date = at ? new Date(at) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
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

  /**
   * Le presenze registrate da uno scanner non cambiano lo stato della sessione:
   * i contatori seguono l'elenco candidati, che si aggiorna a ogni ciclo.
   */
  applyCounts(counts: { total: number; present: number }): void {
    this.detail.update((detail) => detail && (detail.candidate_count !== counts.total || detail.checked_in_count !== counts.present)
      ? { ...detail, candidate_count: counts.total, checked_in_count: counts.present }
      : detail);
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
