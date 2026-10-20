import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ItIconComponent } from 'design-angular-kit';
import { Html5Qrcode } from 'html5-qrcode';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../core/api-client';
import { CandidateSummary, ScannerSessionSummary } from '../../core/models/api.models';
import { ManualSearchComponent } from './manual-search.component';
import { sessionStateLabel } from '../../shared/session-states';

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
  imports: [DatePipe, FormsModule, RouterLink, ItIconComponent, ManualSearchComponent],
  template: `
    <main class="app-scanner app-phone--dark" aria-labelledby="scanner-title">
      <header class="app-s-head">
        @if (ready() && sessionId) {
          <a class="app-m-icon" [routerLink]="['/sessioni', sessionId]" [queryParams]="{ mode: mode }" aria-label="Torna alla sessione"><it-icon name="arrow-left" color="white" /></a>
        } @else {
          <a class="app-m-icon" routerLink="/" aria-label="Indietro"><it-icon name="arrow-left" color="white" /></a>
        }
        <div class="app-minw flex-grow-1">
          <h1 id="scanner-title" class="h6 mb-0 text-truncate text-white">{{ summary()?.name || (associationMode() ? 'Collega questo telefono' : 'Scanner') }}</h1>
          <span class="small">
            @if (ready()) {
              <span class="app-dot app-dot--ok" aria-hidden="true"></span>
              @if (workflowBlocked()) { Telefono collegato · {{ workflowBlocked() === 'Il check-in è concluso.' ? 'check-in concluso' : 'in attesa del check-in' }} }
              @else { Scanner collegato · {{ summary()?.checked_in_count ?? 0 }}/{{ summary()?.candidate_count ?? 0 }} presenti }
            } @else { {{ associationStatus() === 'Inquadra il QR della sessione' ? 'Non ancora collegato a una sessione' : associationStatus() }} }
          </span>
        </div>
        @if (ready()) {
          <div class="position-relative">
            <button type="button" class="app-m-icon btn p-0" aria-label="Altre opzioni" aria-controls="scanner-menu" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())"><it-icon name="more-items" color="white" /></button>
            @if (menuOpen()) {
              <div id="scanner-menu" class="app-scanner-menu shadow"><div class="link-list-wrapper"><ul class="link-list mb-0">
                <li><button type="button" class="list-item btn btn-link text-start w-100" (click)="menuOpen.set(false); toggleManualSearch()">Cerca a mano</button></li>
                <li><button type="button" class="list-item btn btn-link text-start w-100 text-danger" (click)="menuOpen.set(false); clearAssociation()">Scollega questo telefono</button></li>
              </ul></div></div>
            }
          </div>
        }
      </header>

      <div class="app-camera" [class.app-camera--dim]="!!workflowBlocked()">
        <p class="app-camera-hint">{{ cameraHint() }}</p>
        <div id="reader-wrapper" [class.d-none]="candidate() || workflowBlocked() || manualSearchOpen() || !(ready() || associationMode())"><div id="reader"></div></div>
        @if (workflowBlocked() || candidate() || manualSearchOpen()) { <div class="app-frame" aria-hidden="true"><span></span><span></span><span></span><span></span></div> }
      </div>

      @if (associationMode()) {
        <section class="app-sheet" aria-live="polite">
          <p class="app-eyebrow mb-1">Passo 1 di 2</p>
          <h2 class="h4 mb-2">{{ associationStatus() }}</h2>
          @if (associationStatus() === 'Collegamento in corso…') {
            <p class="mb-0" role="status"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Registro questo telefono…</p>
          } @else {
            <p class="mb-3">Scansiona il QR code della sessione per collegare questo telefono: lo trovi nella pagina della sessione, nel riquadro “Collega gli smartphone”.</p>
            <p class="small text-secondary mb-0">Hai ricevuto il link per email o in chat? Aprilo da questo telefono: il collegamento parte da solo.</p>
          }
          @if (message() && messageIsError()) { <div class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ message() }}</div> }
          @if (messageIsError()) { <button class="btn btn-primary w-100 mt-3" type="button" (click)="retryAssociation()">Scansiona di nuovo il QR</button> }
        </section>
      } @else if (ready() && workflowBlocked() && !candidate()) {
        <section class="app-sheet" aria-live="polite">
          <div class="d-flex align-items-center gap-2 mb-2"><it-icon name="clock" color="primary" /><h2 class="h4 mb-0">{{ workflowBlocked() }}</h2></div>
          @if (workflowBlocked() === 'Il check-in è concluso.') {
            <p class="mb-0">Non si possono più registrare presenze da questo telefono. Puoi scollegarlo dal menu ⋮.</p>
          } @else {
            <p class="mb-3">Quando il segretario preme “Avvia check-in”, questo telefono si sblocca da solo. Non serve ricaricare la pagina.</p>
            @if (summary(); as info) { <p class="small text-secondary mb-0">Stato della sessione: {{ stateLabel(info.current_state) }}</p> }
          }
        </section>
      } @else if (ready() && manualSearchOpen() && !candidate()) {
        <section class="app-sheet" aria-labelledby="manual-title">
          <div class="d-flex justify-content-between align-items-center mb-2"><h2 id="manual-title" class="h4 mb-0">Cerca il candidato</h2>
            <button type="button" class="btn btn-link p-0 fw-semibold" (click)="resetScanner()">Torna alla fotocamera</button></div>
          <app-manual-search [sessionId]="sessionId" [deviceToken]="deviceToken" (candidateSelected)="openCandidate($event)" />
        </section>
      } @else if (candidate(); as item) {
        <section class="app-sheet" aria-live="polite" aria-labelledby="candidate-title">
          @if (item.checkin_effettuato) {
            <div class="d-flex align-items-center gap-2 mb-2"><it-icon name="check-circle" color="success" /><h2 class="h4 mb-0">{{ justConfirmed() ? 'Presenza registrata' : 'Già registrato' }}</h2></div>
            <p id="candidate-title" class="h5 mb-1">{{ item.last_name }} {{ item.first_name }}</p>
            @if (justConfirmed()) { <p class="mb-3 text-secondary">Presente dalle {{ item.checkin_at | date:'HH:mm' }}.</p> }
            @else { <p class="mb-3 text-secondary">Presente dalle {{ item.checkin_at | date:'HH:mm' }}, registrato {{ item.checkin_source === 'scanner' ? 'dallo scanner' : 'dalla tabella' }}. Non devi fare altro.</p> }
            <button class="btn btn-primary btn-lg w-100" type="button" (click)="resetScanner()">Scansiona il prossimo</button>
          } @else {
            <p class="app-eyebrow text-success mb-1">Candidato trovato</p>
            <h2 id="candidate-title" class="h3 mb-2">{{ item.last_name }}<br>{{ item.first_name }}</h2>
            <dl class="app-sheet-dl">
              <dt>Documento</dt><dd class="app-mono">{{ item.document_number }}</dd>
              <dt>Validità</dt>@if (item.document_expired) { <dd class="text-danger fw-bold">Scaduto</dd> } @else { <dd class="text-success fw-semibold">Valido</dd> }
            </dl>
            @if (item.document_expired) { <div class="alert alert-danger py-2 mb-3" role="note">Verifica un altro documento prima di confermare. Puoi aggiungere una nota.</div> }
            @if (message()) { <p class="small mb-2" [class.text-danger]="messageIsError()" role="status">{{ message() }}</p> }
            <button class="btn btn-success btn-lg w-100 app-btn-xl" type="button" (click)="confirmCheckin()" [disabled]="busy()">Conferma presenza</button>
            @if (noteOpen()) {
              <label for="candidate-note" class="form-label mt-3">Nota</label>
              <textarea id="candidate-note" class="form-control" rows="3" maxlength="2000" [(ngModel)]="noteDraft" name="candidate-note"></textarea>
              <button class="btn btn-outline-primary w-100 mt-2" type="button" (click)="saveCandidateNote()" [disabled]="busy()">Salva nota</button>
            }
            <div class="d-flex gap-2 mt-2">
              @if (!noteOpen()) { <button type="button" class="btn btn-outline-primary flex-fill" (click)="noteOpen.set(true)">Aggiungi nota</button> }
              <button type="button" class="btn btn-outline-secondary flex-fill" (click)="resetScanner()" [disabled]="busy()">Annulla</button>
            </div>
          }
        </section>
      } @else if (ready() && candidateNotFound()) {
        <section class="app-sheet" aria-live="polite">
          <div class="d-flex align-items-center gap-2 mb-2"><it-icon name="warning-circle" color="danger" /><h2 class="h4 mb-0">Candidato non trovato</h2></div>
          <p class="mb-3">{{ message() }} Controlla di inquadrare il QR sulla domanda del candidato, oppure cercalo per cognome o documento.</p>
          <div class="d-flex gap-2"><button class="btn btn-outline-primary flex-fill" type="button" (click)="resetScanner()">Scansiona di nuovo</button><button class="btn btn-primary flex-fill" type="button" (click)="openManualSearch()">Cerca per cognome</button></div>
        </section>
      } @else if (message()) {
        <p class="app-scanner-message" [class.is-error]="messageIsError()" role="status">{{ message() }}</p>
      }
    </main>
  `,
  styles: `
    .app-scanner { min-height: 100vh; display: flex; flex-direction: column; position: relative; overflow: hidden; }
    .app-scanner .app-camera { min-height: calc(100vh - 64px); }
    #reader-wrapper { width: min(320px, 86vw); position: relative; z-index: 1; }
    #reader { width: 100%; min-height: 240px; border-radius: 8px; overflow: hidden; }
    .app-scanner-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 30; min-width: 15rem; background: #fff; border-radius: 4px; padding: .25rem .75rem; }
    .app-scanner-message { position: absolute; left: 16px; right: 16px; bottom: 24px; text-align: center; font-weight: 600; color: #fff; margin: 0; }
    .app-scanner-message.is-error { color: #ffd5d9; }
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
  readonly menuOpen = signal(false);
  readonly noteOpen = signal(false);
  /** Presenza appena confermata da questo telefono (non "già registrato" altrove). */
  readonly justConfirmed = signal(false);
  readonly mode = this.route.snapshot.queryParamMap.get('mode') ?? 'segretario';
  readonly stateLabel = sessionStateLabel;
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
      // L'indicazione resta nel testo sopra il mirino (cameraHint).
      this.messageIsError.set(false);
      this.message.set('');
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
        this.justConfirmed.set(false);
        this.message.set('');
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
        this.justConfirmed.set(true);
        this.message.set('');
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

  /** Testo sopra il mirino (prototipi scanner-*.html). */
  cameraHint(): string {
    if (this.associationMode()) return 'Inquadra il QR della sessione sul computer del segretario';
    if (this.workflowBlocked()) return 'Scansione in pausa';
    return 'Inquadra il QR sulla domanda del candidato';
  }

  resetScanner(): void {
    this.noteOpen.set(false);
    this.justConfirmed.set(false);
    this.manualSearchOpen.set(false);
    this.candidate.set(null);
    this.currentUid = '';
    this.workflowBlocked.set('');
    this.candidateNotFound.set(false);
    this.messageIsError.set(false);
    this.message.set('');
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
    this.message.set('');
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
