import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { interval, startWith, switchMap } from 'rxjs';
import * as QRCode from 'qrcode';
import { ItIconComponent } from 'design-angular-kit';
import { ApiClient } from '../../core/api-client';
import { ApiList, DeviceSummary } from '../../core/models/api.models';

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
            <summary>Collegamento senza fotocamera</summary>
            <p class="text-secondary mb-1">Il token di registrazione vale 30 minuti. Dopo l’associazione il dispositivo riceve un token diverso per lo scanner.</p>
            <code class="d-block p-2 bg-light rounded user-select-all mb-2" style="overflow-wrap:anywhere">{{ registrationToken() }}</code>
            <button class="btn btn-outline-secondary btn-sm" type="button" (click)="copyToken()">Copia token di registrazione</button>
          </details>
        }
      </div>
    </div>
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
  readonly message = signal('');
  readonly connected = computed(() => this.devices().filter((device) => device.status !== 'disconnected'));
  readonly onlineCount = () => this.devices().filter((device) => device.status === 'online').length;

  ngOnInit(): void {
    const query = `?mode=${encodeURIComponent(this.mode())}`;
    this.api.post<{ registration_token: string }>(`/sessioni/${this.sessionId()}/devices/registration-token${query}`).subscribe({
      next: ({ registration_token }) => {
        this.registrationToken.set(registration_token);
        const params = new URLSearchParams({ sessionId: this.sessionId(), token: registration_token });
        const url = `${window.location.origin}/scanner?${params}`;
        this.link.set(url);
        QRCode.toDataURL(url, { width: 200, margin: 1 }).then((data) => this.qrDataUrl.set(data));
      }, error: () => {
        this.registrationToken.set('');
        this.link.set('');
        this.message.set('Creazione del QR di collegamento non riuscita. Ricarica la pagina per riprovare.');
      },
    });
    interval(2000).pipe(startWith(0), switchMap(() => this.api.get<ApiList<DeviceSummary>>(`/sessioni/${this.sessionId()}/devices${query}`)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ items }) => this.devices.set(items ?? []),
      error: () => this.message.set('Impossibile aggiornare l’elenco dei dispositivi.'),
    });
  }

  async copyLink(): Promise<void> {
    if (!this.link()) return;
    try { await navigator.clipboard.writeText(this.link()); this.message.set('Link copiato: aprilo sullo smartphone da collegare.'); }
    catch { this.message.set('Copia non riuscita: usa il QR code per collegare il dispositivo.'); }
  }

  async copyToken(): Promise<void> {
    if (!this.registrationToken()) return;
    try { await navigator.clipboard.writeText(this.registrationToken()); this.message.set('Token di registrazione copiato.'); }
    catch { this.message.set('Copia non riuscita: seleziona il token e copialo a mano.'); }
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
