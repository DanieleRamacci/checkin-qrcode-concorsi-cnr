import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY, switchMap, timer } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { ApiList } from '../../core/models/api.models';

interface NotificationItem { id: number; type: string; payload: string; author_email?: string; created_at?: string; }

@Component({
  selector: 'app-notifiche',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="it-card shadow-sm p-3 bg-white mb-3 chat-card">
      <h6 class="mb-2">Chat interna</h6>
      <div class="d-flex justify-content-end mb-2">
        <button class="btn btn-sm btn-outline-secondary" type="button" [disabled]="busy()" (click)="load()">
          <span class="me-1">↻</span> Aggiorna
        </button>
      </div>
      <div class="chat-messages">
        @if (items().length === 0) {
          <div class="text-muted">Nessun messaggio.</div>
        } @else {
          <ul class="list-unstyled mb-0">
            @for (item of items(); track item.id) {
              <li class="mb-2">
                <div class="d-flex align-items-center gap-2 mb-1">
                  @if (item.type === 'state') {
                    <span class="badge bg-primary small">Notifica</span>
                  } @else if (item.type === 'reset') {
                    <span class="badge bg-warning text-dark small">Reset</span>
                  } @else {
                    <span class="badge bg-secondary small">Msg</span>
                  }
                  <span class="small text-muted">{{ item.author_email }}</span>
                  @if (item.created_at) {
                    <time class="small text-muted ms-auto" [attr.datetime]="item.created_at">
                      {{ item.created_at | date:'dd/MM/yyyy HH:mm' }}
                    </time>
                  }
                </div>
                <div class="small">{{ item.payload }}</div>
              </li>
            }
          </ul>
        }
      </div>
      @if (error()) {
        <div class="alert alert-danger py-2 mt-2 mb-0" role="alert">{{ error() }}</div>
      }
      <form class="chat-input mt-3" (ngSubmit)="send()">
        <div class="input-group">
          <label class="visually-hidden" for="notification-message">Nuovo messaggio</label>
          <input id="notification-message" class="form-control form-control-sm" name="message" placeholder="Scrivi un messaggio" autocomplete="off" [(ngModel)]="message" required />
          <button class="btn btn-sm btn-primary" type="submit" [disabled]="busy()">Invia</button>
        </div>
      </form>
    </div>
  `,
})
export class NotificheComponent {
  readonly sessionId = input.required<string>();
  private readonly api = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly items = signal<NotificationItem[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  message = '';

  ngOnInit(): void {
    timer(0, 10_000).pipe(
      switchMap(() => this.fetch()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ items }) => this.items.set(items));
  }

  load(): void {
    this.fetch().subscribe(({ items }) => this.items.set(items));
  }

  send(): void {
    const payload = this.message.trim();
    if (!payload) return;
    this.busy.set(true);
    this.error.set('');
    this.api.post(`/sessioni/${this.sessionId()}/notifications`, { type: 'message', payload }).subscribe({
      next: () => {
        this.message = '';
        this.busy.set(false);
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Invio del messaggio non riuscito.');
      },
    });
  }

  private fetch() {
    this.busy.set(true);
    this.error.set('');
    return this.api.get<ApiList<NotificationItem>>(`/sessioni/${this.sessionId()}/notifications`).pipe(
      catchError(() => {
        this.busy.set(false);
        this.error.set('Aggiornamento delle notifiche non riuscito.');
        return EMPTY;
      }),
      switchMap((response) => {
        this.busy.set(false);
        return [response];
      }),
    );
  }
}
