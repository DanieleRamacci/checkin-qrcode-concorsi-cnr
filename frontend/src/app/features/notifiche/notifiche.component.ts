import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, input, output, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY, switchMap, timer } from 'rxjs';
import { ItIconComponent } from 'design-angular-kit';
import { ApiClient } from '../../core/api-client';
import { AuthService } from '../../core/auth.service';
import { ApiList, CandidateSummary } from '../../core/models/api.models';

interface NotificationItem {
  id: number;
  type: string;
  payload: string;
  author_email?: string;
  author_display?: string;
  author_role?: string;
  created_at?: string;
}

@Component({
  selector: 'app-notifiche',
  imports: [FormsModule, DatePipe, ItIconComponent],
  template: `
    <button #fab type="button" class="app-chat-fab" [hidden]="!showFab()" aria-controls="session-chat" [attr.aria-expanded]="drawerOpen()" (click)="openDrawer()">
      <it-icon name="comment" color="white" /><span>Messaggi</span>
      @if (newCount()) { <span class="app-chat-fab-badge">{{ newCount() }}<span class="visually-hidden"> {{ newCount() === 1 ? 'messaggio non letto' : 'messaggi non letti' }}</span></span> }
    </button>
    <aside id="session-chat" class="app-chat-drawer" [class.is-open]="drawerOpen()" aria-labelledby="chat-t" [attr.aria-hidden]="drawerOpen() ? null : 'true'">
      <div class="app-chat-head">
        <div class="app-minw"><h2 id="chat-t" class="h5 mb-0">Messaggi della sessione</h2>@if (sessionName()) { <p class="small mb-0">{{ sessionName() }}</p> }</div>
        <button #closeButton type="button" class="app-chat-close" aria-label="Chiudi i messaggi" [attr.tabindex]="drawerOpen() ? null : -1" (click)="closeDrawer()"><it-icon name="close" color="white" /></button>
      </div>
      <div class="app-chat-people" aria-label="Partecipanti">
        <span>Segretario</span><span>Esperto remoto</span><span>Informatico in sede</span>
      </div>
      <ul class="app-chat-list" aria-live="polite" aria-relevant="additions text">
        @for (item of messages(); track item.id) {
          <li class="app-msg" [class.app-msg--me]="isMine(item)">
            <p class="app-msg-meta">
              <span class="app-role-tag" [class.app-role-tag--seg]="roleClass(item) === 'seg'" [class.app-role-tag--esp]="roleClass(item) === 'esp'" [class.app-role-tag--sede]="roleClass(item) === 'sede'">{{ isMine(item) ? 'Tu' : roleLabel(item.author_role) }}</span>
              <time [attr.datetime]="item.created_at">{{ item.created_at | date:'HH:mm' }}</time>
            </p>
            <p class="app-msg-text">{{ readablePayload(item) }}</p>
          </li>
        } @empty {
          <li class="text-secondary text-center py-4">Nessun messaggio. Scrivi al gruppo della sessione.</li>
        }
      </ul>
      <div class="app-chat-compose">
        @if (error()) { <div class="alert alert-danger py-2 mb-0" role="alert">{{ error() }}</div> }
        <div class="app-quick" role="group" aria-label="Messaggi rapidi">
          @for (reply of quickReplies; track reply) {
            <button type="button" class="btn btn-outline-primary btn-xs" [disabled]="busy()" [attr.tabindex]="drawerOpen() ? null : -1" (click)="sendText(reply)">{{ reply }}</button>
          }
        </div>
        <form class="d-flex gap-2 align-items-end" (ngSubmit)="send()">
          <div class="form-group mb-0 flex-grow-1">
            <label for="chat-msg" class="active">Scrivi a tutti</label>
            <input type="text" class="form-control" id="chat-msg" name="message" autocomplete="off" [(ngModel)]="message" [attr.tabindex]="drawerOpen() ? null : -1" />
          </div>
          <button class="btn btn-primary" type="submit" [disabled]="busy() || !message.trim()" [attr.tabindex]="drawerOpen() ? null : -1">Invia</button>
        </form>
      </div>
    </aside>
  `,
})
export class NotificheComponent {
  readonly sessionId = input.required<string>();
  readonly mode = input<'segretario' | 'sede' | 'esperto' | 'admin'>('segretario');
  readonly sessionName = input('');
  /** Su smartphone la chat si apre dalla scheda Messaggi: niente pulsante fisso sopra la barra in basso. */
  readonly showFab = input(true);
  readonly unreadChange = output<number>();
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly items = signal<NotificationItem[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly newCount = signal(0);
  readonly drawerOpen = signal(false);
  readonly messages = computed(() => this.items().filter((item) => item.type !== 'state'));
  readonly candidateNames = signal<Record<string, string>>({});
  readonly quickReplies = ['Ok, ricevuto', 'Serve aiuto in aula', 'Un attimo'];
  message = '';
  private initialized = false;
  private latestSeenId = 0;
  @ViewChild('fab') private fab?: ElementRef<HTMLButtonElement>;
  @ViewChild('closeButton') private closeButton?: ElementRef<HTMLButtonElement>;

  constructor() {
    effect(() => this.unreadChange.emit(this.newCount()));
  }

  ngOnInit(): void {
    this.loadCandidateNames();
    timer(0, 10_000).pipe(switchMap(() => this.fetch()), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ items }) => this.applyItems(items));
  }

  load(): void { this.fetch().subscribe(({ items }) => this.applyItems(items)); }
  openDrawer(): void {
    this.drawerOpen.set(true);
    this.markSeen();
    // Il pannello è già nel DOM (si apre con .is-open): il focus va subito sul pulsante di chiusura.
    queueMicrotask(() => this.closeButton?.nativeElement.focus());
  }
  closeDrawer(): void {
    this.drawerOpen.set(false);
    if (this.showFab()) queueMicrotask(() => this.fab?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.drawerOpen()) this.closeDrawer(); }

  send(): void { this.sendText(this.message); }
  sendText(text: string): void {
    const payload = text.trim();
    if (!payload) return;
    this.busy.set(true);
    this.error.set('');
    this.api.post(`/sessioni/${this.sessionId()}/notifications`, { type: 'message', payload }).subscribe({
      next: () => { this.message = ''; this.busy.set(false); this.load(); },
      error: () => { this.busy.set(false); this.error.set('Invio del messaggio non riuscito.'); },
    });
  }

  isMine(item: NotificationItem): boolean { return item.author_email === this.auth.user()?.email; }
  roleClass(item: NotificationItem): string {
    const role = (item.author_role ?? '').toLocaleLowerCase();
    if (role.includes('segret')) return 'seg';
    if (role.includes('sede')) return 'sede';
    if (role.includes('remoto') || role.includes('esperto')) return 'esp';
    return '';
  }
  roleLabel(role?: string): string {
    const labels: Record<string, string> = { 'inf. sede': 'Informatico in sede', 'inf. remoto': 'Esperto remoto', admin: 'Amministratore', segretario: 'Segretario', sistema: 'Sistema' };
    return labels[(role ?? '').toLocaleLowerCase()] ?? role ?? 'Utente';
  }
  displayName(email: string | undefined): string {
    if (!email) return 'Utente';
    return email.split('@')[0].replace(/[._]+/g, ' ');
  }
  readablePayload(item: NotificationItem): string {
    const uid = item.payload.match(/\(([^()]*)\)\s*$/)?.[1];
    const name = uid ? this.candidateNames()[uid] : undefined;
    if (item.type === 'candidate_note') return name ? `Nota di ${name} aggiornata` : 'Nota di un candidato aggiornata';
    if (item.type === 'reset') {
      if (item.payload.includes('cancel_request')) return name ? `Annullata la richiesta di reset per ${name}` : 'Annullata una richiesta di reset password';
      if (item.payload.includes('undo_complete')) return name ? `Annullata la registrazione del reset per ${name}` : 'Annullata la registrazione di un reset';
      if (item.payload.includes('request')) return name ? `Richiesto un reset password per ${name}` : 'Richiesto un reset password';
      return name ? `Registrato un reset password per ${name}` : 'Registrato un reset password';
    }
    return item.payload;
  }

  private loadCandidateNames(): void {
    this.api.get<ApiList<Pick<CandidateSummary, 'uid' | 'first_name' | 'last_name'>>>(
      `/sessioni/${this.sessionId()}/candidati?mode=${encodeURIComponent(this.mode())}`,
    ).subscribe({
      next: ({ items }) => this.candidateNames.set(Object.fromEntries(items.map((candidate) => [candidate.uid, `${candidate.last_name} ${candidate.first_name}`.trim()]))),
      error: () => this.candidateNames.set({}),
    });
  }

  private fetch() {
    this.busy.set(true);
    this.error.set('');
    return this.api.get<ApiList<NotificationItem>>(`/sessioni/${this.sessionId()}/notifications`).pipe(
      catchError(() => { this.busy.set(false); this.error.set('Aggiornamento dei messaggi non riuscito.'); return EMPTY; }),
      switchMap((response) => { this.busy.set(false); return [response]; }),
    );
  }
  private markSeen(): void {
    this.latestSeenId = Math.max(0, ...this.messages().map((item) => item.id));
    this.newCount.set(0);
  }
  private applyItems(items: NotificationItem[]): void {
    const messages = items.filter((item) => item.type !== 'state');
    this.items.set(items);
    if (!this.initialized) {
      this.latestSeenId = Math.max(0, ...messages.map((item) => item.id));
      this.initialized = true;
    }
    this.newCount.set(messages.filter((item) => item.id > this.latestSeenId).length);
    if (this.drawerOpen()) this.markSeen();
  }
}
