import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconName, ItIconComponent } from 'design-angular-kit';
import { ApiClient } from '../../core/api-client';
import { AuthService } from '../../core/auth.service';
import { AssignedSessionsResponse } from '../../core/models/api.models';
import { AppProfile, availableProfiles, ProfileService } from '../../core/profile.service';
import { sessionSortKey, sessionWhen, sessionDateKey, todayKey } from '../../shared/session-date';
import { BandiService } from '../bandi/bandi.service';
import { isBandoComplete } from '../bandi/bando-completeness';

interface ProfileCard { id: AppProfile; label: string; description: string; icon: IconName; }

const PROFILE_CARDS: ProfileCard[] = [
  { id: 'segretario', label: 'Segretario', description: 'Prepari le sessioni, registri le presenze e invii le liste.', icon: 'pa' },
  { id: 'referente', label: 'Referente', description: 'Configuri i bandi di cui sei RDP o referente.', icon: 'folder' },
  { id: 'sede', label: 'Informatico in sede', description: 'Colleghi i dispositivi in aula e segnali i reset password.', icon: 'tool' },
  { id: 'esperto', label: 'Esperto remoto', description: 'Ricevi le liste, aggiorni Moodle e avanzi le fasi dell’esame.', icon: 'software' },
];

/**
 * P01a Scelta profilo (docs/design-revisione/prototipo/profili.html): una card
 * per profilo operativo dell'utente, amministrazione in una sezione a parte.
 * Con un solo profilo si entra direttamente nella sua home.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, ItIconComponent],
  template: `
    <div class="container py-4 py-lg-5">
      <h1 class="mb-1">Con quale profilo vuoi lavorare?</h1>
      <p class="lead text-secondary mb-4">Vedi solo i profili assegnati al tuo utente. Chi ne ha uno solo entra direttamente nella sua home.</p>
      @if (cards().length) {
        <div class="app-role-grid">
          @for (card of cards(); track card.id) {
            <article class="card card-bg no-after app-role" [class.app-role--last]="card.id === highlighted()">
              <div class="card-body d-flex flex-column gap-2">
                <div class="d-flex align-items-center gap-2">
                  <it-icon [name]="card.icon" color="primary" />
                  <h2 class="h4 mb-0">{{ card.label }}</h2>
                  @if (card.id === lastUsed()) { <span class="badge app-badge-neutral ms-2">Ultimo usato</span> }
                </div>
                <p class="mb-0">{{ card.description }}</p>
                @if (hints()[card.id]; as hint) { <p class="small fw-semibold text-secondary mb-0">{{ hint }}</p> }
                <div class="mt-auto pt-2">
                  <a [class]="card.id === highlighted() ? 'btn btn-primary' : 'btn btn-outline-primary'"
                    [routerLink]="profiles.home(card.id).path" [queryParams]="profiles.home(card.id).queryParams ?? null"
                    (click)="choose(card.id)">Entra come {{ card.label }}</a>
                </div>
              </div>
            </article>
          }
        </div>
      } @else if (!isAdmin()) {
        <div class="alert alert-info" role="status">Non risultano profili assegnati al tuo utente. Contatta il referente del procedimento o l’amministratore.</div>
      }
      @if (isAdmin()) {
        <section class="mt-4" aria-labelledby="admin-title">
          <h2 id="admin-title" class="h6 text-secondary mb-2">Amministrazione <span class="fw-normal">· visibile solo agli amministratori</span></h2>
          <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-outline-secondary btn-sm" routerLink="/bandi" [queryParams]="{ mode: 'admin' }" (click)="choose('admin')">Tutti i bandi</a>
            <a class="btn btn-outline-secondary btn-sm" routerLink="/admin/permessi" (click)="choose('admin')">Permessi</a>
            <a class="btn btn-outline-secondary btn-sm" routerLink="/admin/impostazioni" (click)="choose('admin')">Impostazioni</a>
            <a class="btn btn-outline-secondary btn-sm" routerLink="/admin/logs" (click)="choose('admin')">Log di sistema</a>
          </div>
        </section>
      }
    </div>
  `,
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  readonly profiles = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiClient);
  private readonly bandi = inject(BandiService);
  /** Riga di stato sotto ogni card (prototipo profili.html): cosa aspetta l'utente in quel profilo. */
  readonly hints = signal<Partial<Record<AppProfile, string>>>({});
  private hintsLoaded = false;
  private readonly available = computed(() => availableProfiles(this.auth.user()));
  readonly cards = computed(() => PROFILE_CARDS.filter((card) => this.available().includes(card.id)));
  readonly isAdmin = computed(() => this.available().includes('admin'));
  readonly lastUsed = computed(() => {
    const last = this.profiles.lastUsed(this.auth.user()?.email);
    return last && this.available().includes(last) ? last : null;
  });
  /** Card in evidenza: l'ultimo profilo usato da questo account, altrimenti il primo. */
  readonly highlighted = computed(() => this.lastUsed() ?? this.cards()[0]?.id ?? null);

  constructor() {
    effect(() => {
      const available = this.available();
      if (available.length > 1 && !this.hintsLoaded) { this.hintsLoaded = true; this.loadHints(available); }
      if (available.length !== 1) return;
      const only = available[0];
      this.profiles.select(only);
      const home = this.profiles.home(only);
      void this.router.navigate([home.path], { queryParams: home.queryParams, replaceUrl: true });
    });
  }

  choose(profile: AppProfile): void {
    this.profiles.remember(this.auth.user()?.email, profile);
  }

  private setHint(profile: AppProfile, hint: string): void {
    if (hint) this.hints.update((hints) => ({ ...hints, [profile]: hint }));
  }

  /** Dati già esposti dalle API delle singole home; un errore lascia la card senza riga di stato. */
  private loadHints(available: AppProfile[]): void {
    if (available.includes('segretario')) {
      this.bandi.list('segretario').subscribe({ next: ({ items }) => {
        const next = (items ?? []).flatMap((bando) => bando.next_session ? [bando.next_session] : [])
          .sort((a, b) => sessionSortKey(a.date, a.time).localeCompare(sessionSortKey(b.date, b.time)))[0];
        if (next) this.setHint('segretario', sessionHint(next.name, next.date, next.time));
      }, error: () => undefined });
    }
    if (available.includes('referente')) {
      this.bandi.listReferente().subscribe({ next: ({ items }) => {
        const todo = (items ?? []).filter((bando) => !isBandoComplete(bando)).length;
        this.setHint('referente', todo ? `${todo} ${todo === 1 ? 'bando da completare' : 'bandi da completare'}` : 'Tutti i bandi sono completi');
      }, error: () => undefined });
    }
    for (const profile of ['sede', 'esperto'] as const) {
      if (!available.includes(profile)) continue;
      this.api.get<AssignedSessionsResponse>(`/sessioni/assegnate?mode=${profile === 'sede' ? 'sede' : 'expert'}`).subscribe({ next: ({ items }) => {
        const resets = (items ?? []).reduce((total, session) => total + (session.open_reset_count ?? 0), 0);
        if (profile === 'esperto' && resets) { this.setHint(profile, `${resets} ${resets === 1 ? 'richiesta di reset da fare' : 'richieste di reset da fare'}`); return; }
        const next = (items ?? []).filter((session) => sessionDateKey(session.date) >= todayKey())
          .sort((a, b) => sessionSortKey(a.date, a.time).localeCompare(sessionSortKey(b.date, b.time)))[0];
        if (next) this.setHint(profile, sessionHint(next.name, next.date, next.time));
      }, error: () => undefined });
    }
  }
}

function sessionHint(name: string, date: string, time: string): string {
  const when = sessionWhen(date, time);
  return when.startsWith('Oggi') ? `Oggi: ${name} ${when.slice(5)}` : `Prossima: ${name} · ${when}`;
}
