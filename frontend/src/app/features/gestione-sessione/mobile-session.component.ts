import { Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionSummary } from '../../core/models/api.models';
import { sessionStateLabel } from '../../shared/session-states';

@Component({
  selector: 'app-mobile-session',
  imports: [RouterLink],
  template: `
    <main class="mobile-session" aria-label="Gestione sessione da smartphone">
      <header class="mobile-head">
        <a class="back-link" routerLink="/bandi" [queryParams]="{ mode: mode() }" aria-label="Torna ai concorsi">‹</a>
        <div class="mobile-title"><span>{{ session()?.bando_title || 'Concorso' }}</span><h1>{{ session()?.name || 'Sessione' }}</h1></div>
        <span class="message-count" aria-label="Messaggi non letti">{{ unreadCount() }}</span>
      </header>
      <div class="mobile-summary">
        <span class="state-badge">{{ stateLabel() }}</span>
        <p class="mb-2 mt-2">{{ session()?.date }} · {{ session()?.time }} · {{ session()?.location }}</p>
        <strong>{{ session()?.checked_in_count ?? 0 }} / {{ session()?.candidate_count ?? 0 }} presenti</strong>
      </div>

      <section class="mobile-tab-panel" [hidden]="activeTab() !== 'sessione'" aria-label="Sessione">
        <a class="btn btn-success btn-lg w-100 mb-3" [routerLink]="['/scanner']" [queryParams]="{ sessionId: session()?.session_id, mode: mode() }">Apri scanner</a>
        <p class="missing-count">Mancano {{ missingCount() }} candidati</p>
        <ng-content select="[session-actions]" />
      </section>
      <section class="mobile-tab-panel" [hidden]="activeTab() !== 'candidati'" aria-label="Candidati">
        <ng-content select="[session-candidates]" />
      </section>
      <section class="mobile-tab-panel" [hidden]="activeTab() !== 'messaggi'" aria-label="Messaggi">
        <ng-content select="[session-messages]" />
      </section>

      <nav class="mobile-tabs" aria-label="Sezioni sessione">
        <button type="button" [class.active]="activeTab() === 'sessione'" (click)="activeTab.set('sessione')">Sessione</button>
        <button type="button" [class.active]="activeTab() === 'candidati'" (click)="activeTab.set('candidati')">Candidati</button>
        <button type="button" [class.active]="activeTab() === 'messaggi'" (click)="activeTab.set('messaggi')">Messaggi <span class="visually-hidden">, {{ unreadCount() }} non letti</span></button>
      </nav>
    </main>
  `,
  styles: `
    :host { display:block; }
    .mobile-session { min-height:calc(100vh - 1rem); padding:0 0 5rem; color:#17324d; }
    .mobile-head { display:flex; align-items:center; gap:.75rem; padding:.75rem 0 1rem; }
    .back-link { text-decoration:none; font-size:2rem; line-height:1; width:2.75rem; min-height:2.75rem; display:grid; place-items:center; }
    .mobile-title { flex:1; min-width:0; }
    .mobile-title span { color:#5c6f82; font-size:.8rem; }
    .mobile-title h1 { font-size:1.15rem; margin:0; overflow-wrap:anywhere; }
    .message-count { min-width:2.75rem; min-height:2.75rem; display:grid; place-items:center; border-radius:50%; background:#e8f1f8; }
    .mobile-summary { background:white; border:1px solid #d5dce3; border-radius:.75rem; padding:1rem; margin-bottom:1rem; }
    .state-badge { display:inline-block; border-radius:999px; background:#e8f1f8; padding:.25rem .75rem; font-weight:600; }
    .missing-count { color:#435a70; }
    .mobile-tab-panel[hidden] { display:none; }
    .mobile-tabs { position:fixed; z-index:20; inset:auto 0 0; display:grid; grid-template-columns:repeat(3,1fr); gap:.25rem; padding:.5rem max(.5rem,env(safe-area-inset-right)) calc(.5rem + env(safe-area-inset-bottom)) max(.5rem,env(safe-area-inset-left)); background:white; border-top:1px solid #c8d2dc; box-shadow:0 -3px 14px #17324d16; }
    .mobile-tabs button { border:0; border-radius:.5rem; background:transparent; color:#17324d; min-height:44px; font-weight:600; }
    .mobile-tabs button.active { background:#e8f1f8; color:#005a9c; }
  `,
})
export class MobileSessionComponent {
  readonly session = input<SessionSummary | null>(null);
  readonly currentState = input('');
  readonly mode = input('segretario');
  readonly unreadCount = input(0);
  readonly activeTab = signal<'sessione' | 'candidati' | 'messaggi'>('sessione');
  readonly missingCount = () => Math.max(0, (this.session()?.candidate_count ?? 0) - (this.session()?.checked_in_count ?? 0));
  readonly stateLabel = () => sessionStateLabel(this.currentState());
}
