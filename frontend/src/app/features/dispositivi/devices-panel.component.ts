import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { interval, startWith, switchMap } from 'rxjs';
import * as QRCode from 'qrcode';
import { ItIconComponent } from 'design-angular-kit';
import { ApiClient } from '../../core/api-client';
import { ApiList, DeviceSummary } from '../../core/models/api.models';

const TOKEN_VALIDITY_MS = 30 * 60 * 1000;
const TOKEN_REFRESH_MS = 25 * 60 * 1000;

/**
 * Collegamento degli smartphone (prototipo sessione-dispositivi.html): QR con
 * "Copia link di collegamento", istruzioni e dispositivi collegati che si
 * aggiornano da soli.
 */
@Component({
  selector: 'app-devices-panel',
  imports: [DatePipe, ItIconComponent],
  template: `
    <div class="row g-4 align-items-start">
      <div class="col-12 col-md-auto text-center">
        @if (qrDataUrl()) {
          <img class="app-qr" [src]="qrDataUrl()" width="200" height="200" alt="QR code di collegamento alla sessione" />
        } @else {
          <div class="app-qr d-flex align-items-center justify-content-center mx-auto small text-secondary">{{ message() ? 'QR non disponibile' : 'Preparo il QR…' }}</div>
        }
        <button type="button" class="btn btn-link fw-semibold d-block mx-auto" [disabled]="!link()" (click)="copyLink()">
          <it-icon name="copy" size="xs" color="primary" /> Copia link di collegamento
        </button>
      </div>
      <div class="col-12 col-md app-minw">
        <ol class="app-steps-list">
          <li>Sullo smartphone apri la fotocamera e inquadra il QR.</li>
          <li>Accedi con le credenziali CNR.</li>
          <li>Il telefono compare qui sotto: è pronto per il check-in.</li>
        </ol>
        <div class="app-devices" aria-live="polite">
          <div class="app-devices-head"><strong>Dispositivi collegati · {{ connected().length }}</strong><span class="small text-secondary">si aggiorna da solo</span></div>
          @for (device of connected(); track device.id) {
            <div class="app-device">
              <span class="app-dot" [class.app-dot--ok]="device.status === 'online'" [style.background]="device.status === 'online' ? null : '#9da6af'" aria-hidden="true"></span>
              <strong>{{ deviceName(device) }}</strong>
              <span class="text-secondary">collegato alle {{ device.timestamp | date:'HH:mm' }} · {{ device.status === 'online' ? 'attivo ora' : 'non attivo' }}</span>
              <button type="button" class="btn btn-link text-danger p-0 ms-auto fw-semibold" (click)="disconnect(device)">Scollega<span class="visually-hidden"> {{ deviceName(device) }}</span></button>
            </div>
          } @empty {
            <p class="app-device text-secondary mb-0">Nessun dispositivo collegato.</p>
          }
        </div>
        @if (message()) { <p class="small mt-2 mb-0" role="status">{{ message() }}</p> }
        @if (registrationToken()) {
          <details class="mt-3 small">
            <summary>Collegamento manuale e dati per i test</summary>
            <p class="text-secondary mt-2 mb-2">Valido fino alle {{ tokenExpiresAt() | date:'HH:mm' }}; si rinnova da solo finché la pagina resta aperta. Dopo il collegamento il telefono riceve un token suo per lo scanner.</p>
            <dl class="app-link-data mb-2">
              <dt>ID sessione</dt><dd><code class="user-select-all">{{ sessionId() }}</code></dd>
              <dt>Token di registrazione</dt><dd><code class="user-select-all">{{ registrationToken() }}</code></dd>
              <dt>Link</dt><dd><code class="user-select-all">{{ link() }}</code></dd>
            </dl>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-outline-primary btn-sm" type="button" (click)="copyTestData()">Copia tutti i dati</button>
              <button class="btn btn-outline-secondary btn-sm" type="button" (click)="copyToken()">Copia solo il token</button>
              <button class="btn btn-link btn-sm" type="button" (click)="refreshRegistrationToken()">Genera un nuovo QR</button>
            </div>
          </details>
        }
      </div>
    </div>
  `,
  styles: `
    .app-link-data { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
    .app-link-data dt { font-weight: 600; }
    .app-link-data dd { margin: 0; min-width: 0; }
    .app-link-data code { display: block; padding: 4px 6px; border-radius: 4px; background: #f2f4f6; color: var(--app-ink); overflow-wrap: anywhere; }
  `,
})
export class DevicesPanelComponent {
  readonly sessionId = input.required<string>();
  readonly mode = input('segretario');
  private readonly api = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly devices = signal<DeviceSummary[]>([]);
  readonly qrDataUrl = signal('');
  readonly link = signal('');
  readonly registrationToken = signal('');
  readonly tokenExpiresAt = signal<Date | null>(null);
  readonly message = signal('');
  readonly connected = computed(() => this.devices().filter((device) => device.status !== 'disconnected'));
  readonly onlineCount = () => this.devices().filter((device) => device.status === 'online').length;

  ngOnInit(): void {
    const query = `?mode=${encodeURIComponent(this.mode())}`;
    // Il token di registrazione vale 30 minuti: si rinnova prima, così il QR resta valido per tutta la sessione.
    interval(TOKEN_REFRESH_MS).pipe(startWith(0), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refreshRegistrationToken());
    interval(2000).pipe(startWith(0), switchMap(() => this.api.get<ApiList<DeviceSummary>>(`/sessioni/${this.sessionId()}/devices${query}`)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ items }) => this.devices.set(items ?? []),
      error: () => this.message.set('Impossibile aggiornare l’elenco dei dispositivi.'),
    });
  }

  refreshRegistrationToken(): void {
    this.api.post<{ registration_token: string }>(`/sessioni/${this.sessionId()}/devices/registration-token?mode=${encodeURIComponent(this.mode())}`).subscribe({
      next: ({ registration_token }) => {
        this.registrationToken.set(registration_token);
        this.tokenExpiresAt.set(new Date(Date.now() + TOKEN_VALIDITY_MS));
        const params = new URLSearchParams({ sessionId: this.sessionId(), token: registration_token });
        const url = `${window.location.origin}/scanner?${params}`;
        this.link.set(url);
        QRCode.toDataURL(url, { width: 200, margin: 1 }).then((data) => this.qrDataUrl.set(data));
      }, error: () => {
        this.registrationToken.set('');
        this.tokenExpiresAt.set(null);
        this.link.set('');
        this.qrDataUrl.set('');
        this.message.set('Creazione del QR di collegamento non riuscita. Ricarica la pagina per riprovare.');
      },
    });
  }

  copyLink(): Promise<void> {
    return this.copy(this.link(), 'Link copiato: aprilo sullo smartphone da collegare.');
  }

  copyToken(): Promise<void> {
    return this.copy(this.registrationToken(), 'Token di registrazione copiato.');
  }

  copyTestData(): Promise<void> {
    const expires = this.tokenExpiresAt()?.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) ?? '';
    const text = [`session_id: ${this.sessionId()}`, `registration_token: ${this.registrationToken()}`, `link: ${this.link()}`, `valido fino alle: ${expires}`].join('\n');
    return this.copy(text, 'Dati di collegamento copiati.');
  }

  /** Appunti del browser, con ripiego per i contesti in cui l'API non è disponibile (pagina non sicura, iframe). */
  private async copy(text: string, done: string): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      if (!copied) { this.message.set('Copia non riuscita: seleziona il testo e copialo a mano.'); return; }
    }
    this.message.set(done);
  }

  disconnect(device: DeviceSummary): void {
    this.api.post(`/sessioni/${this.sessionId()}/devices/${device.id}/disconnect?mode=${encodeURIComponent(this.mode())}`).subscribe({
      next: () => { this.devices.update((items) => items.map((item) => item.id === device.id ? { ...item, status: 'disconnected' } : item)); this.message.set('Dispositivo scollegato.'); },
      error: () => this.message.set('Disconnessione del dispositivo non riuscita.'),
    });
  }

  /** "iPhone · Safari" al posto dello user agent completo. */
  deviceName(device: DeviceSummary): string {
    if (device.nome_dispositivo) return device.nome_dispositivo;
    const agent = device.user_agent ?? '';
    const model = /iPhone/.test(agent) ? 'iPhone' : /iPad/.test(agent) ? 'iPad' : /Android/.test(agent) ? 'Android'
      : /Windows/.test(agent) ? 'Windows' : /Mac OS X/.test(agent) ? 'Mac' : 'Smartphone';
    const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\/|FxiOS/.test(agent) ? 'Firefox' : /Chrome\/|CriOS/.test(agent) ? 'Chrome'
      : /Safari\//.test(agent) ? 'Safari' : '';
    return browser ? `${model} · ${browser}` : model;
  }
}
