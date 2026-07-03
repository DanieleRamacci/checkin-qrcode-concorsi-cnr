import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import * as QRCode from 'qrcode';
import { forkJoin } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { ApiList, DeviceSummary, SessionSummary } from '../../core/models/api.models';

const STATUS_LABELS: Record<DeviceSummary['status'], string> = {
  online: 'connesso',
  offline: 'offline',
  disconnected: 'disconnesso',
};

interface OperationalConfig {
  email_esperto_remoto?: string;
  email_segretario?: string;
  nome_informatico_sede?: string;
  email_informatico_sede?: string;
  telefono_informatico_sede?: string;
}

/**
 * Replica templates/dispositivi.html: sidebar + content-area, card QR con istruzioni,
 * tabella dispositivi con refresh periodico (era hx-trigger="every 2s" nel legacy).
 */
@Component({
  selector: 'app-dispositivi',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="container-fluid dispositivi-page">
      <div class="row">
        <aside class="col-md-2 p-0 sidebar-wrapper d-flex flex-column">
          @if (sessionDetail(); as detail) {
            <div class="p-3 border-bottom bg-light">
              <h6 class="mb-1 text-uppercase text-primary fw-bold">{{ detail.name }}</h6>
              <small class="d-block">{{ detail.location }}</small>
              <small class="text-muted">{{ detail.date }} alle {{ detail.time }}</small>
            </div>
          }
          @if (operationalConfig(); as cfg) {
            <div class="p-3 border-bottom bg-white operational-references">
              <p class="fw-bold text-uppercase text-muted mb-2 reference-title">Riferimenti operativi</p>
              @if (cfg.email_esperto_remoto) {
                <span class="text-muted d-block reference-label">ESPERTO REMOTO</span>
                <a [href]="'mailto:' + cfg.email_esperto_remoto" class="d-block text-break mb-2">{{ cfg.email_esperto_remoto }}</a>
              }
              @if (cfg.nome_informatico_sede || cfg.email_informatico_sede) {
                <span class="text-muted d-block reference-label">INFORMATICO SEDE</span>
                @if (cfg.nome_informatico_sede) { <span class="d-block">{{ cfg.nome_informatico_sede }}</span> }
                @if (cfg.email_informatico_sede) { <a [href]="'mailto:' + cfg.email_informatico_sede" class="d-block text-break">{{ cfg.email_informatico_sede }}</a> }
                @if (cfg.telefono_informatico_sede) { <a [href]="'tel:' + cfg.telefono_informatico_sede" class="d-block mb-2">{{ cfg.telefono_informatico_sede }}</a> }
              }
              @if (cfg.email_segretario) {
                <span class="text-muted d-block reference-label">SEGRETARIO</span>
                <a [href]="'mailto:' + cfg.email_segretario" class="d-block text-break">{{ cfg.email_segretario }}</a>
              }
            </div>
          }
          <div class="sidebar-linklist-wrapper flex-grow-1 overflow-y-auto">
            <div class="link-list-wrapper">
              <ul class="link-list">
                <li><h3 class="m-3">Navigazione</h3></li>
                <li><a class="list-item medium" routerLink="/bandi" [queryParams]="{ mode }"><span>Lista Concorsi</span></a></li>
                <li><a class="list-item medium" [routerLink]="['/sessioni', sessionId]" [queryParams]="{ mode }"><span>Gestione concorso</span></a></li>
              </ul>
            </div>
          </div>
        </aside>

        <main class="col-md-10 content-area">
          <div class="it-card-wrapper">
            <div class="it-card rounded shadow-sm p-4 mb-4">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h4>Collegamento Dispositivi – <span class="text-primary">{{ sessionName() }}</span></h4>
              </div>
              <div class="row align-items-center">
                <div class="col-md-3 text-center">
                  @if (qrDataUrl()) {
                    <img [src]="qrDataUrl()" alt="QR Code" style="max-width: 150px;" class="img-fluid" />
                  }
                </div>
                <div class="col-md-9">
                  <ol class="mb-2">
                    <li>Apri la fotocamera del dispositivo tablet/telefono</li>
                    <li>Inquadra il QR code qui a fianco</li>
                    <li>Segui il link che si apre e accedi con le credenziali CNR</li>
                    <li>Il dispositivo viene registrato automaticamente per questa sessione ed è pronto per il check-in dei candidati</li>
                  </ol>
                  @if (scannerUrl()) {
                    <div class="bg-light p-2 rounded small">
                      URL di collegamento:<br />
                      <code>{{ scannerUrl() }}</code>
                    </div>
                  }
                  @if (linkError()) {
                    <div class="alert alert-danger mt-2 mb-0" role="alert">
                      {{ linkError() }}
                      <button class="btn btn-sm btn-outline-danger ms-2" type="button" (click)="createLink()">Riprova</button>
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="table-responsive mt-3">
              <div class="d-flex justify-content-end mb-2">
                <button class="btn btn-sm btn-outline-primary" type="button" [disabled]="loading()" (click)="load()">Aggiorna</button>
              </div>
              @if (error()) {
                <div class="alert alert-danger" role="alert">{{ error() }}</div>
              }
              @if (loading()) {
                <div class="d-flex align-items-center gap-2 mb-2" role="status">
                  <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                  <span>Caricamento dispositivi…</span>
                </div>
              }
              @if (items().length > 0) {
                <div class="text-end mb-3">
                  <a class="btn btn-primary" [routerLink]="['/sessioni', sessionId]" [queryParams]="{ mode }">Torna alla gestione concorso</a>
                </div>
              }
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>Ora di collegamento</th>
                    <th>Stato</th>
                    <th>Ultimo ping</th>
                    <th>Nome dispositivo</th>
                    <th>Browser / Sistema</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of items(); track item.id) {
                    <tr>
                      <td>{{ item.timestamp ? (item.timestamp | date: 'dd/MM/yyyy HH:mm') : '-' }}</td>
                      <td>
                        @if (item.status === 'online') {
                          <span class="badge bg-success">{{ statusLabel(item.status) }}</span>
                        } @else if (item.status === 'offline') {
                          <span class="badge bg-warning text-dark">{{ statusLabel(item.status) }}</span>
                        } @else {
                          <span class="badge bg-secondary">{{ statusLabel(item.status) }}</span>
                        }
                      </td>
                      <td>
                        {{
                          (item.status === 'disconnected' ? item.disconnected_at : item.last_seen)
                            ? ((item.status === 'disconnected' ? item.disconnected_at : item.last_seen) | date: 'dd/MM/yyyy HH:mm')
                            : '-'
                        }}
                      </td>
                      <td>{{ item.nome_dispositivo || '-' }}</td>
                      <td>{{ item.user_agent }}</td>
                      <td>{{ item.ip_address }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="text-center text-muted">Nessun dispositivo collegato.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: `
    .dispositivi-page { background-color: #f5f6f8; }
    .sidebar-wrapper { background-color: white; min-height: 100vh; border-right: 1px solid #e0e0e0; }
    .content-area { background-color: #f5f6f8; min-height: 100vh; padding: 2rem; }
    .it-card { background-color: white; }
    .operational-references { font-size: 0.78rem; }
    .reference-title, .reference-label { font-size: 0.7rem; }
  `,
})
export class DispositiviComponent {
  private readonly api = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  readonly sessionId = this.route.snapshot.paramMap.get('sessionId') ?? '';
  readonly mode = this.route.snapshot.queryParamMap.get('mode') ?? 'segretario';
  readonly items = signal<DeviceSummary[]>([]);
  readonly sessionName = signal('');
  readonly sessionDetail = signal<SessionSummary | null>(null);
  readonly operationalConfig = signal<OperationalConfig | null>(null);
  readonly scannerUrl = signal('');
  readonly qrDataUrl = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly linkError = signal('');

  ngOnInit(): void {
    this.api.get<SessionSummary>(`/sessioni/${this.sessionId}`).subscribe((detail) => {
      this.sessionName.set(detail.name);
      this.sessionDetail.set(detail);
      forkJoin({
        bando: this.api.get<OperationalConfig>(`/bandi/${detail.commission_id}/config`),
        sessione: this.api.get<OperationalConfig>(`/sessioni/${this.sessionId}/config`),
      }).subscribe(({ bando, sessione }) => {
        const sessionValues = Object.fromEntries(
          Object.entries(sessione).filter(([, value]) => value !== null && value !== ''),
        );
        this.operationalConfig.set({ ...bando, ...sessionValues });
      });
    });
    this.createLink();
    this.load();
    const timer = window.setInterval(() => this.load(), 2000);
    this.destroyRef.onDestroy(() => window.clearInterval(timer));
  }

  statusLabel(status: DeviceSummary['status']): string {
    return STATUS_LABELS[status];
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.get<ApiList<DeviceSummary>>(`/sessioni/${this.sessionId}/devices`).subscribe({
      next: ({ items }) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Impossibile aggiornare l’elenco dei dispositivi.');
      },
    });
  }

  createLink(): void {
    this.linkError.set('');
    this.api.post<{ registration_token: string }>(`/sessioni/${this.sessionId}/devices/registration-token`).subscribe({
      next: ({ registration_token }) => {
        const params = new URLSearchParams({ sessionId: this.sessionId, token: registration_token });
        const url = `${window.location.origin}/scanner?${params}`;
        this.scannerUrl.set(url);
        QRCode.toDataURL(url, { width: 150 }).then(
          (dataUrl) => this.qrDataUrl.set(dataUrl),
          () => this.linkError.set('Generazione del QR di collegamento non riuscita.'),
        );
      },
      error: () => this.linkError.set('Creazione del collegamento dispositivo non riuscita.'),
    });
  }
}
