import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, ElementRef, HostListener, inject, input, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY, switchMap, timer } from 'rxjs';
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
  imports: [FormsModule, DatePipe],
  template: `
    <button #fab class="app-chat-fab" type="button" [attr.aria-expanded]="drawerOpen()" aria-controls="session-chat-drawer" (click)="openDrawer()">
      <span aria-hidden="true">✉</span><span>Messaggi</span>
      @if (newCount()) { <span class="app-chat-fab-badge" aria-label="messaggi non letti">{{ newCount() }}</span> }
    </button>
    @if (drawerOpen()) {
      <div class="app-chat-backdrop" (click)="closeDrawer()"></div>
      <aside id="session-chat-drawer" class="app-chat-drawer" role="dialog" aria-modal="true" aria-labelledby="chat-title">
        <header class="app-chat-head">
          <div><h2 id="chat-title" class="h5 mb-1">Messaggi della sessione</h2><p class="small text-muted mb-0">Segretario · Informatico in sede · Esperto remoto</p></div>
          <button #closeButton class="btn-close" type="button" aria-label="Chiudi messaggi" (click)="closeDrawer()"></button>
        </header>
        <div class="app-chat-messages" aria-live="polite" aria-relevant="additions text">
          @if (messages().length === 0) { <p class="text-muted text-center py-4">Nessun messaggio. Scrivi al gruppo della sessione.</p> }
          @for (item of messages(); track item.id) {
            <article class="app-msg" [class.app-msg--me]="isMine(item)" [class.app-msg--seg]="roleClass(item) === 'seg'" [class.app-msg--esp]="roleClass(item) === 'esp'" [class.app-msg--sede]="roleClass(item) === 'sede'">
              <div class="d-flex justify-content-between align-items-center gap-2"><strong>{{ item.author_display || displayName(item.author_email) }}</strong><time class="small text-muted" [attr.datetime]="item.created_at">{{ item.created_at | date:'dd/MM HH:mm' }}</time></div>
              <span class="app-role-tag" [class.app-role-tag--seg]="roleClass(item) === 'seg'" [class.app-role-tag--esp]="roleClass(item) === 'esp'" [class.app-role-tag--sede]="roleClass(item) === 'sede'">{{ roleLabel(item.author_role) }}</span>
              <p class="mb-0 mt-1">{{ readablePayload(item) }}</p>
            </article>
          }
        </div>
        @if (error()) { <div class="alert alert-danger py-2" role="alert">{{ error() }}</div> }
        <div class="app-chat-quick d-flex flex-wrap gap-2" aria-label="Risposte rapide">
          @for (reply of quickReplies; track reply) { <button class="btn btn-sm btn-outline-secondary" type="button" [disabled]="busy()" (click)="sendText(reply)">{{ reply }}</button> }
        </div>
        <form class="app-chat-compose" (ngSubmit)="send()">
          <label class="visually-hidden" for="notification-message">Scrivi a tutti</label>
          <textarea id="notification-message" class="form-control" name="message" rows="2" placeholder="Scrivi a tutti" [(ngModel)]="message" required></textarea>
          <button class="btn btn-primary mt-2" type="submit" [disabled]="busy() || !message.trim()">@if (busy()) { Invio… } @else { Invia messaggio }</button>
        </form>
      </aside>
    }
  `,
  styles: `
    .app-chat-fab { position: fixed; z-index: 30; right: 1.25rem; bottom: 1.25rem; display:flex; align-items:center; gap:.55rem; min-height:48px; padding:.65rem 1rem; border:0; border-radius:999px; color:#fff; background:#005cb9; box-shadow:0 4px 16px #17324d40; font-weight:700; }
    .app-chat-fab-badge { display:grid; place-items:center; min-width:1.4rem; height:1.4rem; padding:0 .3rem; border-radius:99px; color:white; background:#c62828; font-size:.75rem; }
    .app-chat-backdrop { position:fixed; z-index:39; inset:0; background:#102a43aa; }
    .app-chat-drawer { position:fixed; z-index:40; inset:0 0 0 auto; width:min(400px,100vw); display:flex; flex-direction:column; padding:1rem; background:#fff; box-shadow:-8px 0 28px #102a4330; transform:none; visibility:visible; }
    .app-chat-head { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; padding-bottom:.8rem; border-bottom:1px solid #d9dadb; }
    .app-chat-messages { flex:1; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:.75rem; padding:1rem .25rem; }
    .app-msg { max-width:92%; align-self:flex-start; padding:.65rem .75rem; border-radius:.75rem; background:#f1f3f5; overflow-wrap:anywhere; }
    .app-msg--me { align-self:flex-end; background:#e8f1f8; }
    .app-msg--seg { border-left:3px solid #0066cc; } .app-msg--esp { border-left:3px solid #32814b; } .app-msg--sede { border-left:3px solid #b86e00; }
    .app-role-tag { display:inline-block; margin-top:.25rem; padding:.08rem .4rem; border-radius:99px; background:#e2e5e9; font-size:.72rem; font-weight:700; }
    .app-role-tag--seg { color:#004b8d; background:#dceeff; } .app-role-tag--esp { color:#205b33; background:#e0f2e5; } .app-role-tag--sede { color:#754500; background:#fff0d5; }
    .app-chat-quick { padding:.55rem 0; }
    .app-chat-compose { padding-top:.55rem; border-top:1px solid #d9dadb; }
    @media (max-width:767.98px) { .app-chat-drawer { width:100vw; } .app-chat-fab { right:.75rem; bottom:5.5rem; } }
  `,
})
export class NotificheComponent {
  readonly sessionId = input.required<string>();
  readonly mode = input<'segretario' | 'sede' | 'esperto' | 'admin'>('segretario');
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

  ngOnInit(): void {
    this.loadCandidateNames();
    timer(0, 10_000).pipe(switchMap(() => this.fetch()), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ items }) => this.applyItems(items));
  }

  load(): void { this.fetch().subscribe(({ items }) => this.applyItems(items)); }
  openDrawer(): void { this.drawerOpen.set(true); this.markSeen(); }
  closeDrawer(): void {
    this.drawerOpen.set(false);
    queueMicrotask(() => this.fab?.nativeElement.focus());
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
