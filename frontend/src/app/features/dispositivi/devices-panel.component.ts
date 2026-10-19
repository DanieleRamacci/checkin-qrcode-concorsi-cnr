import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { interval, startWith, switchMap } from 'rxjs';
import * as QRCode from 'qrcode';
import { ApiClient } from '../../core/api-client';
import { ApiList, DeviceSummary } from '../../core/models/api.models';

@Component({
  selector: 'app-devices-panel',
  imports: [DatePipe],
  template: `
    <section class="it-card shadow-sm p-3" aria-labelledby="devices-panel-title">
      <h3 id="devices-panel-title" class="h5">Dispositivi · {{ onlineCount() }} collegati</h3>
      <div class="row align-items-center g-3">
        <div class="col-12 col-sm-auto text-center">@if (qrDataUrl()) { <img [src]="qrDataUrl()" width="150" height="150" alt="QR per collegare uno smartphone alla sessione" /> }</div>
        <div class="col">
          <div class="d-flex flex-wrap gap-2 mb-2">
            <button class="btn btn-outline-primary btn-sm" type="button" [disabled]="!link()" (click)="copyLink()">Copia link di collegamento</button>
            <button class="btn btn-outline-secondary btn-sm" type="button" [disabled]="!registrationToken()" (click)="copyToken()">Copia token di registrazione</button>
          </div>
          <ol class="mb-0"><li>Apri la fotocamera del telefono.</li><li>Inquadra il QR code.</li><li>Segui il collegamento per associare il dispositivo.</li></ol>
          @if (registrationToken()) {
            <details class="mt-2">
              <summary>Mostra token per i test</summary>
              <p class="small text-muted mb-1">Il token di registrazione vale 30 minuti. Dopo l’associazione, il dispositivo riceve un token diverso per lo scanner.</p>
              <code class="d-block p-2 bg-light rounded user-select-all" style="overflow-wrap:anywhere">{{ registrationToken() }}</code>
            </details>
          }
          @if (message()) { <p class="small mt-2 mb-0" role="status">{{ message() }}</p> }
        </div>
      </div>
      <div class="table-responsive mt-3"><table class="table table-sm">
        <caption class="visually-hidden">Dispositivi collegati alla sessione</caption>
        <thead><tr><th>Dispositivo</th><th>Stato</th><th>Ultimo collegamento</th><th><span class="visually-hidden">Azioni</span></th></tr></thead>
        <tbody>@for (device of devices(); track device.id) { <tr>
          <td>{{ device.nome_dispositivo || device.user_agent || 'Smartphone' }}</td><td>{{ statusLabel(device.status) }}</td>
          <td>{{ (device.last_seen || device.timestamp) | date:'dd/MM/yyyy HH:mm' }}</td>
          <td><button class="btn btn-sm btn-outline-danger" type="button" [disabled]="device.status === 'disconnected'" (click)="disconnect(device)">Scollega</button></td>
        </tr> } @empty { <tr><td colspan="4" class="text-muted">Nessun dispositivo collegato.</td></tr> }</tbody>
      </table></div>
    </section>
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
  readonly onlineCount = () => this.devices().filter((device) => device.status === 'online').length;

  ngOnInit(): void {
    const query = `?mode=${encodeURIComponent(this.mode())}`;
    this.api.post<{ registration_token: string }>(`/sessioni/${this.sessionId()}/devices/registration-token${query}`).subscribe({
      next: ({ registration_token }) => {
        this.registrationToken.set(registration_token);
        const params = new URLSearchParams({ sessionId: this.sessionId(), token: registration_token });
        const url = `${window.location.origin}/scanner?${params}`;
        this.link.set(url);
        QRCode.toDataURL(url, { width: 150 }).then((data) => this.qrDataUrl.set(data));
      }, error: () => {
        this.registrationToken.set('');
        this.link.set('');
        this.message.set('Creazione del QR di collegamento non riuscita.');
      },
    });
    interval(2000).pipe(startWith(0), switchMap(() => this.api.get<ApiList<DeviceSummary>>(`/sessioni/${this.sessionId()}/devices${query}`)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ items }) => this.devices.set(items ?? []),
      error: () => this.message.set('Impossibile aggiornare l’elenco dei dispositivi.'),
    });
  }

  async copyLink(): Promise<void> {
    if (!this.link()) return;
    try { await navigator.clipboard.writeText(this.link()); this.message.set('Link copiato.'); }
    catch { this.message.set('Copia non riuscita: usa il QR code per collegare il dispositivo.'); }
  }

  async copyToken(): Promise<void> {
    if (!this.registrationToken()) return;
    try { await navigator.clipboard.writeText(this.registrationToken()); this.message.set('Token di registrazione copiato.'); }
    catch { this.message.set('Copia non riuscita: apri “Mostra token per i test” e selezionalo manualmente.'); }
  }

  disconnect(device: DeviceSummary): void {
    this.api.post(`/sessioni/${this.sessionId()}/devices/${device.id}/disconnect?mode=${encodeURIComponent(this.mode())}`).subscribe({
      next: () => { this.devices.update((items) => items.map((item) => item.id === device.id ? { ...item, status: 'disconnected' } : item)); this.message.set('Dispositivo scollegato.'); },
      error: () => this.message.set('Disconnessione del dispositivo non riuscita.'),
    });
  }

  statusLabel(status: DeviceSummary['status']): string { return ({ online: 'Collegato', offline: 'Non attivo', disconnected: 'Scollegato' })[status]; }
}
