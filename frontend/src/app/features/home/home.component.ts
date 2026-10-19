import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AppProfile, ProfileService } from '../../core/profile.service';

interface ProfileCard { id: AppProfile; label: string; description: string; }

const PROFILE_CARDS: ProfileCard[] = [
  { id: 'segretario', label: 'Segretario', description: 'Gestisci i tuoi concorsi e le sessioni fino all’invio delle liste.' },
  { id: 'referente', label: 'Referente', description: 'Completa la configurazione dei bandi che ti sono assegnati.' },
  { id: 'sede', label: 'Informatico in sede', description: 'Segui le sessioni assegnate e gestisci le richieste di reset.' },
  { id: 'esperto', label: 'Esperto remoto', description: 'Prepara l’ambiente d’esame e gestisci i reset assegnati.' },
  { id: 'admin', label: 'Amministratore', description: 'Gestisci utenti, impostazioni e log di sistema.' },
];

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="container my-5" aria-labelledby="page-title">
      <h1 id="page-title" class="mb-2">Scegli il tuo profilo</h1>
      <p class="text-muted mb-4">Seleziona il ruolo con cui vuoi lavorare.</p>
      <div class="row g-3">
        @for (profile of operationalProfiles(); track profile.id) {
          <div class="col-12 col-md-6 col-xl-4">
            <article class="card h-100 shadow-sm profile-card" [class.profile-card--last]="profile.id === profiles.active()">
              <div class="card-body d-flex flex-column">
                @if (profile.id === profiles.active()) { <span class="badge text-bg-primary align-self-start mb-2">Ultimo usato</span> }
                <h2 class="card-title h5">{{ profile.label }}</h2>
                <p class="card-text flex-grow-1">{{ profile.description }}</p>
                <button class="btn" [class.btn-primary]="profile.id === profiles.active()" [class.btn-outline-primary]="profile.id !== profiles.active()" type="button" (click)="selectProfile(profile.id)">Continua come {{ profile.label }}</button>
              </div>
            </article>
          </div>
        }
      </div>
      @if (hasAdminProfile()) {
        <div class="mt-4 pt-3 border-top">
          <div class="d-flex flex-wrap align-items-center gap-3">
            <div><p class="app-eyebrow mb-1">Amministrazione</p><h2 class="h5 mb-0">Gestisci utenti e impostazioni</h2></div>
            @if (profiles.active() === 'admin') { <span class="badge text-bg-primary">Ultimo usato</span> }
            <a class="btn ms-auto" [class.btn-primary]="profiles.active() === 'admin'" [class.btn-outline-secondary]="profiles.active() !== 'admin'" routerLink="/admin" (click)="profiles.select('admin')">Apri amministrazione</a>
          </div>
        </div>
      }
    </section>
  `,
  styles: `.profile-card--last { border:2px solid #0066cc; }`,
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  readonly profiles = inject(ProfileService);
  private readonly router = inject(Router);
  readonly operationalProfiles = computed(() => {
    const available = this.auth.user()?.profiles;
    if (available?.length) return PROFILE_CARDS.filter((profile) => profile.id !== 'admin' && available.includes(profile.id));
    const capabilities = this.auth.user()?.capabilities ?? [];
    const ids: AppProfile[] = ['segretario', 'referente'];
    if (capabilities.includes('sede_workflow') || capabilities.includes('admin')) ids.push('sede');
    if (capabilities.includes('expert_workflow')) ids.push('esperto');
    if (capabilities.includes('admin')) ids.push('admin');
    return PROFILE_CARDS.filter((profile) => profile.id !== 'admin' && ids.includes(profile.id));
  });
  readonly hasAdminProfile = () => this.auth.user()?.profiles?.includes('admin') === true
    || this.auth.user()?.capabilities?.includes('admin') === true;

  constructor() {
    const available = this.auth.user()?.profiles ?? [];
    if (available.length === 1) {
      const only = available[0];
      this.profiles.select(only);
      void this.router.navigateByUrl(this.profiles.homeDestinations[only]);
    }
  }

  selectProfile(profile: AppProfile): void {
    this.profiles.select(profile);
    void this.router.navigateByUrl(this.profiles.homeDestinations[profile]);
  }
}
