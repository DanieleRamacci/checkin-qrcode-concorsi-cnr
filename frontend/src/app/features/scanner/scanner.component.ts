import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Html5Qrcode } from 'html5-qrcode';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { CandidateSummary, ScannerSessionSummary } from '../../core/models/api.models';
import { ManualSearchComponent } from './manual-search.component';

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
  imports: [DatePipe, FormsModule, ManualSearchComponent],
  template: `
    <main class="scanner-shell" aria-labelledby="scanner-title">
      <header class="scanner-head">
        <div><p class="mb-1">CHECK-IN CNR CONCORSI</p><h1 id="scanner-title" class="h4 mb-0">{{ summary()?.name || (associationMode() ? 'Collega telefono' : 'Scanner') }}</h1></div>
        @if (ready()) { <span class="scanner-count">Scanner collegato · {{ summary()?.checked_in_count ?? 0 }}/{{ summary()?.candidate_count ?? 0 }} presenti</span> }
        @if (ready()) { <details class="scanner-menu"><summary aria-label="Apri menu scanner">⋮</summary><div class="scanner-menu-items">
          <button type="button" (click)="toggleManualSearch()">Cerca a mano</button>
          <button type="button" (click)="clearAssociation()">Scollega questo telefono</button>
        </div></details> }
      </header>
      @if (associationMode()) {
        <section class="scanner-association"><h2 class="h5">{{ associationStatus() }}</h2><p>Scansiona il QR code della sessione per collegare questo telefono, oppure apri il link che hai ricevuto.</p>
          @if (associationStatus() === 'Collegamento in corso…') { <p class="small" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Registrazione dispositivo…</p> }
          @if (messageIsError()) { <button class="btn btn-outline-light" type="button" (click)="retryAssociation()">Scansiona di nuovo il QR</button> }
        </section>
      }
      @if (ready() && workflowBlocked()) {
        <section class="scanner-blocked" role="status"><h2 class="h5">{{ workflowBlocked() }}</h2><p>La fotocamera si attiverà quando il check-in sarà pronto.</p></section>
      }
      @if (ready() || associationMode()) {
        <div id="reader-wrapper" [class.d-none]="candidate() || workflowBlocked() || manualSearchOpen()"><div id="reader"></div></div>
      }
      @if (ready() && manualSearchOpen()) {
        <app-manual-search [sessionId]="sessionId" [deviceToken]="deviceToken" (candidateSelected)="openCandidate($event)" />
      }
      @if (message()) { <p class="scanner-message" [class.is-error]="messageIsError()" role="status">{{ message() }}</p> }
      @if (candidateNotFound() && ready()) {
        <div class="d-flex gap-2"><button class="btn btn-outline-light flex-fill" type="button" (click)="resetScanner()">Scansiona di nuovo</button><button class="btn btn-primary flex-fill" type="button" (click)="openManualSearch()">Cerca per cognome</button></div>
      }
      @if (candidate(); as item) {
        <section class="candidate-sheet" aria-labelledby="candidate-title">
          <p class="eyebrow mb-1">CANDIDATO</p><h2 id="candidate-title" class="h3">{{ item.last_name }} {{ item.first_name }}</h2>
          <p>Documento {{ item.document_number }}</p>
          @if (item.document_expired) { <p class="alert alert-danger">Documento scaduto. Puoi chiedere conferma prima di procedere.</p> }
          @if (item.checkin_effettuato) { <p class="alert alert-success">Presente dalle {{ item.checkin_at | date:'HH:mm' }}, registrato {{ item.checkin_source === 'scanner' ? 'dallo scanner' : 'dalla tabella' }}.</p> }
          @if (!item.checkin_effettuato && !workflowBlocked()) { <button class="btn btn-success w-100 btn-lg" type="button" (click)="confirmCheckin()" [disabled]="busy()">Conferma presenza</button> }
          <details class="mt-3"><summary>Aggiungi nota</summary><textarea class="form-control mt-2" rows="3" maxlength="2000" [(ngModel)]="noteDraft" name="candidate-note"></textarea><button class="btn btn-outline-primary mt-2" type="button" (click)="saveCandidateNote()" [disabled]="busy()">Salva nota</button></details>
          @if (item.checkin_effettuato) { <button class="btn btn-primary w-100 btn-lg mt-2" type="button" (click)="resetScanner()">Scansiona il prossimo</button> }
          @else { <button class="btn btn-outline-secondary w-100 mt-2" type="button" (click)="resetScanner()" [disabled]="busy()">Annulla</button> }
        </section>
      }
      @if (ready() && !candidate() && !workflowBlocked() && !manualSearchOpen()) { <p class="text-center text-white mt-3">Inquadra il QR code del candidato</p> }
    </main>
  `,
  styles: `
    .scanner-shell { min-height: 100vh; background: #17324d; color: white; padding: 1rem; max-width: 42rem; margin: auto; }
    .scanner-head { display:flex; align-items:center; justify-content:space-between; gap:.75rem; margin-bottom:1.5rem; }
    .scanner-count { font-size:.85rem; }
    .scanner-menu { position:relative; }
    .scanner-menu summary { cursor:pointer; font-size:1.5rem; padding:.2rem .65rem; }
    .scanner-menu-items { position:absolute; z-index:5; right:0; background:white; color:#17324d; min-width:13rem; box-shadow:0 4px 16px #0004; }
    .scanner-menu-items button { display:block; border:0; background:white; color:inherit; width:100%; text-align:left; padding:.75rem; }
    .scanner-association,.scanner-blocked,.candidate-sheet { background:white; color:#1a1a1a; border-radius:.75rem; padding:1.25rem; margin:1rem auto; }
    #reader-wrapper { max-width: 350px; margin: 0 auto 20px; background:#2d3945; padding:.5rem; border-radius:.5rem; }
    #reader { width: 100%; min-height: 250px; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; }
    .scanner-message { text-align:center; font-weight:600; margin-top:10px; }
    .scanner-message.is-error { color:#ffd5d9; }
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
  deviceToken = '';
  private camera: Html5Qrcode | null = null;
  private heartbeatTimer?: number;
  private summaryTimer?: number;

  readonly ready = signal(false);
  readonly associationMode = signal(false);
  readonly candidate = signal<CandidateSummary | null>(null);
  readonly message = signal('');
  readonly messageIsError = signal(false);
  readonly workflowBlocked = signal('');
  readonly candidateNotFound = signal(false);
  readonly busy = signal(false);
  readonly summary = signal<ScannerSessionSummary | null>(null);
  readonly manualSearchOpen = signal(false);
  readonly associationStatus = signal('Inquadra il QR della sessione');
  noteDraft = '';
  private currentUid = '';

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopCamera();
      if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
      if (this.summaryTimer) window.clearInterval(this.summaryTimer);
    });

    window.addEventListener('beforeunload', () => this.disconnectWithBeacon());

    if (this.sessionId) {
      try { this.deviceToken = localStorage.getItem(this.storageKey()) ?? ''; } catch { this.deviceToken = ''; }
    }
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
    this.associationMode.set(true);
    this.associationStatus.set('Collegamento in corso…');
    this.api.post<{ device_token: string }>('/devices/register', {
      session_id: this.sessionId,
      registration_token: this.registrationToken,
      device_name: navigator.platform || 'Dispositivo scanner',
    }).subscribe({
      next: ({ device_token }) => {
        this.deviceToken = device_token;
        try { localStorage.setItem(this.storageKey(), device_token); } catch { /* Scanner remains available for this tab. */ }
        this.associationStatus.set('Telefono collegato');
        this.verifyDevicesConnected();
        this.activateScanner();
      },
      error: (error) => {
        this.associationStatus.set('Collegamento non riuscito');
        this.fail(this.apiError(error, 'Registrazione dispositivo non riuscita.'));
        window.setTimeout(() => this.startCamera(), 0);
      },
    });
  }

  private verifyDevicesConnected(): void {
    this.api.post(`/sessioni/${this.sessionId}/devices/verify`).subscribe({ error: () => undefined });
  }

  private activateScanner(): void {
    this.associationMode.set(false);
    this.ready.set(true);
    this.messageIsError.set(false);
    this.summaryTimer = window.setInterval(() => this.refreshSessionSummary(), 5000);
    this.startHeartbeat();
    this.refreshSessionSummary();
  }

  private async startCamera(): Promise<void> {
    if ((!this.ready() && !this.associationMode()) || (this.ready() && this.workflowBlocked()) || this.camera?.isScanning) return;
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
    this.candidateNotFound.set(false);
    this.api.post<CandidateSummary>('/scanner/verify-candidate', this.payload()).subscribe({
      next: (candidate) => {
        this.busy.set(false);
        this.candidate.set(candidate);
        this.noteDraft = candidate.note ?? '';
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
        const code = (error as { error?: { error?: { code?: string } } })?.error?.error?.code;
        if (code === 'candidate_not_found') {
          this.candidateNotFound.set(true);
          this.messageIsError.set(true);
          this.message.set('Candidato non trovato.');
        } else window.setTimeout(() => this.startCamera(), 700);
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
        this.refreshSessionSummary();
      },
      error: (error) => {
        this.busy.set(false);
        const message = this.apiError(error, 'Check-in non consentito.');
        const body = (error as { error?: { error?: { code?: string; details?: { current_state?: string } } } })?.error?.error;
        if (body?.code === 'checkin_not_active') {
          this.summary.update((value) => value ? { ...value, current_state: body.details?.current_state ?? value.current_state } : value);
          this.setWorkflowState(body.details?.current_state ?? '');
        }
        this.fail(message);
      },
    });
  }

  resetScanner(): void {
    this.candidate.set(null);
    this.currentUid = '';
    this.workflowBlocked.set('');
    this.candidateNotFound.set(false);
    this.messageIsError.set(false);
    this.message.set('📷 In attesa di scansione...');
    window.setTimeout(() => this.startCamera(), 0);
  }

  toggleManualSearch(): void { this.manualSearchOpen.update((value) => !value); if (this.manualSearchOpen()) void this.stopCamera(); else window.setTimeout(() => this.startCamera(), 0); }

  openManualSearch(): void {
    this.manualSearchOpen.set(true);
    this.candidateNotFound.set(false);
    this.message.set('');
    this.messageIsError.set(false);
    void this.stopCamera();
  }

  retryAssociation(): void {
    this.message.set('');
    this.messageIsError.set(false);
    this.associationStatus.set('Inquadra il QR della sessione');
    window.setTimeout(() => this.startCamera(), 0);
  }

  openCandidate(uid: string): void {
    this.currentUid = uid;
    this.manualSearchOpen.set(false);
    this.verifyCandidate();
  }

  saveCandidateNote(): void {
    if (!this.currentUid) return;
    this.busy.set(true);
    this.api.post<CandidateSummary>('/scanner/candidate-note', { ...this.payload(), note: this.noteDraft }).subscribe({
      next: (candidate) => { this.candidate.set(candidate); this.busy.set(false); this.message.set('Nota salvata.'); },
      error: () => { this.busy.set(false); this.fail('Salvataggio della nota non riuscito.'); },
    });
  }

  async clearAssociation(): Promise<void> {
    await this.stopCamera();
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    if (this.summaryTimer) window.clearInterval(this.summaryTimer);
    this.api.post('/devices/disconnect', {
      session_id: this.sessionId,
      device_token: this.deviceToken,
    }).subscribe({ error: () => undefined });
    try { localStorage.removeItem(this.storageKey()); } catch { /* Storage may be unavailable. */ }
    this.deviceToken = '';
    this.ready.set(false);
    this.candidate.set(null);
    this.sessionId = '';
    this.registrationToken = '';
    window.history.replaceState({}, '', '/scanner');
    this.startAssociationMode();
  }

  private refreshSessionSummary(): void {
    if (!this.ready() || !this.deviceToken) return;
    this.api.post<ScannerSessionSummary>('/scanner/session-summary', { session_id: this.sessionId, device_token: this.deviceToken }).subscribe({
      next: (summary) => { this.summary.set(summary); this.setWorkflowState(summary.current_state); },
      error: () => this.fail('Impossibile aggiornare il riepilogo della sessione.'),
    });
  }

  private setWorkflowState(state: string): void {
    if (state === 'checkin_avviato') {
      if (this.summaryTimer) {
        window.clearInterval(this.summaryTimer);
        this.summaryTimer = undefined;
      }
      const wasBlocked = !!this.workflowBlocked();
      this.workflowBlocked.set('');
      if (wasBlocked) window.setTimeout(() => this.startCamera(), 0);
      else if (!this.camera?.isScanning) window.setTimeout(() => this.startCamera(), 0);
    } else {
      void this.stopCamera();
      if (!this.summaryTimer && this.ready()) {
        this.summaryTimer = window.setInterval(() => this.refreshSessionSummary(), 5000);
      }
      this.workflowBlocked.set(state === 'checkin_concluso' || state === 'liste_generate' || state === 'liste_inviate' || state.includes('esame')
        ? 'Il check-in è concluso.'
        : 'Il check-in non è ancora iniziato.');
    }
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
