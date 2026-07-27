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
      <div class="d-flex justify-content-between align-items-center gap-2 mb-2">
        <h6 class="mb-0">Chat interna</h6>
        <button class="btn btn-sm btn-outline-secondary" type="button" [disabled]="busy()" (click)="load()">
          @if (busy()) {
            <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          } @else {
            <span class="me-1">↻</span>
          }
          <span>Aggiorna</span>
        </button>
      </div>
      <div class="chat-messages">
        @if (items().length === 0) {
          <div class="text-muted">Nessun messaggio.</div>
        } @else {
          <ul class="list-unstyled mb-0">
            @for (item of items(); track item.id) {
              <li class="notification-row" [attr.title]="notificationTitle(item)">
                @if (item.type === 'state') {
                  <span class="badge bg-primary notification-badge">Notifica</span>
                } @else if (item.type === 'reset') {
                  <span class="badge bg-warning text-dark notification-badge">Reset</span>
                } @else {
                  <span class="badge bg-secondary notification-badge">Msg</span>
                }
                <span class="notification-author">{{ item.author_email || '-' }}</span>
                @if (item.created_at) {
                  <time class="notification-time" [attr.datetime]="item.created_at">
                    {{ item.created_at | date:'dd/MM/yyyy HH:mm' }}
                  </time>
                }
                <span class="notification-payload">{{ item.payload }}</span>
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
  styles: `
    .chat-card {
      min-width: 0;
    }

    .chat-messages {
      max-height: 18rem;
      overflow: auto;
    }

    .notification-row {
      display: grid;
      grid-template-columns: max-content max-content max-content minmax(8rem, 1fr);
      align-items: center;
      gap: 0.45rem;
      min-width: max-content;
      padding: 0.45rem 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      white-space: nowrap;
    }

    .notification-row:last-child {
      border-bottom: 0;
    }

    .notification-badge {
      font-size: 0.72rem;
    }

    .notification-author,
    .notification-time,
    .notification-payload {
      color: #5b6f82;
      font-size: 0.78rem;
      line-height: 1.2;
      white-space: nowrap;
    }

    .notification-author {
      font-weight: 600;
    }

    .notification-payload {
      color: #32485f;
      overflow: hidden;
      text-overflow: ellipsis;
    }
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

  notificationTitle(item: NotificationItem): string {
    const createdAt = item.created_at ?? '';
    const author = item.author_email || '-';
    return [author, createdAt, item.payload].filter(Boolean).join(' - ');
  }

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
