import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AppProfile, availableProfiles, ProfileService } from '../../core/profile.service';

interface ProfileCard { id: AppProfile; label: string; description: string; }

const PROFILE_CARDS: ProfileCard[] = [
  { id: 'segretario', label: 'Segretario', description: 'Gestisci i tuoi concorsi e le sessioni fino all’invio delle liste.' },
  { id: 'referente', label: 'Referente', description: 'Completa la configurazione dei bandi che ti sono assegnati.' },
  { id: 'sede', label: 'Informatico in sede', description: 'Segui le sessioni assegnate e gestisci le richieste di reset.' },
  { id: 'esperto', label: 'Esperto remoto', description: 'Prepara l’ambiente d’esame e gestisci i reset assegnati.' },
  { id: 'admin', label: 'Amministrazione', description: 'Gestisci utenti, impostazioni e log di sistema.' },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="container my-5" aria-labelledby="page-title">
      <h1 id="page-title" class="mb-2">Scegli il tuo profilo</h1>
      <p class="text-muted mb-4">Scegli un profilo, poi la pagina che vuoi aprire.</p>
      <div class="nav nav-tabs flex-wrap" role="tablist" aria-label="Profili disponibili">
        @for (profile of profileCards(); track profile.id) {
          <button class="nav-link" [class.active]="currentProfile()?.id === profile.id" type="button"
            role="tab" [id]="'profile-tab-' + profile.id" [attr.aria-controls]="'profile-panel-' + profile.id"
            [attr.aria-selected]="currentProfile()?.id === profile.id"
            [attr.tabindex]="currentProfile()?.id === profile.id ? 0 : -1"
            (click)="selectedProfile.set(profile.id)" (keydown)="onTabKeydown($event, profile.id)">{{ profile.label }}</button>
        }
      </div>
      @if (profileCards().length) {
        @for (profile of profileCards(); track profile.id) {
          <section class="profile-panel p-4 border border-top-0" role="tabpanel"
            [id]="'profile-panel-' + profile.id" [attr.aria-labelledby]="'profile-tab-' + profile.id"
            [hidden]="currentProfile()?.id !== profile.id" tabindex="0">
            <h2 class="h4">{{ profile.label }}</h2>
            <p class="text-muted">{{ profile.description }}</p>
            <nav class="d-flex flex-wrap gap-2" [attr.aria-label]="'Pagine del profilo ' + profile.label">
              @for (item of profiles.linksFor(profile.id); track item.label) {
                <a class="btn btn-outline-primary" [routerLink]="item.path" [queryParams]="item.queryParams ?? null"
                  (click)="profiles.select(profile.id)">{{ item.label }}</a>
              }
            </nav>
          </section>
        }
      } @else {
        <div class="alert alert-info mt-4" role="status">Non ci sono profili disponibili per questo account.</div>
      }
    </section>
  `,
  styles: `.profile-panel { background: #fff; border-radius: 0 0 4px 4px; }`,
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  readonly profiles = inject(ProfileService);
  readonly selectedProfile = signal<AppProfile | null>(null);
  readonly profileCards = computed(() => {
    const available = availableProfiles(this.auth.user());
    return PROFILE_CARDS.filter((profile) => available.includes(profile.id));
  });
  readonly currentProfile = computed(() => this.profileCards().find((profile) => profile.id === this.selectedProfile()) ?? this.profileCards()[0] ?? null);

  onTabKeydown(event: KeyboardEvent, profile: AppProfile): void {
    const cards = this.profileCards();
    const index = cards.findIndex((card) => card.id === profile);
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % cards.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + cards.length) % cards.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = cards.length - 1;
    else return;
    event.preventDefault();
    const next = cards[nextIndex]?.id;
    if (!next) return;
    this.selectedProfile.set(next);
    document.getElementById(`profile-tab-${next}`)?.focus();
  }
}
