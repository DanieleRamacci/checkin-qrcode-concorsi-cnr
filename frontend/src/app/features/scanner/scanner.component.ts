import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';
import { ApiClient } from '../../core/api-client';
import { CandidateSummary } from '../../core/models/api.models';

export function parseCandidateQr(decodedText: string): string | null {
  try {
    const payload = JSON.parse(decodedText) as { uid?: unknown };
    const uid = String(payload.uid ?? '').trim();
    return uid || null;
  } catch {
    return null;
  }
}

export function parseSessionQr(decodedText: string): string | null {
  try {
    const url = new URL(decodedText, window.location.origin);
    const sessionId =
      url.searchParams.get('sessionId')
      ?? url.searchParams.get('session_id');
    const token = url.searchParams.get('token');
    if (sessionId && token) {
      const params = new URLSearchParams({ sessionId, token });
      return `/scanner?${params.toString()}`;
    }
  } catch {
    // Prova il formato JSON legacy.
  }
  try {
    const payload = JSON.parse(decodedText) as {
      session_id?: unknown;
      sessionId?: unknown;
      token?: unknown;
    };
    const sessionId = String(payload.sessionId ?? payload.session_id ?? '').trim();
    const token = String(payload.token ?? '').trim();
    if (!sessionId || !token) return null;
    const params = new URLSearchParams({ sessionId, token });
    return `/scanner?${params.toString()}`;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-scanner',
  template: `
    <section class="scanner container my-4" aria-labelledby="scanner-title">
      <h1 id="scanner-title" class="text-center">Scanner Check-in</h1>

      @if (workflowBlocked()) {
        <div class="alert alert-warning" role="alert">{{ workflowBlocked() }}</div>
      }

      <div class="mb-3 text-center">
        @if (associationMode()) {
          <p class="text-muted">📷 Scansiona il QR code della sessione per iniziare</p>
        } @else {
          <p class="text-muted mb-1">
            Sessione: <strong>{{ sessionId || 'non associata' }}</strong>
          </p>
        }
        @if (ready()) {
          <span class="badge bg-success">Dispositivo associato</span>
        }
      </div>

      @if (ready()) {
        <button class="btn btn-outline-danger w-100 mb-3" type="button" (click)="clearAssociation()">
          Elimina sessione
        </button>

      } @else if (!associationMode() && !message()) {
        <div class="text-center" role="status">
          <div class="spinner-border spinner-border-sm me-2" aria-hidden="true"></div>
          Registrazione dispositivo…
        </div>
      }

      @if (ready() || associationMode()) {
        <div id="reader-wrapper" [class.d-none]="candidate()">
          <div id="reader"></div>
        </div>
      }

      <div class="text-center status-message" [class.text-danger]="messageIsError()" [class.text-info]="!messageIsError()" role="status">
        {{ message() }}
      </div>

      @if (candidate(); as item) {
        <div class="card mt-3" id="candidate-card">
          <div class="card-body">
            <p><strong>Nome:</strong> {{ item.first_name }}</p>
            <p><strong>Cognome:</strong> {{ item.last_name }}</p>
            <p><strong>Numero documento:</strong> {{ item.document_number }}</p>
            <p><strong>Check-in:</strong> {{ item.checkin_effettuato ? 'Già registrato' : 'Non registrato' }}</p>

            @if (item.document_expired) {
              <div class="alert alert-danger">Documento scaduto</div>
            }
          </div>
        </div>

        <div class="mt-3">
          @if (!item.checkin_effettuato && !workflowBlocked()) {
            <button class="btn btn-success w-100 btn-lg" type="button" (click)="confirmCheckin()" [disabled]="busy()">
              Conferma Check-in
            </button>
          }
          <button class="btn btn-secondary w-100 btn-lg mt-2" type="button" (click)="resetScanner()" [disabled]="busy()">
            Nuovo Check-in
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .scanner { max-width: 42rem; }
    #reader-wrapper { max-width: 350px; margin: 0 auto 20px; }
    #reader { width: 100%; min-height: 250px; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; }
    .status-message { min-height: 1.5rem; font-weight: 600; margin-top: 10px; }
    #candidate-card p { margin-bottom: 4px; }
    .btn-lg { font-size: 1rem; padding: 12px 20px; }
  `,
})
export class ScannerComponent {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  sessionId =
    this.route.snapshot.queryParamMap.get('sessionId')
    ?? this.route.snapshot.queryParamMap.get('session_id')
    ?? '';
  private registrationToken = this.route.snapshot.queryParamMap.get('token') ?? '';
  private deviceToken = this.sessionId
    ? localStorage.getItem(this.storageKey()) ?? ''
    : '';
  private camera: Html5Qrcode | null = null;
  private heartbeatTimer?: number;

  readonly ready = signal(false);
  readonly associationMode = signal(false);
  readonly candidate = signal<CandidateSummary | null>(null);
  readonly message = signal('');
  readonly messageIsError = signal(false);
  readonly workflowBlocked = signal('');
  readonly busy = signal(false);
  private currentUid = '';

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopCamera();
      if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    });

    window.addEventListener('beforeunload', () => this.disconnectWithBeacon());

    if (!this.sessionId) {
      this.startAssociationMode();
      return;
    }
    if (this.registrationToken) {
      this.registerDevice();
      return;
    }
    if (this.deviceToken) {
      this.activateScanner();
      return;
    }
    this.startAssociationMode();
  }

  private registerDevice(): void {
    this.api.post<{ device_token: string }>('/devices/register', {
      session_id: this.sessionId,
      registration_token: this.registrationToken,
      device_name: navigator.platform || 'Dispositivo scanner',
    }).subscribe({
      next: ({ device_token }) => {
        this.deviceToken = device_token;
        localStorage.setItem(this.storageKey(), device_token);
        this.verifyDevicesConnected();
        this.activateScanner();
      },
      error: (error) => this.fail(this.apiError(error, 'Registrazione dispositivo non riuscita.')),
    });
  }

  private verifyDevicesConnected(): void {
    this.api.post(`/sessioni/${this.sessionId}/devices/verify`).subscribe({ error: () => undefined });
  }

  private activateScanner(): void {
    this.associationMode.set(false);
    this.ready.set(true);
    this.messageIsError.set(false);
    this.message.set('📷 In attesa di scansione...');
    this.startHeartbeat();
    window.setTimeout(() => this.startCamera(), 0);
  }

  private async startCamera(): Promise<void> {
    if ((!this.ready() && !this.associationMode()) || this.camera?.isScanning) return;
    this.camera = this.camera ?? new Html5Qrcode('reader');
    try {
      await this.camera.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => this.onScan(decodedText),
        () => undefined,
      );
      this.messageIsError.set(false);
      this.message.set(
        this.associationMode()
          ? '📷 Inquadra il QR code della sessione'
          : '📷 Inquadra il QR code del candidato',
      );
    } catch {
      this.fail('Impossibile accedere alla fotocamera. Verifica i permessi del browser.');
    }
  }

  private async stopCamera(): Promise<void> {
    if (!this.camera?.isScanning) return;
    try {
      await this.camera.stop();
    } catch {
      // La camera può essere già stata chiusa dal browser.
    }
  }

  private onScan(decodedText: string): void {
    if (this.associationMode()) {
      const target = parseSessionQr(decodedText);
      if (!target) {
        this.fail('QR sessione non valido.');
        return;
      }
      void this.stopCamera().then(() => window.location.assign(target));
      return;
    }
    const uid = parseCandidateQr(decodedText);
    if (!uid) {
      this.fail('QR candidato non valido.');
      return;
    }
    this.currentUid = uid;
    void this.stopCamera();
    this.verifyCandidate();
  }

  private verifyCandidate(): void {
    this.busy.set(true);
    this.workflowBlocked.set('');
    this.api.post<CandidateSummary>('/scanner/verify-candidate', this.payload()).subscribe({
      next: (candidate) => {
        this.busy.set(false);
        this.candidate.set(candidate);
        this.messageIsError.set(false);
        this.message.set(
          candidate.checkin_effettuato
            ? 'Check-in già registrato.'
            : '✅ Candidato trovato. Conferma il check-in.',
        );
      },
      error: (error) => {
        this.busy.set(false);
        this.currentUid = '';
        this.fail(this.apiError(error, 'Candidato non trovato o dispositivo non autorizzato.'));
        window.setTimeout(() => this.startCamera(), 700);
      },
    });
  }

  confirmCheckin(): void {
    if (!this.currentUid) return;
    this.busy.set(true);
    this.api.post<CandidateSummary>('/scanner/checkin-candidate', this.payload()).subscribe({
      next: (candidate) => {
        this.busy.set(false);
        this.candidate.set(candidate);
        this.messageIsError.set(false);
        this.message.set('✅ Check-in registrato!');
      },
      error: (error) => {
        this.busy.set(false);
        const message = this.apiError(error, 'Check-in non consentito.');
        this.workflowBlocked.set(message);
        this.fail(message);
      },
    });
  }

  resetScanner(): void {
    this.candidate.set(null);
    this.currentUid = '';
    this.workflowBlocked.set('');
    this.messageIsError.set(false);
    this.message.set('📷 In attesa di scansione...');
    window.setTimeout(() => this.startCamera(), 0);
  }

  async clearAssociation(): Promise<void> {
    await this.stopCamera();
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    this.api.post('/devices/disconnect', {
      session_id: this.sessionId,
      device_token: this.deviceToken,
    }).subscribe({ error: () => undefined });
    localStorage.removeItem(this.storageKey());
    this.deviceToken = '';
    this.ready.set(false);
    this.candidate.set(null);
    this.sessionId = '';
    this.registrationToken = '';
    window.history.replaceState({}, '', '/scanner');
    this.startAssociationMode();
  }

  private payload() {
    return {
      session_id: this.sessionId,
      uid: this.currentUid,
      device_token: this.deviceToken,
    };
  }

  private startHeartbeat(): void {
    const ping = () => this.api.post('/devices/ping', {
      session_id: this.sessionId,
      device_token: this.deviceToken,
    }).subscribe({
      error: () => this.fail('Connessione del dispositivo non valida. Associa nuovamente lo scanner.'),
    });
    ping();
    this.heartbeatTimer = window.setInterval(ping, 30000);
  }

  private disconnectWithBeacon(): void {
    if (!this.sessionId || !this.deviceToken || !navigator.sendBeacon) return;
    const body = new Blob(
      [JSON.stringify({ session_id: this.sessionId, device_token: this.deviceToken })],
      { type: 'application/json' },
    );
    navigator.sendBeacon('/api/v1/devices/disconnect', body);
  }

  private storageKey(): string {
    return `checkin-device-${this.sessionId}`;
  }

  private startAssociationMode(): void {
    this.ready.set(false);
    this.associationMode.set(true);
    this.candidate.set(null);
    this.currentUid = '';
    this.workflowBlocked.set('');
    this.messageIsError.set(false);
    this.message.set('📷 Inquadra il QR code della sessione');
    window.setTimeout(() => this.startCamera(), 0);
  }

  private fail(message: string): void {
    this.messageIsError.set(true);
    this.message.set(message);
  }

  private apiError(error: unknown, fallback: string): string {
    return (
      (error as { error?: { error?: { message?: string } } })?.error?.error?.message
      ?? fallback
    );
  }
}
