import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { SessionSummary, WorkflowState } from '../../core/models/api.models';
import { BandiService } from '../bandi/bandi.service';
import { CandidatiComponent } from '../candidati/candidati.component';
import { ResetPasswordComponent } from '../candidati/reset-password.component';
import { NotificheComponent } from '../notifiche/notifiche.component';
import { ExamTimelineComponent } from './exam-timeline.component';
import { AzioniComponent } from './azioni.component';

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
  imports: [RouterLink, CandidatiComponent, ResetPasswordComponent, NotificheComponent, ExamTimelineComponent, AzioniComponent],
  template: `
    <div class="container-fluid gestione-sessione">
      <div class="row">
        <aside class="col-md-2 p-0 sidebar-wrapper d-flex flex-column">
          @if (detail()) {
            <div class="p-3 border-bottom bg-light">
              <h6 class="mb-1 text-uppercase text-primary fw-bold">{{ detail()!.name }}</h6>
              <small class="d-block">{{ detail()!.location }}</small>
              <small class="text-muted">{{ detail()!.date }} alle {{ detail()!.time }}</small>
            </div>
          }
          @if (mergedConfig(); as cfg) {
            <div class="p-3 border-bottom bg-white operational-references">
              <p class="fw-bold text-uppercase text-muted mb-2 reference-title">Riferimenti operativi</p>
              @if (cfg.email_referente) {
                <div class="mb-2">
                  <span class="text-muted d-block reference-label">REFERENTE</span>
                  <a [href]="'mailto:' + cfg.email_referente" class="d-block text-break">{{ cfg.email_referente }}</a>
                </div>
              }
              @if (cfg.durata_prova_minuti) {
                <div class="mb-2">
                  <span class="text-muted d-block reference-label">DURATA PROVA</span>
                  <span class="fw-semibold">{{ cfg.durata_prova_minuti }} minuti</span>
                </div>
              }
              @if (cfg.email_esperto_remoto) {
                <div class="mb-2">
                  <span class="text-muted d-block reference-label">ESPERTO REMOTO</span>
                  <a [href]="'mailto:' + cfg.email_esperto_remoto" class="text-break">{{ cfg.email_esperto_remoto }}</a>
                </div>
              }
              @if (cfg.nome_informatico_sede || cfg.email_informatico_sede || cfg.telefono_informatico_sede) {
                <div class="mb-2">
                  <span class="text-muted d-block reference-label">INFORMATICO SEDE</span>
                  @if (cfg.nome_informatico_sede) { <span class="d-block fw-semibold">{{ cfg.nome_informatico_sede }}</span> }
                  @if (cfg.email_informatico_sede) { <a [href]="'mailto:' + cfg.email_informatico_sede" class="d-block text-break">{{ cfg.email_informatico_sede }}</a> }
                  @if (cfg.telefono_informatico_sede) { <a [href]="'tel:' + cfg.telefono_informatico_sede" class="d-block">{{ cfg.telefono_informatico_sede }}</a> }
                </div>
              }
              @if (cfg.email_segretario || cfg.telefono_segretario) {
                <div class="mb-1">
                  <span class="text-muted d-block reference-label">SEGRETARIO</span>
                  @if (cfg.email_segretario) { <a [href]="'mailto:' + cfg.email_segretario" class="d-block text-break">{{ cfg.email_segretario }}</a> }
                  @if (cfg.telefono_segretario) { <a [href]="'tel:' + cfg.telefono_segretario" class="d-block">{{ cfg.telefono_segretario }}</a> }
                </div>
              }
            </div>
          }
          <div class="sidebar-linklist-wrapper flex-grow-1 overflow-y-auto">
            <div class="link-list-wrapper">
              <ul class="link-list">
                <li><h3 class="m-3">Navigazione</h3></li>
                <li><a class="list-item medium active" routerLink="/bandi" [queryParams]="{ mode: viewMode }"><span>Lista Concorsi</span></a></li>
                <li><a class="list-item medium" [routerLink]="['/sessioni', sessionId, 'dispositivi']" [queryParams]="{ mode: viewMode }"><span>Dispositivi</span></a></li>
              </ul>
            </div>
          </div>
        </aside>

        <main class="col-md-10 content-area">
          <div class="it-card-wrapper mb-3">
            <div class="it-card rounded shadow-sm p-4">
              <div class="row">
                <div [class]="showTimeline ? 'col-md-8' : 'col-12'">
                  <app-azioni
                    [sessionId]="sessionId"
                    [commissionId]="detail()?.commission_id ?? ''"
                    [currentState]="workflowState()?.current_state ?? null"
                    [bandoConfigured]="bandoConfigured()"
                    [deviceCount]="detail()?.device_count ?? 0"
                    [viewMode]="viewMode"
                    (changed)="load()"
                  />
                  <div class="mb-3"><app-candidati [sessionId]="sessionId" /></div>
                  @if (viewMode === 'sede' || viewMode === 'esperto') {
                    <app-reset-password [sessionId]="sessionId" [viewMode]="viewMode" />
                  }
                  @if (!showTimeline) {
                    <app-notifiche [sessionId]="sessionId" />
                  }
                </div>
                @if (showTimeline) {
                  <div class="col-md-4">
                    <app-exam-timeline [currentState]="workflowState()?.current_state ?? null" />
                    <app-notifiche [sessionId]="sessionId" />
                  </div>
                }
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: `
    .gestione-sessione { background-color: #f5f6f8; }
    .sidebar-wrapper { background-color: white; min-height: 100vh; border-right: 1px solid #e0e0e0; }
    .content-area { background-color: #f5f6f8; min-height: 100vh; padding: 2rem; }
    .it-card { background-color: white; }
    .operational-references { font-size: 0.78rem; }
    .reference-title, .reference-label { font-size: 0.7rem; }
    .reference-title { letter-spacing: 0.05em; }
  `,
})
export class GestioneSessioneComponent {
  private readonly api = inject(ApiClient);
  private readonly bandiService = inject(BandiService);
  private readonly route = inject(ActivatedRoute);
  readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
  readonly viewMode = normalizeViewMode(this.route.snapshot.queryParamMap.get('mode'));
  readonly showTimeline = this.viewMode === 'segretario';
  readonly detail = signal<SessionSummary | null>(null);
  readonly workflowState = signal<WorkflowState | null>(null);
  readonly bandoConfigured = signal(false);
  readonly mergedConfig = signal<OperationalConfig | null>(null);

  constructor() { this.load(); }

  load(): void {
    this.api.get<SessionSummary>(`/sessioni/${this.sessionId}`).subscribe((detail) => {
      this.detail.set(detail);
      this.bandiService.detail(detail.commission_id).subscribe((bando) => this.bandoConfigured.set(bando.configured));
      forkJoin({
        bando: this.api.get<OperationalConfig>(`/bandi/${detail.commission_id}/config`),
        sessione: this.api.get<OperationalConfig>(`/sessioni/${this.sessionId}/config`),
      }).subscribe(({ bando, sessione }) => {
        const sessionValues = Object.fromEntries(
          Object.entries(sessione).filter(([, value]) => value !== null && value !== ''),
        );
        this.mergedConfig.set({ ...bando, ...sessionValues });
      });
    });
    this.api.get<WorkflowState>(`/sessioni/${this.sessionId}/state`).subscribe((state) => this.workflowState.set(state));
  }
}

export function normalizeViewMode(mode: string | null): 'segretario' | 'sede' | 'esperto' {
  if (mode === 'expert' || mode === 'esperto') return 'esperto';
  if (mode === 'sede') return 'sede';
  return 'segretario';
}
