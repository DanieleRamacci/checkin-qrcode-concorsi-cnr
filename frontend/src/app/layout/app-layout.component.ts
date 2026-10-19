import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ProfileService } from '../core/profile.service';

@Component({
  selector: 'app-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip-link" href="#main-content">Vai al contenuto principale</a>
    <div class="app-shell">
      <header class="app-header">
        <div class="app-header-inner">
          <a class="app-brand" routerLink="/" aria-label="CNR, Check-in Concorsi">CNR <span>·</span> Check-in Concorsi</a>
          <button class="app-menu-toggle btn btn-outline-primary btn-sm" type="button"
            [attr.aria-expanded]="menuOpen()" aria-controls="main-navigation" (click)="menuOpen.set(!menuOpen())">Menu</button>
          <nav id="main-navigation" class="app-navigation" [class.is-open]="menuOpen()" aria-label="Navigazione principale">
            @for (item of profiles.navigation(); track item.label) {
              <a [routerLink]="item.path" [queryParams]="item.queryParams ?? null"
                routerLinkActive="active" (click)="menuOpen.set(false)">{{ item.label }}</a>
            }
          </nav>
          <button class="app-profile-switch btn btn-outline-primary btn-sm" type="button" routerLink="/">
            Profilo: {{ profiles.label() }}
          </button>
          <div class="app-user-zone position-relative">
            <button class="btn btn-primary btn-sm" type="button" [attr.aria-expanded]="userMenuOpen()"
              aria-controls="user-menu" (click)="toggleUserMenu()">
              @if (auth.user()) { {{ auth.user()?.display_name || auth.user()?.email }} } @else { Effettua il login }
            </button>
            @if (userMenuOpen()) {
              <div id="user-menu" class="app-user-menu shadow" role="menu">
                @if (auth.user()) {
                  <p class="mb-1 fw-semibold">{{ auth.user()?.display_name || auth.user()?.email }}</p>
                  <p class="mb-3 text-muted small">{{ auth.user()?.email }}</p>
                  <a role="menuitem" routerLink="/area-personale" (click)="userMenuOpen.set(false)">Area personale</a>
                  @if (auth.hasCapability('admin')) {
                    <a role="menuitem" routerLink="/admin/impostazioni" (click)="userMenuOpen.set(false)">Impostazioni applicazione</a>
                  }
                  <button role="menuitem" type="button" (click)="logout()">Logout</button>
                } @else {
                  <button role="menuitem" type="button" (click)="login()">Effettua il login</button>
                }
              </div>
            }
          </div>
        </div>
      </header>

      <main id="main-content" tabindex="-1" class="flex-grow-1">
        <router-outlet />
      </main>

      <footer class="app-footer mt-5">
        <div class="container-xxl py-4">
          <div class="row align-items-center">
            <div class="col-12 col-md-8">
              <p class="mb-1">Realizzato per {{ settings.footer_owner }}</p>
              <a href="/privacy-policy">Privacy Policy</a>
            </div>
            <div class="col-12 col-md-4 text-md-end mt-3 mt-md-0">
              <small class="d-block">Versione: {{ appVersion }}</small>
              <small class="d-block">Aggiornato: {{ appBuildTime }}</small>
            </div>
          </div>
          <p class="mb-0 mt-3 text-center"><small>&copy; {{ currentYear }} {{ settings.institution_name }} - Tutti i diritti riservati.</small></p>
        </div>
      </footer>
    </div>
  `,
  styles: `
    .app-shell { min-height: 100vh; display: flex; flex-direction: column; }
    .skip-link { position: absolute; left: -10000px; top: auto; }
    .skip-link:focus { left: 1rem; top: 1rem; z-index: 10000; background: white; padding: .75rem; }
    .app-header { background: white; border-bottom: 1px solid #d9dadb; }
    .app-header-inner { min-height: 64px; max-width: 1440px; margin: 0 auto; padding: .5rem 1.25rem; display: flex; align-items: center; gap: 1.25rem; }
    .app-brand { color: #17324d; font-size: 1.1rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .app-brand span { color: #0066cc; }
    .app-navigation { display: flex; flex: 1; align-items: center; gap: 1rem; }
    .app-navigation a { color: #17324d; text-decoration: none; padding: .55rem .35rem; border-bottom: 3px solid transparent; }
    .app-navigation a.active { color: #005cb9; border-color: #0066cc; font-weight: 700; }
    .app-menu-toggle { display: none; }
    .app-user-zone { text-align: right; }
    .app-user-menu { position: absolute; right: 0; top: calc(100% + .35rem); z-index: 1000; min-width: 17rem; padding: .75rem; border-radius: 4px; background: white; color: #17324d; text-align: left; }
    .app-user-menu a, .app-user-menu button { display: block; width: 100%; padding: .45rem .5rem; border: 0; background: transparent; text-align: left; color: inherit; text-decoration: none; }
    .app-user-menu a:hover, .app-user-menu button:hover { background: #f5f6f8; }
    .app-footer { background: #17324d; color: white; }
    .app-footer a { color: white; }
    @media (max-width: 991.98px) {
      .app-header-inner { flex-wrap: wrap; gap: .5rem; padding: .65rem .75rem; }
      .app-brand { flex: 1; font-size: 1rem; }
      .app-menu-toggle { display: inline-block; }
      .app-navigation { display: none; flex-basis: 100%; order: 5; flex-direction: column; align-items: stretch; gap: 0; }
      .app-navigation.is-open { display: flex; }
      .app-navigation a { padding: .65rem .5rem; border-bottom: 1px solid #d9dadb; }
      .app-profile-switch { order: 3; }
      .app-user-zone { order: 4; }
    }
  `,
})
export class AppLayoutComponent {
  readonly auth = inject(AuthService);
  readonly profiles = inject(ProfileService);
  readonly userMenuOpen = signal(false);
  readonly menuOpen = signal(false);
  readonly currentYear = new Date().getFullYear();

  get settings() { return this.auth.settings(); }
  get appVersion(): string { return this.auth.user()?.app_version || 'n/d'; }
  get appBuildTime(): string { return this.auth.user()?.app_build_time || 'n/d'; }
  toggleUserMenu(): void {
    if (!this.auth.user()) { this.login(); return; }
    this.userMenuOpen.set(!this.userMenuOpen());
  }
  login(): void { this.auth.login(); }
  logout(): void { this.userMenuOpen.set(false); this.auth.logout(); }
}
